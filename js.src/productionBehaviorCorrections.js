(() => {
  'use strict';

  const runtime = window.VPS_FEATURE_RUNTIME;
  if (!runtime) return;
  let frame = 0;

  function correctTutorial() {
    const select = document.getElementById('field-tutorialVPSId');
    if (!select) return;
    const available = Array.isArray(runtime.state.record?.tutorialFiles) && runtime.state.record.tutorialFiles.length > 0;
    select.disabled = !available;
    if (!available) {
      select.replaceChildren(new Option('No tutorials available', ''));
      select.value = '';
    }
  }

  function correctWizardLabel() {
    const input = document.getElementById('field-enabled');
    const label = input?.closest('.checkbox-row')?.querySelector('span:not(.control-tooltip)');
    if (label && label.textContent !== 'Wizard Disabled') label.textContent = 'Wizard Disabled';
  }

  function clearFalseAltIdError() {
    const input = document.getElementById('field-altSoundVPSId');
    const wrapper = input?.closest('.field');
    if (!wrapper || !String(input.textContent || input.value || runtime.state.values?.altSoundVPSId || '').trim()) return;
    wrapper.classList.remove('feature-has-field-error', 'has-field-error');
    wrapper.removeAttribute('data-feature-error-message');
    wrapper.querySelectorAll('.field-error-dot').forEach(dot => dot.remove());
  }

  function additionalRomName(entry) {
    const items = runtime.state.record?.romFiles || [];
    const item = items.find(candidate => String(candidate?.id || '') === String(entry?.vpsId || ''));
    return String(item?.name || item?.romName || item?.title || item?.version || entry?.vpsId || 'Additional ROM');
  }

  function correctAdditionalRomSummary() {
    const api = window.VPS_ADDITIONAL_ROMS;
    const entries = api?.entries?.() || [];
    document.querySelector('.additional-rom-empty')?.remove();
    const summary = document.querySelector('#config-panel-rom .compact-advanced > summary');
    const add = summary?.querySelector('.additional-rom-add');
    if (!summary || !add) return;

    let icon = summary.querySelector('.additional-rom-info-icon');
    if (!entries.length) {
      icon?.remove();
      add.disabled = false;
      add.hidden = false;
      return;
    }

    const entry = entries[0];
    const info = [additionalRomName(entry), entry.vpsId, entry.checksum, entry.versionOverride, entry.urlOverride]
      .filter(Boolean).join(' · ');
    if (!icon) {
      icon = document.createElement('button');
      icon.type = 'button';
      icon.className = 'additional-rom-info-icon';
      icon.textContent = 'i';
      icon.setAttribute('aria-label', 'Additional ROM information');
      summary.insertBefore(icon, add);
    }
    icon.dataset.tooltip = info;
    icon.setAttribute('aria-label', info);
    add.disabled = true;
    add.hidden = false;
  }

  function apply() {
    frame = 0;
    correctTutorial();
    correctWizardLabel();
    clearFalseAltIdError();
    correctAdditionalRomSummary();
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(apply);
  }

  document.addEventListener('input', schedule, true);
  document.addEventListener('change', schedule, true);
  document.addEventListener('click', schedule, true);
  if (typeof MutationObserver !== 'undefined') new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();