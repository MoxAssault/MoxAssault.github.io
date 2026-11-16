// The URL Override check during a YML import (Jason, 2026-11-15, task 4 of
// the four-change round). Once the file has loaded, every URL Override it
// brought is looked up in VPS: the tabs' in tab order, then each Additional
// ROM's. A match gets the usual "VPS Entry Found" pop-up, one at a time, and
// the import finishes after the last. Use takes the asset as it does for a
// pasted link; Close, Esc or a click outside keeps the URL. A wrong-type
// link gets no pop-up, only its usual blocking error.
//
// Runs the real app in headless Chrome through the scenario runner, with the
// five-table VPS fixture: Pink Floyd is loaded, and the links are Tales from
// the Crypt's.

import { check, report } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, play, PRINT } = await startScenarios();

const TFTC_ROM_URL = 'https://vpuniverse.com/files/file/3941-tales-from-the-crypt-400-unofficial-mod/';
const TFTC_ROM_ID = 's-4c6GqaOn';
// A second ROM link, so the Additional ROM is not the main ROM again.
const VPFORUMS_TFTC_ROM = 'https://www.vpforums.org/index.php?app=downloads&showfile=11340';
const VPFORUMS_ROM_ID = '2Q1pXHma';
const TFTC_B2S_URL = 'https://vpuniverse.com/files/file/26863-tales-from-the-cryp-data-east-1993-alternative-b2s/';
const TFTC_PATCH_URL = 'https://vpuniverse.com/files/file/29799-tales-from-the-crypt-data-east-1993-mod-patch/';
const MD5 = 'E6DF3800F7C9286FA195E84034DA683A';

const yml = lines => ['---', 'tableVPSId: "Lgi1JLk0Vf"', 'vpxVPSId: "qV3Z3oQ8md"', ...lines].join('\n') + '\n';
const additionalRom = url => [
  'additionalRoms:',
  '  - vpsId: ""',
  `    checksum: "${MD5}"`,
  '    versionOverride: "tftc_400"',
  `    urlOverride: "${url}"`
];

// Starts an import through the real file input and returns at once: the
// import now waits on the pop-ups.
const start = text => app.run(text => {
  const input = document.getElementById('ymlImportInput');
  window.__closes = 0;
  const transfer = new DataTransfer();
  transfer.items.add(new File([text], 'case.yml', { type: 'text/yaml' }));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}, text);

// Waits until a card is waiting (the pop-up open, nothing sliding) or the
// import has ended, then says which. Counts the pop-up's closes since the
// import started: a run should close it once, at the end.
const next = () => app.run(async () => {
  const node = () => document.getElementById('urlVpsMatchDialog');
  const title = () => document.querySelector('#ymlImportToast .vps-db-toast-title')?.textContent || '';
  const waiting = () => node()?.open && node().getAnimations({ subtree: true }).length === 0;
  const started = Date.now();
  while (Date.now() - started < 15000 && !waiting() && !/YML loaded|could not be loaded|Import cancelled/.test(title())) {
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  await new Promise(resolve => setTimeout(resolve, 60));
  if (node() && !node().__counted) {
    node().__counted = true;
    node().addEventListener('close', () => { window.__closes += 1; });
  }
  const values = window.VPS_FEATURE_RUNTIME.state.values || {};
  const progress = node()?.querySelector('#urlVpsMatchProgress');
  return {
    closes: window.__closes,
    progress: !!progress && progress.getBoundingClientRect().height > 0,
    dots: [...(node()?.querySelectorAll('.url-vps-match-dot') || [])].map(dot =>
      ['done', 'current', 'waiting'].find(state => dot.classList.contains(`is-${state}`)) + (dot.querySelector('svg') ? '+tick' : '')),
    step: node()?.querySelector('#urlVpsMatchStepShort')?.textContent || '',
    said: node()?.querySelector('#urlVpsMatchStepSaid')?.textContent || '',
    type: node()?.querySelector('#urlVpsMatchType')?.textContent || '',
    closeAll: !!node()?.querySelector('#urlVpsMatchCloseAll')?.getClientRects().length,
    open: node()?.open === true,
    eyebrow: node()?.querySelector('#urlVpsMatchEyebrow')?.textContent || '',
    heading: node()?.querySelector('.url-vps-match-heading')?.textContent || '',
    focused: document.activeElement?.matches?.('[data-url-vps-match-close]') === true,
    focusId: document.activeElement?.id || document.activeElement?.tagName || '',
    toast: title(),
    values: JSON.parse(JSON.stringify({
      romOverride: values.romOverride, romVPSId: values.romVPSId, romUrlOverride: values.romUrlOverride,
      romVersionOverride: values.romVersionOverride, backglassUrlOverride: values.backglassUrlOverride,
      additionalRoms: values.additionalRoms
    })),
    issues: window.VPS_URL_OVERRIDE_LOOKUP.issues().map(issue => issue.fieldName),
    yaml: document.getElementById('previewYaml')?.textContent || ''
  };
});

// Focused first, as a real click or Enter would leave it.
const use = () => app.run(() => {
  const button = document.querySelector('#urlVpsMatchDialog .url-vps-match-use');
  button.focus();
  button.click();
});
const closeButton = () => app.run(() => document.querySelector('#urlVpsMatchDialog [data-url-vps-match-close]').click());
const closeAll = () => app.run(() => document.getElementById('urlVpsMatchCloseAll').click());
// A click outside the pop-up lands on the dialog element itself.
const outside = () => app.run(() => document.getElementById('urlVpsMatchDialog').dispatchEvent(new MouseEvent('click', { bubbles: true })));
// Closes the card, then reads what moves a moment later, mid-slide: each
// running animation's transforms, first frame to last. With stray, it also
// clicks the leaving card's Use straight after, as a quick double click would.
const closeAndWatch = (stray = false) => app.run(async stray => {
  const node = document.getElementById('urlVpsMatchDialog');
  const leavingUse = node.querySelector('.url-vps-match-use');
  node.querySelector('[data-url-vps-match-close]').click();
  if (stray) leavingUse.click();
  await new Promise(resolve => setTimeout(resolve, 40));
  return node.getAnimations({ subtree: true }).map(animation => {
    const frames = animation.effect.getKeyframes();
    return { from: frames[0].transform, to: frames.at(-1).transform, fades: frames[0].opacity !== frames.at(-1).opacity };
  });
}, stray);

if (!PRINT) {
  // 1. Three matches: Backglass, ROM, then the Additional ROM, one at a time.
  await play([]);
  await start(yml([
    `backglassUrlOverride: "${TFTC_B2S_URL}"`,
    `romUrlOverride: "${TFTC_ROM_URL}"`,
    'romVersionOverride: "tftc_400"',
    ...additionalRom(VPFORUMS_TFTC_ROM)
  ]));

  const first = await next();
  check('a matching link in the file opens the pop-up once the file has loaded', first.open && first.eyebrow === 'Backglass URL Override', JSON.stringify(first));
  check('the tabs come in tab order, Backglass first', first.eyebrow === 'Backglass URL Override', first.eyebrow);
  check('the import waits for it', !/YML loaded/.test(first.toast), first.toast);
  check('the keyboard starts on Close, not Use', first.focused, JSON.stringify(first));
  check('the fields are already in behind it', first.values.romUrlOverride === TFTC_ROM_URL, JSON.stringify(first.values));
  check('the counter shows the first of three', first.progress && first.step === '1/3', JSON.stringify(first));
  check('a screen reader hears the full words', first.said === 'Link 1 of 3', first.said);
  check('the badge names the Backglass', first.type === 'Backglass', first.type);
  check('a dot per link, the first current', JSON.stringify(first.dots) === '["current","waiting","waiting"]', JSON.stringify(first.dots));
  check('Close All is offered', first.closeAll, JSON.stringify(first));
  // Squeezed short, as on a small screen or with the dots wrapped: the body
  // scrolls inside the pop-up rather than being cut off at its edge.
  const squeezed = await app.run(() => {
    const node = document.getElementById('urlVpsMatchDialog');
    const body = node.querySelector('#urlVpsMatchBody');
    node.style.maxHeight = '240px';
    const result = {
      inside: body.getBoundingClientRect().bottom <= node.getBoundingClientRect().bottom + 1,
      scrolls: body.scrollHeight > body.clientHeight && getComputedStyle(body).overflowY === 'auto'
    };
    node.style.maxHeight = '';
    return result;
  });
  check('a short pop-up scrolls its body instead of cutting it off', squeezed.inside && squeezed.scrolls, JSON.stringify(squeezed));

  const moving = await closeAndWatch(true);
  check('the answered card slides out to the left as it fades', moving.length > 0 && moving.every(part => part.to === 'translateX(-28px)' && part.fades), JSON.stringify(moving));
  const second = await next();
  check('Close moves on to the next match, the ROM', second.open && second.eyebrow === 'ROM URL Override' && second.heading === `VPSID ${TFTC_ROM_ID}`, JSON.stringify(second));
  check('and Close kept the Backglass URL', second.values.backglassUrlOverride === TFTC_B2S_URL, JSON.stringify(second.values));
  check('a click on Use while the card slides away does nothing', second.values.backglassUrlOverride === TFTC_B2S_URL && second.values.romUrlOverride === TFTC_ROM_URL, JSON.stringify(second.values));
  check('the pop-up stayed open between the two', second.closes === 0, String(second.closes));
  check('the first dot is ticked, the second current', JSON.stringify(second.dots) === '["done+tick","current","waiting"]', JSON.stringify(second.dots));
  check('the counter moved on', second.step === '2/3' && second.said === 'Link 2 of 3', JSON.stringify(second));
  check('and the badge with it, to the ROM', second.type === 'ROM', second.type);
  check('the keyboard is on Close again', second.focused, JSON.stringify(second));

  await use();
  const third = await next();
  check('Use on the ROM takes the asset: Override, its VPSID, the URL and Version gone',
    third.values.romOverride === true && third.values.romVPSId === TFTC_ROM_ID
      && !third.values.romUrlOverride && !third.values.romVersionOverride, JSON.stringify(third.values));
  check('then the Additional ROM is asked about', third.open && third.eyebrow === 'Additional ROM URL Override' && third.heading === `VPSID ${VPFORUMS_ROM_ID}`, JSON.stringify(third));
  check('after Use, whose button went with its card, the keyboard is on Close', third.focused, JSON.stringify(third));
  check('Use moves the counter on too, the pop-up still open', third.step === '3/3' && JSON.stringify(third.dots) === '["done+tick","done+tick","current"]' && third.closes === 0, JSON.stringify(third));

  await use();
  const done = await next();
  check('the pop-up closes once, after the last link', done.closes === 1, String(done.closes));
  check('the keyboard goes back to the Import control, not the page', done.focusId === 'ymlImportInput', done.focusId);
  const rom = done.values.additionalRoms?.[0] || {};
  check('Use on the Additional ROM sets its VPSID and clears its URL and Version Override',
    rom.vpsId === VPFORUMS_ROM_ID && rom.urlOverride === '' && rom.versionOverride === '' && rom.checksum === MD5, JSON.stringify(rom));
  check('and the YML says so', done.yaml.includes(`vpsId: "${VPFORUMS_ROM_ID}"`) && !/urlOverride: "https:\/\/www.vpforums/.test(done.yaml), done.yaml);
  check('after the last pop-up the import finishes', !done.open && done.toast === 'YML loaded for editing', JSON.stringify(done));

  // A link asked about during the import is not asked about again on leaving its box.
  await app.run(async () => {
    document.getElementById('config-tab-b2s')?.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const input = document.getElementById('field-backglassUrlOverride');
    input.focus();
    input.blur();
    await new Promise(resolve => setTimeout(resolve, 200));
  });
  const again = await app.run(() => document.getElementById('urlVpsMatchDialog').open);
  check('a link already asked about does not pop up again on leaving its box', again === false);

  // 2. Esc keeps the URL too, and the import still finishes.
  await play([]);
  await start(yml([`romUrlOverride: "${TFTC_ROM_URL}"`, 'romVersionOverride: "tftc_400"']));
  const asked = await next();
  check('a lone match is asked about', asked.open && asked.eyebrow === 'ROM URL Override', JSON.stringify(asked));
  check('a lone link shows no counter and no Close All', !asked.progress && !asked.closeAll, JSON.stringify(asked));
  await app.pressKey('Escape');
  const kept = await next();
  check('Esc keeps the URL and the import finishes', !kept.open && kept.toast === 'YML loaded for editing'
    && kept.values.romUrlOverride === TFTC_ROM_URL && !kept.values.romVPSId, JSON.stringify(kept));

  const three = yml([
    `backglassUrlOverride: "${TFTC_B2S_URL}"`,
    `romUrlOverride: "${TFTC_ROM_URL}"`,
    'romVersionOverride: "tftc_400"',
    ...additionalRom(VPFORUMS_TFTC_ROM)
  ]);

  // 2b. In a run, Esc and a click outside answer the card and move on; Esc
  // twice in a row as well (Chrome refuses a page only one Esc at the dialog).
  await play([]);
  await start(three);
  await next();
  await app.pressKey('Escape');
  const afterEsc = await next();
  check('Esc in a run moves on to the next link', afterEsc.open && afterEsc.step === '2/3' && afterEsc.closes === 0, JSON.stringify(afterEsc));
  await app.pressKey('Escape');
  const afterTwo = await next();
  check('and a second Esc in a row moves on again', afterTwo.open && afterTwo.step === '3/3' && afterTwo.closes === 0, JSON.stringify(afterTwo));
  await outside();
  const afterOutside = await next();
  check('a click outside answers the last link and the import finishes', !afterOutside.open && afterOutside.toast === 'YML loaded for editing', JSON.stringify(afterOutside));
  check('every URL is kept', afterOutside.values.backglassUrlOverride === TFTC_B2S_URL && afterOutside.values.romUrlOverride === TFTC_ROM_URL
    && afterOutside.values.additionalRoms?.[0]?.urlOverride === VPFORUMS_TFTC_ROM, JSON.stringify(afterOutside.values));

  // 2c. Close All, after one card with reduced motion asked for: a fade, no slide.
  await play([]);
  await app.run(() => {
    window.__realMatchMedia = window.matchMedia;
    window.matchMedia = query => /prefers-reduced-motion: reduce/.test(query)
      ? { matches: true, media: query, addEventListener() {}, removeEventListener() {} }
      : window.__realMatchMedia(query);
  });
  await start(three);
  await next();
  const fading = await closeAndWatch();
  await app.run(() => { window.matchMedia = window.__realMatchMedia; });
  check('with reduced motion the cards fade without moving', fading.length > 0 && fading.every(part => part.fades && part.to === 'none'), JSON.stringify(fading));
  const before = await next();
  await closeAll();
  const allClosed = await next();
  check('Close All ends the run and the import finishes', before.step === '2/3' && !allClosed.open && allClosed.closes === 1
    && allClosed.toast === 'YML loaded for editing', JSON.stringify(allClosed));

  // 2d. Close All on the first card: the ROM link is never shown, and is
  // still not asked about later.
  await play([]);
  await start(three);
  await next();
  await closeAll();
  await next();
  check('Close All keeps every URL not yet answered', allClosed.values.romUrlOverride === TFTC_ROM_URL && allClosed.values.romVersionOverride === 'tftc_400'
    && allClosed.values.additionalRoms?.[0]?.urlOverride === VPFORUMS_TFTC_ROM && allClosed.values.backglassUrlOverride === TFTC_B2S_URL, JSON.stringify(allClosed.values));
  await app.run(async () => {
    document.getElementById('config-tab-rom')?.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const input = document.getElementById('field-romUrlOverride');
    input?.focus();
    input?.blur();
    await new Promise(resolve => setTimeout(resolve, 200));
  });
  const reasked = await app.run(() => document.getElementById('urlVpsMatchDialog').open);
  check('a link Close All passed over does not pop up on leaving its box', reasked === false);

  // 3. A wrong-type link: no pop-up, the usual blocking error.
  await play([]);
  await start(yml([`romUrlOverride: "${TFTC_PATCH_URL}"`, 'romVersionOverride: "tftc_400"']));
  const wrong = await next();
  check('a wrong-type link gets no pop-up, and the import finishes', !wrong.open && wrong.toast === 'YML loaded for editing', JSON.stringify(wrong));
  check('it is blocked as before', wrong.issues.includes('romUrlOverride'), JSON.stringify(wrong.issues));

  // 4. No URL Overrides: nothing is asked.
  await play([]);
  await start(yml([`romVPSId: "jgo91P3SSp"`]));
  const plain = await next();
  check('a file with no URL Overrides loads without a pop-up', !plain.open && plain.toast === 'YML loaded for editing', JSON.stringify(plain));

  // 5. An Additional ROM alone, Close: its URL stays.
  await play([]);
  await start(yml(['romVPSId: "jgo91P3SSp"', ...additionalRom(TFTC_ROM_URL)]));
  const romOnly = await next();
  check('an Additional ROM link is checked even with no other URL Override', romOnly.open && romOnly.eyebrow === 'Additional ROM URL Override', JSON.stringify(romOnly));
  await closeButton();
  const romKept = await next();
  const keptRom = romKept.values.additionalRoms?.[0] || {};
  check('Close keeps the Additional ROM\'s URL and Version Override', keptRom.urlOverride === TFTC_ROM_URL && keptRom.versionOverride === 'tftc_400' && !keptRom.vpsId
    && romKept.toast === 'YML loaded for editing', JSON.stringify(romKept));

  // 6. The check is an extra: if it fails, the file has still loaded.
  await play([]);
  await app.run(() => {
    window.__realLookup = window.VPS_URL_OVERRIDE_LOOKUP;
    window.VPS_URL_OVERRIDE_LOOKUP = { ...window.__realLookup, checkImported: async () => { throw new Error('check broke'); } };
  });
  await start(yml([`romUrlOverride: "${TFTC_ROM_URL}"`, 'romVersionOverride: "tftc_400"']));
  const broken = await next();
  await app.run(() => { window.VPS_URL_OVERRIDE_LOOKUP = window.__realLookup; });
  check('a fault in the check does not fail an import that loaded', broken.toast === 'YML loaded for editing' && broken.values.romUrlOverride === TFTC_ROM_URL, JSON.stringify(broken));

  const unexpected = app.errors.filter(error => !/Unable to preload the VPS database/.test(error));
  check('no page errors', unexpected.length === 0, unexpected.join(' | '));
}

await app.close();
report('yml-import-url-check');
