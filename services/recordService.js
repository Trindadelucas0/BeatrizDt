const { calculateRecord } = require('./calculationService');
const { createInitialRecord, migrateRecord } = require('./sheetSchemaService');
const { ensureYearCompetenciasInData, DEFAULT_SEED_YEAR } = require('./competenciaSeedService');
const { buildDiffSummary } = require('./versionHistoryService');
const { getStorage } = require('./storage');

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

async function readRecordsData() {
  return getStorage().readRecordsData();
}

async function writeRecordsData(data) {
  return getStorage().writeRecordsData(data);
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

async function appendRevision(nextRecord, previousRecord, updatedBy) {
  const storage = getStorage();
  const history = await storage.readHistory(nextRecord.competencia);
  const revision = {
    revision: (history.revisions?.length || 0) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy,
    competencia: nextRecord.competencia,
    summary: buildDiffSummary(previousRecord, nextRecord),
  };

  if (typeof storage.appendRevision === 'function') {
    await storage.appendRevision(nextRecord.competencia, revision);
    return revision;
  }

  history.competencia = nextRecord.competencia;
  history.revisions = [...(history.revisions || []), revision];
  await storage.writeHistory(nextRecord.competencia, history);
  return revision;
}

async function saveRecord(record, updatedBy, options = {}) {
  const data = await readRecordsData();
  const existingIndex = (data.records || []).findIndex((entry) => entry.competencia === record.competencia);
  const previousRecord = existingIndex >= 0 ? data.records[existingIndex] : null;

  if (!options.skipBackup) {
    const { createBackup } = require('./backupService');
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
  listCompetencias,
  listRecords,
  prepareRecord,
  saveRecord,
};
