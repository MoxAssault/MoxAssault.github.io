// A YML with bad VPS IDs (Jason, 2026-11-05): an alert lists each one and why,
// and offers to load the file without them. Real app, real importer, the
// five-table fixture. Pink Floyd is the table; the IDs below are its own.

import { check, report } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, play } = await startScenarios();

const TABLE = 'Lgi1JLk0Vf';
const VPX = 'qV3Z3oQ8md';
const ROM = 'jgo91P3SSp';
const base = extra => ['---', `tableVPSId: "${TABLE}"`, `vpxVPSId: "${VPX}"`, 'fps: 60', ...extra].join('\n') + '\n';

// Imports a YML, stops at the alert if one comes, and answers it.
async function importYml(text, answer) {
  return app.run(async ([text, answer]) => {
    const input = document.getElementById('ymlImportInput');
    const transfer = new DataTransfer();
    transfer.items.add(new File([text], 'case.yml', { type: 'text/yaml' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const toast = () => document.querySelector('#ymlImportToast');
    const title = () => toast()?.querySelector('.vps-db-toast-title')?.textContent || '';
    const message = () => toast()?.querySelector('.vps-db-toast-message')?.textContent || '';
    const started = Date.now();
    const seen = {};
    while (Date.now() - started < 15000 && !/YML loaded|could not be loaded|Import cancelled/.test(title())) {
      if (/bad VPS ID/.test(title()) && !seen.title) {
        seen.title = title();
        seen.message = message();
        seen.buttons = [...toast().querySelectorAll('.yml-import-toast-actions button')].map(button => button.textContent);
        seen.role = toast().getAttribute('role');
        const middle = node => { const box = node.getBoundingClientRect(); return box.top + box.height / 2; };
        seen.dotOffset = Math.abs(middle(toast().querySelector('.vps-db-toast-indicator')) - middle(toast().querySelector('.vps-db-toast-title')));
        seen.rows = [...toast().querySelectorAll('.yml-import-issues li')].map(row => row.textContent);
        seen.closing = toast().querySelector('.yml-import-closing')?.textContent || '';
        seen.lead = toast().querySelector('.vps-db-toast-message').firstChild?.textContent || '';
        seen.tagged = [...toast().querySelectorAll('.yml-import-issues strong')].map(tag => tag.textContent);
        if (answer === 'escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        else [...toast().querySelectorAll('button')].find(button => button.textContent === answer).click();
      }
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    await new Promise(resolve => setTimeout(resolve, 300));
    const values = window.VPS_FEATURE_RUNTIME?.state?.values || {};
    return {
      seen,
      title: title(),
      message: message(),
      record: window.VPS_FEATURE_RUNTIME?.state?.record?.id || null,
      vpx: values.vpxVPSId ?? null,
      rom: values.romVPSId ?? null,
      backglass: values.backglassVPSId ?? null,
      fps: values.fps ?? null,
      romOverride: values.romOverride ?? null,
      romBundled: values.romBundled ?? null,
      romChecksum: values.romChecksum ?? null,
      romNotes: values.romNotes ?? null,
      backglassOverride: values.backglassOverride ?? null,
      backglassChecksum: values.backglassChecksum ?? null,
      backglassNotes: values.backglassNotes ?? null,
      yaml: document.getElementById('previewYaml')?.textContent || ''
    };
  }, [text, answer]);
}

// A ROM ID VPS has never heard of.
await play([]);
const cancelled = await importYml(base(['romVPSId: "NOTAREALID"']), 'Cancel');
check('a bad ID brings up the alert', cancelled.seen.title === '1 bad VPS ID found', JSON.stringify(cancelled.seen));
check('each error is ASSET [ID]: reason', JSON.stringify(cancelled.seen.rows) === JSON.stringify(['ROM [NOTAREALID]: VPS has no ROM with this ID.']), JSON.stringify(cancelled.seen.rows));
check('the asset and ID stand out', JSON.stringify(cancelled.seen.tagged) === JSON.stringify(['ROM [NOTAREALID]:']), JSON.stringify(cancelled.seen.tagged));
check('the intro is its own line', cancelled.seen.lead === 'case.yml has IDs this table cannot use:', cancelled.seen.lead);
check('the question is its own line', cancelled.seen.closing.startsWith('Load it without them?'), cancelled.seen.closing);
check('it offers Cancel and Load Without Them',
  JSON.stringify(cancelled.seen.buttons) === '["Cancel","Load Without Them"]', JSON.stringify(cancelled.seen.buttons));
check('the red dot lines up with the title', cancelled.seen.dotOffset <= 1, String(cancelled.seen.dotOffset));
check('it is an alert to a screen reader', cancelled.seen.role === 'alertdialog', cancelled.seen.role);
check('Cancel loads nothing', cancelled.title === 'Import cancelled' && cancelled.record === null, JSON.stringify(cancelled));

await play([]);
const escaped = await importYml(base(['romVPSId: "NOTAREALID"']), 'escape');
check('Esc is Cancel', escaped.title === 'Import cancelled' && escaped.record === null, JSON.stringify(escaped));

await play([]);
const loaded = await importYml(base(['romVPSId: "NOTAREALID"']), 'Load Without Them');
check('Load Without Them loads the table', loaded.title === 'YML loaded for editing' && loaded.record === TABLE, JSON.stringify(loaded));
check('the good values come in', loaded.vpx === VPX && String(loaded.fps) === '60', JSON.stringify(loaded));
check('the bad ID is gone from the build', loaded.rom === null, JSON.stringify(loaded));
check('and from the YML', !loaded.yaml.includes('NOTAREALID'), loaded.yaml);
check('the result confirms it without repeating the list', loaded.message.includes('All corrupted VPS IDs removed.') && !loaded.message.includes('NOTAREALID'), loaded.message);

// The vpx-123 case: a VPX ID sitting in the backglass line, and a second bad ID.
await play([]);
const two = await importYml(base([`backglassVPSId: "${VPX}"`, 'romVPSId: "NOTAREALID"']), 'Load Without Them');
check('every bad ID is listed at once', two.seen.title === '2 bad VPS IDs found', JSON.stringify(two.seen));
check('a table file in the wrong row says whose it is',
  two.seen.rows.includes(`B2S [${VPX}]: It is this table's VPX, not a B2S.`) && two.seen.rows.length === 2, JSON.stringify(two.seen.rows));
check('both are removed and the file loads',
  two.title === 'YML loaded for editing' && two.backglass === null && two.rom === null && two.vpx === VPX, JSON.stringify(two));
check('the same sentence covers several', two.message.includes('All corrupted VPS IDs removed.'), two.message);

// Only the ID goes. The section stays open with its fields, no Override, and
// picking the right ID keeps them (Jason, 2026-11-05).
const CHECKSUM = 'A76A659BBE590DCDB2006D01A17611A3';
const NOTES = 'Download directb2s.zip';
const withBackglass = base([`backglassVPSId: "${VPX}"`, `backglassChecksum: "${CHECKSUM}"`, `backglassNotes: "${NOTES}"`]);
const pickBackglass = () => app.run(async () => {
  const record = window.VPS_FEATURE_RUNTIME.state.record;
  const id = record.b2sFiles[0].id;
  const select = document.querySelector('#assetMatrix .asset-row[data-category="b2sFiles"] select');
  select.value = id;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 150));
  return id;
});
const sectionState = () => app.run(() => {
  const values = window.VPS_FEATURE_RUNTIME.state.values;
  return {
    tabOpen: document.getElementById('config-tab-b2s')?.disabled === false,
    needed: values.__idNeeded ?? null,
    id: values.backglassVPSId ?? null,
    override: values.backglassOverride ?? null,
    checksum: String(values.backglassChecksum ?? ''),
    notes: values.backglassNotes ?? null,
    yaml: document.getElementById('previewYaml').textContent,
    blocked: window.VPS_MAIN.readyYaml() === ''
  };
});
const closeValidation = () => app.run(() => document.getElementById('validationDialog').close());

await play([]);
const section = await importYml(withBackglass, 'Load Without Them');
check('the alert says so', section.seen.closing.includes('keeps its other fields until you pick the right ID'), section.seen.message);
const waiting = await sectionState();
await closeValidation();
check('the tab stays open with no Override', waiting.tabOpen && waiting.override !== true && waiting.id === null, JSON.stringify(waiting));
check('its checksum and notes load', waiting.checksum.toUpperCase() === CHECKSUM && waiting.notes === NOTES, JSON.stringify(waiting));
check('Copy and Download are blocked until it has an ID', waiting.blocked === true, JSON.stringify(waiting));
const issue = await app.run(() => {
  window.VPS_MAIN.readyYaml();
  const dialog = document.getElementById('validationDialog');
  const text = dialog.textContent.replace(/\s+/g, ' ');
  dialog.close();
  return text;
});
check('the error says what to do', issue.includes('B2S VPS ID needed') && issue.includes('Pick the right B2S in the Assets Panel, or tick Override.'), issue);

const picked = await pickBackglass();
const after = await sectionState();
if (after.blocked) await closeValidation();
check('picking the right ID sets it', after.id === picked && after.needed === null, JSON.stringify(after));
check('and the checksum and notes stay', after.checksum.toUpperCase() === CHECKSUM && after.notes === NOTES, JSON.stringify(after));
check('the YML now has all three', after.yaml.includes(`backglassVPSId: "${picked}"`) && after.yaml.includes(`backglassChecksum: "${CHECKSUM}"`) && after.yaml.includes('backglassNotes:'), after.yaml);
const second = await app.run(async () => {
  const record = window.VPS_FEATURE_RUNTIME.state.record;
  const select = document.querySelector('#assetMatrix .asset-row[data-category="b2sFiles"] select');
  const other = record.b2sFiles.find(item => item.id !== select.value);
  if (!other) return null;
  select.value = other.id;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 150));
  return window.VPS_FEATURE_RUNTIME.state.values.backglassChecksum ?? null;
});
check('the exception is one-time: a later change of asset clears as normal', second === null, String(second));

// Ticking Override is the other way out, and keeps the fields too.
await play([]);
await importYml(withBackglass, 'Load Without Them');
await app.run(() => {
  const box = document.querySelector('#assetMatrix .asset-row[data-category="b2sFiles"] .override-toggle input');
  box.click();
});
await new Promise(resolve => setTimeout(resolve, 150));
const ticked = await app.run(() => {
  const values = window.VPS_FEATURE_RUNTIME.state.values;
  return { needed: values.__idNeeded ?? null, override: values.backglassOverride, checksum: String(values.backglassChecksum ?? ''), notes: values.backglassNotes };
});
check('Override clears the wait and keeps the fields',
  ticked.needed === null && ticked.override === true && ticked.checksum.toUpperCase() === CHECKSUM && ticked.notes === NOTES, JSON.stringify(ticked));

// Clear section really clears.
await play([]);
await importYml(withBackglass, 'Load Without Them');
const cleared = await app.run(async () => {
  document.getElementById('config-tab-b2s').click();
  await new Promise(resolve => setTimeout(resolve, 100));
  const button = [...document.querySelectorAll('#accordionStack button')].find(node => /Clear section/i.test(node.textContent) && node.offsetParent);
  if (!button) return { found: false };
  button.click();
  await new Promise(resolve => setTimeout(resolve, 80));
  if (/click again/i.test(button.textContent)) button.click();
  await new Promise(resolve => setTimeout(resolve, 150));
  const values = window.VPS_FEATURE_RUNTIME.state.values;
  return { found: true, needed: values.__idNeeded ?? null, checksum: values.backglassChecksum ?? null, tabDisabled: document.getElementById('config-tab-b2s')?.disabled };
});
check('Clear section ends the wait', cleared.found && cleared.needed === null && cleared.checksum === null && cleared.tabDisabled === true, JSON.stringify(cleared));

// Bundled and Override exclude each other, and Bundled already keeps its fields.
await play([]);
const bundledRow = await importYml(base(['romBundled: true', 'romVPSId: "NOTAREALID"', 'romNotes: "Inside the table archive"']), 'Load Without Them');
check('a Bundled section stays Bundled and is not waiting for an ID',
  bundledRow.romBundled === true && bundledRow.romOverride !== true && bundledRow.rom === null
    && (await app.run(() => window.VPS_FEATURE_RUNTIME.state.values.__idNeeded ?? null)) === null, JSON.stringify(bundledRow));
check('and keeps its fields', bundledRow.romNotes === 'Inside the table archive', JSON.stringify(bundledRow));

// A good ID next to a bad one stays.
await play([]);
const mixed = await importYml(base([`romVPSId: "${ROM}"`, 'backglassVPSId: "NOTAREALID"']), 'Load Without Them');
check('good IDs stay when a bad one goes', mixed.rom === ROM && mixed.backglass === null, JSON.stringify(mixed));

// A bad VPX is handled the same way: the panel opens, its fields load, and
// "VPX file required" holds Copy and Download until the right one is picked.
const VPX_MD5 = 'C95CD5EBA529FBD8CBB6686457839678';
await play([]);
const badVpx = await importYml(['---', `tableVPSId: "${TABLE}"`, 'vpxVPSId: "NOTAREALID"', `vpxChecksum: "${VPX_MD5}"`,
  'tableNotes: "Download the table"', 'fps: 60'].join('\n') + '\n', 'Load Without Them');
check('a bad VPX gets the same alert', badVpx.seen.rows.includes('VPX [NOTAREALID]: It is not on this table, and a VPX cannot come from another table.'), JSON.stringify(badVpx.seen));
check('the file loads', badVpx.title === 'YML loaded for editing' && badVpx.record === TABLE && badVpx.vpx === null, JSON.stringify(badVpx));
const vpxState = () => app.run(() => {
  const values = window.VPS_FEATURE_RUNTIME.state.values;
  const yaml = window.VPS_MAIN.readyYaml();
  const dialog = document.getElementById('validationDialog');
  const issues = dialog.open ? dialog.textContent.replace(/\s+/g, ' ') : '';
  if (dialog.open) dialog.close();
  return {
    panel: document.getElementById('builderSection').hidden === false,
    tab: document.getElementById('config-tab-vpx')?.disabled === false,
    id: values.vpxVPSId ?? null,
    checksum: String(values.vpxChecksum ?? ''),
    notes: values.tableNotes ?? null,
    needed: values.__idNeeded ?? null,
    blocked: yaml === '',
    issues,
    preview: document.getElementById('previewYaml').textContent
  };
});
const vpxWaiting = await vpxState();
check('the Configuration Panel and VPX tab open', vpxWaiting.panel && vpxWaiting.tab, JSON.stringify(vpxWaiting));
check('its fields load', vpxWaiting.checksum.toUpperCase() === VPX_MD5 && vpxWaiting.notes === 'Download the table', JSON.stringify(vpxWaiting));
check('Copy and Download are blocked, by the one VPX error', vpxWaiting.blocked && vpxWaiting.issues.includes('VPX file required') && !vpxWaiting.issues.includes('VPX VPS ID needed'), vpxWaiting.issues);
await app.run(async id => {
  const select = document.querySelector('#assetMatrix .asset-row[data-category="tableFiles"] select');
  select.value = id;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 200));
}, VPX);
const vpxPicked = await vpxState();
check('picking the right VPX keeps its fields', vpxPicked.id === VPX && vpxPicked.needed === null && vpxPicked.checksum.toUpperCase() === VPX_MD5 && vpxPicked.notes === 'Download the table', JSON.stringify(vpxPicked));
check('and the build is no longer waiting on it', !vpxPicked.issues.includes('VPX file required'), vpxPicked.issues);
check('and the YML has the VPX and its checksum', vpxPicked.preview.includes(`vpxVPSId: "${VPX}"`) && vpxPicked.preview.includes(`vpxChecksum: "${VPX_MD5}"`), vpxPicked.preview);

// A file with no vpxVPSId line at all goes the same way.
await play([]);
const missing = await importYml(['---', `tableVPSId: "${TABLE}"`, `vpxChecksum: "${VPX_MD5}"`, 'fps: 60'].join('\n') + '\n', 'Load Without Them');
check('a missing VPX gets the same alert', JSON.stringify(missing.seen.rows) === JSON.stringify(['VPX [missing]: This file has no VPX ID.']), JSON.stringify(missing.seen));
check('the file loads', missing.title === 'YML loaded for editing' && missing.record === TABLE, JSON.stringify(missing));
check('nothing claims an ID was removed', !missing.message.includes('removed'), missing.message);
const missingState = await vpxState();
check('the panel opens with its fields, and Download waits for a VPX',
  missingState.panel && missingState.checksum.toUpperCase() === VPX_MD5 && missingState.blocked && missingState.issues.includes('VPX file required'), JSON.stringify(missingState));
await play([]);
const noTable = await importYml(['---', 'fps: 60'].join('\n') + '\n', 'Cancel');
check('a file with no tableVPSId still refuses: there is no table to open', noTable.title === 'YML could not be loaded', JSON.stringify(noTable));

// A bad VPX and a bad backglass together, then both picked.
await play([]);
const both = await importYml(['---', `tableVPSId: "${TABLE}"`, 'vpxVPSId: "NOTAREALID"', 'backglassVPSId: "ALSONOTREAL"',
  `backglassChecksum: "${VPX_MD5}"`, 'fps: 60'].join('\n') + '\n', 'Load Without Them');
check('both are listed and both sections wait', both.seen.title === '2 bad VPS IDs found' && both.title === 'YML loaded for editing', JSON.stringify(both.seen));
const bothNeeded = await app.run(() => window.VPS_FEATURE_RUNTIME.state.values.__idNeeded);
check('each section waits for its own ID', bothNeeded?.tableFiles === true && bothNeeded?.b2sFiles === true, JSON.stringify(bothNeeded));

// Cancel must leave the build on screen alone, even when it is the same table
// and the file carries an Additional ROM block.
await play([['search', TABLE], ['asset', 'tableFiles', VPX]]);
await app.run(() => { window.confirm = () => true; });
const block = ['additionalRoms:', '  - vpsId: "WshhKlRf"', '    checksum: "C95CD5EBA529FBD8CBB6686457839678"'];
await importYml(base(['romVPSId: "NOTAREALID"', ...block]), 'Cancel');
await new Promise(resolve => setTimeout(resolve, 400));
const untouched = await app.run(() => ({
  roms: window.VPS_FEATURE_RUNTIME.state.values.additionalRoms ?? null,
  loading: document.querySelector('.app-header').classList.contains('is-loading')
}));
check('a cancelled file writes nothing into the same table\'s build',
  (untouched.roms === null || untouched.roms.length === 0) && !untouched.loading, JSON.stringify(untouched));
const nextFile = await importYml(base([`romVPSId: "${ROM}"`]), 'Cancel');
check('and the next file imports straight away', nextFile.title === 'YML loaded for editing', JSON.stringify(nextFile));

// With Load Without Them, the same block does arrive.
await play([]);
await importYml(base(['backglassVPSId: "NOTAREALID"', ...block]), 'Load Without Them');
await new Promise(resolve => setTimeout(resolve, 500));
const kept = await app.run(() => window.VPS_FEATURE_RUNTIME.state.values.additionalRoms ?? null);
check('an accepted file keeps its Additional ROMs', kept?.length === 1, JSON.stringify(kept));

// The keyboard, and a stray drop, while the alert is open.
await play([]);
const open = await app.run(async text => {
  const input = document.getElementById('ymlImportInput');
  const transfer = new DataTransfer();
  transfer.items.add(new File([text], 'case.yml', { type: 'text/yaml' }));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  const toast = document.querySelector('#ymlImportToast') ;
  const title = () => document.querySelector('#ymlImportToast .vps-db-toast-title')?.textContent || '';
  const started = Date.now();
  while (Date.now() - started < 8000 && !/bad VPS ID/.test(title())) await new Promise(resolve => setTimeout(resolve, 30));
  const focused = document.activeElement?.textContent;
  const drop = new DataTransfer();
  drop.items.add(new File(['a'], 'a.yml'));
  drop.items.add(new File(['b'], 'b.yml'));
  document.querySelector('.brand').dispatchEvent(new DragEvent('drop', { dataTransfer: drop, bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 100));
  const afterDrop = { title: title(), buttons: document.querySelectorAll('.yml-import-toast-actions button').length };
  [...document.querySelectorAll('.yml-import-toast-actions button')].find(button => button.textContent === 'Cancel')?.click();
  const cancelledAt = Date.now();
  while (Date.now() - cancelledAt < 3000 && title() !== 'Import cancelled') await new Promise(resolve => setTimeout(resolve, 30));
  return { focused, afterDrop, end: title() };
}, base(['romVPSId: "NOTAREALID"']));
check('the keyboard starts on Cancel', open.focused === 'Cancel', JSON.stringify(open));
check('a drop while the alert is open leaves it standing',
  /bad VPS ID/.test(open.afterDrop.title) && open.afterDrop.buttons === 2, JSON.stringify(open));
check('and it still answers', open.end === 'Import cancelled', JSON.stringify(open));

// What was removed stays readable after loading.
await play([]);
await importYml(base(['romVPSId: "NOTAREALID"']), 'Load Without Them');
const wrap = await app.run(() => {
  const node = document.querySelector('#ymlImportToast');
  return { details: node.classList.contains('has-details'), wrap: getComputedStyle(node.querySelector('.vps-db-toast-message')).whiteSpace };
});
check('the confirmation wraps instead of being cut off', wrap.details && wrap.wrap === 'pre-line', JSON.stringify(wrap));

// A clean file never sees the alert.
await play([]);
const clean = await importYml(base([`romVPSId: "${ROM}"`]), 'Cancel');
check('a clean file loads without the alert', !clean.seen.title && clean.title === 'YML loaded for editing', JSON.stringify(clean));

await app.close();
report();
