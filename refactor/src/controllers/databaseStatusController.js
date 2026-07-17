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
  const WARNING_STATES = new Set(['cached-unverified', 'network-unverified', 'stale-fallback', 'error']);
  const DISPLAY_MS = 4600;
  const WARNING_DISPLAY_MS = 6200;
  const MAX_LOADING_DISPLAY_MS = 10000;
  const EXIT_MS = 320;
  const CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000;

  let toast = null;
  let title = null;
  let message = null;
  let hideTimer = 0;
  let removeTimer = 0;
  let periodicTimer = 0;
  let activeRequest = null;
  let lastCheckAt = 0;
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
    hideTimer = 0;
    removeTimer = 0;
    if (!toast || toast.hidden) return;

    toast.classList.remove('is-visible');
    removeTimer = window.setTimeout(() => {
      if (toast) toast.hidden = true;
      removeTimer = 0;
    }, EXIT_MS);
  }

  function displayCopy(status) {
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
          message: versionLabel ? `Now using version ${versionLabel}.` : 'The newest data is now in use.'
        };
      case 'current':
        return {
          title: 'VPS database is current',
          message: versionLabel ? `Using version ${versionLabel}.` : 'The newest data is already in use.'
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

    const copy = displayCopy(status);
    if (!copy) return;
    ensureToast();
    window.clearTimeout(hideTimer);
    window.clearTimeout(removeTimer);

    toast.dataset.state = status.state;
    title.textContent = copy.title;
    message.textContent = copy.message;
    toast.hidden = false;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => toast?.classList.add('is-visible'));
    });

    const displayTime = LOADING_STATES.has(status.state)
      ? MAX_LOADING_DISPLAY_MS
      : WARNING_STATES.has(status.state)
        ? WARNING_DISPLAY_MS
        : DISPLAY_MS;
    hideTimer = window.setTimeout(hideToast, displayTime);
  }

  function emitStatus(state, details = {}) {
    const original = originalGetVPSDBStatus ? originalGetVPSDBStatus() : {};
    const status = {
      ...original,
      ...(latestStatus || {}),
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
    if (!originalFetchVPSDB) throw new Error('VPS database loader is unavailable.');
    if (activeRequest) return activeRequest;

    activeRequest = (async () => {
      const data = await originalFetchVPSDB(options);
      if (!Array.isArray(data)) return data;
      if (!sharedDatabase) sharedDatabase = data;
      else if (data !== sharedDatabase) sharedDatabase.splice(0, sharedDatabase.length, ...data);
      return sharedDatabase;
    })();

    try {
      return await activeRequest;
    } finally {
      activeRequest = null;
    }
  }

  if (originalFetchVPSDB) window.fetchVPSDB = stableFetchVPSDB;

  window.getVPSDBStatus = () => ({
    ...(originalGetVPSDBStatus ? originalGetVPSDBStatus() : {}),
    ...(latestStatus || {})
  });

  function scheduleNextCheck() {
    window.clearTimeout(periodicTimer);
    periodicTimer = window.setTimeout(() => runCheck({ forceRefresh: true }), CHECK_INTERVAL_MS);
  }

  async function runCheck(options = {}) {
    if (Array.isArray(window.__VPS_DB_OVERRIDE__)) {
      const override = window.__VPS_DB_OVERRIDE__;
      sharedDatabase = override;
      emitStatus('current', {
        version: 'override',
        message: 'Using the configured VPS database override.'
      });
      scheduleNextCheck();
      return override;
    }

    emitStatus(options.forceRefresh ? 'updating' : 'checking', {
      message: options.forceRefresh
        ? 'Refreshing the VPS database…'
        : 'Checking the latest VPS database version…'
    });

    try {
      const data = await stableFetchVPSDB({ forceRefresh: options.forceRefresh === true });
      const status = window.getVPSDBStatus();
      if (!status.state || LOADING_STATES.has(status.state) || status.state === 'idle') {
        emitStatus(options.forceRefresh ? 'updated' : 'current', {
          version: status.version || null,
          message: 'The VPS database is ready.'
        });
      }
      return data;
    } catch (error) {
      const hasCachedData = Array.isArray(sharedDatabase) && sharedDatabase.length > 0;
      emitStatus(hasCachedData ? 'cached-unverified' : 'error', {
        message: error?.message || 'The VPS database could not be loaded.'
      });
      if (!hasCachedData) throw error;
      return sharedDatabase;
    } finally {
      lastCheckAt = Date.now();
      scheduleNextCheck();
    }
  }

  function start() {
    ensureToast();
    runCheck({ forceRefresh: false }).catch(error => {
      console.warn('Initial VPS database check failed', error);
    });
  }

  window.addEventListener('vpsdbstatus', event => {
    latestStatus = { ...event.detail };
    showToast(event.detail);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !lastCheckAt) return;
    if (Date.now() - lastCheckAt >= CHECK_INTERVAL_MS) {
      runCheck({ forceRefresh: true }).catch(error => {
        console.warn('Scheduled VPS database check failed', error);
      });
    }
  });

  window.checkVPSDBNow = () => runCheck({ forceRefresh: true });

  showToast({
    state: 'checking',
    version: null,
    checkedAt: new Date().toISOString(),
    message: 'Checking the latest VPS database version…'
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();