const { getStorage } = require('./storage');

async function createBackup() {
  const storage = getStorage();
  const data = await storage.readRecordsData();
  return storage.createBackupSnapshot(data);
}

module.exports = {
  createBackup,
};
