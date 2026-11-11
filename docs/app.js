const DIRS = ['N','NE','E','SE','S','SW','W','NW'];
const LEVEL_COLORS = {Low:'#2e9e5b', Moderate:'#d4a200', High:'#e8590c', Severe:'#a4161a'};
const ADVICE = {
  'Good': ['Air is clean. Normal outdoor activity is fine.', 'No special precautions.'],
  'Moderate': ['Acceptable for most people.', 'Very sensitive people should shorten long outdoor exertion.'],
  'Unhealthy for sensitive groups': ['Reduce long or heavy outdoor exertion.', 'Children, elderly people and people with asthma or heart disease should limit time outdoors and keep medicines ready.'],
  'Unhealthy': ['Avoid long outdoor exertion. Wear an N95 mask outdoors.', 'Stay indoors with windows closed. See a doctor if breathing is difficult.'],
  'Very unhealthy': ['Avoid outdoor activity.', 'Stay indoors, use an air purifier if you have one, and get medical help for symptoms.'],
  'Hazardous': ['Stay indoors and avoid all outdoor exertion.', 'Remain indoors and seek medical help for any breathing trouble.']
};
const AQI_PIECES = [
  {min:0,max:50,color:'#00e400'},{min:51,max:100,color:'#ffff00'},
  {min:101,max:150,color:'#ff7e00'},{min:151,max:200,color:'#ff0000'},
  {min:201,max:300,color:'#8f3f97'},{min:301,max:500,color:'#7e0023'}];

let latest, history, fires, forecast = null, current = 'Lahore';
let map, trendChart, heatChart;

const fmt = (v, d = 0) => (v == null || Number.isNaN(v)) ? '-' : Number(v).toFixed(d);
const compass = deg => deg == null ? '-' : DIRS[Math.round(deg / 45) % 8];
const textColor = () => getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();

async function getJSON(name, optional = false) {
  try {
    const r = await fetch('data/' + name + '?t=' + Date.now());
    if (!r.ok) throw new Error(name + ' ' + r.status);
    return await r.json();
  } catch (e) {
    if (optional) return null;
    throw e;
  }
}

async function init() {
  [latest, history, fires] = await Promise.all([getJSON('latest.json'), getJSON('history.json'), getJSON('fires.json')]);
  forecast = await getJSON('forecast.json', true);
  document.getElementById('updated').textContent = 'Updated ' + latest.updated + ' (Pakistan time)';

  const sel = document.getElementById('citySelect');
  latest.cities.map(c => c.city).sort().forEach(n => sel.add(new Option(n, n)));
  if (!latest.cities.find(c => c.city === current)) current = latest.cities[0].city;
  sel.value = current;
  sel.onchange = () => select(sel.value, true);

  trendChart = echarts.init(document.getElementById('trend'));
  heatChart = echarts.init(document.getElementById('heat'));
  window.addEventListener('resize', () => { trendChart.resize(); heatChart.resize(); });

  initMap();
  renderRanking();
  select(current, false);
}

function cityData(name) { return latest.cities.find(c => c.city === name); }

function select(name, fly) {
  current = name;
  document.getElementById('citySelect').value = name;
  const c = cityData(name);
  renderHero(c); renderWeather(c); renderPollutants(c); renderAdvice(c); renderSmog(c);
  renderTrend(name); renderHeat(name);
  document.querySelectorAll('#rankList li').forEach(li => li.classList.toggle('sel', li.dataset.city === name));
  if (fly && map) map.flyTo({center: [c.lon, c.lat], zoom: 8});
}

function renderHero(c) {
  const diff = (c.yesterday_aqi != null && c.aqi != null) ? c.aqi - c.yesterday_aqi : null;
  document.getElementById('hero').innerHTML =
    '<h2>' + c.city + '</h2>' +
    '<div class="aqi-big" style="color:' + c.color + '">' + fmt(c.aqi) + '</div>' +
    '<span class="pill" style="background:' + c.color + ';color:#111">' + (c.category || 'No data') + '</span>' +
    '<p class="muted">PM2.5 ' + fmt(c.pm25, 1) + ' µg/m³ &nbsp; <span class="badge">' + c.source + '</span></p>' +
    '<p class="muted">Same hour yesterday: ' + fmt(c.yesterday_aqi) +
    (diff == null ? '' : ' (' + (diff >= 0 ? '+' : '') + diff + ')') + '</p>';
}

function renderWeather(c) {
  const t = (v, l) => '<div class="tile"><b>' + v + '</b><span>' + l + '</span></div>';
  document.getElementById('weather').innerHTML = '<h2>Weather now</h2><div class="tiles">' +
    t(fmt(c.temp) + ' °C', 'Temperature') + t(fmt(c.humidity) + ' %', 'Humidity') +
    t(fmt(c.wind_ms, 1) + ' m/s ' + compass(c.wind_dir), 'Wind (from)') +
    t(c.visibility == null ? '-' : fmt(c.visibility / 1000, 1) + ' km', 'Visibility') +
    t(fmt(c.blh) + ' m', 'Boundary layer height') + '</div>';
}

function renderPollutants(c) {
  const t = (v, l) => '<div class="tile"><b>' + fmt(v, 1) + '</b><span>' + l + ' (µg/m³)</span></div>';
  document.getElementById('pollutants').innerHTML =
    t(c.pm25, 'PM2.5') + t(c.pm10, 'PM10') + t(c.no2, 'NO₂') + t(c.so2, 'SO₂') + t(c.co, 'CO') + t(c.o3, 'O₃');
}

function renderAdvice(c) {
  const a = ADVICE[c.category] || ['No data.', 'No data.'];
  document.getElementById('advice').innerHTML = '<h2>Health advice</h2>' +
    '<p><b>General public</b><br>' + a[0] + '</p><p><b>Vulnerable groups</b><br>' + a[1] + '</p>' +
    '<p class="muted">Vulnerable groups: children, older adults, pregnant women, outdoor workers, people with asthma or heart disease.</p>';
}

function renderSmog(c) {
  const el = document.getElementById('smogBody');
  if (c.smog_level == null) { el.innerHTML = '<p class="muted">Smog data is not available yet.</p>'; return; }
  let h = '<span class="smog-level" style="background:' + LEVEL_COLORS[c.smog_level] + '">' + c.smog_level + '</span>' +
    ' <span class="muted">risk score ' + c.smog_score + '/100</span><ul class="facts">';
  (c.smog_reasons || []).forEach(r => { h += '<li>' + r + '</li>'; });
  h += '<li>Fires within 150 km: <b>' + c.fires_150km + '</b>; upwind within 300 km: <b>' + c.fires_upwind + '</b></li></ul>';
  const f = forecast && forecast.cities && forecast.cities[c.city];
  if (f) {
    h += '<div class="fc"><b>Tomorrow (XGBoost forecast)</b><br>PM2.5 about ' + fmt(f.pm25_24h) +
      ' µg/m³, AQI ' + f.aqi_24h + ' (' + f.category + '). Typical error: about ±' + fmt(f.mae) + ' µg/m³.</div>';
  }
  el.innerHTML = h;
}

function renderRanking() {
  const rows = latest.cities.slice().sort((a, b) => (b.aqi ?? -1) - (a.aqi ?? -1));
  document.getElementById('rankList').innerHTML = rows.map((c, i) =>
    '<li data-city="' + c.city + '"><span class="n">' + (i + 1) + '</span>' + c.city +
    '<span class="a" style="background:' + c.color + '">' + fmt(c.aqi) + '</span></li>').join('');
  document.querySelectorAll('#rankList li').forEach(li => li.onclick = () => select(li.dataset.city, true));
}

function renderTrend(name) {
  const h = history[name];
  if (!h) return;
  const past = h.time.slice(-48), pv = h.pm25.slice(-48);
  const x = past.concat(h.fc_time);
  const nowIdx = past.length - 1;
  const observed = pv.concat(new Array(h.fc_time.length).fill(null));
  const fc = new Array(nowIdx).fill(null).concat([pv[nowIdx]], h.fc_pm25);
  const series = [
    {name: 'Past (measured or modelled)', type: 'line', data: observed, showSymbol: false, smooth: true},
    {name: 'Model forecast (CAMS)', type: 'line', data: fc, showSymbol: false, smooth: true, lineStyle: {type: 'dashed'}}
  ];
  const f = forecast && forecast.cities && forecast.cities[name];
  if (f && nowIdx + 24 < x.length) {
    const pts = new Array(x.length).fill(null);
    pts[nowIdx + 24] = f.pm25_24h;
    series.push({name: 'XGBoost (+24 h)', type: 'scatter', data: pts, symbolSize: 14});
  }
  trendChart.setOption({
    textStyle: {color: textColor()}, tooltip: {trigger: 'axis'},
    legend: {top: 0, textStyle: {color: textColor()}},
    grid: {left: 50, right: 20, top: 40, bottom: 40},
    xAxis: {type: 'category', data: x, axisLabel: {interval: 11, formatter: t => t.slice(5, 10) + ' ' + t.slice(11)}},
    yAxis: {type: 'value', name: 'µg/m³'},
    series: series
  }, true);
}

function renderHeat(name) {
  const h = history[name];
  if (!h) return;
  const days = [], pts = [];
  h.time.forEach((t, i) => {
    const d = t.slice(0, 10);
    let di = days.indexOf(d);
    if (di < 0) { days.push(d); di = days.length - 1; }
    if (h.aqi[i] != null) pts.push([parseInt(t.slice(11, 13), 10), di, h.aqi[i]]);
  });
  heatChart.setOption({
    textStyle: {color: textColor()},
    tooltip: {formatter: p => days[p.value[1]] + ' ' + String(p.value[0]).padStart(2, '0') + ':00<br>AQI ' + p.value[2]},
    grid: {left: 60, right: 15, top: 10, bottom: 70},
    xAxis: {type: 'category', data: Array.from({length: 24}, (_, i) => String(i).padStart(2, '0'))},
    yAxis: {type: 'category', data: days.map(d => d.slice(5)), inverse: true},
    visualMap: {type: 'piecewise', pieces: AQI_PIECES, orient: 'horizontal', left: 'center', bottom: 0,
      textStyle: {color: textColor()}, show: true},
    series: [{type: 'heatmap', data: pts}]
  }, true);
}

function arrowImage() {
  const s = 32, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  g.fillStyle = '#1b4965';
  g.beginPath(); g.moveTo(16, 3); g.lineTo(25, 27); g.lineTo(16, 21); g.lineTo(7, 27); g.closePath(); g.fill();
  return g.getImageData(0, 0, s, s);
}

function initMap() {
  map = new maplibregl.Map({
    container: 'map', style: 'https://tiles.openfreemap.org/styles/positron',
    center: [72.9, 31.3], zoom: 5.6
  });
  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  map.on('load', () => {
    map.addImage('arrow', arrowImage());
    const cityGeo = {type: 'FeatureCollection', features: latest.cities.map(c => ({
      type: 'Feature', geometry: {type: 'Point', coordinates: [c.lon, c.lat]}, properties: c}))};
    const fireGeo = {type: 'FeatureCollection', features: fires.fires.map(f => ({
      type: 'Feature', geometry: {type: 'Point', coordinates: [f.longitude, f.latitude]}, properties: {frp: f.frp}}))};
    map.addSource('fires', {type: 'geojson', data: fireGeo});
    map.addSource('cities', {type: 'geojson', data: cityGeo});
    map.addLayer({id: 'fires', type: 'circle', source: 'fires',
      paint: {'circle-radius': 3, 'circle-color': '#ff5a00', 'circle-opacity': 0.75}});
    map.addLayer({id: 'wind', type: 'symbol', source: 'cities',
      layout: {'icon-image': 'arrow', 'icon-rotate': ['+', ['get', 'wind_dir'], 180],
        'icon-rotation-alignment': 'map', 'icon-allow-overlap': true,
        'icon-size': ['interpolate', ['linear'], ['get', 'wind_ms'], 0, 0.4, 10, 1.0]}});
    map.addLayer({id: 'cities', type: 'circle', source: 'cities',
      paint: {'circle-radius': 11, 'circle-color': ['get', 'color'],
        'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2, 'circle-opacity': 0.92}});
    map.on('click', 'cities', e => {
      const p = e.features[0].properties;
      new maplibregl.Popup().setLngLat(e.lngLat)
        .setHTML('<b>' + p.city + '</b><br>AQI ' + p.aqi + ' (' + p.category + ')<br>PM2.5 ' + Number(p.pm25).toFixed(1)).addTo(map);
      select(p.city, false);
    });
    map.on('mouseenter', 'cities', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'cities', () => map.getCanvas().style.cursor = '');
  });
  const toggle = (id, layer) => document.getElementById(id).onchange = ev =>
    map.setLayoutProperty(layer, 'visibility', ev.target.checked ? 'visible' : 'none');
  toggle('tFires', 'fires'); toggle('tWind', 'wind');
}

init().catch(err => {
  document.getElementById('updated').textContent = 'Could not load data: ' + err.message;
});
