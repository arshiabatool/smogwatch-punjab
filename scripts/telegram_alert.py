"""Daily bilingual (English + Urdu) smog alert to a Telegram chat.

Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.  Use --dry-run to print the message instead of sending.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "docs" / "data"
PKT = timezone(timedelta(hours=5))

CITY_UR = {"Lahore": "لاہور", "Faisalabad": "فیصل آباد", "Multan": "ملتان", "Rawalpindi": "راولپنڈی",
           "Gujranwala": "گوجرانوالہ", "Sialkot": "سیالکوٹ", "Bahawalpur": "بہاولپور", "Sargodha": "سرگودھا",
           "Sahiwal": "ساہیوال", "Jhang": "جھنگ", "Gujrat": "گجرات", "Kasur": "قصور", "Okara": "اوکاڑہ",
           "Sheikhupura": "شیخوپورہ", "Rahim Yar Khan": "رحیم یار خان", "Dera Ghazi Khan": "ڈیرہ غازی خان"}
LEVEL_UR = {"Low": "کم", "Moderate": "درمیانی", "High": "زیادہ", "Severe": "شدید"}


def load(name):
    p = DATA / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def age_hours(updated):
    try:
        t = datetime.strptime(updated, "%Y-%m-%d %H:%M").replace(tzinfo=PKT)
        return (datetime.now(timezone.utc) - t).total_seconds() / 3600
    except Exception:
        return None


def build_message():
    latest = load("latest.json")
    if not latest:
        return None
    fc = (load("forecast.json") or {}).get("cities", {})
    hot = [c for c in latest["cities"]
           if c.get("smog_level") in ("High", "Severe") or (isinstance(c.get("aqi"), (int, float)) and c["aqi"] >= 151)]
    hot.sort(key=lambda c: -(c.get("aqi") or 0))
    age = age_hours(latest.get("updated", ""))
    stale = age is not None and age > 6

    en = ["SmogWatch Punjab - morning update"]
    ur = ["سموگ واچ پنجاب - صبح کی اطلاع"]
    if stale:
        en.append(f"Warning: data is {age:.0f} h old.")
        ur.append(f"انتباہ: ڈیٹا {age:.0f} گھنٹے پرانا ہے۔")
    if not hot:
        en.append("No city has High/Severe smog risk or unhealthy air right now.")
        ur.append("اس وقت کسی شہر میں سموگ کا خطرہ زیادہ نہیں اور ہوا غیر صحت بخش نہیں۔")
    else:
        for c in hot[:10]:
            f = fc.get(c["city"], {})
            tail = f" | next 24h ~{round(f['pm25_24h'])} ug/m3" if isinstance(f.get("pm25_24h"), (int, float)) else ""
            en.append(f"- {c['city']}: AQI {round(c['aqi']) if c.get('aqi') is not None else '-'}, smog {c.get('smog_level')}{tail}")
            lv = LEVEL_UR.get(c.get("smog_level"), c.get("smog_level") or "")
            ur.append(f"- {CITY_UR.get(c['city'], c['city'])}: اے کیو آئی {round(c['aqi']) if c.get('aqi') is not None else '-'}، سموگ {lv}")
        en.append("Tip: limit outdoor exercise, wear an N95 mask outside, keep windows closed.")
        ur.append("مشورہ: باہر ورزش کم کریں، باہر N95 ماسک پہنیں، کھڑکیاں بند رکھیں۔")
    en.append(f"Data time (PKT): {latest.get('updated', '-')}")
    return "\n".join(en) + "\n\n" + "\n".join(ur)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    msg = build_message()
    if not msg:
        print("telegram_alert: no latest.json, nothing to send")
        return 0
    if args.dry_run:
        print(msg)
        return 0
    token, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat:
        print("telegram_alert: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set, skipping")
        return 0
    r = requests.post(f"https://api.telegram.org/bot{token}/sendMessage",
                      data={"chat_id": chat, "text": msg}, timeout=30)
    if r.status_code != 200:
        print("telegram_alert: Telegram returned", r.status_code, r.text[:200].replace(token, "***"))
        return 1
    print("telegram_alert: sent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
