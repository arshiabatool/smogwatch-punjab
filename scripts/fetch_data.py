
import json
import math
from pathlib import Path

import pandas as pd

from config import CITIES, TIMEZONE
from openmeteo import get_model_table
from openaq import find_stations, latest_pm25
from firms import get_fires
from aqi import pm25_to_aqi, category


# Output folder: docs/data/
BASE_DIR = Path(__file__).resolve().parents[1]
OUT = BASE_DIR / "docs" / "data"
OUT.mkdir(parents=True, exist_ok=True)


def nan_to_none(value):
    """Convert missing or non-finite values into JSON-safe None."""

    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    if isinstance(value, float):
        if not math.isfinite(value):
            return None

    if hasattr(value, "item"):
        value = value.item()

    if isinstance(value, float) and not math.isfinite(value):
        return None

    return value


def clean(df):
    """Clean PM2.5 and calculate AQI."""

    df = df.sort_values(["city", "time"]).copy()

    # Rules 1 and 2: remove negative, missing and unrealistic PM2.5
    df["pm25"] = pd.to_numeric(df["pm25"], errors="coerce")

    df.loc[
        (df["pm25"] < 0) | (df["pm25"] > 1000),
        "pm25"
    ] = float("nan")

    # Rule 3: interpolate gaps of up to 3 hours.
    # Only fill gaps between existing observations.
    df["pm25"] = df.groupby("city")["pm25"].transform(
        lambda s: s.interpolate(
            method="linear",
            limit=3,
            limit_area="inside"
        )
    )

    # Calculate AQI after cleaning
    df["aqi"] = df["pm25"].apply(pm25_to_aqi)

    return df


def main():

    print("Starting SmogWatch Punjab data pipeline...")

    # Current hour in Pakistan time
    now = (
        pd.Timestamp.now(tz=TIMEZONE)
        .floor("h")
        .tz_localize(None)
    )

    print("\nDownloading Open-Meteo data...")

    # Seven days of history and three days of forecast
    t = clean(
        get_model_table(
            past_days=7,
            forecast_days=3
        )
    )

    print("Open-Meteo data shape:", t.shape)

    print("\nCollecting fresh OpenAQ station readings...")

    # Fresh measured PM2.5 readings
    measured = {}

    try:
        rows = latest_pm25(find_stations())

        for r in rows:

            if not r.get("city"):
                continue

            try:
                pm_value = float(r["pm25"])

                ts = (
                    pd.to_datetime(r["time_utc"], utc=True)
                    .tz_convert(TIMEZONE)
                    .tz_localize(None)
                )

            except (ValueError, TypeError, KeyError):
                continue

            age = now - ts

            # Accept readings no older than 3 hours
            # and do not accept future-dated readings
            if (
                0 <= pm_value <= 1000
                and pd.Timedelta(0) <= age <= pd.Timedelta(hours=3)
            ):
                measured.setdefault(r["city"], []).append(pm_value)

        print("Cities with fresh station readings:", len(measured))

    except Exception as e:

        # OpenAQ failure should not stop the website pipeline
        print("OpenAQ skipped:", e)

    latest = []
    history = {}

    print("\nPreparing city data...")

    for name, lat, lon in CITIES:

        c = (
            t[t.city == name]
            .sort_values("time")
            .set_index("time")
        )

        # Use the latest available modelled hour not later than now
        available = c.index[c.index <= now]

        if len(available) == 0:
            print("No current data available for:", name)
            continue

        current_time = available.max()
        cur = c.loc[current_time]

        # Modelled PM2.5 is the default
        pm25 = cur["pm25"]
        source = "Modelled estimate"

        # Replace modelled value with fresh measured station average
        if name in measured:

            pm25 = sum(measured[name]) / len(measured[name])
            source = "Measured"

        # Handle unavailable PM2.5
        if pd.isna(pm25):
            pm25 = None
            source = "Unavailable"

        aqi = pm25_to_aqi(pm25)
        cat, color = category(aqi)

        # Yesterday's AQI, based on modelled data
        yesterday = current_time - pd.Timedelta(days=1)

        y_aqi = (
            c["aqi"].get(yesterday)
            if yesterday in c.index
            else None
        )

        # Current city information
        city_data = {
            "city": name,
            "lat": lat,
            "lon": lon,
            "pm25": round(float(pm25), 1) if pm25 is not None else None,
            "pm10": cur["pm10"],
            "no2": cur["no2"],
            "so2": cur["so2"],
            "co": cur["co"],
            "o3": cur["o3"],
            "aqi": aqi,
            "category": cat,
            "color": color,
            "source": source,
            "temp": cur["temp"],
            "humidity": cur["humidity"],
            "wind_ms": cur["wind_ms"],
            "wind_dir": cur["wind_dir"],
            "visibility": cur["visibility"],
            "blh": cur["blh"],
            "yesterday_aqi": y_aqi
        }

        latest.append({
            k: nan_to_none(v)
            for k, v in city_data.items()
        })

        # Historical observations and future forecasts
        past = c[c.index <= current_time]
        future = c[c.index > current_time]

        history[name] = {
            "time": [
                x.strftime("%Y-%m-%dT%H:%M")
                for x in past.index
            ],

            "pm25": [
                nan_to_none(round(v, 1)) if pd.notna(v) else None
                for v in past["pm25"]
            ],

            "aqi": [
                nan_to_none(int(v)) if pd.notna(v) else None
                for v in past["aqi"]
            ],

            "fc_time": [
                x.strftime("%Y-%m-%dT%H:%M")
                for x in future.index
            ],

            "fc_pm25": [
                nan_to_none(round(v, 1)) if pd.notna(v) else None
                for v in future["pm25"]
            ]
        }

    print("\nDownloading NASA FIRMS fire detections...")

    fires = get_fires(days=2)

    # Limit output to 5000 detections
    fire_list = [
        {
            k: nan_to_none(v)
            for k, v in row.items()
        }
        for row in fires.head(5000).round(4).to_dict(orient="records")
    ]

    # Timestamp for all output files
    stamp = pd.Timestamp.now(tz=TIMEZONE).strftime(
        "%Y-%m-%d %H:%M"
    )

    print("\nSaving JSON files...")

    # latest.json
    (OUT / "latest.json").write_text(
        json.dumps(
            {
                "updated": stamp,
                "cities": latest
            },
            allow_nan=False
        ),
        encoding="utf-8"
    )

    # history.json
    (OUT / "history.json").write_text(
        json.dumps(history, allow_nan=False),
        encoding="utf-8"
    )

    # fires.json
    (OUT / "fires.json").write_text(
        json.dumps(
            {
                "updated": stamp,
                "fires": fire_list
            },
            allow_nan=False
        ),
        encoding="utf-8"
    )

    print("\n===================================")
    print("SMOGWATCH PUNJAB PIPELINE COMPLETED")
    print("===================================")

    print("Updated:", stamp)
    print("Cities written:", len(latest))
    print("Cities with fresh measurements:", len(measured))
    print("Fire detections written:", len(fire_list))

    print("\nJSON files saved in:", OUT)


if __name__ == "__main__":
    main()
