// The Short Table Name box and the one-line Wizard README (Jason, 2026-11-03
// spec, built 2026-11-04).
//
// The box names the table's folder in vpx-standalone-alp4k (vpx-4aces). It
// adds the "vpx-" prefix when focus leaves it, is saved with the draft but
// never written to the YML, and empties on Clear or a new table. The Wizard
// README is one fixed line linking the table's catalog page by that name,
// downloaded as README.md with no template and no preview image; it needs the
// name and nothing else.
//
// Runs the real app in headless Chrome through the scenario runner, with the
// five-table VPS fixture. The network is off in the test browser, so a
// Wizard README that still fetched a template would fail here.

import { check, report } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, play, PRINT } = await startScenarios();

const PINK_FLOYD = 'Lgi1JLk0Vf';
const TMNT = 'uA2t19UU2O';
const DRAFT_KEY = 'vpxs-yml-current-draft-v2';
// Byte for byte the README.md of a real table folder (vpx-alicettlg is the
// example in Jason's spec): one line, one LF.
const README = name => `This table is in the Table Manager Wizard. To view its details visit https://vpxtablemanager.com/catalog/#table=${name}\n`;

const settleSource = `() => new Promise(resolve => {
  const frames = n => n ? requestAnimationFrame(() => frames(n - 1)) : setTimeout(resolve, 0);
  frames(3);
})`;

// Types into the box like a user (focus, input events), then leaves it.
async function typeName(text, { leave = true } = {}) {
  return app.run(async ([text, leave, settleText]) => {
    const settle = eval(settleText);
    const input = document.getElementById('shortTableNameInput');
    input.focus();
    input.value = '';
    for (const char of text) {
      input.value += char;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const focusedWhileTyping = document.activeElement === input;
    if (leave) input.blur();
    await settle();
    return { value: input.value, focusedWhileTyping };
  }, [text, leave, settleSource]);
}

async function boxState() {
  return app.run(() => {
    const field = document.getElementById('shortTableNameField');
    const input = document.getElementById('shortTableNameInput');
    const dot = field?.querySelector(':scope > .field-error-dot');
    return {
      value: input?.value ?? null,
      dot: Boolean(dot),
      dotLabel: dot?.getAttribute('aria-label') || '',
      dotTip: dot?.querySelector('.error-dot-tip')?.textContent || '',
      fieldError: field?.classList.contains('has-field-error') === true,
      invalid: input?.getAttribute('aria-invalid'),
      describedBy: input?.getAttribute('aria-describedby') ?? null,
      dotId: dot?.id || null,
      focused: document.activeElement === input,
      stored: window.VPS_FEATURE_RUNTIME?.state?.values?.__shortTableName ?? null,
      yaml: document.getElementById('previewYaml')?.textContent || ''
    };
  });
}

async function clickWizard() {
  return app.run(async settleText => {
    const settle = eval(settleText);
    document.getElementById('wizardReadmeBtn').click();
    await settle();
    const toast = document.getElementById('readmeGeneratorToast');
    return {
      title: toast?.querySelector('.vps-db-toast-title')?.textContent || '',
      message: toast?.querySelector('.vps-db-toast-message')?.textContent || ''
    };
  }, settleSource);
}

// Searches on the page as it is, unlike play(), which starts a fresh page and
// so would empty the box whatever the app did.
async function searchHere(id) {
  return app.run(async ([id, settleText]) => {
    document.getElementById('idInput').value = id;
    document.getElementById('searchForm').requestSubmit();
    const deadline = Date.now() + 5000;
    while (document.getElementById('workspace').hidden) {
      if (Date.now() > deadline) throw new Error('searchHere: no table loaded for ' + id);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    await eval(settleText)();
  }, [id, settleSource]);
}

// Resolves to null when nothing downloads within `ms`. "Nothing was
// downloaded" is still counted in the page (downloadsStarted), which also
// sees a download the browser never finished.
const downloadWithin = ms => app.nextDownload(ms).catch(() => null);

// How many downloads the page has started: every save in this app clicks an
// <a download>. Installed on first use in each page load.
async function downloadsStarted() {
  return app.run(() => {
    if (!window.__downloadsStarted) {
      window.__downloadsStarted = { count: 0 };
      const click = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function countedClick(...args) {
        if (this.hasAttribute('download')) window.__downloadsStarted.count += 1;
        return click.apply(this, args);
      };
    }
    return window.__downloadsStarted.count;
  });
}

if (!PRINT) {
  // 1. The box is there, labelled, with the spec's placeholder.
  await play([['search', PINK_FLOYD]]);
  const shape = await app.run(() => {
    const input = document.getElementById('shortTableNameInput');
    return {
      visibleLabel: Boolean(document.querySelector('label[for="shortTableNameInput"]')),
      name: input?.getAttribute('aria-label') || '',
      placeholder: input?.placeholder || '',
      inReadmeRow: Boolean(input?.closest('.readme-actions'))
    };
  });
  // No visible label, to save the space (Jason, 2026-11-04); screen readers
  // still get the name once the placeholder is gone.
  check('the box is in the README row, with no visible label',
    shape.inReadmeRow && !shape.visibleLabel, JSON.stringify(shape));
  check('screen readers hear Short Table Name', shape.name === 'Short Table Name', shape.name);
  check('its placeholder', shape.placeholder === 'Short Table Name (ex. 4aces)', shape.placeholder);
  const tag = await app.run(() => {
    const node = document.querySelector('.readme-short-name-tag');
    const input = document.getElementById('shortTableNameInput').getBoundingClientRect();
    const box = node.getBoundingClientRect();
    return { text: node.textContent, top: box.top, bottom: box.bottom, inputTop: input.top, left: box.left, inputLeft: input.left };
  });
  check('the box is labelled as not part of the YML', tag.text === 'Manifest & README Only', tag.text);
  check('the label sits on the box\'s top edge', tag.top < tag.inputTop && tag.bottom > tag.inputTop && tag.left > tag.inputLeft, JSON.stringify(tag));
  // The 340px desktop preview column: the box takes the row's full width
  // above the two buttons, which stay side by side as before.
  const layout = await app.run(() => {
    const box = el => { const r = document.querySelector(el).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
    return { row: box('.readme-actions'), field: box('#shortTableNameField'), testYml: box('#testYmlBtn'), wizard: box('#wizardReadmeBtn') };
  });
  check('the box spans the README row',
    Math.abs(layout.field.left - layout.row.left) < 1 && Math.abs(layout.field.right - layout.row.right) < 1, JSON.stringify(layout));
  check('the buttons sit below it, side by side',
    layout.testYml.top >= layout.field.bottom && layout.testYml.top === layout.wizard.top && layout.testYml.right < layout.wizard.left, JSON.stringify(layout));

  // 2. The prefix is added when focus leaves, once, whatever the case.
  const typed = await typeName('4aces', { leave: false });
  check('nothing is added while typing', typed.value === '4aces' && typed.focusedWhileTyping, JSON.stringify(typed));
  check('leaving the box adds vpx-', (await typeName('4aces')).value === 'vpx-4aces');
  check('a name that has it already is left alone', (await typeName('vpx-4aces')).value === 'vpx-4aces');
  check('an upper-case prefix counts, and is lower-cased', (await typeName('VPX-4aces')).value === 'vpx-4aces');
  check('the rest keeps its case (two repo folders are mixed case)',
    (await typeName('nightmarebeforechristmasPUP')).value === 'vpx-nightmarebeforechristmasPUP');
  check('spaces around it are trimmed', (await typeName('  4aces  ')).value === 'vpx-4aces');
  check('an empty box stays empty', (await typeName('   ')).value === '');
  check('a bare prefix becomes empty, not "vpx-"', (await typeName('vpx-')).value === '');

  // 3. Kept with the build, never in the YML.
  await typeName('4aces');
  await new Promise(resolve => setTimeout(resolve, 600));
  const kept = await boxState();
  const draft = await app.run(key => JSON.parse(localStorage.getItem(key) || 'null')?.values?.__shortTableName ?? null, DRAFT_KEY);
  check('the name is in the build', kept.stored === 'vpx-4aces', JSON.stringify(kept.stored));
  check('and in the saved draft', draft === 'vpx-4aces', JSON.stringify(draft));
  check('but not in the YML', !/4aces|shortTableName/i.test(kept.yaml), kept.yaml);
  // The door main.js opened for it takes builder-only `__` keys and nothing
  // else, so it can never be used to write a real field past its handlers.
  const door = await app.run(() => {
    const values = window.VPS_FEATURE_RUNTIME.state.values;
    const before = values.romNotes;
    return { refused: window.VPS_MAIN.setUiValue('romNotes', 'sneaked in') === false, unchanged: values.romNotes === before };
  });
  check('setUiValue refuses a real field', door.refused && door.unchanged, JSON.stringify(door));

  await app.reload();
  await app.run(eval(settleSource));
  await new Promise(resolve => setTimeout(resolve, 300));
  check('a restored draft brings it back', (await boxState()).value === 'vpx-4aces');

  // 4. Wizard README: one line, README.md, nothing else downloaded.
  const before = await downloadsStarted();
  const done = await clickWizard();
  const readme = await downloadWithin(5000);
  await new Promise(resolve => setTimeout(resolve, 500));
  check('Wizard README downloads README.md', readme?.filename === 'README.md', JSON.stringify(readme && readme.filename));
  check('holding exactly the one line and one LF', readme?.text === README('vpx-4aces'), JSON.stringify(readme && readme.text));
  check('and nothing else: no preview image', (await downloadsStarted()) - before === 1);
  check('the toast says it downloaded', done.title === 'Wizard README downloaded'
    && done.message === 'README.md for vpx-4aces was sent to your Downloads folder.', JSON.stringify(done));

  // The spec's own example, typed without the prefix and never left: the
  // button adds it, and shows it in the box.
  await typeName('alicettlg', { leave: false });
  await clickWizard();
  const alice = await downloadWithin(5000);
  check('the spec example matches word for word', alice?.text === README('vpx-alicettlg'), JSON.stringify(alice && alice.text));
  check('the button adds the prefix to the box too', (await boxState()).value === 'vpx-alicettlg');

  // 5. Without the name: refused, with a dot on the box.
  await typeName('');
  const beforeRefusal = await downloadsStarted();
  const refused = await clickWizard();
  const after = await boxState();
  check('an empty name downloads nothing', (await downloadsStarted()) === beforeRefusal);
  // browser.mjs: a nextDownload that timed out must not swallow the next
  // real download (it did until 2026-11-04).
  check('waiting for it times out', (await downloadWithin(800)) === null);
  check('it says why', refused.title === 'Short Table Name required'
    && refused.message === 'Enter the table\'s folder name (ex. 4aces). Wizard README and Test This YML both use it.', JSON.stringify(refused));
  check('the box gets a red dot, marked invalid, and the cursor',
    after.dot && after.fieldError && after.invalid === 'true' && after.focused, JSON.stringify(after));
  check('the dot carries the message for hover and screen readers',
    after.dotLabel === 'Short Table Name required. Enter the table\'s folder name (ex. 4aces). Wizard README and Test This YML both use it.'
      && after.dotTip.includes('Short Table Name required'), JSON.stringify(after));
  check('the box points screen readers at the dot\'s message',
    after.dotId && after.describedBy === after.dotId, JSON.stringify(after));
  await typeName('4', { leave: false });
  const typing = await boxState();
  await clickWizard();
  const afterTimeout = await downloadWithin(5000);
  check('and the next real download still arrives', afterTimeout?.text === README('vpx-4'), JSON.stringify(afterTimeout));
  check('typing a name clears the dot', !typing.dot && !typing.fieldError && typing.invalid === null
    && typing.describedBy === null, JSON.stringify(typing));

  // Anything a folder name cannot hold becomes "-", one per run (Jason, 2026-11-05).
  for (const [typedName, expected] of [
    ['4 aces', 'vpx-4-aces'],
    ['4aces#2', 'vpx-4aces-2'],
    ['tables/4aces', 'vpx-tables-4aces'],
    ["  Bob's   Table!  ", 'vpx-Bob-s-Table'],
    ['VPX-Big Trouble', 'vpx-Big-Trouble'],
    ['big_trouble-2', 'vpx-big_trouble-2'],
    ['Café', 'vpx-Caf']
  ]) {
    await typeName(typedName);
    const shown = await boxState();
    check(`"${typedName}" becomes ${expected}`, shown.value === expected && !shown.dot, JSON.stringify(shown));
  }
  await typeName('!!!');
  const nothing = await boxState();
  check('a name with nothing usable in it empties the box', nothing.value === '', JSON.stringify(nothing));
  await typeName('4 aces');
  await clickWizard();
  const cleaned = await downloadWithin(5000);
  check('the link uses the cleaned name', cleaned?.text === README('vpx-4-aces'), JSON.stringify(cleaned));

  // 6. Copy and Download never check it.
  await typeName('');
  const dialog = await app.run(async settleText => {
    const settle = eval(settleText);
    document.getElementById('validateBtn').click();
    await settle();
    const text = document.getElementById('validationBody')?.textContent || '';
    document.getElementById('validationDialog')?.close();
    return text;
  }, settleSource);
  check('the Validate dialog never mentions it', !/short table name/i.test(dialog), dialog);

  // 7. Manual README is gone; Test This YML took its place.
  const removed = await app.run(() => ({ manual: document.getElementById('manualReadmeBtn'), test: document.getElementById('testYmlBtn')?.textContent }));
  check('Test This YML replaced Manual README', removed.manual === null && removed.test === 'Test This YML', JSON.stringify(removed));

  // 8. Gone with its build: Clear, and a new table.
  await typeName('4aces');
  await app.run(async settleText => {
    document.getElementById('previewClearBtn').click();
    await eval(settleText)();
  }, settleSource);
  const cleared = await app.run(() => document.getElementById('workspace').hidden);
  check('Clear closed the build', cleared === true);
  await searchHere(PINK_FLOYD);
  check('Clear empties it, even for the same table', (await boxState()).value === '');

  // Left with a "required" dot showing, then a different table searched for
  // on the same page: the dot belonged to the old build.
  await typeName('');
  await clickWizard();
  check('the dot is up before the switch', (await boxState()).dot === true);
  await searchHere(TMNT);
  const fresh = await boxState();
  check('a new table starts empty, with no leftover dot', fresh.value === '' && !fresh.dot && fresh.stored === null, JSON.stringify(fresh));

  check('no page errors', app.errors.length === 0, app.errors.join('\n'));
}

await app.close();
report('readme-short-name');
