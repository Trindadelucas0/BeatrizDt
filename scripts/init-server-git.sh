#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/exito/projetos/BeatrizDt"
cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "ERRO: .env nao encontrado. Abortando para nao perder configuracao."
  exit 1
fi

cp -a .env "${APP_DIR}/.env.gitsetup-backup"
echo "==> .env copiado para backup local (fora do git)"

if [[ -d .git ]]; then
  echo "==> Ja existe .git neste diretorio"
  git remote -v
  git status -sb
  exit 0
fi

git init -b main
git remote add origin https://github.com/Trindadelucas0/BeatrizDt.git
git fetch origin
git reset --hard origin/main
git branch --set-upstream-to=origin/main main

if [[ ! -f .env ]]; then
  echo "==> Restaurando .env a partir do backup"
  cp -a "${APP_DIR}/.env.gitsetup-backup" .env
fi

echo "==> Repositorio pronto"
git status -sb
git log -1 --oneline
echo "==> .env existe? $(test -f .env && echo sim || echo NAO)"
echo "==> Banco NAO foi alterado. PM2 NAO foi reiniciado."
