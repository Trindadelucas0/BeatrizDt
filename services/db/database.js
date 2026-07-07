const fs = require('node:fs/promises');
const path = require('node:path');
const { Client, Pool } = require('pg');

let pool = null;

function getConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'lucas',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'beatriz_impostos',
  };
}

function getAdminConfig() {
  const config = getConfig();
  return { ...config, database: 'postgres' };
}

async function ensureDatabaseExists() {
  const config = getConfig();
  const admin = new Client(getAdminConfig());

  try {
    await admin.connect();
    const result = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [config.database],
    );

    if (result.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${config.database.replace(/"/g, '""')}"`);
      console.log(`Banco de dados criado: ${config.database}`);
    }
  } finally {
    await admin.end();
  }
}

async function runMigrations(client) {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(64) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const file of files) {
    const version = file.replace('.sql', '');
    const applied = await client.query(
      'SELECT 1 FROM schema_migrations WHERE version = $1',
      [version],
    );

    if (applied.rowCount > 0) {
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
    await client.query('BEGIN');

    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version],
      );
      await client.query('COMMIT');
      console.log(`Migration aplicada: ${version}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
}

function getPool() {
  if (!pool) {
    pool = new Pool(getConfig());
  }

  return pool;
}

async function initDatabase() {
  await ensureDatabaseExists();
  const client = await getPool().connect();

  try {
    await runMigrations(client);
    const { runSeed } = require('./seed');
    await runSeed(client);
  } finally {
    client.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

async function healthCheck() {
  const result = await getPool().query('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
}

module.exports = {
  closePool,
  getConfig,
  getPool,
  healthCheck,
  initDatabase,
};
