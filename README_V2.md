# SmogWatch Punjab v2 - install

1. Copy everything from this folder into your project (it replaces docs/index.html, docs/style.css and adds docs/app.js, lib.js, i18n.js, sw.js, manifest, icons; adds scripts/build_stations.py and scripts/telegram_alert.py).
2. Workflows: if you already have .github/workflows/update.yml, do NOT overwrite it - add the "Build sensor layer" step from the included update.yml after your main pipeline step. Add alert.yml as is.
3. Telegram alert (optional): in Telegram talk to @BotFather -> /newbot -> copy the token. Send any message to your bot, then open https://api.telegram.org/bot<TOKEN>/getUpdates and copy chat.id. In GitHub: Settings -> Secrets -> Actions -> add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.
4. Test locally: python -m http.server 8000 --directory docs ; test alert text: python scripts/telegram_alert.py --dry-run
5. Commit and push. After the first hourly run docs/data/stations.json appears and the Sensors layer fills in.
