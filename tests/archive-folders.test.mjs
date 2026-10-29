// "Add from archive folders" in the VPX Post-install Renames and Extract
// Extra Paths windows (Jason, 2026-10-29). Every archive dropped on any
// checksum field leaves its folder list in __archiveDirectoryLists, keyed by
// the field; each window offers every stored folder in a multi-select picker
// under its note. Extract adds one row per picked folder; Renames adds one row
// per folder with source and destination both set to it. A folder already in
// the window is skipped, and the empty row a fresh window opens with is
// filled. The folders are offered as the archive lists them (Jason's call).
//
// Runs the real app in headless Chrome through the scenario runner, and drops
// real fixture archives on real fields: a ROM archive (a field that never
// browsed folders before) and an Alt Sound archive (its own controller).

import { check, report } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, play, PRINT } = await startScenarios();

// Pink Floyd: an "Original" table, so a ROM archive is hashed whole (no Stern
// .bin scan). Alt Sound on by Override turns the two windows on.
const SETUP = [
  ['search', 'Lgi1JLk0Vf'], ['asset', 'tableFiles', 'qV3Z3oQ8md'],
  ['asset', 'romFiles', 'jgo91P3SSp'], ['override', 'altSoundFiles', true]
];
// fixtures/pup-test.zip: Top/root.txt, Another/file.txt, Top/Sub/deep.txt.
const ROM_FOLDERS = ['Another', 'Top', 'Top/Sub'];
// fixtures/pup-normal.zip: TheMatrixPup/{PUPVideos/{Attract,BackGlass,DMD},scripts}.
const ALT_FOLDERS = ['TheMatrixPup', 'TheMatrixPup/PUPVideos', 'TheMatrixPup/scripts',
  'TheMatrixPup/PUPVideos/Attract', 'TheMatrixPup/PUPVideos/BackGlass', 'TheMatrixPup/PUPVideos/DMD'];

const settleSource = `() => new Promise(resolve => {
  const frames = n => n ? requestAnimationFrame(() => frames(n - 1)) : setTimeout(resolve, 0);
  frames(3);
})`;

// Drops a fixture on a checksum field, the way a real drop arrives, and waits
// for the field's status line to finish.
async function drop(stepId, fieldKey, fixture) {
  return app.run(async ([stepId, fieldKey, fixture, settleText]) => {
    const settle = eval(settleText);
    document.getElementById(`config-tab-${stepId}`).click();
    await settle();
    const input = document.getElementById(`field-${fieldKey}`);
    if (!input) return { error: 'no field' };
    // A fixture path, or { name, text } for a file made on the spot.
    const file = typeof fixture === 'string'
      ? new File([await (await fetch('fixtures/' + fixture)).blob()], fixture.split('/').pop())
      : new File([fixture.text], fixture.name);
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    const statusOf = () => {
      const wrapper = document.getElementById(`field-${fieldKey}`)?.closest('.field');
      const hint = wrapper?.querySelector('.checksum-drop-hint');
      return {
        text: hint?.textContent || '',
        error: hint?.classList.contains('error') === true,
        busy: wrapper?.getAttribute('aria-busy') === 'true'
      };
    };
    const started = Date.now();
    while (Date.now() - started < 15000) {
      await new Promise(resolve => setTimeout(resolve, 50));
      const status = statusOf();
      if (!status.busy && status.text && !status.text.startsWith('Processing')) break;
    }
    await settle();
    const lists = window.VPS_FEATURE_RUNTIME.state.values.__archiveDirectoryLists || {};
    return {
      status: statusOf(),
      checksum: String(window.VPS_FEATURE_RUNTIME.state.values[fieldKey] || ''),
      lists: JSON.parse(JSON.stringify(lists))
    };
  }, [stepId, fieldKey, fixture, settleSource]);
}

// Opens a window (renames or extract) and reports the folder control.
async function openWindow(which) {
  return app.run(async ([which, settleText]) => {
    const settle = eval(settleText);
    const ids = which === 'renames'
      ? { button: 'vpxRenamesBtn', dialog: 'vpxRenamesDialog', picker: 'vpxRenamesFolders' }
      : { button: 'vpxExtractBtn', dialog: 'vpxExtractDialog', picker: 'vpxExtractFolders' };
    document.getElementById('config-tab-vpx').click();
    await settle();
    document.getElementById(ids.button).click();
    await settle();
    const node = document.getElementById(ids.dialog);
    const trigger = document.getElementById(ids.picker);
    const adder = node?.querySelector('.archive-folder-adder');
    const label = adder?.querySelector('label');
    return {
      open: node?.open === true,
      underNote: node?.querySelector('.vpx-magic-note')?.nextElementSibling === adder && Boolean(adder),
      triggerDisabled: trigger?.disabled === true,
      triggerText: trigger?.textContent.replace('▾', '').trim() || '',
      triggerName: trigger?.getAttribute('aria-label') || '',
      labelFor: label?.htmlFor || '',
      labelText: label?.textContent || '',
      addDisabled: document.getElementById(`${ids.picker}-add`)?.disabled === true
    };
  }, [which, settleSource]);
}

// With a window open: opens its picker, ticks `folders` by mouse (expanding
// LOAD MORE first when `expand`), then presses Add Selected.
async function pick(which, folders, { expand = false, add = true } = {}) {
  return app.run(async ([which, folders, expand, add, settleText]) => {
    const settle = eval(settleText);
    const prefix = which === 'renames' ? 'vpxRenames' : 'vpxExtract';
    const trigger = document.getElementById(`${prefix}Folders`);
    const panel = document.getElementById(`${prefix}Folders-panel`);
    const adder = trigger.closest('.archive-folder-adder');
    const heightBefore = adder.getBoundingClientRect().height;
    trigger.click();
    await settle();
    if (expand) {
      panel.querySelector('.archive-directory-more')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      await settle();
    }
    const offered = [...panel.querySelectorAll('.archive-directory-option')].map(row => row.dataset.value);
    for (const folder of folders) {
      const row = [...panel.querySelectorAll('.archive-directory-option')].find(item => item.dataset.value === folder);
      if (!row) return { missing: folder, offered };
      row.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      await settle();
    }
    const ticked = [...panel.querySelectorAll('.archive-directory-option[aria-selected="true"]')].map(row => row.dataset.value);
    const groups = [...panel.querySelectorAll('.archive-directory-group')].map(group => {
      const header = group.querySelector('.archive-directory-group-label');
      return {
        label: header?.textContent || '',
        wraps: header ? getComputedStyle(header).whiteSpace !== 'nowrap' && getComputedStyle(header).textOverflow !== 'ellipsis' : false,
        role: group.getAttribute('role'),
        labelledBy: group.getAttribute('aria-labelledby') === header?.id && Boolean(header?.id),
        headerIsOption: header?.getAttribute('role') === 'option',
        borderTop: getComputedStyle(group).borderTopWidth,
        values: [...group.querySelectorAll('.archive-directory-option')].map(row => row.dataset.value)
      };
    });
    const boxes = [...panel.querySelectorAll('.archive-directory-option')].map(row => ({
      value: row.dataset.value, before: getComputedStyle(row, '::before').content
    }));
    const during = {
      panelOpen: !panel.hidden,
      multiselectable: panel.getAttribute('aria-multiselectable'),
      triggerText: trigger.textContent.replace('▾', '').trim(),
      addDisabled: document.getElementById(`${prefix}Folders-add`).disabled
    };
    if (add) {
      document.getElementById(`${prefix}Folders-add`).click();
      await settle();
    }
    const list = which === 'renames'
      ? [...document.querySelectorAll('#vpxRenamesList .vpx-renames-row')].map(row =>
        [...row.querySelectorAll('input')].map(input => input.value))
      : [...document.querySelectorAll('#vpxExtractList input')].map(input => input.value);
    const statusNode = document.getElementById(`${prefix}Folders-status`);
    const head = adder.querySelector('.archive-folder-adder-head');
    const statusBox = statusNode.getBoundingClientRect();
    const layout = {
      heightBefore, heightAfter: adder.getBoundingClientRect().height,
      onLabelLine: statusNode.parentElement === head && Boolean(head?.querySelector('.archive-folder-adder-label')),
      aboveDropdown: statusBox.bottom <= trigger.getBoundingClientRect().top,
      rightEdge: Math.round(head.getBoundingClientRect().right - statusBox.right),
      textAlign: getComputedStyle(statusNode).textAlign,
      fits: statusNode.scrollWidth <= statusNode.clientWidth,
      shown: statusBox.width > 0 && getComputedStyle(statusNode).display !== 'none'
    };
    return {
      offered, ticked, boxes, during, list, groups, layout,
      status: statusNode.textContent,
      focus: document.activeElement?.id || '',
      panelOpenAfter: !panel.hidden,
      triggerTextAfter: trigger.textContent.replace('▾', '').trim(),
      addDisabledAfter: document.getElementById(`${prefix}Folders-add`).disabled
    };
  }, [which, folders, expand, add, settleSource]);
}

async function saveWindow(which) {
  return app.run(async ([which, settleText]) => {
    const settle = eval(settleText);
    document.getElementById(which === 'renames' ? 'vpxRenamesSave' : 'vpxExtractSave').click();
    await settle();
    const key = which === 'renames' ? 'postInstallRename' : 'vpxExtractExtra';
    return JSON.stringify(window.VPS_FEATURE_RUNTIME.state.values[key] ?? null);
  }, [which, settleSource]);
}

async function closeWindows() {
  await app.run(() => {
    ['vpxRenamesDialog', 'vpxExtractDialog'].forEach(id => document.querySelector(`#${id} .dialog-close`)?.click());
  });
}

if (!PRINT) {
  await play(SETUP);

  // 1. Before any drop: both windows show the control under the note, greyed.
  for (const which of ['extract', 'renames']) {
    const empty = await openWindow(which);
    check(`${which}: the window opens`, empty.open === true, JSON.stringify(empty));
    check(`${which}: the folder control sits just under the note`, empty.underNote === true, JSON.stringify(empty));
    check(`${which}: with no archive dropped the list is greyed out`, empty.triggerDisabled === true && empty.addDisabled === true, JSON.stringify(empty));
    check(`${which}: and says how to fill it`,
      empty.triggerText === 'Drop an archive on a checksum field to list its folders', empty.triggerText);
    check(`${which}: the visible label names the control, and matches its spoken name`,
      empty.labelText === 'Add from archive folders' && empty.triggerName === empty.labelText
      && empty.labelFor === (which === 'renames' ? 'vpxRenamesFolders' : 'vpxExtractFolders'), JSON.stringify(empty));
    await closeWindows();
  }

  // 2. A ROM archive: a field that never browsed folders before now stores them,
  //    and its drop still reads as a plain MD5 success.
  const rom = await drop('rom', 'romChecksum', 'pup-test.zip');
  check('a ROM archive drop still calculates its MD5', /^[0-9A-F]{32}$/i.test(rom.checksum), JSON.stringify(rom));
  check('and its status line stays a success, with no folder count added',
    /^MD5 calculated/.test(rom.status.text) && !/director/.test(rom.status.text) && rom.status.error === false, JSON.stringify(rom.status));
  check('its folders are stored under the ROM field',
    JSON.stringify(rom.lists.romChecksum?.directories) === JSON.stringify(ROM_FOLDERS)
    && rom.lists.romChecksum?.name === 'pup-test.zip', JSON.stringify(rom.lists));

  // 3. An Alt Sound archive goes through its own controller.
  const alt = await drop('altSound', 'altSoundChecksum', 'pup-normal.zip');
  check('an Alt Sound archive drop stores its folders too',
    JSON.stringify(alt.lists.altSoundChecksum?.directories) === JSON.stringify(ALT_FOLDERS), JSON.stringify(alt.lists));
  check('the ROM list is kept beside it', Boolean(alt.lists.romChecksum), JSON.stringify(alt.lists));

  // 4. Screen-only: none of it reaches the YML.
  const yaml = await app.run(() => document.getElementById('previewYaml').textContent);
  check('the folder lists never reach the YML',
    !/__archiveDirectoryLists|TheMatrixPup|Another/.test(yaml), yaml);

  // 5. Extract: the merged list, ticked by mouse, added as rows.
  const opened = await openWindow('extract');
  check('extract: with archives dropped the list is live', opened.triggerDisabled === false, JSON.stringify(opened));
  check('extract: Add Selected waits for a tick', opened.addDisabled === true, JSON.stringify(opened));
  const two = await pick('extract', ['Top', 'Another']);
  check('extract: one group per archive in tab order, shallow first, deep folders behind LOAD MORE',
    JSON.stringify(two.offered) === JSON.stringify(['Another', 'Top', 'Top/Sub', 'TheMatrixPup', 'TheMatrixPup/PUPVideos', 'TheMatrixPup/scripts']),
    JSON.stringify(two.offered));
  check('extract: each group is headed by its tab and file name',
    JSON.stringify(two.groups.map(group => group.label)) === JSON.stringify(['ROM · pup-test.zip', 'Alt Sound · pup-normal.zip']),
    JSON.stringify(two.groups));
  check('extract: headers wrap rather than cut off',
    two.groups.length === 2 && two.groups.every(group => group.wraps === true), JSON.stringify(two.groups));
  check('extract: each group is a labelled group of options, the header outside the options',
    two.groups.every(group => group.role === 'group' && group.labelledBy && group.headerIsOption === false),
    JSON.stringify(two.groups));
  check('extract: a rule separates the second group from the first, and only the second',
    two.groups[0]?.borderTop === '0px' && two.groups[1]?.borderTop === '1px', JSON.stringify(two.groups));
  check('extract: the panel says it is multi-select', two.during.multiselectable === 'true', JSON.stringify(two.during));
  check('extract: ticking keeps the panel open', two.during.panelOpen === true, JSON.stringify(two.during));
  check('extract: both rows ticked', JSON.stringify(two.ticked) === JSON.stringify(['Another', 'Top']), JSON.stringify(two.ticked));
  check('extract: a ticked row shows a tick, an unticked one an empty box',
    two.boxes.find(box => box.value === 'Top')?.before === '"✓"'
    && two.boxes.find(box => box.value === 'TheMatrixPup')?.before === '""', JSON.stringify(two.boxes));
  check('extract: the trigger counts the ticks', two.during.triggerText === '2 of 9 directories selected', two.during.triggerText);
  check('extract: Add Selected wakes up', two.during.addDisabled === false, JSON.stringify(two.during));
  check('extract: one row per folder, in list order, filling the empty starting row',
    JSON.stringify(two.list) === JSON.stringify(['Another', 'Top']), JSON.stringify(two.list));
  check('extract: says what it added', two.status === 'Added 2 folders.', two.status);
  check('extract: the message sits on the label\'s line, right-aligned, above the dropdown',
    two.layout.onLabelLine && two.layout.aboveDropdown && two.layout.rightEdge === 0 && two.layout.textAlign === 'right'
    && two.layout.shown, JSON.stringify(two.layout));
  check('extract: the message fits beside the label, uncut', two.layout.fits === true, JSON.stringify(two.layout));
  check('extract: the message appearing does not change the control\'s height',
    two.layout.heightBefore > 0 && two.layout.heightAfter === two.layout.heightBefore, JSON.stringify(two.layout));
  check('extract: the keyboard lands on the first new row', two.focus === 'vpxExtractPath0', two.focus);
  check('extract: the ticks clear and the panel closes after adding',
    two.panelOpenAfter === false && two.addDisabledAfter === true && /^Showing|^Choose/.test(two.triggerTextAfter), JSON.stringify(two));

  // 6. A folder already listed is skipped; LOAD MORE reveals the deep ones.
  const more = await pick('extract', ['Top', 'Top/Sub', 'TheMatrixPup/PUPVideos/DMD'], { expand: true });
  check('extract: only the new folders are added',
    JSON.stringify(more.list) === JSON.stringify(['Another', 'Top', 'Top/Sub', 'TheMatrixPup/PUPVideos/DMD']), JSON.stringify(more.list));
  check('extract: the count says two, not three', more.status === 'Added 2 folders.', more.status);
  const again = await pick('extract', ['Top']);
  check('extract: a folder already there adds nothing', again.list.length === 4, JSON.stringify(again.list));
  check('extract: and says so', again.status === 'Already in the list.', again.status);
  check('extract: the keyboard goes back to the folder list, not a disabled button',
    again.focus === 'vpxExtractFolders', again.focus);
  check('extract: Save writes the picked folders',
    (await saveWindow('extract')) === JSON.stringify(['Another', 'Top', 'Top/Sub', 'TheMatrixPup/PUPVideos/DMD']));

  // 7. Keyboard: Enter opens, ArrowDown moves, Space ticks and stays open,
  //    Escape closes the panel and not the window.
  await openWindow('extract');
  await app.run(() => document.getElementById('vpxExtractFolders').focus());
  await app.pressKey('Enter');
  await app.pressKey('ArrowDown');
  await app.pressKey(' ');
  const keyed = await app.run(() => ({
    ticked: [...document.querySelectorAll('#vpxExtractFolders-panel .archive-directory-option[aria-selected="true"]')].map(row => row.dataset.value),
    panelOpen: !document.getElementById('vpxExtractFolders-panel').hidden,
    activeIsOption: document.getElementById(document.getElementById('vpxExtractFolders').getAttribute('aria-activedescendant') || '')
      ?.classList.contains('archive-directory-option') === true
  }));
  check('keyboard: Space ticks the highlighted folder and keeps the panel open',
    JSON.stringify(keyed.ticked) === '["Top"]' && keyed.panelOpen === true, JSON.stringify(keyed));
  check('keyboard: the highlight is always on a folder, never a group header', keyed.activeIsOption === true, JSON.stringify(keyed));
  await app.pressKey('Escape');
  const escaped = await app.run(() => ({
    panelOpen: !document.getElementById('vpxExtractFolders-panel').hidden,
    windowOpen: document.getElementById('vpxExtractDialog').open,
    addDisabled: document.getElementById('vpxExtractFolders-add').disabled
  }));
  check('keyboard: Escape closes the panel, not the window, and keeps the tick',
    escaped.panelOpen === false && escaped.windowOpen === true && escaped.addDisabled === false, JSON.stringify(escaped));
  await closeWindows();
  const reopened = await openWindow('extract');
  check('reopening starts with nothing ticked', reopened.addDisabled === true && !/selected/.test(reopened.triggerText), JSON.stringify(reopened));
  await closeWindows();

  // 8. Renames: one mirrored row per folder, destination ready to edit.
  await openWindow('renames');
  const renames = await pick('renames', ['TheMatrixPup', 'Top']);
  // List order: the ROM group comes before the Alt Sound group.
  check('renames: each folder becomes a row with source and destination the same',
    JSON.stringify(renames.list) === JSON.stringify([['Top', 'Top'], ['TheMatrixPup', 'TheMatrixPup']]), JSON.stringify(renames.list));
  check('renames: the keyboard lands on the first new destination', renames.focus === 'vpxRenameDestination0', renames.focus);
  const edited = await app.run(() => {
    const input = document.getElementById('vpxRenameDestination0');
    input.value = 'Moved/Top';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input.value;
  });
  const skip = await pick('renames', ['Top']);
  check('renames: a folder already a source is skipped, even with its destination edited',
    skip.list.length === 2 && skip.list[0][1] === edited && skip.status === 'Already in the list.', JSON.stringify(skip));
  check('renames: Save writes the rows',
    (await saveWindow('renames')) === JSON.stringify([
      { source: 'Top', destination: 'Moved/Top' }, { source: 'TheMatrixPup', destination: 'TheMatrixPup' }]));

  // 9. A new archive on the same field replaces its folders; one with no
  //    folders removes them.
  const flat = await drop('rom', 'romChecksum', 'stern-rom-single.zip');
  check('an archive with no folders removes the field\'s old list',
    !flat.lists.romChecksum && Boolean(flat.lists.altSoundChecksum), JSON.stringify(flat.lists));
  const afterFlat = await openWindow('extract');
  const offeredAfter = await pick('extract', [], { add: false });
  check('the window no longer offers the old ROM folders',
    !offeredAfter.offered.includes('Another') && offeredAfter.offered.includes('TheMatrixPup'), JSON.stringify(offeredAfter.offered));
  await closeWindows();
  check('(the window was open for that check)', afterFlat.open === true);

  // 9b. A locked archive on a field that never browsed folders says so
  //     (Jason, 2026-10-29): a header-encrypted RAR5 cannot be listed with
  //     no password saved. A ROM archive is hashed whole, so the MD5 counts.
  const locked = await drop('rom', 'romChecksum', 'generated/enc-rar5-hp.rar');
  check('a locked ROM archive still calculates its MD5',
    /^[0-9A-F]{32}$/i.test(locked.checksum), JSON.stringify(locked));
  check('and its status line says the MD5 came and why the folders did not',
    /^MD5 calculated · Could not open "enc-rar5-hp\.rar": it is password protected/.test(locked.status.text)
    && locked.status.error === true, JSON.stringify(locked.status));
  check('the message is said once', locked.status.text.split('password protected').length === 2, locked.status.text);
  check('and it leaves no folder list', !locked.lists.romChecksum, JSON.stringify(locked.lists));

  //     The VPX field opens the archive to find its .vpx, so a lock fails
  //     the checksum too; the one message is still said once.
  const lockedVpx = await drop('vpx', 'vpxChecksum', 'generated/enc-rar5-hp.rar');
  check('a lock that fails the checksum and the folders is said once',
    lockedVpx.status.error === true && lockedVpx.status.text.split('password protected').length === 2, JSON.stringify(lockedVpx.status));

  //     Any other failed folder read on such a field stays quiet: a file
  //     named .zip that is not one cannot be listed, but is hashed whole.
  const warningsBefore = app.warnings.length;
  const broken = await drop('rom', 'romChecksum', { name: 'not-really.zip', text: 'this is not an archive' });
  check('a broken ROM archive still calculates its MD5', /^[0-9A-F]{32}$/i.test(broken.checksum), JSON.stringify(broken));
  check('and its status line stays a plain success',
    /^MD5 calculated from not-really\.zip$/.test(broken.status.text) && broken.status.error === false, JSON.stringify(broken.status));
  check('because the folder read really did fail',
    app.warnings.slice(warningsBefore).some(text => /Archive browse failed/.test(text)), app.warnings.slice(warningsBefore).join('\n'));

  // 10. Emptying the checksum by hand takes its folders with it.
  const back = await drop('rom', 'romChecksum', 'pup-test.zip');
  check('a second archive on the field brings its folders back', Boolean(back.lists.romChecksum), JSON.stringify(back.lists));
  const typed = await app.run(async settleText => {
    const settle = eval(settleText);
    const input = document.getElementById('field-romChecksum');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    return JSON.parse(JSON.stringify(window.VPS_FEATURE_RUNTIME.state.values.__archiveDirectoryLists || {}));
  }, settleSource);
  check('emptying the checksum removes its folders, and only its',
    !typed.romChecksum && Boolean(typed.altSoundChecksum), JSON.stringify(typed));

  // 11. Clear section takes a tab's folders with it.
  await drop('rom', 'romChecksum', 'pup-test.zip');
  const cleared = await app.run(async settleText => {
    const settle = eval(settleText);
    document.getElementById('config-tab-rom').click();
    await settle();
    document.querySelector('#config-panel-rom .clear-section-btn').click();
    await settle();
    return JSON.parse(JSON.stringify(window.VPS_FEATURE_RUNTIME.state.values.__archiveDirectoryLists || {}));
  }, settleSource);
  check('Clear section on the ROM tab removes its folders, and only its',
    !cleared.romChecksum && Boolean(cleared.altSoundChecksum), JSON.stringify(cleared));
  const altCleared = await app.run(async settleText => {
    const settle = eval(settleText);
    document.getElementById('config-tab-altSound').click();
    await settle();
    document.querySelector('#config-panel-altSound .clear-section-btn').click();
    await settle();
    return window.VPS_FEATURE_RUNTIME.state.values.__archiveDirectoryLists ?? null;
  }, settleSource);
  check('with every list gone the key itself goes', altCleared === null, JSON.stringify(altCleared));

  // 12. The Color ROM field scans archives on its own path. An archive with
  //     no Color ROM file in it still fails as before, and its folders are
  //     still offered (any archive dropped on a checksum field counts).
  await play([...SETUP, ['override', 'altColorFiles', true]]);
  const color = await drop('coloredRom', 'coloredROMChecksum', 'pup-test.zip');
  check('a Color ROM archive with no Color ROM file still reports its own error',
    color.status.error === true && /No Color ROM file/.test(color.status.text), JSON.stringify(color.status));
  check('its folders are stored all the same',
    JSON.stringify(color.lists.coloredROMChecksum?.directories) === JSON.stringify(ROM_FOLDERS), JSON.stringify(color.lists));

  // 13. Switching the DMD to Bundled means its own archive is no longer part
  //     of the build, so that archive's folders go with the switch.
  await play([...SETUP, ['override', 'specialDMD', true], ['dmdType', 'FlexDMD']]);
  const dmd = await drop('dmd', 'specialDMDChecksum', 'pup-test.zip');
  check('a DMD archive drop stores its folders', Boolean(dmd.lists.specialDMDChecksum), JSON.stringify(dmd.lists));
  const bundled = await app.run(async settleText => {
    const settle = eval(settleText);
    const box = document.querySelector('.asset-row[data-category="specialDMD"] .bundle-toggle:not(.nsfw-toggle):not(.override-toggle) input');
    if (!box || box.disabled) return { error: 'no Bundled box' };
    if (!box.checked) box.click();
    await settle();
    return JSON.parse(JSON.stringify(window.VPS_FEATURE_RUNTIME.state.values.__archiveDirectoryLists || {}));
  }, settleSource);
  check('switching the DMD to Bundled removes its archive\'s folders',
    !bundled.error && !bundled.specialDMDChecksum, JSON.stringify(bundled));

  // 14. Additional ROMs. Tales from the Crypt is Data East with four ROMs, so
  //     an Additional ROM row can be saved and its archive is hashed whole.
  //     The editor's drop stores the folders against the row's checksum; they
  //     show only once the row is saved, right after the ROM tab's own
  //     archive, and Clear section on the ROM tab takes them too.
  await play([['search', 'fXaQ33KC'], ['asset', 'tableFiles', 'uVgZUZdK'], ['asset', 'romFiles', 's-4c6GqaOn'], ['override', 'altSoundFiles', true]]);
  // Dropped out of tab order on purpose: the groups must sort by tab, not
  // by when each archive arrived. The Alt Sound archive is the ROM's own
  // pup-test.zip again, so the two share their folders (section 15).
  await drop('altSound', 'altSoundChecksum', 'pup-test.zip');
  await drop('rom', 'romChecksum', 'pup-test.zip');
  // 14a. While a drop loads, the editor shows the loading bar and Save ROM
  //      waits; closing it cancels the load, so nothing lands (Jason,
  //      2026-10-29). Checked straight after the drop, before its first await.
  const cancelled = await app.run(async settleText => {
    const settle = eval(settleText);
    document.getElementById('config-tab-rom').click();
    await settle();
    document.querySelector('#config-panel-rom .additional-rom-add').click();
    await settle();
    const node = document.getElementById('additionalRomDialog');
    const wrapper = document.getElementById('additionalRomChecksumField');
    const save = document.getElementById('additionalRomSave');
    const file = new File([await (await fetch('fixtures/pup-normal.zip')).blob()], 'pup-normal.zip');
    const transfer = new DataTransfer();
    transfer.items.add(file);
    document.getElementById('additionalRomChecksum')
      .dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    const track = wrapper.querySelector('.checksum-loading-track');
    const during = {
      loading: wrapper.classList.contains('checksum-is-loading'),
      busy: wrapper.getAttribute('aria-busy'),
      trackShown: Boolean(track) && getComputedStyle(track).display !== 'none',
      dotMoves: Boolean(track) && getComputedStyle(track.querySelector('.checksum-loading-dot')).animationName === 'checksum-dot-slide',
      saveDisabled: save.disabled,
      hint: wrapper.querySelector('.checksum-drop-hint').textContent
    };
    document.querySelector('#additionalRomDialog [data-additional-rom-close]').click();
    // Long enough for the cancelled job to have finished and been thrown away.
    await new Promise(resolve => setTimeout(resolve, 2000));
    await settle();
    return {
      during,
      closed: !node.open,
      after: {
        loading: wrapper.classList.contains('checksum-is-loading'),
        saveDisabled: save.disabled,
        checksum: document.getElementById('additionalRomChecksum').value,
        stored: Object.keys(window.VPS_FEATURE_RUNTIME.state.values.__archiveDirectoryLists || {})
      }
    };
  }, settleSource);
  check('editor: a drop shows the loading bar, moving', cancelled.during.loading && cancelled.during.trackShown
    && cancelled.during.dotMoves && cancelled.during.busy === 'true', JSON.stringify(cancelled.during));
  check('editor: Save ROM waits while it loads, and the box says what it is doing',
    cancelled.during.saveDisabled === true && /^Calculating MD5 for pup-normal\.zip/.test(cancelled.during.hint), JSON.stringify(cancelled.during));
  check('editor: Cancel still closes it mid-load', cancelled.closed === true, JSON.stringify(cancelled));
  check('editor: and the cancelled load lands nothing',
    cancelled.after.checksum === '' && !cancelled.after.stored.some(key => key.startsWith('additionalRoms:')), JSON.stringify(cancelled.after));
  check('editor: the bar stops and Save ROM is usable again',
    cancelled.after.loading === false && cancelled.after.saveDisabled === false, JSON.stringify(cancelled.after));

  // Escape is the other way out: the browser fires `cancel`, then closes.
  const escapedRom = await app.run(async settleText => {
    const settle = eval(settleText);
    document.querySelector('#config-panel-rom .additional-rom-add').click();
    await settle();
    const node = document.getElementById('additionalRomDialog');
    const transfer = new DataTransfer();
    transfer.items.add(new File([await (await fetch('fixtures/pup-normal.zip')).blob()], 'pup-normal.zip'));
    document.getElementById('additionalRomChecksum')
      .dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    if (node.dispatchEvent(new Event('cancel', { cancelable: true }))) node.close();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await settle();
    return {
      closed: !node.open,
      checksum: document.getElementById('additionalRomChecksum').value,
      stored: Object.keys(window.VPS_FEATURE_RUNTIME.state.values.__archiveDirectoryLists || {})
    };
  }, settleSource);
  check('editor: Escape mid-load cancels it too',
    escapedRom.closed && escapedRom.checksum === '' && !escapedRom.stored.some(key => key.startsWith('additionalRoms:')), JSON.stringify(escapedRom));

  // 14b. A locked archive in the editor: the MD5 counts, and the line says
  //      why its folders did not come.
  const lockedRom = await app.run(async settleText => {
    const settle = eval(settleText);
    document.querySelector('#config-panel-rom .additional-rom-add').click();
    await settle();
    const wrapper = document.getElementById('additionalRomChecksumField');
    const input = document.getElementById('additionalRomChecksum');
    const transfer = new DataTransfer();
    transfer.items.add(new File([await (await fetch('fixtures/generated/enc-rar5-hp.rar')).blob()], 'enc-rar5-hp.rar'));
    input.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    const started = Date.now();
    while (Date.now() - started < 15000 && wrapper.classList.contains('checksum-is-loading')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const hint = wrapper.querySelector('.checksum-drop-hint');
    const result = { checksum: input.value, text: hint.textContent, error: hint.classList.contains('error') };
    document.querySelector('#additionalRomDialog [data-additional-rom-close]').click();
    await settle();
    return result;
  }, settleSource);
  check('editor: a locked archive still gets its MD5', /^[0-9A-F]{32}$/i.test(lockedRom.checksum), JSON.stringify(lockedRom));
  check('editor: and says in red that its folders could not be read, and how to fix it',
    /^MD5 calculated from enc-rar5-hp\.rar · Could not open "enc-rar5-hp\.rar": it is password protected/.test(lockedRom.text)
    && lockedRom.error === true, JSON.stringify(lockedRom));

  const editor = await app.run(async settleText => {
    const settle = eval(settleText);
    document.getElementById('config-tab-rom').click();
    await settle();
    // The + on the Advanced Config summary adds a row; the indicator only
    // appears once one is saved.
    document.querySelector('#config-panel-rom .additional-rom-add').click();
    await settle();
    const select = document.getElementById('additionalRomVpsId');
    select.value = '2Q1pXHma';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const input = document.getElementById('additionalRomChecksum');
    const response = await fetch('fixtures/pup-normal.zip');
    const transfer = new DataTransfer();
    transfer.items.add(new File([await response.blob()], 'pup-normal.zip'));
    input.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    // The loading class comes off only after the folders are stored.
    const wrapper = document.getElementById('additionalRomChecksumField');
    const started = Date.now();
    while (Date.now() - started < 15000) {
      await new Promise(resolve => setTimeout(resolve, 50));
      if (!wrapper.classList.contains('checksum-is-loading') && /^[0-9A-F]{32}$/i.test(input.value)) break;
    }
    const labels = () => window.VPS_UI.archiveFolderGroups(window.VPS_FEATURE_RUNTIME.state.values).map(group => group.label);
    const result = {
      checksum: input.value,
      stored: Object.keys(window.VPS_FEATURE_RUNTIME.state.values.__archiveDirectoryLists || {}),
      beforeSave: labels()
    };
    document.getElementById('additionalRomSave').click();
    await settle();
    result.saved = (window.VPS_FEATURE_RUNTIME.state.values.additionalRoms || []).length;
    result.afterSave = labels();
    return result;
  }, settleSource);
  check('an Additional ROM drop calculates its MD5', /^[0-9A-F]{32}$/i.test(editor.checksum), JSON.stringify(editor));
  check('its folders are stored against that checksum',
    editor.stored.includes(`additionalRoms:${editor.checksum.toUpperCase()}`), JSON.stringify(editor.stored));
  check('they are not offered while the row is unsaved',
    JSON.stringify(editor.beforeSave) === JSON.stringify(['ROM · pup-test.zip', 'Alt Sound · pup-test.zip']), JSON.stringify(editor.beforeSave));
  check('once saved they are offered right after the ROM tab\'s own archive',
    editor.saved === 1 && JSON.stringify(editor.afterSave) === JSON.stringify(['ROM · pup-test.zip', 'Additional ROM · pup-normal.zip', 'Alt Sound · pup-test.zip']),
    JSON.stringify(editor));

  // 15. A folder two archives share (the ROM and Alt Sound archives above).
  //     It shows in both groups, ticking either copy ticks both, the
  //     highlight stays on the copy clicked, and it is added once.
  await openWindow('extract');
  const shared = await app.run(async settleText => {
    const settle = eval(settleText);
    const trigger = document.getElementById('vpxExtractFolders');
    const panel = document.getElementById('vpxExtractFolders-panel');
    trigger.click();
    await settle();
    const groups = () => [...panel.querySelectorAll('.archive-directory-group')];
    const labels = groups().map(group => group.querySelector('.archive-directory-group-label').textContent);
    groups()[2]?.querySelector('.archive-directory-option[data-value="Top"]')
      ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await settle();
    const tops = [...panel.querySelectorAll('.archive-directory-option[data-value="Top"]')];
    const active = document.getElementById(trigger.getAttribute('aria-activedescendant') || '');
    const result = {
      labels,
      copies: tops.length,
      bothTicked: tops.length === 2 && tops.every(row => row.getAttribute('aria-selected') === 'true'),
      activeOnClicked: Boolean(groups()[2]?.contains(active)) && active?.dataset.value === 'Top',
      triggerText: trigger.textContent.replace('▾', '').trim()
    };
    document.getElementById('vpxExtractFolders-add').click();
    await settle();
    result.list = [...document.querySelectorAll('#vpxExtractList input')].map(input => input.value);
    return result;
  }, settleSource);
  check('three archives, three groups, sorted by tab though dropped out of order',
    JSON.stringify(shared.labels) === JSON.stringify(['ROM · pup-test.zip', 'Additional ROM · pup-normal.zip', 'Alt Sound · pup-test.zip']),
    JSON.stringify(shared.labels));
  check('a shared folder shows in both groups, and ticking one copy ticks both',
    shared.copies === 2 && shared.bothTicked === true, JSON.stringify(shared));
  check('the highlight stays on the copy that was clicked', shared.activeOnClicked === true, JSON.stringify(shared));
  check('the count counts a shared folder once', shared.triggerText === '1 of 9 directories selected', shared.triggerText);
  check('and it is added once', JSON.stringify(shared.list) === '["Top"]', JSON.stringify(shared.list));
  await closeWindows();

  const romCleared = await app.run(async settleText => {
    const settle = eval(settleText);
    document.getElementById('config-tab-rom').click();
    await settle();
    document.querySelector('#config-panel-rom .clear-section-btn').click();
    await settle();
    return Object.keys(window.VPS_FEATURE_RUNTIME.state.values.__archiveDirectoryLists || {});
  }, settleSource);
  check('Clear section on the ROM tab takes the Additional ROM folders with its own',
    JSON.stringify(romCleared) === '["altSoundChecksum"]', JSON.stringify(romCleared));

  // 16. A long archive name in a narrow list wraps onto a second line; the
  //     whole name stays readable, with no tooltip needed.
  const longName = await app.run(async settleText => {
    const settle = eval(settleText);
    const adder = window.VPS_UI.createArchiveFolderAdder({ id: 'probeFolders', onAdd: () => 0 });
    adder.element.style.width = '300px';
    document.body.appendChild(adder.element);
    const name = "Aleksandra Wisniewska-Kowalczyk's Very Long Table Backglass Pack v2.1 Final.zip";
    adder.refresh({ __archiveDirectoryLists: { romChecksum: { name, directories: ['A'] } } });
    document.getElementById('probeFolders').click();
    await settle();
    const header = document.querySelector('#probeFolders-panel .archive-directory-group-label');
    const result = {
      text: header?.textContent || '',
      uncut: header ? header.scrollWidth <= header.clientWidth : false,
      lines: header ? Math.round(header.getBoundingClientRect().height / parseFloat(getComputedStyle(header).lineHeight)) : 0
    };
    document.getElementById('probeFolders').click();
    adder.element.remove();
    return result;
  }, settleSource);
  check('a long archive name wraps instead of being cut',
    longName.text.endsWith('Final.zip') && longName.uncut === true && longName.lines >= 2, JSON.stringify(longName));

  check('no page errors', app.errors.filter(error => !/Unable to preload the VPS database/.test(error)).length === 0, app.errors.join('\n'));
}

await app.close();
report('archive-folders');
