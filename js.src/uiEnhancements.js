(() => {
  'use strict';

  const UI = window.VPS_UI;
  const utils = window.VPS_UTILS;
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

  // Every error dot in the builder, drawn in one pass from the merged rulebook
  // (validationRules.js). Until 2026-10-06 four scripts drew them, each on its
  // own frame: this file (getFieldErrors and the fallback dot),
  // featureValidationController.js, v090Enhancements.js, and v091Corrections.js,
  // which deleted any dot drawn on the VPU Patch ID. Phase 1 of the merge keeps
  // every dot exactly as it looked, so each system still gets the dot it had:
  //   field   - .field-error-dot, one per field, its messages one per line
  //   v090    - .field-error-dot.v090-error-dot, one per issue
  //   feature - .feature-error-dot, one per field, messages joined by a space
  //             and written into the control's aria-label too
  // Drawn in that order, which is the order the old frames left them in.

  // v091Corrections.js removed every dot here; in practice that was the
  // fallback dot, which picks a tab's read-only ID field first.
  const NO_DOT_FIELDS = new Set(['diffVPSId']);

  function clearFieldErrors(container) {
    container?.querySelectorAll('.field.has-field-error').forEach(field => {
      field.classList.remove('has-field-error');
      field.querySelectorAll(':scope > .field-error-dot').forEach(dot => dot.remove());
    });
  }

  function findFieldWrapper(container, fieldName) {
    const control = container?.querySelector(`#field-${utils.cssEscape(fieldName)}`)
      || container?.querySelector(`[name="${utils.cssEscape(fieldName)}"]`);
    return control?.closest('.field') || null;
  }

  function addFieldErrorDot(container, fieldName, messages, { v090 = false } = {}) {
    if (NO_DOT_FIELDS.has(fieldName)) return false;
    const wrapper = findFieldWrapper(container, fieldName);
    if (!wrapper || !messages?.length) return false;

    wrapper.classList.add('has-field-error');

    const dot = document.createElement('span');
    dot.className = v090 ? 'field-error-dot v090-error-dot' : 'field-error-dot';
    dot.setAttribute('role', 'img');
    dot.setAttribute('aria-label', messages.join(' '));
    dot.dataset.tooltip = messages.join('\n');
    dot.tabIndex = 0;
    // Ahead of a feature dot, which is kept between passes while these are
    // redrawn, so a field carrying both always lists them in the same order.
    wrapper.insertBefore(dot, wrapper.querySelector(':scope > .feature-error-dot'));
    return true;
  }

  function restoreControlLabel(control) {
    if (!control) return;
    if (control.dataset.featureOriginalAriaLabel !== undefined) {
      const original = control.dataset.featureOriginalAriaLabel;
      if (original) control.setAttribute('aria-label', original);
      else control.removeAttribute('aria-label');
      delete control.dataset.featureOriginalAriaLabel;
    }
    control.removeAttribute('aria-invalid');
  }

  function clearFeaturePresentation() {
    document.querySelectorAll('.feature-has-field-error').forEach(wrapper => {
      wrapper.classList.remove('feature-has-field-error');
      wrapper.removeAttribute('data-feature-error-message');
      wrapper.removeAttribute('data-feature-error-count');
      const control = wrapper.matches('.additional-rom-controls')
        ? wrapper.querySelector('.additional-rom-add')
        : wrapper.querySelector('input, textarea, select, button, .readonly-id');
      restoreControlLabel(control);
      if (!wrapper.querySelector('.field-error-dot')) {
        wrapper.classList.remove('has-field-error');
      }
    });
  }

  // The dot is a real element rather than a pseudo-element on the field
  // wrapper. CSS cannot scope :hover to a pseudo-element, so the old
  // attribute-only version popped its tooltip from anywhere in the field —
  // including the hint line underneath it — while every other checksum error
  // in the app pops only from its dot. A real element can own the hover, so
  // this now behaves and looks identical to the legacy dots.
  //
  // Deliberately NOT class `field-error-dot`: clearFieldErrors above and
  // additionalRomsController remove `.field-error-dot` wholesale, and this one
  // is updated in place instead. The CSS gives both classes the same rules.
  //
  // .additional-rom-controls keeps the pseudo-element version — it is a
  // different widget with its own dot logic and its own cleanup.
  function presentErrorDot(wrapper, messages) {
    if (wrapper.matches('.additional-rom-controls')) return;
    let dot = wrapper.querySelector(':scope > .feature-error-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'feature-error-dot';
      dot.setAttribute('role', 'img');
      wrapper.appendChild(dot);
    }
    // Updated in place, and swept in decorateCurrentFields only once the error
    // clears, so a field with a standing error causes no DOM mutation between passes.
    const tooltip = messages.join(' ');
    if (dot.dataset.tooltip !== tooltip) dot.dataset.tooltip = tooltip;
    if (dot.getAttribute('aria-label') !== tooltip) dot.setAttribute('aria-label', tooltip);
  }

  function presentFeatureField(wrapper, messages) {
    if (!wrapper || !messages.length) return;
    wrapper.classList.add('has-field-error', 'feature-has-field-error');
    wrapper.dataset.featureErrorCount = String(messages.length);
    wrapper.dataset.featureErrorMessage = messages.join(' ');
    presentErrorDot(wrapper, messages);

    const control = wrapper.matches('.additional-rom-controls')
      ? wrapper.querySelector('.additional-rom-add')
      : wrapper.querySelector('input, textarea, select, button, .readonly-id');
    if (!control) return;
    if (control.dataset.featureOriginalAriaLabel === undefined) {
      control.dataset.featureOriginalAriaLabel = control.getAttribute('aria-label') || '';
    }
    const original = control.dataset.featureOriginalAriaLabel;
    control.setAttribute('aria-label', `${original ? `${original}. ` : ''}${messages.join(' ')}`);
    control.setAttribute('aria-invalid', 'true');
  }

  // Messages per field, in the order the rulebook lists them, each once.
  function groupMessages(issues, keyOf) {
    const grouped = new Map();
    issues.forEach(issue => {
      const key = keyOf(issue);
      const messages = grouped.get(key) || [];
      if (!messages.includes(issue.message)) messages.push(issue.message);
      grouped.set(key, messages);
    });
    return grouped;
  }

  function decorateCurrentFields() {
    if (!accordionContext?.container?.isConnected) return;
    const ctx = window.VPS_MAIN?.validationContext?.();
    if (!ctx || !window.VPS_VALIDATION) return;

    const { container, steps } = accordionContext;
    const issues = window.VPS_VALIDATION.collectAllErrors(ctx);
    clearFieldErrors(container);
    clearFeaturePresentation();

    // Only the open tab is in the DOM, so only its dots can be drawn.
    const panel = container.querySelector('.config-tab-panel');
    const step = steps.find(candidate => candidate.id === panel?.dataset.step);
    if (step) {
      const onStep = system => issues.filter(issue => issue.system === system && issue.stepId === step.id);
      let added = 0;
      groupMessages(onStep('field'), issue => issue.fieldName).forEach((messages, fieldName) => {
        if (addFieldErrorDot(container, fieldName, messages)) added += 1;
      });

      // A tab in error with no dot of its own points at its first field, so
      // the user is not left looking for the problem.
      const tab = container.querySelector(`.config-tab[data-step="${utils.cssEscape(step.id)}"]`);
      const hasExtendedFieldError = issues.some(issue => (
        (issue.system === 'feature' || issue.system === 'v090') && issue.stepId === step.id
      ));
      if (!added && !hasExtendedFieldError && tab?.classList.contains('has-error')) {
        const fallback = step.fields.find(field => field.readonly)
          || step.fields.find(field => !field.advanced)
          || step.fields[0];
        if (fallback) {
          addFieldErrorDot(container, fallback.yml_field, ['This section contains an unresolved validation error.']);
        }
      }

      onStep('v090').forEach(issue => addFieldErrorDot(container, issue.fieldName, [issue.message], { v090: true }));
    }

    const feature = issues.filter(issue => issue.system === 'feature');
    groupMessages(feature, issue => `${issue.stepId}:${issue.fieldName}`).forEach((messages, key) => {
      const fieldName = key.slice(key.indexOf(':') + 1);
      // Scoped to the ROM tab: the VPX tab's Additional Passwords control
      // shares the .additional-rom-controls class, and an unscoped lookup put
      // Additional ROM errors on it whenever the VPX tab was open (2026-10-04).
      const wrapper = fieldName === 'additionalRoms'
        ? document.querySelector('#config-panel-rom .additional-rom-controls')
        : document.getElementById(`field-${fieldName}`)?.closest('.field');
      presentFeatureField(wrapper, messages);
    });

    document.querySelectorAll('.feature-error-dot').forEach(dot => {
      if (!dot.parentElement?.classList.contains('feature-has-field-error')) dot.remove();
    });
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

  // For the controllers that change state outside an input or change event
  // (an archive scan finishing, a dialog saving) and redraw at once.
  window.VPS_ERROR_DOTS = Object.freeze({ refresh: decorateCurrentFields });

  document.addEventListener('input', queueStatusRefresh, true);
  document.addEventListener('change', queueStatusRefresh, true);

  // Truncated checksum hints expose their full text as a hover tooltip.
  document.addEventListener('mouseover', event => {
    const hint = event.target instanceof Element ? event.target.closest('.checksum-drop-hint') : null;
    const status = hint?.closest('.checksum-drop-status');
    if (!status) return;
    if (hint.scrollWidth > hint.clientWidth) status.dataset.tooltip = hint.textContent;
    else delete status.dataset.tooltip;
  }, true);

  // Clamped asset-detail values expose their full text as a hover tooltip.
  // Measured on hover rather than at render for the same reason as the hint
  // above: .asset-detail is display:none until its row is opened, and a hidden
  // element measures as zero (see the detached-node trap in VPXS UI Gotchas).
  document.addEventListener('mouseover', event => {
    const value = event.target instanceof Element ? event.target.closest('.asset-detail-value') : null;
    const cell = value?.closest('.asset-detail-cell');
    if (!cell) return;
    const clipped = value.scrollHeight > value.clientHeight + 1
      || value.scrollWidth > value.clientWidth + 1;
    if (clipped) cell.dataset.tooltip = value.textContent;
    else delete cell.dataset.tooltip;
  }, true);

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
