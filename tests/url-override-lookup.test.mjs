// The URL Override check (Jason, 2026-10-27; queue note "URL override lookup
// against VPSDB"; redesigned with him 2026-10-30). On leaving a URL Override
// box on a row with a Manual VPSID box (Backglass, ROM, Color ROM, Alt Sound):
// - a link an asset of the row's own type carries opens a pop-up, whose
//   "Use this Asset ID?" button moves the VPSID into the Manual VPSID box and
//   clears the URL;
// - a link only other types carry is a blocking error;
// - any other link: nothing.
// DMD and VPU Patch have no check. Links match after the tidying Jason chose:
// http/https, host letter case, a leading www., a trailing slash (after the
// path or the query) and a #fragment are ignored; the ?query and the path's
// letter case are not.
//
// Runs the real app in headless Chrome through the scenario runner, with the
// five-table VPS fixture. Pink Floyd is loaded; the other links belong to
// Tales from the Crypt and its neighbours.

import { readFileSync } from 'node:fs';
import { check, report, repoPath } from './harness.mjs';
import { openApp } from './browser.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, play, PRINT } = await startScenarios();

const settleSource = `() => new Promise(resolve => {
  const frames = n => n ? requestAnimationFrame(() => frames(n - 1)) : setTimeout(resolve, 0);
  frames(3);
})`;

const MD5_VPX = 'E6DF3800F7C9286FA195E84034DA683A';
const PINK_FLOYD = [
  ['search', 'Lgi1JLk0Vf'], ['asset', 'tableFiles', 'qV3Z3oQ8md'],
  ['fill', 'fps', '60'], ['fill', 'testers', 'Tester'], ['fill', 'vpxChecksum', MD5_VPX]
];

// Links as the fixture holds them.
const TFTC_ROM_URL = 'https://vpuniverse.com/files/file/3941-tales-from-the-crypt-400-unofficial-mod/';
const TFTC_B2S_URL = 'https://vpuniverse.com/files/file/26863-tales-from-the-cryp-data-east-1993-alternative-b2s/';
const TFTC_PATCH_URL = 'https://vpuniverse.com/files/file/29799-tales-from-the-crypt-data-east-1993-mod-patch/';
const VPFORUMS_TFTC_ROM = 'https://www.vpforums.org/index.php?app=downloads&showfile=11340';
const WRONG_TYPE = 'This link is currently active on VPS, but not for this asset type. Type: ';

// Everything a check needs: the pop-up, the box, its error, the build.
const lookSource = `async ([field, settleText]) => {
  await eval(settleText)();
  const node = document.getElementById('urlVpsMatchDialog');
  const input = document.getElementById('field-' + field);
  const step = window.VPS_YML_FIELDS.WIZARD_STEPS.find(s => s.fields.some(f => f.yml_field === field));
  const error = input?.closest('.field')?.querySelector('.url-vps-match-error');
  const yaml = document.getElementById('previewYaml').textContent.split('\\n');
  return {
    open: node?.open === true,
    eyebrow: node?.querySelector('#urlVpsMatchEyebrow')?.textContent || '',
    title: node?.querySelector('#urlVpsMatchTitle')?.textContent || '',
    intro: node?.querySelector('.url-vps-match-intro')?.textContent || '',
    advice: node?.querySelector('.url-vps-match-advice')?.textContent || '',
    // The close icon: drawn, and centred in its button (Jason, 2026-10-30).
    close: (() => {
      const button = node?.querySelector('[data-url-vps-match-close]');
      const icon = button?.querySelector('svg');
      if (!button || !icon) return null;
      const a = button.getBoundingClientRect();
      const b = icon.getBoundingClientRect();
      return {
        stroke: getComputedStyle(icon).stroke,
        size: Math.round(b.width),
        offX: Math.abs((a.left + a.width / 2) - (b.left + b.width / 2)),
        offY: Math.abs((a.top + a.height / 2) - (b.top + b.height / 2))
      };
    })(),
    // The ID in the title, styled as the table card's.
    idStyle: (() => {
      const id = node?.querySelector('#urlVpsMatchTitle .url-vps-match-id');
      if (!id) return null;
      const style = getComputedStyle(id);
      return { text: id.textContent, mono: /JetBrains Mono/.test(style.fontFamily), weight: style.fontWeight, code: !!node.querySelector('#urlVpsMatchTitle code') };
    })(),
    thumbs: window.__urlVpsThumbs || [],
    headings: [...(node?.querySelectorAll('.url-vps-match-heading') || [])].map(n => n.textContent),
    names: [...(node?.querySelectorAll('.url-vps-match-name') || [])].map(n => n.textContent),
    details: [...(node?.querySelectorAll('.url-vps-match-details') || [])].map(n => n.textContent),
    useTip: node?.querySelector('.url-vps-match-use')?.dataset.tooltip || '',
    useLabel: node?.querySelector('.url-vps-match-use')?.getAttribute('aria-label') || '',
    active: document.activeElement?.id || document.activeElement?.className || '',
    activeIsClose: document.activeElement?.hasAttribute?.('data-url-vps-match-close') === true,
    invalid: input?.getAttribute('aria-invalid') || '',
    label: input?.getAttribute('aria-label') || '',
    value: input?.value ?? null,
    saved: window.VPS_FEATURE_RUNTIME.state.values[field] ?? '',
    error: error?.textContent || '',
    tab: document.getElementById('config-tab-' + step?.id)?.getAttribute('aria-label') || '',
    issues: window.VPS_VALIDATION.collectAllErrors(window.VPS_MAIN.validationContext())
      .filter(issue => issue.stepId === step?.id).map(issue => issue.title + ': ' + issue.message),
    yaml: yaml.filter(line => /VPSId|UrlOverride/.test(line))
  };
}`;

const look = (field = 'romUrlOverride') => app.run(eval(lookSource), [field, settleSource]);

// Types into the box with real keys and leaves it with Tab, as a user does.
async function enter(value, field = 'romUrlOverride') {
  await app.run(field => {
    const input = document.getElementById('field-' + field);
    input.focus();
    input.select();
  }, field);
  if (value) await app.typeText(value);
  else await app.pressKey('Backspace');
  await app.pressKey('Tab');
  await app.run(eval(settleSource));
}

const closeDialog = () => app.run(async settleText => {
  document.querySelector('#urlVpsMatchDialog [data-url-vps-match-close]').click();
  await eval(settleText)();
}, settleSource);

// Pictures are recorded as they are drawn, as one that fails to load is
// taken away again.
const watchThumbs = () => app.run(() => {
  window.__urlVpsThumbs = [];
  if (window.__urlVpsThumbWatch) return;
  window.__urlVpsThumbWatch = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    // Each asset as it is put in the pop-up, counted once.
    const image = node.nodeType === 1 && node.matches('.url-vps-match-asset') ? node.firstElementChild : null;
    if (image?.matches('img.url-vps-match-thumb')) window.__urlVpsThumbs.push(image.getAttribute('src'));
  })));
  window.__urlVpsThumbWatch.observe(document.body, { childList: true, subtree: true });
});

const blocking = issues => issues.filter(line => line.startsWith('URL Override is for another asset type'));

if (!PRINT) {
  // 1. The tidying rule, straight from the module.
  const keys = await app.run(() => {
    const key = window.VPS_URL_OVERRIDE_LOOKUP.urlKey;
    return {
      sameAcrossTidying: new Set([
        'https://vpuniverse.com/files/file/3941-x/',
        'http://vpuniverse.com/files/file/3941-x',
        'https://WWW.VPUniverse.com/files/file/3941-x//',
        'https://vpuniverse.com/files/file/3941-x/#comments',
        '  vpuniverse.com/files/file/3941-x/  '
      ].map(key)).size,
      queryKept: key('https://a.com/f?id=1') !== key('https://a.com/f?id=2'),
      // Found by Jason on 2026-10-30: the slash after a query was kept.
      querySlash: key('http://www.vpforums.org/index.php?app=downloads&showfile=14159/') === key('https://vpforums.org/index.php?app=downloads&showfile=14159'),
      pathCaseKept: key('https://bit.ly/POVs_RaJo') !== key('https://bit.ly/povs_rajo'),
      empty: [key(''), key('   '), key('ftp://a.com/f'), key('http://')].every(value => value === ''),
      fields: window.VPS_URL_OVERRIDE_LOOKUP.URL_FIELDS.map(spec => spec.name).join(',')
    };
  });
  check('http/https, host case, www., trailing slashes, #fragments and spaces are ignored', keys.sameAcrossTidying === 1, JSON.stringify(keys));
  check('the ?query still tells two links apart', keys.queryKept === true, JSON.stringify(keys));
  check('a slash typed after the ?query is ignored too', keys.querySlash === true, JSON.stringify(keys));
  check('the path keeps its letter case', keys.pathCaseKept === true, JSON.stringify(keys));
  check('an empty, non-web or broken link has no key', keys.empty === true, JSON.stringify(keys));
  check('only the four rows with a Manual VPSID box are checked, not DMD or VPU Patch',
    keys.fields === 'backglassUrlOverride,romUrlOverride,coloredROMUrlOverride,altSoundUrlOverride', keys.fields);

  // 2. Another table's ROM, typed loosely: the pop-up.
  await play([...PINK_FLOYD, ['override', 'romFiles', true], ['fill', 'romUrlOverride', '']]);
  await watchThumbs();
  await enter('http://vpuniverse.com/files/file/3941-tales-from-the-crypt-400-unofficial-mod');
  const found = await look();
  check('leaving the box with a ROM link VPS has opens the pop-up', found.open === true && found.eyebrow === 'ROM URL Override', JSON.stringify(found));
  check('its title reads "VPS Entry Found | {id}"', found.title === 'VPS Entry Found | s-4c6GqaOn' && found.headings.length === 0, JSON.stringify(found));
  check('then "The link provided was found in VPSDB.", and the line saying to use the VPSID',
    found.intro === 'The link provided was found in VPSDB.'
    && found.advice === 'If this is the correct asset, please use the associated VPSID instead of the URL.', JSON.stringify(found));
  check('the close button shows its drawn ×, centred within a pixel',
    found.close && found.close.stroke !== 'none' && found.close.size === 14 && found.close.offX <= 1 && found.close.offY <= 1, JSON.stringify(found.close));
  check('the VPSID is plain monospace, as the table card shows IDs',
    found.idStyle && found.idStyle.text === 's-4c6GqaOn' && found.idStyle.mono && found.idStyle.weight === '400' && !found.idStyle.code, JSON.stringify(found.idStyle));
  check('a ROM has no picture on VPS, so none is drawn', found.thumbs.length === 0, JSON.stringify(found));
  check('then the asset: table, type, version and author',
    found.names[0] === 'Tales from the Crypt · ROM' && found.details[0] === 'vtftc_400 · by CarnyPriest', JSON.stringify(found));
  check('the Use button says "Use this Asset ID?" and names what it does',
    found.useTip === 'Use this Asset ID?' && /Use VPSID s-4c6GqaOn as the ROM Manual VPSID/.test(found.useLabel), JSON.stringify(found));
  // Close, not Use: a stray Enter keeps the URL rather than clearing it.
  check('the keyboard starts on Close', found.activeIsClose === true, JSON.stringify(found));
  check('a right-type match does not block', blocking(found.issues).length === 0 && found.error === '', JSON.stringify(found));

  // 3. Copy, in the pop-up: copies, says so, and says when it could not.
  const copied = await app.run(async settleText => {
    const settle = eval(settleText);
    let written = null;
    navigator.clipboard.writeText = async text => { written = text; };
    const button = document.querySelector('#urlVpsMatchDialog .url-vps-match-copy');
    button.click();
    await settle();
    const ok = { written, tip: button.dataset.tooltip, label: button.getAttribute('aria-label') };
    await new Promise(r => setTimeout(r, 1200));
    navigator.clipboard.writeText = async () => { throw new Error('denied'); };
    button.click();
    await settle();
    const box = button.getBoundingClientRect();
    return { ok, failTip: button.dataset.tooltip, failLabel: button.getAttribute('aria-label'), green: button.classList.contains('copied'), size: [Math.round(box.width), Math.round(box.height)] };
  }, settleSource);
  check('the copy button copies the VPSID and says Copied', copied.ok.written === 's-4c6GqaOn' && copied.ok.tip === 'Copied' && copied.ok.label === 'Copied VPSID s-4c6GqaOn', JSON.stringify(copied));
  check('a refused clipboard says Copy failed, not Copied', copied.failTip === 'Copy failed' && copied.failLabel === 'Copy failed for VPSID s-4c6GqaOn' && copied.green === false, JSON.stringify(copied));
  check('the copy button is a 24px target', copied.size[0] === 24 && copied.size[1] === 24, JSON.stringify(copied));

  // 4. Closing keeps the URL, and leaving the box again does not reopen it.
  await closeDialog();
  const closed = await look();
  check('closing keeps the URL and returns the keyboard to the page', closed.open === false && closed.saved.includes('3941-tales-from-the-crypt') && closed.active !== '', JSON.stringify(closed));
  await app.run(() => { document.getElementById('field-romUrlOverride').focus(); });
  await app.pressKey('Tab');
  check('leaving the box with the same link does not reopen it', (await look()).open === false);

  // 5. Use: the ID goes to the Manual VPSID box and the URL goes.
  await enter(VPFORUMS_TFTC_ROM);
  const second = await look();
  check('a different matching link opens its own pop-up', second.open === true && second.title === 'VPS Entry Found | 2Q1pXHma', JSON.stringify(second));
  await app.run(async settleText => {
    document.querySelector('#urlVpsMatchDialog .url-vps-match-use').click();
    await eval(settleText)();
  }, settleSource);
  const used = await look();
  const box = await app.run(() => ({
    manual: document.getElementById('manualVpsId-romFiles')?.value || '',
    focused: document.activeElement?.id || '',
    id: window.VPS_FEATURE_RUNTIME.state.values.romVPSId
  }));
  check('Use closes the pop-up and clears the URL', used.open === false && used.saved === '' && used.value === '', JSON.stringify(used));
  check('the ID is now the Manual VPSID, and the keyboard is in its box',
    box.manual === '2Q1pXHma' && box.id === '2Q1pXHma' && box.focused === 'manualVpsId-romFiles', JSON.stringify(box));
  check('the YML has the ID and no URL Override',
    used.yaml.includes('romVPSId: "2Q1pXHma"') && !used.yaml.some(line => line.startsWith('romUrlOverride')), used.yaml.join('\n'));

  // 5b. Found by Jason on 2026-10-30: emptying the box and pasting a link
  // while staying in it opened nothing, as the check only ran on leaving.
  const pasted = await app.run(async ([settleText, url]) => {
    const settle = eval(settleText);
    const input = document.getElementById('field-romUrlOverride');
    input.focus();
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    // As the browser does it: the paste event, then the text, then input.
    input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true }));
    input.value = url;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    await settle();
    const node = document.getElementById('urlVpsMatchDialog');
    const result = { open: node.open === true, title: node.querySelector('#urlVpsMatchTitle').textContent };
    node.querySelector('[data-url-vps-match-close]').click();
    await settle();
    result.back = document.activeElement?.id || '';
    return result;
  }, [settleSource, VPFORUMS_TFTC_ROM]);
  check('pasting a matching link opens the pop-up without leaving the box',
    pasted.open === true && pasted.title === 'VPS Entry Found | 2Q1pXHma', JSON.stringify(pasted));
  check('and closing it puts the keyboard back in the box', pasted.back === 'field-romUrlOverride', JSON.stringify(pasted));

  // 6. Use without Override ticked: the row's own asset picked, a URL typed.
  await play([...PINK_FLOYD, ['asset', 'romFiles', 'jgo91P3SSp'], ['fill', 'romUrlOverride', '']]);
  await enter(TFTC_ROM_URL);
  await app.run(async settleText => {
    document.querySelector('#urlVpsMatchDialog .url-vps-match-use').click();
    await eval(settleText)();
  }, settleSource);
  const ticked = await app.run(() => ({
    override: window.VPS_FEATURE_RUNTIME.state.values.romOverride,
    manual: document.getElementById('manualVpsId-romFiles')?.value || '',
    url: window.VPS_FEATURE_RUNTIME.state.values.romUrlOverride ?? ''
  }));
  check('without Override, Use ticks it, fills the box and clears the URL',
    ticked.override === true && ticked.manual === 's-4c6GqaOn' && ticked.url === '', JSON.stringify(ticked));

  // 7. A link VPS lists only as another type: a blocking error, no pop-up.
  await play([...PINK_FLOYD, ['override', 'romFiles', true], ['fill', 'romUrlOverride', '']]);
  await enter(TFTC_B2S_URL);
  const wrong = await look();
  check('a Backglass link in the ROM box opens no pop-up', wrong.open === false, JSON.stringify(wrong));
  check('it shows the wrong-type message under the box', wrong.error === WRONG_TYPE + 'Backglass', JSON.stringify(wrong));
  check('and it blocks, on the URL field', blocking(wrong.issues).includes('URL Override is for another asset type: ' + WRONG_TYPE + 'Backglass'), wrong.issues.join('\n'));
  // The app's way for a feature error: the message joins the box's own label.
  check('a screen reader hears it: the box is invalid and its label carries the error',
    wrong.invalid === 'true' && wrong.label.includes(WRONG_TYPE + 'Backglass'), JSON.stringify(wrong));
  const refused = await app.run(async settleText => {
    document.getElementById('downloadBtn').click();
    await eval(settleText)();
    const open = document.getElementById('validationDialog').open;
    document.getElementById('validationDialog').close();
    return open;
  }, settleSource);
  check('Download is refused while it stands', refused === true);
  await enter(TFTC_PATCH_URL);
  check('a patch link in the ROM box is named a VPU Patch', (await look()).error === WRONG_TYPE + 'VPU Patch');

  // 8. While typing, the error steps aside; it is a check on leaving.
  await app.run(() => {
    const input = document.getElementById('field-romUrlOverride');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });
  await app.typeText('x');
  check('while typing in the box there is no error line', (await look()).error === '');
  await app.pressKey('Backspace');
  await app.pressKey('Tab');
  check('leaving brings it back', (await look()).error === WRONG_TYPE + 'VPU Patch');

  // 9. A reload: the saved wrong-type link still blocks.
  await app.run(() => new Promise(resolve => setTimeout(resolve, 450)));
  await app.reload();
  const reloaded = await app.run(async ([settleText, lookText]) => {
    for (let i = 0; i < 200 && !document.getElementById('config-tab-rom'); i += 1) await new Promise(r => setTimeout(r, 25));
    if (document.querySelector('.config-tab-panel')?.dataset.step !== 'rom') document.getElementById('config-tab-rom').click();
    await new Promise(r => setTimeout(r, 300));
    return eval(lookText)(['romUrlOverride', settleText]);
  }, [settleSource, lookSource]);
  check('after a reload the saved wrong-type link still blocks, with no pop-up',
    reloaded.error === WRONG_TYPE + 'VPU Patch' && blocking(reloaded.issues).length === 1 && reloaded.open === false, JSON.stringify(reloaded));
  // The database loads after the page has drawn its tabs, so their counts
  // are drawn again once the check can fail.
  check('the ROM tab counts it, once the database is in',
    reloaded.tab === 'ROM: ' + reloaded.issues.length + ' error' + (reloaded.issues.length === 1 ? '' : 's'), JSON.stringify(reloaded));

  // 10. A link nothing carries, and an emptied box: nothing at all.
  await enter('https://example.com/my-own-rom.zip');
  const none = await look();
  check('a link no asset carries: no pop-up, no error', none.open === false && none.error === '' && blocking(none.issues).length === 0, JSON.stringify(none));
  await enter(VPFORUMS_TFTC_ROM.replace('11340', '11341'));
  check('another vpforums showfile number matches nothing', (await look()).open === false);

  // 11. The VPU Patch and DMD rows have no check.
  await play([...PINK_FLOYD, ['override', 'vpuPatchFiles', true], ['fill', 'diffUrlOverride', '']]);
  await enter(TFTC_PATCH_URL, 'diffUrlOverride');
  const patch = await look('diffUrlOverride');
  check('a patch link on the VPU Patch tab opens nothing', patch.open === false && patch.error === '', JSON.stringify(patch));
  await enter(TFTC_B2S_URL, 'diffUrlOverride');
  const patchWrong = await look('diffUrlOverride');
  check('nor does a wrong-type link there block', patchWrong.error === '' && blocking(patchWrong.issues).length === 0, JSON.stringify(patchWrong));

  // 12. The Backglass row has it too.
  await play([...PINK_FLOYD, ['override', 'b2sFiles', true], ['fill', 'backglassUrlOverride', '']]);
  await watchThumbs();
  await enter(TFTC_B2S_URL, 'backglassUrlOverride');
  const b2s = await look('backglassUrlOverride');
  check('a Backglass link on the Backglass tab opens its pop-up', b2s.open === true && b2s.names[0] === 'Tales from the Crypt · Backglass', JSON.stringify(b2s));
  check('with the Backglass picture to the left of its details',
    b2s.thumbs.length === 1 && /\/img\/Pr7aybcEBQ_/.test(b2s.thumbs[0]), JSON.stringify(b2s));
  const broken = await app.run(async settleText => {
    const image = document.querySelector('#urlVpsMatchDialog img.url-vps-match-thumb');
    if (!image) return 'already gone';
    image.dispatchEvent(new Event('error'));
    await eval(settleText)();
    return document.querySelector('#urlVpsMatchDialog img.url-vps-match-thumb') ? 'still there' : 'removed';
  }, settleSource);
  check('a picture that will not load is taken away, not left broken', broken !== 'still there', broken);
  await closeDialog();

  check('no page errors', app.errors.filter(error => !/Unable to preload the VPS database/.test(error)).length === 0, app.errors.join('\n'));
}

await app.close();

// 13. Its own page: the first database load fails and leaving the box again
// retries; and Pink Floyd's ROM is given the Tales from the Crypt ROM's link,
// so two ROMs carry it and this table's comes first.
if (!PRINT) {
  const db = JSON.parse(readFileSync(repoPath('fixtures', 'vpsdb-five.json'), 'utf8'));
  const records = Array.isArray(db) ? db : db.tables;
  records.find(record => record.id === 'Lgi1JLk0Vf').romFiles[0].urls.push({ url: TFTC_ROM_URL });
  // AC/DC sorts before Pink Floyd, so only the own-table rule puts Pink Floyd first.
  records.find(record => record.id === 'pJJOvLweWw').romFiles[0].urls.push({ url: TFTC_ROM_URL });
  const extra = await openApp({ db, windowSize: [1400, 900] });
  const shared = await extra.run(async settleText => {
    const settle = eval(settleText);
    const wait = async test => { for (let i = 0; i < 200 && !test(); i += 1) await new Promise(r => setTimeout(r, 25)); };
    document.getElementById('idInput').value = 'Lgi1JLk0Vf';
    document.getElementById('searchForm').requestSubmit();
    await wait(() => !document.getElementById('workspace').hidden);
    await settle();
    const vpx = document.querySelector('#assetMatrix .asset-row[data-category="tableFiles"] select');
    vpx.value = 'qV3Z3oQ8md';
    vpx.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const override = document.querySelector('#assetMatrix .asset-row[data-category="romFiles"] .override-toggle input');
    if (!override.checked) override.click();
    await settle();
    if (document.querySelector('.config-tab-panel')?.dataset.step !== 'rom') document.getElementById('config-tab-rom').click();
    await settle();
    const input = document.getElementById('field-romUrlOverride');
    if (!input) return { error: 'no ROM URL box' };
    const realFetch = window.fetchVPSDB;
    window.fetchVPSDB = () => { window.fetchVPSDB = realFetch; return Promise.reject(new Error('offline')); };
    input.focus();
    input.value = 'https://vpuniverse.com/files/file/3941-tales-from-the-crypt-400-unofficial-mod/';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.blur();
    await new Promise(r => setTimeout(r, 300));
    await settle();
    const node = () => document.getElementById('urlVpsMatchDialog');
    const offline = node()?.open === true;
    input.focus();
    input.blur();
    await new Promise(r => setTimeout(r, 300));
    await settle();
    return {
      offline,
      open: node()?.open === true,
      title: node()?.querySelector('#urlVpsMatchTitle')?.textContent || '',
      advice: node()?.querySelector('.url-vps-match-advice')?.textContent || '',
      uses: node()?.querySelectorAll('.url-vps-match-asset .url-vps-match-use').length || 0,
      headings: [...(node()?.querySelectorAll('.url-vps-match-heading') || [])].map(n => n.textContent),
      names: [...(node()?.querySelectorAll('.url-vps-match-name') || [])].map(n => n.textContent)
    };
  }, settleSource);
  check('with the database down there is no pop-up and no page error', shared.offline === false && extra.errors.length === 0, JSON.stringify({ shared, errors: extra.errors }));
  check('leaving the box again retries the database and opens the pop-up', shared.open === true, JSON.stringify(shared));
  check('ROMs sharing the link are all listed, this table\'s first, then by name',
    shared.names.join(' | ') === 'Pink Floyd · ROM | AC/DC (Pro Vault Edition) · ROM | Tales from the Crypt · ROM'
    && shared.headings[0] === 'VPSID jgo91P3SSp', JSON.stringify(shared));
  check('with several, the title says Entries and each asset has its own ID and Use',
    shared.title === 'VPS Entries Found' && shared.uses === 3
    && shared.advice === 'If one of these is the correct asset, please use its VPSID instead of the URL.', JSON.stringify(shared));
  await extra.close();
}

report('url-override-lookup');
