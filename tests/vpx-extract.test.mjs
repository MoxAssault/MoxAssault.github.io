// The VPX Extract Extra Paths button and window (2026-10-27, Jason): the
// third button in Advanced Config, after Passwords and Post-install Renames.
// Its window edits vpxExtractExtra, a list of paths relative to the table
// root. Same rules as Renames: live only while a PUP Pack, Alt Sound or DMD
// tab is on; otherwise disabled, and turning the last one off clears them.
//
// Runs the real app in headless Chrome through the scenario runner.

import { check, report } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, play, PRINT } = await startScenarios();

const MD5_VPX = 'E6DF3800F7C9286FA195E84034DA683A';
// Pink Floyd, the smallest clean build: no PUP Pack, Alt Sound or DMD.
const PINK_FLOYD = [
  ['search', 'Lgi1JLk0Vf'], ['asset', 'tableFiles', 'qV3Z3oQ8md'],
  ['fill', 'fps', '60'], ['fill', 'testers', 'Tester'], ['fill', 'vpxChecksum', MD5_VPX]
];
const WITH_PUP = [...PINK_FLOYD, ['bundle', 'pupPackFiles', true]];

const settleSource = `() => new Promise(resolve => {
  const frames = n => n ? requestAnimationFrame(() => frames(n - 1)) : setTimeout(resolve, 0);
  frames(3);
})`;

async function look() {
  return app.run(async settleText => {
    const settle = eval(settleText);
    document.getElementById('config-tab-vpx').click();
    await settle();
    const button = document.getElementById('vpxExtractBtn');
    const badge = button?.querySelector('.advanced-action-count');
    const dot = button?.querySelector(':scope > .field-error-dot');
    const yaml = document.getElementById('previewYaml').textContent.split('\n');
    const start = yaml.findIndex(line => line.startsWith('vpxExtractExtra:'));
    const block = start < 0 ? [] : [yaml[start], ...yaml.slice(start + 1).filter((line, index, rest) =>
      rest.slice(0, index + 1).every(item => item.startsWith('  ')))];
    let corners = null;
    if (button) {
      button.scrollIntoView({ block: 'center' });
      const r = button.getBoundingClientRect();
      const b = badge && !badge.hidden ? badge.getBoundingClientRect() : null;
      const d = dot ? dot.getBoundingClientRect() : null;
      corners = {
        badgeTopRight: b ? b.top < r.top && b.right > r.right : null,
        dotTopLeft: d ? d.top < r.top && d.left < r.left : null
      };
    }
    const order = [...(button?.parentElement?.children || [])]
      .sort((x, y) => Number(getComputedStyle(x).order) - Number(getComputedStyle(y).order))
      .map(node => node.id);
    return {
      inAdvanced: !!button && !!button.closest('#config-panel-vpx .compact-advanced'),
      order,
      disabled: button?.getAttribute('aria-disabled') === 'true',
      tooltip: button?.dataset.tooltip || '',
      label: button?.getAttribute('aria-label') || '',
      badge: badge && !badge.hidden ? badge.textContent : '',
      dot: dot ? (dot.getAttribute('aria-label') || '') : '',
      describedBy: button?.getAttribute('aria-describedby') || '',
      corners,
      block,
      saved: JSON.stringify(window.VPS_FEATURE_RUNTIME.state.values.vpxExtractExtra ?? null),
      tabError: document.getElementById('config-tab-vpx')?.classList.contains('has-error') === true
    };
  }, settleSource);
}

// Opens the window, makes its rows exactly `rows` (null leaves what opened),
// then presses `press`.
async function edit(rows, press = 'save') {
  return app.run(async ([rows, press, settleText]) => {
    const settle = eval(settleText);
    document.getElementById('config-tab-vpx').click();
    await settle();
    document.getElementById('vpxExtractBtn').click();
    await settle();
    const node = document.getElementById('vpxExtractDialog');
    if (!node?.open) return { opened: false };
    const values = () => [...node.querySelectorAll('#vpxExtractList input')].map(input => input.value);
    const shown = values();
    if (rows) {
      while (node.querySelectorAll('.vpx-extract-row').length > 1) node.querySelector('.vpx-magic-remove').click();
      while (node.querySelectorAll('.vpx-extract-row').length < rows.length) node.querySelector('#vpxExtractAddRow').click();
      [...node.querySelectorAll('#vpxExtractList input')].forEach((input, index) => {
        input.value = rows[index] ?? '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    const target = { save: '#vpxExtractSave', cancel: '[data-vpx-extract-close]', clear: '#vpxExtractClear', none: null }[press];
    if (target) {
      node.querySelector(target).click();
      if (press === 'clear') node.querySelector(target).click();
    }
    await settle();
    const dots = [...node.querySelectorAll('.vpx-extract-cell')]
      .filter(cell => cell.querySelector(':scope > .field-error-dot'))
      .map(cell => cell.querySelector('input').id);
    return { opened: true, shown, open: node.open, dots, focus: document.activeElement?.id || '' };
  }, [rows, press, settleSource]);
}

async function closeWindow() {
  await app.run(() => document.querySelector('#vpxExtractDialog [data-vpx-extract-close]')?.click());
}

if (!PRINT) {
  // 1. No PUP Pack, Alt Sound or DMD: the button is there but disabled.
  await play(PINK_FLOYD);
  const off = await look();
  check('the Extract button sits in Advanced Config', off.inAdvanced === true, JSON.stringify(off));
  check('the buttons run Passwords, Renames, Extract',
    off.order.join(',') === 'vpxPasswordsBtn,vpxRenamesBtn,vpxExtractBtn', off.order.join(','));
  check('with no PUP, Alt Sound or DMD the button is disabled', off.disabled === true);
  check('the disabled button says why', off.tooltip === 'Turn on PUP Pack, Alt Sound or DMD to use this', off.tooltip);
  check('the disabled button says why to a screen reader too',
    /Unavailable\. Turn on PUP Pack, Alt Sound or DMD to use this\./.test(off.label), off.label);
  const blocked = await edit(null, 'none');
  check('clicking the disabled button opens nothing', blocked.opened === false || blocked.open === false, JSON.stringify(blocked));

  // 2. A bundled PUP Pack turns it on.
  await play(WITH_PUP);
  const on = await look();
  check('with a PUP Pack on the button is enabled', on.disabled === false && on.tooltip === '', JSON.stringify(on));
  check('with none saved there is no count and no YML key', on.badge === '' && on.block.length === 0, JSON.stringify(on));

  // 3. Two paths, typed with stray slashes and spaces, plus a blank row.
  const first = await edit(['/DMD/MFDOOMDMD/', '', ' Music ']);
  check('a fresh window opens with one empty box', JSON.stringify(first.shown) === '[""]', JSON.stringify(first.shown));
  // The box stretches like a Passwords box (Jason, 2026-10-28), with its
  // remove button at the same right edge, at three window widths.
  const widths = await app.run(async settleText => {
    const settle = eval(settleText);
    const measure = (buttonId, dialogId, boxId) => {
      document.getElementById(buttonId).click();
      const node = document.getElementById(dialogId);
      const box = node.querySelector(boxId).getBoundingClientRect();
      const remove = node.querySelector('.vpx-magic-remove').getBoundingClientRect();
      node.querySelector('.dialog-close').click();
      return { box: Math.round(box.width), removeRight: Math.round(remove.right) };
    };
    await settle();
    return {
      password: measure('vpxPasswordsBtn', 'vpxMagicDialog', '#vpxMagicEntry0'),
      extract: measure('vpxExtractBtn', 'vpxExtractDialog', '#vpxExtractPath0')
    };
  }, settleSource);
  check('the path box is as wide as a Passwords box',
    widths.extract.box === widths.password.box && widths.extract.box > 400, JSON.stringify(widths));
  check('its remove button sits at the same right edge',
    widths.extract.removeRight === widths.password.removeRight, JSON.stringify(widths));
  // Fonts that run wider (GitHub's Linux runner measured 20px) must not widen
  // the window's column: the archive folder row is made 45px wider here.
  const wide = await app.run(async settleText => {
    const settle = eval(settleText);
    const style = document.createElement('style');
    style.textContent = '.vpx-magic-dialog .archive-folder-adder-add { padding-right: 45px !important; }';
    document.head.appendChild(style);
    const measure = (buttonId, dialogId, boxId) => {
      document.getElementById(buttonId).click();
      const node = document.getElementById(dialogId);
      const body = node.querySelector('.vpx-magic-body');
      const result = {
        box: Math.round(node.querySelector(boxId).getBoundingClientRect().width),
        removeRight: Math.round(node.querySelector('.vpx-magic-remove').getBoundingClientRect().right),
        overflow: body.scrollWidth - body.clientWidth
      };
      node.querySelector('.dialog-close').click();
      return result;
    };
    await settle();
    const result = {
      password: measure('vpxPasswordsBtn', 'vpxMagicDialog', '#vpxMagicEntry0'),
      extract: measure('vpxExtractBtn', 'vpxExtractDialog', '#vpxExtractPath0'),
      renames: measure('vpxRenamesBtn', 'vpxRenamesDialog', '#vpxRenamesList input')
    };
    style.remove();
    return result;
  }, settleSource);
  check('with wider fonts the path box and remove button still match Passwords, nothing overflowing',
    wide.extract.box === wide.password.box && wide.extract.removeRight === wide.password.removeRight
    && wide.extract.overflow === 0 && wide.renames.overflow === 0, JSON.stringify(wide));
  const addLabel = await app.run(() => document.getElementById('vpxExtractAddRow').textContent);
  check('the add button reads "+ Add Path"', addLabel === '+ Add Path', addLabel);
  check('Save closes the window', first.open === false, JSON.stringify(first));
  const two = await look();
  check('two saved: blank rows are dropped and the button counts 2', two.badge === '2', two.badge);
  check('two saved: the count sits on the top-right corner', two.corners.badgeTopRight === true, JSON.stringify(two.corners));
  check('two saved: the YML lists both, tidied, in order',
    two.block.join('\n') === ['vpxExtractExtra:', '  - "DMD/MFDOOMDMD"', '  - "Music"'].join('\n'), two.block.join('\n'));
  check('two saved: state holds them tidied', two.saved === JSON.stringify(['DMD/MFDOOMDMD', 'Music']), two.saved);

  // One path is still a list in the YML.
  await edit(['Music']);
  check('one saved: still written as a list',
    (await look()).block.join('\n') === ['vpxExtractExtra:', '  - "Music"'].join('\n'));
  await edit(['DMD/MFDOOMDMD', 'Music']);

  // 4. Reopen shows them; Cancel throws an edit away.
  const reopened = await edit(['changed'], 'cancel');
  check('reopening shows the saved paths in order', JSON.stringify(reopened.shown) === '["DMD/MFDOOMDMD","Music"]', JSON.stringify(reopened.shown));
  check('Cancel discards the edit', (await look()).saved === two.saved);

  // 5. Leaving a box tidies it.
  const tidied = await app.run(async settleText => {
    const settle = eval(settleText);
    document.getElementById('vpxExtractBtn').click();
    await settle();
    const input = document.getElementById('vpxExtractPath0');
    input.value = '  /Music/ ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const value = input.value;
    document.querySelector('#vpxExtractDialog [data-vpx-extract-close]').click();
    return value;
  }, settleSource);
  check('leaving a box trims it and strips outer slashes', tidied === 'Music', tidied);

  // 6. Every rule refuses the Save, with a dot on the box that has it.
  const bad = await edit(['a\\b', 'fine', '../up', 'C:/abs', 'wild*', 'a//b', '~/home']);
  check('a bad path keeps the window open', bad.open === true, JSON.stringify(bad));
  check('each problem dots exactly its own box', bad.dots.join(' ') === [
    'vpxExtractPath0', 'vpxExtractPath2', 'vpxExtractPath3', 'vpxExtractPath4', 'vpxExtractPath5', 'vpxExtractPath6'
  ].join(' '), bad.dots.join(' '));
  check('the keyboard goes to the first bad box', bad.focus === 'vpxExtractPath0', bad.focus);
  const said = await app.run(() => ({
    status: document.getElementById('vpxExtractStatus').textContent,
    describedBy: document.getElementById('vpxExtractPath0').getAttribute('aria-describedby'),
    messages: [...document.querySelectorAll('#vpxExtractDialog .vpx-extract-cell .field-error-dot')].map(dot => dot.getAttribute('aria-label'))
  }));
  check('a refused Save is announced', said.status === 'Fix the marked paths to save.', JSON.stringify(said));
  check('a bad box is described by its own dot', said.describedBy === 'vpxExtractPath0Error', JSON.stringify(said));
  check('the messages name each rule', [/Use \/ between folders/, /step up a folder/, /drive letter or ~/, /Wildcards/, /empty folder/, /drive letter or ~/]
    .every((pattern, index) => pattern.test(said.messages[index])), JSON.stringify(said.messages));
  check('a refused Save changes nothing saved', (await app.run(() => JSON.stringify(window.VPS_FEATURE_RUNTIME.state.values.vpxExtractExtra))) === two.saved);
  const tipDown = await app.run(() => {
    const dot = document.querySelector('#vpxExtractDialog .vpx-extract-cell .field-error-dot');
    const tip = dot?.querySelector('.error-dot-tip');
    return tip ? getComputedStyle(tip).top !== 'auto' && getComputedStyle(tip).bottom === 'auto' : null;
  });
  check('inside the window the dot tooltips open downward', tipDown === true, String(tipDown));
  const live = await app.run(async settleText => {
    const settle = eval(settleText);
    const input = document.getElementById('vpxExtractPath0');
    input.value = 'a/b';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    const dots = [...document.querySelectorAll('#vpxExtractDialog .vpx-extract-cell')]
      .filter(cell => cell.querySelector(':scope > .field-error-dot')).map(cell => cell.querySelector('input').id);
    document.querySelector('#vpxExtractDialog [data-vpx-extract-close]').click();
    return dots;
  }, settleSource);
  check('fixing a box clears its dot live, and leaves the rest', live.length === 5 && !live.includes('vpxExtractPath0'), live.join(' '));
  check('the window reopens with no dots', (await edit(null, 'none')).dots.length === 0);
  await closeWindow();

  // 7. Turning the last PUP Pack, Alt Sound or DMD off clears the paths
  // (Jason, 2026-10-28), and turning it back on does not bring them back.
  await app.run(async settleText => {
    const settle = eval(settleText);
    document.querySelector('.asset-row[data-category="pupPackFiles"] .bundle-toggle:not(.nsfw-toggle):not(.override-toggle) input').click();
    await settle();
  }, settleSource);
  const parked = await look();
  check('PUP off: the button is disabled again', parked.disabled === true, JSON.stringify(parked));
  check('PUP off: the saved paths are cleared, count and all', parked.saved === 'null' && parked.badge === '', JSON.stringify(parked));
  check('PUP off: the YML has no list', parked.block.length === 0, parked.block.join('\n'));
  await app.run(async settleText => {
    const settle = eval(settleText);
    document.querySelector('.asset-row[data-category="pupPackFiles"] .bundle-toggle:not(.nsfw-toggle):not(.override-toggle) input').click();
    await settle();
  }, settleSource);
  const back = await look();
  check('PUP back on: nothing comes back', back.disabled === false && back.saved === 'null' && back.badge === '', JSON.stringify(back));

  // An Alt Sound alone is enough to turn it on.
  await play([...PINK_FLOYD, ['bundle', 'altSoundFiles', true]]);
  check('an Alt Sound alone enables the button', (await look()).disabled === false);

  // 8. Import: a good list round-trips; one plain string is read as a list;
  // a bad path arrives with the dot.
  const goodYml = ['---', 'pupBundled: true', 'tableVPSId: "Lgi1JLk0Vf"', 'vpxExtractExtra:',
    '  - "DMD/MFDOOMDMD"', '  - "Music"', 'vpxVPSId: "qV3Z3oQ8md"'].join('\n') + '\n';
  await play([['import', goodYml]]);
  const imported = await look();
  check('an import: the button counts both', imported.badge === '2', JSON.stringify(imported));
  check('an import: the list round-trips byte for byte', imported.block.join('\n') === goodYml.split('\n').slice(3, 6).join('\n'), imported.block.join('\n'));

  await play([['import', ['---', 'pupBundled: true', 'tableVPSId: "Lgi1JLk0Vf"', 'vpxExtractExtra: "Music"', 'vpxVPSId: "qV3Z3oQ8md"'].join('\n') + '\n']]);
  const single = await look();
  check('an import of one plain string reads as a list of one', single.saved === '["Music"]' && single.badge === '1', JSON.stringify(single));

  // A hand-written file's stray slashes are tidied on the way in.
  await play([['import', ['---', 'pupBundled: true', 'tableVPSId: "Lgi1JLk0Vf"', 'vpxExtractExtra:', '  - "/DMD/"', '  - " Music/ "', 'vpxVPSId: "qV3Z3oQ8md"'].join('\n') + '\n']]);
  const untidy = await look();
  check('an import tidies stray slashes and spaces', untidy.saved === '["DMD","Music"]', untidy.saved);

  await play([['import', goodYml.replace('"Music"', '"Music\\\\Sub"')]]);
  const flagged = await look();
  check('an imported bad path is kept', /Music\\\\Sub/.test(flagged.saved), flagged.saved);
  check('an imported bad path puts the dot on the button', /Use \/ between folders/.test(flagged.dot), JSON.stringify(flagged));
  check('the dot sits on the top-left corner', flagged.corners.dotTopLeft === true, JSON.stringify(flagged.corners));
  check('the button points a screen reader at the dot', flagged.describedBy === 'vpxExtractBtn-error-dot', flagged.describedBy);
  check('the VPX tab counts the error', flagged.tabError === true);

  // 9. A reload restores the paths from the draft.
  await play(WITH_PUP);
  await edit(['keep/a', 'keep/b']);
  await app.run(() => new Promise(resolve => setTimeout(resolve, 450)));
  await app.reload();
  const restored = await look();
  check('a reload restores the count and the paths', restored.badge === '2' && restored.saved === '["keep/a","keep/b"]', JSON.stringify(restored));

  // 10. Clear takes two clicks.
  const armed = await app.run(async settleText => {
    const settle = eval(settleText);
    document.getElementById('vpxExtractBtn').click();
    await settle();
    const node = document.getElementById('vpxExtractDialog');
    const clear = node.querySelector('#vpxExtractClear');
    clear.click();
    const result = { open: node.open, text: clear.textContent, kept: window.VPS_EXTRACT_EXTRA.entries().length };
    node.querySelector('[data-vpx-extract-close]').click();
    return result;
  }, settleSource);
  check('one click on Clear only arms it', armed.open === true && armed.kept === 2 && armed.text === 'Click Again to Clear All', JSON.stringify(armed));
  await edit(null, 'clear');
  const cleared = await look();
  check('Clear removes every path and the count', cleared.saved === 'null' && cleared.badge === '' && cleared.block.length === 0, JSON.stringify(cleared));

  // 11. Clear section on the VPX tab takes the paths with it.
  await edit(['x/y']);
  await app.run(async settleText => {
    const settle = eval(settleText);
    document.querySelector('#config-panel-vpx .clear-section-btn').click();
    await settle();
  }, settleSource);
  const sectionCleared = await look();
  check('Clear section removes every path', sectionCleared.badge === '' && sectionCleared.block.length === 0
    && !/x\/y/.test(sectionCleared.saved), JSON.stringify(sectionCleared));

  check('no page errors', app.errors.filter(error => !/Unable to preload the VPS database/.test(error)).length === 0, app.errors.join('\n'));
}

await app.close();
report('vpx-extract');
