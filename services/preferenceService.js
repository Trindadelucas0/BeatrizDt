const { getStorage } = require('./storage');
const { normalizeTheme } = require('./themeService');

const THEME_KEY = 'theme';

async function getUserTheme(username) {
  if (!username) {
    return null;
  }

  const storage = getStorage();
  if (typeof storage.getUserPreference !== 'function') {
    return null;
  }

  const value = await storage.getUserPreference(username, THEME_KEY);
  return value ? normalizeTheme(value) : null;
}

async function setUserTheme(username, theme) {
  if (!username) {
    return null;
  }

  const storage = getStorage();
  if (typeof storage.setUserPreference !== 'function') {
    return null;
  }

  const normalized = normalizeTheme(theme);
  await storage.setUserPreference(username, THEME_KEY, normalized);
  return normalized;
}

module.exports = {
  getUserTheme,
  setUserTheme,
};
