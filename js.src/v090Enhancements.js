(() => {
  'use strict';

  const STATUS_KEYS = ['green', 'yellow', 'orange', 'red', 'neutral'];
  const PRIORITY = { neutral: 0, green: 1, yellow: 2, orange: 3, red: 4 };
  let refreshFrame = 0;

  function valueOf(fieldName) {
    const control = document.getElementById(`field-${fieldName}`);
    if (!control) return '';
    if (control.matches('input[type="checkbox"]')) return control.checked;
    if (control.classList.contains('readonly-id')) {
      return control.querySelector('.readonly-code-value')?.textContent || control.textContent || '';
    }
    return control.value ?? '';
  }

  function hasText(value) {
    return String(value ?? '').trim().length > 0;
  }

  function fieldWrapper(fieldName) {
    return document.getElementById(`field-${fieldName}`)?.closest('.field') || null;
  }

  function addFieldMessage(fieldName, message) {
    const wrapper = fieldWrapper(fieldName);
    if (!wrapper) return;

    wrapper.classList.add('has-field-error');
    let dot = wrapper.querySelector(':scope > .field-error-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'field-error-dot';
      dot.setAttribute('role', 'img');
      wrapper.appendChild(dot);
    }

    const messages = new Set(
      String(dot.dataset.tooltip || dot.getAttribute('aria-label') || '')
        .split(/\s*\|\s*/)
        .map(item => item.trim())
        .filter(Boolean)
    );
    messages.add(message);
    const joined = [...messages].join(' | ');
    dot.dataset.tooltip = joined;
    dot.setAttribute('aria-label', joined);
    dot.removeAttribute('title');
  }

  function pairErrors(urlField, versionField, label) {
    const hasUrl = hasText(valueOf(urlField));
    const hasVersion = hasText(valueOf(versionField));
    if (hasUrl && !hasVersion) addFieldMessage(versionField, `${label} Version Override is required when URL Override is used.`);
    if (hasVersion && !hasUrl) addFieldMessage(urlField, `${label} URL Override is required when Version Override is used.`);
  }

  function decorateValidationFields() {
    document.querySelectorAll('.field-error-dot[title]').forEach(dot => {
      dot.dataset.tooltip = dot.getAttribute('title') || dot.getAttribute('aria-label') || '';
      dot.removeAttribute('title');
    });

    const panel = document.querySelector('#accordionStack .config-tab-panel');
    const stepId = panel?.dataset.step;
    if (!stepId) return;

    if (['b2s', 'rom', 'coloredRom', 'vpuPatch'].includes(stepId)) {
      panel.querySelectorAll('.field-error-dot').forEach(dot => {
        const message = `${dot.dataset.tooltip || ''} ${dot.getAttribute('aria-label') || ''}`;
        if (!/unresolved validation error/i.test(message)) return;
        const wrapper = dot.closest('.field');
        dot.remove();
        if (!wrapper?.querySelector('.field-error-dot')) wrapper?.classList.remove('has-field-error');
      });
    }

    if (stepId === 'rom') pairErrors('romUrlOverride', 'romVersionOverride', 'ROM');
    if (stepId === 'coloredRom') pairErrors('coloredROMUrlOverride', 'coloredROMVersionOverride', 'Color ROM');
    if (stepId === 'vpuPatch') {
      pairErrors('diffUrlOverride', 'diffVersionOverride', 'Patch');
      if (!hasText(valueOf('diffChecksum'))) addFieldMessage('diffChecksum', 'VPU Patch Checksum is required.');
    }
    if (stepId === 'b2s' && hasText(valueOf('backglassUrlOverride'))) {
      if (!hasText(valueOf('backglassAuthorsOverride'))) {
        addFieldMessage('backglassAuthorsOverride', 'Backglass Authors Override is required when URL Override is used.');
      }
      if (!hasText(valueOf('backglassImageOverride'))) {
        addFieldMessage('backglassImageOverride', 'Backglass Image Override is required when URL Override is used.');
      }
    }
  }

  function stateKey(element) {
    return STATUS_KEYS.find(key => element.classList.contains(`state-${key}`)) || 'neutral';
  }

  function emptyCounts() {
    return { green: 0, yellow: 0, orange: 0, red: 0, neutral: 0 };
  }

  function collectAssetCounts() {
    const counts = emptyCounts();
    document.querySelectorAll('#assetMatrix .asset-status').forEach(status => {
      if (/unavailable/i.test(status.textContent || '')) return;
      counts[stateKey(status)] += 1;
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

  function statusItems(counts, type) {
    const labels = type === 'assets'
      ? { green: 'Ready', yellow: 'Caution', orange: 'Action', red: 'Error', neutral: 'Not included' }
      : { green: 'Ready', yellow: 'Caution', orange: 'Warnings', red: 'Errors', neutral: 'Not included' };
    return STATUS_KEYS.filter(key => counts[key] > 0).map(key => ({ key, label: labels[key], count: counts[key] }));
  }

  function appendStatusGroup(target, title, items) {
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

  function refreshPreviewBreakdown() {
    const dot = document.getElementById('previewStatusDot');
    const breakdown = document.getElementById('previewStatusBreakdown');
    if (!dot || !breakdown) return;

    const assets = collectAssetCounts();
    const config = collectConfigCounts();
    const assetItems = statusItems(assets, 'assets');
    const configItems = statusItems(config, 'config');
    const overall = STATUS_KEYS.reduce((highest, key) => {
      const total = assets[key] + config[key];
      return total > 0 && PRIORITY[key] > PRIORITY[highest] ? key : highest;
    }, 'neutral');

    dot.className = `preview-dot state-${overall}`;
    dot.tabIndex = 0;
    dot.setAttribute('role', 'button');
    dot.removeAttribute('title');
    dot.setAttribute('aria-label', 'YAML build status. Click to open the first validation error.');
    breakdown.replaceChildren();
    appendStatusGroup(breakdown, 'Assets', assetItems);
    appendStatusGroup(breakdown, 'Configuration', configItems);
  }

  function refresh() {
    refreshFrame = 0;
    decorateValidationFields();
    refreshPreviewBreakdown();
  }

  function queueRefresh() {
    if (refreshFrame) return;
    refreshFrame = window.requestAnimationFrame(refresh);
  }

  function initHelpTabs() {
    const tabs = [...document.querySelectorAll('[data-help-tab]')];
    const panels = [...document.querySelectorAll('[data-help-panel]')];
    if (!tabs.length || !panels.length) return;

    const activate = name => {
      tabs.forEach(tab => {
        const active = tab.dataset.helpTab === name;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.tabIndex = active ? 0 : -1;
      });
      panels.forEach(panel => {
        const active = panel.dataset.helpPanel === name;
        panel.classList.toggle('active', active);
        panel.hidden = !active;
      });
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab.dataset.helpTab));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        activate(tabs[next].dataset.helpTab);
        tabs[next].focus();
      });
    });
  }

  function init() {
    initHelpTabs();
    queueRefresh();
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(records => {
        const relevant = records.some(record => {
          const target = record.target instanceof Element ? record.target : record.target.parentElement;
          return !target?.closest('#previewStatusBreakdown');
        });
        if (relevant) queueRefresh();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    document.addEventListener('input', queueRefresh, true);
    document.addEventListener('change', queueRefresh, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
