const { getStorage } = require('./storage');

async function readUsersData() {
  return getStorage().readUsersData();
}

async function authenticate(username, password) {
  const { users = [] } = await readUsersData();
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');

  const user = users.find((entry) => (
    entry.active !== false
    && String(entry.username || '').trim().toLowerCase() === normalizedUsername
    && String(entry.password || '') === normalizedPassword
  ));

  if (!user) {
    return null;
  }

  return {
    username: user.username,
    role: user.role,
    displayName: user.displayName || user.username,
  };
}

module.exports = {
  authenticate,
  readUsersData,
};
