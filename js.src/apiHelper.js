(() => {
  'use strict';

  const API_URLS = [
    'https://cdn.jsdelivr.net/gh/VirtualPinballSpreadsheet/vps-db@master/db/vpsdb.json',
    'https://raw.githubusercontent.com/VirtualPinballSpreadsheet/vps-db/master/db/vpsdb.json'
  ];

  let vpsCache = null;
  let pendingRequest = null;

  async function fetchJsonWithTimeout(url, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'default',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Unexpected VPS database format');
      }
      return data;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function loadVPSDB() {
    if (Array.isArray(window.__VPS_DB_OVERRIDE__)) {
      return window.__VPS_DB_OVERRIDE__;
    }

    const failures = [];
    for (const url of API_URLS) {
      try {
        return await fetchJsonWithTimeout(url);
      } catch (error) {
        failures.push(`${url}: ${error.message}`);
        console.warn(`Failed to fetch VPS DB from ${url}`, error);
      }
    }

    throw new Error(`Failed to load the VPS database. ${failures.join(' | ')}`);
  }

  async function fetchVPSDB({ forceRefresh = false } = {}) {
    if (forceRefresh) {
      vpsCache = null;
      pendingRequest = null;
    }
    if (vpsCache) return vpsCache;
    if (pendingRequest) return pendingRequest;

    pendingRequest = loadVPSDB()
      .then(data => {
        vpsCache = data;
        return data;
      })
      .finally(() => {
        pendingRequest = null;
      });

    return pendingRequest;
  }

  window.fetchVPSDB = fetchVPSDB;
})();
