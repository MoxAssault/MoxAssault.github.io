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

  // Everything this file used to present now reads these same rules through
  // validationRules.js: the dialog lines and Copy/Download blocking in main.js,
  // and the field dots in uiEnhancements.js. errors() stays only so the tests
  // can compare it to the rulebook, until the old validators are deleted.
  window.VPS_FEATURE_VALIDATION = Object.freeze({ errors });
})();