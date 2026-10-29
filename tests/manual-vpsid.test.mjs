// Override's Manual VPSID (2026-10-28, Jason): with Override ticked on the
// Backglass, ROM, Color ROM, PUP Pack or Alt Sound row, the dropdown gives way
// to a "Manual VPSID" box. An ID from ANY table is checked for its asset type
// on leaving the box; verified, the asset behaves like a normal linked one
// (Override's required fields stop being required) and the asset's own game
// name and type show beside the box. A bad ID blocks like any other error.
// The DMD and VPU Patch rows have no box.
//
// Runs the real app in headless Chrome through the scenario runner.

import { check, report } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, play, PRINT } = await startScenarios();

const MD5_VPX = 'E6DF3800F7C9286FA195E84034DA683A';
// Pink Floyd, the smallest clean build; its own ROM is jgo91P3SSp.
const PINK_FLOYD = [
  ['search', 'Lgi1JLk0Vf'], ['asset', 'tableFiles', 'qV3Z3oQ8md'],
  ['fill', 'fps', '60'], ['fill', 'testers', 'Tester'], ['fill', 'vpxChecksum', MD5_VPX]
];
// Tales from the Crypt's ROM and Backglass: assets from another table.
const TFTC_ROM = 's-4c6GqaOn';
const TFTC_B2S = 'Pr7aybcEBQ';

const settleSource = `() => new Promise(resolve => {
  const frames = n => n ? requestAnimationFrame(() => frames(n - 1)) : setTimeout(resolve, 0);
  frames(3);
})`;

// The ROM row and everything a check needs, read off the page.
async function look(category = 'romFiles', stepId = 'rom') {
  return app.run(async ([category, stepId, settleText]) => {
    const settle = eval(settleText);
    await settle();
    const row = document.querySelector(`#assetMatrix .asset-row[data-category="${category}"]`);
    const select = row.querySelector('select');
    const box = row.querySelector('.manual-vpsid');
    const input = box?.querySelector('input');
    const label = box?.querySelector('.manual-vpsid-label');
    const dot = box?.querySelector('.field-error-dot');
    const issues = window.VPS_VALIDATION.collectAllErrors(window.VPS_MAIN.validationContext())
      .filter(issue => issue.stepId === stepId).map(issue => issue.title + ': ' + issue.message);
    const yaml = document.getElementById('previewYaml').textContent.split('\n');
    let geometry = null;
    if (input && label) {
      const i = input.getBoundingClientRect();
      const l = label.getBoundingClientRect();
      geometry = { inputWidth: Math.round(i.width), labelBeside: l.left >= i.right && Math.abs((l.top + l.height / 2) - (i.top + i.height / 2)) < 3 };
    }
    return {
      box: !!box,
      selectShown: getComputedStyle(select).display !== 'none',
      placeholder: input?.placeholder || '',
      value: input?.value || '',
      label: label?.textContent || '',
      labelError: label?.classList.contains('is-error') === true,
      dot: dot?.getAttribute('aria-label') || '',
      describedBy: input?.getAttribute('aria-describedby') || '',
      issues,
      yaml: yaml.filter(line => /VPSId|Override/.test(line)),
      geometry
    };
  }, [category, stepId, settleSource]);
}

// Types into the box and leaves it with a real Tab, as a user does. Real keys
// matter here: a script that set .value and fired change while the box still
// had focus passed, while the real Tab - focus already gone when change fires -
// blanked the ID (2026-10-28).
async function enter(value, category = 'romFiles') {
  await app.run(category => {
    const input = document.querySelector(`#assetMatrix .asset-row[data-category="${category}"] .manual-vpsid input`);
    input.focus();
    input.select();
  }, category);
  if (value) await app.typeText(value);
  else await app.pressKey('Backspace');
  await app.pressKey('Tab');
  await app.run(eval(settleSource));
}

const requiredIssues = issues => issues.filter(line => /Override has no VPS entry/.test(line));

if (!PRINT) {
  // 1. Override off: the dropdown as always, no box.
  await play(PINK_FLOYD);
  const off = await look();
  check('without Override the row keeps its dropdown and has no box', off.box === false && off.selectShown === true, JSON.stringify(off));

  // 2. Override on, box empty: Override works exactly as before.
  await play([...PINK_FLOYD, ['override', 'romFiles', true]]);
  const empty = await look();
  check('Override shows the box in place of the dropdown', empty.box === true && empty.selectShown === false, JSON.stringify(empty));
  check('the box reads "Manual VPSID"', empty.placeholder === 'Manual VPSID', empty.placeholder);
  const optional = await app.run(async settleText => {
    const settle = eval(settleText);
    await settle();
    const row = document.querySelector('#assetMatrix .asset-row[data-category="romFiles"]');
    const other = document.querySelector('#assetMatrix .asset-row[data-category="b2sFiles"]');
    const input = row.querySelector('.manual-vpsid input').getBoundingClientRect();
    const tag = row.querySelector('.manual-vpsid-optional');
    const t = tag.getBoundingClientRect();
    return {
      text: tag.textContent, hidden: tag.getAttribute('aria-hidden'),
      straddles: t.top < input.top && t.bottom > input.top,
      insideRow: t.top >= row.getBoundingClientRect().top,
      rowHeight: Math.round(row.getBoundingClientRect().height), otherHeight: Math.round(other.getBoundingClientRect().height)
    };
  }, settleSource);
  check('an "Optional" tag sits half in, half out of the top border of the box',
    optional.text === 'Optional' && optional.straddles === true && optional.insideRow === true, JSON.stringify(optional));
  check('the tag is hidden from screen readers', optional.hidden === 'true', JSON.stringify(optional));
  check('the row is as tall as a row without the box', optional.rowHeight === optional.otherHeight, JSON.stringify(optional));
  check('empty, Override still requires its own fields', requiredIssues(empty.issues).length === 3, empty.issues.join('\n'));
  check('empty, nothing is written for the ROM ID', !empty.yaml.some(line => line.startsWith('romVPSId')), empty.yaml.join('\n'));

  // 3. Another table's ROM: verified, labelled, and a normal linked asset.
  await enter(TFTC_ROM);
  const good = await look();
  check('a ROM from another table is verified, with no dot', good.dot === '' && good.value === TFTC_ROM, JSON.stringify(good));
  check('its game name and type show beside the box, not in red', good.label === 'Tales from the Crypt · ROM' && good.labelError === false, JSON.stringify(good));
  check('verified, the box is described by the name beside it', good.describedBy === 'manualVpsIdLabel-romFiles', good.describedBy);
  check('the label sits beside the narrowed box, not under it',
    good.geometry?.labelBeside === true && good.geometry?.inputWidth === 120, JSON.stringify(good.geometry));
  check('verified, Override\'s own fields are no longer required', requiredIssues(good.issues).length === 0, good.issues.join('\n'));
  check('verified, the ROM checksum is still required, as for any ROM',
    good.issues.some(line => /ROM Checksum required/.test(line)), good.issues.join('\n'));
  check('the YML writes the ID in romVPSId and no override key',
    good.yaml.includes(`romVPSId: "${TFTC_ROM}"`) && !good.yaml.some(line => /romOverride/.test(line)), good.yaml.join('\n'));

  // Enter saves and keeps the keyboard in the box, though the row is rebuilt.
  await app.run(() => {
    const input = document.getElementById('manualVpsId-romFiles');
    input.focus();
    input.select();
    window.__oldBox = input;
    return true;
  });
  await app.typeText('2Q1pXHma');
  await app.pressKey('Enter');
  const focus = await app.run(async settleText => {
    await eval(settleText)();
    return {
      active: document.activeElement?.id || '',
      rebuilt: document.getElementById('manualVpsId-romFiles') !== window.__oldBox,
      saved: window.VPS_FEATURE_RUNTIME.state.values.romVPSId
    };
  }, settleSource);
  check('Enter keeps the keyboard in the rebuilt box', focus.active === 'manualVpsId-romFiles' && focus.rebuilt === true && focus.saved === '2Q1pXHma', JSON.stringify(focus));

  // 4. The wrong asset type blocks, with a plain message.
  await enter(TFTC_B2S);
  const wrong = await look();
  check('a Backglass ID on the ROM row says so', wrong.dot === 'This ID is a Backglass, not a ROM.', JSON.stringify(wrong));
  check('the wrong type shows its message beside the box, in red', wrong.label === 'This ID is a Backglass, not a ROM.' && wrong.labelError === true, JSON.stringify(wrong));
  check('the wrong type is a blocking error on the ROM tab',
    wrong.issues.includes('Manual VPSID needs attention: This ID is a Backglass, not a ROM.'), wrong.issues.join('\n'));
  check('the box is described by its dot', wrong.describedBy === 'manualVpsId-romFilesError', wrong.describedBy);
  check('a bad ID keeps Override\'s own fields required', requiredIssues(wrong.issues).length === 3, wrong.issues.join('\n'));

  // 5. An ID found nowhere.
  await enter('noSuchId99');
  const missing = await look();
  check('an unknown ID says so, on the dot and beside the box', missing.dot === 'No VPS asset has this ID.' && missing.label === 'No VPS asset has this ID.' && missing.value === 'noSuchId99', JSON.stringify(missing));

  // 6. Emptying the box returns to Override as it was.
  await enter('');
  const cleared = await look();
  check('emptying the box clears the dot and the ID', cleared.dot === '' && !cleared.yaml.some(line => line.startsWith('romVPSId')), JSON.stringify(cleared));

  // 7. A reload restores the box and its check.
  await enter(TFTC_ROM);
  await app.run(() => new Promise(resolve => setTimeout(resolve, 450)));
  await app.reload();
  const restored = await look();
  check('a reload restores the ID and its label', restored.value === TFTC_ROM && restored.label === 'Tales from the Crypt · ROM', JSON.stringify(restored));

  // 8. Unticking Override takes the box and the ID away.
  await app.run(async settleText => {
    const settle = eval(settleText);
    document.querySelector('#assetMatrix .asset-row[data-category="romFiles"] .override-toggle input').click();
    await settle();
  }, settleSource);
  const unticked = await look();
  check('unticking Override brings the dropdown back and drops the ID',
    unticked.box === false && unticked.selectShown === true && !unticked.yaml.some(line => line.startsWith('romVPSId')), JSON.stringify(unticked));

  // 9. Ticking Override with this table's own ROM picked keeps it, in the box.
  await play([...PINK_FLOYD, ['asset', 'romFiles', 'jgo91P3SSp'], ['override', 'romFiles', true]]);
  const moved = await look();
  check('an asset already picked moves into the box', moved.value === 'jgo91P3SSp' && moved.label === 'Pink Floyd · ROM', JSON.stringify(moved));
  check('and stays in the YML', moved.yaml.includes('romVPSId: "jgo91P3SSp"'), moved.yaml.join('\n'));
  // The hidden dropdown lets go of it: otherwise it would still name this
  // table's ROM while the box names another.
  await enter(TFTC_ROM);
  const released = await app.run(() => ({
    selection: window.VPS_FEATURE_RUNTIME.state.selections.romFiles ?? null,
    id: window.VPS_FEATURE_RUNTIME.state.values.romVPSId
  }));
  check('the dropdown\'s selection is released, so only the box names the ROM',
    released.selection === null && released.id === TFTC_ROM, JSON.stringify(released));

  // 10. The other four rows have it; DMD and VPU Patch do not.
  await play([...PINK_FLOYD, ['override', 'b2sFiles', true], ['override', 'vpuPatchFiles', true], ['override', 'specialDMD', true]]);
  const b2s = await look('b2sFiles', 'b2s');
  const rows = await app.run(() => ({
    vpuPatch: !!document.querySelector('#assetMatrix .asset-row[data-category="vpuPatchFiles"] .manual-vpsid'),
    dmd: !!document.querySelector('#assetMatrix .asset-row[data-category="specialDMD"] .manual-vpsid')
  }));
  check('the Backglass row has the box', b2s.box === true, JSON.stringify(b2s));
  check('the VPU Patch and DMD rows have none', rows.vpuPatch === false && rows.dmd === false, JSON.stringify(rows));
  await enter(TFTC_B2S, 'b2sFiles');
  const b2sGood = await look('b2sFiles', 'b2s');
  check('a Backglass from another table is verified on the Backglass row',
    b2sGood.label === 'Tales from the Crypt · Backglass' && b2sGood.dot === '' && requiredIssues(b2sGood.issues).length === 0, JSON.stringify(b2sGood));

  check('no page errors', app.errors.filter(error => !/Unable to preload the VPS database/.test(error)).length === 0, app.errors.join('\n'));
}

await app.close();
report('manual-vpsid');
