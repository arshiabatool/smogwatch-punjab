
import json
from pathlib import Path
from shapely.geometry import shape, Point
import os
from io import StringIO

import requests
import pandas as pd
from dotenv import load_dotenv

from config import FIRE_BOX, FIRMS


# --------------------------------------------------
# 1. ENVIRONMENT AND API CONFIGURATION
# --------------------------------------------------

load_dotenv()

KEY = os.environ.get("FIRMS_MAP_KEY", "")

SOURCES = [
    "VIIRS_SNPP_NRT",
    "VIIRS_NOAA20_NRT"
]


# --------------------------------------------------
# 2. LOAD ACTUAL PAKISTANI PUNJAB BOUNDARY
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

print("Punjab boundary loaded successfully.")


# --------------------------------------------------
# 3. FETCH NASA FIRMS FIRE DETECTIONS
# --------------------------------------------------

def get_fires(days=2):

    if not KEY or KEY == "paste_your_key_here":
        raise ValueError(
            "NASA FIRMS MAP_KEY is missing. Check your .env file."
        )

    w, s, e, n = FIRE_BOX

    frames = []

    for src in SOURCES:

        url = (
            f"{FIRMS}/{KEY}/{src}/"
            f"{w},{s},{e},{n}/{days}"
        )

        print(f"\nFetching fire data from {src}...")

        try:

            r = requests.get(url, timeout=120)

            r.raise_for_status()

            if not r.text.strip().startswith("latitude"):

                print("FIRMS returned an unexpected response:")
                print(r.text[:200])

                continue

            df = pd.read_csv(StringIO(r.text))

            if df.empty:

                print("No fire detections returned.")

                continue

            frames.append(df)

            print(len(df), "detections received.")

        except requests.RequestException as error:

            print("Request failed:", error)

    # Return empty DataFrame if no data is received
    if not frames:

        return pd.DataFrame(
            columns=[
                "latitude",
                "longitude",
                "frp",
                "acq_date",
                "acq_time"
            ]
        )

    # Combine data from both satellite sources
    df = pd.concat(frames, ignore_index=True)

    # --------------------------------------------------
    # 4. REMOVE LOW-CONFIDENCE DETECTIONS
    # --------------------------------------------------

    df = df[
        df["confidence"].astype(str).str.lower() != "l"
    ]

    # --------------------------------------------------
    # 5. REMOVE DUPLICATE DETECTIONS
    # --------------------------------------------------

    df = df.drop_duplicates(
        ["latitude", "longitude", "acq_date", "acq_time"]
    )

    # --------------------------------------------------
    # 6. KEEP ONLY FIRE DETECTIONS INSIDE PUNJAB
    # --------------------------------------------------

    df = df[
        df.apply(
            lambda row: PUNJAB_POLYGON.covers(
                Point(row["longitude"], row["latitude"])
            ),
            axis=1
        )
    ]

    # --------------------------------------------------
    # 7. SELECT REQUIRED OUTPUT COLUMNS
    # --------------------------------------------------

    return df[
        [
            "latitude",
            "longitude",
            "frp",
            "acq_date",
            "acq_time"
        ]
    ].reset_index(drop=True)


# --------------------------------------------------
# 8. MAIN PROGRAM
# --------------------------------------------------

if __name__ == "__main__":

    fires = get_fires(days=2)

    print(
        "\nTotal fire detections inside Punjab in the last 2 days:",
        len(fires)
    )

    # Save FIRMS data to CSV
    output_file = BASE_DIR / "data_raw" / "firms_hotspots_latest.csv"

    output_file.parent.mkdir(parents=True, exist_ok=True)

    fires.to_csv(output_file, index=False)

    print("\nFIRMS data saved successfully!")
    print("File location:", output_file)

    print("\nFirst 10 fire detections:")
    print(fires.head(10))