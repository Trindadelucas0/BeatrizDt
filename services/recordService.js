const fs = require('node:fs/promises');
const path = require('node:path');
const { calculateRecord } = require('./calculationService');
const { createInitialRecord, migrateRecord } = require('./sheetSchemaService');
const { ensureYearCompetenciasInData, DEFAULT_SEED_YEAR } = require('./competenciaSeedService');
const { createBackup } = require('./backupService');
const { appendRevision } = require('./versionHistoryService');

function getRecordsFilePath() {
  return process.env.RECORDS_FILE || path.join(process.cwd(), 'data', 'monthly-records.json');
}

async function ensureRecordsFile() {
  const filePath = getRecordsFilePath();

  try {
    await fs.access(filePath);
  } catch (error) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const initialData = {
      records: [
        {
          ...createInitialRecord(),
          updatedAt: new Date().toISOString(),
          updatedBy: 'sistema',
        },
      ],
    };
    await fs.writeFile(filePath, JSON.stringify(initialData, null, 2), 'utf-8');
  }

  return filePath;
}

async function readRecordsData() {
  const filePath = await ensureRecordsFile();
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function writeRecordsData(data) {
  const filePath = await ensureRecordsFile();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function sortCompetencias(records) {
  return [...records].sort((a, b) => {
    const [monthA, yearA] = String(a.competencia || '00/0000').split('/').map(Number);
    const [monthB, yearB] = String(b.competencia || '00/0000').split('/').map(Number);
    return (yearB * 100 + monthB) - (yearA * 100 + monthA);
  });
}

function prepareRecord(record) {
  return calculateRecord(migrateRecord(record));
}

async function ensureYearCompetencias(year = DEFAULT_SEED_YEAR) {
  const data = await readRecordsData();
  const { records, created } = ensureYearCompetenciasInData(data, year);

  if (created > 0) {
    data.records = sortCompetencias(records);
    await writeRecordsData(data);
  }

  return created;
}

async function listRecords() {
  await ensureYearCompetencias(DEFAULT_SEED_YEAR);
  const data = await readRecordsData();
  return sortCompetencias((data.records || []).map(prepareRecord));
}

async function listCompetencias() {
  const records = await listRecords();
  return records.map((record) => record.competencia);
}

async function getRecordByCompetencia(competencia) {
  await ensureYearCompetencias(DEFAULT_SEED_YEAR);
  const data = await readRecordsData();
  const record = (data.records || []).find((entry) => entry.competencia === competencia);
  return record ? prepareRecord(record) : null;
}

async function getLatestRecord() {
  const records = await listRecords();
  const latest = records[0] || createInitialRecord();
  return prepareRecord(latest);
}

async function saveRecord(record, updatedBy, options = {}) {
  const data = await readRecordsData();
  const existingIndex = (data.records || []).findIndex((entry) => entry.competencia === record.competencia);
  const previousRecord = existingIndex >= 0 ? data.records[existingIndex] : null;

  if (!options.skipBackup) {
    await createBackup();
  }

  const nextRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  if (existingIndex >= 0) {
    data.records[existingIndex] = nextRecord;
  } else {
    data.records = [...(data.records || []), nextRecord];
  }

  data.records = sortCompetencias(data.records);
  await writeRecordsData(data);

  if (!options.skipHistory) {
    await appendRevision(nextRecord, previousRecord, updatedBy);
  }

  return prepareRecord(nextRecord);
}

module.exports = {
  ensureYearCompetencias,
  getLatestRecord,
  getRecordByCompetencia,
  getRecordsFilePath,
  listCompetencias,
  listRecords,
  prepareRecord,
  saveRecord,
};
