/* lib.js: pure helpers (no DOM). Works in the browser (window.SW) and in Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SW = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* AQI bands: US EPA categories (2024 PM2.5 breakpoints), same as scripts/aqi.py */
  const BANDS = [
    { key: 'good',          lo: 0,   hi: 50,  color: '#2fbf71', text: '#07241a' },
    { key: 'moderate',      lo: 51,  hi: 100, color: '#f4c20d', text: '#2b2100' },
    { key: 'usg',           lo: 101, hi: 150, color: '#f28c28', text: '#2e1700' },
    { key: 'unhealthy',     lo: 151, hi: 200, color: '#e5483f', text: '#ffffff' },
    { key: 'veryUnhealthy', lo: 201, hi: 300, color: '#9b4dca', text: '#ffffff' },
    { key: 'hazardous',     lo: 301, hi: 500, color: '#7a1f3d', text: '#ffffff' }
  ];
  const BREAKS = [
    [0.0, 9.0, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150],
    [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500]
  ];
  const NO_DATA = '#8a96a3';
  const R_EARTH = 6371;
  const rad = d => d * Math.PI / 180;
  const deg = r => r * 180 / Math.PI;

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function pm25ToAqi(c) {
    if (!isNum(c) || c < 0) return null;
    c = Math.floor(c * 10) / 10;
    for (const [lo, hi, ilo, ihi] of BREAKS) {
      if (c >= lo && c <= hi) return Math.round((ihi - ilo) / (hi - lo) * (c - lo) + ilo);
    }
    return c > 325.4 ? 500 : null;
  }

  function bandIndex(aqi) {
    if (!isNum(aqi)) return -1;
    for (let i = 0; i < BANDS.length; i++) if (aqi <= BANDS[i].hi) return i;
    return BANDS.length - 1;
  }
  function bandOf(aqi) { const i = bandIndex(aqi); return i < 0 ? null : BANDS[i]; }
  function aqiColor(aqi) { const b = bandOf(aqi); return b ? b.color : NO_DATA; }
  function aqiTextColor(aqi) { const b = bandOf(aqi); return b ? b.text : '#ffffff'; }

  /* Gauge position 0..1: every category gets an equal slice of the arc so low values stay readable. */
  function gaugeFraction(aqi) {
    const i = bandIndex(aqi);
    if (i < 0) return 0;
    const b = BANDS[i];
    const within = clamp((aqi - b.lo) / (b.hi - b.lo), 0, 1);
    return (i + within) / BANDS.length;
  }

  /* ---------- geometry ---------- */
  function destination(lat, lon, bearingDeg, distKm) {
    const d = distKm / R_EARTH, t = rad(bearingDeg), p1 = rad(lat), l1 = rad(lon);
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
    const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return [((deg(l2) + 540) % 360) - 180, deg(p2)];
  }

  function distBearing(lat, lon, lat2, lon2) {
    const p1 = rad(lat), p2 = rad(lat2), dl = rad(lon2 - lon), dp = p2 - p1;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    const d = 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return { d, b: (deg(Math.atan2(y, x)) + 360) % 360 };
  }

  function angleDiff(a, b) { return Math.abs(((a - b + 540) % 360) - 180); }

  /* Wedge pointing toward the direction the wind comes FROM (where smoke is being carried from). */
  function coneFeature(lat, lon, fromDeg, radiusKm = 300, half = 45, steps = 24) {
    if (!isNum(fromDeg)) return { type: 'FeatureCollection', features: [] };
    const ring = [[lon, lat]];
    for (let i = 0; i <= steps; i++) {
      ring.push(destination(lat, lon, fromDeg - half + (2 * half * i) / steps, radiusKm));
    }
    ring.push([lon, lat]);
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} };
  }

  function firesInCone(lat, lon, fromDeg, fires, radiusKm = 300, half = 45) {
    if (!isNum(fromDeg) || !fires) return [];
    return fires.filter(f => {
      if (!isNum(f.latitude) || !isNum(f.longitude)) return false;
      const r = distBearing(lat, lon, f.latitude, f.longitude);
      return r.d <= radiusKm && angleDiff(r.b, fromDeg) <= half;
    });
  }

  function compass(d) {
    if (!isNum(d)) return '-';
    return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8];
  }

  /* ---------- smog reasons (translated in the UI from these keys) ---------- */
  function smogReasons(c) {
    const out = [];
    if (isNum(c.pm25) && c.pm25 >= 55.5) out.push({ k: 'pm_high', v: Math.round(c.pm25) });
    if (isNum(c.wind_ms) && c.wind_ms < 2) out.push({ k: 'wind_weak', v: c.wind_ms.toFixed(1) });
    if (isNum(c.blh) && c.blh < 300) out.push({ k: 'blh_low', v: Math.round(c.blh) });
    if (isNum(c.visibility) && c.visibility < 3000) out.push({ k: 'vis_low', v: (c.visibility / 1000).toFixed(1) });
    if (isNum(c.humidity) && c.humidity > 80) out.push({ k: 'hum_high', v: Math.round(c.humidity) });
    if (isNum(c.fires_upwind) && c.fires_upwind >= 10) out.push({ k: 'fires_up', v: c.fires_upwind });
    return out;
  }

  /* ---------- best / worst hours to be outside ---------- */
  function cleanestWindow(h, nowStr, span = 3, horizon = 24, dayStart = 6, dayEnd = 21) {
    if (!h || !h.fc_time || !h.fc_pm25 || !nowStr) return null;
    const rows = [];
    for (let i = 0; i < h.fc_time.length && rows.length < horizon; i++) {
      if (h.fc_time[i] <= nowStr) continue;
      rows.push({ t: h.fc_time[i], v: h.fc_pm25[i] });
    }
    let best = null, worst = null;
    for (let i = 0; i + span <= rows.length; i++) {
      const w = rows.slice(i, i + span);
      if (!w.every(r => isNum(r.v))) continue;
      const h0 = +w[0].t.slice(11, 13), h1 = +w[span - 1].t.slice(11, 13);
      if (h0 < dayStart || h1 >= dayEnd || h1 - h0 !== span - 1) continue;
      const mean = w.reduce((s, r) => s + r.v, 0) / span;
      const item = { date: w[0].t.slice(0, 10), from: h0, to: h0 + span, mean };
      if (!best || mean < best.mean) best = item;
      if (!worst || mean > worst.mean) worst = item;
    }
    return best ? { best, worst, nowDate: nowStr.slice(0, 10) } : null;
  }

  /* ---------- sparklines and trends ---------- */
  function sparkPath(values, w = 84, h = 24, pad = 2) {
    const valid = values.filter(isNum);
    if (valid.length < 2) return null;
    const lo = Math.min(...valid), hi = Math.max(...valid), span = hi - lo || 1;
    const n = values.length;
    let d = '', pen = false, last = null;
    values.forEach((v, i) => {
      if (!isNum(v)) { pen = false; return; }
      const x = pad + (i / (n - 1)) * (w - 2 * pad);
      const y = pad + (1 - (v - lo) / span) * (h - 2 * pad);
      d += (pen ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      pen = true; last = [x, y];
    });
    return { d, last };
  }

  function trendDir(values, back = 6, threshold = 10) {
    let li = values.length - 1;
    while (li >= 0 && !isNum(values[li])) li--;
    if (li < 0) return 0;
    let bi = li - back;
    while (bi >= 0 && !isNum(values[bi])) bi--;
    if (bi < 0) return 0;
    const diff = values[li] - values[bi];
    return diff >= threshold ? 1 : diff <= -threshold ? -1 : 0;
  }

  /* ---------- sensors near a city ---------- */
  function median(a) {
    const s = a.filter(isNum).sort((x, y) => x - y);
    if (!s.length) return null;
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function nearbyStations(lat, lon, stations, radiusKm = 25) {
    return (stations || []).filter(s => isNum(s.pm25) && isNum(s.lat) && isNum(s.lon) &&
      distBearing(lat, lon, s.lat, s.lon).d <= radiusKm);
  }

  function modelVsSensors(modelPm, near) {
    if (!isNum(modelPm) || !near || near.length < 2) return null;
    const med = median(near.map(s => s.pm25));
    if (!isNum(med) || med <= 0) return null;
    return { n: near.length, sensors: med, model: modelPm, diffPct: (modelPm - med) / med * 100 };
  }

  /* ---------- time slider data ---------- */
  function buildTimeline(history) {
    const names = Object.keys(history || {});
    const ref = names.map(n => history[n]).find(h => h && h.time && h.time.length);
    if (!ref) return null;
    const past = ref.time.slice(), future = (ref.fc_time || []).slice();
    return { times: past.concat(future), nowIdx: past.length - 1 };
  }

  function buildSeries(history) {
    const out = {};
    Object.keys(history || {}).forEach(name => {
      const h = history[name], m = new Map();
      (h.time || []).forEach((t, i) => {
        let a = h.aqi ? h.aqi[i] : null;
        if (!isNum(a) && h.pm25) a = pm25ToAqi(h.pm25[i]);
        m.set(t, isNum(a) ? a : null);
      });
      (h.fc_time || []).forEach((t, i) => m.set(t, h.fc_pm25 ? pm25ToAqi(h.fc_pm25[i]) : null));
      out[name] = m;
    });
    return out;
  }

  /* data age in minutes; `updated` is "YYYY-MM-DD HH:MM" in Pakistan time (UTC+5) */
  function ageMinutesPk(updated, nowMs) {
    if (!updated) return null;
    const t = Date.parse(updated.replace(' ', 'T') + ':00+05:00');
    return isNaN(t) ? null : (nowMs - t) / 60000;
  }

  function ageMinutesUtc(iso, nowMs) {
    const t = Date.parse(iso);
    return isNaN(t) ? null : (nowMs - t) / 60000;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  return {
    BANDS, NO_DATA, isNum, clamp, pm25ToAqi, bandIndex, bandOf, aqiColor, aqiTextColor, gaugeFraction,
    destination, distBearing, angleDiff, coneFeature, firesInCone, compass, smogReasons,
    cleanestWindow, sparkPath, trendDir, median, nearbyStations, modelVsSensors,
    buildTimeline, buildSeries, ageMinutesPk, ageMinutesUtc, escapeHtml
  };
});
