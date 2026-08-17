#!/usr/bin/env node
require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const { getPool, closePool } = require('../services/db/database');

const PROTECTED_COMPETENCIAS = new Set(['03/2026', '06/2026']);
const MIN_RESTORE_SCORE = 100;
const MAX_SANE_SCORE = 5_000_000;
const JSON_CANDIDATES = [
  path.join('data', 'monthly-records.json'),
  path.join('data', 'monthly-records-backup-20260706-2307.json'),
  path.join('data', 'monthly-records.json.bak'),
];

function numericScore(record) {
  let total = 0;
  for (const group of record.groups || []) {
    for (const company of group.companies || []) {
      total += Number(company.inss || 0)
        + Number(company.irrf || 0)
        + Number(company.fgtsMensal || 0)
        + Number(company.fgtsDecimoTerceiro || 0)
        + Number(company.emprestimoConsignado || 0);
    }
  }
  return Number.isFinite(total) ? total : Number.POSITIVE_INFINITY;
}

function isSaneScore(score) {
  return Number.isFinite(score) && score >= MIN_RESTORE_SCORE && score <= MAX_SANE_SCORE;
}

async function readJsonRecords(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data.records) ? data.records : [];
  } catch {
    return [];
  }
}

async function loadBestJsonByCompetencia() {
  const best = new Map();

  for (const filePath of JSON_CANDIDATES) {
    const records = await readJsonRecords(filePath);
    for (const record of records) {
      const competencia = record.competencia;
      if (!competencia) {
        continue;
      }
      const score = numericScore(record);
      const current = best.get(competencia);
      if (!isSaneScore(score)) {
        continue;
      }
      if (!current || score > current.score) {
        best.set(competencia, { record, score, filePath });
      }
    }
  }

  return best;
}

async function loadPostgresByCompetencia() {
  const result = await getPool().query(
    'SELECT competencia, payload, updated_at, updated_by FROM monthly_records',
  );
  const map = new Map();
  for (const row of result.rows) {
    map.set(row.competencia, {
      score: numericScore(row.payload || {}),
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    });
  }
  return map;
}

async function restoreEmptyMonths({ apply }) {
  const jsonByCompetencia = await loadBestJsonByCompetencia();
  const pgByCompetencia = await loadPostgresByCompetencia();
  const planned = [];

  for (const [competencia, jsonEntry] of jsonByCompetencia.entries()) {
    if (PROTECTED_COMPETENCIAS.has(competencia)) {
      console.log(`skip ${competencia}: protegido`);
      continue;
    }

    const pgEntry = pgByCompetencia.get(competencia);
    const pgScore = pgEntry ? pgEntry.score : 0;
    if (pgScore >= MIN_RESTORE_SCORE) {
      console.log(`skip ${competencia}: postgres ja tem dados (${pgScore.toFixed(2)})`);
      continue;
    }

    planned.push({ competencia, jsonEntry, pgScore });
  }

  if (planned.length === 0) {
    console.log('Nenhum mes vazio com dados recuperaveis.');
    return [];
  }

  for (const item of planned) {
    console.log(
      `${apply ? 'RESTORE' : 'DRY-RUN'} ${item.competencia}: postgres ${item.pgScore.toFixed(2)} <- json ${item.jsonEntry.score.toFixed(2)} (${item.jsonEntry.filePath})`,
    );
  }

  if (!apply) {
    return planned;
  }

  for (const item of planned) {
    const payload = { ...item.jsonEntry.record };
    const updatedAt = payload.updatedAt || new Date().toISOString();
    const updatedBy = payload.updatedBy || 'restore-json';
    delete payload.updatedAt;
    delete payload.updatedBy;

    await getPool().query(
      `UPDATE monthly_records
       SET payload = $2::jsonb, updated_at = $3, updated_by = $4
       WHERE competencia = $1
         AND length(payload::text) < 100000`,
      [item.competencia, JSON.stringify(payload), updatedAt, updatedBy],
    );
  }

  return planned;
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? 'Modo APPLY' : 'Modo DRY-RUN (passe --apply para gravar)');
  console.log('STORAGE', process.env.STORAGE_BACKEND);

  const planned = await restoreEmptyMonths({ apply });
  console.log(`itens=${planned.length}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
