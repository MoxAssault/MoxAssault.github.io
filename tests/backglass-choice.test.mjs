// Backglass Checksum accepts .b2spro as well as .directb2s (Jason, 2026-11-04),
// loose or inside an archive, and an archive holding both types asks which one
// to use ("Choose Which Version"). Real app, real engines, real drops.
//
// THE ORACLE IS INDEPENDENT OF THE APP: the fixtures were built with 7-Zip and
// WinRAR from the two strings below, and the expected MD5s come from Node.
//   backglass-both.{zip,7z,rar}  Classic/Table.directb2s, Pro/Table.B2SPro, readme.txt
//   backglass-pro-only.zip       Pro/Table.B2SPro, readme.txt
//   backglass-classic-only.zip   Classic/Table.directb2s, readme.txt
//   backglass-two-classic.zip    Classic/Second.directb2s, Classic/Table.directb2s
//   backglass-none.zip           readme.txt

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { check, report, repoPath } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const md5 = text => createHash('md5').update(text).digest('hex').toUpperCase();
const CLASSIC_TEXT = 'classic backglass bytes\n';
const PRO_TEXT = 'pro backglass bytes\n';
const CLASSIC = md5(CLASSIC_TEXT);
const PRO = md5(PRO_TEXT);

const { app, play, PRINT } = await startScenarios();

// Starts a drop on the Backglass Checksum and returns without waiting.
async function startDrop(fixture) {
  return app.run(async fixture => {
    document.getElementById('config-tab-b2s').click();
    await new Promise(resolve => setTimeout(resolve, 50));
    const input = document.getElementById('field-backglassChecksum');
    if (!input) return false;
    const file = typeof fixture === 'string'
      ? new File([await (await fetch('fixtures/' + fixture)).blob()], fixture)
      : new File([fixture.text], fixture.name);
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    return true;
  }, fixture);
}

// Waits for the prompt to open or the field to finish, whichever comes first.
async function settled() {
  return app.run(async () => {
    const read = () => {
      const node = document.getElementById('archiveChoiceDialog');
      const wrapper = document.getElementById('field-backglassChecksum')?.closest('.field');
      const hint = wrapper?.querySelector('.checksum-drop-hint');
      return {
        dialogOpen: node?.open === true,
        title: node?.querySelector('h2')?.textContent || '',
        note: node?.querySelector('#archiveChoiceNote')?.textContent || '',
        options: [...(node?.querySelectorAll('.archive-choice-option') || [])].map(button => button.textContent),
        focused: document.activeElement?.textContent || '',
        status: hint?.textContent || '',
        error: hint?.classList.contains('error') === true,
        busy: wrapper?.getAttribute('aria-busy') === 'true',
        checksum: String(window.VPS_FEATURE_RUNTIME.state.values.backglassChecksum || ''),
        folders: Boolean(window.VPS_FEATURE_RUNTIME.state.values.__archiveDirectoryLists?.backglassChecksum)
      };
    };
    const started = Date.now();
    while (Date.now() - started < 15000) {
      await new Promise(resolve => setTimeout(resolve, 50));
      const state = read();
      if (state.dialogOpen) return state;
      if (!state.busy && state.status && !state.status.startsWith('Processing')) return state;
    }
    return read();
  });
}

async function drop(fixture) {
  await startDrop(fixture);
  return settled();
}

// how: a file name to pick, 'cancel', 'x', 'esc' or 'backdrop'.
async function answer(how) {
  await app.run(how => {
    const node = document.getElementById('archiveChoiceDialog');
    if (how === 'esc') { node.close(); return; }
    if (how === 'backdrop') { node.click(); return; }
    const closers = [...node.querySelectorAll('[data-archive-choice-close]')];
    if (how === 'x') { closers[0].click(); return; }
    if (how === 'cancel') { closers[1].click(); return; }
    [...node.querySelectorAll('.archive-choice-option')].find(button => button.textContent === how).click();
  }, how);
  return settled();
}

if (!PRINT) {
  await play([['search', 'Lgi1JLk0Vf'], ['asset', 'tableFiles', 'qV3Z3oQ8md'], ['override', 'b2sFiles', true]]);

  const hint = await app.run(async () => {
    document.getElementById('config-tab-b2s').click();
    await new Promise(resolve => setTimeout(resolve, 50));
    return document.getElementById('field-backglassChecksum')?.closest('.field')?.querySelector('.checksum-drop-hint')?.textContent;
  });
  check('the drop hint names .b2spro', hint === 'Drop .directb2s / .b2spro / .zip / .rar / .7z file to calculate MD5', hint);

  // Loose files, in any capitalisation.
  const loose = await drop({ name: 'Table.B2SPro', text: PRO_TEXT });
  check('a loose .B2SPro is accepted and hashed', loose.checksum === PRO && !loose.error, JSON.stringify(loose));
  const looseClassic = await drop({ name: 'Table.directb2s', text: CLASSIC_TEXT });
  check('a loose .directb2s still works', looseClassic.checksum === CLASSIC && !looseClassic.error, JSON.stringify(looseClassic));
  const wrong = await drop({ name: 'Table.b2s', text: 'x' });
  check('another type is still refused, and the message names .b2spro',
    wrong.error && wrong.status.includes('.b2spro') && wrong.checksum === CLASSIC, JSON.stringify(wrong));

  // One type in the archive: no prompt.
  const proOnly = await drop('backglass-pro-only.zip');
  check('an archive with only a .B2SPro hashes it without asking',
    !proOnly.dialogOpen && proOnly.checksum === PRO && proOnly.status.includes('Table.B2SPro'), JSON.stringify(proOnly));
  const classicOnly = await drop('backglass-classic-only.zip');
  check('an archive with only a .directb2s hashes it without asking',
    !classicOnly.dialogOpen && classicOnly.checksum === CLASSIC && classicOnly.status.includes('Table.directb2s'), JSON.stringify(classicOnly));
  const twoClassic = await drop('backglass-two-classic.zip');
  check('two files of the same type do not ask (first match, as before)',
    !twoClassic.dialogOpen && twoClassic.checksum === CLASSIC, JSON.stringify(twoClassic));
  const none = await drop('backglass-none.zip');
  check('an archive with neither says so and names both types',
    !none.dialogOpen && none.error && none.status.includes('No .directb2s / .b2spro file found inside'), JSON.stringify(none));

  // Both types: the prompt, on every archive format.
  for (const fixture of ['backglass-both.zip', 'backglass-both.7z', 'backglass-both.rar']) {
    const asked = await drop(fixture);
    check(`${fixture}: asks which version`,
      asked.dialogOpen && asked.title === 'Choose Which Version' && asked.note.includes(fixture), JSON.stringify(asked));
    check(`${fixture}: offers exactly the two backglass files`,
      JSON.stringify([...asked.options].sort()) === JSON.stringify(['Classic/Table.directb2s', 'Pro/Table.B2SPro']), JSON.stringify(asked.options));
    check(`${fixture}: the keyboard starts on the first file`, asked.focused === asked.options[0], asked.focused);
    const pro = await answer('Pro/Table.B2SPro');
    check(`${fixture}: picking the .B2SPro hashes that file`,
      !pro.dialogOpen && pro.checksum === PRO && pro.status === `MD5 calculated (Table.B2SPro) from ${fixture}`, JSON.stringify(pro));
    await drop(fixture);
    const classic = await answer('Classic/Table.directb2s');
    check(`${fixture}: a second drop asks again, and picking the .directb2s hashes that file`,
      !classic.dialogOpen && classic.checksum === CLASSIC && classic.status === `MD5 calculated (Table.directb2s) from ${fixture}`, JSON.stringify(classic));
  }

  // Declining leaves the field exactly as it was. Start from a loose file, so
  // the field has a checksum and a status but no folder list.
  await play([['search', 'Lgi1JLk0Vf'], ['asset', 'tableFiles', 'qV3Z3oQ8md'], ['override', 'b2sFiles', true]]);
  const before = await drop({ name: 'Table.B2SPro', text: PRO_TEXT });
  check('(setup: no folder list before declining)', before.folders === false, JSON.stringify(before));
  for (const how of ['cancel', 'x', 'esc', 'backdrop']) {
    await drop('backglass-both.zip');
    const declined = await answer(how);
    check(`${how}: closes and changes nothing`,
      !declined.dialogOpen && !declined.busy && declined.checksum === before.checksum
        && declined.status === before.status && !declined.folders && !declined.error, JSON.stringify(declined));
  }
  const after = await drop('backglass-both.zip');
  check('the prompt still opens after being declined', after.dialogOpen, JSON.stringify(after));
  const finalPick = await answer('Classic/Table.directb2s');
  check('and a pick after that still lands once', finalPick.checksum === CLASSIC, JSON.stringify(finalPick));

  // A second drop lands while the first is still running. The first job is
  // superseded and will never finish its status, so declining must not bring
  // its "Processing" line back: nothing would ever clear it.
  await app.run(async () => {
    document.getElementById('config-tab-b2s').click();
    await new Promise(resolve => setTimeout(resolve, 50));
    const input = document.getElementById('field-backglassChecksum');
    for (const name of ['backglass-pro-only.zip', 'backglass-both.zip']) {
      const file = new File([await (await fetch('fixtures/' + name)).blob()], name);
      window.__queued = [...(window.__queued || []), file];
    }
    for (const file of window.__queued) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    }
  });
  const overlapped = await settled();
  check('(setup: the second drop opened the prompt)', overlapped.dialogOpen, JSON.stringify(overlapped));
  const afterOverlap = await answer('cancel');
  check('declining after an overlapping drop leaves no spinner behind',
    !afterOverlap.busy && !afterOverlap.status.startsWith('Processing') && afterOverlap.checksum === CLASSIC, JSON.stringify(afterOverlap));

  // Other fields keep their single type and never ask.
  const lists = readFileSync(repoPath('js.src', 'fields.js'), 'utf8').split('archiveScanExtension: [').length - 1;
  check('only one field scans for two types', lists === 1, String(lists));

  check('no page errors', app.errors.length === 0, JSON.stringify(app.errors));
}

await app.close();
report();
