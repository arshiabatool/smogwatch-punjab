from pathlib import Path
import time
import requests
import pandas as pd

from config import CITIES, OPEN_METEO_AQ, OPEN_METEO_WX, TIMEZONE


# Air quality variables
AQ_VARS = [
    "pm2_5",
    "pm10",
    "nitrogen_dioxide",
    "sulphur_dioxide",
    "carbon_monoxide",
    "ozone"
]

# Weather variables
WX_VARS = [
    "temperature_2m",
    "relative_humidity_2m",
    "wind_speed_10m",
    "wind_direction_10m",
    "visibility",
    "boundary_layer_height",
    "precipitation"
]


def _get(url, params, tries=4):
    """Send API request with retries."""

    for i in range(tries):
        try:
            r = requests.get(url, params=params, timeout=60)

            if r.status_code == 200:
                return r.json()

            if r.status_code not in (429, 500, 502, 503, 504):
                r.raise_for_status()

            print(f"Server busy. Retry {i + 1}/{tries}")
        except requests.RequestException as e:
            print(f"Request failed: {e}. Retry {i + 1}/{tries}")

        time.sleep(5 * (i + 1))

    r.raise_for_status()


def _fetch(url, variables, extra, chunk=20):

    frames = []

    for s in range(0, len(CITIES), chunk):

        part = CITIES[s:s + chunk]

        params = {
            "latitude": ",".join(str(c[1]) for c in part),
            "longitude": ",".join(str(c[2]) for c in part),
            "hourly": ",".join(variables),
            "timezone": TIMEZONE,
            **extra,
        }

        data = _get(url, params)

        if isinstance(data, dict):
            data = [data]

        if len(data) != len(part):
            raise ValueError("API returned an unexpected number of locations.")

        for city, d in zip(part, data):

            if "hourly" not in d:
                raise ValueError(f"No hourly data returned for {city[0]}: {d}")

            df = pd.DataFrame(d["hourly"])

            df["city"] = city[0]

            frames.append(df)

    out = pd.concat(frames, ignore_index=True)

    out["time"] = pd.to_datetime(out["time"])

    return out


def get_air_quality(past_days=2, forecast_days=3):

    df = _fetch(
        OPEN_METEO_AQ,
        AQ_VARS,
        {
            "past_days": past_days,
            "forecast_days": forecast_days
        }
    )

    return df.rename(columns={
        "pm2_5": "pm25",
        "nitrogen_dioxide": "no2",
        "sulphur_dioxide": "so2",
        "carbon_monoxide": "co",
        "ozone": "o3"
    })


def get_weather(past_days=2, forecast_days=3):

    df = _fetch(
        OPEN_METEO_WX,
        WX_VARS,
        {
            "past_days": past_days,
            "forecast_days": forecast_days,
            "wind_speed_unit": "ms"
        }
    )

    return df.rename(columns={
        "temperature_2m": "temp",
        "relative_humidity_2m": "humidity",
        "wind_speed_10m": "wind_ms",
        "wind_direction_10m": "wind_dir",
        "boundary_layer_height": "blh"
    })


def get_model_table(past_days=2, forecast_days=3):

    aq = get_air_quality(past_days, forecast_days)

    wx = get_weather(past_days, forecast_days)

    return aq.merge(
        wx,
        on=["city", "time"],
        how="left"
    )



if __name__ == "__main__":

    print("Downloading air quality and weather data...")

    t = get_model_table()

    print("\nData shape:", t.shape)

    print("\nLahore sample data:")

    print(
        t[t.city == "Lahore"]
        .head(10)
        .to_string(index=False)
    )

    print("\nMissing values:")

    print(t.isnull().sum())

    # Save combined data to CSV
    BASE_DIR = Path(__file__).resolve().parent.parent

    OUTPUT_DIR = BASE_DIR / "data_raw"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    output_file = OUTPUT_DIR / "openmeteo_latest.csv"

    t.to_csv(output_file, index=False)

    print("\nOpen-Meteo data saved successfully!")
    print("File location:", output_file)

    print("\nData collection completed!")
