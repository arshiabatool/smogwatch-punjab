
import math


# PM2.5 low, PM2.5 high, AQI low, AQI high
BREAKS = [
    (0.0, 9.0, 0, 50),
    (9.1, 35.4, 51, 100),
    (35.5, 55.4, 101, 150),
    (55.5, 125.4, 151, 200),
    (125.5, 225.4, 201, 300),
    (225.5, 325.4, 301, 500)
]


# AQI category, label and display colour
CATEGORIES = [
    (50, "Good", "#00e400"),
    (100, "Moderate", "#ffff00"),
    (150, "Unhealthy for sensitive groups", "#ff7e00"),
    (200, "Unhealthy", "#ff0000"),
    (300, "Very unhealthy", "#8f3f97"),
    (500, "Hazardous", "#7e0023")
]


def pm25_to_aqi(c):

    # Handle missing, invalid and negative values
    if c is None:
        return None

    try:
        c = float(c)
    except (ValueError, TypeError):
        return None

    if not math.isfinite(c) or c < 0:
        return None

    # Truncate PM2.5 concentration to one decimal place
    c = math.floor(c * 10) / 10

    # Calculate AQI using linear interpolation
    for lo, hi, ilo, ihi in BREAKS:

        if lo <= c <= hi:

            aqi = (
                (ihi - ilo) / (hi - lo)
            ) * (c - lo) + ilo

            return round(aqi)

    # Concentrations above the final breakpoint
    if c > 325.4:
        return 500

    return None


def category(aqi):

    if aqi is None:
        return None, "#999999"

    for top, name, color in CATEGORIES:

        if aqi <= top:
            return name, color

    return "Hazardous", "#7e0023"
