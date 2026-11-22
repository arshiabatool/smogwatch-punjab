# scripts/train_model.py
import json
from pathlib import Path
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from features import FEATURES, make_features
from aqi import pm25_to_aqi, category

RAW, OUT = Path("data_raw"), Path("model")
OUT.mkdir(exist_ok=True)
TEST_START = pd.Timestamp("2026-10-01")     # test = start of the 2026 smog season
LOSO_STATIONS = 10                          # how many stations to hold out one by one

pm = pd.read_csv(RAW / "station_pm25_hourly.csv", parse_dates=["time"])
wx = pd.read_csv(RAW / "weather_hourly.csv", parse_dates=["time"])
fires = pd.read_csv(RAW / "fires_archive.csv")
wx_by = dict(tuple(wx.groupby("station_id")))

frames = []
for n, (sid, g) in enumerate(pm.groupby("station_id"), 1):
    h = wx_by[sid].merge(g[["time", "pm25"]], on="time", how="left")
    f = make_features(h, g.lat.iloc[0], g.lon.iloc[0], fires)
    f["station_id"] = sid
    frames.append(f)
    if n % 20 == 0:
        print(n, "stations processed")

data = pd.concat(frames).dropna(subset=["y", "pm_now", "pm_mean24"])
data = data[data.index.hour % 3 == 0]                 # one sample every 3 hours
rows_per = data.groupby("station_id").size()
print("rows:", len(data), "| stations:", data.station_id.nunique())
print("rows per station: min", rows_per.min(), "median", int(rows_per.median()), "max", rows_per.max())

train = data[data.index < TEST_START - pd.Timedelta(days=1)]
test = data[data.index >= TEST_START]
print("train:", len(train), "rows,", train.index.min().date(), "to", train.index.max().date(),
      "| mean PM2.5 target", round(train.y.mean(), 1))
print("test: ", len(test), "rows,", test.index.min().date(), "to", test.index.max().date(),
      "| mean PM2.5 target", round(test.y.mean(), 1))
if len(test) < 1000:
    raise SystemExit("Test set too small: move TEST_START earlier")

vcut = train.index.sort_values()[int(len(train) * 0.85)]
tr, va = train[train.index < vcut], train[train.index >= vcut]

PARAMS = dict(learning_rate=0.03, max_depth=5, subsample=0.8, colsample_bytree=0.8,
              min_child_weight=5, reg_lambda=2.0, tree_method="hist", random_state=42)


def fit(a, b):
    m = xgb.XGBRegressor(n_estimators=1500, early_stopping_rounds=50, **PARAMS)
    m.fit(a[FEATURES], np.log1p(a.y), eval_set=[(b[FEATURES], np.log1p(b.y))], verbose=False)
    return m


def predict(m, d):
    return np.expm1(m.predict(d[FEATURES])).clip(0, 1000)


def score(y, p):
    cats = lambda s: pd.Series(np.asarray(s)).apply(lambda v: category(pm25_to_aqi(v))[0]).to_numpy()
    return {"mae": float(mean_absolute_error(y, p)),
            "rmse": float(mean_squared_error(y, p) ** 0.5),
            "r2": float(r2_score(y, p)),
            "same_category": float((cats(y) == cats(p)).mean())}


model = fit(tr, va)
res = {"xgboost": score(test.y, predict(model, test)),
       "persistence_baseline": score(test.y, test.pm_mean24)}
print(json.dumps(res, indent=2))

# leave-one-station-out on a random sample of stations
loso = []
counts = test.station_id.value_counts()
cand = counts[counts >= 100].index.to_numpy()
rng = np.random.default_rng(42)
for sid in rng.choice(cand, size=min(LOSO_STATIONS, len(cand)), replace=False):
    a = train[train.station_id != sid]
    te = test[test.station_id == sid]
    k = a.index.sort_values()[int(len(a) * 0.85)]
    m = fit(a[a.index < k], a[a.index >= k])
    s = score(te.y, predict(m, te))
    s["persistence_mae"] = float(mean_absolute_error(te.y, te.pm_mean24))
    s["station_id"] = int(sid)
    loso.append(s)
    print("held out", int(sid), "MAE", round(s["mae"], 1), "vs persistence", round(s["persistence_mae"], 1))
if loso:
    print("LOSO mean MAE:", round(np.mean([x["mae"] for x in loso]), 1),
          "| persistence:", round(np.mean([x["persistence_mae"] for x in loso]), 1))

imp = pd.Series(model.feature_importances_, index=FEATURES).sort_values(ascending=False)
print(imp.head(10))

# final model: train on everything, using the number of trees found above
final = xgb.XGBRegressor(n_estimators=model.best_iteration + 1, **PARAMS)
final.fit(data[FEATURES], np.log1p(data.y))
final.save_model(OUT / "xgb_pm25_24h.json")
json.dump({"test": res, "loso": loso, "rows": len(data),
           "test_from": str(TEST_START.date()), "features": FEATURES,
           "top_features": imp.head(10).round(4).to_dict()},
          open(OUT / "metrics.json", "w"), indent=2)
print("saved model/xgb_pm25_24h.json and model/metrics.json")