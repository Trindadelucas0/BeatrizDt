#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/exito/projetos/BeatrizDt"
CACHE_DIR="/home/exito/.cache/puppeteer/chrome/linux-150.0.7871.24"
ZIP_URL="https://storage.googleapis.com/chrome-for-testing-public/150.0.7871.24/linux64/chrome-linux64.zip"
ZIP_PATH="/tmp/chrome-linux64-150.zip"

cd "${APP_DIR}"

echo "==> Limpando cache incompleto do Chrome 150"
rm -rf "${CACHE_DIR}"
mkdir -p "${CACHE_DIR}"

if [[ ! -f "${ZIP_PATH}" ]]; then
  echo "==> Baixando Chrome 150.0.7871.24"
  curl -L --fail --retry 3 -o "${ZIP_PATH}" "${ZIP_URL}"
else
  echo "==> Reusando zip ja baixado em ${ZIP_PATH}"
fi

echo "==> Extraindo com Python (unzip do sistema nao esta instalado)"
python3 - <<'PY'
import zipfile
from pathlib import Path

zip_path = Path("/tmp/chrome-linux64-150.zip")
dest = Path("/home/exito/.cache/puppeteer/chrome/linux-150.0.7871.24")
with zipfile.ZipFile(zip_path) as archive:
    archive.extractall(dest)
print("extraido", dest)
PY

CHROME_DIR="${CACHE_DIR}/chrome-linux64"
CHROME_BIN="${CHROME_DIR}/chrome"
find "${CHROME_DIR}" -maxdepth 1 -type f -exec chmod u+rwx,go+rx {} +
chmod +x "${CHROME_BIN}" "${CHROME_DIR}/chrome_crashpad_handler"
ls -lh "${CHROME_BIN}" "${CHROME_DIR}/chrome_crashpad_handler"

echo "==> Testando Puppeteer"
node <<'NODE'
const puppeteer = require('puppeteer');

(async () => {
  const executablePath = await puppeteer.executablePath();
  console.log('executablePath', executablePath);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent('<h1>ok</h1>');
  const pdf = await page.pdf({ format: 'A4' });
  await browser.close();
  console.log('pdfBytes', pdf.length);
})().catch((error) => {
  console.error('LAUNCH_FAIL', error.message);
  process.exit(1);
});
NODE
