(() => {
  'use strict';

  const VISIBLE_STATES = new Set([
    'checking',
    'updating',
    'current',
    'updated',
    'cached-unverified',
    'network-unverified',
    'stale-fallback',
    'error'
  ]);
  const LOADING_STATES = new Set(['checking', 'updating']);
  const DISPLAY_MS = 4600;
  const WARNING_DISPLAY_MS = 6200;
  const EXIT_MS = 320;
  const CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000;
  const VERSION_URL = 'https://virtualpinballspreadsheet.github.io/vps-db/lastUpdated.json';
  const REQUEST_TIMEOUT_MS = 20000;

  let toast = null;
  let title = null;
  let message = null;
  let hideTimer = null;
  let removeTimer = null;
  let periodicTimer = null;
  let periodicRequest = null;
  let lastPeriodicCheckAt = 0;
  let lastSignature = '';
  let latestStatus = null;
  let sharedDatabase = null;

  const originalFetchVPSDB = typeof window.fetchVPSDB === 'function'
    ? window.fetchVPSDB.bind(window)
    : null;
  const originalGetVPSDBStatus = typeof window.getVPSDBStatus === 'function'
    ? window.getVPSDBStatus.bind(window)
    : null;

  function formatVersion(version) {
    if (version === null || version === undefined || version === '') return '';

    const numericVersion = Number(version);
    if (Number.isFinite(numericVersion) && numericVersion > 100000000000) {
      const date = new Date(numericVersion);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
      }
    }

    return String(version);
  }

  function normalizeVersion(payload) {
    let value = payload;

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      value = payload.lastUpdated ?? payload.updatedAt ?? payload.timestamp ?? payload.version;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(Math.trunc(value));
    }

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    throw new Error('Unexpected lastUpdated.json format');
  }

  function ensureToast() {
    if (toast?.isConnected) return toast;

    toast = document.createElement('div');
    toast.id = 'vpsDbToast';
    toast.className = 'vps-db-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    toast.hidden = true;

    const indicator = document.createElement('span');
    indicator.className = 'vps-db-toast-indicator';
    indicator.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('div');
    copy.className = 'vps-db-toast-copy';

    title = document.createElement('strong');
    title.className = 'vps-db-toast-title';

    message = document.createElement('span');
    message.className = 'vps-db-toast-message';

    const closeButton = document.createElement('button');
    closeButton.className = 'vps-db-toast-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Dismiss database status');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', hideToast);

    copy.append(title, message);
    toast.append(indicator, copy, closeButton);
    document.body.appendChild(toast);

    return toast;
  }

  function hideToast() {
    window.clearTimeout(hideTimer);
    window.clearTimeout(removeTimer);

    if (!toast || toast.hidden) return;

    toast.classList.remove('is-visible');
    removeTimer = window.setTimeout(() => {
      if (toast) toast.hidden = true;
    }, EXIT_MS);
  }

  function getDisplayCopy(status) {
    const versionLabel = formatVersion(status.version);

    switch (status.state) {
      case 'checking':
        return {
          title: 'Checking VPS database',
          message: 'Comparing your data with the latest published version…'
        };
      case 'updating':
        return {
          title: 'Updating VPS database',
          message: 'Downloading and verifying the newest data…'
        };
      case 'updated':
        return {
          title: 'VPS database updated',
          message: versionLabel
            ? `Now using version ${versionLabel}.`
            : 'The newest data is now in use.'
        };
      case 'current':
        return {
          title: 'VPS database is current',
          message: versionLabel
            ? `Using version ${versionLabel}.`
            : 'The newest data is already in use.'
        };
      case 'cached-unverified':
      case 'stale-fallback':
        return {
          title: 'Using cached VPS database',
          message: 'The update check failed, so the last verified version remains active.'
        };
      case 'network-unverified':
        return {
          title: 'VPS database loaded',
          message: 'The data loaded, but its published version could not be verified.'
        };
      case 'error':
        return {
          title: 'VPS database unavailable',
          message: status.message || 'The database could not be loaded.'
        };
      default:
        return null;
    }
  }

  function showToast(status) {
    if (!status || !VISIBLE_STATES.has(status.state)) return;

    const signature = `${status.state}:${status.version || ''}:${status.checkedAt || ''}`;
    if (signature === lastSignature) return;
    lastSignature = signature;
    latestStatus = { ...status };
    window.__VPS_DB_STATUS__ = { ...latestStatus };

    const copy = getDisplayCopy(status);
    if (!copy) return;

    ensureToast();
    window.clearTimeout(hideTimer);
    window.clearTimeout(removeTimer);

    toast.dataset.state = status.state;
    title.textContent = copy.title;
    message.textContent = copy.message;

    toast.hidden = false;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => toast.classList.add('is-visible'));
    });

    if (!LOADING_STATES.has(status.state)) {
      const displayTime = ['cached-unverified', 'network-unverified', 'stale-fallback', 'error']
        .includes(status.state)
        ? WARNING_DISPLAY_MS
        : DISPLAY_MS;
      hideTimer = window.setTimeout(hideToast, displayTime);
    }
  }

  function emitLocalStatus(state, details = {}) {
    const baseStatus = latestStatus
      || (originalGetVPSDBStatus ? originalGetVPSDBStatus() : window.__VPS_DB_STATUS__)
      || {};
    const status = {
      ...baseStatus,
      ...details,
      state,
      checkedAt: details.checkedAt || new Date().toISOString()
    };

    latestStatus = status;
    window.__VPS_DB_STATUS__ = { ...status };
    window.dispatchEvent(new CustomEvent('vpsdbstatus', { detail: { ...status } }));
    return status;
  }

  async function stableFetchVPSDB(options = {}) {
    if (!originalFetchVPSDB) {
      throw new Error('VPS database loader is unavailable.');
    }

    const data = await originalFetchVPSDB(options);
    if (!Array.isArray(data)) return data;

    if (!sharedDatabase) {
      sharedDatabase = data;
      return sharedDatabase;
    }

    if (data !== sharedDatabase) {
      sharedDatabase.splice(0, sharedDatabase.length, ...data);
    }

    return sharedDatabase;
  }

  if (originalFetchVPSDB) {
    window.fetchVPSDB = stableFetchVPSDB;
  }

  window.getVPSDBStatus = () => ({
    ...(originalGetVPSDBStatus ? originalGetVPSDBStatus() : {}),
    ...(latestStatus || {})
  });

  async function fetchLatestVersion() {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const separator = VERSION_URL.includes('?') ? '&' : '?';
    const url = `${VERSION_URL}${separator}_=${Date.now()}`;

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return normalizeVersion(await response.json());
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function schedulePeriodicCheck() {
    window.clearTimeout(periodicTimer);
    periodicTimer = window.setTimeout(runPeriodicCheck, CHECK_INTERVAL_MS);
  }

  async function runPeriodicCheck() {
    if (periodicRequest) return periodicRequest;

    periodicRequest = (async () => {
      const knownStatus = window.getVPSDBStatus();
      const knownVersion = knownStatus.version ? String(knownStatus.version) : '';

      emitLocalStatus('checking', {
        version: knownVersion || null,
        message: 'Checking the latest VPS database version…'
      });

      try {
        const latestVersion = await fetchLatestVersion();

        if (knownVersion && latestVersion === knownVersion) {
          emitLocalStatus('current', {
            version: latestVersion,
            message: 'The cached VPS database matches the latest published version.'
          });
          return sharedDatabase;
        }

        return await stableFetchVPSDB({ forceRefresh: true });
      } catch (error) {
        console.warn('Scheduled VPS database check failed', error);
        emitLocalStatus('cached-unverified', {
          version: knownVersion || null,
          message: 'Version check failed; using the last verified cached VPS database.'
        });
        return sharedDatabase;
      } finally {
        lastPeriodicCheckAt = Date.now();
        periodicRequest = null;
        schedulePeriodicCheck();
      }
    })();

    return periodicRequest;
  }

  function startPeriodicChecks() {
    if (Array.isArray(window.__VPS_DB_OVERRIDE__)) return;
    lastPeriodicCheckAt = Date.now();
    schedulePeriodicCheck();
  }

  window.addEventListener('vpsdbstatus', event => {
    latestStatus = { ...event.detail };
    showToast(event.detail);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !lastPeriodicCheckAt) return;
    if (Date.now() - lastPeriodicCheckAt >= CHECK_INTERVAL_MS) {
      runPeriodicCheck();
    }
  });

  window.checkVPSDBNow = runPeriodicCheck;

  // The script is loaded at the end of <body>, so the toast can appear immediately.
  showToast({
    state: 'checking',
    version: null,
    checkedAt: new Date().toISOString(),
    message: 'Checking the latest VPS database version…'
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPeriodicChecks, { once: true });
  } else {
    startPeriodicChecks();
  }
})();