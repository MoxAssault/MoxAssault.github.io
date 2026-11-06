// The Hotkeys tab: the note under the four bindings needs room (Jason, 2026-11-05).

import { check, report } from './harness.mjs';
import { openApp } from './browser.mjs';

const app = await openApp();
const gap = await app.run(async () => {
  document.getElementById('helpBtn').click();
  document.getElementById('helpTabHotkeys').click();
  await new Promise(resolve => setTimeout(resolve, 100));
  const grid = document.querySelector('#helpPanelHotkeys .shortcut-grid').getBoundingClientRect();
  const note = document.querySelector('#helpPanelHotkeys .help-hotkey-note').getBoundingClientRect();
  return { grid: grid.height, gap: note.top - grid.bottom };
});
check('the Hotkeys tab is showing', gap.grid > 0, JSON.stringify(gap));
check('the note sits 20px below the bindings', gap.gap === 20, JSON.stringify(gap));
await app.close();
report();
