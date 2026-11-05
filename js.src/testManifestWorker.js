// Test Manifest engine: runs LegendsUnchained's own manifest scripts in the
// browser, unmodified, with Pyodide (Python compiled to WebAssembly). Runs as a
// module worker: new Worker(url, { type: 'module' }). importScripts cannot load
// Pyodide here.
//
// Messages in:
//   { id, type: 'init', db, scriptsBase? }  db is the text of vpsdb.json
//   { id, type: 'run', folder, files }      files is [[relativePath, Uint8Array]]
// Messages out:
//   { id, value } or { id, error, code }    code: 'scripts', 'database' or 'engine'
//
// init downloads everything, then locks the worker. Table files only arrive
// after that, so nothing the scripts are handed has a network to leave by.

import { lockDownWorker } from './testManifestLockdown.js';

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
const UPSTREAM_URL = 'https://raw.githubusercontent.com/LegendsUnchained/vpx-standalone-alp4k/main/';
const SCRIPTS = [
  'scripts/generate-test-manifest.py',
  '.github/workflows/scripts/generate-manifest.py',
  '.github/workflows/scripts/vpsdb.py',
  '.github/workflows/scripts/catalog_history.py'
];
const VPSDB_URL = 'https://virtualpinballspreadsheet.github.io/vps-db/db/vpsdb.json';

// The scripts use requests for one thing, fetching vpsdb.json, so a stand-in
// hands over the copy the page supplied and refuses anything else.
const SETUP_PYTHON = `
import sys, types, json, os
class RequestException(Exception): pass
class HTTPError(RequestException): pass
class _Response:
    def __init__(self, text): self.text = text
    def raise_for_status(self): pass
    def json(self): return json.loads(self.text)
def _get(url, *args, **kwargs):
    if url != VPSDB_URL:
        raise RequestException('only vpsdb.json is supplied in the browser, asked for ' + url)
    with open('/work/vpsdb.json', encoding='utf-8') as f:
        return _Response(f.read())
requests = types.ModuleType('requests')
requests.get = _get
requests.exceptions = types.SimpleNamespace(HTTPError=HTTPError, RequestException=RequestException)
sys.modules['requests'] = requests
os.chdir('/work')
`;

const RESET_PYTHON = `
import shutil
for _d in ('/work/tables', '/work/manifest-tester'):
    shutil.rmtree(_d, ignore_errors=True)
for _m in ('vpsdb', 'catalog_history', 'generate_manifest'):
    sys.modules.pop(_m, None)
`;

// The script exits through SystemExit on a bad VPS ID rather than returning.
const RUN_PYTHON = `
import io, runpy, contextlib, json
_out, _err = io.StringIO(), io.StringIO()
_exit = None
_rc = None
try:
    with contextlib.redirect_stdout(_out), contextlib.redirect_stderr(_err):
        _ns = runpy.run_path('/repo/scripts/generate-test-manifest.py', run_name='builder')
        _rc = _ns['main']([TABLE])
except BaseException as e:
    _exit = repr(e)[:400]
json.dumps({'rc': _rc, 'exit': _exit, 'stdout': _out.getvalue()[-20000:], 'stderr': _err.getvalue()[-20000:]})
`;

let pyodide = null;
// new, then starting, then locked or failed. Only a locked worker runs anything.
let engineState = 'new';

class EngineError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function makeDirectories(path) {
  let current = '';
  path.split('/').filter(Boolean).forEach(part => {
    current += `/${part}`;
    if (!pyodide.FS.analyzePath(current).exists) pyodide.FS.mkdir(current);
  });
}

function writeFile(path, content) {
  makeDirectories(path.split('/').slice(0, -1).join('/'));
  pyodide.FS.writeFile(path, content);
}

// vpsdb.py swallows a failed fetch and returns an empty list, which would read
// as every VPS ID being wrong, so an unusable database stops here instead.
function checkDatabase(db) {
  let records = null;
  try { records = JSON.parse(db); } catch (_) { /* reported below */ }
  if (!Array.isArray(records) || !records.length) {
    throw new EngineError('database', 'The VPS database is not loaded, so the manifest cannot be built.');
  }
}

async function fetchScripts(base) {
  return Promise.all(SCRIPTS.map(async path => {
    let response = null;
    try { response = await fetch(base + path, { cache: 'no-cache' }); } catch (_) { /* reported below */ }
    if (!response?.ok) throw new EngineError('scripts', `Could not download ${path} from LegendsUnchained.`);
    return [path, await response.text()];
  }));
}

async function init({ db, scriptsBase }) {
  if (engineState !== 'new') throw new EngineError('engine', 'The manifest engine has already been started.');
  engineState = 'starting';
  try {
    await startEngine(db, scriptsBase);
    engineState = 'locked';
  } catch (error) {
    engineState = 'failed';
    throw error;
  }
  return { ready: true };
}

async function startEngine(db, scriptsBase) {
  checkDatabase(db);
  const [sources, { loadPyodide }] = await Promise.all([
    fetchScripts(scriptsBase || UPSTREAM_URL),
    import(`${PYODIDE_URL}pyodide.mjs`)
  ]);
  pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
  await pyodide.loadPackage('pyyaml');
  sources.forEach(([path, text]) => writeFile(`/repo/${path}`, text));
  writeFile('/work/vpsdb.json', db);
  pyodide.globals.set('VPSDB_URL', VPSDB_URL);
  pyodide.runPython(SETUP_PYTHON);
  lockDownWorker();
}

function run({ folder, files }) {
  if (engineState !== 'locked') throw new EngineError('engine', 'The manifest engine is not ready.');
  pyodide.runPython(RESET_PYTHON);
  files.forEach(([path, bytes]) => writeFile(`/work/tables/${folder}/${path}`, bytes));
  pyodide.globals.set('TABLE', folder);
  const result = JSON.parse(pyodide.runPython(RUN_PYTHON));
  if (result.rc !== 0) return { ...result, ok: false };
  return {
    ...result,
    ok: true,
    manifest: pyodide.FS.readFile('/work/manifest-tester/manifest.json', { encoding: 'utf8' }),
    zip: pyodide.FS.readFile(`/work/manifest-tester/${folder}.zip`)
  };
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type !== 'init' && data.type !== 'run') throw new EngineError('engine', `Unknown message: ${data.type}`);
    const value = data.type === 'init' ? await init(data) : run(data);
    postMessage({ id: data.id, value }, value.zip ? [value.zip.buffer] : []);
  } catch (error) {
    postMessage({ id: data.id, error: error?.message || String(error), code: error?.code || 'engine' });
  }
};
