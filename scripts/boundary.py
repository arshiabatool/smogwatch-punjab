
import requests
import json
from pathlib import Path
from shapely.geometry import shape

API = "https://www.geoboundaries.org/api/current/gbOpen/PAK/ADM1/"

print("Fetching Pakistan administrative boundaries...")

response = requests.get(API, timeout=60)
response.raise_for_status()

metadata = response.json()

if isinstance(metadata, list):
    metadata = metadata[0]

print("Boundary year:", metadata.get("boundaryYearRepresented"))
print("Downloading GeoJSON...")

geojson_url = metadata["simplifiedGeometryGeoJSON"]

geo_response = requests.get(geojson_url, timeout=120)
geo_response.raise_for_status()

geojson = geo_response.json()

output = Path("../data_raw/pakistan_adm1.geojson")
output.parent.mkdir(parents=True, exist_ok=True)

with open(output, "w", encoding="utf-8") as f:
    json.dump(geojson, f)

print("Saved boundary to:", output)

features = geojson["features"]

print("\nAvailable provinces:")

for feature in features:
    properties = feature["properties"]
    print(properties)

