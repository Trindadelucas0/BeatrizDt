#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "==> Atualizando codigo (nao mexe no Postgres nem no .env)"
JSON_DATA="data/monthly-records.json"
if [[ -f "${JSON_DATA}" ]]; then
  cp -a "${JSON_DATA}" "data/monthly-records.json.bak"
fi

git pull --ff-only origin main

if [[ ! -f "${JSON_DATA}" && -f "data/monthly-records.json.bak" ]]; then
  cp -a "data/monthly-records.json.bak" "${JSON_DATA}"
  echo "==> data/monthly-records.json restaurado do backup local"
fi

echo "==> Reiniciando app"
pm2 restart beatriz-dt
pm2 logs beatriz-dt --lines 15 --nostream
