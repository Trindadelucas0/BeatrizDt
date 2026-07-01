const fs = require('node:fs/promises');
const path = require('node:path');

function getRecordsFilePath() {
  return process.env.RECORDS_FILE || path.join(process.cwd(), 'data', 'monthly-records.json');
}

function getBackupDir() {
  return process.env.BACKUP_DIR || path.join(process.cwd(), 'data', 'backups');
}

async function createBackup() {
  const recordsPath = getRecordsFilePath();
  const backupDir = getBackupDir();

  await fs.mkdir(backupDir, { recursive: true });

  try {
    await fs.access(recordsPath);
  } catch (error) {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `monthly-records-${timestamp}.json`);
  await fs.copyFile(recordsPath, backupPath);

  return backupPath;
}

module.exports = {
  createBackup,
  getBackupDir,
};
