(() => {
  'use strict';

  const { CATEGORY_CONFIG, WIZARD_STEPS } = window.VPS_YML_FIELDS || {};
  const utilities = window.VPS_UTILS;
  if (!CATEGORY_CONFIG || !Array.isArray(WIZARD_STEPS) || !utilities) return;

  const {
    getCategoryItems,
    isItemBroken,
    normalizeArray,
    isMd5Hash,
    normalizeChecksumValue
  } = utilities;

  function issue(type, stepId, title, message, fieldName = '') {
    const entry = { type, stepId, title, message };
    if (fieldName) entry.fieldName = fieldName;
    return entry;
  }

  function isStepEnabled(step, selections = {}, values = {}) {
    if (!step) return false;
    if (step.always) return true;
    if (step.category && selections[step.category]) return true;
    if (step.bundleField && values[step.bundleField] === true) return true;
    return false;
  }

  function validate(context = {}) {
    const record = context.record || null;
    const selections = context.selections || {};
    const values = context.values || {};
    const yaml = String(context.yaml || '---\n');
    const errors = [];
    const warnings = [];

    const addError = (stepId, title, message, fieldName = '') => {
      errors.push(issue('error', stepId, title, message, fieldName));
    };
    const addWarning = (stepId, title, message, fieldName = '') => {
      warnings.push(issue('warning', stepId, title, message, fieldName));
    };
    const hasText = value => {
      if (Array.isArray(value)) return value.some(item => String(item || '').trim());
      if (typeof value === 'string') return value.trim() !== '';
      return value !== undefined && value !== null;
    };

    if (!record) addError('main', 'No table selected', 'Search for and load a VPS table first.');
    if (!values.tableVPSId) {
      addError('main', 'Missing table VPS ID', 'The selected table does not have a usable VPS ID.', 'tableVPSId');
    }
    if (!selections.tableFiles || !values.vpxVPSId) {
      addError('vpx', 'VPX file required', 'Select a VPX file before copying or downloading the configuration.', 'vpxVPSId');
    }

    const fpsRaw = values.fps;
    if (fpsRaw === '' || fpsRaw === undefined || fpsRaw === null) {
      addError('main', 'FPS is required', 'Enter the table frame rate as an integer.', 'fps');
    } else if (!/^\d+$/.test(String(fpsRaw)) || !Number.isInteger(Number(fpsRaw))) {
      addError('main', 'FPS must be an integer', 'Use numbers only for FPS.', 'fps');
    }

    const testers = normalizeArray(values.testers);
    if (!testers.length) {
      addError('main', 'Testers are required', 'Enter at least one tester; separate multiple names with commas.', 'testers');
    }

    Object.entries(CATEGORY_CONFIG).forEach(([category, config]) => {
      const selectedId = selections[category];
      const items = getCategoryItems(record, category, config, { selections });
      const item = items.find(candidate => String(candidate.id || '') === String(selectedId || ''));

      if (config.bundleField && selectedId && values[config.bundleField] === true) {
        addWarning(
          config.stepId,
          `${config.label} selected and bundled`,
          'Choose either a separate VPS entry or bundled status unless both are intentionally required.',
          config.idField
        );
      }
      if (selectedId && !item) {
        addError(
          config.stepId,
          `${config.label} ID is unavailable`,
          'Choose an available VPS entry before copying or downloading.',
          config.idField
        );
      } else if (item && isItemBroken(item)) {
        addError(
          config.stepId,
          `${config.label} entry is broken`,
          'Choose another database entry before copying or downloading.',
          config.idField
        );
      }
    });

    const validateChecksum = (key, stepId, label, options = {}) => {
      const rawValue = options.value !== undefined ? options.value : values[key];
      const hashes = normalizeChecksumValue(rawValue);
      if (options.required && !hashes.length) {
        addError(stepId, `${label} is required`, `Add a valid MD5 value for ${label}.`, key);
        return;
      }
      if (!hashes.length) return;
      if (Array.isArray(rawValue) && hashes.length < 2) {
        addError(
          stepId,
          `${label} list is invalid`,
          'Use a plain string for one checksum or a list containing at least two checksums.',
          key
        );
      }
      hashes.forEach(hash => {
        if (!isMd5Hash(hash)) {
          addError(
            stepId,
            `${label} is not a valid MD5`,
            'Each checksum must contain exactly 32 hexadecimal characters.',
            key
          );
        }
      });
    };

    const validateUrlVersionPair = (stepId, urlField, versionField, label) => {
      const hasUrl = hasText(values[urlField]);
      const hasVersion = hasText(values[versionField]);
      if (hasUrl && !hasVersion) {
        addError(
          stepId,
          `${label} version override is required`,
          `Add ${label} Version Override when using ${label} URL Override.`,
          versionField
        );
      }
      if (hasVersion && !hasUrl) {
        addError(
          stepId,
          `${label} URL override is required`,
          `Add ${label} URL Override when using ${label} Version Override.`,
          urlField
        );
      }
    };

    validateChecksum('vpxChecksum', 'vpx', 'VPX Checksum', { required: true });

    const backglassOffered = Boolean(
      selections.b2sFiles || hasText(values.backglassUrlOverride) || values.backglassBundled === true
    );
    validateChecksum('backglassChecksum', 'b2s', 'Backglass Checksum', { required: backglassOffered });
    if (values.backglassBundled === true && !hasText(values.backglassNotes)) {
      addError(
        'b2s',
        'Bundled Backglass needs notes',
        'Describe the bundled Backglass and where it is located.',
        'backglassNotes'
      );
    }
    if (hasText(values.backglassUrlOverride)) {
      if (!hasText(values.backglassAuthorsOverride)) {
        addError(
          'b2s',
          'Backglass authors override is required',
          'Add at least one Backglass Authors Override when using Backglass URL Override.',
          'backglassAuthorsOverride'
        );
      }
      if (!hasText(values.backglassImageOverride)) {
        addError(
          'b2s',
          'Backglass image override is required',
          'Add Backglass Image Override when using Backglass URL Override.',
          'backglassImageOverride'
        );
      }
    }

    const romOffered = Boolean(
      selections.romFiles || hasText(values.romUrlOverride) || values.romBundled === true
    );
    validateChecksum('romChecksum', 'rom', 'ROM Checksum', { required: romOffered });
    if (values.romBundled === true && !hasText(values.romNotes)) {
      addError('rom', 'Bundled ROM needs notes', 'Describe the bundled ROM and where it is located.', 'romNotes');
    }
    if (hasText(values.romUrlOverride) && values.romVPSId) {
      addError(
        'rom',
        'ROM ID conflicts with URL override',
        'Use either ROM ID or ROM URL Override, not both.',
        'romVPSId'
      );
    }
    validateUrlVersionPair('rom', 'romUrlOverride', 'romVersionOverride', 'ROM');

    const colorOffered = Boolean(
      selections.altColorFiles || hasText(values.coloredROMUrlOverride) || values.coloredROMBundled === true
    );
    const colorPrimary = String(values.coloredROMChecksum || '').trim();
    const colorSecondary = String(values.coloredROMChecksumSecondary || '').trim();
    const colorValue = values.coloredROMPin2DMD === true
      ? [colorPrimary, colorSecondary].filter(Boolean)
      : colorPrimary;

    validateChecksum('coloredROMChecksum', 'coloredRom', 'Color ROM Checksum', {
      required: colorOffered,
      value: colorValue
    });
    if (values.coloredROMPin2DMD === true && (!colorPrimary || !colorSecondary)) {
      addError(
        'coloredRom',
        'PAL/VNI requires two checksums',
        'Add the .pal checksum and the .vni checksum.',
        !colorPrimary ? 'coloredROMChecksum' : 'coloredROMChecksumSecondary'
      );
    }
    if (values.coloredROMBundled === true && !hasText(values.coloredROMNotes)) {
      addError(
        'coloredRom',
        'Bundled Color ROM needs notes',
        'Describe the bundled Color ROM and where it is located.',
        'coloredROMNotes'
      );
    }
    validateUrlVersionPair(
      'coloredRom',
      'coloredROMUrlOverride',
      'coloredROMVersionOverride',
      'Color ROM'
    );

    const pupOffered = Boolean(selections.pupPackFiles || hasText(values.pupFileUrl));
    validateChecksum('pupChecksum', 'pup', 'PUP Pack Checksum', { required: pupOffered });
    if (isStepEnabled(WIZARD_STEPS.find(step => step.id === 'pup'), selections, values)
      && values.pupRequired === true
      && !hasText(values.pupFileUrl)
      && !selections.pupPackFiles) {
      addError(
        'pup',
        'Required PUP Pack needs a source',
        'Select a PUP Pack VPS entry or add the PUP Pack URL.',
        'pupFileUrl'
      );
    }

    const patchEnabled = isStepEnabled(
      WIZARD_STEPS.find(step => step.id === 'vpuPatch'),
      selections,
      values
    );
    validateChecksum('diffChecksum', 'vpuPatch', 'VPU Patch Checksum', {
      required: patchEnabled
    });
    validateUrlVersionPair('vpuPatch', 'diffUrlOverride', 'diffVersionOverride', 'Patch');

    const yamlLines = yaml.split('\n');
    const longLine = yamlLines.find((line, index) => {
      if (line.length <= 120) return false;
      const previous = yamlLines[index - 1] || '';
      return previous.trim() !== '# yamllint disable-line rule:line-length';
    });
    if (longLine) {
      addError(
        'main',
        'YAML line exceeds 120 characters',
        'Shorten the value or use a supported URL field so the generated file passes yamllint.'
      );
    }

    return { errors, warnings };
  }

  window.VPS_BUILD_VALIDATOR = Object.freeze({
    validate,
    isStepEnabled,
    issue
  });
})();
