# scripts/forecast.py
import json
from pathlib import Path
import numpy as np
import xgboost as xgb
from config import CITIES
from features import FEATURES, make_features
from aqi import pm25_to_aqi, category

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "model" / "xgb_pm25_24h.json"
METRICS = ROOT / "model" / "metrics.json"


def run_forecast(t, now, fires, measured):
    """t = cleaned hourly table; measured = {city: [fresh station pm25 values]}."""
    if not MODEL.exists():
        return None
    model = xgb.XGBRegressor()
    model.load_model(MODEL)
    mae = None
    if METRICS.exists():
        mae = json.load(open(METRICS))["test"]["xgboost"]["mae"]
    out = {}
    for name, lat, lon in CITIES:
        h = t[t.city == name].copy()
        if h.empty:
            continue
        if name in measured:
            h.loc[h.time == now, "pm25"] = sum(measured[name]) / len(measured[name])
        f = make_features(h, lat, lon, fires)
        if now not in f.index:
            continue
        p = float(np.expm1(model.predict(f.loc[[now], FEATURES]))[0])
        p = max(0.0, min(p, 1000.0))
        aqi = pm25_to_aqi(p)
        out[name] = {"pm25_24h": round(p, 1), "aqi_24h": aqi,
                     "category": category(aqi)[0],
                     "mae": round(mae, 1) if mae is not None else None}
    return {"generated": now.strftime("%Y-%m-%d %H:%M"), "cities": out}
