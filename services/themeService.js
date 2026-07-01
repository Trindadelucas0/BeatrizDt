const VALID_THEMES = ['dauto', 'claro', 'escuro'];

function normalizeTheme(value) {
  const theme = String(value || '').trim().toLowerCase();
  return VALID_THEMES.includes(theme) ? theme : 'dauto';
}

function getThemeFromRequest(req) {
  if (req.query?.theme) {
    return normalizeTheme(req.query.theme);
  }

  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)app-theme=([^;]+)/);

  if (match) {
    return normalizeTheme(decodeURIComponent(match[1]));
  }

  return 'dauto';
}

module.exports = {
  VALID_THEMES,
  normalizeTheme,
  getThemeFromRequest,
};
