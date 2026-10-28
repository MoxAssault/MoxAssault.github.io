// The VPX Post-install Renames button and window (2026-10-27, Jason): a
// second button in Advanced Config, beside Passwords, opens one window that
// edits postInstallRename, an ordered list of { source, destination }. Only
// live while a PUP Pack, Alt Sound or DMD tab is on: otherwise the button is
// disabled (not hidden), and turning the last one off clears the saved rows.
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

// Everything a check needs to see, read off the page.
async function look() {
  return app.run(async settleText => {
    const settle = eval(settleText);
    document.getElementById('config-tab-vpx').click();
    await settle();
    const button = document.getElementById('vpxRenamesBtn');
    const badge = button?.querySelector('.advanced-action-count');
    const dot = button?.querySelector(':scope > .field-error-dot');
    const yaml = document.getElementById('previewYaml').textContent.split('\n');
    const start = yaml.findIndex(line => line.startsWith('postInstallRename:'));
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
      saved: JSON.stringify(window.VPS_FEATURE_RUNTIME.state.values.postInstallRename ?? null),
      tabError: document.getElementById('config-tab-vpx')?.classList.contains('has-error') === true
    };
  }, settleSource);
}

// Opens the window, makes its rows exactly `rows` ([source, destination]
// pairs; null leaves what opened), then presses `press`. Returns what the
// window showed on opening, whether it is still open, which boxes carry a dot,
// and where the keyboard is.
async function edit(rows, press = 'save') {
  return app.run(async ([rows, press, settleText]) => {
    const settle = eval(settleText);
    document.getElementById('config-tab-vpx').click();
    await settle();
    document.getElementById('vpxRenamesBtn').click();
    await settle();
    const node = document.getElementById('vpxRenamesDialog');
    if (!node?.open) return { opened: false };
    const pairs = () => [...node.querySelectorAll('.vpx-renames-row')]
      .map(row => [...row.querySelectorAll('input')].map(input => input.value));
    const shown = pairs();
    if (rows) {
      while (node.querySelectorAll('.vpx-renames-row').length > 1) node.querySelector('.vpx-magic-remove').click();
      while (node.querySelectorAll('.vpx-renames-row').length < rows.length) node.querySelector('#vpxRenamesAddRow').click();
      [...node.querySelectorAll('.vpx-renames-row')].forEach((row, index) => {
        [...row.querySelectorAll('input')].forEach((input, side) => {
          input.value = rows[index]?.[side] ?? '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });
    }
    const target = { save: '#vpxRenamesSave', cancel: '[data-vpx-renames-close]', clear: '#vpxRenamesClear', none: null }[press];
    if (target) {
      node.querySelector(target).click();
      if (press === 'clear') node.querySelector(target).click();
    }
    await settle();
    const dots = [...node.querySelectorAll('.vpx-renames-cell')]
      .filter(cell => cell.querySelector(':scope > .field-error-dot'))
      .map(cell => cell.querySelector('input').id);
    return { opened: true, shown, open: node.open, dots, focus: document.activeElement?.id || '', after: pairs() };
  }, [rows, press, settleSource]);
}

async function closeWindow() {
  await app.run(() => document.querySelector('#vpxRenamesDialog [data-vpx-renames-close]')?.click());
}

if (!PRINT) {
  // 1. No PUP Pack, Alt Sound or DMD: the button is there but disabled.
  await play(PINK_FLOYD);
  const off = await look();
  check('the Renames button sits in Advanced Config', off.inAdvanced === true, JSON.stringify(off));
  check('Passwords comes first, Renames second', off.order.join(',') === 'vpxPasswordsBtn,vpxRenamesBtn,vpxExtractBtn', off.order.join(','));
  check('with no PUP, Alt Sound or DMD the button is disabled', off.disabled === true);
  check('the disabled button says why', off.tooltip === 'Turn on PUP Pack, Alt Sound or DMD to use this', off.tooltip);
  check('the disabled button says why to a screen reader too', /Unavailable\. Turn on PUP Pack, Alt Sound or DMD to use this\./.test(off.label), off.label);
  const blocked = await edit(null, 'none');
  check('clicking the disabled button opens nothing', blocked.opened === false || blocked.open === false, JSON.stringify(blocked));

  // 2. A bundled PUP Pack turns it on.
  await play(WITH_PUP);
  const on = await look();
  check('with a PUP Pack on the button is enabled', on.disabled === false && on.tooltip === '', JSON.stringify(on));
  check('with none saved there is no count and no YML key', on.badge === '' && on.block.length === 0, JSON.stringify(on));

  // 3. Two renames, typed with stray slashes and spaces, saved.
  const first = await edit([['/file1.ext/', 'renamed/file.ext'], [' folder1', 'assets/renamedFolder/ ']]);
  check('a fresh window opens with one empty row', JSON.stringify(first.shown) === '[["",""]]', JSON.stringify(first.shown));
  const renameAdd = await app.run(() => document.getElementById('vpxRenamesAddRow').textContent);
  check('the add button reads "+ Add Rename"', renameAdd === '+ Add Rename', renameAdd);
  check('Save closes the window', first.open === false, JSON.stringify(first));
  const two = await look();
  check('two saved: the button counts 2', two.badge === '2', two.badge);
  check('two saved: the count sits on the top-right corner', two.corners.badgeTopRight === true, JSON.stringify(two.corners));
  check('two saved: the YML lists both, tidied, in order', two.block.join('\n') === [
    'postInstallRename:',
    '  - source: "file1.ext"',
    '    destination: "renamed/file.ext"',
    '  - source: "folder1"',
    '    destination: "assets/renamedFolder"'
  ].join('\n'), two.block.join('\n'));
  check('two saved: state holds them tidied',
    two.saved === JSON.stringify([{ source: 'file1.ext', destination: 'renamed/file.ext' }, { source: 'folder1', destination: 'assets/renamedFolder' }]), two.saved);

  // 4. Reopen shows them; Cancel throws an edit away.
  const reopened = await edit([['changed', 'changed']], 'cancel');
  check('reopening shows the saved rows in order',
    JSON.stringify(reopened.shown) === JSON.stringify([['file1.ext', 'renamed/file.ext'], ['folder1', 'assets/renamedFolder']]), JSON.stringify(reopened.shown));
  check('Cancel discards the edit', (await look()).saved === two.saved);

  // 5. Leaving a box tidies it.
  const tidied = await app.run(async settleText => {
    const settle = eval(settleText);
    document.getElementById('vpxRenamesBtn').click();
    await settle();
    const input = document.getElementById('vpxRenameSource0');
    input.value = '  /Music/ ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const value = input.value;
    document.querySelector('#vpxRenamesDialog [data-vpx-renames-close]').click();
    return value;
  }, settleSource);
  check('leaving a box trims it and strips outer slashes', tidied === 'Music', tidied);

  // 6. Every rule refuses the Save, with a dot on the box that has it.
  const bad = await edit([
    ['a\\b', 'ok/dest'],        // backslash
    ['only-source', ''],        // one side missing
    ['', ''],                   // blank: dropped, never dotted
    ['../up', 'C:/absolute'],   // .. and a drive letter
    ['wild*', 'a//b'],          // a wildcard and an empty folder
    ['~/home', 'fine']          // a leading ~
  ]);
  check('a bad row keeps the window open', bad.open === true, JSON.stringify(bad));
  check('each problem dots exactly its own box', bad.dots.join(' ') === [
    'vpxRenameSource0', 'vpxRenameDestination1', 'vpxRenameSource3', 'vpxRenameDestination3',
    'vpxRenameSource4', 'vpxRenameDestination4', 'vpxRenameSource5'
  ].join(' '), bad.dots.join(' '));
  check('the keyboard goes to the first bad box', bad.focus === 'vpxRenameSource0', bad.focus);
  const said = await app.run(() => ({
    status: document.getElementById('vpxRenamesStatus').textContent,
    describedBy: document.getElementById('vpxRenameSource0').getAttribute('aria-describedby'),
    dotId: document.querySelector('#vpxRenamesDialog .vpx-renames-cell .field-error-dot')?.id
  }));
  check('a refused Save is announced', said.status === 'Fix the marked paths to save.', JSON.stringify(said));
  check('a bad box is described by its own dot', said.describedBy === 'vpxRenameSource0Error' && said.dotId === 'vpxRenameSource0Error', JSON.stringify(said));
  check('a refused Save changes nothing saved', (await app.run(() => JSON.stringify(window.VPS_FEATURE_RUNTIME.state.values.postInstallRename))) === two.saved);
  const messages = await app.run(() => Object.fromEntries([...document.querySelectorAll('#vpxRenamesDialog .vpx-renames-cell')]
    .filter(cell => cell.querySelector('.field-error-dot'))
    .map(cell => [cell.querySelector('input').id, cell.querySelector('.field-error-dot').getAttribute('aria-label')])));
  check('the backslash says to use /', /Use \/ between folders/.test(messages.vpxRenameSource0), JSON.stringify(messages));
  check('the missing side asks for it', /Add the destination path/.test(messages.vpxRenameDestination1), JSON.stringify(messages));
  check('.. is refused', /step up a folder/.test(messages.vpxRenameSource3), JSON.stringify(messages));
  check('a drive letter is refused', /drive letter or ~/.test(messages.vpxRenameDestination3), JSON.stringify(messages));
  check('a wildcard is refused', /Wildcards/.test(messages.vpxRenameSource4), JSON.stringify(messages));
  check('an empty folder is refused', /empty folder/.test(messages.vpxRenameDestination4), JSON.stringify(messages));
  check('a leading ~ is refused', /drive letter or ~/.test(messages.vpxRenameSource5), JSON.stringify(messages));
  // Fixing a box clears its dot at once, and only its dot.
  const live = await app.run(async settleText => {
    const settle = eval(settleText);
    const input = document.getElementById('vpxRenameSource0');
    input.value = 'a/b';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    const dots = [...document.querySelectorAll('#vpxRenamesDialog .vpx-renames-cell')]
      .filter(cell => cell.querySelector(':scope > .field-error-dot')).map(cell => cell.querySelector('input').id);
    document.querySelector('#vpxRenamesDialog [data-vpx-renames-close]').click();
    return dots;
  }, settleSource);
  check('fixing a box clears its dot live, and leaves the rest', live.length === 6 && !live.includes('vpxRenameSource0'), live.join(' '));
  const reopenedClean = await edit(null, 'none');
  check('the window reopens with no dots', reopenedClean.dots.length === 0, reopenedClean.dots.join(' '));
  await closeWindow();

  // 7. Turning the last PUP Pack, Alt Sound or DMD off clears the rows
  // (Jason, 2026-10-28), and turning it back on does not bring them back.
  await app.run(async settleText => {
    const settle = eval(settleText);
    const box = document.querySelector('.asset-row[data-category="pupPackFiles"] .bundle-toggle:not(.nsfw-toggle):not(.override-toggle) input');
    box.click();
    await settle();
  }, settleSource);
  const parked = await look();
  check('PUP off: the button is disabled again', parked.disabled === true, JSON.stringify(parked));
  check('PUP off: the saved rows are cleared, count and all', parked.saved === 'null' && parked.badge === '', JSON.stringify(parked));
  check('PUP off: the YML has no block', parked.block.length === 0, parked.block.join('\n'));
  await app.run(async settleText => {
    const settle = eval(settleText);
    document.querySelector('.asset-row[data-category="pupPackFiles"] .bundle-toggle:not(.nsfw-toggle):not(.override-toggle) input').click();
    await settle();
  }, settleSource);
  const back = await look();
  check('PUP back on: nothing comes back', back.disabled === false && back.saved === 'null' && back.badge === '', JSON.stringify(back));

  // A DMD alone is enough to turn it on.
  await play([...PINK_FLOYD, ['override', 'specialDMD', true], ['dmdType', 'FlexDMD']]);
  check('a DMD alone enables the button', (await look()).disabled === false);

  // 8. Import: a good block round-trips; a bad path arrives with the dot.
  const goodYml = ['---', 'pupBundled: true', 'tableVPSId: "Lgi1JLk0Vf"', 'vpxVPSId: "qV3Z3oQ8md"',
    'postInstallRename:', '  - source: "file1.ext"', '    destination: "renamed/file.ext"',
    '  - source: "folder1"', '    destination: "assets/renamedFolder"'].join('\n') + '\n';
  await play([['import', goodYml]]);
  await app.run(() => new Promise(resolve => setTimeout(resolve, 300)));
  const imported = await look();
  check('an import: the button counts both', imported.badge === '2', JSON.stringify(imported));
  check('an import: the block round-trips byte for byte', imported.block.join('\n') === goodYml.split('\n').slice(4, 9).join('\n'), imported.block.join('\n'));

  const badYml = goodYml.replace('"folder1"', '"Music\\\\Sub"');
  await play([['import', badYml]]);
  await app.run(() => new Promise(resolve => setTimeout(resolve, 300)));
  const flagged = await look();
  check('an imported bad path is kept', /Music\\\\Sub/.test(flagged.saved), flagged.saved);
  check('an imported bad path puts the dot on the button', /Use \/ between folders/.test(flagged.dot), JSON.stringify(flagged));
  check('the dot sits on the top-left corner', flagged.corners.dotTopLeft === true, JSON.stringify(flagged.corners));
  check('the button points a screen reader at the dot', flagged.describedBy === 'vpxRenamesBtn-error-dot', flagged.describedBy);
  check('the VPX tab counts the error', flagged.tabError === true);

  // 9. A reload restores the rows from the draft.
  await play(WITH_PUP);
  await edit([['keep-a', 'moved/a'], ['keep-b', 'moved/b']]);
  await app.run(() => new Promise(resolve => setTimeout(resolve, 450)));
  await app.reload();
  const restored = await look();
  check('a reload restores the count and the rows', restored.badge === '2'
    && restored.saved === JSON.stringify([{ source: 'keep-a', destination: 'moved/a' }, { source: 'keep-b', destination: 'moved/b' }]), JSON.stringify(restored));

  // 10. Clear takes two clicks.
  const armed = await app.run(async settleText => {
    const settle = eval(settleText);
    document.getElementById('vpxRenamesBtn').click();
    await settle();
    const node = document.getElementById('vpxRenamesDialog');
    const clear = node.querySelector('#vpxRenamesClear');
    clear.click();
    const result = { open: node.open, text: clear.textContent, kept: window.VPS_INSTALL_RENAMES.entries().length };
    node.querySelector('[data-vpx-renames-close]').click();
    return result;
  }, settleSource);
  check('one click on Clear only arms it', armed.open === true && armed.kept === 2 && armed.text === 'Click Again to Clear All', JSON.stringify(armed));
  await edit(null, 'clear');
  const cleared = await look();
  check('Clear removes every rename and the count', cleared.saved === 'null' && cleared.badge === '' && cleared.block.length === 0, JSON.stringify(cleared));

  // 11. Clear section on the VPX tab takes the renames with it.
  await edit([['x', 'y']]);
  await app.run(async settleText => {
    const settle = eval(settleText);
    document.querySelector('#config-panel-vpx .clear-section-btn').click();
    await settle();
  }, settleSource);
  const sectionCleared = await look();
  check('Clear section removes every rename', sectionCleared.badge === '' && sectionCleared.block.length === 0
    && !/"x"/.test(sectionCleared.saved), JSON.stringify(sectionCleared));

  check('no page errors', app.errors.filter(error => !/Unable to preload the VPS database/.test(error)).length === 0, app.errors.join('\n'));
}

await app.close();
report('vpx-renames');
