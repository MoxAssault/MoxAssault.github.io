// Test Folder and Test This YML: build the manifest and config zip for a picked
// table folder, in this browser, with LegendsUnchained's own scripts
// (js.src/testManifestWorker.js). Test Folder tests the folder's own table.yml and
// names the table after the folder; Test This YML tests the on-screen build and
// names it from the Short Table Name. Nothing is uploaded or written to disk until
// the user presses a download button.
//
// Everything that comes back from the worker is upstream's output, so it is only
// ever shown with textContent and offered as a download, never treated as HTML.

(() => {
  'use strict';

  const MAX_FOLDER_BYTES = 200 * 1024 * 1024;
  const START_TIMEOUT_MS = 60000;
  const RUN_TIMEOUT_MS = 30000;
  const WORKER_URL = 'js.src/testManifestWorker.js';
  const NO_YML = 'No table.yml in this folder. Build or load the table, then use Test This YML.';

  // Set while a test runs; cleared by finishing or by closing the window.
  let job = null;
  let results = null;
  let nextMessageId = 0;
  // The on-screen build, held from the button press until the folder arrives.
  let pendingYml = null;
  let lastInputId = 'testFolderInput';

  function dialog() {
    let node = document.getElementById('testManifestDialog');
    if (node) return node;
    node = document.createElement('dialog');
    node.id = 'testManifestDialog';
    node.className = 'app-dialog test-manifest-dialog';
    node.setAttribute('aria-labelledby', 'testManifestTitle');
    node.innerHTML = `
      <div class="dialog-header">
        <div><p class="eyebrow">Test Manifest</p><h2 id="testManifestTitle"></h2></div>
        <button class="dialog-close" data-test-manifest-close type="button" aria-label="Close Test Manifest">&times;</button>
      </div>
      <div class="dialog-body test-manifest-body">
        <p class="test-manifest-status" id="testManifestStatus" role="status" aria-live="polite"></p>
        <ul class="test-manifest-notes" id="testManifestNotes"></ul>
        <div class="test-manifest-downloads" id="testManifestDownloads" hidden>
          <button class="text-btn preview-primary" id="testManifestSaveManifest" type="button">Download manifest.json</button>
          <button class="text-btn preview-primary" id="testManifestSaveZip" type="button"></button>
        </div>
        <div class="test-manifest-actions">
          <button class="text-btn" id="testManifestAgain" type="button" hidden>Choose Another Folder</button>
          <button class="text-btn" id="testManifestDone" data-test-manifest-close type="button">Close</button>
        </div>
      </div>`;
    document.body.appendChild(node);
    node.querySelectorAll('[data-test-manifest-close]').forEach(button => {
      button.addEventListener('click', () => node.close?.());
    });
    node.addEventListener('click', event => { if (event.target === node) node.close?.(); });
    // Every way out of the window, Esc included, ends a test still running.
    // close arrives a task late, so a window already reopened for a new test is left alone.
    node.addEventListener('close', () => { if (!node.open) stopJob(); });
    node.querySelector('#testManifestAgain').addEventListener('click', () => {
      document.getElementById(lastInputId).click();
    });
    node.querySelector('#testManifestSaveManifest').addEventListener('click', () => {
      if (results) save(new Blob([results.manifest], { type: 'application/json' }), 'manifest.json');
    });
    node.querySelector('#testManifestSaveZip').addEventListener('click', () => {
      if (results) save(new Blob([results.zip], { type: 'application/zip' }), `${results.folder}.zip`);
    });
    return node;
  }

  function save(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // A terminated worker never answers, so its timeout has to be cleared here or
  // it would hold the folder's bytes in memory until it fired.
  function stopJob() {
    clearTimeout(job?.timer);
    job?.worker?.terminate();
    job = null;
  }

  function paint({ title, status, error = false, busy = false, notes = [] }) {
    const node = dialog();
    if (title !== undefined) node.querySelector('#testManifestTitle').textContent = title;
    const line = node.querySelector('#testManifestStatus');
    line.textContent = status;
    line.classList.toggle('error', error);
    node.querySelector('#testManifestDone').textContent = busy ? 'Cancel' : 'Close';
    node.querySelector('#testManifestAgain').hidden = !error;
    node.querySelector('#testManifestNotes').replaceChildren(...notes.map(note => {
      const item = document.createElement('li');
      item.textContent = note;
      return item;
    }));
    node.querySelector('#testManifestDownloads').hidden = !results;
  }

  function open() {
    const node = dialog();
    if (typeof node.showModal === 'function') {
      if (!node.open) node.showModal();
    } else node.setAttribute('open', 'open');
  }

  function formatSize(bytes) {
    return `${Math.ceil(bytes / (1024 * 1024))} MB`;
  }

  function placeholderLauncher() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 960;
    const context = canvas.getContext('2d');
    context.fillStyle = '#1b1f2a';
    context.fillRect(0, 0, 640, 960);
    context.fillStyle = '#8a93a8';
    context.font = '40px sans-serif';
    context.textAlign = 'center';
    context.fillText('Placeholder launcher', 320, 480);
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Could not make a placeholder launcher.png.')); return; }
        blob.arrayBuffer().then(buffer => resolve(new Uint8Array(buffer)), reject);
      }, 'image/png');
    });
  }

  function askWorker(current, message, transfer, { timeoutMs, timeoutText, crashText }) {
    const id = ++nextMessageId;
    return new Promise((resolve, reject) => {
      current.timer = setTimeout(() => reject(new Error(timeoutText)), timeoutMs);
      current.worker.onerror = () => {
        clearTimeout(current.timer);
        reject(new Error(crashText));
      };
      current.worker.onmessage = ({ data }) => {
        if (data.id !== id) return;
        clearTimeout(current.timer);
        if (data.error) reject(new Error(data.error));
        else resolve(data.value);
      };
      current.worker.postMessage({ ...message, id }, transfer);
    });
  }

  // Upstream reports its own failures on stderr as "ERROR: ...".
  function failureText(result) {
    const lines = String(result.stderr || '').split('\n').filter(line => line.startsWith('ERROR'));
    return lines.length
      ? lines.map(line => line.replace(/^ERROR:\s*/, '')).join(' ')
      : 'The manifest script stopped without saying why.';
  }

  async function readEntries(picked) {
    return Promise.all(picked.map(async ({ path, file }) => [path, new Uint8Array(await file.arrayBuffer())]));
  }

  async function runTest(current, { folder, entries, notes }) {
    paint({ status: 'Starting the manifest tools…', busy: true, notes });
    const records = await window.fetchVPSDB();
    if (job !== current) return;
    current.worker = new Worker(WORKER_URL, { type: 'module' });
    await askWorker(current, { type: 'init', db: JSON.stringify(records) }, [], {
      timeoutMs: START_TIMEOUT_MS,
      timeoutText: 'The manifest tools took too long to start. Check your connection and try again.',
      crashText: 'The manifest tools could not start. Check your connection and try again.'
    });
    if (job !== current) return;
    paint({ status: 'Building the manifest…', busy: true, notes });
    const result = await askWorker(current, { type: 'run', folder, files: entries },
      entries.map(([, bytes]) => bytes.buffer), {
        timeoutMs: RUN_TIMEOUT_MS,
        timeoutText: 'The manifest script took too long and was stopped.',
        crashText: 'The manifest script crashed. Try again.'
      });
    if (job !== current) return;
    stopJob();
    if (!result.ok) {
      paint({ status: failureText(result), error: true, notes });
      return;
    }
    results = { folder, manifest: result.manifest, zip: result.zip };
    dialog().querySelector('#testManifestSaveZip').textContent = `Download ${folder}.zip`;
    paint({
      status: `Manifest built for ${folder}.`,
      notes: [...notes, 'In the Manifest Tester, paste manifest.json, then upload the zip in the config slot.']
    });
  }

  function testNotes(folder, table, ymlText, hasYml) {
    if (!ymlText) return ['Tested the table.yml in this folder.'];
    const notes = [hasYml ? 'Tested the YML on screen, not the table.yml in this folder.' : 'Tested the YML on screen.'];
    if (folder !== table) notes.push(`The folder is named ${folder}, but the table was tested as ${table}. Check the Short Table Name.`);
    return notes;
  }

  async function startTest(fileList, { tableName = '', ymlText = '' } = {}) {
    if (job) return;
    const files = [...fileList];
    if (!files.length) return;
    const folder = files[0].webkitRelativePath.split('/')[0];
    const table = tableName || folder;
    const picked = files.map(file => ({ file, path: file.webkitRelativePath.split('/').slice(1).join('/') }));
    results = null;
    open();
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (total > MAX_FOLDER_BYTES) {
      paint({
        title: table,
        status: `This folder is ${formatSize(total)}, over the ${formatSize(MAX_FOLDER_BYTES)} limit. Pick one table's folder, not the whole tables folder.`,
        error: true
      });
      return;
    }
    const hasYml = picked.some(({ path }) => path === 'table.yml');
    if (!hasYml && !ymlText) {
      paint({ title: table, status: NO_YML, error: true });
      return;
    }

    const current = { worker: null };
    job = current;
    paint({ title: table, status: 'Reading the folder…', busy: true });
    try {
      const entries = await readEntries(ymlText ? picked.filter(({ path }) => path !== 'table.yml') : picked);
      if (ymlText) entries.push(['table.yml', new TextEncoder().encode(ymlText)]);
      const notes = testNotes(folder, table, ymlText, hasYml);
      if (!picked.some(({ path }) => path === 'launcher.png')) {
        entries.push(['launcher.png', await placeholderLauncher()]);
        notes.push('This folder has no launcher.png, so the zip holds a placeholder. Your folder was not changed.');
      }
      if (job !== current) return;
      await runTest(current, { folder: table, entries, notes });
    } catch (error) {
      if (job !== current) return;
      stopJob();
      paint({ status: error?.message || 'The test could not finish.', error: true });
    }
  }

  function testFolder(fileList) {
    lastInputId = 'testFolderInput';
    return startTest(fileList);
  }

  function testYml(fileList) {
    if (!pendingYml) return undefined;
    lastInputId = 'testYmlInput';
    return startTest(fileList, pendingYml);
  }

  // Runs in the click itself: the browser only opens a folder picker straight
  // from a user action, so nothing here may wait.
  function prepareYmlTest() {
    pendingYml = null;
    const ymlText = window.VPS_MAIN?.readyYaml?.();
    if (!ymlText) return false;
    const tableName = window.VPS_README?.requireShortName?.();
    if (!tableName) return false;
    pendingYml = { ymlText, tableName };
    return true;
  }

  function bindPicker(buttonId, inputId, onPress, onFiles) {
    const button = document.getElementById(buttonId);
    const input = document.getElementById(inputId);
    if (!button || !input) return;
    button.addEventListener('click', () => { if (onPress()) input.click(); });
    input.addEventListener('change', () => {
      onFiles(input.files);
      input.value = '';
    });
  }

  function bind() {
    bindPicker('testFolderBtn', 'testFolderInput', () => true, testFolder);
    bindPicker('testYmlBtn', 'testYmlInput', prepareYmlTest, testYml);
  }

  window.VPS_TEST_MANIFEST = Object.freeze({ testFolder, testYml });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
