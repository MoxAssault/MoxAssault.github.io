(() => {
  'use strict';

  const KEYS = Object.freeze({
    theme: 'vpxs-yml-theme',
    preferences: 'vpxs-yml-workspace-preferences-v2',
    draft: 'vpxs-yml-current-draft-v2',
    recent: 'vpxs-yml-recent-builds-v2'
  });

  function readText(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function writeText(key, value) {
    try {
      localStorage.setItem(key, String(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function readJson(key, fallback = null) {
    const raw = readText(key, null);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function writeJson(key, value) {
    try { return writeText(key, JSON.stringify(value)); } catch (_) { return false; }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  }

  window.VPS_STORAGE = Object.freeze({
    keys: KEYS,
    readText,
    writeText,
    readJson,
    writeJson,
    remove
  });
})();