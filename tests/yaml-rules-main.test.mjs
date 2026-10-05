// One scenario per validation rule: the Main, VPX and Backglass tabs.
//
// Piece B of the YAML run-through. Each scenario starts from the smallest
// clean build and changes one thing, so the rule it names is the reason it
// fails. What it pins is everything the user sees, duplicates included: the
// three validators (vault note "VPXS Layered Validation") are to be merged,
// and the merge has to change these expectations on purpose.
// The runner is yaml-scenarios.mjs.
//   SNAPSHOT=print node tests/yaml-rules-main.test.mjs

import { report } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, scenario } = await startScenarios();

const MD5_VPX = 'E6DF3800F7C9286FA195E84034DA683A';
const MD5_B2S = 'B3500DC847FF54988DB01C2FFDD0AAA0';

// Pink Floyd with a VPX, its checksum, FPS and a tester: the smallest build
// the app accepts. Every scenario below is this plus or minus one thing.
const TABLE = [['search', 'Lgi1JLk0Vf'], ['asset', 'tableFiles', 'qV3Z3oQ8md']];
const MAIN = [['fill', 'fps', '60'], ['fill', 'testers', 'Tester']];
const BASE = [...TABLE, ...MAIN, ['fill', 'vpxChecksum', MD5_VPX]];
// The same with a VPS backglass, checksum included.
const B2S = [...BASE, ['asset', 'b2sFiles', 'WlwK5P4-tj'], ['fill', 'backglassChecksum', MD5_B2S]];

await scenario('clean base build', BASE, {
  keys: ['fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'success: Everything looks good. | The build is ready to copy or download.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [],
  download: 'Lgi1JLk0Vf_table-config.yml',
  downloadMatchesPreview: true
});
await scenario('clean base build with a backglass', B2S, {
  keys: ['backglassChecksum', 'backglassVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'success: Everything looks good. | The build is ready to copy or download.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: ready', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [],
  download: 'Lgi1JLk0Vf_table-config.yml',
  downloadMatchesPreview: true
});

// --- Main ------------------------------------------------------------------

await scenario('nothing loaded', [], {
  rule: 'No table selected',
  keys: [],
  dialog: [
    'error: No table selected | Search for and load a VPS table first.',
    'error: Missing table VPS ID | The selected table does not have a usable VPS ID.',
    'error: VPX file required | Select a VPX file before copying or downloading the configuration.',
    'error: FPS is required | Enter the table frame rate as an integer.',
    'error: Testers are required | Enter at least one tester; separate multiple names with commas.',
    'error: VPX Checksum is required | Add a valid MD5 value for VPX Checksum.'
  ],
  tabs: ['main: 4 errors', 'vpx: disabled', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'main field-tableVPSId: Table VPS ID is required.',
    'main field-fps: FPS is required.',
    'main field-testers: At least one tester is required.'
  ],
  download: 'blocked'
});
// The configuration tabs only render once a VPX is picked, so this is the
// state straight after the search.
await scenario('no VPX selected', [['search', 'Lgi1JLk0Vf']], {
  rule: 'VPX file required',
  keys: ['tableVPSId'],
  dialog: [
    'error: VPX file required | Select a VPX file before copying or downloading the configuration.',
    'error: FPS is required | Enter the table frame rate as an integer.',
    'error: Testers are required | Enter at least one tester; separate multiple names with commas.',
    'error: VPX Checksum is required | Add a valid MD5 value for VPX Checksum.'
  ],
  tabs: ['main: 2 errors', 'vpx: disabled', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'main field-fps: FPS is required.',
    'main field-testers: At least one tester is required.'
  ],
  download: 'blocked'
});
await scenario('FPS empty', [...BASE, ['fill', 'fps', '']], {
  rule: 'FPS is required',
  keys: ['tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: FPS is required | Enter the table frame rate as an integer.'
  ],
  tabs: ['main: 1 error', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'main field-fps: FPS is required.'
  ],
  download: 'blocked'
});
// Defensive: the FPS box strips anything but digits as it is typed in.
await scenario('FPS not a number (from a draft)', [...BASE, ['draft', 'values.fps', '6x']], {
  rule: 'FPS must be an integer',
  keys: ['fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: FPS must be an integer | Use numbers only for FPS.'
  ],
  tabs: ['main: 1 error', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'main field-fps: FPS must be an integer.'
  ],
  download: 'blocked'
});
await scenario('testers empty', [...BASE, ['fill', 'testers', '']], {
  rule: 'Testers are required',
  keys: ['fps', 'tableVPSId', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Testers are required | Enter at least one tester; separate multiple names with commas.'
  ],
  tabs: ['main: 1 error', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'main field-testers: At least one tester is required.'
  ],
  download: 'blocked'
});
// Lists are never folded, so a long enough tester name is the one value that
// can still write a line past yamllint's 120.
await scenario('YAML line over 120', [...BASE, ['fill', 'testers', 'T'.repeat(120)]], {
  rule: 'YAML line exceeds 120 characters',
  keys: ['fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: YAML line exceeds 120 characters | Shorten the value or use a supported URL field so the generated file passes yamllint.'
  ],
  tabs: ['main: 1 error', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'main field-tableVPSId: This section contains an unresolved validation error.'
  ],
  download: 'blocked'
});
// Defensive: the tutorial dropdown only offers the table's own tutorials.
await scenario('tutorial not on this table (from a draft)', [...BASE, ['draft', 'values.tutorialVPSId', 'notATutorial']], {
  rule: 'Tutorial VPS ID is unavailable',
  keys: ['fps', 'tableVPSId', 'testers', 'tutorialVPSId', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Tutorial VPS ID is unavailable | Choose an available tutorial for this table.'
  ],
  tabs: ['main: 1 error', 'vpx: ready', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'main field-tutorialVPSId: Choose an available tutorial for this table.'
  ],
  download: 'blocked'
});

// --- VPX -------------------------------------------------------------------

await scenario('VPX checksum empty', [...TABLE, ...MAIN], {
  rule: 'VPX Checksum is required',
  keys: ['fps', 'tableVPSId', 'testers', 'vpxVPSId'],
  dialog: [
    'error: VPX Checksum is required | Add a valid MD5 value for VPX Checksum.'
  ],
  tabs: ['main: ready', 'vpx: 1 error', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'vpx field-vpxChecksum: VPX Checksum is required.'
  ],
  download: 'blocked'
});
await scenario('VPX checksum not an MD5', [...TABLE, ...MAIN, ['fill', 'vpxChecksum', 'NOT-A-HASH']], {
  rule: 'VPX Checksum is not a valid MD5',
  keys: ['fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: VPX Checksum is not a valid MD5 | Each checksum must contain exactly 32 hexadecimal characters.'
  ],
  tabs: ['main: ready', 'vpx: 1 error', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'vpx field-vpxChecksum: VPX Checksum must be a 32-character MD5 value.'
  ],
  download: 'blocked'
});
// Defensive: a list of one is never written by the app or kept by the importer.
await scenario('VPX checksum list of one (from a draft)', [...BASE, ['draft', 'values.vpxChecksum', [MD5_VPX]]], {
  rule: 'VPX Checksum list is invalid',
  keys: ['fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: VPX Checksum list is invalid | Use a plain string for one checksum or a list containing at least two checksums.'
  ],
  tabs: ['main: ready', 'vpx: 1 error', 'b2s: disabled', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'vpx field-vpxVPSId: This section contains an unresolved validation error.'
  ],
  download: 'blocked'
});

// --- Backglass -------------------------------------------------------------

await scenario('backglass checksum empty', [...BASE, ['asset', 'b2sFiles', 'WlwK5P4-tj']], {
  rule: 'Backglass Checksum is required',
  keys: ['backglassVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Backglass Checksum is required | Add a valid MD5 value for Backglass Checksum.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: 1 error', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'b2s field-backglassChecksum: Backglass Checksum is required.'
  ],
  download: 'blocked'
});
await scenario('backglass checksum not an MD5', [...BASE, ['asset', 'b2sFiles', 'WlwK5P4-tj'], ['fill', 'backglassChecksum', 'NOT-A-HASH']], {
  rule: 'Backglass Checksum is not a valid MD5',
  keys: ['backglassChecksum', 'backglassVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Backglass Checksum is not a valid MD5 | Each checksum must contain exactly 32 hexadecimal characters.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: 1 error', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'b2s field-backglassChecksum: Backglass Checksum must be a 32-character MD5 value.'
  ],
  download: 'blocked'
});
await scenario('backglass URL override without notes', [...B2S,
  ['fill', 'backglassUrlOverride', 'https://example.com/pinkfloyd.directb2s'],
  ['fill', 'backglassAuthorsOverride', 'CoffeeAtJoes'],
  ['fill', 'backglassImageOverride', 'https://example.com/pinkfloyd.png']
], {
  rule: 'Backglass Notes are required',
  keys: ['backglassAuthorsOverride', 'backglassChecksum', 'backglassImageOverride', 'backglassUrlOverride', 'backglassVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Backglass Notes are required | Add Backglass Notes when using Backglass URL Override.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: 1 error', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'b2s field-backglassNotes: Backglass Notes are required when using Backglass URL Override.'
  ],
  download: 'blocked'
});
await scenario('backglass URL override without authors', [...B2S,
  ['fill', 'backglassUrlOverride', 'https://example.com/pinkfloyd.directb2s'],
  ['fill', 'backglassNotes', 'Download version 1.0'],
  ['fill', 'backglassImageOverride', 'https://example.com/pinkfloyd.png']
], {
  rule: 'Backglass authors override is required',
  keys: ['backglassChecksum', 'backglassImageOverride', 'backglassNotes', 'backglassUrlOverride', 'backglassVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Backglass authors override is required | Add at least one Backglass Authors Override when using Backglass URL Override.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: 1 error', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'b2s field-backglassAuthorsOverride: Add at least one Backglass Authors Override when using Backglass URL Override.'
  ],
  download: 'blocked'
});
await scenario('backglass URL override without image', [...B2S,
  ['fill', 'backglassUrlOverride', 'https://example.com/pinkfloyd.directb2s'],
  ['fill', 'backglassNotes', 'Download version 1.0'],
  ['fill', 'backglassAuthorsOverride', 'CoffeeAtJoes']
], {
  rule: 'Backglass image override is required',
  keys: ['backglassAuthorsOverride', 'backglassChecksum', 'backglassNotes', 'backglassUrlOverride', 'backglassVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Backglass image override is required | Add Backglass Image Override when using Backglass URL Override.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: 1 error', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'b2s field-backglassImageOverride: Add Backglass Image Override when using Backglass URL Override.'
  ],
  download: 'blocked'
});
await scenario('backglass bundled without notes', [...BASE, ['bundle', 'b2sFiles', true], ['fill', 'backglassChecksum', MD5_B2S]], {
  rule: 'Bundled Backglass needs notes',
  keys: ['backglassBundled', 'backglassChecksum', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Bundled Backglass needs notes | Describe the bundled Backglass and where it is located.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: 1 error', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'b2s field-backglassNotes: Bundled Backglass entries require notes.'
  ],
  download: 'blocked'
});
await scenario('backglass selected and bundled', [...B2S, ['bundle', 'b2sFiles', true], ['fill', 'backglassNotes', 'In the table download']], {
  rule: 'B2S selected and bundled',
  keys: ['backglassBundled', 'backglassChecksum', 'backglassNotes', 'backglassVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'warning: B2S selected and bundled | Choose either a separate VPS entry or bundled status unless both are intentionally required.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: 1 warning', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [],
  download: 'Lgi1JLk0Vf_table-config.yml',
  downloadMatchesPreview: true
});
await scenario('backglass override with nothing filled', [...BASE, ['override', 'b2sFiles', true], ['fill', 'backglassChecksum', MD5_B2S]], {
  rule: 'Backglass Notes is required',
  keys: ['backglassChecksum', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: Backglass Notes is required | Add Backglass Notes — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: Backglass Authors Override is required | Add Backglass Authors Override — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: Backglass Image Override is required | Add Backglass Image Override — Override requires every Advanced Config field since there is no VPS entry to pull it from.',
    'error: Backglass URL Override is required | Add Backglass URL Override — Override requires every Advanced Config field since there is no VPS entry to pull it from.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: 4 errors', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'b2s field-backglassNotes: Backglass Notes is required when Override is enabled.',
    'b2s field-backglassAuthorsOverride: Backglass Authors Override is required when Override is enabled.',
    'b2s field-backglassImageOverride: Backglass Image Override is required when Override is enabled.',
    'b2s field-backglassUrlOverride: Backglass URL Override is required when Override is enabled.'
  ],
  download: 'blocked'
});
// Defensive: the dropdown disables a broken entry and the importer refuses
// one, so only a saved draft can carry it.
//
// validateBuild's other asset rule, "<asset> ID is unavailable", has no
// scenario because nothing can reach it: sanitizeAssetSelections in main.js
// drops any selection the table does not offer every time a table loads,
// a restored draft included (checked 2026-10-04). The merge may drop it.
await scenario('backglass entry broken (from a draft)', [...B2S, ['draft', 'record.b2sFiles.0.broken', true]], {
  rule: 'B2S entry is broken',
  keys: ['backglassChecksum', 'backglassVPSId', 'fps', 'tableVPSId', 'testers', 'vpxChecksum', 'vpxVPSId'],
  dialog: [
    'error: B2S entry is broken | Choose another database entry before copying or downloading.'
  ],
  tabs: ['main: ready', 'vpx: ready', 'b2s: 1 error', 'rom: disabled', 'coloredRom: disabled', 'pup: disabled', 'altSound: disabled', 'vpuPatch: disabled', 'dmd: disabled'],
  dots: [
    'b2s field-backglassVPSId: This section contains an unresolved validation error.'
  ],
  download: 'blocked'
});

await app.close();
report('yaml-rules-main');
