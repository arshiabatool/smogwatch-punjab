
import numpy as np
import pandas as pd

from smog import _dist_bearing


FEATURES = [
    "pm_now",
    "pm_mean24",
    "pm_max24",
    "pm_prev24",
    "pm_trend6",
    "wind_mean24",
    "blh_mean24",
    "blh_min24",
    "hum_mean24",
    "temp_mean24",
    "vis_mean24",
    "rain_sum24",
    "wind_next24",
    "blh_mean_next24",
    "blh_min_next24",
    "hum_next24",
    "rain_next24",
    "fire300_prev1",
    "fire_up_prev1",
    "doy_sin",
    "doy_cos",
    "month",
    "lat",
    "lon",
]


def daily_wind_dir(h):
    rad = np.deg2rad(h.wind_dir)
    day = h.index.date

    s = np.sin(rad).groupby(day).mean()
    c = np.cos(rad).groupby(day).mean()

    return np.degrees(np.arctan2(s, c)) % 360


def daily_fires(fires, lat, lon, wind_day):
    if fires is None or len(fires) == 0:
        return pd.DataFrame(columns=["fire300", "fire_up"])

    d, b = _dist_bearing(
        lat,
        lon,
        fires.latitude.to_numpy(),
        fires.longitude.to_numpy(),
    )

    keep = d <= 300

    f = fires.loc[keep, ["acq_date"]].copy()
    f["b"] = b[keep]
    f["date"] = pd.to_datetime(f.acq_date).dt.date
    f["wd"] = f["date"].map(wind_day)

    f["up"] = (
        np.abs((f.b - f.wd + 180) % 360 - 180) <= 45
    )

    return f.groupby("date").agg(
        fire300=("b", "size"),
        fire_up=("up", "sum"),
    )


def make_features(h, lat, lon, fires):
    """
    h needs columns:
    time, pm25, wind_ms, wind_dir, blh, humidity,
    temp, visibility, precipitation.

    Returns one row per hour, features plus y.
    """

    h = h.sort_values("time").set_index("time").asfreq("h")

    pm = h.pm25

    past = lambda s, n, how, m=12: getattr(
        s.rolling(n, min_periods=m), how
    )()

    ahead = lambda s, how: getattr(
        s.shift(-24).rolling(24, min_periods=18), how
    )()

    f = pd.DataFrame(index=h.index)

    # Historical PM2.5 features
    f["pm_now"] = pm
    f["pm_mean24"] = past(pm, 24, "mean")
    f["pm_max24"] = past(pm, 24, "max")
    f["pm_prev24"] = past(pm.shift(24), 24, "mean")

    f["pm_trend6"] = (
        past(pm, 6, "mean", 3)
        - past(pm.shift(6), 6, "mean", 3)
    )

    # Historical meteorological features
    f["wind_mean24"] = past(h.wind_ms, 24, "mean")
    f["blh_mean24"] = past(h.blh, 24, "mean")
    f["blh_min24"] = past(h.blh, 24, "min")
    f["hum_mean24"] = past(h.humidity, 24, "mean")
    f["temp_mean24"] = past(h.temp, 24, "mean")
    f["vis_mean24"] = past(h.visibility, 24, "mean")
    f["rain_sum24"] = past(h.precipitation, 24, "sum")

    # Next 24-hour meteorological features
    f["wind_next24"] = ahead(h.wind_ms, "mean")
    f["blh_mean_next24"] = ahead(h.blh, "mean")
    f["blh_min_next24"] = ahead(h.blh, "min")
    f["hum_next24"] = ahead(h.humidity, "mean")
    f["rain_next24"] = ahead(h.precipitation, "sum")

    # Fire hotspot features
    g = daily_fires(
        fires,
        lat,
        lon,
        daily_wind_dir(h),
    )

    prev = pd.Series(
        (f.index.normalize() - pd.Timedelta(days=1)).date,
        index=f.index,
    )

    f["fire300_prev1"] = (
        prev.map(g.fire300).fillna(0) if len(g) else 0
    )

    f["fire_up_prev1"] = (
        prev.map(g.fire_up).fillna(0) if len(g) else 0
    )

    # Seasonal features
    doy = f.index.dayofyear

    f["doy_sin"] = np.sin(2 * np.pi * doy / 365.25)
    f["doy_cos"] = np.cos(2 * np.pi * doy / 365.25)

    f["month"] = f.index.month

    # Geographic features
    f["lat"] = lat
    f["lon"] = lon

    # Target: mean PM2.5 over the next 24 hours
    f["y"] = ahead(pm, "mean")

    return f
