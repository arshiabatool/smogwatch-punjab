# scripts/build_weather_fires.py
import time, shutil, requests
import pandas as pd
from pathlib import Path
from datetime import date, timedelta
from config import TIMEZONE
import build_training_data as b

RAW = Path("data_raw")
CACHE = RAW / "weather_cache"
CACHE.mkdir(exist_ok=True)
START = date(2025, 5, 1)
END = date.today() - timedelta(days=1)
MIN_ROWS = 4000          # about 5.5 months of hourly data
b.START, b.END = START, END

# 1. keep a backup, then keep only stations with enough history
src = RAW / "station_pm25_hourly.csv"
backup = RAW / "station_pm25_hourly_all.csv"
if not backup.exists():
    shutil.copy(src, backup)
pm = pd.read_csv(backup, parse_dates=["time"])
pm = pm[pm.time >= pd.Timestamp(START)]
counts = pm.groupby("station_id").pm25.count()
pm = pm[pm.station_id.isin(counts[counts >= MIN_ROWS].index)]
pm.to_csv(src, index=False)
print(pm.station_id.nunique(), "stations kept of", len(counts))

# 2. one weather download per 0.1 degree grid cell
st = pm.drop_duplicates("station_id")[["station_id", "lat", "lon"]].copy()
st["clat"] = (st.lat * 10).round() / 10
st["clon"] = (st.lon * 10).round() / 10
cells = st[["clat", "clon"]].drop_duplicates()
print(len(cells), "weather cells to download")

WX = ("temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,"
      "visibility,boundary_layer_height,precipitation")


def get_cell(clat, clon):
    f = CACHE / f"{clat}_{clon}.csv"
    if f.exists():
        return pd.read_csv(f, parse_dates=["time"])
    for attempt in range(6):
        r = requests.get(b.HIST, timeout=180, params={
            "latitude": clat, "longitude": clon,
            "start_date": START.isoformat(), "end_date": END.isoformat(),
            "hourly": WX, "timezone": TIMEZONE, "wind_speed_unit": "ms"})
        if r.status_code == 200:
            break
        print("  status", r.status_code, "- waiting 65 s")
        time.sleep(65)
    else:
        raise RuntimeError("Open-Meteo kept refusing; rerun later, finished cells are cached")
    d = pd.DataFrame(r.json()["hourly"])
    d["time"] = pd.to_datetime(d["time"])
    d.to_csv(f, index=False)
    time.sleep(6)
    return d


frames = {}
for i, (_, c) in enumerate(cells.iterrows(), 1):
    frames[(c.clat, c.clon)] = get_cell(c.clat, c.clon)
    print(f"cell {i}/{len(cells)} done")

out = []
for _, s in st.iterrows():
    d = frames[(s.clat, s.clon)].copy()
    d["station_id"] = s.station_id
    out.append(d)
w = pd.concat(out, ignore_index=True).rename(columns={
    "temperature_2m": "temp", "relative_humidity_2m": "humidity",
    "wind_speed_10m": "wind_ms", "wind_direction_10m": "wind_dir",
    "boundary_layer_height": "blh"})
w.to_csv(RAW / "weather_hourly.csv", index=False)
print("weather saved:", len(w), "rows")

# 3. fires
b.build_fires()
print("all done")