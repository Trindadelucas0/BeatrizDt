#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Instalando unzip (necessario para extrair Chrome do Puppeteer)"
sudo apt install -y unzip

echo "==> Limpando cache corrompido do Puppeteer"
rm -rf "${HOME}/.cache/puppeteer"

echo "==> Removendo node_modules incompleto"
rm -rf node_modules

echo "==> Instalando dependencias npm (inclui download do Chrome)"
npm install

echo "==> Verificando express"
test -d node_modules/express

echo "==> Instalacao concluida."
echo "    Suba o app com: node server.js"
echo "    Ou em background: nohup node server.js > app.log 2>&1 &"
echo ""
echo "IMPORTANTE: troque a senha do usuario se ela foi exposta: passwd"
