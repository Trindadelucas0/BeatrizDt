const fs = require('node:fs/promises');
const path = require('node:path');

function getUsersFilePath() {
  return process.env.USERS_FILE || path.join(process.cwd(), 'data', 'users.json');
}

async function readUsersData() {
  const filePath = getUsersFilePath();
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
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
  getUsersFilePath,
  readUsersData,
};
