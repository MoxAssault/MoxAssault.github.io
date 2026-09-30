// Headless Chrome for the tests that need a real browser.
//
// Why this exists: the archive engines are WASM running in a browser worker,
// and the app is a page of IIFEs hanging off window.*. Neither can be driven
// from Node alone, so until 2026-09-30 every claim about real decompression
// was proved by hand on a throwaway page and could not be repeated. This file
// is the repeatable version.
//
// Still no dependencies. Chrome is driven over the DevTools protocol through
// Node's built-in WebSocket (Node 22+), the repo is served by node:http, and
// nothing is installed. Chrome itself must be on the machine: it is on
// GitHub's ubuntu runners, and locally it is found in the usual places or
// named with CHROME_PATH.
//
// A missing Chrome FAILS the test rather than skipping it. A skipped browser
// suite reads as green, and a green suite that tested nothing is the exact
// trap this repo has shipped before.
//
//   const app = await openApp();
//   const value = await app.run(async name => { ... in the page ... }, 'arg');
//   app.warnings  -> every console.warn the page has logged
//   await app.close();

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO } from './harness.mjs';

const START_TIMEOUT_MS = 20000;
const CALL_TIMEOUT_MS = 60000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

export function findChrome() {
  if (process.env.CHROME_PATH) {
    if (existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
    throw new Error('CHROME_PATH is set but nothing exists at ' + process.env.CHROME_PATH);
  }
  const local = process.env.LOCALAPPDATA || '';
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(local, 'Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
      ]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : [];
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  if (process.platform !== 'win32') {
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
      const found = spawnSync('which', [name], { encoding: 'utf8' });
      if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
    }
  }
  throw new Error('no Chrome or Edge found - install one, or set CHROME_PATH to its executable');
}

// Serves the repo read-only, loopback only, with caching off so a test never
// runs against a stale copy of anything.
async function serveRepo() {
  const root = path.resolve(REPO);
  const server = createServer(async (req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/+/, '') || 'index.html';
    const full = path.resolve(root, rel);
    if (full !== root && !full.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(full);
      res.writeHead(200, {
        'content-type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store'
      }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, base: 'http://127.0.0.1:' + server.address().port + '/' };
}

function withTimeout(promise, ms, what) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(what + ' timed out after ' + ms + ' ms')), ms); })
  ]).finally(() => clearTimeout(timer));
}

export async function openApp({ page = 'index.html' } = {}) {
  const chromePath = findChrome();
  const { server, base } = await serveRepo();
  const profile = await mkdtemp(path.join(tmpdir(), 'vpxs-chrome-'));

  const args = [
    '--headless=new',
    '--remote-debugging-port=0',
    '--user-data-dir=' + profile,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    // Nothing leaves the machine. Google Fonts and the VPS database fail fast
    // instead of making a result depend on the network.
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'
  ];
  // GitHub's ubuntu-24.04 runners block the user namespaces Chrome's sandbox
  // needs, so Chrome will not start there with it on. Off on CI only.
  if (process.env.CI) args.push('--no-sandbox');
  args.push('about:blank');

  const chrome = spawn(chromePath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';

  const cleanup = async () => {
    try { chrome.kill(); } catch (_) { /* already gone */ }
    if (chrome.exitCode === null) {
      await withTimeout(new Promise(resolve => chrome.once('exit', resolve)), 5000, 'chrome exit').catch(() => {});
    }
    await new Promise(resolve => server.close(resolve));
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
  };

  let ws;
  try {
    const wsUrl = await withTimeout(new Promise((resolve, reject) => {
      chrome.stderr.on('data', chunk => {
        stderr += chunk;
        const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) resolve(match[1]);
      });
      chrome.once('error', reject);
      chrome.once('exit', code => reject(new Error('chrome exited (' + code + ') before it was ready:\n' + stderr)));
    }), START_TIMEOUT_MS, 'chrome start');

    ws = new WebSocket(wsUrl);
    await withTimeout(new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('could not connect to chrome')), { once: true });
    }), START_TIMEOUT_MS, 'devtools connect');
  } catch (error) {
    await cleanup();
    throw error;
  }

  let nextId = 0;
  const pending = new Map();
  const events = [];
  const warnings = [];
  const errors = [];

  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.consoleAPICalled') {
      const text = message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' ');
      if (message.params.type === 'warning') warnings.push(text);
      if (message.params.type === 'error') errors.push(text);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      errors.push(details.exception?.description || details.text);
    }
    events.forEach(listener => listener(message));
  });

  const send = (method, params = {}, sessionId) => withTimeout(new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  }), CALL_TIMEOUT_MS, method);

  let sessionId;
  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    ({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }));
    await send('Runtime.enable', {}, sessionId);
    await send('Page.enable', {}, sessionId);
    const loaded = new Promise(resolve => events.push(message => {
      if (message.method === 'Page.loadEventFired' && message.sessionId === sessionId) resolve();
    }));
    await send('Page.navigate', { url: base + page }, sessionId);
    await withTimeout(loaded, CALL_TIMEOUT_MS, 'page load');
  } catch (error) {
    try { ws.close(); } catch (_) { /* ignore */ }
    await cleanup();
    throw error;
  }

  // Runs fn inside the page with JSON-serialisable args and returns its
  // JSON-serialisable result. A throw in the page rejects here with the
  // page's own message.
  async function run(fn, ...fnArgs) {
    const expression = '(' + fn.toString() + ')(...' + JSON.stringify(fnArgs) + ')';
    const result = await send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true
    }, sessionId);
    if (result.exceptionDetails) {
      const details = result.exceptionDetails;
      throw new Error(details.exception?.description || details.text);
    }
    return result.result.value;
  }

  async function close() {
    try { ws.close(); } catch (_) { /* ignore */ }
    await cleanup();
  }

  return { run, close, warnings, errors, base };
}
