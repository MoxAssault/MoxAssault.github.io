// Test Folder and Test This YML: build the manifest and config zip for a picked
// table folder, in this browser, with LegendsUnchained's own scripts
// (js.src/testManifestWorker.js). Test Folder tests the folder's own table.yml and
// names the table after the folder; Test This YML tests the on-screen build and
// names it from the Short Table Name. Nothing is uploaded or written to disk until
// the user presses a download button.
//
// The README (Jason, 2026-11-14). Both kinds of test put the builder's Wizard
// README.md in the zip, unless the folder already has one: a match is used as
// it is (trailing spaces and line breaks do not count); a different one is
// replaced by Test This YML (which tests the builder's files) but kept by Test
// Folder (which tests the folder's). Test
// Folder names it after the folder when that is already a short name
// (vpx-, then letters, numbers, - and _), and otherwise asks.
//
// The downloads: manifest.json, the zip, table.yml and README.md, and Download
// All in the header for every one that is offered. table.yml is not offered
// by Test Folder (it tested the folder's own), and README.md is not offered
// when the folder's already matches; both stay on screen, disabled.
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
  // Set while the window asks Test Folder for a table name: called with the
  // answer, or with null when the window is closed instead.
  let naming = null;
  const README = 'README.md';
  const DOWNLOAD_ICON = '<svg class="test-manifest-save-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
  // One button per file, in this order; Download All saves the offered ones.
  const DOWNLOADS = [
    { key: 'manifest', id: 'testManifestSaveManifest' },
    { key: 'zip', id: 'testManifestSaveZip' },
    { key: 'yml', id: 'testManifestSaveYml' },
    { key: 'readme', id: 'testManifestSaveReadme' }
  ];

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
        <div class="dialog-header-actions test-manifest-header-actions">
          <button class="text-btn test-manifest-save" id="testManifestSaveAll" type="button" hidden aria-label="Download all offered files">${DOWNLOAD_ICON}<span>All</span></button>
          <button class="dialog-close" id="testManifestClose" data-test-manifest-close type="button" aria-label="Close Test Manifest" data-tooltip="Close">&times;</button>
        </div>
        <div class="test-manifest-progress" id="testManifestProgress" aria-hidden="true" hidden><span></span></div>
      </div>
      <div class="dialog-body test-manifest-body">
        <p class="test-manifest-status" id="testManifestStatus" role="status" aria-live="polite"></p>
        <form class="test-manifest-name" id="testManifestNameForm" hidden novalidate>
          <label for="testManifestNameInput">Table name for README.md</label>
          <div class="test-manifest-name-row">
            <input id="testManifestNameInput" type="text" autocomplete="off" spellcheck="false" placeholder="vpx-tablename" aria-describedby="testManifestNameError">
            <button class="text-btn test-manifest-save" id="testManifestNameGo" type="submit">Continue</button>
          </div>
          <p class="test-manifest-name-error" id="testManifestNameError" role="alert"></p>
        </form>
        <ul class="test-manifest-notes" id="testManifestNotes"></ul>
        <div class="test-manifest-downloads" id="testManifestDownloads" hidden>
          ${DOWNLOADS.map(({ key, id }) => `<button class="text-btn test-manifest-save" id="${id}" type="button" data-file="${key}">${DOWNLOAD_ICON}<span></span></button>`).join('')}
        </div>
        <div class="test-manifest-actions" id="testManifestActions" hidden>
          <button class="text-btn" id="testManifestAgain" type="button">Choose Another Folder</button>
        </div>
      </div>`;
    document.body.appendChild(node);
    node.querySelectorAll('[data-test-manifest-close]').forEach(button => {
      button.addEventListener('click', () => node.close?.());
    });
    node.addEventListener('click', event => { if (event.target === node) node.close?.(); });
    // Every way out of the window, Esc included, ends a test still running.
    // close arrives a task late, so a window already reopened for a new test is left alone.
    node.addEventListener('close', () => {
      if (node.open) return;
      stopJob();
      naming?.(null);
    });
    node.querySelector('#testManifestAgain').addEventListener('click', () => {
      document.getElementById(lastInputId).click();
    });
    DOWNLOADS.forEach(({ key, id }) => node.querySelector(`#${id}`).addEventListener('click', () => {
      const file = results?.files[key];
      if (file?.offered) saveFile(file);
    }));
    node.querySelector('#testManifestSaveAll').addEventListener('click', saveAll);
    bindNameForm(node);
    return node;
  }

  function saveFile({ name, type, data }) {
    save(new Blob([data], { type }), name);
  }

  // One after another: a browser may drop downloads started in the same
  // moment, and asks once before a page saves several files.
  // Disabled while it runs, so a second press cannot save everything twice
  // (a disabled button gets no clicks).
  async function saveAll() {
    const button = dialog().querySelector('#testManifestSaveAll');
    const files = results ? DOWNLOADS.map(({ key }) => results.files[key]).filter(file => file.offered) : [];
    button.disabled = true;
    try {
      for (const [index, file] of files.entries()) {
        if (index) await new Promise(resolve => setTimeout(resolve, 300));
        saveFile(file);
      }
    } finally {
      button.disabled = false;
    }
  }

  // Each button names its file; one not offered stays, disabled, and says why.
  function paintDownloads(node) {
    node.querySelector('#testManifestDownloads').hidden = !results;
    node.querySelector('#testManifestSaveAll').hidden = !results;
    if (!results) return;
    DOWNLOADS.forEach(({ key, id }) => {
      const file = results.files[key];
      const button = node.querySelector(`#${id}`);
      button.querySelector('span').textContent = file.name;
      button.disabled = !file.offered;
      button.setAttribute('aria-label', file.offered ? `Download ${file.name}` : `Download ${file.name}, not needed: ${file.why}`);
    });
  }

  // ---- The table name, when Test Folder's folder is not already one ----

  function nameParts(node) {
    return {
      form: node.querySelector('#testManifestNameForm'),
      input: node.querySelector('#testManifestNameInput'),
      error: node.querySelector('#testManifestNameError')
    };
  }

  function bindNameForm(node) {
    const { form, input, error } = nameParts(node);
    const tidy = () => {
      const name = window.VPS_README.normalizeShortName(input.value);
      if (input.value !== name) input.value = name;
      return name;
    };
    // Tidied as the Short Table Name box is, when the keyboard leaves it.
    input.addEventListener('blur', tidy);
    input.addEventListener('input', () => {
      error.textContent = '';
      input.removeAttribute('aria-invalid');
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const name = tidy();
      if (!name) {
        error.textContent = 'Enter the table\'s folder name (ex. 4aces).';
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      naming?.(name);
    });
  }

  function isShortName(name) {
    return window.VPS_README.normalizeShortName(name) === name;
  }

  // The answer, or null if the window is closed first.
  function askTableName(folder) {
    const node = dialog();
    paint({
      title: folder,
      status: `The folder ${folder} is not named vpx-{name}, so README.md needs the table's name. Letters, numbers, - and _ only.`
    });
    const { form, input, error } = nameParts(node);
    form.hidden = false;
    error.textContent = '';
    input.removeAttribute('aria-invalid');
    input.value = window.VPS_README.normalizeShortName(folder);
    input.focus();
    input.select();
    return new Promise(resolve => {
      naming = name => {
        naming = null;
        // The keyboard moves to the window's close button before the box it
        // is in disappears, rather than falling to the page (ui-checker, 2026-11-14).
        if (form.contains(document.activeElement)) node.querySelector('#testManifestClose').focus();
        form.hidden = true;
        resolve(name);
      };
    });
  }

  // ---- Which README goes in the zip ----

  function sameBytes(a, b) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }

  // The README is one line, and editors add or change the line break and
  // spaces at its end, so those do not make it differ (Jason, 2026-11-14).
  function sameReadme(a, b) {
    const text = bytes => new TextDecoder().decode(bytes).trimEnd();
    return text(a) === text(b);
  }

  // made is the builder's README for name; disk is the folder's, if it has one.
  // One note says both what was made and where it went.
  function chooseReadme(disk, made, name, fromBuild) {
    const builders = `the builder's README for ${name}`;
    if (!disk) {
      return { zip: made, offered: true, note: `This folder has no README.md, so the zip holds ${builders}. Your folder was not changed.` };
    }
    if (sameReadme(disk, made)) {
      const how = sameBytes(disk, made) ? 'exactly' : 'apart from spaces or line breaks at the end';
      return { zip: disk, offered: false, note: `README.md in this folder matches ${builders} ${how}, so the folder's own copy was used.` };
    }
    return fromBuild
      ? { zip: made, offered: true, note: `README.md in this folder differs from ${builders}, so the zip holds the builder's. Your folder was not changed.` }
      : { zip: disk, offered: true, note: `README.md in this folder differs from ${builders}, so the zip holds the folder's own. Download README.md saves the builder's.` };
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
    // The header's × is the only way out; while a test runs it also stops it.
    const close = node.querySelector('#testManifestClose');
    close.setAttribute('aria-label', busy ? 'Cancel the test and close Test Manifest' : 'Close Test Manifest');
    // The same, on screen, for pointer and keyboard users (Jason, 2026-11-15).
    close.dataset.tooltip = busy ? 'Cancel the test and close' : 'Close';
    // A moving bar while the test works; the status line says what it is doing.
    node.querySelector('#testManifestProgress').hidden = !busy;
    // Choose Another Folder hides once a new test starts; if the keyboard was
    // on it, it moves to × rather than falling to the page (ui-checker, 2026-11-14).
    const actions = node.querySelector('#testManifestActions');
    if (!error && actions.contains(document.activeElement)) close.focus();
    actions.hidden = !error;
    node.querySelector('#testManifestNotes').replaceChildren(...notes.map(note => {
      const item = document.createElement('li');
      item.textContent = note;
      return item;
    }));
    paintDownloads(node);
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

  async function runTest(current, { folder, entries, notes, yml, readme }) {
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
    results = {
      folder,
      files: {
        manifest: { name: 'manifest.json', type: 'application/json', data: result.manifest, offered: true },
        zip: { name: `${folder}.zip`, type: 'application/zip', data: result.zip, offered: true },
        yml: { name: 'table.yml', type: 'text/yaml;charset=utf-8', ...yml },
        readme: { name: README, type: 'text/markdown;charset=utf-8', ...readme }
      }
    };
    paint({
      status: `Manifest built for ${folder}.`,
      notes: [...notes, 'In the Manifest Tester, paste manifest.json, then upload the zip in the config slot.']
    });
  }

  function testNotes(folder, table, ymlText, hasYml) {
    if (!ymlText) return ['Test performed using table.yml in the selected folder.'];
    const notes = [hasYml ? 'Test performed using the YML on screen, not table.yml in the selected folder.' : 'Test performed using the YML on screen.'];
    if (folder !== table) notes.push(`The folder is named ${folder}, but the table was tested as ${table}. Check the Short Table Name.`);
    return notes;
  }

  async function startTest(fileList, { tableName = '', ymlText = '' } = {}) {
    if (job || naming) return;
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

    // Test This YML names the README from the Short Table Name; Test Folder
    // from the folder when that is already a short name, or else asks.
    const readmeName = ymlText ? table : (isShortName(folder) ? folder : await askTableName(folder));
    if (!readmeName) return;

    const current = { worker: null };
    job = current;
    paint({ title: table, status: 'Reading the folder…', busy: true });
    try {
      // Path to bytes, in the folder's order; a replaced file keeps its place.
      const files = new Map(await readEntries(picked));
      const notes = testNotes(folder, table, ymlText, hasYml);
      if (ymlText) files.set('table.yml', new TextEncoder().encode(ymlText));
      if (!files.has('launcher.png')) {
        files.set('launcher.png', await placeholderLauncher());
        notes.push('This folder has no launcher.png, so the zip holds a placeholder. Your folder was not changed.');
      }
      const made = new TextEncoder().encode(window.VPS_README.wizardReadmeText(readmeName));
      const readme = chooseReadme(files.get(README), made, readmeName, Boolean(ymlText));
      files.set(README, readme.zip);
      notes.push(readme.note);
      // Copies for the downloads: the bytes sent to the worker are handed
      // over to it, and are gone from this page once sent.
      const yml = ymlText
        ? { data: new TextEncoder().encode(ymlText), offered: true }
        : { data: files.get('table.yml').slice(), offered: false, why: 'this test used the folder\'s own table.yml.' };
      const readmeFile = { data: made.slice(), offered: readme.offered, why: 'the folder\'s README.md already matches the builder\'s.' };
      if (job !== current) return;
      await runTest(current, { folder: table, entries: [...files], notes, yml, readme: readmeFile });
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
