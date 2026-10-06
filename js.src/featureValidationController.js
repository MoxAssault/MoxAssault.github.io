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

    const altSoundSelected = Boolean(selections?.altSoundFiles || values?.altSoundVPSId);
    const altSoundBundled = values?.altSoundBundled === true;
    const altSoundOverride = values?.altSoundOverride === true;
    const altSoundUrl = String(values?.altSoundUrlOverride || '').trim();
    const altSoundVersion = String(values?.altSoundVersionOverride || '').trim();
    const altSoundActive = altSoundSelected || altSoundBundled || Boolean(altSoundUrl || altSoundVersion);
    // Checksum and Archive Format are required whenever the tab is enabled
    // at all — selected, bundled, or overridden — same as PUP Pack's
    // unconditionally-required fields.
    const altSoundEnabled = altSoundActive || altSoundOverride;

    if (altSoundEnabled) {
      const checksums = normalizeArray(values?.altSoundChecksum);
      if (!checksums.length) {
        add('altSound', 'altSoundChecksum', 'Alt Sound Checksum is required', 'Add a valid MD5 value for Alt Sound Checksum.');
      } else if (checksums.some(checksum => !isMd5Hash(checksum))) {
        add('altSound', 'altSoundChecksum', 'Alt Sound Checksum is not a valid MD5', 'Each checksum must contain exactly 32 hexadecimal characters.');
      }
      if (!String(values?.altSoundArchiveFormat || '').trim()) {
        add('altSound', 'altSoundArchiveFormat', 'Alt Sound Archive Format is required', 'Choose ZIP, RAR, or 7Z.');
      }
    }

    if (altSoundSelected && altSoundUrl) {
      add('altSound', 'altSoundUrlOverride', 'Choose one Alt Sound source', 'Use either Alt Sound VPS ID or Alt Sound URL Override, not both.');
    }
    if (altSoundUrl && !altSoundVersion) {
      add('altSound', 'altSoundVersionOverride', 'Alt Sound Version Override is required', 'Add Alt Sound Version Override whenever Alt Sound URL Override is used.');
    }
    if (altSoundVersion && !altSoundUrl) {
      add('altSound', 'altSoundUrlOverride', 'Alt Sound URL Override is required', 'Add Alt Sound URL Override whenever Alt Sound Version Override is used.');
    }
    if (altSoundBundled && !String(values?.altSoundNotes || '').trim()) {
      add('altSound', 'altSoundNotes', 'Alt Sound Notes are required', 'Add Alt Sound Notes when the Alt Sound ships inside the table download.');
    }
    if (altSoundUrl && !String(values?.altSoundNotes || '').trim()) {
      add('altSound', 'altSoundNotes', 'Alt Sound Notes are required', 'Add Alt Sound Notes when using Alt Sound URL Override.');
    }
    if (altSoundBundled && !String(values?.altSoundArchiveRoot || '').trim()) {
      add('altSound', 'altSoundArchiveRoot', 'Alt Sound Archive Root is required', 'Choose the Alt Sound root folder from the uploaded Alt Sound archive.');
    }
    // Bundled means the Alt Sound ships inside the table's own download —
    // no external Authors/URL/Version Override needed, only Notes and
    // Archive Root (above). Override (no VPS entry) still requires the
    // full Advanced Config set via fields.js's overrideRequiredFields.

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

  function clearPresentation() {
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
  // Deliberately NOT class `field-error-dot`: both the legacy validator and
  // additionalRomsController remove `:scope > .field-error-dot` wholesale and
  // would delete this one out from under us. The CSS gives both classes the
  // same rules instead.
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
    // Updated in place, and swept in refresh() only once the error clears, so
    // a field with a standing error causes no DOM mutation between passes.
    const tooltip = messages.join(' ');
    if (dot.dataset.tooltip !== tooltip) dot.dataset.tooltip = tooltip;
    if (dot.getAttribute('aria-label') !== tooltip) dot.setAttribute('aria-label', tooltip);
  }

  function presentField(wrapper, messages) {
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

  function refresh() {
    clearPresentation();
    const grouped = new Map();

    errors().forEach(error => {
      const key = `${error.stepId}:${error.fieldName}`;
      const messages = grouped.get(key) || [];
      if (!messages.includes(error.message)) messages.push(error.message);
      grouped.set(key, messages);
    });

    grouped.forEach((messages, key) => {
      const fieldName = key.slice(key.indexOf(':') + 1);
      // Scoped to the ROM tab: the VPX tab's Additional Passwords control
      // shares the .additional-rom-controls class, and an unscoped lookup put
      // Additional ROM errors on it whenever the VPX tab was open (2026-10-04).
      const wrapper = fieldName === 'additionalRoms'
        ? document.querySelector('#config-panel-rom .additional-rom-controls')
        : document.getElementById(`field-${fieldName}`)?.closest('.field');
      presentField(wrapper, messages);
    });

    document.querySelectorAll('.feature-error-dot').forEach(dot => {
      if (!dot.parentElement?.classList.contains('feature-has-field-error')) dot.remove();
    });
  }

  // Dialog lines and Copy/Download blocking now come from main.js, which reads
  // these same rules through validationRules.js. This file used to append its
  // errors to the Validate dialog and intercept Copy and Download clicks.
  window.VPS_FEATURE_VALIDATION = Object.freeze({ errors, refresh });
})();