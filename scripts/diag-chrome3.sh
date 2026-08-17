#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/exito/projetos/BeatrizDt"
cd "${APP_DIR}"

echo "=== unzip / deps ==="
command -v unzip || echo "UNZIP MISSING"
dpkg -l unzip 2>/dev/null | tail -1 || true

echo "=== puppeteer revision ==="
node -e "console.log(require('puppeteer-core/lib/puppeteer/revisions.js'))"

echo "=== executablePath ==="
node -e "require('puppeteer').executablePath().then((p)=>console.log(p)).catch((e)=>console.error(e.message))"
