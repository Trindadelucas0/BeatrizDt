#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "==> Atualizando codigo (nao mexe no Postgres nem no .env)"
git pull --ff-only origin main

echo "==> Reiniciando app"
pm2 restart beatriz-dt
pm2 logs beatriz-dt --lines 15 --nostream
