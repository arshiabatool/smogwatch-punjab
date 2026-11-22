/* app.js: SmogWatch Punjab v2 */
(function () {
  'use strict';

  const L = window.SW, I18N = window.SW_I18N;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = L.escapeHtml;
  const mqMobile = window.matchMedia('(max-width: 860px)');
  const isMobile = () => mqMobile.matches;

  const STYLES = {
    light: 'https://tiles.openfreemap.org/styles/positron',
    dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  };

  const S = {
    lang: 'en', theme: 'dark', city: 'Lahore', tab: 'now',
    latest: null, history: null, fireList: [], forecast: null, stationList: [],
    timeline: null, series: null, tIdx: 0, playing: false, timer: null, replayToastShown: false,
    layers: { cities: true, sensors: true, fires: true, wind: true, cone: false },
    map: null, mapReady: false, styleFallback: false, markers: {}, charts: {}, rkFilter: '', booted: false
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };

  /* ---------- text helpers ---------- */
  function t(key, vars) {
    const dict = I18N[S.lang] || I18N.en;
    let s = dict[key];
    if (s == null) s = I18N.en[key];
    if (s == null) s = key;
    if (vars) Object.keys(vars).forEach(k => { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  const cityLabel = name => (S.lang === 'ur' && I18N.cities_ur[name]) || name;
  const fmt = (v, d = 0) => L.isNum(v) ? Number(v).toFixed(d) : '–';
  const locale = () => S.lang === 'ur' ? 'ur-PK' : 'en-GB';
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const cityData = name => S.latest && S.latest.cities.find(c => c.city === name);

  function parseLocal(str) {
    const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(str || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
  }
  function fmtDateTime(str) {
    const d = parseLocal(str); if (!d) return str || '';
    return new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', hour12: true }).format(d);
  }
  function fmtDay(str) {
    const d = parseLocal(str); if (!d) return '';
    return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(d);
  }
  function fmtHour(h) {
    return new Intl.DateTimeFormat(locale(), { hour: 'numeric', hour12: true }).format(new Date(2000, 0, 1, h));
  }

  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toast.tm); toast.tm = setTimeout(() => el.classList.remove('show'), 4200);
  }

  /* ---------- theme and language ---------- */
  function applyTheme(theme, fromUser) {
    S.theme = theme;
    document.documentElement.dataset.theme = theme;
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0e1620' : '#f3f5f8');
    if (fromUser) store.set('sw-theme', theme);
    if (S.map) { S.mapReady = false; S.styleFallback = false; S.map.setStyle(STYLES[theme]); }
    renderCharts();
  }

  function applyLang(lang, fromUser) {
    S.lang = lang;
    const html = document.documentElement;
    html.lang = lang; html.dir = lang === 'ur' ? 'rtl' : 'ltr';
    if (fromUser) store.set('sw-lang', lang);
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    $('#btnLang').lang = lang === 'ur' ? 'en' : 'ur';
    document.title = t('app_name') + (lang === 'ur' ? ': فضائی معیار اور سموگ' : ': live air quality and smog');
    if (S.latest) { fillCitySelect(); updateSensorCount(); renderAll(); }
  }

  /* ---------- data ---------- */
  async function getJSON(name, optional) {
    try {
      const r = await fetch('data/' + name + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error(name + ' ' + r.status);
      return await r.json();
    } catch (e) {
      if (optional) return null;
      throw e;
    }
  }

  async function loadData() {
    const [latest, history, fires] = await Promise.all([getJSON('latest.json'), getJSON('history.json'), getJSON('fires.json')]);
    const [forecast, stations] = await Promise.all([getJSON('forecast.json', true), getJSON('stations.json', true)]);
    if (!latest || !Array.isArray(latest.cities) || !latest.cities.length) throw new Error('latest.json has no cities');
    S.latest = latest;
    S.history = history || {};
    S.fireList = (fires && fires.fires) || [];
    S.forecast = forecast;
    S.stationList = ((stations && stations.stations) || []).filter(s => L.isNum(s.lat) && L.isNum(s.lon) && L.isNum(s.pm25));
    S.timeline = L.buildTimeline(S.history);
    S.series = L.buildSeries(S.history);
  }

  /* ---------- map ---------- */
  function initMap() {
    const map = new maplibregl.Map({
      container: 'map', style: STYLES[S.theme], center: [72.6, 31.2], zoom: isMobile() ? 5 : 6,
      minZoom: 4, maxZoom: 13, attributionControl: false, dragRotate: false, pitchWithRotate: false
    });
    S.map = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('style.load', onStyleLoad);
    map.on('zoom', () => $('#map').classList.toggle('zhi', map.getZoom() >= 7));
    map.on('error', () => {
      /* If the dark style cannot be fetched, fall back to the light one so the map is never blank. */
      if (!S.mapReady && !S.styleFallback && S.theme === 'dark') { S.styleFallback = true; map.setStyle(STYLES.light); }
    });
    map.on('click', e => {
      if (!S.mapReady || !map.getLayer('stations') || !S.layers.sensors) return;
      const f = map.queryRenderedFeatures(e.point, { layers: ['stations'] })[0];
      if (f) showStationPopup(f, e.lngLat);
    });
    map.on('mousemove', e => {
      if (!S.mapReady || !map.getLayer('stations')) return;
      map.getCanvas().style.cursor = map.queryRenderedFeatures(e.point, { layers: ['stations'] }).length ? 'pointer' : '';
    });
  }

  function mapPadding() {
    if (isMobile()) return { top: 170, bottom: Math.round(window.innerHeight * 0.46) + 10, left: 20, right: 20 };
    const w = ($('#panel').offsetWidth || 400) + 28, rtl = S.lang === 'ur';
    return { top: 130, bottom: 100, left: rtl ? 20 : w, right: rtl ? w : 70 };
  }

  function arrowImage(color) {
    const s = 32, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const g = cv.getContext('2d');
    g.fillStyle = color; g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(16, 3); g.lineTo(25, 27); g.lineTo(16, 21); g.lineTo(7, 27); g.closePath();
    g.fill(); g.stroke();
    return g.getImageData(0, 0, s, s);
  }

  function onStyleLoad() {
    const map = S.map, empty = { type: 'FeatureCollection', features: [] };
    if (!map.hasImage('arrow')) map.addImage('arrow', arrowImage(S.theme === 'dark' ? '#cfe6ff' : '#1b4965'));
    ['stations', 'fires', 'winds', 'cone', 'cone-fires'].forEach(id => { if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: empty }); });

    map.addLayer({ id: 'cone-fill', type: 'fill', source: 'cone', paint: { 'fill-color': '#ff7a1a', 'fill-opacity': 0.16 } });
    map.addLayer({ id: 'cone-line', type: 'line', source: 'cone', paint: { 'line-color': '#ff7a1a', 'line-width': 1.6, 'line-dasharray': [2, 2] } });
    map.addLayer({
      id: 'stations', type: 'circle', source: 'stations',
      paint: {
        'circle-color': ['get', 'col'], 'circle-opacity': 0.92,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3.2, 8, 5.5, 11, 8.5],
        'circle-stroke-color': S.theme === 'dark' ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.95)', 'circle-stroke-width': 1
      }
    });
    map.addLayer({ id: 'fires-glow', type: 'circle', source: 'fires', paint: { 'circle-color': '#ff5a1f', 'circle-opacity': 0.2, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 6, 9, 16], 'circle-blur': 0.8 } });
    map.addLayer({ id: 'fires', type: 'circle', source: 'fires', paint: { 'circle-color': '#ff6a2b', 'circle-opacity': 0.92, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.2, 9, 5], 'circle-stroke-color': '#fff1dc', 'circle-stroke-width': 0.6 } });
    map.addLayer({ id: 'cone-fires', type: 'circle', source: 'cone-fires', paint: { 'circle-color': '#ff2d2d', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3.5, 9, 7], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.4 } });
    map.addLayer({
      id: 'wind', type: 'symbol', source: 'winds',
      layout: {
        'icon-image': 'arrow', 'icon-rotate': ['+', ['get', 'wind_dir'], 180], 'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-offset': [0, -42],
        'icon-size': ['interpolate', ['linear'], ['get', 'wind_ms'], 0, 0.5, 8, 0.9]
      },
      paint: { 'icon-opacity': 0.85 }
    });
    S.mapReady = true;
    syncMapData();
    applyLayerVisibility();
  }

  function syncMapData() {
    if (!S.mapReady || !S.latest) return;
    const map = S.map, fc = f => ({ type: 'FeatureCollection', features: f });
    const pt = (lon, lat, props) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props || {} });
    const now = Date.now();
    map.getSource('stations').setData(fc(S.stationList.map(s => pt(s.lon, s.lat, {
      name: s.name || '', pm25: s.pm25, aqi: L.isNum(s.aqi) ? s.aqi : L.pm25ToAqi(s.pm25), t: s.t || '', col: L.aqiColor(L.isNum(s.aqi) ? s.aqi : L.pm25ToAqi(s.pm25)), now
    }))));
    map.getSource('fires').setData(fc(S.fireList.filter(f => L.isNum(f.latitude) && L.isNum(f.longitude)).map(f => pt(f.longitude, f.latitude, { frp: f.frp }))));
    map.getSource('winds').setData(fc(S.latest.cities.filter(c => L.isNum(c.wind_dir) && L.isNum(c.wind_ms)).map(c => pt(c.lon, c.lat, { wind_dir: c.wind_dir, wind_ms: c.wind_ms }))));
    updateCone();
    dimSensors();
  }

  function dimSensors() {
    if (!S.mapReady || !S.map.getLayer('stations') || !S.timeline) return;
    S.map.setPaintProperty('stations', 'circle-opacity', S.tIdx === S.timeline.nowIdx ? 0.92 : 0.22);
  }

  function updateCone() {
    if (!S.mapReady) return;
    const c = cityData(S.city), a = S.map.getSource('cone'), b = S.map.getSource('cone-fires');
    if (!c || !a || !b) return;
    const feat = L.coneFeature(c.lat, c.lon, c.wind_dir);
    a.setData(feat.type === 'Feature' ? { type: 'FeatureCollection', features: [feat] } : feat);
    const inside = L.firesInCone(c.lat, c.lon, c.wind_dir, S.fireList);
    b.setData({ type: 'FeatureCollection', features: inside.map(f => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.longitude, f.latitude] }, properties: {} })) });
  }

  function applyLayerVisibility() {
    Object.values(S.markers).forEach(m => m.el.classList.toggle('hide', !S.layers.cities));
    if (!S.mapReady) return;
    const set = (ids, on) => ids.forEach(id => { if (S.map.getLayer(id)) S.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); });
    set(['stations'], S.layers.sensors);
    set(['fires-glow', 'fires'], S.layers.fires);
    set(['wind'], S.layers.wind);
    set(['cone-fill', 'cone-line', 'cone-fires'], S.layers.cone);
    $$('.chip[data-layer]').forEach(ch => ch.classList.toggle('on', !!S.layers[ch.dataset.layer]));
  }

  function showStationPopup(f, lngLat) {
    const p = f.properties, aqi = +p.aqi, age = L.ageMinutesUtc(p.t, Date.now());
    const ago = age == null ? '' : age < 90 ? t('st_ago_min', { m: Math.max(1, Math.round(age)) }) : t('st_ago_h', { h: Math.round(age / 60) });
    const html = '<div class="pop"><b>' + esc(p.name || t('st_title')) + '</b>' +
      '<span class="aq" style="background:' + L.aqiColor(aqi) + ';color:' + L.aqiTextColor(aqi) + '">' + fmt(aqi) + '</span>' +
      '<span class="num">PM2.5 ' + fmt(+p.pm25, 1) + ' µg/m³</span>' + (ago ? '<small>' + esc(ago) + ' · OpenAQ</small>' : '') + '</div>';
    new maplibregl.Popup({ closeButton: false, offset: 10, maxWidth: '260px' }).setLngLat(lngLat).setHTML(html).addTo(S.map);
  }

  /* ---------- city bubbles ---------- */
  function buildMarkers() {
    Object.values(S.markers).forEach(m => m.marker.remove());
    S.markers = {};
    S.latest.cities.forEach(c => {
      if (!L.isNum(c.lat) || !L.isNum(c.lon)) return;
      const el = document.createElement('div');
      el.className = 'mk';
      el.innerHTML = '<div class="bubble"><b class="num">–</b></div><span class="lbl"></span>';
      el.addEventListener('click', ev => { ev.stopPropagation(); select(c.city, { fly: true }); });
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([c.lon, c.lat]).addTo(S.map);
      S.markers[c.city] = { marker, el };
    });
    applyLayerVisibility();
  }

  function aqiAtTime(c) {
    const tl = S.timeline;
    if (!tl || S.tIdx === tl.nowIdx) return c.aqi;
    const m = S.series[c.city];
    return m ? (m.has(tl.times[S.tIdx]) ? m.get(tl.times[S.tIdx]) : null) : null;
  }

  function paintCities() {
    S.latest.cities.forEach(c => {
      const mk = S.markers[c.city]; if (!mk) return;
      const aqi = aqiAtTime(c), el = mk.el;
      el.querySelector('b').textContent = L.isNum(aqi) ? Math.round(aqi) : '–';
      el.querySelector('.lbl').textContent = cityLabel(c.city);
      el.style.setProperty('--c', L.aqiColor(aqi));
      el.style.setProperty('--tc', L.aqiTextColor(aqi));
      el.classList.toggle('sev', L.isNum(aqi) && aqi > 200);
      el.classList.toggle('sel', c.city === S.city);
      el.title = cityLabel(c.city) + ' · ' + t('aqi') + ' ' + fmt(aqi);
    });
  }

  /* ---------- selection ---------- */
  function select(name, opts) {
    const c = cityData(name); if (!c) return;
    S.city = name;
    $('#citySelect').value = name;
    try { history.replaceState(null, '', '#' + encodeURIComponent(name)); } catch (e) { /* file:// */ }
    paintCities();
    renderHead(); renderNow(); renderSmog(); renderRank(); renderCharts();
    updateCone();
    if (opts && opts.fly && S.map) {
      S.map.easeTo({ center: [c.lon, c.lat], zoom: Math.max(S.map.getZoom(), 7.6), padding: mapPadding(), duration: 900 });
    }
  }

  function fillCitySelect() {
    const sel = $('#citySelect');
    const names = S.latest.cities.map(c => c.city).sort((a, b) => cityLabel(a).localeCompare(cityLabel(b), locale()));
    sel.innerHTML = names.map(n => '<option value="' + esc(n) + '">' + esc(cityLabel(n)) + '</option>').join('');
    sel.value = S.city;
  }

  function updateSensorCount() {
    $('#sensorCount').textContent = S.stationList.length ? '(' + S.stationList.length + ')' : '';
  }

  /* ---------- panel rendering ---------- */
  function renderAll() {
    renderHead(); renderNow(); renderSmog(); renderRank(); renderTrendTitles();
    paintCities(); updateTimebarText(); renderCharts(); updateCone();
  }

  function renderHead() {
    const c = cityData(S.city); if (!c) return;
    $('#cityName').textContent = cityLabel(c.city);
    $('#citySub').textContent = t('updated') + ' ' + (S.latest.updated || '–') + ' · ' + t('pk_time');
    const b = $('#srcBadge'), measured = c.source === 'Measured';
    b.className = 'badge ' + (measured ? 'measured' : 'modelled');
    b.textContent = measured ? t('src_measured') : t('src_modelled');
    b.title = measured ? t('src_measured_tip') : t('src_modelled_tip');
    const age = L.ageMinutesPk(S.latest.updated, Date.now()), pill = $('#stalePill');
    if (age != null && age > 180) { pill.hidden = false; pill.textContent = t('stale', { h: Math.round(age / 60) }); } else pill.hidden = true;
  }

  function polar(cx, cy, r, a) { const x = cx + r * Math.cos(a * Math.PI / 180), y = cy + r * Math.sin(a * Math.PI / 180); return x.toFixed(2) + ' ' + y.toFixed(2); }

  function gaugeSvg(aqi) {
    const cx = 110, cy = 110, r = 90, gap = 2.6;
    let arcs = '';
    L.BANDS.forEach((b, i) => {
      const a0 = 180 + i * 30 + gap, a1 = 180 + (i + 1) * 30 - gap;
      arcs += '<path d="M' + polar(cx, cy, r, a0) + ' A' + r + ' ' + r + ' 0 0 1 ' + polar(cx, cy, r, a1) + '" fill="none" stroke="' + b.color + '" stroke-width="14" stroke-linecap="round"/>';
    });
    const col = L.aqiColor(aqi), rot = (L.gaugeFraction(aqi) * 180).toFixed(1);
    return '<svg class="gauge" viewBox="0 0 220 124" aria-hidden="true">' + arcs +
      '<g class="needle" data-rot="' + rot + '" style="transform:rotate(0deg)">' +
      '<circle cx="20" cy="110" r="9" fill="#fff" stroke="' + col + '" stroke-width="4.5"/></g>' +
      '</svg>';
  }

  function windArrowSvg(dirFrom, color) {
    const rot = L.isNum(dirFrom) ? dirFrom + 180 : 0;
    return '<svg class="windarrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><g transform="rotate(' + rot + ' 8 8)"><path d="M8 1.5l4.5 12L8 10.6 3.5 13.5z" fill="' + color + '"/></g></svg>';
  }

  function renderNow() {
    const c = cityData(S.city); if (!c) return;
    const band = L.bandOf(c.aqi), key = band ? band.key : null, col = L.aqiColor(c.aqi);
    const who = L.isNum(c.pm25) ? c.pm25 / 15 : null;
    const diff = L.isNum(c.aqi) && L.isNum(c.yesterday_aqi) ? Math.round(c.aqi - c.yesterday_aqi) : null;
    const ydayTxt = L.isNum(c.yesterday_aqi) ? t('yday_line', { v: fmt(c.yesterday_aqi) }) + (diff == null ? '' : ' (' + (diff >= 0 ? '+' : '') + diff + ')') : '';
    const tile = (val, label, extra) => '<div class="tile"' + (extra || '') + '><b class="num">' + val + '</b><span>' + label + '</span></div>';
    const dirTxt = L.isNum(c.wind_dir) ? t('wx_from', { d: t('dir_' + L.compass(c.wind_dir)) }) : '';
    const pol = (v, name) => tile(fmt(v, 1), name + ' <small>µg/m³</small>');

    $('#paneNow').innerHTML =
      '<div class="gwrap">' + gaugeSvg(c.aqi) + '<div class="gnum num">' + fmt(c.aqi) + '<small>' + esc(t('aqi')) + '</small></div></div>' +
      '<div class="gcap"><span class="cat-pill" style="background:' + col + ';color:' + L.aqiTextColor(c.aqi) + '">' + esc(key ? t('cat_' + key) : t('no_data')) + '</span>' +
      '<div class="meta"><span class="num">PM2.5 ' + fmt(c.pm25, 1) + ' µg/m³</span>' + (who == null ? '' : ' · ' + esc(who <= 1 ? t('who_ok') : t('who_times', { x: who.toFixed(1) }))) + '</div>' +
      (ydayTxt ? '<div class="meta num">' + esc(ydayTxt) + '</div>' : '') + '</div>' +

      '<h2>' + esc(t('advice_title')) + '</h2>' +
      (key ? '<div class="advice" style="--c:' + col + '"><div class="a"><b>' + esc(t('adv_public')) + '</b><div>' + esc(t('adv_' + key + '_gen')) + '</div></div>' +
        '<div class="a"><b>' + esc(t('adv_sensitive')) + '</b><div>' + esc(t('adv_' + key + '_sens')) + '</div></div></div>' +
        '<p class="note">' + esc(t('adv_who')) + '</p>' : '') +

      '<h2>' + esc(t('wx_title')) + '</h2><div class="tiles">' +
      tile(fmt(c.temp) + ' °C', esc(t('wx_temp'))) + tile(fmt(c.humidity) + ' %', esc(t('wx_hum'))) +
      '<div class="tile"><b class="num">' + windArrowSvg(c.wind_dir, col) + fmt(c.wind_ms, 1) + ' m/s</b><span>' + esc(t('wx_wind')) + (dirTxt ? ' · ' + esc(dirTxt) : '') + '</span></div>' +
      tile(L.isNum(c.visibility) ? fmt(c.visibility / 1000, 1) + ' km' : '–', esc(t('wx_vis'))) +
      tile(fmt(c.blh) + ' m', esc(t('wx_blh')), ' title="' + esc(t('wx_blh_tip')) + '"') + '</div>' +

      '<h2>' + esc(t('pol_title')) + '</h2><div class="tiles">' +
      pol(c.pm25, 'PM2.5') + pol(c.pm10, 'PM10') + pol(c.no2, 'NO₂') + pol(c.so2, 'SO₂') + pol(c.co, 'CO') + pol(c.o3, 'O₃') + '</div>';

    const needle = $('#paneNow .needle');
    if (needle) requestAnimationFrame(() => requestAnimationFrame(() => { needle.style.transform = 'rotate(' + needle.dataset.rot + 'deg)'; }));
  }

  const LEVEL_COLORS = { Low: '#2fbf71', Moderate: '#f4c20d', High: '#f28c28', Severe: '#e5483f' };
  const LEVEL_TEXT = { Low: '#07241a', Moderate: '#2b2100', High: '#2e1700', Severe: '#ffffff' };

  function renderSmog() {
    const c = cityData(S.city); if (!c) return;
    const pane = $('#paneSmog');
    let h = '';

    if (c.smog_level == null) {
      h += '<div class="card"><p>' + esc(t('smog_unavailable')) + '</p></div>';
    } else {
      const reasons = L.smogReasons(c);
      h += '<div class="card"><div class="level"><span class="lv" style="background:' + (LEVEL_COLORS[c.smog_level] || '#888') + ';color:' + (LEVEL_TEXT[c.smog_level] || '#fff') + '">' + esc(t('lvl_' + c.smog_level)) + '</span>' +
        '<span class="muted num">' + esc(t('smog_score', { v: fmt(c.smog_score) })) + '</span></div>' +
        '<div class="meter"><i style="left:0%" data-left="' + L.clamp(+c.smog_score || 0, 0, 100) + '"></i></div>' +
        '<h3 style="margin-top:14px">' + esc(t('smog_why')) + '</h3>' +
        (reasons.length ? '<ul class="reasons">' + reasons.map(r => '<li>' + esc(t('why_' + r.k, { v: r.v })) + '</li>').join('') + '</ul>'
          : '<p>' + esc(t('smog_none')) + '</p>') + '</div>';
    }

    h += '<div class="stats"><div class="card stat"><b class="num">' + fmt(c.fires_150km) + '</b><span>' + esc(t('fires_near')) + '</span></div>' +
      '<div class="card stat"><b class="num">' + fmt(c.fires_upwind) + '</b><span>' + esc(t('fires_up')) + '</span></div></div>' +
      '<button class="btn ghost block" type="button" data-act="cone">' + esc(S.layers.cone ? t('hide_cone') : t('show_cone')) + '</button>' +
      '<p class="note">' + esc(t('cone_hint')) + '</p>';

    /* best / worst hours */
    const hist = S.history[c.city], win = hist && hist.time && hist.time.length ? L.cleanestWindow(hist, hist.time[hist.time.length - 1]) : null;
    h += '<div class="card"><h3>' + esc(t('best_title')) + '</h3>';
    if (win) {
      const day = w => t(w.date === win.nowDate ? 'day_today' : 'day_tomorrow');
      h += '<div class="window"><span class="t good">' + esc(t('best_line', { day: day(win.best), from: fmtHour(win.best.from), to: fmtHour(win.best.to) })) + '</span>' +
        '<span class="muted num">' + esc(t('best_pm', { v: Math.round(win.best.mean) })) + '</span></div>' +
        '<div class="window" style="margin-top:6px"><span class="bad" style="font-size:13px;font-weight:600">' + esc(t('worst_line', { day: day(win.worst), from: fmtHour(win.worst.from), to: fmtHour(win.worst.to) })) + '</span>' +
        '<span class="muted num" style="font-size:12px">' + esc(t('best_pm', { v: Math.round(win.worst.mean) })) + '</span></div>' +
        '<p class="note" style="margin-top:8px">' + esc(t('best_note')) + '</p>';
    } else h += '<p>' + esc(t('best_none')) + '</p>';
    h += '</div>';

    /* XGBoost forecast */
    const f = S.forecast && S.forecast.cities && S.forecast.cities[c.city];
    h += '<div class="card fcard"><h3>' + esc(t('fc_title')) + '</h3>';
    if (f && L.isNum(f.pm25_24h)) {
      const fa = L.isNum(f.aqi_24h) ? f.aqi_24h : L.pm25ToAqi(f.pm25_24h), fb = L.bandOf(fa);
      const pct = L.isNum(c.pm25) && c.pm25 > 0 ? Math.round((f.pm25_24h - c.pm25) / c.pm25 * 100) : null;
      h += '<p>' + esc(t('fc_sub')) + '</p><div class="vals" style="margin-top:8px"><span class="big num">≈ ' + fmt(f.pm25_24h) + ' <small style="font-size:13px;font-weight:600" class="muted">µg/m³</small></span>' +
        '<span class="cat-pill" style="background:' + L.aqiColor(fa) + ';color:' + L.aqiTextColor(fa) + '">' + esc(t('aqi')) + ' ' + fmt(fa) + (fb ? ' · ' + esc(t('cat_' + fb.key)) : '') + '</span></div>' +
        '<p class="note num" style="margin-top:8px">' +
        (pct == null ? '' : esc(Math.abs(pct) < 5 ? t('fc_same') : pct > 0 ? t('fc_higher', { p: pct }) : t('fc_lower', { p: Math.abs(pct) })) + ' · ') +
        (L.isNum(f.mae) ? esc(t('fc_error', { v: fmt(f.mae) })) : '') + '</p><p class="note" style="margin-top:6px">' + esc(t('fc_note')) + '</p>';
    } else h += '<p>' + esc(t('fc_none')) + '</p>';
    h += '</div>';

    /* model vs sensors */
    const near = L.nearbyStations(c.lat, c.lon, S.stationList, 25);
    const hs = S.history[c.city], modelNow = hs && hs.pm25 ? hs.pm25[hs.pm25.length - 1] : null;
    const mv = L.modelVsSensors(modelNow, near);
    if (mv) {
      const p = Math.round(Math.abs(mv.diffPct));
      h += '<div class="card"><h3>' + esc(t('chk_title')) + '</h3><p>' + esc(t('chk_line', { n: mv.n, s: Math.round(mv.sensors), m: Math.round(mv.model) })) + '</p>' +
        '<p class="note" style="margin-top:4px;color:var(--text)">' + esc(p < 10 ? t('chk_close') : mv.diffPct < 0 ? t('chk_lower', { p }) : t('chk_higher', { p })) + '</p></div>';
    }

    pane.innerHTML = h;
    const dot = pane.querySelector('.meter i');
    if (dot) requestAnimationFrame(() => requestAnimationFrame(() => { dot.style.left = dot.dataset.left + '%'; }));
  }

  function renderTrendTitles() {
    $('#trTrendTitle').textContent = t('tr_trend');
    $('#trHeatTitle').textContent = t('tr_heat');
    let lg = $('#heatLegend');
    if (!lg) { lg = document.createElement('div'); lg.id = 'heatLegend'; lg.className = 'legend'; $('#heatChart').after(lg); }
    lg.innerHTML = L.BANDS.map(b => '<span><i style="background:' + b.color + '"></i>' + esc(t('cat_' + b.key)) + '</span>').join('');
  }

  function renderRank() {
    const cities = S.latest.cities, valid = cities.filter(c => L.isNum(c.aqi));
    const sorted = valid.slice().sort((a, b) => b.aqi - a.aqi);
    const worst = sorted[0], best = sorted[sorted.length - 1];
    const avg = valid.length ? Math.round(valid.reduce((s, c) => s + c.aqi, 0) / valid.length) : null;
    const sum = (c, label, val, aqi) => '<div class="tile"><b class="num" style="color:' + L.aqiColor(aqi) + '">' + val + '</b><span>' + esc(label) + (c ? '<br>' + esc(cityLabel(c.city)) : '') + '</span></div>';
    $('#paneRank').innerHTML =
      '<div class="rk-sum">' + sum(worst, t('rk_worst'), worst ? fmt(worst.aqi) : '–', worst && worst.aqi) +
      sum(best, t('rk_clean'), best ? fmt(best.aqi) : '–', best && best.aqi) + sum(null, t('rk_avg'), fmt(avg), avg) + '</div>' +
      '<input id="rkSearch" class="rk-search" type="search" autocomplete="off" placeholder="' + esc(t('rk_filter')) + '" value="' + esc(S.rkFilter) + '" aria-label="' + esc(t('rk_filter')) + '">' +
      '<h2>' + esc(t('rk_title')) + '</h2><ul class="rk-list" id="rkList"></ul>';
    renderRankList();
  }

  function renderRankList() {
    const q = S.rkFilter.trim().toLowerCase();
    const rows = S.latest.cities.slice().sort((a, b) => (L.isNum(b.aqi) ? b.aqi : -1) - (L.isNum(a.aqi) ? a.aqi : -1));
    let html = '', n = 0;
    rows.forEach((c, i) => {
      if (q && !(c.city.toLowerCase().includes(q) || cityLabel(c.city).toLowerCase().includes(q))) return;
      n++;
      const h = S.history[c.city], vals = h && h.aqi ? h.aqi.slice(-24) : [], sp = L.sparkPath(vals), col = L.aqiColor(c.aqi);
      const td = L.trendDir(vals), arrow = td === 0 ? '' : '<span class="tr ' + (td > 0 ? 'up' : 'dn') + '">' + (td > 0 ? '▲' : '▼') + '</span>';
      html += '<li class="rk-row' + (c.city === S.city ? ' sel' : '') + '" data-city="' + esc(c.city) + '"><span class="n num">' + (i + 1) + '</span>' +
        '<span class="nm"><i class="' + (c.source === 'Measured' ? '' : 'mod') + '"></i><span>' + esc(cityLabel(c.city)) + '</span>' + arrow + '</span>' +
        (sp ? '<svg width="84" height="24" viewBox="0 0 84 24" aria-hidden="true"><path d="' + sp.d + '" fill="none" stroke="' + col + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="' + sp.last[0].toFixed(1) + '" cy="' + sp.last[1].toFixed(1) + '" r="2.5" fill="' + col + '"/></svg>' : '<span></span>') +
        '<span class="a num" style="background:' + col + ';color:' + L.aqiTextColor(c.aqi) + '">' + fmt(c.aqi) + '</span></li>';
    });
    $('#rkList').innerHTML = html || '<li class="note" style="padding:10px">' + esc(t('rk_none')) + '</li>';
  }

  /* ---------- charts ---------- */
  function ensureCharts() {
    if (!window.echarts) return false;
    if (!S.charts.trend) { S.charts.trend = echarts.init($('#trendChart')); S.charts.heat = echarts.init($('#heatChart')); }
    return true;
  }

  function renderCharts() {
    if (S.tab !== 'trends' || !S.latest || !ensureCharts()) return;
    drawTrend(); drawHeat();
    S.charts.trend.resize(); S.charts.heat.resize();
  }

  function drawTrend() {
    const h = S.history[S.city]; if (!h || !h.time) return;
    const muted = cssVar('--muted'), line = cssVar('--line'), accent = cssVar('--accent');
    const past = h.time.slice(-48), pv = h.pm25.slice(-48), x = past.concat(h.fc_time || []), nowIdx = past.length - 1;
    const observed = pv.concat(new Array((h.fc_time || []).length).fill(null));
    const fc = new Array(nowIdx).fill(null).concat([pv[nowIdx]], h.fc_pm25 || []);
    const label = s => s.slice(5, 10) + ' ' + s.slice(11);
    const series = [
      { name: t('tr_past'), type: 'line', data: observed, showSymbol: false, smooth: true, lineStyle: { width: 2.5, color: accent }, areaStyle: { color: accent, opacity: 0.12 }, itemStyle: { color: accent },
        markLine: { symbol: 'none', silent: true, animation: false, data: [
          { xAxis: x[nowIdx], label: { formatter: t('tr_now'), color: muted, fontSize: 10 }, lineStyle: { color: muted, type: 'dashed' } },
          { yAxis: 15, label: { formatter: t('tr_who'), color: '#2fbf71', fontSize: 10, position: 'insideEndTop' }, lineStyle: { color: '#2fbf71', type: 'dotted' } }] } },
      { name: t('tr_model'), type: 'line', data: fc, showSymbol: false, smooth: true, lineStyle: { width: 2, type: 'dashed', color: '#f28c28' }, itemStyle: { color: '#f28c28' } }
    ];
    const f = S.forecast && S.forecast.cities && S.forecast.cities[S.city];
    if (f && L.isNum(f.pm25_24h) && nowIdx + 24 < x.length) {
      const pts = new Array(x.length).fill(null); pts[nowIdx + 24] = f.pm25_24h;
      series.push({ name: t('tr_xgb'), type: 'scatter', data: pts, symbolSize: 15, itemStyle: { color: '#9b4dca', borderColor: '#fff', borderWidth: 2 } });
    }
    S.charts.trend.setOption({
      textStyle: { color: muted, fontFamily: 'Inter, sans-serif' }, tooltip: { trigger: 'axis' },
      legend: { top: 0, textStyle: { color: muted, fontSize: 11 }, itemWidth: 16, itemHeight: 8 },
      grid: { left: 42, right: 14, top: 38, bottom: 30 },
      xAxis: { type: 'category', data: x, axisLabel: { interval: 11, formatter: label, color: muted, fontSize: 10 }, axisLine: { lineStyle: { color: line } } },
      yAxis: { type: 'value', name: 'µg/m³', nameTextStyle: { color: muted, fontSize: 10 }, axisLabel: { color: muted, fontSize: 10 }, splitLine: { lineStyle: { color: line } } },
      series
    }, true);
  }

  function drawHeat() {
    const h = S.history[S.city]; if (!h || !h.time) return;
    const muted = cssVar('--muted'), days = [], pts = [];
    h.time.forEach((ts, i) => {
      const d = ts.slice(0, 10); let di = days.indexOf(d);
      if (di < 0) { days.push(d); di = days.length - 1; }
      const a = h.aqi ? h.aqi[i] : null;
      if (L.isNum(a)) pts.push([parseInt(ts.slice(11, 13), 10), di, a]);
    });
    S.charts.heat.setOption({
      textStyle: { color: muted, fontFamily: 'Inter, sans-serif' },
      tooltip: { formatter: p => days[p.value[1]] + ' ' + String(p.value[0]).padStart(2, '0') + ':00<br>' + t('aqi') + ' ' + p.value[2] },
      grid: { left: 46, right: 10, top: 8, bottom: 26 },
      xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), axisLabel: { color: muted, fontSize: 10, interval: 2 }, splitArea: { show: false } },
      yAxis: { type: 'category', data: days.map(d => d.slice(5)), inverse: true, axisLabel: { color: muted, fontSize: 10 } },
      visualMap: { type: 'piecewise', show: false, pieces: L.BANDS.map(b => ({ min: b.lo, max: b.hi, color: b.color })) },
      series: [{ type: 'heatmap', data: pts, itemStyle: { borderRadius: 2, borderColor: 'rgba(0,0,0,0)', borderWidth: 1 } }]
    }, true);
  }

  /* ---------- time slider ---------- */
  function initTimebar() {
    const tl = S.timeline, sl = $('#tSlider'), bar = $('#timebar');
    if (!tl || tl.times.length < 2) { bar.hidden = true; return; }
    bar.hidden = false;
    sl.min = 0; sl.max = tl.times.length - 1; sl.value = tl.nowIdx; S.tIdx = tl.nowIdx;
    const split = tl.nowIdx / (tl.times.length - 1) * 100;
    sl.style.setProperty('--split', split + '%');
    const nowEl = $('#tNow'); nowEl.style.left = split + '%';
    updateTimebarText();
  }

  function updateTimebarText() {
    const tl = S.timeline; if (!tl) return;
    $('#tLabel').textContent = fmtDateTime(tl.times[S.tIdx]);
    const tag = $('#tTag');
    if (S.tIdx === tl.nowIdx) { tag.className = 'tag live'; tag.textContent = t('tl_live'); }
    else if (S.tIdx > tl.nowIdx) { tag.className = 'tag fcst'; tag.textContent = t('tl_forecast'); }
    else { tag.className = 'tag'; tag.textContent = t('tl_replay'); }
    $('#tStart').textContent = fmtDay(tl.times[0]);
    $('#tNow').textContent = t('tl_now');
    $('#tEnd').textContent = fmtDay(tl.times[tl.times.length - 1]);
    $('#playBtn').setAttribute('aria-label', t(S.playing ? 'tl_pause' : 'tl_play'));
    $('#playBtn').classList.toggle('playing', S.playing);
  }

  function setTime(idx) {
    const tl = S.timeline; if (!tl) return;
    S.tIdx = L.clamp(idx, 0, tl.times.length - 1);
    $('#tSlider').value = S.tIdx;
    if (S.tIdx !== tl.nowIdx && !S.replayToastShown) { S.replayToastShown = true; toast(t('replay_note')); }
    paintCities(); updateTimebarText(); dimSensors();
  }

  function stopPlay() { S.playing = false; clearInterval(S.timer); S.timer = null; updateTimebarText(); }

  function togglePlay() {
    const tl = S.timeline; if (!tl) return;
    if (S.playing) { stopPlay(); return; }
    if (S.tIdx >= tl.nowIdx) setTime(0);
    S.playing = true; updateTimebarText();
    S.timer = setInterval(() => {
      const next = S.tIdx + 3;
      if (next >= tl.nowIdx) { setTime(tl.nowIdx); stopPlay(); } else setTime(next);
    }, 170);
  }

  /* ---------- bottom sheet (phones) ---------- */
  function sheetSnaps() { const vh = window.innerHeight; return [Math.round(vh * 0.24), Math.round(vh * 0.46), Math.round(vh * 0.88)]; }
  function setSheet(px) { if (isMobile()) $('#panel').style.height = px + 'px'; }

  function initSheet() {
    const panel = $('#panel'), grab = $('#grab');
    let dragging = false, moved = 0, startY = 0, startH = 0;
    grab.addEventListener('pointerdown', e => {
      if (!isMobile()) return;
      dragging = true; moved = 0; startY = e.clientY; startH = panel.getBoundingClientRect().height;
      grab.setPointerCapture(e.pointerId); panel.classList.add('drag');
    });
    grab.addEventListener('pointermove', e => {
      if (!dragging) return;
      moved = Math.max(moved, Math.abs(e.clientY - startY));
      panel.style.height = L.clamp(startH + (startY - e.clientY), 90, window.innerHeight * 0.92) + 'px';
    });
    const end = () => {
      if (!dragging) return;
      dragging = false; panel.classList.remove('drag');
      const snaps = sheetSnaps(), h = panel.getBoundingClientRect().height;
      if (moved < 5) { const i = snaps.findIndex(s => s > h + 8); setSheet(snaps[i < 0 ? 0 : i]); }
      else setSheet(snaps.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a));
      setTimeout(renderCharts, 320);
    };
    grab.addEventListener('pointerup', end); grab.addEventListener('pointercancel', end);
    grab.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const s = sheetSnaps(), h = panel.getBoundingClientRect().height, i = s.findIndex(v => v > h + 8); setSheet(s[i < 0 ? 0 : i]); } });
    mqMobile.addEventListener('change', () => { panel.style.height = ''; });
  }

  /* ---------- tabs and events ---------- */
  function setTab(tab) {
    S.tab = tab;
    $$('.tab').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    $$('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === tab));
    $('#pbody').scrollTop = 0;
    if (tab === 'trends') requestAnimationFrame(renderCharts);
  }

  function bindEvents() {
    $$('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
    $('#citySelect').addEventListener('change', e => select(e.target.value, { fly: true }));
    $('#btnLang').addEventListener('click', () => applyLang(S.lang === 'ur' ? 'en' : 'ur', true));
    $('#btnTheme').addEventListener('click', () => applyTheme(S.theme === 'dark' ? 'light' : 'dark', true));
    const about = $('#about');
    $('#btnInfo').addEventListener('click', () => about.showModal && about.showModal());
    about.addEventListener('click', e => { if (e.target === about) about.close(); });

    $$('.chip[data-layer]').forEach(ch => ch.addEventListener('click', () => {
      const k = ch.dataset.layer; S.layers[k] = !S.layers[k];
      applyLayerVisibility();
      if (k === 'cone') { updateCone(); renderSmog(); }
    }));

    $('#paneSmog').addEventListener('click', e => {
      const b = e.target.closest('[data-act="cone"]'); if (!b) return;
      S.layers.cone = !S.layers.cone; applyLayerVisibility(); updateCone(); renderSmog();
      if (S.layers.cone && isMobile()) setSheet(sheetSnaps()[0]);
    });

    $('#paneRank').addEventListener('click', e => {
      const row = e.target.closest('.rk-row'); if (!row) return;
      select(row.dataset.city, { fly: true });
      if (isMobile()) setSheet(sheetSnaps()[1]);
    });
    $('#paneRank').addEventListener('input', e => { if (e.target.id === 'rkSearch') { S.rkFilter = e.target.value; renderRankList(); } });

    $('#tSlider').addEventListener('input', e => { if (S.playing) stopPlay(); setTime(+e.target.value); });
    $('#playBtn').addEventListener('click', togglePlay);
    $('#nowBtn').addEventListener('click', () => { if (S.playing) stopPlay(); if (S.timeline) setTime(S.timeline.nowIdx); });

    window.addEventListener('resize', () => { if (S.charts.trend) { S.charts.trend.resize(); S.charts.heat.resize(); } });
  }

  /* ---------- boot ---------- */
  function showLoadError(err) {
    $('#loader').hidden = false; $('#loader').classList.remove('done');
    $('.spin').hidden = true;
    $('#loaderMsg').textContent = t('load_fail') + ': ' + (err && err.message ? err.message : err);
    $('#retryBtn').hidden = false;
  }

  function hideLoader() {
    const l = $('#loader'); l.classList.add('done'); setTimeout(() => { l.hidden = true; }, 500);
  }

  function applyData(first) {
    if (!S.latest.cities.find(c => c.city === S.city)) S.city = S.latest.cities[0].city;
    fillCitySelect(); updateSensorCount();
    if (S.map) {
      buildMarkers();
      if (first) {
        const b = new maplibregl.LngLatBounds();
        S.latest.cities.forEach(c => { if (L.isNum(c.lat) && L.isNum(c.lon)) b.extend([c.lon, c.lat]); });
        try { S.map.fitBounds(b, { padding: mapPadding(), maxZoom: 7, duration: 0 }); } catch (e) { /* ignore */ }
      }
      syncMapData();
    }
    initTimebar();
    renderAll();
  }

  async function boot() {
    $('#retryBtn').hidden = true; $('.spin').hidden = false;
    $('#loaderMsg').textContent = t('loading');
    try {
      await loadData();
    } catch (err) { showLoadError(err); return; }
    const hash = decodeURIComponent((location.hash || '').slice(1));
    if (hash && cityData(hash)) S.city = hash; else if (!cityData(S.city)) S.city = S.latest.cities[0].city;
    if (!S.map) {
      if (window.maplibregl) initMap(); else toast('Map library could not be loaded.');
    }
    applyData(true);
    hideLoader();
    S.booted = true;
  }

  function refreshLoop() {
    setInterval(async () => {
      if (document.hidden || S.playing) return;
      try { await loadData(); applyData(false); } catch (e) { /* keep showing the last good data */ }
    }, 10 * 60 * 1000);
  }

  function init() {
    const savedTheme = store.get('sw-theme');
    applyTheme(savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'), false);
    const savedLang = store.get('sw-lang');
    applyLang(savedLang || ((navigator.language || '').toLowerCase().startsWith('ur') ? 'ur' : 'en'), false);
    bindEvents(); initSheet();
    $('#retryBtn').addEventListener('click', boot);
    boot().then(refreshLoop);
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* optional */ });
    }
  }

  window.SWApp = { state: S, select, setTab, setTime, t };
  init();
})();
