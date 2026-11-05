// Test Manifest engine against the real thing, run BY HAND:
//   node tests/test-manifest-live.mjs
// Not part of npm test (no ".test" in the name): it needs the network, and a
// change upstream must never fail this repo's CI. It runs upstream's scripts
// only inside Chrome's sandbox, on a throwaway profile, never in local Python.
//
// Part 1: the real upstream scripts build a real manifest after the lockdown.
// Part 2: a hostile stand-in for upstream's script tries every way out it can.
// A canary route on this server records anything that reaches it, so escaping
// is measured, not inferred. A control request before the lockdown proves the
// canary works.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
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
    res.writeHead(200, { 'content-type': url.pathname.endsWith('.js') ? 'text/javascript' : 'text/plain' });
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

} finally {
  ws.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
report();
