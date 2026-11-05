// Removes the network, storage and run-new-code routes from a Web Worker.
//
// Test Manifest runs LegendsUnchained's scripts, fetched live from their main
// branch, so nobody reviews a change before it runs on this site. A worker
// already has no page and no localStorage; this takes away what it does have.
// Called once the worker has everything it needs, before any table file reaches
// it. It is a strong barrier and not a perfect one: `tests/test-manifest-live.mjs`
// records which escape routes it has been tried against.

export const BLOCKED_NAMES = [
  'fetch', 'XMLHttpRequest', 'WebSocket', 'WebSocketStream', 'EventSource', 'WebTransport',
  'RTCPeerConnection', 'Worker', 'SharedWorker', 'BroadcastChannel', 'importScripts',
  'indexedDB', 'caches', 'eval', 'FontFace', 'fonts', 'Notification',
  'webkitRequestFileSystem', 'webkitRequestFileSystemSync', 'webkitResolveLocalFileSystemURL',
  'webkitResolveLocalFileSystemSyncURL'
];
export const BLOCKED_NAVIGATOR_NAMES = ['storage', 'storageBuckets', 'serviceWorker', 'locks'];

// A name can live on the object or anywhere up its prototype chain, so each
// level has to lose it.
function removeEverywhere(scope, name) {
  for (let level = scope; level; level = Object.getPrototypeOf(level)) {
    const descriptor = Object.getOwnPropertyDescriptor(level, name);
    if (descriptor?.configurable) delete level[name];
  }
}

// `new Function` has back doors: every function's .constructor is the same
// thing, and async and generator functions each have their own. Pyodide still
// needs the name Function for `x instanceof Function`, so a stand-in keeps that
// answer and refuses to build code.
function closeFunctionConstructors(scope, FunctionType) {
  const standIn = function () { throw new Error('Function is disabled in this worker.'); };
  standIn.prototype = FunctionType.prototype;
  Object.defineProperty(scope, 'Function', { value: standIn, configurable: false, writable: false });
  const prototypes = [
    FunctionType.prototype,
    Object.getPrototypeOf(async function () {}),
    Object.getPrototypeOf(function* () {}),
    Object.getPrototypeOf(async function* () {})
  ];
  prototypes.forEach(prototype => {
    Object.defineProperty(prototype, 'constructor', { value: undefined });
  });
}

// A timer given a string runs it as code, which would reopen everything above.
// Pyodide's event loop needs timers, so only the string form goes.
function closeStringTimers(scope) {
  ['setTimeout', 'setInterval'].forEach(name => {
    const timer = scope[name];
    if (!timer) return;
    scope[name] = (handler, ...rest) => {
      if (typeof handler !== 'function') throw new Error('Timers only take functions in this worker.');
      return timer.call(scope, handler, ...rest);
    };
  });
}

// Throws if anything survives: a worker that could not be locked must not run.
export function lockDownWorker(scope = self) {
  const FunctionType = scope.Function;
  BLOCKED_NAMES.forEach(name => removeEverywhere(scope, name));
  BLOCKED_NAVIGATOR_NAMES.forEach(name => removeEverywhere(scope.navigator || {}, name));
  if (FunctionType) closeFunctionConstructors(scope, FunctionType);
  closeStringTimers(scope);
  const survivors = [
    ...BLOCKED_NAMES.filter(name => scope[name] !== undefined),
    ...BLOCKED_NAVIGATOR_NAMES.filter(name => scope.navigator?.[name] !== undefined)
  ];
  if (survivors.length) throw new Error(`Could not lock the worker: ${survivors.join(', ')}`);
}
