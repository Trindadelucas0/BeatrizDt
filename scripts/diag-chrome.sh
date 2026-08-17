#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/exito/projetos/BeatrizDt"

echo "=== ENV ==="
grep -E '^(DB_HOST|DISABLE_PDF_BROWSER|PORT|STORAGE_BACKEND)=' "${APP_DIR}/.env"

echo "=== PUPPETEER VERSION ==="
node -p "require('${APP_DIR}/node_modules/puppeteer/package.json').version"

echo "=== CACHE DIRS ==="
find /home/exito/.cache/puppeteer -maxdepth 4 -type d || true

echo "=== CHROME BINS ==="
find /home/exito/.cache/puppeteer -type f \( -name chrome -o -name chrome-headless-shell \) || true

echo "=== CONFIG FILES ==="
ls -la "${APP_DIR}/.puppeteerrc.cjs" "${APP_DIR}/.puppeteerrc.js" "${APP_DIR}/puppeteer.config.cjs" 2>/dev/null || true

echo "=== LOCAL CHROME IN NODE_MODULES ==="
find "${APP_DIR}/node_modules/puppeteer" -name chrome -o -name '.local-chromium' 2>/dev/null | head
ls -la "${APP_DIR}/node_modules/.cache" 2>/dev/null || true
