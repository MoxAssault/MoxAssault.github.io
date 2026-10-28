// The two-click Clear on the other pop-ups (Jason, 2026-10-28), the same one
// the VPX Advanced Config windows use (VPS_UTILS.bindTwoClick): Additional
// Checksums gains a Clear, the Additional ROM editor's Remove and Recent
// Build History's Clear History take two clicks, and Clear History no longer
// asks through the browser's confirm box. A Recent entry's own Delete stays
// one click: it removes a single history line.
//
// Runs the real app in headless Chrome through the scenario runner.

import { check, report } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, play, PRINT } = await startScenarios();

const MD5_VPX = 'E6DF3800F7C9286FA195E84034DA683A';
const MD5_A = 'A'.repeat(32);
const MD5_B = 'B'.repeat(32);
const MD5_ROM = 'C'.repeat(32);
const PINK_FLOYD = [
  ['search', 'Lgi1JLk0Vf'], ['asset', 'tableFiles', 'qV3Z3oQ8md'],
  ['fill', 'fps', '60'], ['fill', 'testers', 'Tester'], ['fill', 'vpxChecksum', MD5_VPX]
];

const settleSource = `() => new Promise(resolve => {
  const frames = n => n ? requestAnimationFrame(() => frames(n - 1)) : setTimeout(resolve, 0);
  frames(3);
})`;

if (!PRINT) {
  // 1. Additional Checksums: Clear only once extras are saved; two clicks.
  await play(PINK_FLOYD);
  const none = await app.run(async settleText => {
    const settle = eval(settleText);
    document.getElementById('config-tab-vpx').click();
    await settle();
    document.getElementById('field-vpxChecksum').closest('.field').querySelector('.checksum-additional-btn').click();
    const node = document.getElementById('checksumAdditionalDialog');
    const hidden = node.querySelector('#checksumAdditionalClear').hidden;
    node.querySelector('[data-checksum-additional-close]').click();
    return hidden;
  }, settleSource);
  check('Checksums: Clear is hidden while no extra is saved', none === true);

  await play([...PINK_FLOYD, ['additional', 'vpxChecksum', [MD5_A, MD5_B]]]);
  const checksums = await app.run(async settleText => {
    const settle = eval(settleText);
    const values = () => window.VPS_FEATURE_RUNTIME.state.values.vpxChecksum;
    const open = () => {
      document.getElementById('field-vpxChecksum').closest('.field').querySelector('.checksum-additional-btn').click();
      return document.getElementById('checksumAdditionalDialog');
    };
    document.getElementById('config-tab-vpx').click();
    await settle();
    let node = open();
    const clear = node.querySelector('#checksumAdditionalClear');
    const shown = !clear.hidden;
    clear.click();
    const afterOne = { open: node.open, text: clear.textContent, saved: JSON.stringify(values()),
      spoken: node.querySelector(':scope > .two-click-status')?.textContent || '' };
    node.querySelector('[data-checksum-additional-close]').click();
    node = open();
    const reopenedText = clear.textContent;
    clear.click();
    clear.click();
    await settle();
    return { shown, afterOne, reopenedText, closed: !node.open, saved: JSON.stringify(values()) };
  }, settleSource);
  check('Checksums: Clear shows once extras are saved', checksums.shown === true, JSON.stringify(checksums));
  check('Checksums: one click only arms it', checksums.afterOne.open === true
    && checksums.afterOne.text === 'Click Again to Clear All'
    && checksums.afterOne.saved === JSON.stringify([MD5_VPX, MD5_A, MD5_B]), JSON.stringify(checksums.afterOne));
  check('Checksums: arming is spoken from a status line inside the dialog', checksums.afterOne.spoken === 'Click Again to Clear All', JSON.stringify(checksums.afterOne));
  check('Checksums: reopening disarms it', checksums.reopenedText === 'Clear', checksums.reopenedText);
  check('Checksums: the second click clears the extras and keeps the primary',
    checksums.closed === true && checksums.saved === JSON.stringify(MD5_VPX), JSON.stringify(checksums));

  // 2. Additional ROM: Remove takes two clicks.
  await play([...PINK_FLOYD, ['asset', 'romFiles', 'jgo91P3SSp'], ['fill', 'romChecksum', MD5_ROM],
    ['draft', 'values.additionalRoms', [{ vpsId: '', checksum: MD5_A, versionOverride: '', urlOverride: '' }]]]);
  const rom = await app.run(async settleText => {
    const settle = eval(settleText);
    const saved = () => (window.VPS_FEATURE_RUNTIME.state.values.additionalRoms || []).length;
    document.getElementById('config-tab-rom').click();
    await settle();
    const open = () => {
      document.querySelector('#config-panel-rom .additional-rom-indicator').click();
      return document.getElementById('additionalRomDialog');
    };
    let node = open();
    const remove = node.querySelector('#additionalRomRemove');
    remove.click();
    const afterOne = { open: node.open, text: remove.textContent, saved: saved() };
    node.querySelector('[data-additional-rom-close]').click();
    node = open();
    const reopenedText = remove.textContent;
    remove.click();
    remove.click();
    await settle();
    return { afterOne, reopenedText, closed: !node.open, saved: saved() };
  }, settleSource);
  check('Additional ROM: one click on Remove only arms it', rom.afterOne.open === true
    && rom.afterOne.text === 'Click Again to Remove' && rom.afterOne.saved === 1, JSON.stringify(rom.afterOne));
  check('Additional ROM: reopening disarms it', rom.reopenedText === 'Remove', rom.reopenedText);
  check('Additional ROM: the second click removes it', rom.closed === true && rom.saved === 0, JSON.stringify(rom));

  // 3. Recent Build History: Clear History takes two clicks, never confirm().
  await app.run(() => localStorage.setItem('vpxs-yml-recent-builds-v2', JSON.stringify([
    { id: 'Lgi1JLk0Vf', name: 'Pink Floyd', yaml: '---\n', filename: 'a.yml', savedAt: new Date().toISOString() },
    { id: 'Lgi1JLk0Vf', name: 'Pink Floyd', yaml: '---\n', filename: 'b.yml', savedAt: new Date().toISOString() }
  ])));
  await app.reload();
  const recent = await app.run(async settleText => {
    const settle = eval(settleText);
    let asked = 0;
    window.confirm = () => { asked += 1; return true; };
    const stored = () => JSON.parse(localStorage.getItem('vpxs-yml-recent-builds-v2') || '[]').length;
    const button = document.getElementById('clearHistoryBtn');
    document.getElementById('recentBtn').click();
    await settle();
    button.click();
    const afterOne = { text: button.textContent, stored: stored() };
    document.querySelector('#recentDialog [data-close-dialog]').click();
    document.getElementById('recentBtn').click();
    await settle();
    const reopenedText = button.textContent;
    button.click();
    button.click();
    await settle();
    const cleared = { stored: stored(), text: button.textContent };
    // Nothing left: a click arms nothing.
    button.click();
    const emptyText = button.textContent;
    document.querySelector('#recentDialog [data-close-dialog]').click();
    return { afterOne, reopenedText, cleared, emptyText, asked };
  }, settleSource);
  check('Recent: one click on Clear History only arms it',
    recent.afterOne.text === 'Click Again to Clear History' && recent.afterOne.stored === 2, JSON.stringify(recent.afterOne));
  check('Recent: reopening disarms it', recent.reopenedText === 'Clear History', recent.reopenedText);
  check('Recent: the second click clears the history', recent.cleared.stored === 0 && recent.cleared.text === 'Clear History', JSON.stringify(recent.cleared));
  check('Recent: with nothing to clear, a click arms nothing', recent.emptyText === 'Clear History', recent.emptyText);
  check('Recent: the browser confirm box is never used', recent.asked === 0, String(recent.asked));

  check('no page errors', app.errors.filter(error => !/Unable to preload the VPS database/.test(error)).length === 0, app.errors.join('\n'));
}

await app.close();
report('two-click-clear');
