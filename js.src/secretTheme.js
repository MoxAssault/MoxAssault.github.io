(() => {
  'use strict';

  const THEME_KEY = 'vpxs-yml-theme';
  const RETURN_KEY = 'vpxs-yml-secret-theme-return';
  const SECRET_THEME = 'pink';

  function readStored(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function writeStored(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* Storage is optional. */ }
  }

  function normalTheme(value) {
    return value === 'light' || value === 'dark' ? value : 'dark';
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
    if (persist) writeStored(THEME_KEY, theme);
    updateToggle(theme);
  }

  function enterSecretTheme() {
    const current = normalTheme(document.documentElement.dataset.theme);
    writeStored(RETURN_KEY, current);
    applyTheme(SECRET_THEME);
  }

  function leaveSecretTheme() {
    const previous = normalTheme(readStored(RETURN_KEY));
    applyTheme(previous);

    const toggle = document.getElementById('themeToggle');
    const knob = document.getElementById('themeKnob');
    if (!toggle || !knob) return;

    knob.textContent = previous === 'light' ? '☀️' : '🌙';
    toggle.setAttribute('aria-pressed', previous === 'light' ? 'true' : 'false');
    toggle.setAttribute('aria-label', `Switch to ${previous === 'dark' ? 'light' : 'dark'} theme`);
  }

  function handleSecretActivation(event) {
    if (!event.ctrlKey) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (document.documentElement.dataset.theme === SECRET_THEME) leaveSecretTheme();
    else enterSecretTheme();
  }

  function init() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    toggle.addEventListener('click', handleSecretActivation, true);
    toggle.addEventListener('keydown', event => {
      if (!event.ctrlKey || (event.key !== 'Enter' && event.key !== ' ')) return;
      handleSecretActivation(event);
    }, true);

    if (readStored(THEME_KEY) === SECRET_THEME) {
      applyTheme(SECRET_THEME, false);
    }
  }

  if (readStored(THEME_KEY) === SECRET_THEME) {
    document.documentElement.dataset.theme = SECRET_THEME;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
