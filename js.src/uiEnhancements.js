(() => {
  'use strict';

  const UI = window.VPS_UI;
  if (!UI) return;

  const originalRenderTableStrip = UI.renderTableStrip.bind(UI);
  const originalRenderAssetMatrix = UI.renderAssetMatrix.bind(UI);
  const originalRenderAccordions = UI.renderAccordions.bind(UI);
  const STATUS_KEYS = ['green', 'yellow', 'orange', 'red', 'neutral'];
  const PRIORITY = { neutral: 0, green: 1, yellow: 2, orange: 3, red: 4 };

  let accordionContext = null;
  let refreshFrame = 0;

  function queueStatusRefresh() {
    if (refreshFrame) return;
    refreshFrame = window.requestAnimationFrame(() => {
      refreshFrame = 0;
      decorateCurrentFields();
      updatePreviewStatus();
    });
  }

  function containTableCover(container) {
    const cover = container?.querySelector('.table-cover');
    const image = cover?.querySelector(':scope > .table-cover-image');
    if (!cover || !image || cover.querySelector(':scope > .table-cover-frame')) return;

    const frame = document.createElement('span');
    frame.className = 'table-cover-frame';
    cover.insertBefore(frame, image);
    frame.appendChild(image);
  }

  function hasText(value) {
    return typeof value === 'string'
      ? value.trim().length > 0
      : value !== undefined && value !== null;
  }

  function normalizeNames(value) {
    if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
    return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
  }

  function isMd5(value) {
    return /^[a-f0-9]{32}$/i.test(String(value || '').trim());
  }

  function getFieldErrors(step, values, callbacks) {
    const errors = new Map();
    const add = (fieldName, message) => {
      if (!fieldName || !message) return;
      const messages = errors.get(fieldName) || [];
      if (!messages.includes(message)) messages.push(message);
      errors.set(fieldName, messages);
    };
    const validateChecksum = (fieldName, label, { required = false } = {}) => {
      const value = String(values[fieldName] || '').trim();
      if (required && !value) add(fieldName, `${label} is required.`);
      else if (value && !isMd5(value)) add(fieldName, `${label} must be a 32-character MD5 value.`);
    };

    if (!step || callbacks?.isEnabled?.(step) === false) return errors;

    switch (step.id) {
      case 'main': {
        if (!hasText(values.tableVPSId)) add('tableVPSId', 'Table VPS ID is required.');
        const fps = String(values.fps ?? '').trim();
        if (!fps) add('fps', 'FPS is required.');
        else if (!/^\d+$/.test(fps)) add('fps', 'FPS must be an integer.');
        if (!normalizeNames(values.testers).length) add('testers', 'At least one tester is required.');
        break;
      }
      case 'vpx':
        if (!hasText(values.vpxVPSId)) add('vpxVPSId', 'A VPX file must be selected.');
        validateChecksum('vpxChecksum', 'VPX Checksum', { required: true });
        break;
      case 'b2s':
        validateChecksum('backglassChecksum', 'Backglass Checksum', { required: true });
        if (values.backglassBundled === true && !hasText(values.backglassNotes)) {
          add('backglassNotes', 'Bundled Backglass entries require notes.');
        }
        break;
      case 'rom':
        validateChecksum('romChecksum', 'ROM Checksum', { required: true });
        if (values.romBundled === true && !hasText(values.romNotes)) {
          add('romNotes', 'Bundled ROM entries require notes.');
        }
        if (hasText(values.romUrlOverride) && hasText(values.romVPSId)) {
          add('romVPSId', 'ROM VPS ID conflicts with ROM URL Override.');
          add('romUrlOverride', 'Use either ROM VPS ID or ROM URL Override, not both.');
        }
        if (hasText(values.romUrlOverride) && !hasText(values.romVersionOverride)) {
          add('romVersionOverride', 'ROM Version Override is required when using a URL override.');
        }
        break;
      case 'coloredRom': {
        validateChecksum('coloredROMChecksum', 'Color ROM Checksum', { required: true });
        if (values.coloredROMPin2DMD === true) {
          validateChecksum('coloredROMChecksumSecondary', 'Color ROM VNI Checksum', { required: true });
        }
        if (values.coloredROMBundled === true && !hasText(values.coloredROMNotes)) {
          add('coloredROMNotes', 'Bundled Color ROM entries require notes.');
        }
        break;
      }
      case 'pup': {
        const hasSource = hasText(values.pupVPSId) || hasText(values.pupFileUrl);
        validateChecksum('pupChecksum', 'PUP Pack Checksum', { required: hasSource });
        if (values.pupRequired === true && !hasSource) {
          add('pupVPSId', 'A required PUP Pack needs a VPS entry or file URL.');
          add('pupFileUrl', 'A required PUP Pack needs a VPS entry or file URL.');
        }
        break;
      }
      case 'vpuPatch':
        validateChecksum('diffChecksum', 'VPU Patch Checksum');
        break;
      default:
        break;
    }

    return errors;
  }

  function clearFieldErrors(container) {
    container?.querySelectorAll('.field.has-field-error').forEach(field => {
      field.classList.remove('has-field-error');
      field.removeAttribute('data-error-count');
      field.querySelector(':scope > .field-error-dot')?.remove();
    });
  }

  function findFieldWrapper(container, fieldName) {
    const control = container?.querySelector(`#field-${CSS.escape(fieldName)}`)
      || container?.querySelector(`[name="${CSS.escape(fieldName)}"]`);
    return control?.closest('.field') || null;
  }

  function addFieldErrorDot(container, fieldName, messages) {
    const wrapper = findFieldWrapper(container, fieldName);
    if (!wrapper || !messages?.length) return false;

    wrapper.classList.add('has-field-error');
    wrapper.dataset.errorCount = String(messages.length);

    const dot = document.createElement('span');
    dot.className = 'field-error-dot';
    dot.setAttribute('role', 'img');
    dot.setAttribute('aria-label', messages.join(' '));
    dot.title = messages.join('\n');
    wrapper.appendChild(dot);
    return true;
  }

  function decorateCurrentFields() {
    if (!accordionContext?.container?.isConnected) return;

    const { container, steps, values, callbacks } = accordionContext;
    clearFieldErrors(container);

    const panel = container.querySelector('.config-tab-panel');
    const step = steps.find(candidate => candidate.id === panel?.dataset.step);
    if (!step) return;

    const errors = getFieldErrors(step, values, callbacks);
    let added = 0;
    errors.forEach((messages, fieldName) => {
      if (addFieldErrorDot(container, fieldName, messages)) added += 1;
    });

    const tab = container.querySelector(`.config-tab[data-step="${CSS.escape(step.id)}"]`);
    if (!added && tab?.classList.contains('has-error')) {
      const fallback = step.fields.find(field => field.readonly)
        || step.fields.find(field => !field.advanced)
        || step.fields[0];
      if (fallback) {
        addFieldErrorDot(container, fallback.yml_field, ['This section contains an unresolved validation error.']);
      }
    }
  }

  function classState(element) {
    return STATUS_KEYS.find(key => element.classList.contains(`state-${key}`)) || 'neutral';
  }

  function emptyCounts() {
    return { green: 0, yellow: 0, orange: 0, red: 0, neutral: 0 };
  }

  function collectAssetCounts() {
    const counts = emptyCounts();
    document.querySelectorAll('#assetMatrix .asset-status').forEach(status => {
      counts[classState(status)] += 1;
    });
    return counts;
  }

  function collectConfigCounts() {
    const counts = emptyCounts();
    document.querySelectorAll('#accordionStack .config-tab:not(:disabled)').forEach(tab => {
      if (tab.classList.contains('has-error')) counts.red += 1;
      else if (tab.classList.contains('has-warning')) counts.orange += 1;
      else counts.green += 1;
    });
    return counts;
  }

  function highestState(assetCounts, configCounts) {
    return STATUS_KEYS.reduce((highest, key) => {
      const total = (assetCounts[key] || 0) + (configCounts[key] || 0);
      return total > 0 && PRIORITY[key] > PRIORITY[highest] ? key : highest;
    }, 'neutral');
  }

  function statusItems(counts, type) {
    const labels = type === 'assets'
      ? { green: 'Ready', yellow: 'Caution', orange: 'Action', red: 'Error', neutral: 'Not included' }
      : { green: 'Ready', yellow: 'Caution', orange: 'Warnings', red: 'Errors', neutral: 'Not included' };

    return STATUS_KEYS
      .filter(key => counts[key] > 0)
      .map(key => ({ key, label: labels[key], count: counts[key] }));
  }

  function ensurePreviewBreakdown(dot) {
    const heading = dot.closest('#previewHeading');
    if (!heading) return null;

    let breakdown = heading.querySelector('.preview-status-breakdown');
    if (!breakdown) {
      breakdown = document.createElement('span');
      breakdown.className = 'preview-status-breakdown';
      breakdown.id = 'previewStatusBreakdown';
      breakdown.setAttribute('role', 'tooltip');
      heading.insertBefore(breakdown, dot.nextSibling);
    }
    return breakdown;
  }

  function appendBreakdownGroup(target, title, items) {
    if (!items.length) return;
    const group = document.createElement('span');
    group.className = 'preview-status-group';

    const heading = document.createElement('strong');
    heading.textContent = title;
    group.appendChild(heading);

    items.forEach(item => {
      const row = document.createElement('span');
      row.className = `preview-status-item state-${item.key}`;
      const marker = document.createElement('span');
      marker.className = 'preview-status-marker';
      marker.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = `${item.label}: ${item.count}`;
      row.append(marker, label);
      group.appendChild(row);
    });

    target.appendChild(group);
  }

  function summaryText(assetItems, configItems) {
    const format = items => items.map(item => `${item.label} ${item.count}`).join(', ');
    const parts = [];
    if (assetItems.length) parts.push(`Assets: ${format(assetItems)}`);
    if (configItems.length) parts.push(`Configuration: ${format(configItems)}`);
    return parts.join('. ') || 'No table loaded';
  }

  function updatePreviewStatus() {
    const dot = document.getElementById('previewStatusDot');
    if (!dot) return;

    const assetCounts = collectAssetCounts();
    const configCounts = collectConfigCounts();
    const assetItems = statusItems(assetCounts, 'assets');
    const configItems = statusItems(configCounts, 'config');
    const overall = highestState(assetCounts, configCounts);
    const summary = summaryText(assetItems, configItems);

    dot.className = `preview-dot state-${overall}`;
    dot.tabIndex = 0;
    dot.title = summary;
    dot.setAttribute('aria-label', `YAML build status. ${summary}`);
    dot.setAttribute('aria-describedby', 'previewStatusBreakdown');

    const breakdown = ensurePreviewBreakdown(dot);
    if (!breakdown) return;
    breakdown.replaceChildren();
    appendBreakdownGroup(breakdown, 'Assets', assetItems);
    appendBreakdownGroup(breakdown, 'Configuration', configItems);
  }

  UI.renderTableStrip = function renderTableStripWithContainment(...args) {
    const result = originalRenderTableStrip(...args);
    containTableCover(args[0]);
    queueStatusRefresh();
    return result;
  };

  UI.renderAssetMatrix = function renderAssetMatrixWithStatus(...args) {
    const result = originalRenderAssetMatrix(...args);
    queueStatusRefresh();
    return result;
  };

  UI.renderAccordions = function renderAccordionsWithFieldStatus(container, steps, values, callbacks) {
    const enhancedCallbacks = {
      ...callbacks,
      onChange: (key, value, field) => {
        callbacks.onChange(key, value, field);
        queueStatusRefresh();
      }
    };

    const result = originalRenderAccordions(container, steps, values, enhancedCallbacks);
    accordionContext = { container, steps, values, callbacks: enhancedCallbacks };
    queueStatusRefresh();
    return result;
  };

  document.addEventListener('input', queueStatusRefresh, true);
  document.addEventListener('change', queueStatusRefresh, true);

  function startPreviewObserver() {
    const preview = document.getElementById('previewYaml');
    if (!preview || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(queueStatusRefresh);
    observer.observe(preview, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startPreviewObserver();
      queueStatusRefresh();
    }, { once: true });
  } else {
    startPreviewObserver();
    queueStatusRefresh();
  }
})();
