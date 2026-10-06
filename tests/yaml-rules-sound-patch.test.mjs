// One scenario per validation rule: the Alt Sound and VPU Patch tabs.
//
// Piece B of the YAML run-through; see yaml-rules-main.test.mjs for how these
// files are built and yaml-scenarios.mjs for the runner.
//   SNAPSHOT=print node tests/yaml-rules-sound-patch.test.mjs

import { report } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, scenario } = await startScenarios();

const MD5_VPX = 'E6DF3800F7C9286FA195E84034DA683A';
const MD5_SOUND = '9CC6161300C1E0AC76D73EC6B847EE7C';
const MD5_PATCH = '32EFAB94D0B710EE89C401B8DD3D6850';
const URL = 'https://example.com/download.zip';
const MAIN = [['fill', 'fps', '60'], ['fill', 'testers', 'Tester']];

// Lord of the Rings, for its VPS Alt Sound.
const LOTR = [['search', '5RybGX4Q'], ['asset', 'tableFiles', 'ulolpyXq'], ...MAIN, ['fill', 'vpxChecksum', MD5_VPX]];
const SOUND = [...LOTR, ['asset', 'altSoundFiles', '6vSAjw2Gmk'], ['fill', 'altSoundChecksum', MD5_SOUND], ['fill', 'altSoundArchiveFormat', 'rar']];
// An Alt Sound with no VPS entry: Override and every field it asks for.
const SOUND_OVERRIDE = {
  altSoundChecksum: MD5_SOUND,
  altSoundArchiveFormat: 'rar',
  altSoundNotes: 'Download - lotr.rar',
  altSoundArchiveRoot: 'lotr',
  altSoundAuthorsOverride: 'Somebody',
  altSoundUrlOverride: URL,
  altSoundVersionOverride: '1.0'
};
const soundOverrideWithout = (...left) => [...LOTR, ['override', 'altSoundFiles', true], ...Object.entries(SOUND_OVERRIDE)
  .filter(([key]) => !left.includes(key))
  .map(([key, value]) => ['fill', key, value])];

// Tales from the Crypt with VPX uVgZUZdK: a patch is only offered once its
// parent VPX is picked, and the table's one patch, TJMo9ycfSP, is this one's.
const TFTC = [['search', 'fXaQ33KC'], ['asset', 'tableFiles', 'uVgZUZdK'], ...MAIN, ['fill', 'vpxChecksum', MD5_VPX]];
const PATCH = [...TFTC, ['asset', 'vpuPatchFiles', 'TJMo9ycfSP'], ['fill', 'diffChecksum', MD5_PATCH]];

await scenario('clean Alt Sound', SOUND, {
  keys: ['altSoundArchiveFormat', 'altSoundChecksum', 'altSoundVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'success: Everything looks good. | The build is ready to copy or download.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: ready', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [],
  download: '5RybGX4Q_table-config.yml',
  downloadMatchesPreview: true
});
await scenario('clean Alt Sound by Override', soundOverrideWithout(), {
  keys: ['altSoundArchiveFormat', 'altSoundArchiveRoot', 'altSoundAuthorsOverride', 'altSoundChecksum', 'altSoundNotes', 'altSoundUrlOverride', 'altSoundVersionOverride', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'success: Everything looks good. | The build is ready to copy or download.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: ready', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [],
  download: '5RybGX4Q_table-config.yml',
  downloadMatchesPreview: true
});
await scenario('clean VPU Patch', PATCH, {
  keys: ['diffChecksum', 'diffVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'success: Everything looks good. | The build is ready to copy or download.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: ready', 'dmd: disabled'],
  dots: [],
  download: 'fXaQ33KC_table-config.yml',
  downloadMatchesPreview: true
});

// --- Alt Sound -------------------------------------------------------------

await scenario('Alt Sound checksum not an MD5', [...SOUND, ['fill', 'altSoundChecksum', 'NOT-A-HASH']], {
  rule: 'Alt Sound Checksum is not a valid MD5',
  keys: ['altSoundArchiveFormat', 'altSoundChecksum', 'altSoundVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Alt Sound Checksum is not a valid MD5 | Each checksum must contain exactly 32 hexadecimal characters.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: 1 error', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'altSound field-altSoundChecksum: Each checksum must contain exactly 32 hexadecimal characters.'
  ],
  download: 'blocked'
});
await scenario('Alt Sound archive format empty', [...SOUND, ['fill', 'altSoundArchiveFormat', '']], {
  rule: 'Alt Sound Archive Format is required',
  keys: ['altSoundChecksum', 'altSoundVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Alt Sound Archive Format is required | Choose ZIP, RAR, or 7Z.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: 1 error', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'altSound field-altSoundArchiveFormat: Choose ZIP, RAR, or 7Z.'
  ],
  download: 'blocked'
});
await scenario('Alt Sound picked from VPS and given a URL too', [...SOUND,
  ['fill', 'altSoundUrlOverride', URL], ['fill', 'altSoundVersionOverride', '1.0'], ['fill', 'altSoundNotes', 'From the URL']
], {
  rule: 'Choose one Alt Sound source',
  keys: ['altSoundArchiveFormat', 'altSoundChecksum', 'altSoundNotes', 'altSoundUrlOverride', 'altSoundVersionOverride', 'altSoundVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Choose one Alt Sound source | Use either Alt Sound VPS ID or Alt Sound URL Override, not both.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: 1 error', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'altSound field-altSoundUrlOverride: Use either Alt Sound VPS ID or Alt Sound URL Override, not both.'
  ],
  download: 'blocked'
});
await scenario('Alt Sound URL without a version', soundOverrideWithout('altSoundVersionOverride'), {
  rule: 'Alt Sound Version Override is required',
  keys: ['altSoundArchiveFormat', 'altSoundArchiveRoot', 'altSoundAuthorsOverride', 'altSoundChecksum', 'altSoundNotes', 'altSoundUrlOverride', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Alt Sound Version Override is required | Add Alt Sound Version Override — Override requires every Advanced Config field since there is no VPS entry to pull it from.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: 2 errors', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'altSound field-altSoundVersionOverride: Alt Sound Version Override is required when Override is enabled.',
    'altSound field-altSoundVersionOverride: Add Alt Sound Version Override whenever Alt Sound URL Override is used.'
  ],
  download: 'blocked'
});
await scenario('Alt Sound version without a URL', [...SOUND, ['fill', 'altSoundVersionOverride', '1.0']], {
  rule: 'Alt Sound URL Override is required',
  keys: ['altSoundArchiveFormat', 'altSoundChecksum', 'altSoundVersionOverride', 'altSoundVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Alt Sound URL Override is required | Add Alt Sound URL Override whenever Alt Sound Version Override is used.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: 1 error', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'altSound field-altSoundUrlOverride: Add Alt Sound URL Override whenever Alt Sound Version Override is used.'
  ],
  download: 'blocked'
});
await scenario('Alt Sound URL without notes', soundOverrideWithout('altSoundNotes'), {
  rule: 'Alt Sound Notes are required',
  keys: ['altSoundArchiveFormat', 'altSoundArchiveRoot', 'altSoundAuthorsOverride', 'altSoundChecksum', 'altSoundUrlOverride', 'altSoundVersionOverride', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Alt Sound Notes is required | Add Alt Sound Notes — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: Alt Sound Notes are required | Add Alt Sound Notes when using Alt Sound URL Override.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: 2 errors', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'altSound field-altSoundNotes: Alt Sound Notes is required when Override is enabled.',
    'altSound field-altSoundNotes: Add Alt Sound Notes when using Alt Sound URL Override.'
  ],
  download: 'blocked'
});
await scenario('Alt Sound bundled without notes', [...LOTR,
  ['bundle', 'altSoundFiles', true], ['fill', 'altSoundChecksum', MD5_SOUND], ['fill', 'altSoundArchiveFormat', 'rar'], ['fill', 'altSoundArchiveRoot', 'lotr']
], {
  rule: 'Alt Sound Notes are required',
  keys: ['altSoundArchiveFormat', 'altSoundArchiveRoot', 'altSoundBundled', 'altSoundChecksum', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Alt Sound Notes are required | Add Alt Sound Notes when the Alt Sound ships inside the table download.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: 1 error', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'altSound field-altSoundNotes: Add Alt Sound Notes when the Alt Sound ships inside the table download.'
  ],
  download: 'blocked'
});
await scenario('Alt Sound bundled without an archive root', [...LOTR,
  ['bundle', 'altSoundFiles', true], ['fill', 'altSoundChecksum', MD5_SOUND], ['fill', 'altSoundArchiveFormat', 'rar'], ['fill', 'altSoundNotes', 'In the table download']
], {
  rule: 'Alt Sound Archive Root is required',
  keys: ['altSoundArchiveFormat', 'altSoundBundled', 'altSoundChecksum', 'altSoundNotes', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Alt Sound Archive Root is required | Choose the Alt Sound root folder from the uploaded Alt Sound archive.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: 1 error', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'altSound field-altSoundArchiveRoot: Choose the Alt Sound root folder from the uploaded Alt Sound archive.'
  ],
  download: 'blocked'
});
await scenario('Alt Sound override with nothing filled', [...LOTR, ['override', 'altSoundFiles', true]], {
  rule: 'Alt Sound Checksum is required',
  keys: ['fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Alt Sound Notes is required | Add Alt Sound Notes — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: Alt Sound Archive Root is required | Add Alt Sound Archive Root — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: Alt Sound Authors Override is required | Add Alt Sound Authors Override — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: Alt Sound URL Override is required | Add Alt Sound URL Override — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: Alt Sound Version Override is required | Add Alt Sound Version Override — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: Alt Sound Checksum is required | Add a valid MD5 value for Alt Sound Checksum.',
    'error: Alt Sound Archive Format is required | Choose ZIP, RAR, or 7Z.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: 7 errors', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'altSound field-altSoundChecksum: Add a valid MD5 value for Alt Sound Checksum.',
    'altSound field-altSoundNotes: Alt Sound Notes is required when Override is enabled.',
    'altSound field-altSoundArchiveRoot: Alt Sound Archive Root is required when Override is enabled.',
    'altSound field-altSoundArchiveFormat: Choose ZIP, RAR, or 7Z.',
    'altSound field-altSoundAuthorsOverride: Alt Sound Authors Override is required when Override is enabled.',
    'altSound field-altSoundUrlOverride: Alt Sound URL Override is required when Override is enabled.',
    'altSound field-altSoundVersionOverride: Alt Sound Version Override is required when Override is enabled.'
  ],
  download: 'blocked'
});

// --- VPU Patch -------------------------------------------------------------

await scenario('VPU Patch checksum empty', [...TFTC, ['asset', 'vpuPatchFiles', 'TJMo9ycfSP']], {
  rule: 'VPU Patch Checksum is required',
  keys: ['diffVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: VPU Patch Checksum is required | Add a valid MD5 value for VPU Patch Checksum.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: 1 error', 'dmd: disabled'],
  dots: [
    'vpuPatch field-diffChecksum: Add a valid MD5 value for VPU Patch Checksum.'
  ],
  download: 'blocked'
});
await scenario('VPU Patch checksum not an MD5', [...PATCH, ['fill', 'diffChecksum', 'NOT-A-HASH']], {
  rule: 'VPU Patch Checksum is not a valid MD5',
  keys: ['diffChecksum', 'diffVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: VPU Patch Checksum is not a valid MD5 | Each checksum must contain exactly 32 hexadecimal characters.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: 1 error', 'dmd: disabled'],
  dots: [
    'vpuPatch field-diffChecksum: VPU Patch Checksum must be a 32-character MD5 value.'
  ],
  download: 'blocked'
});
// Defensive: a list of one is never written by the app or kept by the importer.
// Also the one route to the fallback dot on this tab, which lands on the
// VPU Patch ID and is removed there (NO_DOT_FIELDS in uiEnhancements.js).
await scenario('VPU Patch checksum list of one (from a draft)', [...PATCH, ['draft', 'values.diffChecksum', [MD5_PATCH]]], {
  rule: 'VPU Patch Checksum list is invalid',
  keys: ['diffChecksum', 'diffVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: VPU Patch Checksum list is invalid | Use a plain string for one checksum or a list containing at least two checksums.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: 1 error', 'dmd: disabled'],
  dots: [],
  download: 'blocked'
});
await scenario('Patch URL without notes', [...PATCH, ['fill', 'diffUrlOverride', URL], ['fill', 'diffVersionOverride', '1.0']], {
  rule: 'Patch Notes are required',
  keys: ['diffChecksum', 'diffUrlOverride', 'diffVersionOverride', 'diffVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Patch Notes are required | Add Patch Notes when using Patch URL Override.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: 1 error', 'dmd: disabled'],
  dots: [
    'vpuPatch field-diffNotes: Patch Notes are required when using Patch URL Override.'
  ],
  download: 'blocked'
});
await scenario('Patch URL without a version', [...PATCH, ['fill', 'diffUrlOverride', URL], ['fill', 'diffNotes', 'From the URL']], {
  rule: 'Patch version override is required',
  keys: ['diffChecksum', 'diffNotes', 'diffUrlOverride', 'diffVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Patch version override is required | Add Patch Version Override when using Patch URL Override.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: 1 error', 'dmd: disabled'],
  dots: [
    'vpuPatch field-diffVersionOverride: Add Patch Version Override when using Patch URL Override.'
  ],
  download: 'blocked'
});
await scenario('Patch version without a URL', [...PATCH, ['fill', 'diffVersionOverride', '1.0']], {
  rule: 'Patch URL override is required',
  keys: ['diffChecksum', 'diffVersionOverride', 'diffVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Patch URL override is required | Add Patch URL Override when using Patch Version Override.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: 1 error', 'dmd: disabled'],
  dots: [
    'vpuPatch field-diffUrlOverride: Add Patch URL Override when using Patch Version Override.'
  ],
  download: 'blocked'
});
await scenario('VPU Patch bundled without notes', [...TFTC, ['bundle', 'vpuPatchFiles', true], ['fill', 'diffChecksum', MD5_PATCH]], {
  rule: 'Bundled VPU Patch needs notes',
  keys: ['diffBundled', 'diffChecksum', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Bundled VPU Patch needs notes | Describe the bundled VPU Patch and where it is located.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: 1 error', 'dmd: disabled'],
  dots: [
    'vpuPatch field-diffNotes: Bundled VPU Patch entries require notes.'
  ],
  download: 'blocked'
});
await scenario('VPU Patch override with nothing filled', [...TFTC, ['override', 'vpuPatchFiles', true], ['fill', 'diffChecksum', MD5_PATCH]], {
  rule: 'Patch Notes is required',
  keys: ['diffChecksum', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Patch Notes is required | Add Patch Notes — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: Patch Authors Override is required | Add Patch Authors Override — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: Patch URL Override is required | Add Patch URL Override — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: Patch Version Override is required | Add Patch Version Override — Override requires every Advanced Config field since there is no VPS entry to pull it from.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: 4 errors', 'dmd: disabled'],
  dots: [
    'vpuPatch field-diffNotes: Patch Notes is required when Override is enabled.',
    'vpuPatch field-diffAuthorsOverride: Patch Authors Override is required when Override is enabled.',
    'vpuPatch field-diffUrlOverride: Patch URL Override is required when Override is enabled.',
    'vpuPatch field-diffVersionOverride: Patch Version Override is required when Override is enabled.'
  ],
  download: 'blocked'
});

await app.close();
report('yaml-rules-sound-patch');
