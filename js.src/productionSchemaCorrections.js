(() => {
  'use strict';

  const fields = window.VPS_YML_FIELDS;
  if (!fields?.WIZARD_STEPS) return;

  const step = id => fields.WIZARD_STEPS.find(item => item.id === id);
  const byKey = (list, key) => list.find(item => item.yml_field === key);
  const order = (list, keys) => keys.map(key => byKey(list, key)).filter(Boolean);

  const main = step('main');
  if (main) {
    const enabled = byKey(main.fields, 'enabled');
    if (enabled) {
      enabled.name = 'Wizard Disabled';
      enabled.tooltip = 'Checked keeps this table disabled for Wizard. Uncheck to explicitly enable it.';
    }
    const tutorial = byKey(main.fields, 'tutorialVPSId');
    if (tutorial) {
      tutorial.advanced = false;
      delete tutorial.conditionalRecordArray;
      tutorial.options = [{ label: 'No tutorials available', value: '' }];
    }
    main.fields = order(main.fields, [
      'tableVPSId', 'fps', 'tutorialVPSId', 'enabled',
      'tagline', 'mainNotes', 'testers',
      'tableNameOverride', 'tableManufacturerOverride', 'tableYearOverride'
    ]);
  }

  const pup = step('pup');
  if (pup) {
    pup.fields = order(pup.fields, [
      'pupVPSId', 'pupChecksum', 'pupNotes',
      'pupVersion', 'pupFileUrl',
      'pupArchiveRoot', 'pupArchiveFormat', 'pupRequired'
    ]);
  }

  const altSound = step('altSound');
  if (altSound) {
    const existing = altSound.fields;
    const root = byKey(existing, 'altSoundArchiveRoot');
    if (root) {
      root.type = 'str';
      root.hideLabel = false;
      root.placeholder = 'Alt Sound Archive Root';
    }
    ['altSoundAuthorsOverride', 'altSoundUrlOverride', 'altSoundVersionOverride'].forEach(key => {
      const field = byKey(existing, key);
      if (field) field.advanced = true;
    });
    altSound.fields = order(existing, [
      'altSoundVPSId', 'altSoundChecksum', 'altSoundNotes',
      'altSoundArchiveRoot', 'altSoundArchiveFormat',
      'altSoundAuthorsOverride', 'altSoundUrlOverride', 'altSoundVersionOverride',
      '__altSoundArchiveDirectories'
    ]);
  }

  fields.PRESET_FIELDS.delete('altSoundArchiveFormat');
})();