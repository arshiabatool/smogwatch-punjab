# scripts/smog.py
import numpy as np


def _dist_bearing(lat, lon, lats, lons):
    p = np.pi / 180
    dlat, dlon = (lats - lat) * p, (lons - lon) * p
    a = np.sin(dlat / 2) ** 2 + np.cos(lat * p) * np.cos(lats * p) * np.sin(dlon / 2) ** 2
    d = 12742 * np.arcsin(np.sqrt(a))
    y = np.sin(dlon) * np.cos(lats * p)
    x = np.cos(lat * p) * np.sin(lats * p) - np.sin(lat * p) * np.cos(lats * p) * np.cos(dlon)
    b = (np.degrees(np.arctan2(y, x)) + 360) % 360
    return d, b


def fire_counts(lat, lon, wind_from, fires):
    """Return (fires within 150 km, fires upwind within 300 km)."""
    if fires is None or len(fires) == 0:
        return 0, 0
    d, b = _dist_bearing(lat, lon, fires.latitude.to_numpy(), fires.longitude.to_numpy())
    near = int((d <= 150).sum())
    if wind_from is None or wind_from != wind_from:
        return near, 0
    diff = np.abs((b - wind_from + 180) % 360 - 180)
    return near, int(((d <= 300) & (diff <= 45)).sum())


def _ok(v):
    return v is not None and v == v


def smog_score(pm25, wind_ms, blh, vis_m, humidity, fires_upwind):
    pts, why = 0.0, []
    if _ok(pm25):
        pts += min(pm25 / 150, 1) * 40
        if pm25 >= 55.5:
            why.append(f"PM2.5 is {pm25:.0f} µg/m³, in the unhealthy range")
    if _ok(wind_ms):
        pts += (1 - min(wind_ms / 5, 1)) * 15
        if wind_ms < 2:
            why.append(f"Weak wind ({wind_ms:.1f} m/s) lets pollution build up")
    if _ok(blh):
        pts += (1 - min(blh / 1000, 1)) * 15
        if blh < 300:
            why.append(f"Low boundary layer ({blh:.0f} m) keeps pollution near the ground")
    if _ok(vis_m):
        pts += (1 - min(vis_m / 10000, 1)) * 10
        if vis_m < 3000:
            why.append(f"Low visibility ({vis_m / 1000:.1f} km)")
    if _ok(humidity) and humidity > 80:
        pts += (humidity - 80) / 20 * 5
        why.append(f"High humidity ({humidity:.0f} %) can thicken fog and haze")
    pts += min(fires_upwind / 40, 1) * 15
    if fires_upwind >= 10:
        why.append(f"{fires_upwind} fire detections upwind")
    score = round(pts)
    level = "Low" if score < 25 else "Moderate" if score < 50 else "High" if score < 75 else "Severe"
    return score, level, why
