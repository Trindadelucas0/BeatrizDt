#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/exito/projetos/BeatrizDt"
cd "${APP_DIR}"

echo "=== CHROME 150 DIR ==="
ls -la /home/exito/.cache/puppeteer/chrome/linux-150.0.7871.24 || true
echo "=== FIND ALL EXECUTABLE-LIKE ==="
find /home/exito/.cache/puppeteer -type f -executable | head -50
echo "=== FIND ANY CHROME NAME ==="
find /home/exito/.cache/puppeteer -iname '*chrome*' | head -50
echo "=== EXPECTED FROM PUPPETEER ==="
node -e "const p=require('puppeteer'); console.log('puppeteer', require('puppeteer/package.json').version); try { console.log('exec', p.executablePath()); } catch(e) { console.error('exec error', e.message); }"
echo "=== BROWSERS JSON ==="
find /home/exito/.cache/puppeteer -name '*.json' | head
echo "=== NODE_MODULES PUPPETEER BROWSERS ==="
ls -la "${APP_DIR}/node_modules/@puppeteer/browsers" | head
echo "=== PUPPETEER REVISIONS ==="
node -e "try { const r=require('puppeteer-core/lib/cjs/puppeteer/revisions.js'); console.log(r); } catch(e) { console.log('no cjs', e.message); } try { const r=require('puppeteer-core/lib/esm/puppeteer/revisions.js'); console.log('esm', r); } catch(e) {}"
