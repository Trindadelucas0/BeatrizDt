const fs = require('node:fs/promises');
const path = require('node:path');
const { createInitialRecord } = require('../sheetSchemaService');
const { ensureYearCompetenciasInData, DEFAULT_SEED_YEAR } = require('../competenciaSeedService');

const DEFAULT_USERS = [
  {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    displayName: 'Administrador',
    active: true,
  },
  {
    username: 'usuario',
    password: 'usuario123',
    role: 'user',
    displayName: 'Usuario comum',
    active: true,
  },
];

const ASSET_FILES = [
  { key: 'dauto-login-logo', relativePath: path.join('images', 'dauto-login-logo.png') },
  { key: 'dauto-login-page-logo', relativePath: path.join('images', 'dauto-login-page-logo.png') },
  { key: 'logo', relativePath: path.join('images', 'logo.png') },
];

async function seedUsers(client) {
  const count = await client.query('SELECT COUNT(*)::int AS total FROM users');
  if (count.rows[0].total > 0) {
    return;
  }

  for (const user of DEFAULT_USERS) {
    await client.query(
      `INSERT INTO users (username, password, role, display_name, active)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.username, user.password, user.role, user.displayName, user.active],
    );
  }

  console.log('Seed: usuarios padrao criados');
}

async function seedRecords(client) {
  const count = await client.query('SELECT COUNT(*)::int AS total FROM monthly_records');
  if (count.rows[0].total > 0) {
    return;
  }

  const initial = {
    ...createInitialRecord(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'sistema',
  };

  const { records } = ensureYearCompetenciasInData({ records: [initial] }, DEFAULT_SEED_YEAR);

  for (const record of records) {
    const payload = { ...record };
    const updatedAt = payload.updatedAt || new Date().toISOString();
    const updatedBy = payload.updatedBy || 'sistema';
    delete payload.updatedAt;
    delete payload.updatedBy;

    await client.query(
      `INSERT INTO monthly_records (competencia, payload, updated_at, updated_by)
       VALUES ($1, $2::jsonb, $3, $4)`,
      [record.competencia, JSON.stringify(payload), updatedAt, updatedBy],
    );
  }

  console.log(`Seed: ${records.length} competencias iniciais criadas`);
}

async function seedAssets(client) {
  const count = await client.query('SELECT COUNT(*)::int AS total FROM app_assets');
  if (count.rows[0].total > 0) {
    return;
  }

  let seeded = 0;

  for (const asset of ASSET_FILES) {
    const filePath = path.join(process.cwd(), 'public', asset.relativePath);

    try {
      const content = await fs.readFile(filePath);
      await client.query(
        `INSERT INTO app_assets (asset_key, mime_type, content, updated_at)
         VALUES ($1, $2, $3, NOW())`,
        [asset.key, 'image/png', content],
      );
      seeded += 1;
    } catch {
      // PNG ausente — ignora
    }
  }

  if (seeded > 0) {
    console.log(`Seed: ${seeded} logo(s) carregada(s) em app_assets`);
  }
}

async function runSeed(client) {
  await seedUsers(client);
  await seedRecords(client);
  await seedAssets(client);
}

module.exports = {
  runSeed,
};
