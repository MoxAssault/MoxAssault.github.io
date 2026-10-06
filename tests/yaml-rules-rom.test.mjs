// One scenario per validation rule: the ROM and Color ROM tabs, and the
// Additional ROM list.
//
// Piece B of the YAML run-through; see yaml-rules-main.test.mjs for how these
// files are built and yaml-scenarios.mjs for the runner.
//   SNAPSHOT=print node tests/yaml-rules-rom.test.mjs

import { check, report } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, scenario, PRINT } = await startScenarios();

const MD5_VPX = 'E6DF3800F7C9286FA195E84034DA683A';
const MD5_ROM = 'E4C898AFCDCF6FD2A884C77C7FD6C3A9';
const MD5_PAL = '32EFAB94D0B710EE89C401B8DD3D6850';
const MD5_VNI = '9CC6161300C1E0AC76D73EC6B847EE7C';
const MD5_ADD = '1E0F48976BD4AC0B3ED151D74FB96DC5';
const ROM_URL = 'https://example.com/rom.zip';
const MAIN = [['fill', 'fps', '60'], ['fill', 'testers', 'Tester']];

// Pink Floyd, the smallest clean build, plus its one VPS ROM.
const PINK_FLOYD = [['search', 'Lgi1JLk0Vf'], ['asset', 'tableFiles', 'qV3Z3oQ8md'], ...MAIN, ['fill', 'vpxChecksum', MD5_VPX]];
const ROM = [...PINK_FLOYD, ['asset', 'romFiles', 'jgo91P3SSp'], ['fill', 'romChecksum', MD5_ROM]];

// Lord of the Rings, for its VPS Color ROM.
const LOTR = [['search', '5RybGX4Q'], ['asset', 'tableFiles', 'ulolpyXq'], ...MAIN, ['fill', 'vpxChecksum', MD5_VPX]];
const COLOR = [...LOTR, ['asset', 'altColorFiles', 'afptXEiuqn'], ['fill', 'coloredROMChecksum', MD5_PAL]];

await scenario('clean build with a ROM', ROM, {
  keys: ['fps', 'romChecksum', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'success: Everything looks good. | The build is ready to copy or download.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: ready', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [],
  download: 'Lgi1JLk0Vf_table-config.yml',
  downloadMatchesPreview: true
});
await scenario('clean build with a Color ROM', COLOR, {
  keys: ['coloredROMChecksum', 'coloredROMVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'success: Everything looks good. | The build is ready to copy or download.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: ready', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [],
  download: '5RybGX4Q_table-config.yml',
  downloadMatchesPreview: true
});

// --- ROM -------------------------------------------------------------------

await scenario('ROM checksum empty', [...PINK_FLOYD, ['asset', 'romFiles', 'jgo91P3SSp']], {
  rule: 'ROM Checksum is required',
  keys: ['fps', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: ROM Checksum is required | Add a valid MD5 value for ROM Checksum.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 1 error', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom field-romChecksum: ROM Checksum is required.'
  ],
  download: 'blocked'
});
await scenario('ROM checksum not an MD5', [...PINK_FLOYD, ['asset', 'romFiles', 'jgo91P3SSp'], ['fill', 'romChecksum', 'NOT-A-HASH']], {
  rule: 'ROM Checksum is not a valid MD5',
  keys: ['fps', 'romChecksum', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: ROM Checksum is not a valid MD5 | Each checksum must contain exactly 32 hexadecimal characters.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 1 error', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom field-romChecksum: ROM Checksum must be a 32-character MD5 value.'
  ],
  download: 'blocked'
});
await scenario('ROM picked from VPS and given a URL too', [...ROM,
  ['fill', 'romUrlOverride', ROM_URL], ['fill', 'romVersionOverride', 'esha_la3'], ['fill', 'romNotes', 'From the URL']
], {
  rule: 'ROM ID conflicts with URL override',
  keys: ['fps', 'romChecksum', 'romNotes', 'romUrlOverride', 'romVersionOverride', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: ROM ID conflicts with URL override | Use either ROM ID or ROM URL Override, not both.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 1 error', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom field-romVPSId: ROM VPS ID conflicts with ROM URL Override.',
    'rom field-romUrlOverride: Use either ROM VPS ID or ROM URL Override, not both.'
  ],
  download: 'blocked'
});
// Where the dots sit, measured on the page this scenario left open. Every dot
// is on its visible box's top-right corner, 4px out each way. ID fields are
// padded to line up with the checksum drop zones, and until 2026-10-06 their
// dot sat 5px further out than the rest (Jason spotted it on the ROM ID).
if (!PRINT) {
  const corners = await app.run(async () => {
    document.getElementById('validationDialog').close();
    document.getElementById('config-tab-rom').click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0))));
    return [...document.querySelectorAll('#config-panel-rom .field-error-dot')].map(dot => {
      const box = dot.closest('.field').querySelector('input, textarea, select, .readonly-id').getBoundingClientRect();
      const spot = dot.getBoundingClientRect();
      return dot.closest('.field').querySelector('[id^="field-"]').id + ' ' + Math.round(spot.right - box.right) + ',' + Math.round(box.top - spot.top);
    });
  });
  check('dots: ROM ID and URL dots both measured', corners.length === 2, corners.join('\n'));
  corners.forEach(corner => check('dots: ' + corner.split(' ')[0] + ' sits 4px out from its box corner', corner.endsWith(' 4,4'), corner));
}
await scenario('ROM URL without a version', [...PINK_FLOYD,
  ['bundle', 'romFiles', true], ['fill', 'romChecksum', MD5_ROM], ['fill', 'romNotes', 'In the table download'], ['fill', 'romUrlOverride', ROM_URL]
], {
  rule: 'ROM version override is required',
  keys: ['fps', 'romBundled', 'romChecksum', 'romNotes', 'romUrlOverride', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: ROM version override is required | Add ROM Version Override when using ROM URL Override.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 2 errors', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom field-romVersionOverride: ROM Version Override is required when using a URL override.',
    'rom field-romVersionOverride: Add ROM Version Override when using ROM URL Override.'
  ],
  download: 'blocked'
});
await scenario('ROM URL without notes', [...PINK_FLOYD,
  ['override', 'romFiles', true], ['fill', 'romChecksum', MD5_ROM], ['fill', 'romUrlOverride', ROM_URL], ['fill', 'romVersionOverride', 'esha_la3']
], {
  rule: 'ROM Notes are required',
  keys: ['fps', 'romChecksum', 'romUrlOverride', 'romVersionOverride', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: ROM Notes are required | Add ROM Notes when using ROM URL Override.',
    'error: ROM Notes is required | Add ROM Notes — Override requires every Advanced Config field since there is no VPS entry to pull it from.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 2 errors', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom field-romNotes: ROM Notes are required when using ROM URL Override.\nROM Notes is required when Override is enabled.'
  ],
  download: 'blocked'
});
await scenario('ROM version without a URL', [...ROM, ['fill', 'romVersionOverride', 'esha_la3']], {
  rule: 'ROM URL override is required',
  keys: ['fps', 'romChecksum', 'romVersionOverride', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: ROM URL override is required | Add ROM URL Override when using ROM Version Override.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 1 error', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom field-romUrlOverride: Add ROM URL Override when using ROM Version Override.'
  ],
  download: 'blocked'
});
await scenario('ROM bundled without notes', [...PINK_FLOYD, ['bundle', 'romFiles', true], ['fill', 'romChecksum', MD5_ROM]], {
  rule: 'Bundled ROM needs notes',
  keys: ['fps', 'romBundled', 'romChecksum', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Bundled ROM needs notes | Describe the bundled ROM and where it is located.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 1 error', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom field-romNotes: Bundled ROM entries require notes.'
  ],
  download: 'blocked'
});
await scenario('ROM override with nothing filled', [...PINK_FLOYD, ['override', 'romFiles', true], ['fill', 'romChecksum', MD5_ROM]], {
  rule: 'ROM Notes is required',
  keys: ['fps', 'romChecksum', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: ROM Notes is required | Add ROM Notes — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: ROM URL Override is required | Add ROM URL Override — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: ROM Version Override is required | Add ROM Version Override — Override requires every Advanced Config field since there is no VPS entry to pull it from.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 3 errors', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom field-romNotes: ROM Notes is required when Override is enabled.',
    'rom field-romUrlOverride: ROM URL Override is required when Override is enabled.',
    'rom field-romVersionOverride: ROM Version Override is required when Override is enabled.'
  ],
  download: 'blocked'
});

// --- Color ROM -------------------------------------------------------------

await scenario('Color ROM checksum empty', [...LOTR, ['asset', 'altColorFiles', 'afptXEiuqn']], {
  rule: 'Color ROM Checksum is required',
  keys: ['coloredROMVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Color ROM Checksum is required | Add a valid MD5 value for Color ROM Checksum.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: 1 error', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'coloredRom field-coloredROMChecksum: Color ROM Checksum is required.'
  ],
  download: 'blocked'
});
await scenario('Color ROM checksum not an MD5', [...LOTR, ['asset', 'altColorFiles', 'afptXEiuqn'], ['fill', 'coloredROMChecksum', 'NOT-A-HASH']], {
  rule: 'Color ROM Checksum is not a valid MD5',
  keys: ['coloredROMChecksum', 'coloredROMVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Color ROM Checksum is not a valid MD5 | Each checksum must contain exactly 32 hexadecimal characters.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: 1 error', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'coloredRom field-coloredROMChecksum: Color ROM Checksum must be a 32-character MD5 value.'
  ],
  download: 'blocked'
});
await scenario('PAL/VNI with one checksum', [...COLOR, ['fill', 'coloredROMPin2DMD', true], ['fill', 'coloredROMChecksum', MD5_PAL]], {
  rule: 'PAL/VNI requires two checksums',
  keys: ['coloredROMChecksum', 'coloredROMPin2DMD', 'coloredROMVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Color ROM Checksum list is invalid | Use a plain string for one checksum or a list containing at least two checksums.',
    'error: PAL/VNI requires two checksums | Add the .pal checksum and the .vni checksum.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: 2 errors', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'coloredRom field-coloredROMChecksumSecondary: Color ROM VNI Checksum is required.'
  ],
  download: 'blocked'
});
await scenario('clean PAL/VNI pair', [...COLOR, ['fill', 'coloredROMPin2DMD', true], ['fill', 'coloredROMChecksum', MD5_PAL], ['fill', 'coloredROMChecksumSecondary', MD5_VNI]], {
  keys: ['coloredROMChecksum', 'coloredROMPin2DMD', 'coloredROMVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'success: Everything looks good. | The build is ready to copy or download.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: ready', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [],
  download: '5RybGX4Q_table-config.yml',
  downloadMatchesPreview: true
});
await scenario('Color ROM URL without notes', [...COLOR,
  ['fill', 'coloredROMUrlOverride', ROM_URL], ['fill', 'coloredROMVersionOverride', '2.6']
], {
  rule: 'Color ROM Notes are required',
  keys: ['coloredROMChecksum', 'coloredROMUrlOverride', 'coloredROMVersionOverride', 'coloredROMVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Color ROM Notes are required | Add Color ROM Notes when using Color ROM URL Override.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: 1 error', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'coloredRom field-coloredROMNotes: Color ROM Notes are required when using Color ROM URL Override.'
  ],
  download: 'blocked'
});
await scenario('Color ROM URL without a version', [...COLOR,
  ['fill', 'coloredROMUrlOverride', ROM_URL], ['fill', 'coloredROMNotes', 'From the URL']
], {
  rule: 'Color ROM version override is required',
  keys: ['coloredROMChecksum', 'coloredROMNotes', 'coloredROMUrlOverride', 'coloredROMVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Color ROM version override is required | Add Color ROM Version Override when using Color ROM URL Override.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: 1 error', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'coloredRom field-coloredROMVersionOverride: Add Color ROM Version Override when using Color ROM URL Override.'
  ],
  download: 'blocked'
});
await scenario('Color ROM version without a URL', [...COLOR, ['fill', 'coloredROMVersionOverride', '2.6']], {
  rule: 'Color ROM URL override is required',
  keys: ['coloredROMChecksum', 'coloredROMVersionOverride', 'coloredROMVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Color ROM URL override is required | Add Color ROM URL Override when using Color ROM Version Override.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: 1 error', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'coloredRom field-coloredROMUrlOverride: Add Color ROM URL Override when using Color ROM Version Override.'
  ],
  download: 'blocked'
});
await scenario('Color ROM bundled without notes', [...LOTR, ['bundle', 'altColorFiles', true], ['fill', 'coloredROMChecksum', MD5_PAL]], {
  rule: 'Bundled Color ROM needs notes',
  keys: ['coloredROMBundled', 'coloredROMChecksum', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Bundled Color ROM needs notes | Describe the bundled Color ROM and where it is located.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: 1 error', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'coloredRom field-coloredROMNotes: Bundled Color ROM entries require notes.'
  ],
  download: 'blocked'
});
await scenario('Color ROM override with nothing filled', [...LOTR, ['override', 'altColorFiles', true], ['fill', 'coloredROMChecksum', MD5_PAL]], {
  rule: 'Color ROM Notes is required',
  keys: ['coloredROMChecksum', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Color ROM Notes is required | Add Color ROM Notes — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: Color ROM URL Override is required | Add Color ROM URL Override — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: Color ROM Version Override is required | Add Color ROM Version Override — Override requires every Advanced Config field since there is no VPS entry to pull it from.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: 3 errors', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'coloredRom field-coloredROMNotes: Color ROM Notes is required when Override is enabled.',
    'coloredRom field-coloredROMUrlOverride: Color ROM URL Override is required when Override is enabled.',
    'coloredRom field-coloredROMVersionOverride: Color ROM Version Override is required when Override is enabled.'
  ],
  download: 'blocked'
});

// --- Additional ROMs -------------------------------------------------------
//
// Tales from the Crypt, the one table with several ROMs. The Additional ROM
// dialog checks an entry before it will add it, so a bad entry can only
// arrive the way a user's older file brings one in: through Import, whose
// Additional ROM block is applied without that check.
//
// The error dot shows on the ROM tab only. Until 2026-10-04 it also showed on
// the VPX tab's Advanced Config header: the feature validator took the first
// .additional-rom-controls on the page, and the VPX tab's Additional Passwords
// control shares that class. A "vpx additionalRoms" dot here means it is back.
//
// The dialog shows one line per entry: the feature validator skips a title it
// has already added, so an entry with two problems lists only the first.

function talesFromTheCrypt(entries) {
  const block = entries.map(entry => Object.entries(entry)
    .map(([key, value], index) => (index ? '    ' : '  - ') + key + ': "' + value + '"')
    .join('\n')).join('\n');
  return [
    '---',
    'fps: 60',
    'romChecksum: "' + MD5_ROM + '"',
    'romVPSId: "s-4c6GqaOn"',
    'tableVPSId: "fXaQ33KC"',
    'testers:',
    '  - "Tester"',
    'vpxChecksum: "' + MD5_VPX + '"',
    'vpxVPSId: "xkDq6Aub"',
    'additionalRoms:',
    block,
    ''
  ].join('\n');
}
const imported = entries => [['import', talesFromTheCrypt(entries)]];

await scenario('clean Additional ROM', imported([{ vpsId: 'WshhKlRf', checksum: MD5_ADD }]), {
  keys: ['additionalRoms', 'vpsId', 'checksum', 'fps', 'romChecksum', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'success: Everything looks good. | The build is ready to copy or download.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: ready', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [],
  download: 'fXaQ33KC_table-config.yml',
  downloadMatchesPreview: true
});
await scenario('Additional ROM without a VPS ID', imported([{ checksum: MD5_ADD }]), {
  rule: 'Additional ROM 1 needs attention',
  keys: ['additionalRoms', 'checksum', 'fps', 'romChecksum', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Additional ROM 1 needs attention | Select a ROM VPS ID.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 1 error', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom additionalRoms: Select a ROM VPS ID.'
  ],
  download: 'blocked'
});
await scenario('Additional ROM without a checksum', imported([{ vpsId: 'WshhKlRf' }]), {
  rule: 'Additional ROM 1 needs attention',
  keys: ['additionalRoms', 'vpsId', 'fps', 'romChecksum', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Additional ROM 1 needs attention | Checksum is required.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 1 error', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom additionalRoms: Checksum is required.'
  ],
  download: 'blocked'
});
await scenario('Additional ROM checksum not an MD5', imported([{ vpsId: 'WshhKlRf', checksum: 'NOT-A-HASH' }]), {
  rule: 'Additional ROM 1 needs attention',
  keys: ['additionalRoms', 'vpsId', 'checksum', 'fps', 'romChecksum', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Additional ROM 1 needs attention | Checksum must contain exactly 32 hexadecimal characters.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 1 error', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom additionalRoms: Checksum must contain exactly 32 hexadecimal characters.'
  ],
  download: 'blocked'
});
await scenario('Additional ROM URL without a version', imported([{ vpsId: 'WshhKlRf', checksum: MD5_ADD, urlOverride: ROM_URL }]), {
  rule: 'Additional ROM 1 needs attention',
  keys: ['additionalRoms', 'vpsId', 'checksum', 'urlOverride', 'fps', 'romChecksum', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Additional ROM 1 needs attention | Version Override is required when URL Override is used.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 1 error', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom additionalRoms: Version Override is required when URL Override is used.'
  ],
  download: 'blocked'
});
await scenario('Additional ROM version without a URL', imported([{ vpsId: 'WshhKlRf', checksum: MD5_ADD, versionOverride: 'tftc_303' }]), {
  rule: 'Additional ROM 1 needs attention',
  keys: ['additionalRoms', 'vpsId', 'checksum', 'versionOverride', 'fps', 'romChecksum', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Additional ROM 1 needs attention | URL Override is required when Version Override is used.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 1 error', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom additionalRoms: URL Override is required when Version Override is used.'
  ],
  download: 'blocked'
});
await scenario('Additional ROM is the primary ROM', imported([{ vpsId: 's-4c6GqaOn', checksum: MD5_ADD }]), {
  rule: 'Additional ROM 1 needs attention',
  keys: ['additionalRoms', 'vpsId', 'checksum', 'fps', 'romChecksum', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Additional ROM 1 needs attention | The primary ROM cannot also be an Additional ROM.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 1 error', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom additionalRoms: The primary ROM cannot also be an Additional ROM.'
  ],
  download: 'blocked'
});
await scenario('Additional ROM not on this table', imported([{ vpsId: 'notAnEntry', checksum: MD5_ADD }]), {
  rule: 'Additional ROM 1 needs attention',
  keys: ['additionalRoms', 'vpsId', 'checksum', 'fps', 'romChecksum', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Additional ROM 1 needs attention | The selected Additional ROM is not available for this table.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 1 error', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom additionalRoms: The selected Additional ROM is not available for this table.'
  ],
  download: 'blocked'
});
await scenario('Additional ROM listed twice', imported([{ vpsId: 'WshhKlRf', checksum: MD5_ADD }, { vpsId: 'WshhKlRf', checksum: MD5_ADD }]), {
  rule: 'Additional ROM 2 needs attention',
  keys: ['additionalRoms', 'vpsId', 'checksum', 'vpsId', 'checksum', 'fps', 'romChecksum', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Additional ROM 1 needs attention | That ROM is already in Additional ROMs.',
    'error: Additional ROM 2 needs attention | That ROM is already in Additional ROMs.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 2 errors', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom additionalRoms: That ROM is already in Additional ROMs.'
  ],
  download: 'blocked'
});

// Pinned from the pre-merge validators on 2026-10-05 (validator merge, Phase 1
// piece 2). The first is the one-line-per-entry rule above with two problems on
// one entry; the second has a v090 and a feature issue in the dialog at once,
// which no other scenario does, so it pins their order.
await scenario('Additional ROM with two problems', imported([{ checksum: 'NOT-A-HASH' }]), {
  rule: 'Additional ROM 1 needs attention',
  keys: ['additionalRoms', 'checksum', 'fps', 'romChecksum', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Additional ROM 1 needs attention | Select a ROM VPS ID.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 2 errors', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom additionalRoms: Select a ROM VPS ID. Checksum must contain exactly 32 hexadecimal characters.'
  ],
  download: 'blocked'
});
const withRomVersion = entries => [['import', talesFromTheCrypt(entries).replace('vpxChecksum:', 'romVersionOverride: "tftc_303"\nvpxChecksum:')]];
await scenario('v090 and feature issues together', withRomVersion([{ checksum: MD5_ADD }]), {
  rule: 'ROM URL override is required',
  keys: ['additionalRoms', 'checksum', 'fps', 'romChecksum', 'romVersionOverride', 'romVPSId', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: ROM URL override is required | Add ROM URL Override when using ROM Version Override.',
    'error: Additional ROM 1 needs attention | Select a ROM VPS ID.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: 2 errors', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'rom additionalRoms: Select a ROM VPS ID.',
    'rom field-romUrlOverride: Add ROM URL Override when using ROM Version Override.'
  ],
  download: 'blocked'
});

await app.close();
report('yaml-rules-rom');
