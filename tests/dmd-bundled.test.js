'use strict';
// The BUNDLED DMD shape: one archive holding both the VPX and its DMD pack.
//
// Drives the real bundledPairing config out of js.src/fields.js and the real
// bundled-shape block out of prepareData in js.src/yamlFeatureSupport.js.
//
// What it pins:
//   - vpxChecksum knows where to send the archive's format, folder list and
//     hash when a DMD is bundled into the same file
//   - vpxArchiveFormat is DERIVED from specialDMDArchiveFormat at write time,
//     never edited, and never written outside the bundled shape
//   - the importer recognises that derived key, so a bundled YML does not come
//     back reporting it as outdated
//   - both independent validators demand the checksum PAIR
//
// NOT covered here: the drop handler itself. Hashing an archive twice and
// cross-writing to another tab needs a real browser and a real archive; this
// file pins the wiring and the output shape, and the source-level guards below
// are a drift net, not a substitute for the live check.

const fs = require('fs');
const { check, report, repoPath } = require('./harness');

const FIELDS = repoPath('js.src', 'fields.js');
const YAML = repoPath('js.src', 'yamlFeatureSupport.js');
const UI_HELPER = repoPath('js.src', 'uiHelper.js');
const MAIN = repoPath('js.src', 'main.js');
const ENHANCEMENTS = repoPath('js.src', 'uiEnhancements.js');
const IMPORT = repoPath('js.src', 'ymlImport.js');

const windowStub = {};
new Function('window', fs.readFileSync(FIELDS, 'utf8'))(windowStub);
const { WIZARD_STEPS, OMIT_FROM_YAML } = windowStub.VPS_YML_FIELDS;

const vpx = WIZARD_STEPS.find(step => step.id === 'vpx');
const dmd = WIZARD_STEPS.find(step => step.id === 'dmd');
const vpxChecksum = vpx.fields.find(field => field.yml_field === 'vpxChecksum');
const pairing = vpxChecksum.bundledPairing;

// 1 ── the pairing config, and that every target it names is real
{
  check('vpxChecksum declares a bundled pairing', Boolean(pairing));
  check('it triggers on specialDMDBundled', pairing.when === 'specialDMDBundled');
  check('it fills the DMD checksum', pairing.checksumField === 'specialDMDChecksum');
  check('it fills the DMD archive format', pairing.formatField === 'specialDMDArchiveFormat');
  check('it fills the DMD archive root picker', pairing.rootField === 'specialDMDArchiveRoot');
  check('it fills the DMD directory list', pairing.directoriesKey === '__dmdArchiveDirectories');

  const dmdKeys = dmd.fields.map(field => field.yml_field);
  [pairing.checksumField, pairing.formatField, pairing.rootField].forEach(key => {
    check(`${key} is a real field on the DMD tab`, dmdKeys.includes(key), JSON.stringify(dmdKeys));
  });
  check('the directory key is the one the DMD picker reads',
    pairing.directoriesKey === '__dmdArchiveDirectories'
    && OMIT_FROM_YAML.has('__dmdArchiveDirectories'));

  check('the VPX checksum still extracts the .vpx from an archive',
    vpxChecksum.archiveScanExtension === '.vpx',
    'the primary hash must stay the inner .vpx, bundled or not');
  check('the VPX checksum is NOT itself an archive browser',
    vpxChecksum.archiveBrowser === undefined,
    'browsing is switched on only by the pairing, so a normal drop is unchanged');
}

// 2 ── vpxArchiveFormat is derived, not edited
{
  const declared = WIZARD_STEPS.flatMap(step => (step.fields || []).map(f => f.yml_field));
  check('no field edits vpxArchiveFormat', !declared.includes('vpxArchiveFormat'),
    'it is mirrored from the DMD tab, so a second control would ask the same question twice');
}

// ── the real bundled-shape block out of prepareData ────────────────────────
// Normalised to LF before slicing: js.src is CRLF in the working tree, and
// a multi-line marker built from a JS string literal is LF, so it would
// match nothing.
const yamlSource = fs.readFileSync(YAML, 'utf8').split('\r\n').join('\n');
const start = yamlSource.indexOf('    if (data.specialDMDBundled === true) {');
if (start < 0) throw new Error('bundled-shape block not found');
const endMarker = '      delete data.vpxArchiveFormat;\n    }';
const end = yamlSource.indexOf(endMarker, start);
if (end < 0) throw new Error('bundled-shape block end not found');
const block = yamlSource.slice(start, end + endMarker.length);
const applyBundledShape = new Function('data', block + '\n return data;');

// 3 ── the format mirrors across, and only in the bundled shape
{
  const bundled = applyBundledShape({
    specialDMDBundled: true,
    specialDMDArchiveFormat: '7z',
    specialDMDType: 'FlexDMD'
  });
  check('a bundled build writes vpxArchiveFormat', bundled.vpxArchiveFormat === '7z',
    String(bundled.vpxArchiveFormat));
  // The DMD Archive Format field is a STORE in this shape, not an output key:
  // one archive, so the format is written once, as vpxArchiveFormat. (Note this
  // departs from new-YML-updates.txt, which lists specialDMDArchiveFormat as
  // required when bundled - Jason overruled the spec text on 2026-08-26.)
  check('the DMD format key itself is NOT written when bundled',
    !('specialDMDArchiveFormat' in bundled), String(bundled.specialDMDArchiveFormat));

  const standalone = applyBundledShape({
    specialDMDBundled: false,
    specialDMDArchiveFormat: 'zip',
    vpxArchiveFormat: 'zip'
  });
  check('a standalone build writes NO vpxArchiveFormat',
    !('vpxArchiveFormat' in standalone), String(standalone.vpxArchiveFormat));
  check('an imported bundled value is dropped when the shape is switched away',
    !('vpxArchiveFormat' in standalone),
    'the only way that key reaches state is an import');

  const noFormat = applyBundledShape({ specialDMDBundled: true });
  check('no DMD format means no mirrored key at all',
    !('vpxArchiveFormat' in noFormat),
    'an empty string would serialize as a present-but-blank key');

  const rar = applyBundledShape({ specialDMDBundled: true, specialDMDArchiveFormat: 'rar' });
  check('the mirror carries whatever the DMD format says', rar.vpxArchiveFormat === 'rar');
}

// 4 ── the bundled build still drops the DMD's own checksum
{
  const out = applyBundledShape({
    specialDMDBundled: true,
    specialDMDArchiveFormat: 'zip',
    specialDMDChecksum: 'D'.repeat(32)
  });
  check('specialDMDChecksum is displayed but never written',
    !('specialDMDChecksum' in out),
    'the archive hash goes into the vpxChecksum list instead');
}

// 5 ── the importer knows the derived key
{
  const importSource = fs.readFileSync(IMPORT, 'utf8');
  check('vpxArchiveFormat is seeded into the supported keys',
    /new Set\(\[[^\]]*'vpxArchiveFormat'/.test(importSource),
    'otherwise a bundled YML imports with it flagged outdated and stripped');
}

// 6 ── both validators demand the pair
{
  const mainSource = fs.readFileSync(MAIN, 'utf8');
  const enhancedSource = fs.readFileSync(ENHANCEMENTS, 'utf8');
  check('validateBuild checks vpxChecksum length when bundled',
    mainSource.includes('normalizeChecksumValue(state.values.vpxChecksum).length < 2'),
    'the blocking validator must refuse a single checksum in the bundled shape');
  check('validateBuild files that error against the vpx tab',
    /addError\('vpx', 'Bundled DMD needs both checksums'/.test(mainSource));
  check('the dot validator knows the same rule',
    enhancedSource.includes('specialDMDBundled') && enhancedSource.includes('bundledPair'));
  check('the dot validator files it against vpxChecksum',
    /add\('vpxChecksum'/.test(enhancedSource));
}

// 7 ── the drop handler is wired, as a drift net only
{
  const ui = fs.readFileSync(UI_HELPER, 'utf8');
  check('the handler reads the pairing off the field', ui.includes('field.bundledPairing'));
  check('a second whole-archive hash is calculated', ui.includes('pairedHashTask'));
  check('the pair is written as a two-item list',
    ui.includes('[checksumResult.value.checksum, pairedHash]'));
  // The DMD checksum is a VIEW of vpxChecksum[1], never a stored copy - that is
  // what makes a hand edit of the VPX additional checksum show up on the DMD
  // tab instead of the two quietly disagreeing.
  check('the archive hash is NOT stored a second time',
    !ui.includes('onChange(pairing.checksumField'),
    'storing a copy is how the two values drift apart');
  const dmdChecksumField = dmd.fields.find(f => f.yml_field === 'specialDMDChecksum');
  check('the DMD checksum mirrors another field', Boolean(dmdChecksumField.mirrorFrom));
  check('it mirrors vpxChecksum', dmdChecksumField.mirrorFrom.field === 'vpxChecksum');
  check('it mirrors the SECOND entry - the archive hash',
    dmdChecksumField.mirrorFrom.index === 1);
  check('it only mirrors in the bundled shape',
    dmdChecksumField.mirrorFrom.when === 'specialDMDBundled');
  // Matched exactly, not as a loose substring: `field.mirrorFrom` on its own
  // still appears in a version of this line that has been disabled, so a
  // vaguer check passes against code that no longer works.
  check('the renderer honours mirrorFrom',
    ui.includes('const mirror = field.mirrorFrom && values[field.mirrorFrom.when] === true'),
    'the mirror must actually be consulted, not merely mentioned');

  // An archive with no folders in it is a .vpx in a zip, not a bundle.
  check('no folders means no second hash', ui.includes('pairedDirectories.length'));
  // The format cross-write has to sit BEHIND that gate too. It used to run up
  // front, off the file extension alone, so a folderless archive still pushed a
  // format onto the DMD tab.
  check('the format is written after the folder check, not before',
    ui.indexOf('onChange(pairing.formatField') > ui.indexOf('const pairedDirectories'),
    'a folderless archive must set nothing at all');
  check('the format write is inside the paired branch',
    ui.indexOf('onChange(pairing.formatField')
      > ui.indexOf('onChange(field.yml_field, [checksumResult.value.checksum, pairedHash]'),
    'it belongs with the pair, not with the drop');
  check('folders are browsed for a bundled drop too',
    ui.includes('field.archiveBrowser || pairing'));
  check('the folder list crosses to the DMD key',
    ui.includes('pairing ? pairing.directoriesKey'));
  check('the DMD picker is the one repainted',
    ui.includes('pairing ? pairing.rootField'));
  check('an ordinary drop still takes the old path',
    ui.includes('replacePrimaryChecksum(values[field.yml_field], checksumResult.value.checksum)'),
    'the non-bundled branch must survive - it is what is live today');
}

// 8 ── import: the two values no control can carry back
// Both were losing data on a bundled round-trip. setField returns early on a
// readonly field, so specialDMDType never arrived - and with no type the DMD
// tab stays disabled, so loadImportedFields skipped every field on it. A
// control also holds one string, so vpxChecksum's second entry was flattened
// away the moment its input event fired.
{
  const imp = fs.readFileSync(IMPORT, 'utf8');

  check('the DMD type is set through its asset row',
    imp.includes('data-category="specialDMD"'),
    'setField skips readonly fields, so the tab field cannot carry it');
  check('...and BEFORE loadImportedFields, or the tab is still disabled',
    imp.indexOf('data-category="specialDMD"') < imp.indexOf('await loadImportedFields(values)'),
    'a disabled tab has all of its fields skipped');

  check('list values are restored straight to state', imp.includes('restoreListValues(values);'));
  check('...AFTER loadImportedFields, once the controls have had their turn',
    imp.indexOf('restoreListValues(values);') > imp.indexOf('await loadImportedFields(values)'));
  // The exact guard, not a loose substring: fieldValueForControl contains
  // `field.type === 'array'` too, so a vaguer check stays green even after the
  // exemption is deleted.
  check('array-typed fields are exempt from that restore',
    imp.includes("if (!field || field.type === 'array') return;"),
    'testers and author overrides round-trip correctly as comma strings');
  check('single values are left alone', imp.includes('value.length < 2'),
    'only a genuine list needs rescuing');
  check('the additional-checksum UI is repainted afterwards',
    imp.includes('VPS_CHECKSUM_ADDITIONAL'),
    'otherwise the restored second checksum is in state but invisible');
}

report('bundled DMD');
