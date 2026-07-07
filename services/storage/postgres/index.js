const { getPool } = require('../../db/database');

async function readUsersData() {
  const result = await getPool().query(
    'SELECT username, password, role, display_name AS "displayName", active FROM users ORDER BY id',
  );

  return { users: result.rows };
}

async function readRecordsData() {
  const result = await getPool().query(
    'SELECT competencia, payload, updated_at, updated_by FROM monthly_records ORDER BY competencia',
  );

  const records = result.rows.map((row) => ({
    ...row.payload,
    competencia: row.competencia,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    updatedBy: row.updated_by,
  }));

  return { records };
}

async function writeRecordsData(data) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    for (const record of data.records || []) {
      const payload = { ...record };
      const updatedAt = payload.updatedAt || new Date().toISOString();
      const updatedBy = payload.updatedBy || 'sistema';
      delete payload.updatedAt;
      delete payload.updatedBy;

      await client.query(
        `INSERT INTO monthly_records (competencia, payload, updated_at, updated_by)
         VALUES ($1, $2::jsonb, $3, $4)
         ON CONFLICT (competencia) DO UPDATE SET
           payload = EXCLUDED.payload,
           updated_at = EXCLUDED.updated_at,
           updated_by = EXCLUDED.updated_by`,
        [record.competencia, JSON.stringify(payload), updatedAt, updatedBy],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createBackupSnapshot(snapshot) {
  const result = await getPool().query(
    'INSERT INTO record_backups (snapshot) VALUES ($1::jsonb) RETURNING id',
    [JSON.stringify(snapshot)],
  );

  return result.rows[0].id;
}

async function readHistory(competencia) {
  const revisions = await getPool().query(
    `SELECT revision, updated_at AS "updatedAt", updated_by AS "updatedBy",
            competencia, summary
     FROM record_revisions
     WHERE competencia = $1
     ORDER BY revision ASC`,
    [competencia],
  );

  return {
    competencia,
    revisions: revisions.rows,
  };
}

async function writeHistory(competencia, history) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM record_revisions WHERE competencia = $1', [competencia]);

    for (const revision of history.revisions || []) {
      await client.query(
        `INSERT INTO record_revisions (competencia, revision, updated_at, updated_by, summary)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          competencia,
          revision.revision,
          revision.updatedAt,
          revision.updatedBy,
          revision.summary,
        ],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function appendRevision(competencia, revision) {
  await getPool().query(
    `INSERT INTO record_revisions (competencia, revision, updated_at, updated_by, summary)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (competencia, revision) DO UPDATE SET
       updated_at = EXCLUDED.updated_at,
       updated_by = EXCLUDED.updated_by,
       summary = EXCLUDED.summary`,
    [
      competencia,
      revision.revision,
      revision.updatedAt,
      revision.updatedBy,
      revision.summary,
    ],
  );
}

async function getAssetBuffer(assetKey) {
  const result = await getPool().query(
    'SELECT mime_type, content FROM app_assets WHERE asset_key = $1',
    [assetKey],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return {
    mimeType: result.rows[0].mime_type,
    buffer: result.rows[0].content,
  };
}

async function getUserPreference(username, key) {
  const result = await getPool().query(
    `SELECT up.preference_value
     FROM user_preferences up
     INNER JOIN users u ON u.id = up.user_id
     WHERE u.username = $1 AND up.preference_key = $2`,
    [username, key],
  );

  return result.rows[0]?.preference_value || null;
}

async function setUserPreference(username, key, value) {
  await getPool().query(
    `INSERT INTO user_preferences (user_id, preference_key, preference_value, updated_at)
     SELECT u.id, $2, $3, NOW()
     FROM users u
     WHERE u.username = $1
     ON CONFLICT (user_id, preference_key) DO UPDATE SET
       preference_value = EXCLUDED.preference_value,
       updated_at = NOW()`,
    [username, key, value],
  );
}

module.exports = {
  appendRevision,
  createBackupSnapshot,
  getAssetBuffer,
  getUserPreference,
  readHistory,
  readRecordsData,
  readUsersData,
  setUserPreference,
  writeHistory,
  writeRecordsData,
};
