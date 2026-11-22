# scripts/build_training_data.py
import os, time, requests
import pandas as pd
from io import StringIO
from datetime import date, timedelta
from dotenv import load_dotenv
from config import OPENAQ, FIRE_BOX, FIRMS, TIMEZONE
from openaq import HEADERS, find_stations

load_dotenv()
START = date(2022, 1, 1)                 # move earlier if your stations have more history
END = date.today() - timedelta(days=1)
RAW = "data_raw"
os.makedirs(RAW, exist_ok=True)

HIST = "https://historical-forecast-api.open-meteo.com/v1/forecast"
WX = ("temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,"
      "visibility,boundary_layer_height,precipitation")


def sensor_hours(sensor_id):
    rows, page = [], 1
    while True:
        r = requests.get(f"{OPENAQ}/sensors/{sensor_id}/hours", headers=HEADERS, timeout=90,
                         params={"datetime_from": f"{START}T00:00:00Z",
                                 "datetime_to": f"{END}T23:59:59Z",
                                 "limit": 1000, "page": page})
        if r.status_code == 429:
            time.sleep(30)
            continue
        if r.status_code != 200:
            print("OpenAQ problem", sensor_id, r.status_code)
            break
        res = r.json().get("results", [])
        rows += [(x["period"]["datetimeFrom"]["utc"], x["value"]) for x in res]
        if len(res) < 1000:
            break
        page += 1
        time.sleep(1)
    return rows


def build_station_pm25():
    out = []
    for st in find_stations():
        for sid in st["sensors"]:
            for utc, v in sensor_hours(sid):
                out.append((st["id"], st["name"], st["lat"], st["lon"], utc, v))
        print(st["name"], "rows so far:", len(out))
    df = pd.DataFrame(out, columns=["station_id", "name", "lat", "lon", "time_utc", "pm25"])
    df["time"] = (pd.to_datetime(df.time_utc, utc=True)
                  .dt.tz_convert(TIMEZONE).dt.tz_localize(None))
    df = df[(df.pm25 >= 0) & (df.pm25 <= 1000)]
    df = df.groupby(["station_id", "name", "lat", "lon", "time"], as_index=False).pm25.mean()
    df.to_csv(f"{RAW}/station_pm25_hourly.csv", index=False)
    return df


def build_weather(stations):
    frames = []
    for _, s in stations.drop_duplicates("station_id").iterrows():
        for year in range(START.year, END.year + 1):
            a = max(START, date(year, 1, 1))
            b = min(END, date(year, 12, 31))
            r = requests.get(HIST, timeout=120, params={
                "latitude": s.lat, "longitude": s.lon, "start_date": a.isoformat(),
                "end_date": b.isoformat(), "hourly": WX, "timezone": TIMEZONE,
                "wind_speed_unit": "ms"})
            r.raise_for_status()
            d = pd.DataFrame(r.json()["hourly"])
            d["station_id"] = s.station_id
            frames.append(d)
            time.sleep(2)
    w = pd.concat(frames, ignore_index=True)
    w["time"] = pd.to_datetime(w["time"])
    w = w.rename(columns={"temperature_2m": "temp", "relative_humidity_2m": "humidity",
                          "wind_speed_10m": "wind_ms", "wind_direction_10m": "wind_dir",
                          "boundary_layer_height": "blh", "precipitation": "precipitation"})
    w.to_csv(f"{RAW}/weather_hourly.csv", index=False)


def build_fires():
    key = os.environ["FIRMS_MAP_KEY"]
    w, s, e, n = FIRE_BOX
    frames, d = [], START
    while d <= END:
        # standard-processing data lags real time by a few months; use NRT for recent days
        src = "VIIRS_SNPP_SP" if d < date.today() - timedelta(days=120) else "VIIRS_SNPP_NRT"
        r = requests.get(f"{FIRMS}/{key}/{src}/{w},{s},{e},{n}/5/{d.isoformat()}", timeout=120)
        if r.status_code == 200 and r.text.startswith("latitude"):
            frames.append(pd.read_csv(StringIO(r.text),
                                      usecols=["latitude", "longitude", "acq_date", "confidence"]))
        else:
            print("FIRMS issue at", d, r.text[:80])
        d += timedelta(days=5)
        time.sleep(0.5)
    f = pd.concat(frames, ignore_index=True)
    f = f[f["confidence"].astype(str).str.lower() != "l"]
    f.drop_duplicates().to_csv(f"{RAW}/fires_archive.csv", index=False)


if __name__ == "__main__":
    st = build_station_pm25()
    print(st.groupby("name").time.agg(["min", "max", "count"]))
    build_weather(st)
    build_fires()
    print("done")
