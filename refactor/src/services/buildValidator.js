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

  function issue(type, stepId, title, message) {
    return { type, stepId, title, message };
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
    const addError = (stepId, title, message) => errors.push(issue('error', stepId, title, message));
    const addWarning = (stepId, title, message) => warnings.push(issue('warning', stepId, title, message));
    const hasText = value => typeof value === 'string' ? value.trim() !== '' : value !== undefined && value !== null;

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

    const testers = normalizeArray(values.testers);
    if (!testers.length) {
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
    if (values.backglassBundled === true && !hasText(values.backglassNotes)) {
      addError('b2s', 'Bundled Backglass needs notes', 'Describe the bundled Backglass and where it is located.');
    }

    const romOffered = Boolean(
      selections.romFiles || hasText(values.romUrlOverride) || values.romBundled === true
    );
    validateChecksum('romChecksum', 'rom', 'ROM Checksum', { required: romOffered });
    if (values.romBundled === true && !hasText(values.romNotes)) {
      addError('rom', 'Bundled ROM needs notes', 'Describe the bundled ROM and where it is located.');
    }
    if (hasText(values.romUrlOverride) && values.romVPSId) {
      addError('rom', 'ROM ID conflicts with URL override', 'Use either ROM ID or ROM URL Override, not both.');
    }
    if (hasText(values.romUrlOverride) && !hasText(values.romVersionOverride)) {
      addError('rom', 'ROM version override is required', 'Add ROM Version Override when using ROM URL Override.');
    }

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
      addError('coloredRom', 'PAL/VNI requires two checksums', 'Add the .pal checksum and the .vni checksum.');
    }
    if (values.coloredROMBundled === true && !hasText(values.coloredROMNotes)) {
      addError('coloredRom', 'Bundled Color ROM needs notes', 'Describe the bundled Color ROM and where it is located.');
    }

    const pupOffered = Boolean(selections.pupPackFiles || hasText(values.pupFileUrl));
    validateChecksum('pupChecksum', 'pup', 'PUP Pack Checksum', { required: pupOffered });
    if (isStepEnabled(WIZARD_STEPS.find(step => step.id === 'pup'), selections, values)
      && values.pupRequired === true
      && !hasText(values.pupFileUrl)
      && !selections.pupPackFiles) {
      addError('pup', 'Required PUP Pack needs a source', 'Select a PUP Pack VPS entry or add the PUP Pack URL.');
    }

    validateChecksum('diffChecksum', 'vpuPatch', 'VPU Patch Checksum');

    const yamlLines = yaml.split('\n');
    const longLine = yamlLines.find((line, index) => {
      if (line.length <= 120) return false;
      const previous = yamlLines[index - 1] || '';
      return previous.trim() !== '# yamllint disable-line rule:line-length';
    });
    if (longLine) {
      addError('main', 'YAML line exceeds 120 characters', 'Shorten the value or use a supported URL field so the generated file passes yamllint.');
    }

    return { errors, warnings };
  }

  window.VPS_BUILD_VALIDATOR = Object.freeze({
    validate,
    isStepEnabled,
    issue
  });
})();