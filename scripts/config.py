
# scripts/config.py

# Punjab cities: name, latitude, longitude
CITIES = [
    ("Lahore", 31.5497, 74.3436),
    ("Faisalabad", 31.4504, 73.1350),
    ("Rawalpindi", 33.5651, 73.0169),
    ("Islamabad", 33.6844, 73.0479),
    ("Multan", 30.1575, 71.5249),
    ("Gujranwala", 32.1877, 74.1945),
    ("Sargodha", 32.0836, 72.6711),
    ("Sialkot", 32.4945, 74.5229),
    ("Bahawalpur", 29.3544, 71.6911),
    ("Sheikhupura", 31.7167, 73.9850),
    ("Jhang", 31.2681, 72.3181),
    ("Sahiwal", 30.6682, 73.1114),
    ("Kasur", 31.1187, 74.4467),
    ("Okara", 30.8138, 73.4534),
    ("Rahim Yar Khan", 28.4202, 70.2952),
    ("DG Khan", 30.0561, 70.6347),
    ("Gujrat", 32.5731, 74.0750),
    ("Jhelum", 32.9425, 73.7257),
    ("Attock", 33.7660, 72.3609),
    ("Chiniot", 31.7292, 72.9822),
    ("Mianwali", 32.5839, 71.5370),
    ("Khushab", 32.2953, 72.3489),
    ("Hafizabad", 32.0709, 73.6880),
    ("Mandi Bahauddin", 32.5861, 73.4917),
    ("Narowal", 32.1019, 74.8731),
    ("Pakpattan", 30.3436, 73.3944),
    ("Vehari", 30.0452, 72.3489),
    ("Khanewal", 30.3017, 71.9321),
    ("Muzaffargarh", 30.0703, 71.1933),
    ("Bhakkar", 31.6082, 71.0654),
    ("Chakwal", 32.9328, 72.8630),
    ("Murree", 33.9070, 73.3943),
    ("Wazirabad", 32.4423, 74.1200),
    ("Nankana Sahib", 31.4492, 73.7075),
    ("Rajanpur", 29.1044, 70.3250),
    ("Kot Addu", 30.4689, 70.9669),
]

# Bounding boxes: west, south, east, north
FIRE_BOX = (69.0, 27.0, 78.0, 34.0)

STATION_BOX = (69.5, 27.5, 75.0, 34.2)
# API endpoints
OPEN_METEO_AQ = "https://air-quality-api.open-meteo.com/v1/air-quality"

OPEN_METEO_WX = "https://api.open-meteo.com/v1/forecast"

OPENAQ = "https://api.openaq.org/v3"

FIRMS = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

# Timezone
TIMEZONE = "Asia/Karachi"
