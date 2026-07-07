require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const { initDatabase, closePool, getPool } = require('../services/db/database');

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function importUsers() {
  const filePath = path.join(process.cwd(), 'data', 'users.json');
  const data = await readJson(filePath, { users: [] });
  let count = 0;

  for (const user of data.users || []) {
    await getPool().query(
      `INSERT INTO users (username, password, role, display_name, active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE SET
         password = EXCLUDED.password,
         role = EXCLUDED.role,
         display_name = EXCLUDED.display_name,
         active = EXCLUDED.active`,
      [
        user.username,
        user.password,
        user.role,
        user.displayName || user.username,
        user.active !== false,
      ],
    );
    count += 1;
  }

  return count;
}

async function importRecords() {
  const filePath = path.join(process.cwd(), 'data', 'monthly-records.json');
  const data = await readJson(filePath, { records: [] });
  let count = 0;

  for (const record of data.records || []) {
    const payload = { ...record };
    const updatedAt = payload.updatedAt || new Date().toISOString();
    const updatedBy = payload.updatedBy || 'import';
    delete payload.updatedAt;
    delete payload.updatedBy;

    await getPool().query(
      `INSERT INTO monthly_records (competencia, payload, updated_at, updated_by)
       VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT (competencia) DO UPDATE SET
         payload = EXCLUDED.payload,
         updated_at = EXCLUDED.updated_at,
         updated_by = EXCLUDED.updated_by`,
      [record.competencia, JSON.stringify(payload), updatedAt, updatedBy],
    );
    count += 1;
  }

  return count;
}

async function importHistory() {
  const historyDir = path.join(process.cwd(), 'data', 'history');
  let count = 0;

  try {
    const files = await fs.readdir(historyDir);

    for (const file of files.filter((entry) => entry.endsWith('.json'))) {
      const history = await readJson(path.join(historyDir, file), { revisions: [] });

      for (const revision of history.revisions || []) {
        await getPool().query(
          `INSERT INTO record_revisions (competencia, revision, updated_at, updated_by, summary)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (competencia, revision) DO UPDATE SET
             updated_at = EXCLUDED.updated_at,
             updated_by = EXCLUDED.updated_by,
             summary = EXCLUDED.summary`,
          [
            history.competencia || revision.competencia,
            revision.revision,
            revision.updatedAt,
            revision.updatedBy,
            revision.summary,
          ],
        );
        count += 1;
      }
    }
  } catch {
    return 0;
  }

  return count;
}

async function importBackups() {
  const backupDir = path.join(process.cwd(), 'data', 'backups');
  let count = 0;

  try {
    const files = await fs.readdir(backupDir);

    for (const file of files.filter((entry) => entry.endsWith('.json'))) {
      const snapshot = await readJson(path.join(backupDir, file), null);
      if (!snapshot) {
        continue;
      }

      await getPool().query(
        'INSERT INTO record_backups (snapshot) VALUES ($1::jsonb)',
        [JSON.stringify(snapshot)],
      );
      count += 1;
    }
  } catch {
    return 0;
  }

  return count;
}

async function main() {
  process.env.STORAGE_BACKEND = 'postgres';

  try {
    await initDatabase();

    const users = await importUsers();
    const records = await importRecords();
    const revisions = await importHistory();
    const backups = await importBackups();

    console.log('Importacao concluida:');
    console.log(`  users: ${users}`);
    console.log(`  monthly_records: ${records}`);
    console.log(`  record_revisions: ${revisions}`);
    console.log(`  record_backups: ${backups}`);
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error('Falha na importacao:', error.message);
  process.exit(1);
});
