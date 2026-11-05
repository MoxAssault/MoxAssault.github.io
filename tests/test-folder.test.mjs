// The Test Folder button and its window, in the real app. The harness has no
// network, so window.Worker is a scripted stand-in here; the real worker and
// Pyodide are covered by tests/test-manifest-live.mjs, by hand.

import { check, report } from './harness.mjs';
import { openApp } from './browser.mjs';

const DB = [{ id: 'tbl1', name: 'Fixture Table', tableFiles: [] }];
const app = await openApp({ db: DB, downloads: true });

await app.run(() => {
  // reply(type, message) decides what the stand-in worker says.
  window.__workers = [];
  window.__script = {};
  window.Worker = class {
    constructor(url, options) {
      this.url = url; this.options = options; this.terminated = false; this.messages = [];
      window.__workers.push(this);
    }
    postMessage(message) {
      this.messages.push(message);
      const reply = window.__script[message.type];
      if (reply === 'hang') return;
      if (reply === 'crash') { setTimeout(() => this.onerror?.({ message: 'boom' }), 0); return; }
      setTimeout(() => this.onmessage?.({ data: { id: message.id, ...reply } }), 0);
    }
    terminate() { this.terminated = true; }
  };
  window.__pick = (folder, names, sizes = {}) => {
    const files = names.map(name => {
      const file = new File(['x'], name.split('/').pop());
      Object.defineProperty(file, 'webkitRelativePath', { value: `${folder}/${name}` });
      if (sizes[name]) Object.defineProperty(file, 'size', { value: sizes[name] });
      return file;
    });
    window.VPS_TEST_MANIFEST.testFolder(files);
  };
  window.__read = async (until = /./) => {
    const node = document.getElementById('testManifestDialog');
    const started = Date.now();
    const text = () => node?.querySelector('#testManifestStatus')?.textContent || '';
    while (Date.now() - started < 4000 && !(until.test(text()))) await new Promise(resolve => setTimeout(resolve, 20));
    return {
      open: node?.open === true,
      title: node?.querySelector('#testManifestTitle')?.textContent,
      status: text(),
      error: node?.querySelector('#testManifestStatus')?.classList.contains('error') === true,
      notes: [...(node?.querySelectorAll('#testManifestNotes li') || [])].map(item => item.textContent),
      downloads: node?.querySelector('#testManifestDownloads')?.hidden === false,
      zipLabel: node?.querySelector('#testManifestSaveZip')?.textContent,
      again: node?.querySelector('#testManifestAgain')?.hidden === false,
      done: node?.querySelector('#testManifestDone')?.textContent
    };
  };
});
const close = () => app.run(() => document.getElementById('testManifestDialog').close());
const script = value => app.run(value => { window.__script = value; }, value);
const lastWorker = () => app.run(() => {
  const worker = window.__workers.at(-1);
  return {
    count: window.__workers.length,
    url: worker?.url,
    type: worker?.options?.type,
    terminated: worker?.terminated,
    messages: worker?.messages.map(message => ({
      type: message.type, folder: message.folder, db: message.db,
      paths: message.files?.map(([path]) => path)
    }))
  };
});

const header = await app.run(() => {
  const button = document.getElementById('testFolderBtn');
  const input = document.getElementById('testFolderInput');
  return {
    inSlot: button.parentElement.id === 'headerToolSlot',
    text: button.textContent,
    folderPicker: input.webkitdirectory === true,
    hidden: input.tabIndex === -1
  };
});
check('Test Folder sits in the old drop box slot', header.inSlot && header.text === 'Test Folder', JSON.stringify(header));
check('it picks a folder', header.folderPicker && header.hidden, JSON.stringify(header));

const OK = { value: { ready: true } };
const built = { value: { ok: true, manifest: '{"vpx-a": {}}\n', zip: new Uint8Array([80, 75, 5, 6]), stdout: '', stderr: '' } };

// Both files present.
await script({ init: OK, run: { value: { ...built.value, zip: [80, 75, 5, 6] } } });
await app.run(() => {
  const real = window.__script.run.value;
  window.__script.run = { value: { ...real, zip: new Uint8Array(real.zip) } };
  window.__pick('vpx-a', ['table.yml', 'launcher.png', 'sub/note.txt']);
});
const good = await app.run(() => window.__read(/Manifest built/));
check('a good folder builds', good.status === 'Manifest built for vpx-a.' && !good.error, JSON.stringify(good));
check('the window names the folder', good.title === 'vpx-a' && good.open, JSON.stringify(good));
check('it names which table.yml was tested', good.notes.includes('Tested the table.yml in this folder.'), JSON.stringify(good.notes));
check('it says what to do next', good.notes.some(note => note.includes('Manifest Tester')), JSON.stringify(good.notes));
check('both downloads are offered', good.downloads && good.zipLabel === 'Download vpx-a.zip', JSON.stringify(good));
check('a good run does not offer another folder', !good.again, JSON.stringify(good));
const worker = await lastWorker();
check('it runs the real worker file as a module worker',
  worker.url === 'js.src/testManifestWorker.js' && worker.type === 'module', JSON.stringify(worker));
check('the builder\'s own database is handed over', JSON.parse(worker.messages[0].db)[0].id === 'tbl1');
check('files go in with paths relative to the folder',
  JSON.stringify(worker.messages[1].paths) === '["table.yml","launcher.png","sub/note.txt"]', JSON.stringify(worker.messages[1]));
check('the folder name is the table name', worker.messages[1].folder === 'vpx-a');
check('the worker is shut down after the run', worker.terminated === true);

await app.run(() => document.getElementById('testManifestSaveManifest').click());
const manifestFile = await app.nextDownload();
check('Download manifest.json saves that file', manifestFile.filename === 'manifest.json', JSON.stringify(manifestFile.filename));
await app.run(() => document.getElementById('testManifestSaveZip').click());
const zipFile = await app.nextDownload();
check('Download zip saves the table\'s zip', zipFile.filename === 'vpx-a.zip', JSON.stringify(zipFile.filename));
await close();

// Scenario 3: no launcher.png.
await app.run(() => {
  window.__script.run = { value: { ok: true, manifest: '{}', zip: new Uint8Array([1]), stdout: '', stderr: '' } };
  window.__pick('vpx-b', ['table.yml']);
});
const noLauncher = await app.run(() => window.__read(/Manifest built/));
check('a missing launcher.png is added and the user is told',
  noLauncher.notes.some(note => note.includes('placeholder')), JSON.stringify(noLauncher.notes));
const placeholder = await lastWorker();
check('the placeholder goes in as launcher.png', placeholder.messages[1].paths.includes('launcher.png'), JSON.stringify(placeholder.messages[1]));
await close();

// Refusals that never start a worker.
const beforeRefusals = (await lastWorker()).count;
await app.run(() => window.__pick('vpx-c', ['launcher.png', 'sub/table.yml']));
const noYml = await app.run(() => window.__read(/No table\.yml/));
check('no base-level table.yml stops with the planned message',
  noYml.status === 'No table.yml in this folder. Build or load the table, then use Test This YML.' && noYml.error, JSON.stringify(noYml));
check('nothing is offered to download after a refusal', !noYml.downloads, JSON.stringify(noYml));
check('a refusal offers another folder', noYml.again, JSON.stringify(noYml));
const opened = await app.run(() => {
  const input = document.getElementById('testFolderInput');
  let clicks = 0;
  const count = event => { clicks += 1; event.preventDefault(); };
  input.addEventListener('click', count);
  document.getElementById('testManifestAgain').click();
  input.removeEventListener('click', count);
  return clicks;
});
check('Choose Another Folder opens the folder picker', opened === 1, String(opened));
await close();
await app.run(() => window.__pick('tables', ['vpx-a/table.yml', 'vpx-b/table.yml'], { 'vpx-a/table.yml': 300 * 1024 * 1024 }));
const tooBig = await app.run(() => window.__read(/limit/));
check('an oversized pick is refused with the size and the likely reason',
  tooBig.status.includes('301 MB') && tooBig.status.includes('whole tables folder') && tooBig.error, JSON.stringify(tooBig));
await close();
await app.run(() => window.__pick('vpx-big', ['table.yml'], { 'table.yml': 200 * 1024 * 1024 + 400000 }));
const justOver = await app.run(() => window.__read(/limit/));
check('a folder just over the limit does not claim to be at it', justOver.status.startsWith('This folder is 201 MB'), justOver.status);
await close();
check('neither refusal started a worker', (await lastWorker()).count === beforeRefusals);

// Failures from the engine.
await app.run(() => {
  window.__script.run = { value: { ok: false, stdout: '<img src=x onerror=alert(1)>', stderr: 'Fetching VPSDB\nERROR: Table <b>NOPE</b> not found in VPSDB\n' } };
  window.__pick('vpx-d', ['table.yml', 'launcher.png']);
});
const badId = await app.run(() => window.__read(/not found/));
check('upstream\'s own error is shown', badId.status === 'Table <b>NOPE</b> not found in VPSDB' && badId.error, JSON.stringify(badId));
check('and only as text, never as HTML',
  await app.run(() => document.querySelector('#testManifestStatus b') === null));
check('a failed run offers no downloads', !badId.downloads, JSON.stringify(badId));
await close();

await app.run(() => {
  window.__script.init = { error: 'Could not download scripts/generate-test-manifest.py from LegendsUnchained.', code: 'scripts' };
  window.__pick('vpx-e', ['table.yml', 'launcher.png']);
});
const noScripts = await app.run(() => window.__read(/Could not download/));
check('a failed download says so', noScripts.status === 'Could not download scripts/generate-test-manifest.py from LegendsUnchained.' && noScripts.error && noScripts.done === 'Close', JSON.stringify(noScripts));
check('and the worker is shut down', (await lastWorker()).terminated === true);
await close();

await app.run(() => {
  window.__script.init = 'crash';
  window.__pick('vpx-f', ['table.yml', 'launcher.png']);
});
const crashed = await app.run(() => window.__read(/could not start/));
check('a worker that dies on load says so', crashed.error, JSON.stringify(crashed));
await close();

// A crash during the run is not a connection problem.
await app.run(() => {
  window.__script.init = { value: { ready: true } };
  window.__script.run = 'crash';
  window.__pick('vpx-f2', ['table.yml', 'launcher.png']);
});
const crashedRun = await app.run(() => window.__read(/crashed/));
check('a crash during the run says so', crashedRun.status === 'The manifest script crashed. Try again.', JSON.stringify(crashedRun));
await close();

// Closing the window mid-run stops the work, and a late answer changes nothing.
await app.run(() => {
  window.__script.init = { value: { ready: true } };
  window.__script.run = 'hang';
  window.__pick('vpx-g', ['table.yml', 'launcher.png']);
});
const running = await app.run(() => window.__read(/Building the manifest/));
check('while running the button reads Cancel', running.done === 'Cancel', JSON.stringify(running));
await app.run(() => document.getElementById('testManifestDone').click());
await new Promise(resolve => setTimeout(resolve, 100));
const cancelled = await lastWorker();
check('Cancel stops the worker', cancelled.terminated === true, JSON.stringify(cancelled));
const closed = await app.run(() => window.__read(/$^/).catch(() => null) && document.getElementById('testManifestDialog').open);
check('and closes the window', closed === false);
const late = await app.run(async () => {
  const worker = window.__workers.at(-1);
  const id = worker.messages.at(-1).id;
  worker.onmessage({ data: { id, value: { ok: true, manifest: 'late', zip: new Uint8Array([1]), stdout: '', stderr: '' } } });
  await new Promise(resolve => setTimeout(resolve, 50));
  return window.__read(/Building/);
});
check('an answer arriving after Cancel is ignored', late.status === 'Building the manifest…' && !late.downloads, JSON.stringify(late));
const wrongId = await app.run(async () => {
  window.__script.run = 'hang';
  window.__pick('vpx-g2', ['table.yml', 'launcher.png']);
  await window.__read(/Building/);
  const worker = window.__workers.at(-1);
  worker.onmessage({ data: { id: -1, value: { ok: true, manifest: 'wrong', zip: new Uint8Array([1]), stdout: '', stderr: '' } } });
  await new Promise(resolve => setTimeout(resolve, 50));
  const state = await window.__read(/Building/);
  document.getElementById('testManifestDialog').close();
  return state;
});
check('a message with the wrong id is ignored', wrongId.status === 'Building the manifest…' && !wrongId.downloads, JSON.stringify(wrongId));
await new Promise(resolve => setTimeout(resolve, 50));

await app.run(() => {
  window.__script.run = { value: { ok: true, manifest: '{}', zip: new Uint8Array([1]), stdout: '', stderr: '' } };
  window.__pick('vpx-h', ['table.yml', 'launcher.png']);
});
const again = await app.run(() => window.__read(/Manifest built/));
check('a new test works after a cancel', again.title === 'vpx-h' && again.downloads, JSON.stringify(again));
await close();

check('no page errors', app.errors.length === 0, JSON.stringify(app.errors));
await app.close();
report();
