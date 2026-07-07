const fs = require('node:fs/promises');
const path = require('node:path');
const { toCompetenciaSlug } = require('../../calculationService');

function getUsersFilePath() {
  return process.env.USERS_FILE || path.join(process.cwd(), 'data', 'users.json');
}

function getRecordsFilePath() {
  return process.env.RECORDS_FILE || path.join(process.cwd(), 'data', 'monthly-records.json');
}

function getHistoryDir() {
  return process.env.HISTORY_DIR || path.join(process.cwd(), 'data', 'history');
}

async function ensureRecordsFile() {
  const filePath = getRecordsFilePath();

  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ records: [] }, null, 2), 'utf-8');
  }

  return filePath;
}

async function readUsersData() {
  const filePath = getUsersFilePath();
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
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

async function createBackupSnapshot(snapshot) {
  const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'data', 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `monthly-records-${timestamp}.json`);
  await fs.writeFile(backupPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  return backupPath;
}

async function readHistory(competencia) {
  const historyPath = path.join(getHistoryDir(), `${toCompetenciaSlug(competencia)}.json`);

  try {
    const raw = await fs.readFile(historyPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { competencia, revisions: [] };
  }
}

async function writeHistory(competencia, history) {
  const historyDir = getHistoryDir();
  await fs.mkdir(historyDir, { recursive: true });
  const historyPath = path.join(historyDir, `${toCompetenciaSlug(competencia)}.json`);
  await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');
}

async function getAssetBuffer() {
  return null;
}

async function getUserPreference() {
  return null;
}

async function setUserPreference() {
  return null;
}

module.exports = {
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
