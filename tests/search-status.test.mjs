// The search status line (Jason, 2026-11-05): it sits above the search bar so it
// never covers Search, stays for 30 seconds, then fades and clears.

import { check, report } from './harness.mjs';
import { openApp } from './browser.mjs';

const DB = [{ id: 'tbl1', name: 'Fixture Table', tableFiles: [] }];

for (const width of [1400, 860, 400]) {
  const sized = await openApp({ db: DB, windowSize: [width + 16, 900] });
  const place = await sized.run(async () => {
    const input = document.getElementById('idInput');
    input.value = 'no such table anywhere at all, with a long search to fill the line';
    document.getElementById('searchForm').requestSubmit();
    const line = document.getElementById('searchStatus');
    const started = Date.now();
    while (Date.now() - started < 4000 && !line.textContent) await new Promise(resolve => setTimeout(resolve, 20));
    const box = element => element.getBoundingClientRect();
    const status = box(line);
    const bar = box(document.getElementById('searchForm'));
    const touches = other => !(status.right <= other.left || status.left >= other.right || status.bottom <= other.top || status.top >= other.bottom);
    const hits = ['.brand-logo', '.brand span', '#searchBtn', '#ymlImportButton', '#helpBtn', '#recentBtn', '#testFolderBtn']
      .filter(selector => touches(box(document.querySelector(selector))));
    return { text: line.textContent, bottom: status.bottom, barTop: bar.top, left: status.left, right: status.right, barRight: bar.right, hits };
  });
  check(`${width}px: a status shows`, place.text.length > 0, JSON.stringify(place));
  if (width > 900) check(`${width}px: it sits above the search bar`, place.bottom <= place.barTop, JSON.stringify(place));
  check(`${width}px: it stays inside the bar's width`, place.right <= place.barRight && place.left >= 0, JSON.stringify(place));
  check(`${width}px: it covers nothing`, place.hits.length === 0, JSON.stringify(place));
  await sized.close();
}

const app = await openApp({ db: DB });
const timing = await app.run(async () => {
  const realSetTimeout = window.setTimeout;
  const realClearTimeout = window.clearTimeout;
  const pending = new Map();
  let nextId = 1;
  window.setTimeout = (fn, ms, ...args) => {
    if (ms !== 30000 && ms !== 600) return realSetTimeout(fn, ms, ...args);
    const id = `t${nextId++}`;
    pending.set(id, { fn, ms });
    return id;
  };
  window.clearTimeout = id => { if (!pending.delete(id)) realClearTimeout(id); };
  const fire = ms => {
    const entry = [...pending].find(([, value]) => value.ms === ms);
    if (!entry) return false;
    pending.delete(entry[0]);
    entry[1].fn();
    return true;
  };
  const line = document.getElementById('searchStatus');
  const search = async text => {
    const input = document.getElementById('idInput');
    input.value = text;
    line.textContent = '';
    document.getElementById('searchForm').requestSubmit();
    const started = Date.now();
    while (Date.now() - started < 4000 && !line.textContent.startsWith('No VPS table matched')) await new Promise(resolve => realSetTimeout(resolve, 20));
  };
  await search('nothing like this');
  const shown = line.textContent;
  const waiting = [...pending.values()].map(value => value.ms);
  // A newer status starts the clock again, so the old timer must not survive.
  await search('still nothing like this');
  const afterSecond = [...pending.values()].filter(value => value.ms === 30000).length;
  const beforeFade = line.classList.contains('is-fading');
  fire(30000);
  const fading = line.classList.contains('is-fading');
  const textWhileFading = line.textContent;
  const opacityRule = getComputedStyle(line).transitionDuration;
  fire(600);
  const after = { text: line.textContent, fading: line.classList.contains('is-fading'), display: getComputedStyle(line).display };
  window.setTimeout = realSetTimeout;
  window.clearTimeout = realClearTimeout;
  return { shown, waiting, afterSecond, beforeFade, fading, textWhileFading, opacityRule, after };
});
check('a status starts a 30 second clock', timing.shown.length > 0 && timing.waiting.includes(30000), JSON.stringify(timing));
check('a new status replaces the old clock', timing.afterSecond === 1, JSON.stringify(timing));
check('it does not fade early', timing.beforeFade === false);
check('after 30 seconds it fades, still showing its text', timing.fading === true && timing.textWhileFading.length > 0, JSON.stringify(timing));
check('the fade is animated', timing.opacityRule === '0.6s', timing.opacityRule);
check('then it clears and takes no space', timing.after.text === '' && !timing.after.fading && timing.after.display === 'none', JSON.stringify(timing.after));

await app.close();

// A real failure may show nowhere else, so it stays until the next status.
const failing = await openApp({ db: DB });
const failure = await failing.run(async () => {
  const realSetTimeout = window.setTimeout;
  const realClearTimeout = window.clearTimeout;
  const clocks = new Set();
  window.setTimeout = (fn, ms, ...args) => {
    const timer = realSetTimeout(fn, ms, ...args);
    if (ms === 30000) clocks.add(timer);
    return timer;
  };
  window.clearTimeout = timer => { clocks.delete(timer); realClearTimeout(timer); };
  window.fetchVPSDB = () => Promise.reject(new Error('The VPS database could not be loaded.'));
  const line = document.getElementById('searchStatus');
  const input = document.getElementById('idInput');
  input.value = 'anything';
  document.getElementById('searchForm').requestSubmit();
  const started = Date.now();
  while (Date.now() - started < 4000 && !line.classList.contains('error')) await new Promise(resolve => realSetTimeout(resolve, 20));
  const waitedFor = line.textContent;
  await new Promise(resolve => realSetTimeout(resolve, 100));
  window.setTimeout = realSetTimeout;
  window.clearTimeout = realClearTimeout;
  return { waitedFor, isError: line.classList.contains('error'), clocks: clocks.size };
});
check('a failed database load is shown as an error', failure.isError && failure.waitedFor.length > 0, JSON.stringify(failure));
check('and no fade is waiting for it', failure.clocks === 0, JSON.stringify(failure));
await failing.close();
report();
