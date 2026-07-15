(() => {
  'use strict';

  const VISIBLE_STATES = new Set(['current', 'updated']);
  const DISPLAY_MS = 4600;
  const EXIT_MS = 320;

  let toast = null;
  let title = null;
  let message = null;
  let hideTimer = null;
  let removeTimer = null;
  let lastSignature = '';

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

    if (!toast || toast.hidden) return;

    toast.classList.remove('is-visible');
    removeTimer = window.setTimeout(() => {
      if (toast) toast.hidden = true;
    }, EXIT_MS);
  }

  function showToast(status) {
    if (!status || !VISIBLE_STATES.has(status.state)) return;

    const signature = `${status.state}:${status.version || ''}`;
    if (signature === lastSignature) return;
    lastSignature = signature;

    ensureToast();
    window.clearTimeout(hideTimer);
    window.clearTimeout(removeTimer);

    const versionLabel = formatVersion(status.version);
    const wasUpdated = status.state === 'updated';

    toast.dataset.state = status.state;
    title.textContent = wasUpdated
      ? 'VPS database updated'
      : 'VPS database is current';
    message.textContent = versionLabel
      ? `${wasUpdated ? 'Now using' : 'Using'} version ${versionLabel}.`
      : (wasUpdated ? 'The newest data is now in use.' : 'The newest data is already in use.');

    toast.hidden = false;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => toast.classList.add('is-visible'));
    });

    hideTimer = window.setTimeout(hideToast, DISPLAY_MS);
  }

  window.addEventListener('vpsdbstatus', event => showToast(event.detail));

  function checkExistingStatus() {
    const status = typeof window.getVPSDBStatus === 'function'
      ? window.getVPSDBStatus()
      : window.__VPS_DB_STATUS__;
    showToast(status);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkExistingStatus, { once: true });
  } else {
    checkExistingStatus();
  }
})();
