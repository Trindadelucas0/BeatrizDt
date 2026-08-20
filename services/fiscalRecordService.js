const { calculateFiscalRecord } = require('./fiscalCalculationService');
const { createInitialFiscalRecord, migrateFiscalRecord } = require('./fiscalSheetSchemaService');
const { ensureFiscalYearCompetenciasInData } = require('./fiscalCompetenciaSeedService');
const { DEFAULT_SEED_YEAR } = require('./competenciaSeedService');
const { buildFiscalDiffSummary } = require('./fiscalVersionHistoryService');
const { getStorage } = require('./storage');

function sortCompetencias(records) {
  return [...records].sort((a, b) => {
    const [monthA, yearA] = String(a.competencia || '00/0000').split('/').map(Number);
    const [monthB, yearB] = String(b.competencia || '00/0000').split('/').map(Number);
    return (yearB * 100 + monthB) - (yearA * 100 + monthA);
  });
}

function prepareFiscalRecord(record) {
  return calculateFiscalRecord(migrateFiscalRecord(record));
}

async function readFiscalRecordsData() {
  return getStorage().readFiscalRecordsData();
}

async function writeFiscalRecordsData(data) {
  return getStorage().writeFiscalRecordsData(data);
}

async function ensureFiscalYearCompetencias(year = DEFAULT_SEED_YEAR) {
  const data = await readFiscalRecordsData();
  const { records, created } = ensureFiscalYearCompetenciasInData(data, year);

  if (created > 0) {
    data.records = sortCompetencias(records);
    await writeFiscalRecordsData(data);
  }

  return created;
}

async function listFiscalRecords() {
  await ensureFiscalYearCompetencias(DEFAULT_SEED_YEAR);
  const data = await readFiscalRecordsData();
  return sortCompetencias((data.records || []).map(prepareFiscalRecord));
}

async function getFiscalRecordByCompetencia(competencia) {
  await ensureFiscalYearCompetencias(DEFAULT_SEED_YEAR);
  const data = await readFiscalRecordsData();
  const record = (data.records || []).find((entry) => entry.competencia === competencia);
  return record ? prepareFiscalRecord(record) : null;
}

async function getLatestFiscalRecord() {
  const records = await listFiscalRecords();
  const preferred = records.find((entry) => entry.competencia === '07/2026');
  const latest = preferred || records[0] || createInitialFiscalRecord();
  return prepareFiscalRecord(latest);
}

async function appendFiscalRevision(nextRecord, previousRecord, updatedBy) {
  const storage = getStorage();
  const history = await storage.readFiscalHistory(nextRecord.competencia);
  const revision = {
    revision: (history.revisions?.length || 0) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy,
    competencia: nextRecord.competencia,
    summary: buildFiscalDiffSummary(previousRecord, nextRecord),
  };

  if (typeof storage.appendFiscalRevision === 'function') {
    await storage.appendFiscalRevision(nextRecord.competencia, revision);
    return revision;
  }

  history.competencia = nextRecord.competencia;
  history.revisions = [...(history.revisions || []), revision];
  await storage.writeFiscalHistory(nextRecord.competencia, history);
  return revision;
}

async function saveFiscalRecord(record, updatedBy, options = {}) {
  const data = await readFiscalRecordsData();
  const existingIndex = (data.records || []).findIndex((entry) => entry.competencia === record.competencia);
  const previousRecord = existingIndex >= 0 ? data.records[existingIndex] : null;

  if (!options.skipBackup) {
    const { createFiscalBackup } = require('./fiscalBackupService');
    await createFiscalBackup();
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
  await writeFiscalRecordsData(data);

  if (!options.skipHistory) {
    await appendFiscalRevision(nextRecord, previousRecord, updatedBy);
  }

  return prepareFiscalRecord(nextRecord);
}

module.exports = {
  ensureFiscalYearCompetencias,
  getFiscalRecordByCompetencia,
  getLatestFiscalRecord,
  listFiscalRecords,
  prepareFiscalRecord,
  saveFiscalRecord,
};
