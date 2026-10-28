// The VPX Passwords button and window (2026-10-27, Jason): the passwords are
// not fields on the VPX tab any more. A button in Advanced Config shows how
// many are saved and opens one window that edits them all. State keeps the
// four old keys (vpxMagic, vpxMagic2, vpxMagic3, vpxMagicAdditional), so the
// YML, drafts and the archive unlocker read them as before.
//
// Runs the real app in headless Chrome through the scenario runner.

import { check, report } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, play, PRINT } = await startScenarios();

const MD5_VPX = 'E6DF3800F7C9286FA195E84034DA683A';
// Pink Floyd, the smallest clean build.
const PINK_FLOYD = [
  ['search', 'Lgi1JLk0Vf'], ['asset', 'tableFiles', 'qV3Z3oQ8md'],
  ['fill', 'fps', '60'], ['fill', 'testers', 'Tester'], ['fill', 'vpxChecksum', MD5_VPX]
];
const b64 = text => Buffer.from(text, 'utf8').toString('base64');

// Everything a check needs to see, read off the page.
async function look() {
  return app.run(async () => {
    const settle = () => new Promise(resolve => {
      const frames = n => n ? requestAnimationFrame(() => frames(n - 1)) : setTimeout(resolve, 0);
      frames(3);
    });
    document.getElementById('config-tab-vpx').click();
    await settle();
    const panel = document.getElementById('config-panel-vpx');
    const button = document.getElementById('vpxPasswordsBtn');
    const badge = button?.querySelector('.advanced-action-count');
    const yaml = document.getElementById('previewYaml').textContent.split('\n');
    const start = yaml.findIndex(line => line.startsWith('vpxMagic:'));
    const magic = start < 0 ? [] : [yaml[start], ...yaml.slice(start + 1).filter((line, index, rest) =>
      rest.slice(0, index + 1).every(item => item.startsWith('  - ')))];
    const values = window.VPS_FEATURE_RUNTIME.state.values;
    // Where the count sits, read only while it shows: it should overhang the
    // button's top-right corner like the checksum bubble, and nothing above it
    // may clip it (the point at its centre must hit the count itself).
    let corner = null;
    if (badge && !badge.hidden) {
      button.scrollIntoView({ block: 'center' });
      const b = badge.getBoundingClientRect();
      const r = button.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      corner = { overTop: b.top < r.top, overRight: b.right > r.right, width: Math.round(b.width), height: Math.round(b.height), visible: hit === badge };
    }
    return {
      corner,
      inlineInputs: panel.querySelectorAll('input[id^="field-vpxMagic"]').length,
      plusInHeader: !!panel.querySelector('.compact-advanced > summary button'),
      buttonInAdvanced: !!button && !!button.closest('.compact-advanced'),
      badge: badge && !badge.hidden ? badge.textContent : '',
      label: button?.getAttribute('aria-label') || '',
      magic,
      keys: ['vpxMagic', 'vpxMagic2', 'vpxMagic3', 'vpxMagicAdditional']
        .filter(key => values[key] !== undefined && values[key] !== '')
        .map(key => key + '=' + JSON.stringify(values[key]))
    };
  });
}

// Opens the window, makes its rows exactly `rows`, then presses `press`.
// Returns what the window showed when it opened.
async function edit(rows, press = 'save') {
  return app.run(async ([rows, press]) => {
    const settle = () => new Promise(resolve => {
      const frames = n => n ? requestAnimationFrame(() => frames(n - 1)) : setTimeout(resolve, 0);
      frames(3);
    });
    document.getElementById('config-tab-vpx').click();
    await settle();
    document.getElementById('vpxPasswordsBtn').click();
    await settle();
    const node = document.getElementById('vpxMagicDialog');
    if (!node.open) throw new Error('the Passwords window did not open');
    const inputs = () => [...node.querySelectorAll('#vpxMagicList input')];
    const shown = inputs().map(input => input.value);
    // One track, not two: a .field-grid class here once split the rows into
    // two columns at phone width (each row's span hid it on desktop).
    window.__vpxMagicColumns = getComputedStyle(node.querySelector('#vpxMagicList')).gridTemplateColumns.split(' ').length;
    if (rows) {
      while (inputs().length > 1) node.querySelector('.vpx-magic-remove').click();
      while (inputs().length < rows.length) node.querySelector('#vpxMagicAddRow').click();
      inputs().forEach((input, index) => {
        input.value = rows[index] ?? '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    const target = { save: '#vpxMagicSave', cancel: '[data-vpx-magic-close]', clear: '#vpxMagicClear' }[press];
    node.querySelector(target).click();
    // Clear asks for a second click before it deletes anything.
    if (press === 'clear') node.querySelector(target).click();
    await settle();
    if (node.open) throw new Error(press + ' left the window open');
    return { shown, clearHidden: node.querySelector('#vpxMagicClear').hidden };
  }, [rows, press]);
}

if (!PRINT) {
  // 1. The tab before anything is saved.
  await play(PINK_FLOYD);
  const empty = await look();
  check('no password box is drawn on the VPX tab', empty.inlineInputs === 0, JSON.stringify(empty));
  check('the Advanced Config header has no + any more', empty.plusInHeader === false);
  check('the Passwords button sits in Advanced Config', empty.buttonInAdvanced === true);
  check('with none saved the button shows no count', empty.badge === '', empty.badge);
  check('with none saved the button says so', /none saved/.test(empty.label), empty.label);
  check('with none saved the YML carries no vpxMagic', empty.magic.length === 0, empty.magic.join('\n'));

  // 2. Two passwords, saved.
  const first = await edit(['test-one', 'test-two']);
  check('a fresh window opens with one empty row', JSON.stringify(first.shown) === '[""]', JSON.stringify(first.shown));
  check('Clear is hidden while nothing is saved', first.clearHidden === true);
  const passwordAdd = await app.run(() => document.getElementById('vpxMagicAddRow').textContent);
  check('the add button reads "+ Add Password", title case', passwordAdd === '+ Add Password', passwordAdd);
  const columns = await app.run(() => window.__vpxMagicColumns);
  check('the password rows are one column', columns === 1, String(columns));
  const two = await look();
  check('two saved: the button counts 2', two.badge === '2', two.badge);
  check('the count sits on the top-right corner, a 16x12 pill like the checksum bubble, unclipped',
    JSON.stringify(two.corner) === JSON.stringify({ overTop: true, overRight: true, width: 16, height: 12, visible: true }), JSON.stringify(two.corner));
  check('two saved: the label counts them, never shows them', two.label === 'Passwords, 2 saved. Opens the passwords window.', two.label);
  check('two saved: the YML lists both, encoded, in order',
    two.magic.join('\n') === ['vpxMagic:', `  - "${b64('test-one')}"`, `  - "${b64('test-two')}"`].join('\n'), two.magic.join('\n'));
  check('two saved: state keeps the old keys',
    two.keys.join(' ') === 'vpxMagic="test-one" vpxMagic2="test-two"', two.keys.join(' '));

  // 3. Reopen shows them; Cancel throws an edit away.
  const reopened = await edit(['changed'], 'cancel');
  check('reopening shows the saved passwords in order', JSON.stringify(reopened.shown) === '["test-one","test-two"]', JSON.stringify(reopened.shown));
  check('Clear shows once something is saved', reopened.clearHidden === false);
  const cancelled = await look();
  check('Cancel discards the edit', cancelled.badge === '2' && cancelled.keys.join(' ') === two.keys.join(' '), JSON.stringify(cancelled));

  // 4. Five, past the three old inline slots; blank rows are dropped.
  await edit(['p1', '', 'p2', 'p3', 'p4', 'p5', '  ']);
  const five = await look();
  check('five saved: the button counts 5', five.badge === '5', five.badge);
  check('five saved: blank rows are dropped and the order kept',
    five.keys.join(' ') === 'vpxMagic="p1" vpxMagic2="p2" vpxMagic3="p3" vpxMagicAdditional=["p4","p5"]', five.keys.join(' '));
  check('five saved: the YML lists all five in order',
    five.magic.join('\n') === ['vpxMagic:', ...['p1', 'p2', 'p3', 'p4', 'p5'].map(p => `  - "${b64(p)}"`)].join('\n'), five.magic.join('\n'));

  // Removing a row puts the keyboard on the row that took its place.
  const focus = await app.run(async () => {
    const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0))));
    document.getElementById('vpxPasswordsBtn').click();
    await settle();
    const node = document.getElementById('vpxMagicDialog');
    const removes = () => [...node.querySelectorAll('.vpx-magic-remove')];
    removes()[1].focus();
    removes()[1].click();
    const middle = { id: document.activeElement?.id, value: document.activeElement?.value };
    removes()[removes().length - 1].click();
    const last = { id: document.activeElement?.id, value: document.activeElement?.value };
    node.querySelector('[data-vpx-magic-close]').click();
    return { middle, last };
  });
  check('removing a middle row focuses the row that moved up',
    focus.middle.id === 'vpxMagicEntry1' && focus.middle.value === 'p3', JSON.stringify(focus));
  check('removing the last row focuses the new last row',
    focus.last.id === 'vpxMagicEntry2' && focus.last.value === 'p4', JSON.stringify(focus));

  // 5. Down to one: a single password is a plain string, as it always was.
  await edit(['only']);
  const one = await look();
  check('one saved: the button counts 1', one.badge === '1', one.badge);
  check('one saved: the YML writes a plain string', one.magic.join('\n') === `vpxMagic: "${b64('only')}"`, one.magic.join('\n'));
  check('one saved: the slots behind it are emptied', one.keys.join(' ') === 'vpxMagic="only"', one.keys.join(' '));

  // 6. A reload restores them from the draft.
  await edit(['keep-a', 'keep-b']);
  await app.run(() => new Promise(resolve => setTimeout(resolve, 450)));
  await app.reload();
  const restored = await look();
  check('a reload restores the count', restored.badge === '2', restored.badge);
  check('a reload restores the passwords', restored.keys.join(' ') === 'vpxMagic="keep-a" vpxMagic2="keep-b"', restored.keys.join(' '));

  // 7. Clear takes two clicks, then empties every key.
  const armed = await app.run(async () => {
    const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0))));
    document.getElementById('vpxPasswordsBtn').click();
    await settle();
    const node = document.getElementById('vpxMagicDialog');
    const clear = node.querySelector('#vpxMagicClear');
    clear.click();
    await settle();
    const afterOne = { open: node.open, text: clear.textContent, saved: window.VPS_MAGIC_PASSWORDS.entries().length };
    node.querySelector('[data-vpx-magic-close]').click();
    document.getElementById('vpxPasswordsBtn').click();
    await settle();
    const reopenedText = clear.textContent;
    node.querySelector('[data-vpx-magic-close]').click();
    return { afterOne, reopenedText };
  });
  check('one click on Clear only arms it', armed.afterOne.open === true && armed.afterOne.saved === 2, JSON.stringify(armed));
  check('an armed Clear says what the next click does', armed.afterOne.text === 'Click Again to Clear All', armed.afterOne.text);
  check('reopening the window disarms Clear', armed.reopenedText === 'Clear', armed.reopenedText);
  await edit(null, 'clear');
  const cleared = await look();
  check('Clear removes the count', cleared.badge === '', cleared.badge);
  check('Clear removes every password', cleared.keys.length === 0 && cleared.magic.length === 0, JSON.stringify(cleared));

  // 8. A draft saved before 2026-10-27, with the old inline-slot count.
  await play([...PINK_FLOYD,
    ['draft', 'values.vpxMagic', 'old-1'], ['draft', 'values.vpxMagic3', 'old-3'],
    ['draft', 'values.vpxMagicAdditional', ['old-4']], ['draft', 'values.__vpxMagicSlots', 3]]);
  const legacy = await look();
  check('an old draft: every password is counted', legacy.badge === '3', legacy.badge);
  check('an old draft: the YML is unchanged by the new window',
    legacy.magic.join('\n') === ['vpxMagic:', ...['old-1', 'old-3', 'old-4'].map(p => `  - "${b64(p)}"`)].join('\n'), legacy.magic.join('\n'));
  const legacyShown = await edit(null, 'cancel');
  check('an old draft: the window lists them in order', JSON.stringify(legacyShown.shown) === '["old-1","old-3","old-4"]', JSON.stringify(legacyShown.shown));

  // 9. An imported YML with four passwords.
  const yml = ['---', 'tableVPSId: "Lgi1JLk0Vf"', 'vpxVPSId: "qV3Z3oQ8md"', 'vpxMagic:',
    ...['in-1', 'in-2', 'in-3', 'in-4'].map(p => `  - "${b64(p)}"`)].join('\n') + '\n';
  await play([['import', yml]]);
  const imported = await look();
  check('an import: the button counts all four', imported.badge === '4', imported.badge);
  check('an import: the passwords arrive decoded, in order',
    imported.keys.join(' ') === 'vpxMagic="in-1" vpxMagic2="in-2" vpxMagic3="in-3" vpxMagicAdditional=["in-4"]', imported.keys.join(' '));
  check('an import: the YML round-trips byte for byte', imported.magic.join('\n') === yml.split('\n').slice(3, 8).join('\n'), imported.magic.join('\n'));

  // 10. Clear section on the VPX tab takes the passwords with it.
  await app.run(async () => {
    document.querySelector('#config-panel-vpx .clear-section-btn').click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0))));
  });
  const sectionCleared = await look();
  check('Clear section removes every password', sectionCleared.badge === '' && sectionCleared.keys.length === 0, JSON.stringify(sectionCleared));

  check('no page errors', app.errors.filter(error => !/Unable to preload the VPS database/.test(error)).length === 0, app.errors.join('\n'));
}

await app.close();
report('vpx-passwords');
