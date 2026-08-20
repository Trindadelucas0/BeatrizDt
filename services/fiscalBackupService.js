const { getStorage } = require('./storage');

async function createFiscalBackup() {
  const storage = getStorage();
  const data = await storage.readFiscalRecordsData();
  return storage.createFiscalBackupSnapshot(data);
}

module.exports = {
  createFiscalBackup,
};
