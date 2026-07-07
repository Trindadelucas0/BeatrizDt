(function bootstrapTheme() {
  const STORAGE_KEY = 'app-theme';
  const COOKIE_NAME = 'app-theme';
  const THEMES = ['dauto', 'claro', 'escuro'];
  const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

  function normalizeTheme(value) {
    const theme = String(value || '').trim().toLowerCase();
    return THEMES.includes(theme) ? theme : 'dauto';
  }

  function readCookieTheme() {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : '';
  }

  function writeCookie(theme) {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(theme)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }

  function getTheme() {
    try {
      return normalizeTheme(localStorage.getItem(STORAGE_KEY) || readCookieTheme() || 'dauto');
    } catch {
      return 'dauto';
    }
  }

  function setTheme(themeId) {
    const theme = normalizeTheme(themeId);
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }

    writeCookie(theme);

    document.querySelectorAll('.js-theme-select').forEach((select) => {
      if (select.value !== theme) {
        select.value = theme;
      }
    });

    fetch('/api/user/preferences/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme }),
    }).catch(() => {
      // usuario nao logado ou offline
    });
  }

  function bindThemeSwitcher() {
    document.querySelectorAll('.js-theme-select').forEach((select) => {
      select.value = getTheme();
      select.addEventListener('change', () => {
        setTheme(select.value);
      });
    });
  }

  window.AppTheme = {
    THEMES,
    getTheme,
    setTheme,
  };

  setTheme(getTheme());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindThemeSwitcher);
  } else {
    bindThemeSwitcher();
  }
}());
