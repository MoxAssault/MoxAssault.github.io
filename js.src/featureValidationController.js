(() => {
  'use strict';
  const runtime = window.VPS_FEATURE_RUNTIME;
  const utils = window.VPS_UTILS;
  if (!runtime || !utils) return;
  const { isMd5Hash, normalizeArray } = utils;

  function errors() {
    const output = [];
    const add = (stepId, fieldName, title, message) => output.push({ stepId, fieldName, title, message });
    const { selections, values } = runtime.state;

    if (selections?.altSoundFiles || values?.altSoundVPSId) {
      const checksums = normalizeArray(values?.altSoundChecksum);
      if (!checksums.length) {
        add('altSound', 'altSoundChecksum', 'Alt Sound Checksum is required', 'Add at least one valid MD5 value for the selected Alt Sound.');
      } else if (checksums.some(checksum => !isMd5Hash(checksum))) {
        add('altSound', 'altSoundChecksum', 'Alt Sound Checksum is invalid', 'Every Alt Sound checksum must contain exactly 32 hexadecimal characters.');
      }
    }

    const tutorialId = String(values?.tutorialVPSId || '').trim();
    if (tutorialId && !runtime.state.record?.tutorialFiles?.some(item => String(item?.id || '') === tutorialId)) {
      add('main', 'tutorialVPSId', 'Tutorial VPS ID is unavailable', 'Choose an available tutorial for this table.');
    }

    window.VPS_ADDITIONAL_ROMS?.entries?.().forEach((entry, index) => {
      window.VPS_ADDITIONAL_ROMS.validateEntry(entry, index).forEach(message => {
        add('rom', 'additionalRoms', `Additional ROM ${index + 1} needs attention`, message);
      });
    });
    return output;
  }

  function dot(wrapper, messages, extraClass = '') {
    if (!wrapper || !messages.length) return;
    wrapper.classList.add('has-field-error');
    wrapper.dataset.errorCount = String(messages.length);
    const marker = document.createElement('span');
    marker.className = `field-error-dot feature-error-dot${extraClass ? ` ${extraClass}` : ''}`;
    marker.dataset.tooltip = messages.join(' ');
    marker.setAttribute('role', 'img');
    marker.setAttribute('aria-label', messages.join(' '));
    marker.tabIndex = 0;
    wrapper.appendChild(marker);
  }

  function refresh() {
    document.querySelectorAll('.feature-error-dot').forEach(marker => {
      const wrapper = marker.parentElement;
      marker.remove();
      if (!wrapper?.querySelector('.field-error-dot')) {
        wrapper?.classList.remove('has-field-error');
        wrapper?.removeAttribute('data-error-count');
      }
    });
    document.querySelectorAll('.config-tab.feature-has-error').forEach(tab => {
      tab.classList.remove('feature-has-error', 'has-error');
      if (!tab.classList.contains('has-v090-error')) tab.querySelector('.config-tab-alert')?.remove();
    });

    const grouped = new Map();
    errors().forEach(error => {
      const key = `${error.stepId}:${error.fieldName}`;
      const messages = grouped.get(key) || [];
      if (!messages.includes(error.message)) messages.push(error.message);
      grouped.set(key, messages);
      const tab = document.getElementById(`config-tab-${error.stepId}`);
      if (tab) {
        tab.classList.add('has-error', 'feature-has-error');
        if (!tab.querySelector('.config-tab-alert')) {
          const alert = document.createElement('span');
          alert.className = 'config-tab-alert';
          alert.setAttribute('aria-hidden', 'true');
          tab.appendChild(alert);
        }
      }
    });

    grouped.forEach((messages, key) => {
      const fieldName = key.slice(key.indexOf(':') + 1);
      if (fieldName === 'additionalRoms') {
        dot(document.querySelector('.additional-rom-controls'), messages, 'additional-rom-error-dot');
      } else {
        dot(document.getElementById(`field-${fieldName}`)?.closest('.field'), messages);
      }
    });
  }

  function show(currentErrors) {
    const dialog = document.getElementById('validationDialog');
    const body = document.getElementById('validationBody');
    if (!dialog || !body) return;
    const list = document.createElement('ul');
    list.className = 'validation-list';
    currentErrors.forEach(error => {
      const item = document.createElement('li');
      item.className = 'validation-item error';
      const title = document.createElement('strong');
      title.textContent = error.title;
      const message = document.createElement('span');
      message.textContent = error.message;
      item.append(title, message);
      list.appendChild(item);
    });
    body.replaceChildren(list);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    refresh();
  }

  function init() {
    document.addEventListener('click', event => {
      const action = event.target instanceof Element
        ? event.target.closest('#validateBtn, #drawerCopyBtn, #downloadNextBtn')
        : null;
      if (!action) return;
      const current = errors();
      if (!current.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      show(current);
    }, true);
  }

  window.VPS_FEATURE_VALIDATION = Object.freeze({ errors, refresh, show });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
