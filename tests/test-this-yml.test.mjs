// The Test This YML button: the on-screen build, tested inside a picked folder.
// Real app and real validation; window.Worker is a scripted stand-in, because
// the harness has no network. The real path: tests/test-manifest-live.mjs.

import { check, report } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, play } = await startScenarios();

// play() starts from a clean page, so this goes in after each one.
const install = () => app.run(() => {
  window.__workers = [];
  window.Worker = class {
    constructor() { this.messages = []; window.__workers.push(this); }
    postMessage(message) {
      this.messages.push(message);
      const value = message.type === 'init'
        ? { ready: true }
        : window.__fail
          ? { ok: false, stdout: '', stderr: 'ERROR: Table x not found in VPSDB\n' }
          : { ok: true, manifest: '{}', zip: new Uint8Array([1]), stdout: '', stderr: '' };
      setTimeout(() => this.onmessage?.({ data: { id: message.id, value } }), 0);
    }
    terminate() {}
  };
  window.__pickerOpens = 0;
  document.getElementById('testYmlInput').click = () => { window.__pickerOpens += 1; };
  window.__files = (folder, names) => names.map(name => {
    const file = new File(['from the folder'], name.split('/').pop());
    Object.defineProperty(file, 'webkitRelativePath', { value: `${folder}/${name}` });
    return file;
  });
  window.__read = async (until = /./) => {
    const node = document.getElementById('testManifestDialog');
    const text = () => node?.querySelector('#testManifestStatus')?.textContent || '';
    const started = Date.now();
    while (Date.now() - started < 4000 && !until.test(text())) await new Promise(resolve => setTimeout(resolve, 20));
    const worker = window.__workers.at(-1);
    const run = worker?.messages.find(message => message.type === 'run');
    return {
      title: node?.querySelector('#testManifestTitle')?.textContent,
      status: text(),
      notes: [...(node?.querySelectorAll('#testManifestNotes li') || [])].map(item => item.textContent),
      folder: run?.folder,
      paths: run?.files.map(([path]) => path),
      yml: run ? new TextDecoder().decode(run.files.find(([path]) => path === 'table.yml')?.[1] || new Uint8Array()) : ''
    };
  };
});

const press = () => app.run(() => {
  const before = window.__pickerOpens;
  document.getElementById('testYmlBtn').click();
  return {
    opened: window.__pickerOpens - before,
    validation: document.getElementById('validationDialog').open,
    shortNameDot: Boolean(document.getElementById('shortTableNameError'))
  };
});
const closeValidation = () => app.run(() => document.getElementById('validationDialog').close());
const name = value => app.run(value => {
  const input = document.getElementById('shortTableNameInput');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('blur'));
  input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}, value);

const SETUP = [['search', 'Lgi1JLk0Vf'], ['asset', 'tableFiles', 'qV3Z3oQ8md']];
await play(SETUP);
await install();

const blocked = await press();
check('an invalid build shows the validation window, like Download', blocked.validation === true, JSON.stringify(blocked));
check('and no folder picker opens', blocked.opened === 0, JSON.stringify(blocked));
await closeValidation();

// Fill what the table needs, the way the YAML scenarios do.
await play([...SETUP, ['fill', 'vpxChecksum', 'C95CD5EBA529FBD8CBB6686457839678'], ['fill', 'fps', '60'],
  ['fill', 'testers', 'Boris'], ['fill', 'tableNotes', 'Download the table']]);
await install();
const validNow = await app.run(() => {
  const yaml = window.VPS_MAIN.readyYaml();
  const dialog = document.getElementById('validationDialog');
  const issues = dialog.open ? dialog.textContent.replace(/\s+/g, ' ').slice(0, 400) : '';
  if (dialog.open) dialog.close();
  return { ok: yaml.length > 0, issues };
});
check('(setup: the build is valid now)', validNow.ok === true, validNow.issues);

const noName = await press();
check('a missing Short Table Name is refused on the box', noName.shortNameDot && noName.opened === 0, JSON.stringify(noName));

await name('!!!');
const badName = await press();
check('a name with nothing usable in it is refused too', badName.opened === 0, JSON.stringify(badName));

await name('vpx-live');
const ready = await press();
check('a valid build and name open the folder picker', ready.opened === 1, JSON.stringify(ready));

const yml = await app.run(() => window.VPS_MAIN.readyYaml());

// Scenario 2: folder with no table.yml.
await app.run(() => window.VPS_TEST_MANIFEST.testYml(window.__files('vpx-live', ['launcher.png', 'table.ini'])));
const added = await app.run(() => window.__read(/Manifest built/));
check('the on-screen YML is added to the folder', added.yml === yml && added.paths.includes('table.yml'), JSON.stringify(added.paths));
check('the window says so', added.notes.includes('Tested the YML on screen.'), JSON.stringify(added.notes));
check('the table is named from the Short Table Name', added.title === 'vpx-live' && added.folder === 'vpx-live', JSON.stringify(added));
await app.run(() => document.getElementById('testManifestDialog').close());
await new Promise(resolve => setTimeout(resolve, 50));

// The adjustment: a folder with its own table.yml still tests the on-screen one.
await press();
await app.run(() => window.VPS_TEST_MANIFEST.testYml(window.__files('vpx-live', ['table.yml', 'launcher.png'])));
const replaced = await app.run(() => window.__read(/Manifest built/));
check('the on-screen YML wins over the folder\'s', replaced.yml === yml, replaced.yml.slice(0, 80));
check('only one table.yml goes in', replaced.paths.filter(path => path === 'table.yml').length === 1, JSON.stringify(replaced.paths));
check('the window names which one was tested',
  replaced.notes.includes('Tested the YML on screen, not the table.yml in this folder.'), JSON.stringify(replaced.notes));
await app.run(() => document.getElementById('testManifestDialog').close());
await new Promise(resolve => setTimeout(resolve, 50));

// Scenario 4 and the folder-name warning.
await press();
await app.run(() => window.VPS_TEST_MANIFEST.testYml(window.__files('some-other-folder', ['table.ini'])));
const differs = await app.run(() => window.__read(/Manifest built/));
check('a placeholder launcher.png is added here too', differs.paths.includes('launcher.png'), JSON.stringify(differs.paths));
check('a different folder name is warned about', differs.notes.some(note => note.includes('some-other-folder') && note.includes('vpx-live')), JSON.stringify(differs.notes));
check('and the Short Table Name still names the table', differs.folder === 'vpx-live', differs.folder);
await app.run(() => document.getElementById('testManifestDialog').close());
await new Promise(resolve => setTimeout(resolve, 50));

// After a failed Test This YML, the retry stays on Test This YML.
await press();
const retry = await app.run(async () => {
  window.__fail = true;
  window.VPS_TEST_MANIFEST.testYml(window.__files('vpx-live', ['launcher.png']));
  await window.__read(/not found/);
  const before = window.__pickerOpens;
  document.getElementById('testManifestAgain').click();
  window.__fail = false;
  document.getElementById('testManifestDialog').close();
  return window.__pickerOpens - before;
});
check('Choose Another Folder reopens the Test This YML picker', retry === 1, String(retry));
await new Promise(resolve => setTimeout(resolve, 50));

// Test Folder is not affected by a Test This YML before it.
await app.run(() => window.VPS_TEST_MANIFEST.testFolder(window.__files('vpx-own', ['table.yml', 'launcher.png'])));
const folderRun = await app.run(() => window.__read(/Manifest built/));
check('Test Folder still tests the folder\'s own table.yml', folderRun.yml === 'from the folder' && folderRun.folder === 'vpx-own', folderRun.yml);

check('no page errors', app.errors.length === 0, JSON.stringify(app.errors));
await app.close();
report();
