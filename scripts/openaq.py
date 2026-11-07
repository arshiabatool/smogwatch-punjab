
import os
import time
import math
import requests
import json
import pandas as pd
from pathlib import Path

from pathlib import Path
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from shapely.geometry import shape, Point

from config import CITIES, OPENAQ, STATION_BOX


# --------------------------------------------------
# 1. ENVIRONMENT AND API CONFIGURATION
# --------------------------------------------------

load_dotenv()

HEADERS = {
    "X-API-Key": os.environ.get("OPENAQ_API_KEY", "")
}

PM25_ID = 2


# --------------------------------------------------
# 2. LOAD PUNJAB ADMINISTRATIVE BOUNDARY
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

BOUNDARY_FILE = BASE_DIR / "data_raw" / "pakistan_adm1.geojson"

with open(BOUNDARY_FILE, "r", encoding="utf-8") as f:
    boundary_data = json.load(f)

PUNJAB_FEATURE = next(
    feature for feature in boundary_data["features"]
    if feature["properties"].get("shapeISO") == "PK-PB"
)

PUNJAB_POLYGON = shape(PUNJAB_FEATURE["geometry"])

print("Punjab administrative boundary loaded successfully.")


# --------------------------------------------------
# 3. CALCULATE DISTANCE BETWEEN TWO COORDINATES
# --------------------------------------------------

def km(lat1, lon1, lat2, lon2):

    p = math.pi / 180

    a = (
        math.sin((lat2 - lat1) * p / 2) ** 2
        + math.cos(lat1 * p)
        * math.cos(lat2 * p)
        * math.sin((lon2 - lon1) * p / 2) ** 2
    )

    return 12742 * math.asin(math.sqrt(a))


# --------------------------------------------------
# 4. FIND PM2.5 MONITORING STATIONS IN PUNJAB
# --------------------------------------------------

def find_stations():

    w, s, e, n = STATION_BOX

    r = requests.get(
        f"{OPENAQ}/locations",
        headers=HEADERS,
        timeout=60,
        params={
            "bbox": f"{w},{s},{e},{n}",
            "parameters_id": PM25_ID,
            "limit": 1000
        }
    )

    r.raise_for_status()

    out = []

    for loc in r.json().get("results", []):

        # Keep only stations in Pakistan
        country = loc.get("country") or {}

        if country.get("code") != "PK":
            continue

        # Find PM2.5 sensors
        pm_sensors = [
            x["id"]
            for x in loc.get("sensors", [])
            if x.get("parameter", {}).get("id") == PM25_ID
        ]

        if not pm_sensors:
            continue

        # Get station coordinates
        coordinates = loc.get("coordinates") or {}

        lat = coordinates.get("latitude")
        lon = coordinates.get("longitude")

        if lat is None or lon is None:
            continue

        # Keep only stations geographically inside Punjab
        station_point = Point(lon, lat)

        if not PUNJAB_POLYGON.covers(station_point):
            continue

        # Identify nearest city
        near = min(
            CITIES,
            key=lambda c: km(lat, lon, c[1], c[2])
        )

        dist = km(lat, lon, near[1], near[2])

        # Store station information
        out.append({
            "id": loc["id"],
            "name": loc.get("name"),
            "lat": lat,
            "lon": lon,
            "sensors": pm_sensors,
            "city": near[0] if dist <= 25 else None
        })

    return out


# --------------------------------------------------
# 5. RETRIEVE LATEST VALID PM2.5 READINGS
# --------------------------------------------------

def latest_pm25(stations):

    latest_by_station = {}

    # Only accept readings from the last 7 days
    now = datetime.now(timezone.utc)

    cutoff = now - timedelta(days=7)

    for st in stations:

        r = requests.get(
            f"{OPENAQ}/locations/{st['id']}/latest",
            headers=HEADERS,
            timeout=60
        )

        if r.status_code != 200:

            print("Could not retrieve station:", st["name"])

            time.sleep(1)

            continue

        for item in r.json().get("results", []):

            # Check whether sensor belongs to this station
            if item.get("sensorsId") not in st["sensors"]:
                continue

            # Validate PM2.5 value
            value = item.get("value")

            if value is None or value < 0:
                continue

            # Get UTC timestamp
            timestamp = item.get("datetime", {}).get("utc")

            if not timestamp:
                continue

            try:

                reading_time = datetime.fromisoformat(
                    timestamp.replace("Z", "+00:00")
                )

            except ValueError:

                continue

            # Reject old and future-dated readings
            if not (cutoff <= reading_time <= now):
                continue

            # Prepare reading record
            row = {
                "station_id": st["id"],
                "name": st["name"],
                "city": st["city"],
                "lat": st["lat"],
                "lon": st["lon"],
                "pm25": value,
                "time_utc": timestamp
            }

            # Keep only the newest reading for each station
            previous = latest_by_station.get(st["id"])

            if (
                previous is None
                or reading_time > previous["reading_time"]
            ):

                latest_by_station[st["id"]] = {
                    "reading_time": reading_time,
                    "row": row
                }

        time.sleep(1)

    # Sort readings from newest to oldest
    return [
        item["row"]
        for item in sorted(
            latest_by_station.values(),
            key=lambda x: x["reading_time"],
            reverse=True
        )
    ]


# --------------------------------------------------
# 6. MAIN PROGRAM
# --------------------------------------------------

if __name__ == "__main__":

    stations = find_stations()

    print(len(stations), "stations with PM2.5 sensors")

    readings = latest_pm25(stations)

    print(
        "\nValid stations with recent PM2.5 readings:",
        len(readings)
    )

    # Save readings to CSV
    BASE_DIR = Path(__file__).resolve().parent.parent

    OUTPUT_DIR = BASE_DIR / "data_raw"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    output_file = OUTPUT_DIR / "openaq_pm25_latest.csv"

    df = pd.DataFrame(readings)

    df.to_csv(output_file, index=False)

    print("\nOpenAQ data saved successfully!")
    print("File location:", output_file)

    print("\nFirst 10 PM2.5 readings:")
    print(df.head(10))
