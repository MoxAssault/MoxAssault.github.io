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
  // A name, or [name, contents] for a file whose bytes matter.
  window.__pick = (folder, names, sizes = {}) => {
    const files = names.map(entry => {
      const [name, contents] = Array.isArray(entry) ? entry : [entry, 'x'];
      const file = new File([contents], name.split('/').pop());
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
      // Each download button: its file name, whether it can be pressed, its
      // spoken name, and whether it is an icon and a name, not "Download".
      buttons: [...(node?.querySelectorAll('#testManifestDownloads button') || [])].map(button => ({
        text: button.textContent.trim(), disabled: button.disabled, label: button.getAttribute('aria-label'),
        icon: !!button.querySelector('svg')
      })),
      all: (() => {
        const button = node?.querySelector('#testManifestSaveAll');
        return { shown: !!button && !button.hidden && button.getClientRects().length > 0, inHeader: !!button?.closest('.dialog-header'), icon: !!button?.querySelector('svg') };
      })(),
      nameForm: node?.querySelector('#testManifestNameForm')?.hidden === false,
      nameValue: node?.querySelector('#testManifestNameInput')?.value ?? null,
      nameError: node?.querySelector('#testManifestNameError')?.textContent || '',
      active: document.activeElement?.id || '',
      again: !!node?.querySelector('#testManifestAgain') && !node.querySelector('#testManifestAgain').closest('[hidden]'),
      busy: node?.querySelector('#testManifestClose')?.getAttribute('aria-label')?.startsWith('Cancel') === true,
      closeLabel: node?.querySelector('#testManifestClose')?.getAttribute('aria-label') || '',
      footerClose: !!node?.querySelector('.test-manifest-actions [data-test-manifest-close]'),
      tip: node?.querySelector('#testManifestClose')?.dataset.tooltip || '',
      progress: (() => {
        const bar = node?.querySelector('#testManifestProgress');
        const fill = bar?.querySelector('span');
        return { shown: !!bar && !bar.hidden && bar.getClientRects().length > 0, animation: fill ? getComputedStyle(fill).animationName : '' };
      })()
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
      paths: message.files?.map(([path]) => path),
      readme: message.files ? new TextDecoder().decode(message.files.find(([path]) => path === 'README.md')?.[1] || new Uint8Array()) : null
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
check('it names which table.yml was tested', good.notes.includes('Test performed using table.yml in the selected folder.'), JSON.stringify(good.notes));
check('the window has no Close button at the bottom; the × in the header is the way out', !good.footerClose && !good.again && good.closeLabel === 'Close Test Manifest', JSON.stringify(good));
check('it says what to do next', good.notes.some(note => note.includes('Manifest Tester')), JSON.stringify(good.notes));
check('the downloads are offered, each named by its file', good.downloads && good.zipLabel === 'vpx-a.zip', JSON.stringify(good));
check('a good run does not offer another folder', !good.again, JSON.stringify(good));
check('when done, the × tooltip says Close and the moving bar is gone', good.tip === 'Close' && !good.progress.shown, JSON.stringify([good.tip, good.progress]));
const tipShown = await app.run(() => {
  const close = document.getElementById('testManifestClose');
  close.focus({ focusVisible: true });
  const tip = getComputedStyle(close, '::before');
  return { content: tip.content, display: tip.display };
});
check('the × tooltip shows on keyboard focus', tipShown.content === '"Close"' && tipShown.display === 'block', JSON.stringify(tipShown));
const worker = await lastWorker();
check('it runs the real worker file as a module worker',
  worker.url === 'js.src/testManifestWorker.js' && worker.type === 'module', JSON.stringify(worker));
check('the builder\'s own database is handed over', JSON.parse(worker.messages[0].db)[0].id === 'tbl1');
check('files go in with paths relative to the folder',
  JSON.stringify(worker.messages[1].paths) === '["table.yml","launcher.png","sub/note.txt","README.md"]', JSON.stringify(worker.messages[1]));
check('the folder name is the table name', worker.messages[1].folder === 'vpx-a');
check('the worker is shut down after the run', worker.terminated === true);

await app.run(() => document.getElementById('testManifestSaveManifest').click());
const manifestFile = await app.nextDownload();
check('Download manifest.json saves that file', manifestFile.filename === 'manifest.json', JSON.stringify(manifestFile.filename));
await app.run(() => document.getElementById('testManifestSaveZip').click());
const zipFile = await app.nextDownload();
check('Download zip saves the table\'s zip', zipFile.filename === 'vpx-a.zip', JSON.stringify(zipFile.filename));

// The README and the new buttons (Jason, 2026-11-13 and 2026-11-14).
const README_A = 'This table is in the Table Manager Wizard. To view its details visit https://vpxtablemanager.com/catalog/#table=vpx-a\n';
check('a folder with no README.md gets the builder\'s in the zip, named after the folder',
  worker.messages[1].readme === README_A, JSON.stringify(worker.messages[1].readme));
check('and the window says so',
  good.notes.includes('This folder has no README.md, so the zip holds the builder\'s README for vpx-a. Your folder was not changed.'), JSON.stringify(good.notes));
check('four download buttons, each an icon and its file\'s name, with no "Download" text',
  JSON.stringify(good.buttons.map(button => button.text)) === '["manifest.json","vpx-a.zip","table.yml","README.md"]'
    && good.buttons.every(button => button.icon && !/Download/.test(button.text)), JSON.stringify(good.buttons));
check('each is still spoken as a download', good.buttons.filter(b => !b.disabled).every(b => b.label === `Download ${b.text}`), JSON.stringify(good.buttons));
check('table.yml is shown but disabled: Test Folder tested the folder\'s own',
  good.buttons[2].disabled === true && /not needed: this test used the folder's own table\.yml/.test(good.buttons[2].label), JSON.stringify(good.buttons[2]));
check('README.md is offered, as the folder had none', good.buttons[3].disabled === false, JSON.stringify(good.buttons[3]));
check('Download All sits in the window\'s header, as an icon', good.all.shown && good.all.inHeader && good.all.icon, JSON.stringify(good.all));
await app.run(() => document.getElementById('testManifestSaveReadme').click());
const readmeFile = await app.nextDownload();
check('Download README.md saves the builder\'s README', readmeFile.filename === 'README.md' && readmeFile.text === README_A, JSON.stringify(readmeFile));
await close();

// Download All: every offered file, one after another; not the disabled ones.
await app.run(() => window.__pick('vpx-all', ['table.yml', 'launcher.png']));
await app.run(() => window.__read(/Manifest built/));
// Pressed twice: the second press, while it runs, does nothing. Counted as
// files the page makes, since the browser may not report a repeat download.
await app.run(() => {
  window.__made = 0;
  const make = URL.createObjectURL.bind(URL);
  URL.createObjectURL = blob => { window.__made += 1; return make(blob); };
  const all = document.getElementById('testManifestSaveAll');
  all.click();
  all.click();
});
const allFiles = [];
for (let i = 0; i < 3; i += 1) allFiles.push((await app.nextDownload()).filename);
check('Download All saves manifest.json, the zip and README.md, in that order',
  JSON.stringify(allFiles) === '["manifest.json","vpx-all.zip","README.md"]', JSON.stringify(allFiles));
const extra = await app.nextDownload(1500).then(file => file.filename, () => null);
check('and not the disabled table.yml', extra === null, String(extra));
check('a second press while it runs saves nothing more', await app.run(() => window.__made) === 3,
  String(await app.run(() => window.__made)));
check('All can be pressed again once it is done',
  await app.run(() => document.getElementById('testManifestSaveAll').disabled === false));
await close();

// The folder's own README: an exact match is used and not offered again.
await app.run(text => window.__pick('vpx-same', ['table.yml', 'launcher.png', ['README.md', text]]),
  README_A.replace('vpx-a', 'vpx-same'));
const same = await app.run(() => window.__read(/Manifest built/));
check('an exact match is used as it is, and the window says so',
  same.notes.includes('README.md in this folder matches the builder\'s README for vpx-same exactly, so the folder\'s own copy was used.'), JSON.stringify(same.notes));
check('its button stays on screen, disabled, saying why',
  same.buttons[3].text === 'README.md' && same.buttons[3].disabled === true && /already matches/.test(same.buttons[3].label), JSON.stringify(same.buttons[3]));
await app.run(() => document.getElementById('testManifestSaveAll').click());
const sameAll = [];
for (let i = 0; i < 2; i += 1) sameAll.push((await app.nextDownload()).filename);
const sameExtra = await app.nextDownload(1500).then(file => file.filename, () => null);
check('Download All then saves only manifest.json and the zip',
  JSON.stringify(sameAll) === '["manifest.json","vpx-same.zip"]' && sameExtra === null, JSON.stringify([...sameAll, sameExtra]));
await close();

// A different README: Test Folder keeps the folder's own in the zip.
await app.run(() => window.__pick('vpx-own-readme', ['table.yml', 'launcher.png', ['README.md', 'My own notes\n']]));
const own = await app.run(() => window.__read(/Manifest built/));
const ownWorker = await lastWorker();
check('a different README stays the folder\'s own in the zip', ownWorker.messages[1].readme === 'My own notes\n', JSON.stringify(ownWorker.messages[1].readme));
check('the window says so and points at the download',
  own.notes.includes('README.md in this folder differs from the builder\'s README for vpx-own-readme, so the zip holds the folder\'s own. Download README.md saves the builder\'s.'), JSON.stringify(own.notes));
check('and README.md is offered', own.buttons[3].disabled === false, JSON.stringify(own.buttons[3]));
check('only one README.md goes in', ownWorker.messages[1].paths.filter(path => path === 'README.md').length === 1, JSON.stringify(ownWorker.messages[1].paths));
await close();

// Only the end differs (a CRLF line break, trailing spaces, no line break):
// still a match, used as it is, and the window says it was not exact.
for (const [label, ending] of [['a CRLF line break', '\r\n'], ['trailing spaces', '  \n'], ['no line break', '']]) {
  const folder = `vpx-end-${label.replace(/ /g, '-')}`;
  const text = README_A.replace('vpx-a', folder).replace(/\n$/, ending);
  await app.run((folder, text) => window.__pick(folder, ['table.yml', 'launcher.png', ['README.md', text]]), folder, text);
  const ended = await app.run(() => window.__read(/Manifest built/));
  const endedWorker = await lastWorker();
  check(`a README differing only by ${label} at the end is a match`,
    ended.buttons[3].disabled === true && endedWorker.messages[1].readme === text
      && ended.notes.includes(`README.md in this folder matches the builder's README for ${folder} apart from spaces or line breaks at the end, so the folder's own copy was used.`),
    JSON.stringify([ended.notes, ended.buttons[3]]));
  await close();
}
// A space inside the line is a real difference.
await app.run(text => window.__pick('vpx-inner', ['table.yml', 'launcher.png', ['README.md', text]]),
  README_A.replace('vpx-a', 'vpx-inner').replace('Table Manager', 'Table  Manager'));
const inner = await app.run(() => window.__read(/Manifest built/));
check('a space inside the line still differs', inner.buttons[3].disabled === false && inner.notes.some(note => note.includes('differs')), JSON.stringify(inner.notes));
await close();

// A folder not named vpx-{name}: the window asks, offering the tidied name.
const beforeAsk = (await lastWorker()).count;
await app.run(() => window.__pick('4aces', ['table.yml', 'launcher.png']));
const asked = await app.run(() => window.__read(/needs the table's name/));
check('a folder not named vpx-{name} is asked for the table\'s name',
  asked.nameForm && asked.status.includes('4aces') && asked.active === 'testManifestNameInput', JSON.stringify(asked));
check('the box offers the folder\'s name in the right form', asked.nameValue === 'vpx-4aces', String(asked.nameValue));
check('nothing has started yet', (await lastWorker()).count === beforeAsk && !asked.downloads);
const emptyName = await app.run(() => {
  const input = document.getElementById('testManifestNameInput');
  input.value = '  !! ';
  document.getElementById('testManifestNameGo').click();
  return window.__read(/needs the table's name/);
});
check('a name with nothing usable is refused, in the window',
  emptyName.nameForm && emptyName.nameError === 'Enter the table\'s folder name (ex. 4aces).' && emptyName.active === 'testManifestNameInput', JSON.stringify(emptyName));
check('and said aloud: the message is an alert',
  await app.run(() => document.getElementById('testManifestNameError').getAttribute('role') === 'alert'));
// Enter in the box: the keyboard is in the form when it goes.
const focusAfter = await app.run(() => {
  const input = document.getElementById('testManifestNameInput');
  input.value = 'Four Aces';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  document.getElementById('testManifestNameForm').requestSubmit();
  return document.activeElement?.id || document.activeElement?.tagName;
});
check('answering moves the keyboard to the window\'s close button, not the page', focusAfter === 'testManifestClose', String(focusAfter));
const named = await app.run(() => window.__read(/Manifest built/));
const namedWorker = await lastWorker();
check('the answer is tidied by the same rule as the Short Table Name, and names the README',
  namedWorker.messages[1].readme === README_A.replace('vpx-a', 'vpx-Four-Aces'), JSON.stringify(namedWorker.messages[1].readme));
check('one note names it and says where it went', named.notes.includes('This folder has no README.md, so the zip holds the builder\'s README for vpx-Four-Aces. Your folder was not changed.')
  && named.notes.filter(note => note.includes('README')).length === 1 && !named.nameForm, JSON.stringify(named.notes));
check('the folder itself is still what is tested', named.title === '4aces' && namedWorker.messages[1].folder === '4aces', JSON.stringify(named.title));
await close();

await app.run(() => window.__pick('vpx-4 aces', ['table.yml', 'launcher.png']));
const spaced = await app.run(() => window.__read(/needs the table's name/));
check('a space makes it not a short name too', spaced.nameForm && spaced.nameValue === 'vpx-4-aces', JSON.stringify(spaced));
const beforeCancel = (await lastWorker()).count;
await close();
await new Promise(resolve => setTimeout(resolve, 50));
check('closing instead of answering starts nothing', (await lastWorker()).count === beforeCancel);
await app.run(() => window.__pick('vpx-after', ['table.yml', 'launcher.png']));
const afterAsk = await app.run(() => window.__read(/Manifest built/));
check('and the next test runs as normal', afterAsk.title === 'vpx-after' && !afterAsk.nameForm, JSON.stringify(afterAsk));
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
await app.run(() => window.__pick('vpx-noyml-2', ['launcher.png']));
await app.run(() => window.__read(/No table.yml/));
await app.run(() => {
  window.__script.init = { value: { ready: true } };
  window.__script.run = { value: { ok: true, manifest: '{}', zip: new Uint8Array([1]), stdout: '', stderr: '' } };
  document.getElementById('testManifestAgain').focus();
  window.__pick('vpx-again', ['table.yml', 'launcher.png']);
});
const afterAgain = await app.run(() => window.__read(/Manifest built/));
check('when the new test hides Choose Another Folder, the keyboard moves to ×', afterAgain.active === 'testManifestClose' && !afterAgain.again, JSON.stringify(afterAgain.active));
await close();

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
check('a failed download says so', noScripts.status === 'Could not download scripts/generate-test-manifest.py from LegendsUnchained.' && noScripts.error && !noScripts.busy && noScripts.again, JSON.stringify(noScripts));
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
check('while running, the window\'s × says it cancels', running.busy && running.closeLabel === 'Cancel the test and close Test Manifest', JSON.stringify(running));
check('and its tooltip says so on screen', running.tip === 'Cancel the test and close', JSON.stringify(running.tip));
check('while running, a moving bar shows on the header line', running.progress.shown && running.progress.animation === 'test-manifest-sweep', JSON.stringify(running.progress));
// The bar takes no room: with it shown and then hidden, in the same window,
// nothing in the header or body moves.
const shift = await app.run(() => {
  const node = document.getElementById('testManifestDialog');
  const bar = document.getElementById('testManifestProgress');
  const place = () => [node.querySelector('.dialog-header'), ...node.querySelectorAll('.dialog-body > *')]
    .map(el => { const r = el.getBoundingClientRect(); return [r.top, r.height].join(); }).join('|');
  const shown = place();
  bar.hidden = true;
  const hidden = place();
  bar.hidden = false;
  const line = bar.getBoundingClientRect();
  const header = node.querySelector('.dialog-header').getBoundingClientRect();
  return { same: shown === hidden, shown, hidden, onLine: Math.abs(line.bottom - header.bottom) <= 1 && line.width >= header.width - 1 };
});
check('the bar coming and going moves nothing in the window', shift.same, JSON.stringify(shift));
check('and it lies across the header\'s bottom line', shift.onLine, JSON.stringify(shift));
// The harness cannot switch on reduced motion, so read the page's own rule.
const reduced = await app.run(() => {
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = [...sheet.cssRules]; } catch { continue; }
    for (const rule of rules) {
      if (!(rule instanceof CSSMediaRule) || !rule.conditionText.includes('prefers-reduced-motion: reduce')) continue;
      const bar = [...rule.cssRules].find(inner => inner.selectorText === '.test-manifest-progress > span');
      if (bar) return { name: bar.style.animationName, width: bar.style.width };
    }
  }
  return null;
});
check('under reduced motion the bar pulses in place instead of sweeping', reduced?.name === 'test-manifest-pulse' && reduced.width === '100%', JSON.stringify(reduced));
await app.run(() => document.getElementById('testManifestClose').click());
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
