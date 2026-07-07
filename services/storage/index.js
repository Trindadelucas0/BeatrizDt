function useJsonStorage() {
  return process.env.STORAGE_BACKEND === 'json';
}

function getStorage() {
  return useJsonStorage()
    ? require('./json')
    : require('./postgres');
}

module.exports = {
  getStorage,
  useJsonStorage,
};
