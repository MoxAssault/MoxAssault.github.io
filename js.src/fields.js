(() => {
  'use strict';

  const CATEGORY_CONFIG = {
    tableFiles: {
      label: 'VPX', singular: 'VPX file', stepId: 'vpx', idField: 'vpxVPSId', required: true, supportsImage: true
    },
    b2sFiles: {
      label: 'B2S', singular: 'B2S file', stepId: 'b2s', idField: 'backglassVPSId', bundleField: 'backglassBundled', supportsImage: true
    },
    romFiles: {
      label: 'ROM', singular: 'ROM file', stepId: 'rom', idField: 'romVPSId', bundleField: 'romBundled'
    },
    altColorFiles: {
      label: 'Color ROM', singular: 'Color ROM file', stepId: 'coloredRom', idField: 'coloredROMVPSId', bundleField: 'coloredROMBundled'
    },
    pupPackFiles: {
      label: 'PUP Pack', singular: 'PUP Pack', stepId: 'pup', idField: 'pupVPSId', bundleField: 'pupBundled'
    },
    altSoundFiles: {
      label: 'Alt Sound', singular: 'Alt Sound file', stepId: 'altSound', idField: 'altSoundVPSId', bundleField: 'altSoundBundled',
      sourceFields: ['altSoundFiles'], optionFormat: 'id-version-author'
    },
    vpuPatchFiles: {
      label: 'VPU Patch', singular: 'VPU Patch file', stepId: 'vpuPatch', idField: 'diffVPSId', bundleField: 'diffBundled',
      sourceFields: ['vpuPatchFiles', 'vpuPatches', 'patchFiles']
    }
  };

  const BUNDLE_FIELDS = [
    { name: 'B2S', yml_field: 'backglassBundled' },
    { name: 'ROM', yml_field: 'romBundled' },
    { name: 'Color ROM', yml_field: 'coloredROMBundled' },
    { name: 'PUP Pack', yml_field: 'pupBundled' },
    { name: 'Alt Sound', yml_field: 'altSoundBundled' },
    { name: 'VPU Patch', yml_field: 'diffBundled' }
  ];

  const WIZARD_STEPS = [
    {
      id: 'main', label: 'Main', legend: 'Main Configuration', always: true,
      fields: [
        { name: 'Game VPS ID', yml_field: 'tableVPSId', type: 'str', readonly: true },
        { name: 'FPS', yml_field: 'fps', type: 'int', min: 1, max: 99, maxlength: 2 },
        {
          name: 'Wizard Disabled', yml_field: 'enabled', type: 'bool', invertBoolean: true, stackedLabel: true,
          tooltip: 'Checked keeps this table disabled for Wizard. Uncheck to explicitly enable it.'
        },
        { name: 'Tagline', yml_field: 'tagline', type: 'str', wide: true, responsiveTextarea: true },
        { name: 'Main Notes', yml_field: 'mainNotes', type: 'str', multiline: true, wide: true },
        { name: 'Testers', yml_field: 'testers', type: 'array', multiline: true, wide: true, placeholder: 'name, name, name' },
        { name: 'Table Name Override', yml_field: 'tableNameOverride', type: 'str', wide: true, advanced: true },
        { name: 'Table Manufacturer Override', yml_field: 'tableManufacturerOverride', type: 'str', advanced: true },
        { name: 'Year Override', yml_field: 'tableYearOverride', type: 'int', maxlength: 4, advanced: true },
        {
          name: 'Tutorial VPS ID', yml_field: 'tutorialVPSId', type: 'select',
          dynamicOptionsSource: 'tutorialFiles', optionFormat: 'id-author',
          options: [{ label: 'Select a tutorial', value: '' }]
        }
      ]
    },
    {
      id: 'vpx', label: 'VPX', legend: 'VPX File', category: 'tableFiles',
      fields: [
        { name: 'VPX ID', yml_field: 'vpxVPSId', type: 'str', readonly: true, wide: true },
        { name: 'VPX Checksum', yml_field: 'vpxChecksum', type: 'str', wide: true, checksumExtensions: ['.vpx'] },
        { name: 'VPX Notes', yml_field: 'tableNotes', type: 'str', multiline: true, wide: true }
      ]
    },
    {
      id: 'b2s', label: 'Backglass', legend: 'Backglass (B2S)', category: 'b2sFiles', bundleField: 'backglassBundled',
      fields: [
        { name: 'Backglass ID', yml_field: 'backglassVPSId', type: 'str', readonly: true, wide: true },
        { name: 'Backglass Checksum', yml_field: 'backglassChecksum', type: 'str', wide: true, checksumExtensions: ['.directb2s'] },
        { name: 'Backglass Notes', yml_field: 'backglassNotes', type: 'str', multiline: true, wide: true },
        { name: 'Backglass Authors Override', yml_field: 'backglassAuthorsOverride', type: 'array', wide: true, placeholder: 'name, name, name', advanced: true },
        { name: 'Backglass Image Override', yml_field: 'backglassImageOverride', type: 'str', wide: true, advanced: true },
        { name: 'Backglass URL Override', yml_field: 'backglassUrlOverride', type: 'url', wide: true, advanced: true }
      ]
    },
    {
      id: 'rom', label: 'ROM', legend: 'ROM File', category: 'romFiles', bundleField: 'romBundled',
      fields: [
        { name: 'ROM ID', yml_field: 'romVPSId', type: 'str', readonly: true, wide: true },
        { name: 'ROM Checksum', yml_field: 'romChecksum', type: 'str', wide: true, checksumExtensions: ['.zip', '.rar', '.7z'] },
        { name: 'ROM Notes', yml_field: 'romNotes', type: 'str', multiline: true, wide: true },
        { name: 'ROM URL Override', yml_field: 'romUrlOverride', type: 'url', wide: true, advanced: true },
        { name: 'ROM Version Override', yml_field: 'romVersionOverride', type: 'str', wide: true, advanced: true },
        { name: 'Additional ROMs', yml_field: 'additionalRoms', type: 'additional-roms', advanced: true, customRenderer: true }
      ]
    },
    {
      id: 'coloredRom', label: 'Color ROM', legend: 'Color ROM', category: 'altColorFiles', bundleField: 'coloredROMBundled',
      fields: [
        { name: 'Color ROM ID', yml_field: 'coloredROMVPSId', type: 'str', readonly: true, wide: true },
        {
          name: 'Color ROM Checksum', yml_field: 'coloredROMChecksum', type: 'str', wide: true,
          checksumExtensionsByFlag: {
            field: 'coloredROMPin2DMD',
            false: ['.crz', '.pal', '.pac'],
            true: ['.pal', '.vni']
          }
        },
        { name: 'PAL/VNI', yml_field: 'coloredROMPin2DMD', type: 'bool' },
        {
          name: 'Color ROM Checksum #2', yml_field: 'coloredROMChecksumSecondary', type: 'str', wide: true,
          checksumExtensions: ['.pal', '.vni'], disabledUnless: 'coloredROMPin2DMD', omitFromYaml: true, inlineHint: 'ROM name'
        },
        { name: 'Color ROM Notes', yml_field: 'coloredROMNotes', type: 'str', multiline: true, wide: true },
        { name: 'Color ROM URL Override', yml_field: 'coloredROMUrlOverride', type: 'url', wide: true, advanced: true },
        { name: 'Color ROM Version Override', yml_field: 'coloredROMVersionOverride', type: 'str', wide: true, advanced: true }
      ]
    },
    {
      id: 'pup', label: 'PUP Pack', legend: 'PUP Pack', category: 'pupPackFiles', bundleField: 'pupBundled',
      fields: [
        { name: 'PUP Pack ID', yml_field: 'pupVPSId', type: 'str', readonly: true, wide: true },
        {
          name: 'PUP Pack Checksum', yml_field: 'pupChecksum', type: 'str', wide: true,
          checksumExtensions: ['.zip', '.rar', '.7z'], archiveBrowser: true
        },
        { name: 'PUP Pack Notes', yml_field: 'pupNotes', type: 'str', multiline: true, wide: true },
        { name: 'PUP Pack URL', yml_field: 'pupFileUrl', type: 'url', wide: true },
        { name: 'PUP Pack Version', yml_field: 'pupVersion', type: 'str' },
        {
          name: 'PUP Pack Archive Format', yml_field: 'pupArchiveFormat', type: 'select', hideLabel: true,
          options: [
            { label: 'PUP Pack Archive Format', value: '' },
            { label: 'ZIP', value: 'zip' },
            { label: 'RAR', value: 'rar' },
            { label: '7Z', value: '7z' }
          ]
        },
        { name: 'PUP Pack Archive Root', yml_field: 'pupArchiveRoot', type: 'str', directoryPicker: true },
        { name: 'PUP Pack Required', yml_field: 'pupRequired', type: 'bool' }
      ]
    },
    {
      id: 'altSound', label: 'Alt Sound', legend: 'Alt Sound', category: 'altSoundFiles', bundleField: 'altSoundBundled',
      fields: [
        { name: 'Alt Sound ID', yml_field: 'altSoundVPSId', type: 'str', readonly: true, wide: true },
        {
          name: 'Alt Sound Checksum(s)', yml_field: 'altSoundChecksum', type: 'array', wide: true,
          placeholder: 'Alt Sound Checksum(s)'
        },
        { name: 'Alt Sound Notes', yml_field: 'altSoundNotes', type: 'str', multiline: true, wide: true },
        { name: 'Alt Sound URL Override', yml_field: 'altSoundUrlOverride', type: 'url', wide: true },
        { name: 'Alt Sound Version Override', yml_field: 'altSoundVersionOverride', type: 'str' },
        {
          name: 'Alt Sound Archive Format', yml_field: 'altSoundArchiveFormat', type: 'select', hideLabel: true,
          options: [
            { label: 'Alt Sound Archive Format', value: '' },
            { label: 'ZIP', value: 'zip' },
            { label: 'RAR', value: 'rar' },
            { label: '7Z', value: '7z' }
          ]
        },
        { name: 'Alt Sound Authors Override', yml_field: 'altSoundAuthorsOverride', type: 'array', wide: true, placeholder: 'name, name, name' },
        {
          name: 'Alt Sound Archive Root', yml_field: 'altSoundArchiveRoot', type: 'select', hideLabel: true,
          options: [{ label: 'Drop an Alt Sound archive to browse directories', value: '' }]
        },
        { name: 'Alt Sound Bundled', yml_field: 'altSoundBundled', type: 'bool' },
        { name: 'Alt Sound Archive Directories', yml_field: '__altSoundArchiveDirectories', type: 'str', customRenderer: true }
      ]
    },
    {
      id: 'vpuPatch', label: 'VPU Patch', legend: 'VPU Patch', category: 'vpuPatchFiles', bundleField: 'diffBundled',
      fields: [
        { name: 'VPU Patch ID', yml_field: 'diffVPSId', type: 'str', readonly: true, wide: true },
        { name: 'VPU Patch Checksum', yml_field: 'diffChecksum', type: 'str', wide: true, checksumExtensions: ['.dif'] },
        { name: 'Patch Notes', yml_field: 'diffNotes', type: 'str', multiline: true, wide: true },
        { name: 'Patch Authors Override', yml_field: 'diffAuthorsOverride', type: 'array', wide: true, placeholder: 'name, name, name', advanced: true },
        { name: 'Patch URL Override', yml_field: 'diffUrlOverride', type: 'url', wide: true, advanced: true },
        { name: 'Patch Version Override', yml_field: 'diffVersionOverride', type: 'str', wide: true, advanced: true }
      ]
    }
  ];

  const OMIT_FROM_YAML = new Set([
    'coloredROMChecksumSecondary',
    '__pupArchiveDirectories',
    '__altSoundArchiveDirectories',
    '__checksumSources'
  ]);
  const PRESET_FIELDS = new Set(['enabled', 'fps', 'testers', 'pupArchiveFormat', 'altSoundArchiveFormat']);

  window.VPS_YML_FIELDS = {
    CATEGORY_CONFIG,
    BUNDLE_FIELDS,
    WIZARD_STEPS,
    OMIT_FROM_YAML,
    PRESET_FIELDS
  };
})();