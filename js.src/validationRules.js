(() => {
  'use strict';

  // Every validation rule in the app, in one place.
  //
  // Four validators grew up separately and never read each other (vault note
  // "VPXS Layered Validation"): validateBuild in main.js, getFieldErrors in
  // uiEnhancements.js, the feature validator in featureValidationController.js
  // and the v090 rules in v090Enhancements.js. Phase 1 of their merge (finished
  // 2026-10-06) copied each one here exactly, quirks and all, moved every
  // screen onto this file, and deleted the originals. The four sections below
  // are those copies, and each issue still carries the `system` it came from,
  // because the screens present each system the way its validator used to.
  // Phase 2 resolves the duplicates and wording differences between systems,
  // one decision at a time; the pinned scenarios in tests/yaml-*.test.mjs
  // show exactly what every rule produces until then.
  //
  // An issue is { system, type, stepId, fieldName, title, message }:
  //   build    - the Validate dialog, tab counts, blocks Copy/Download
  //   field    - field dots on the open tab; no title
  //   feature  - Alt Sound, the tutorial, Additional ROMs: dialog, counts, dots, blocks
  //   v090     - URL/version pairs, Backglass overrides, VPU Patch checksum: the same
  //
  // ctx is { record, selections, values, yaml, isStepEnabled }, read from
  // main.js's state.

  const hasValue = value => typeof value === 'string' ? value.trim() !== '' : value !== undefined && value !== null;

  function buildIssues(ctx, utils, fields) {
    const { CATEGORY_CONFIG, WIZARD_STEPS } = fields;
    const { isItemBroken, getCategoryItems, normalizeArray, isMd5Hash, normalizeChecksumValue } = utils;
    const { record, selections, values, yaml, isStepEnabled } = ctx;
    const output = [];
    const push = (type, stepId, title, message) => output.push({ system: 'build', type, stepId, fieldName: '', title, message });
    const addError = (stepId, title, message) => push('error', stepId, title, message);
    const addWarning = (stepId, title, message) => push('warning', stepId, title, message);
    const hasText = hasValue;

    if (!record) addError('main', 'No table selected', 'Search for and load a VPS table first.');
    if (!values.tableVPSId) addError('main', 'Missing table VPS ID', 'The selected table does not have a usable VPS ID.');
    if (!selections.tableFiles || !values.vpxVPSId) {
      addError('vpx', 'VPX file required', 'Select a VPX file before copying or downloading the configuration.');
    }

    const fpsRaw = values.fps;
    if (fpsRaw === '' || fpsRaw === undefined || fpsRaw === null) {
      addError('main', 'FPS is required', 'Enter the table frame rate as an integer.');
    } else if (!/^\d+$/.test(String(fpsRaw)) || !Number.isInteger(Number(fpsRaw))) {
      addError('main', 'FPS must be an integer', 'Use numbers only for FPS.');
    }

    if (!normalizeArray(values.testers).length) {
      addError('main', 'Testers are required', 'Enter at least one tester; separate multiple names with commas.');
    }

    Object.entries(CATEGORY_CONFIG).forEach(([category, config]) => {
      const selectedId = selections[category];
      const items = getCategoryItems(record, category, config, { selections });
      const item = items.find(candidate => String(candidate.id || '') === String(selectedId || ''));

      if (config.bundleField && selectedId && values[config.bundleField] === true) {
        addWarning(config.stepId, `${config.label} selected and bundled`, 'Choose either a separate VPS entry or bundled status unless both are intentionally required.');
      }
      if (selectedId && !item) {
        addError(config.stepId, `${config.label} ID is unavailable`, 'Choose an available VPS entry before copying or downloading.');
      } else if (item && isItemBroken(item)) {
        addError(config.stepId, `${config.label} entry is broken`, 'Choose another database entry before copying or downloading.');
      }
    });

    const validateChecksum = (key, stepId, label, options = {}) => {
      const rawValue = options.value !== undefined ? options.value : values[key];
      const hashes = normalizeChecksumValue(rawValue);
      if (options.required && !hashes.length) {
        addError(stepId, `${label} is required`, `Add a valid MD5 value for ${label}.`);
        return;
      }
      if (!hashes.length) return;
      if (Array.isArray(rawValue) && hashes.length < 2) {
        addError(stepId, `${label} list is invalid`, 'Use a plain string for one checksum or a list containing at least two checksums.');
      }
      hashes.forEach(hash => {
        if (!isMd5Hash(hash)) {
          addError(stepId, `${label} is not a valid MD5`, 'Each checksum must contain exactly 32 hexadecimal characters.');
        }
      });
    };

    validateChecksum('vpxChecksum', 'vpx', 'VPX Checksum', { required: true });

    const backglassOffered = Boolean(
      selections.b2sFiles || hasText(values.backglassUrlOverride) || values.backglassBundled === true
    );
    validateChecksum('backglassChecksum', 'b2s', 'Backglass Checksum', { required: backglassOffered });
    if (hasText(values.backglassUrlOverride) && !hasText(values.backglassNotes)) {
      addError('b2s', 'Backglass Notes are required', 'Add Backglass Notes when using Backglass URL Override.');
    }
    if (values.backglassBundled === true && !hasText(values.backglassNotes)) {
      addError('b2s', 'Bundled Backglass needs notes', 'Describe the bundled Backglass and where it is located.');
    }

    const romOffered = Boolean(
      selections.romFiles || hasText(values.romUrlOverride) || values.romBundled === true
    );
    validateChecksum('romChecksum', 'rom', 'ROM Checksum', { required: romOffered });
    if (hasText(values.romUrlOverride) && values.romVPSId) {
      addError('rom', 'ROM ID conflicts with URL override', 'Use either ROM ID or ROM URL Override, not both.');
    }
    if (hasText(values.romUrlOverride) && !hasText(values.romVersionOverride)) {
      addError('rom', 'ROM version override is required', 'Add ROM Version Override when using ROM URL Override.');
    }
    if (hasText(values.romUrlOverride) && !hasText(values.romNotes)) {
      addError('rom', 'ROM Notes are required', 'Add ROM Notes when using ROM URL Override.');
    }
    if (values.romBundled === true && !hasText(values.romNotes)) {
      addError('rom', 'Bundled ROM needs notes', 'Describe the bundled ROM and where it is located.');
    }

    const colorOffered = Boolean(
      selections.altColorFiles || hasText(values.coloredROMUrlOverride) || values.coloredROMBundled === true
    );
    const colorRawValue = values.coloredROMChecksum;
    const colorPrimary = String(Array.isArray(colorRawValue) ? (colorRawValue[0] ?? '') : (colorRawValue ?? '')).trim();
    const colorSecondary = String(values.coloredROMChecksumSecondary || '').trim();
    const colorValue = values.coloredROMPin2DMD === true
      ? [colorPrimary, colorSecondary].filter(Boolean)
      : colorRawValue;
    validateChecksum('coloredROMChecksum', 'coloredRom', 'Color ROM Checksum', {
      required: colorOffered,
      value: colorValue
    });
    if (values.coloredROMPin2DMD === true && (!colorPrimary || !colorSecondary)) {
      addError('coloredRom', 'PAL/VNI requires two checksums', 'Add the .pal checksum and the .vni checksum.');
    }
    if (hasText(values.coloredROMUrlOverride) && !hasText(values.coloredROMNotes)) {
      addError('coloredRom', 'Color ROM Notes are required', 'Add Color ROM Notes when using Color ROM URL Override.');
    }
    if (values.coloredROMBundled === true && !hasText(values.coloredROMNotes)) {
      addError('coloredRom', 'Bundled Color ROM needs notes', 'Describe the bundled Color ROM and where it is located.');
    }

    const pupOffered = Boolean(
      selections.pupPackFiles || hasText(values.pupFileUrl) || values.pupBundled === true || values.pupOverride === true
    );
    validateChecksum('pupChecksum', 'pup', 'PUP Pack Checksum', { required: pupOffered });
    if (values.pupBundled === true && !hasText(values.pupNotes)) {
      addError('pup', 'Bundled PUP Pack needs notes', 'Describe the bundled PUP Pack and where it is located.');
    }
    if (isStepEnabled(WIZARD_STEPS.find(step => step.id === 'pup'))) {
      [
        ['pupVersion', 'PUP Pack Version'],
        ['pupArchiveRoot', 'PUP Pack Archive Root'],
        ['pupArchiveFormat', 'PUP Pack Archive Format']
      ].forEach(([key, label]) => {
        if (!hasText(values[key])) {
          addError('pup', `${label} is required`, `Add ${label} before copying or downloading.`);
        }
      });
    }

    const dmdBundled = values.specialDMDBundled === true;
    const dmdOverride = values.specialDMDOverride === true;
    if (dmdBundled || dmdOverride) {
      [
        ['specialDMDType', 'DMD Type'],
        ['specialDMDArchiveRoot', 'DMD Archive Root'],
        ['specialDMDArchiveFormat', 'DMD Archive Format']
      ].forEach(([key, label]) => {
        if (!hasText(values[key])) {
          addError('dmd', `${label} is required`, `Add ${label} before copying or downloading.`);
        }
      });
      if (dmdBundled && normalizeChecksumValue(values.vpxChecksum).length < 2) {
        addError('vpx', 'Bundled DMD needs both checksums',
          'Drop the bundled archive on VPX Checksum: the list must carry the archive MD5 alongside the .vpx MD5.');
      }
      if (!dmdBundled) {
        validateChecksum('specialDMDChecksum', 'dmd', 'DMD Checksum', { required: true });
        [
          ['specialDMDUrlOverride', 'DMD URL Override'],
          ['specialDMDVersion', 'DMD Version']
        ].forEach(([key, label]) => {
          if (!hasText(values[key])) {
            addError('dmd', `${label} is required`, `Add ${label} before copying or downloading.`);
          }
        });
      }
    }

    validateChecksum('diffChecksum', 'vpuPatch', 'VPU Patch Checksum');
    if (hasText(values.diffUrlOverride) && !hasText(values.diffNotes)) {
      addError('vpuPatch', 'Patch Notes are required', 'Add Patch Notes when using Patch URL Override.');
    }
    if (values.diffBundled === true && !hasText(values.diffNotes)) {
      addError('vpuPatch', 'Bundled VPU Patch needs notes', 'Describe the bundled VPU Patch and where it is located.');
    }

    WIZARD_STEPS.forEach(step => {
      if (!step.overrideField || values[step.overrideField] !== true) return;
      (step.overrideRequiredFields || []).forEach(key => {
        if (hasText(values[key])) return;
        const label = step.fields.find(field => field.yml_field === key)?.name || key;
        addError(step.id, `${label} is required`, `Add ${label} — Override requires every Advanced Config field since there is no VPS entry to pull it from.`);
      });
    });

    const yamlLines = String(yaml || '').split('\n');
    const longLine = yamlLines.find((line, index) => {
      if (line.length <= 120) return false;
      const previous = yamlLines[index - 1] || '';
      return previous.trim() !== '# yamllint disable-line rule:line-length';
    });
    if (longLine) {
      addError('main', 'YAML line exceeds 120 characters', 'Shorten the value or use a supported URL field so the generated file passes yamllint.');
    }

    return output;
  }

  // getFieldErrors ran once per open tab and returned field -> messages. Here
  // it runs for every enabled tab, in step order; within a tab, entries keep
  // the order getFieldErrors' Map gave them, one per distinct message.
  function fieldIssues(ctx, fields) {
    const { WIZARD_STEPS } = fields;
    const { values, isStepEnabled } = ctx;
    const output = [];
    const isMd5 = value => /^[a-f0-9]{32}$/i.test(String(value || '').trim());
    const normalizeNames = value => Array.isArray(value)
      ? value.map(item => String(item).trim()).filter(Boolean)
      : String(value || '').split(',').map(item => item.trim()).filter(Boolean);
    const hasText = hasValue;

    WIZARD_STEPS.forEach(step => {
      if (isStepEnabled(step) === false) return;
      const errors = new Map();
      const add = (fieldName, message) => {
        if (!fieldName || !message) return;
        const messages = errors.get(fieldName) || [];
        if (!messages.includes(message)) messages.push(message);
        errors.set(fieldName, messages);
      };
      const validateChecksum = (fieldName, label, { required = false } = {}) => {
        const raw = values[fieldName];
        const value = String(Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')).trim();
        if (required && !value) add(fieldName, `${label} is required.`);
        else if (value && !isMd5(value)) add(fieldName, `${label} must be a 32-character MD5 value.`);
      };

      switch (step.id) {
        case 'main': {
          if (!hasText(values.tableVPSId)) add('tableVPSId', 'Table VPS ID is required.');
          const fps = String(values.fps ?? '').trim();
          if (!fps) add('fps', 'FPS is required.');
          else if (!/^\d+$/.test(fps)) add('fps', 'FPS must be an integer.');
          if (!normalizeNames(values.testers).length) add('testers', 'At least one tester is required.');
          break;
        }
        case 'vpx': {
          if (!hasText(values.vpxVPSId)) add('vpxVPSId', 'A VPX file must be selected.');
          validateChecksum('vpxChecksum', 'VPX Checksum', { required: true });
          const bundledPair = Array.isArray(values.vpxChecksum)
            ? values.vpxChecksum.filter(entry => String(entry || '').trim()).length
            : 0;
          if (values.specialDMDBundled === true && bundledPair < 2) {
            add('vpxChecksum', 'A bundled DMD needs both the archive and .vpx checksums.');
          }
          break;
        }
        case 'b2s':
          validateChecksum('backglassChecksum', 'Backglass Checksum', { required: true });
          if (hasText(values.backglassUrlOverride) && !hasText(values.backglassNotes)) {
            add('backglassNotes', 'Backglass Notes are required when using Backglass URL Override.');
          }
          if (values.backglassBundled === true && !hasText(values.backglassNotes)) {
            add('backglassNotes', 'Bundled Backglass entries require notes.');
          }
          break;
        case 'rom':
          validateChecksum('romChecksum', 'ROM Checksum', { required: true });
          if (hasText(values.romUrlOverride) && hasText(values.romVPSId)) {
            add('romVPSId', 'ROM VPS ID conflicts with ROM URL Override.');
            add('romUrlOverride', 'Use either ROM VPS ID or ROM URL Override, not both.');
          }
          if (hasText(values.romUrlOverride) && !hasText(values.romVersionOverride)) {
            add('romVersionOverride', 'ROM Version Override is required when using a URL override.');
          }
          if (hasText(values.romUrlOverride) && !hasText(values.romNotes)) {
            add('romNotes', 'ROM Notes are required when using ROM URL Override.');
          }
          if (values.romBundled === true && !hasText(values.romNotes)) {
            add('romNotes', 'Bundled ROM entries require notes.');
          }
          break;
        case 'coloredRom': {
          validateChecksum('coloredROMChecksum', 'Color ROM Checksum', { required: true });
          if (values.coloredROMPin2DMD === true) {
            validateChecksum('coloredROMChecksumSecondary', 'Color ROM VNI Checksum', { required: true });
          }
          if (hasText(values.coloredROMUrlOverride) && !hasText(values.coloredROMNotes)) {
            add('coloredROMNotes', 'Color ROM Notes are required when using Color ROM URL Override.');
          }
          if (values.coloredROMBundled === true && !hasText(values.coloredROMNotes)) {
            add('coloredROMNotes', 'Bundled Color ROM entries require notes.');
          }
          break;
        }
        case 'pup': {
          validateChecksum('pupChecksum', 'PUP Pack Checksum', { required: true });
          if (values.pupBundled === true && !hasText(values.pupNotes)) {
            add('pupNotes', 'Bundled PUP Pack entries require notes.');
          }
          if (!hasText(values.pupVersion)) add('pupVersion', 'PUP Pack Version is required.');
          if (!hasText(values.pupArchiveRoot)) add('pupArchiveRoot', 'PUP Pack Archive Root is required.');
          if (!hasText(values.pupArchiveFormat)) add('pupArchiveFormat', 'PUP Pack Archive Format is required.');
          break;
        }
        case 'dmd': {
          const dmdBundled = values.specialDMDBundled === true;
          if (!hasText(values.specialDMDType)) add('specialDMDType', 'DMD Type is required.');
          if (!hasText(values.specialDMDArchiveRoot)) add('specialDMDArchiveRoot', 'DMD Archive Root is required.');
          if (!hasText(values.specialDMDArchiveFormat)) add('specialDMDArchiveFormat', 'DMD Archive Format is required.');
          if (!dmdBundled) {
            validateChecksum('specialDMDChecksum', 'DMD Checksum', { required: true });
            if (!hasText(values.specialDMDUrlOverride)) add('specialDMDUrlOverride', 'DMD URL Override is required.');
            if (!hasText(values.specialDMDVersion)) add('specialDMDVersion', 'DMD Version is required.');
          }
          break;
        }
        case 'vpuPatch':
          validateChecksum('diffChecksum', 'VPU Patch Checksum');
          if (hasText(values.diffUrlOverride) && !hasText(values.diffNotes)) {
            add('diffNotes', 'Patch Notes are required when using Patch URL Override.');
          }
          if (values.diffBundled === true && !hasText(values.diffNotes)) {
            add('diffNotes', 'Bundled VPU Patch entries require notes.');
          }
          break;
        default:
          break;
      }

      if (step.overrideField && values[step.overrideField] === true) {
        (step.overrideRequiredFields || []).forEach(key => {
          if (!hasText(values[key])) {
            const label = step.fields.find(field => field.yml_field === key)?.name || key;
            add(key, `${label} is required when Override is enabled.`);
          }
        });
      }

      errors.forEach((messages, fieldName) => {
        messages.forEach(message => output.push({ system: 'field', type: 'error', stepId: step.id, fieldName, title: '', message }));
      });
    });

    return output;
  }

  function featureIssues(ctx, utils) {
    const { isMd5Hash, normalizeArray } = utils;
    const { record, selections, values } = ctx;
    const output = [];
    const add = (stepId, fieldName, title, message) => output.push({ system: 'feature', type: 'error', stepId, fieldName, title, message });

    const altSoundSelected = Boolean(selections?.altSoundFiles || values?.altSoundVPSId);
    const altSoundBundled = values?.altSoundBundled === true;
    const altSoundOverride = values?.altSoundOverride === true;
    const altSoundUrl = String(values?.altSoundUrlOverride || '').trim();
    const altSoundVersion = String(values?.altSoundVersionOverride || '').trim();
    const altSoundActive = altSoundSelected || altSoundBundled || Boolean(altSoundUrl || altSoundVersion);
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

    const tutorialId = String(values?.tutorialVPSId || '').trim();
    if (tutorialId && !record?.tutorialFiles?.some(item => String(item?.id || '') === tutorialId)) {
      add('main', 'tutorialVPSId', 'Tutorial VPS ID is unavailable', 'Choose an available tutorial for this table.');
    }

    window.VPS_ADDITIONAL_ROMS?.entries?.().forEach((entry, index) => {
      window.VPS_ADDITIONAL_ROMS.validateEntry(entry, index).forEach(message => {
        add('rom', 'additionalRoms', `Additional ROM ${index + 1} needs attention`, message);
      });
    });
    return output;
  }

  function v090Issues(ctx) {
    const { values, isStepEnabled } = ctx;
    const { WIZARD_STEPS } = window.VPS_YML_FIELDS;
    const output = [];
    const add = (stepId, fieldName, title, message) => output.push({ system: 'v090', type: 'error', stepId, fieldName, title, message });
    const readValue = fieldName => (Object.prototype.hasOwnProperty.call(values, fieldName) ? values[fieldName] : '');
    const hasText = value => Array.isArray(value)
      ? value.some(item => String(item || '').trim())
      : String(value ?? '').trim().length > 0;
    const stepEnabled = stepId => {
      const step = WIZARD_STEPS.find(candidate => candidate.id === stepId);
      return Boolean(step && isStepEnabled(step));
    };
    const pair = (stepId, urlField, versionField, label, { urlOptional = false } = {}) => {
      if (!stepEnabled(stepId)) return;
      const hasUrl = hasText(readValue(urlField));
      const hasVersion = hasText(readValue(versionField));
      if (hasUrl && !hasVersion) add(stepId, versionField, `${label} version override is required`, `Add ${label} Version Override when using ${label} URL Override.`);
      if (hasVersion && !hasUrl && !urlOptional) add(stepId, urlField, `${label} URL override is required`, `Add ${label} URL Override when using ${label} Version Override.`);
    };

    // A bundled ROM ships inside the table's own download, so there is no URL
    // to give, but it can still need a Version Override naming the ROM the
    // table loads (Jason's call, 2026-10-02). A URL still needs a version.
    pair('rom', 'romUrlOverride', 'romVersionOverride', 'ROM', { urlOptional: readValue('romBundled') === true });
    pair('coloredRom', 'coloredROMUrlOverride', 'coloredROMVersionOverride', 'Color ROM');
    pair('vpuPatch', 'diffUrlOverride', 'diffVersionOverride', 'Patch');

    if (stepEnabled('b2s') && hasText(readValue('backglassUrlOverride'))) {
      if (!hasText(readValue('backglassAuthorsOverride'))) {
        add('b2s', 'backglassAuthorsOverride', 'Backglass authors override is required', 'Add at least one Backglass Authors Override when using Backglass URL Override.');
      }
      if (!hasText(readValue('backglassImageOverride'))) {
        add('b2s', 'backglassImageOverride', 'Backglass image override is required', 'Add Backglass Image Override when using Backglass URL Override.');
      }
    }

    if (stepEnabled('vpuPatch') && !hasText(readValue('diffChecksum'))) {
      add('vpuPatch', 'diffChecksum', 'VPU Patch Checksum is required', 'Add a valid MD5 value for VPU Patch Checksum.');
    }
    return output;
  }

  function collectAllErrors(ctx) {
    const utils = window.VPS_UTILS;
    const fields = window.VPS_YML_FIELDS;
    const full = { record: null, selections: {}, values: {}, yaml: '', isStepEnabled: () => false, ...ctx };
    return [
      ...buildIssues(full, utils, fields),
      ...fieldIssues(full, fields),
      ...featureIssues(full, utils),
      ...v090Issues(full)
    ];
  }

  window.VPS_VALIDATION = Object.freeze({ collectAllErrors });
})();
