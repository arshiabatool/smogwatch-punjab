"""Collect the latest PM2.5 value of every active OpenAQ sensor in Punjab -> docs/data/stations.json.

Needs the OPENAQ_API_KEY environment variable (same key the main pipeline uses).
Without a key, or when nothing is returned, the old stations.json is kept and the script exits 0.
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "data" / "stations.json"
BBOX = "69.5,27.5,75.8,34.2"          # Punjab, Pakistan (lon_min,lat_min,lon_max,lat_max)
PM25_PARAM = 2
MAX_AGE_H = 6
TIME_CAP_S = 12 * 60
API = "https://api.openaq.org/v3"


def aqi_from_pm25(c):
    breaks = [(0.0, 9.0, 0, 50), (9.1, 35.4, 51, 100), (35.5, 55.4, 101, 150),
              (55.5, 125.4, 151, 200), (125.5, 225.4, 201, 300), (225.5, 325.4, 301, 500)]
    c = int(c * 10) / 10
    for lo, hi, ilo, ihi in breaks:
        if lo <= c <= hi:
            return round((ihi - ilo) / (hi - lo) * (c - lo) + ilo)
    return 500 if c > 325.4 else None


def http_get(path, params=None):
    key = os.environ.get("OPENAQ_API_KEY", "")
    for attempt in range(4):
        r = requests.get(API + path, params=params, headers={"X-API-Key": key}, timeout=30)
        if r.status_code == 429:
            time.sleep(10 * (attempt + 1))
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError("OpenAQ rate limit: gave up on " + path)


def looks_like_junk(name):
    n = (name or "").strip()
    if not n:
        return True
    if re.fullmatch(r"[0-9a-fA-F]{8,}", n):
        return True
    return "test" in n.lower()


def parse_time(s):
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def pm25_sensor_ids(loc):
    return {s["id"] for s in loc.get("sensors", []) if (s.get("parameter") or {}).get("id") == PM25_PARAM}


def main():
    if not os.environ.get("OPENAQ_API_KEY"):
        print("build_stations: OPENAQ_API_KEY not set, skipping.")
        return 0
    start = time.time()
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=MAX_AGE_H)

    locs, page = [], 1
    while True:
        data = http_get("/locations", {"bbox": BBOX, "parameters_id": PM25_PARAM, "limit": 1000, "page": page})
        res = data.get("results", [])
        locs += res
        if len(res) < 1000:
            break
        page += 1
        time.sleep(0.5)

    active = []
    for loc in locs:
        last = parse_time(((loc.get("datetimeLast") or {}).get("utc")) or "")
        if last and last >= cutoff and not looks_like_junk(loc.get("name")):
            active.append(loc)
    print(f"build_stations: {len(locs)} locations, {len(active)} active in last {MAX_AGE_H} h")

    stations = []
    for loc in active:
        if time.time() - start > TIME_CAP_S:
            print("build_stations: time cap reached, stopping early.")
            break
        try:
            data = http_get(f"/locations/{loc['id']}/latest")
        except Exception as e:
            print("  skip", loc["id"], e)
            continue
        ids = pm25_sensor_ids(loc)
        best = None
        for row in data.get("results", []):
            if row.get("sensorsId") in ids and isinstance(row.get("value"), (int, float)):
                t = parse_time((row.get("datetime") or {}).get("utc") or "")
                if t and t >= cutoff and 0 <= row["value"] <= 1000:
                    best = (row["value"], t)
        coords = loc.get("coordinates") or {}
        if best and coords.get("latitude") is not None and coords.get("longitude") is not None:
            v, t = best
            stations.append({"id": loc["id"], "name": loc.get("name"),
                             "lat": round(coords["latitude"], 5), "lon": round(coords["longitude"], 5),
                             "pm25": round(v, 1), "aqi": aqi_from_pm25(v), "t": t.strftime("%Y-%m-%dT%H:%M:%SZ")})
        time.sleep(0.5)

    if not stations:
        print("build_stations: nothing usable, keeping the old stations.json")
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp")
    tmp.write_text(json.dumps({"updated": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "count": len(stations),
                               "stations": stations}, ensure_ascii=False), encoding="utf-8")
    tmp.replace(OUT)
    print(f"build_stations: wrote {len(stations)} stations")
    return 0


if __name__ == "__main__":
    sys.exit(main())
