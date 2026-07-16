(() => {
  'use strict';

  const THEME_STORAGE_KEY = 'vpxs-yml-theme';
  const RETURN_THEME_STORAGE_KEY = 'vpxs-yml-secret-theme-return';
  const SECRET_THEME = 'pink';

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {
      // Theme persistence is optional when storage is unavailable.
    }
  }

  function normalizeStandardTheme(theme) {
    return theme === 'light' || theme === 'dark' ? theme : 'dark';
  }

  function updateToggle(theme) {
    const toggle = document.getElementById('themeToggle');
    const knob = document.getElementById('themeKnob');
    if (!toggle || !knob) return;

    if (theme === SECRET_THEME) {
      knob.textContent = '🌸';
      toggle.setAttribute('aria-pressed', 'mixed');
      toggle.setAttribute('aria-label', 'Alternate pink theme active. Control-click to return to the previous theme.');
      toggle.dataset.secretTheme = 'active';
      return;
    }

    delete toggle.dataset.secretTheme;
  }

  function applyTheme(theme, persist = true) {
    document.documentElement.dataset.theme = theme;
    if (persist) writeStorage(THEME_STORAGE_KEY, theme);
    updateToggle(theme);
  }

  function enterSecretTheme() {
    const currentTheme = normalizeStandardTheme(document.documentElement.dataset.theme);
    writeStorage(RETURN_THEME_STORAGE_KEY, currentTheme);
    applyTheme(SECRET_THEME);
  }

  function leaveSecretTheme() {
    const previousTheme = normalizeStandardTheme(readStorage(RETURN_THEME_STORAGE_KEY));
    applyTheme(previousTheme);

    const toggle = document.getElementById('themeToggle');
    const knob = document.getElementById('themeKnob');
    if (!toggle || !knob) return;

    knob.textContent = previousTheme === 'light' ? '☀️' : '🌙';
    toggle.setAttribute('aria-pressed', previousTheme === 'light' ? 'true' : 'false');
    toggle.setAttribute('aria-label', `Switch to ${previousTheme === 'dark' ? 'light' : 'dark'} theme`);
  }

  function handleSecretThemeActivation(event) {
    if (!event.ctrlKey) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (document.documentElement.dataset.theme === SECRET_THEME) leaveSecretTheme();
    else enterSecretTheme();
  }

  function initializeThemeController() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    toggle.addEventListener('click', handleSecretThemeActivation, true);
    toggle.addEventListener('keydown', event => {
      if (!event.ctrlKey || (event.key !== 'Enter' && event.key !== ' ')) return;
      handleSecretThemeActivation(event);
    }, true);

    if (readStorage(THEME_STORAGE_KEY) === SECRET_THEME) {
      applyTheme(SECRET_THEME, false);
    }
  }

  if (readStorage(THEME_STORAGE_KEY) === SECRET_THEME) {
    document.documentElement.dataset.theme = SECRET_THEME;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeThemeController, { once: true });
  } else {
    initializeThemeController();
  }
})();
