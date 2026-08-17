#!/usr/bin/env bash
set -euo pipefail

CHROME_DIR="/home/exito/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64"
APP_DIR="/home/exito/projetos/BeatrizDt"

echo "==> Permissoes atuais do crashpad"
ls -l "${CHROME_DIR}/chrome_crashpad_handler" "${CHROME_DIR}/chrome" "${CHROME_DIR}/chrome_sandbox" 2>/dev/null || true

echo "==> Tornando binarios executaveis"
find "${CHROME_DIR}" -maxdepth 1 -type f -exec chmod u+rwx,go+rx {} +
chmod +x "${CHROME_DIR}/chrome" "${CHROME_DIR}/chrome_crashpad_handler"

echo "==> Depois"
ls -l "${CHROME_DIR}/chrome_crashpad_handler" "${CHROME_DIR}/chrome"

echo "==> Teste Chrome"
"${CHROME_DIR}/chrome" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --dump-dom about:blank >/tmp/chrome-dom.html 2>/tmp/chrome-dom.err || true
tail -5 /tmp/chrome-dom.err || true
head -c 200 /tmp/chrome-dom.html; echo

echo "==> Teste Puppeteer"
cd "${APP_DIR}"
node - <<'NODE'
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  const page = await browser.newPage();
  await page.setContent('<h1>ok</h1>');
  const pdf = await page.pdf({ format: 'A4' });
  await browser.close();
  console.log('LAUNCH_OK bytes', pdf.length);
})().catch((error) => {
  console.error('LAUNCH_FAIL', error.message);
  process.exit(1);
});
NODE
