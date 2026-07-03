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

echo "==> Instalando bibliotecas do Chrome (Puppeteer/PDF)"
bash "$(dirname "${BASH_SOURCE[0]}")/install-chrome-deps.sh"

echo "==> Instalando dependencias npm (inclui download do Chrome)"
npm install

echo "==> Verificando express"
test -d node_modules/express

echo "==> Instalacao concluida."
echo "    PM2: pm2 start ecosystem.config.cjs  (ou pm2 restart beatriz-dt)"
echo ""
echo "IMPORTANTE: troque a senha do usuario se ela foi exposta: passwd"
