# Deploy Linux — BeatrizDt + PostgreSQL

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- PM2 (opcional)

## 1. PostgreSQL

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER lucas WITH PASSWORD '131201' CREATEDB;"
```

## 2. Configurar ambiente

Na pasta `BeatrizDt/`, copie o exemplo e ajuste:

```bash
cp .env.example .env
```

Edite `.env` com credenciais reais. **Nunca** commite o `.env`.

## 3. Instalar e subir

```bash
npm install
npm start
```

Na primeira execucao o servidor:
- Cria o banco `beatriz_impostos` se nao existir
- Roda migrations (tabelas)
- Faz seed de usuarios padrao se o banco estiver vazio

## 4. Importar dados antigos (uma vez)

Se existirem arquivos em `data/`:

```bash
npm run import:db
```

Importa `users.json`, `monthly-records.json`, `history/` e `backups/`.

## 5. PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

## 6. Verificar

```bash
curl http://localhost:3454/health
```

Resposta esperada:

```json
{ "ok": true, "storage": "postgres", "db": "connected" }
```

## Variaveis de ambiente

| Variavel | Descricao |
|----------|-----------|
| `DB_HOST` | Host PostgreSQL |
| `DB_PORT` | Porta (5432) |
| `DB_USER` | Usuario |
| `DB_PASSWORD` | Senha |
| `DB_NAME` | Nome do banco |
| `STORAGE_BACKEND` | `postgres` (producao) ou `json` (testes) |
| `SESSION_SECRET` | Segredo da sessao |
| `PORT` | Porta HTTP (3454) |

## Testes locais

```bash
set STORAGE_BACKEND=json
npm test
```

No Linux/macOS: `STORAGE_BACKEND=json npm test`
