// The Test Manifest lockdown, run in a real Web Worker in headless Chrome.
// Needs no network: tests/test-manifest-live.mjs covers Pyodide and upstream's
// scripts, by hand, because a change upstream must never fail this repo's CI.

import { check, report } from './harness.mjs';
import { openApp } from './browser.mjs';

const app = await openApp();

const result = await app.run(async () => {
  const source = `
    import { BLOCKED_NAMES, BLOCKED_NAVIGATOR_NAMES, lockDownWorker } from '${location.origin}/js.src/testManifestLockdown.js';
    const out = { names: BLOCKED_NAMES };
    out.before = BLOCKED_NAMES.filter(name => self[name] !== undefined);
    out.storageBefore = navigator.storage !== undefined;
    lockDownWorker();
    out.after = BLOCKED_NAMES.filter(name => self[name] !== undefined);
    out.storageAfter = navigator.storage !== undefined;
    out.navigatorAfter = BLOCKED_NAVIGATOR_NAMES.filter(name => navigator[name] !== undefined);
    out.constructors = [(() => {}).constructor, (async () => {}).constructor,
      (function* () {}).constructor, (async function* () {}).constructor].map(value => value === undefined);
    try { new Function('return 1'); out.newFunction = 'ran'; } catch (error) { out.newFunction = error.message; }
    out.instanceOf = (() => {}) instanceof Function;
    try { setTimeout('self.stringRan = true', 0); out.stringTimer = 'ran'; } catch (error) { out.stringTimer = error.message; }
    try { setInterval('self.stringRan = true', 0); out.stringInterval = 'ran'; } catch (error) { out.stringInterval = error.message; }
    out.functionTimer = await new Promise(resolve => setTimeout(() => resolve(true), 0));
    out.stillWorks = JSON.stringify({ sum: [1, 2].reduce((a, b) => a + b, 0) });
    const strict = {};
    Object.defineProperty(strict, 'fetch', { value: () => {}, configurable: false });
    try { lockDownWorker(strict); out.refused = ''; } catch (error) { out.refused = error.message; }
    postMessage(out);`;
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(url, { type: 'module' });
  return new Promise(resolve => {
    worker.onmessage = ({ data }) => { worker.terminate(); resolve(data); };
    worker.onerror = event => resolve({ error: event.message });
  });
});

check('the lockdown ran in a real worker', !result.error, result.error);
for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'indexedDB', 'caches', 'eval', 'FontFace']) {
  check(`${name} exists before the lockdown, so the check is real`, result.before?.includes(name), JSON.stringify(result.before));
}
check('nothing on the list survives', result.after?.length === 0, JSON.stringify(result.after));
check('navigator.storage was there and is gone', result.storageBefore === true && result.storageAfter === false);
check('nothing on the navigator list survives', result.navigatorAfter?.length === 0, JSON.stringify(result.navigatorAfter));
check('every function constructor back door is closed',
  JSON.stringify(result.constructors) === '[true,true,true,true]', JSON.stringify(result.constructors));
check('new Function refuses to build code', result.newFunction === 'Function is disabled in this worker.', result.newFunction);
check('instanceof Function still answers, which Pyodide needs', result.instanceOf === true);
check('a timer refuses a string of code', result.stringTimer === 'Timers only take functions in this worker.', result.stringTimer);
check('an interval refuses a string of code', result.stringInterval === 'Timers only take functions in this worker.', result.stringInterval);
check('a timer still takes a function, which Pyodide needs', result.functionTimer === true);
check('ordinary code still runs afterwards', result.stillWorks === '{"sum":3}', result.stillWorks);
check('a worker that cannot be locked refuses to carry on',
  result.refused === 'Could not lock the worker: fetch', result.refused);

// The engine's guard: only a worker that finished locking runs anything. The
// real worker file, with a database too empty to get past the first check, so
// this stays offline.
const guard = await app.run(async () => {
  const worker = new Worker('js.src/testManifestWorker.js', { type: 'module' });
  let id = 0;
  const ask = message => new Promise((resolve, reject) => {
    const mine = ++id;
    worker.onerror = event => reject(new Error(`worker failed to load: ${event.message}`));
    const listener = ({ data }) => {
      if (data.id !== mine) return;
      worker.removeEventListener('message', listener);
      resolve(data);
    };
    worker.addEventListener('message', listener);
    worker.postMessage({ ...message, id: mine });
  });
  const run = { type: 'run', folder: 'vpx-x', files: [] };
  const beforeInit = await ask(run);
  const badDb = await ask({ type: 'init', db: '[]' });
  const afterFailure = await ask(run);
  const secondInit = await ask({ type: 'init', db: '[{"id":"x"}]' });
  const unknown = await ask({ type: 'runn' });
  worker.terminate();
  return { beforeInit, badDb, afterFailure, secondInit, unknown };
});
check('run before start-up is refused', guard.beforeInit.error === 'The manifest engine is not ready.', JSON.stringify(guard.beforeInit));
check('an empty database stops start-up with its own code', guard.badDb.code === 'database', JSON.stringify(guard.badDb));
check('run after a failed start-up is refused', guard.afterFailure.error === 'The manifest engine is not ready.', JSON.stringify(guard.afterFailure));
check('an unknown message is refused by name', guard.unknown.error === 'Unknown message: runn', JSON.stringify(guard.unknown));
check('a failed engine cannot be started again', guard.secondInit.error === 'The manifest engine has already been started.', JSON.stringify(guard.secondInit));

await app.close();
report();
