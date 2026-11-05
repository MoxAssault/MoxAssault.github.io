// YML import moved to the whole header bar (Jason, 2026-11-04): a dropped .yml
// lands anywhere on the bar, and an Import YML icon after Search opens the file
// chooser. The move was agreed on condition it changes no sizing, so the numbers
// measured before it are pinned here.

import { check, report } from './harness.mjs';
import { openApp } from './browser.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

// Measured 2026-11-04 on the old header.
const LAYOUTS = [
  { width: 1400, height: 64, side: 340 },
  { width: 860, height: 105 },
  { width: 600, height: 147 }
];

for (const layout of LAYOUTS) {
  // Headless Chrome keeps 16px of the window for itself.
  const sized = await openApp({ windowSize: [layout.width + 16, 900] });
  const measured = await sized.run(() => {
    const header = document.querySelector('.app-header').getBoundingClientRect();
    return {
      viewport: window.innerWidth,
      header: Math.round(header.height),
      side: Math.round(document.querySelector('.header-side').getBoundingClientRect().width),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  });
  check(`${layout.width}px: the window really is that wide`, measured.viewport === layout.width, String(measured.viewport));
  check(`${layout.width}px: the header height has not moved`, measured.header === layout.height, String(measured.header));
  if (layout.side) check(`${layout.width}px: .header-side is still ${layout.side}px`, measured.side === layout.side, String(measured.side));
  check(`${layout.width}px: nothing overflows`, !measured.overflow);
  await sized.close();
}

const { app, play } = await startScenarios();

const controls = await app.run(() => {
  const button = document.getElementById('ymlImportButton');
  const input = document.getElementById('ymlImportInput');
  return {
    afterSearch: document.getElementById('searchBtn').nextElementSibling === button,
    labels: button.getAttribute('for') === 'ymlImportInput' && input.type === 'file' && input.accept === '.yml',
    name: input.getAttribute('aria-label'),
    tooltip: button.dataset.tooltip,
    svg: Boolean(button.querySelector('svg')),
    height: Math.round(button.getBoundingClientRect().height),
    oldBox: document.querySelector('.yml-import-drop') === null,
    hint: [...document.querySelectorAll('#emptyState .shortcut-hint')].map(node => node.textContent.trim())
  };
});
check('Import YML sits right after Search', controls.afterSearch);
check('it opens the same file chooser', controls.labels);
check('it has a name a screen reader can read', controls.name === 'Import YML', controls.name);
check('it has the app tooltip', controls.tooltip === 'Import YML', controls.tooltip);
check('it is an inline SVG, not a text glyph', controls.svg);
check('it is 32px tall like Search', controls.height === 32, String(controls.height));
check('the old drop box is gone', controls.oldBox);
check('the start screen explains both ways in',
  controls.hint.includes('Drop a YML on the top bar to edit it, or use Import YML.'), JSON.stringify(controls.hint));

// Fires one drag event at a header element and reports what happened.
const fire = (type, target, items) => app.run(async ([type, target, items]) => {
  const transfer = new DataTransfer();
  for (const item of items) {
    if (item.text) transfer.items.add(item.text, 'text/plain');
    else transfer.items.add(new File([item.body || ''], item.name));
  }
  const event = new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true });
  document.querySelector(target).dispatchEvent(event);
  const header = document.querySelector('.app-header');
  return {
    prevented: event.defaultPrevented,
    active: header.classList.contains('is-dragover'),
    label: getComputedStyle(header, '::after').content
  };
}, [type, target, items]);

const yml = [{ name: 'table.yml', body: 'tableVPSId: "x"\n' }];
const entered = await fire('dragenter', '.brand', yml);
check('dragging a file over the bar lights it up', entered.active && entered.prevented, JSON.stringify(entered));
check('and says what will happen', entered.label === '"Drop to edit this YML"', entered.label);
const moved = await app.run(() => {
  const transfer = new DataTransfer();
  transfer.items.add(new File(['x'], 'table.yml'));
  document.querySelector('.brand').dispatchEvent(new DragEvent('dragleave', {
    dataTransfer: transfer, bubbles: true, cancelable: true, relatedTarget: document.getElementById('idInput')
  }));
  return document.querySelector('.app-header').classList.contains('is-dragover');
});
check('moving between things on the bar keeps it lit', moved === true);
const left = await fire('dragleave', '.brand', yml);
check('leaving the bar clears it', !left.active, JSON.stringify(left));

const toastDuringDrag = await app.run(() => {
  const toast = document.createElement('div');
  toast.className = 'vps-db-toast is-visible';
  document.body.appendChild(toast);
  const drag = type => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['x'], 'table.yml'));
    document.querySelector('main').dispatchEvent(new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true }));
    return getComputedStyle(toast).pointerEvents;
  };
  const before = getComputedStyle(toast).pointerEvents;
  const during = drag('dragenter');
  const afterLeave = drag('dragleave');
  drag('dragenter');
  const afterDrop = drag('drop');
  toast.remove();
  return { before, during, afterLeave, afterDrop };
});
check('a toast lets a file drag through to the bar', toastDuringDrag.during === 'none', JSON.stringify(toastDuringDrag));
check('and goes back to normal after leaving or dropping',
  toastDuringDrag.before === 'auto' && toastDuringDrag.afterLeave !== 'none' && toastDuringDrag.afterDrop !== 'none', JSON.stringify(toastDuringDrag));

const textDrag = await fire('dragenter', '#idInput', [{ text: 'hello' }]);
check('dragging text over the search box is left alone', !textDrag.active && !textDrag.prevented, JSON.stringify(textDrag));
const textDrop = await fire('drop', '#idInput', [{ text: 'hello' }]);
check('and dropping it stays an ordinary text drop', !textDrop.prevented, JSON.stringify(textDrop));

const toast = async () => app.run(async () => {
  const started = Date.now();
  const read = () => document.querySelector('#ymlImportToast .vps-db-toast-title')?.textContent || '';
  while (Date.now() - started < 8000 && (!read() || read() === 'Opening YML file')) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return read();
});

await fire('drop', '.brand', [{ name: 'a.yml' }, { name: 'b.yml' }]);
check('two files get the existing toast', (await toast()) === 'Choose one YML file');
await fire('drop', '.header-actions', [{ name: 'notes.txt', body: 'x' }]);
check('another type gets the existing toast', (await toast()) === 'YML file required');

const good = await app.run(async () => (await (await fetch('fixtures/vpsdb-five.json')).json())[0].id);
const body = `tableVPSId: "${good}"\n`;
await fire('drop', '.brand', [{ name: 'table.yml', body }]);
check('a .yml dropped on the brand end of the bar imports', /YML loaded|could not be loaded|Import cancelled/.test(await toast()));
const after = await app.run(() => ({
  loading: document.querySelector('.app-header').classList.contains('is-loading'),
  active: document.querySelector('.app-header').classList.contains('is-dragover')
}));
check('the bar is left clean after the import', !after.loading && !after.active, JSON.stringify(after));

// A loaded build is protected. Answering no here stands in for the person.
await play([['search', 'Lgi1JLk0Vf'], ['asset', 'tableFiles', 'qV3Z3oQ8md']]);
const before = await app.run(() => { window.__asked = 0; window.confirm = () => { window.__asked += 1; return false; }; return window.VPS_FEATURE_RUNTIME.state.record?.id; });
await fire('drop', '.brand', [{ name: 'table.yml', body }]);
await new Promise(resolve => setTimeout(resolve, 300));
const still = await app.run(() => window.VPS_FEATURE_RUNTIME.state.record?.id);
check('it asks first', (await app.run(() => window.__asked)) === 1);
check('an accidental drop cannot replace a loaded build without asking', still === before && Boolean(before), `${before} -> ${still}`);

await app.close();
report();
