// The URL Override check, piece 2: the Additional ROM editor (Jason,
// 2026-10-30; queue note "URL override lookup against VPSDB"; plan approved
// 2026-10-31). On leaving the editor's URL Override box, or pasting into it:
// - a link a VPS ROM carries shows a card under the box (the editor is
//   already a dialog), whose Use swaps the ROM dropdown for a Manual VPSID box
//   holding the ID and clears the URL and its Version Override;
// - a link only other asset types carry is a red line under the box, and
//   Save ROM refuses it;
// - any other link: nothing.
// The ID is saved in the entry's own vpsId. An ID that is not one of this
// table's ROMs is accepted when VPS has it as a ROM, and opens in the box.
//
// Runs the real app in headless Chrome with the five-table VPS fixture. Pink
// Floyd is loaded, with its one ROM as the primary; the links belong to
// Tales from the Crypt.

import { check, report } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, play, PRINT } = await startScenarios();

const settleSource = `() => new Promise(resolve => {
  const frames = n => n ? requestAnimationFrame(() => frames(n - 1)) : setTimeout(resolve, 0);
  frames(3);
})`;
const settle = () => app.run(eval(settleSource));

const MD5_VPX = 'E6DF3800F7C9286FA195E84034DA683A';
const MD5_ADD = '0123456789ABCDEF0123456789ABCDEF';
const PINK_FLOYD = [
  ['search', 'Lgi1JLk0Vf'], ['asset', 'tableFiles', 'qV3Z3oQ8md'],
  ['fill', 'fps', '60'], ['fill', 'testers', 'Tester'], ['fill', 'vpxChecksum', MD5_VPX],
  ['asset', 'romFiles', 'jgo91P3SSp'], ['fill', 'romUrlOverride', '']
];

const TFTC_ROM_URL = 'https://vpuniverse.com/files/file/3941-tales-from-the-crypt-400-unofficial-mod/';
const TFTC_B2S_URL = 'https://vpuniverse.com/files/file/26863-tales-from-the-cryp-data-east-1993-alternative-b2s/';
const VPFORUMS_TFTC_ROM = 'https://www.vpforums.org/index.php?app=downloads&showfile=11340';
const WRONG_TYPE = 'This link is currently active on VPS, but not for this asset type. Type: ';

// Everything a check needs from the editor.
const lookSource = `async settleText => {
  await eval(settleText)();
  const node = document.getElementById('additionalRomDialog');
  const card = node?.querySelector('.url-vps-match-card');
  const vpsField = node?.querySelector('#additionalRomVpsField');
  const select = node?.querySelector('#additionalRomVpsId');
  const manual = node?.querySelector('#additionalRomManualVpsId');
  const shown = el => !!el && el.getClientRects().length > 0;
  const focusables = card ? [...card.querySelectorAll('button')].map(b =>
    b.classList.contains('url-vps-match-copy') ? 'copy' : b.classList.contains('url-vps-match-use') ? 'use'
      : b.classList.contains('url-vps-match-card-close') ? 'close' : b.className) : [];
  const urlWrap = node?.querySelector('#additionalRomUrlOverride')?.closest('.field');
  return {
    open: node?.open === true,
    popup: document.getElementById('urlVpsMatchDialog')?.open === true,
    card: !!card,
    cardInUrlField: !!card && card.parentElement === urlWrap,
    title: card?.querySelector('.url-vps-match-card-title')?.textContent || '',
    intro: card?.querySelector('.url-vps-match-intro')?.textContent || '',
    advice: card?.querySelector('.url-vps-match-advice')?.textContent || '',
    names: [...(card?.querySelectorAll('.url-vps-match-name') || [])].map(n => n.textContent),
    details: [...(card?.querySelectorAll('.url-vps-match-details') || [])].map(n => n.textContent),
    tabOrder: focusables,
    useTip: card?.querySelector('.url-vps-match-use')?.dataset.tooltip || '',
    useLabel: card?.querySelector('.url-vps-match-use')?.getAttribute('aria-label') || '',
    closeCorner: (() => {
      const close = card?.querySelector('.url-vps-match-card-close');
      if (!close) return null;
      const a = card.getBoundingClientRect();
      const b = close.getBoundingClientRect();
      const icon = close.querySelector('svg')?.getBoundingClientRect();
      return { top: Math.round(b.top - a.top), right: Math.round(a.right - b.right), icon: icon ? Math.round(icon.width) : 0 };
    })(),
    error: urlWrap?.querySelector('.url-vps-match-error')?.textContent || '',
    describedBy: node?.querySelector('#additionalRomUrlOverride')?.getAttribute('aria-describedby') || '',
    status: node?.querySelector('#additionalRomUrlStatus')?.textContent || '',
    url: node?.querySelector('#additionalRomUrlOverride')?.value ?? null,
    version: node?.querySelector('#additionalRomVersionOverride')?.value ?? null,
    manualMode: vpsField?.classList.contains('is-manual') === true,
    selectShown: shown(select),
    manualShown: shown(manual),
    manualValue: manual?.value ?? null,
    manualLabel: node?.querySelector('#additionalRomManualLabel')?.textContent || '',
    manualLabelError: node?.querySelector('#additionalRomManualLabel')?.classList.contains('is-error') === true,
    vpsDot: vpsField?.querySelector(':scope > .field-error-dot')?.getAttribute('aria-label') || '',
    urlDot: urlWrap?.querySelector(':scope > .field-error-dot')?.getAttribute('aria-label') || '',
    active: document.activeElement?.id || document.activeElement?.className || '',
    saved: window.VPS_FEATURE_RUNTIME.state.values.additionalRoms || [],
    issues: window.VPS_VALIDATION.collectAllErrors(window.VPS_MAIN.validationContext())
      .filter(issue => issue.fieldName === 'additionalRoms').map(issue => issue.message),
    badge: document.querySelector('.additional-rom-indicator')?.dataset.tooltip || '',
    yaml: document.getElementById('previewYaml').textContent
  };
}`;
const look = () => app.run(eval(lookSource), settleSource);

async function openEditor() {
  await app.run(async settleText => {
    const panel = document.getElementById('config-panel-rom');
    const button = panel.querySelector('.additional-rom-indicator') || panel.querySelector('.additional-rom-add');
    button.click();
    await eval(settleText)();
  }, settleSource);
}

// Real keys into a box of the editor, then Tab out of it.
async function enter(id, value) {
  await app.run(id => {
    const input = document.getElementById(id);
    input.focus();
    input.select();
  }, id);
  if (value) await app.typeText(value);
  else await app.pressKey('Backspace');
  await app.pressKey('Tab');
  await settle();
}

const click = selector => app.run(async ([selector, settleText]) => {
  const target = document.querySelector(selector);
  if (!target) return false;
  target.click();
  await eval(settleText)();
  return true;
}, [selector, settleSource]);

if (!PRINT) {
  // 1. Another table's ROM link: a card under the box, not a pop-up.
  await play(PINK_FLOYD);
  await openEditor();
  const fresh = await look();
  check('the editor opens on its dropdown, no Manual VPSID box', fresh.open && fresh.selectShown && !fresh.manualShown && !fresh.manualMode, JSON.stringify(fresh));
  await enter('additionalRomUrlOverride', 'http://vpuniverse.com/files/file/3941-tales-from-the-crypt-400-unofficial-mod');
  const found = await look();
  check('leaving the URL box with a ROM link VPS has shows a card under the box', found.card && found.cardInUrlField, JSON.stringify(found));
  check('no pop-up opens over the editor', found.popup === false && found.open === true, JSON.stringify(found));
  check('the card reads "VPS Entry Found | {id}"', found.title === 'VPS Entry Found | s-4c6GqaOn', found.title);
  check('then where it was found, the asset, and what to do',
    found.intro === 'The link provided was found in VPSDB.'
    && found.names[0] === 'Tales from the Crypt · ROM' && found.details[0] === 'vtftc_400 · by CarnyPriest'
    && found.advice === 'If this is the correct asset, please use the associated VPSID instead of the URL.', JSON.stringify(found));
  check('Copy, then Use, then close, in the tab order', found.tabOrder.join(',') === 'copy,use,close', found.tabOrder.join(','));
  check('the close button is drawn in the card\'s top-right corner',
    found.closeCorner && found.closeCorner.top === 9 && found.closeCorner.right === 9 && found.closeCorner.icon === 14, JSON.stringify(found.closeCorner));
  check('Use says "Use this Asset ID?" and names everything it clears',
    found.useTip === 'Use this Asset ID?'
    && found.useLabel === 'Use VPSID s-4c6GqaOn as the Additional ROM Manual VPSID and remove the URL and Version Override', found.useLabel);
  check('the card is said aloud, as it does not take the keyboard',
    /VPS entry found for this link: Tales from the Crypt ROM, VPSID s-4c6GqaOn/.test(found.status), found.status);
  check('a right-type link is no error', found.error === '' && found.describedBy === '', JSON.stringify(found));

  // 2. Copy.
  const copied = await app.run(async settleText => {
    let written = null;
    navigator.clipboard.writeText = async text => { written = text; };
    const button = document.querySelector('#additionalRomDialog .url-vps-match-copy');
    button.click();
    await eval(settleText)();
    return { written, tip: button.dataset.tooltip };
  }, settleSource);
  check('the card\'s Copy copies the VPSID', copied.written === 's-4c6GqaOn' && copied.tip === 'Copied', JSON.stringify(copied));

  // 3. Close keeps the URL; leaving again with the same link does not bring
  // the card back; a different link does.
  await click('#additionalRomDialog .url-vps-match-card-close');
  const closed = await look();
  check('close hides the card, keeps the URL and goes back to the box',
    !closed.card && closed.url.includes('3941-tales-from-the-crypt') && closed.active === 'additionalRomUrlOverride', JSON.stringify(closed));
  await app.pressKey('Tab');
  check('leaving the box with the same link does not bring it back', (await look()).card === false);
  await app.run(() => document.getElementById('additionalRomVersionOverride').focus());
  await app.typeText('tftc_400');
  await enter('additionalRomUrlOverride', VPFORUMS_TFTC_ROM);
  const second = await look();
  check('a different matching link shows its own card', second.card && second.title === 'VPS Entry Found | 2Q1pXHma', second.title);

  // 4. Use: the Manual VPSID box takes the dropdown's place; the URL and its
  // Version Override go.
  await click('#additionalRomDialog .url-vps-match-use');
  const used = await look();
  check('Use clears the URL and its Version Override, and the card goes', used.url === '' && used.version === '' && !used.card, JSON.stringify(used));
  check('the dropdown gives way to a Manual VPSID box holding the ID',
    used.manualMode && used.manualShown && !used.selectShown && used.manualValue === '2Q1pXHma', JSON.stringify(used));
  check('the box names the asset, and the keyboard is in it',
    used.manualLabel === 'Tales from the Crypt · ROM' && !used.manualLabelError && used.active === 'additionalRomManualVpsId', JSON.stringify(used));
  check('nothing is saved until Save ROM', used.saved.length === 0, JSON.stringify(used.saved));
  check('Use is said aloud', /VPSID 2Q1pXHma is now the Manual VPSID/.test(used.status), used.status);
  const labelFor = await app.run(() => document.querySelector('#additionalRomVpsField > label').getAttribute('for'));
  check('the "VPS ID" label now names the Manual VPSID box', labelFor === 'additionalRomManualVpsId', labelFor);
  // WCAG 2.5.3: the spoken name starts with the visible label, so "click VPS ID" reaches it.
  const spoken = await app.run(() => document.getElementById('additionalRomManualVpsId').getAttribute('aria-label'));
  check('the Manual VPSID box spoken name starts with its visible label', spoken.startsWith('VPS ID, Manual VPSID'), spoken);

  // 5. Save ROM: the off-table ROM is accepted.
  await click('#additionalRomSave');
  const noChecksum = await look();
  check('Save ROM without a checksum stops on the checksum alone, not the ID',
    noChecksum.open && noChecksum.vpsDot === '' && noChecksum.active === 'additionalRomChecksum', JSON.stringify(noChecksum));
  await enter('additionalRomChecksum', MD5_ADD);
  await click('#additionalRomSave');
  const saved = await look();
  check('with a checksum, Save ROM saves the borrowed ID in the entry\'s vpsId',
    !saved.open && saved.saved.length === 1 && saved.saved[0].vpsId === '2Q1pXHma' && saved.saved[0].urlOverride === '' && saved.saved[0].versionOverride === '', JSON.stringify(saved.saved));
  check('the rulebook takes it: no Additional ROM error', saved.issues.length === 0, saved.issues.join('\n'));
  check('the YML writes it as any Additional ROM', /additionalRoms:\n {2}- vpsId: "2Q1pXHma"\n {4}checksum: "0123456789ABCDEF0123456789ABCDEF"/.test(saved.yaml), saved.yaml);
  check('the ROM badge names the borrowed ROM with its table',
    saved.badge === `tftc_400 (Tales from the Crypt) · ${MD5_ADD}`, saved.badge);

  // 6. Reopening: the borrowed ID opens in its box.
  await openEditor();
  const reopened = await look();
  check('reopening a borrowed ID shows the Manual VPSID box with it, keyboard there',
    reopened.manualMode && reopened.manualShown && reopened.manualValue === '2Q1pXHma' && reopened.active === 'additionalRomManualVpsId'
    && reopened.manualLabel === 'Tales from the Crypt · ROM', JSON.stringify(reopened));

  // 7. A bad ID, and an ID of the wrong type.
  await enter('additionalRomManualVpsId', 'notAnEntry');
  const bad = await look();
  check('an ID VPS does not have says so beside the box', bad.manualLabel === 'No VPS asset has this ID.' && bad.manualLabelError, JSON.stringify(bad));
  await click('#additionalRomSave');
  const refusedBad = await look();
  check('and Save ROM refuses it, the dot on the ID and the keyboard back in the box',
    refusedBad.open && refusedBad.vpsDot === 'No VPS asset has this ID.' && refusedBad.active === 'additionalRomManualVpsId', JSON.stringify(refusedBad));
  await enter('additionalRomManualVpsId', 'Pr7aybcEBQ');
  const wrongId = await look();
  check('a Backglass ID is named as one', wrongId.manualLabel === 'This ID is a Backglass, not a ROM.' && wrongId.vpsDot === 'This ID is a Backglass, not a ROM.', JSON.stringify(wrongId));

  // 8. Emptying the box and leaving it brings the dropdown back.
  await app.run(() => {
    const box = document.getElementById('additionalRomManualVpsId');
    box.focus();
    box.select();
  });
  await app.pressKey('Backspace');
  await app.pressKey('Enter');
  const back = await look();
  const labelBack = await app.run(() => document.querySelector('#additionalRomVpsField > label').getAttribute('for'));
  check('and the label names the dropdown again', labelBack === 'additionalRomVpsId', labelBack);
  check('emptied and left, the box gives way to the dropdown again, keyboard on it',
    !back.manualMode && back.selectShown && !back.manualShown && back.active === 'additionalRomVpsId', JSON.stringify(back));
  await click('#additionalRomDialog [data-additional-rom-close]');
  check('Cancel keeps the saved entry as it was', (await look()).saved[0]?.vpsId === '2Q1pXHma');

  // 9. A link VPS lists only as another type: the red line, and Save refuses.
  await play(PINK_FLOYD);
  await openEditor();
  await app.run(() => document.getElementById('additionalRomVersionOverride').focus());
  await app.typeText('1.0');
  await enter('additionalRomChecksum', MD5_ADD);
  await enter('additionalRomUrlOverride', TFTC_B2S_URL);
  const wrong = await look();
  check('a Backglass link shows no card, and the wrong-type line under the box',
    !wrong.card && wrong.error === WRONG_TYPE + 'Backglass' && wrong.describedBy === 'additionalRomUrlError', JSON.stringify(wrong));
  check('the line is said aloud as it appears', wrong.status === WRONG_TYPE + 'Backglass', wrong.status);
  await click('#additionalRomSave');
  const refused = await look();
  check('Save ROM refuses it, its dot on the URL box',
    refused.open && refused.saved.length === 0 && refused.urlDot === WRONG_TYPE + 'Backglass', JSON.stringify(refused));
  await app.run(() => {
    const box = document.getElementById('additionalRomUrlOverride');
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  });
  await app.typeText('x');
  check('while typing, the line steps aside', (await look()).error === '');
  await enter('additionalRomUrlOverride', 'https://example.com/my-own-rom.zip');
  const own = await look();
  check('a link no asset carries: no card, no line', !own.card && own.error === '', JSON.stringify(own));
  // Pink Floyd's one ROM is the primary, so this entry is still refused for
  // its missing ID: what matters is that the link is no longer the reason.
  await click('#additionalRomSave');
  const ownSaved = await look();
  check('and Save ROM no longer flags the link', ownSaved.urlDot === '' && /Select a ROM VPS ID/.test(ownSaved.vpsDot), JSON.stringify(ownSaved));

  // 10. Pasting a link checks it without leaving the box.
  await openEditor();
  const pasted = await app.run(async ([settleText, url]) => {
    const settle = eval(settleText);
    const input = document.getElementById('additionalRomUrlOverride');
    input.focus();
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true }));
    input.value = url;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    await settle();
    const card = document.querySelector('#additionalRomDialog .url-vps-match-card');
    return { card: !!card, title: card?.querySelector('.url-vps-match-card-title')?.textContent || '', active: document.activeElement?.id };
  }, [settleSource, TFTC_ROM_URL]);
  check('pasting a matching link shows the card, the keyboard staying in the box',
    pasted.card && pasted.title === 'VPS Entry Found | s-4c6GqaOn' && pasted.active === 'additionalRomUrlOverride', JSON.stringify(pasted));
  await click('#additionalRomDialog [data-additional-rom-close]');

  // 11. A saved wrong-type link (as an import brings one) blocks in the
  // rulebook, and opening the editor shows its line at once; a saved
  // matching link shows no card until the box is left.
  await app.run(async ([settleText, url, md5]) => {
    window.VPS_FEATURE_RUNTIME.state.callbacks.onChange('additionalRoms', [{ vpsId: '', checksum: md5, versionOverride: '1.0', urlOverride: url }]);
    window.VPS_ADDITIONAL_ROMS.render();
    window.VPS_MAIN.refreshOutput();
    await eval(settleText)();
  }, [settleSource, TFTC_B2S_URL, MD5_ADD]);
  const importedWrong = await look();
  check('a saved wrong-type link blocks in the rulebook', importedWrong.issues.includes(WRONG_TYPE + 'Backglass'), importedWrong.issues.join('\n'));
  await openEditor();
  await app.run(() => new Promise(r => setTimeout(r, 50)));
  const openedWrong = await look();
  check('opening it shows the line at once', openedWrong.error === WRONG_TYPE + 'Backglass' && !openedWrong.card, JSON.stringify(openedWrong));
  await click('#additionalRomDialog [data-additional-rom-close]');
  await app.run(async ([settleText, url, md5]) => {
    window.VPS_FEATURE_RUNTIME.state.callbacks.onChange('additionalRoms', [{ vpsId: '', checksum: md5, versionOverride: '1.0', urlOverride: url }]);
    window.VPS_ADDITIONAL_ROMS.render();
    await eval(settleText)();
  }, [settleSource, TFTC_ROM_URL, MD5_ADD]);
  await openEditor();
  await app.run(() => new Promise(r => setTimeout(r, 50)));
  const openedMatch = await look();
  check('opening a saved matching link shows no card until the box is left', !openedMatch.card && openedMatch.error === '', JSON.stringify(openedMatch));
  await click('#additionalRomDialog [data-additional-rom-close]');

  // 11b. An ID on this table still opens on the dropdown, picked (opening
  // once blanked it: the full suite caught that, 2026-10-31). The table's one
  // ROM is the primary here, so it is listed only because the entry has it.
  await app.run(async ([settleText, md5]) => {
    window.VPS_FEATURE_RUNTIME.state.callbacks.onChange('additionalRoms', [{ vpsId: 'jgo91P3SSp', checksum: md5, versionOverride: '', urlOverride: '' }]);
    window.VPS_ADDITIONAL_ROMS.render();
    await eval(settleText)();
  }, [settleSource, MD5_ADD]);
  await openEditor();
  const ownRom = await app.run(() => ({
    value: document.getElementById('additionalRomVpsId').value,
    manual: document.getElementById('additionalRomVpsField').classList.contains('is-manual')
  }));
  check('an entry with one of this table\'s ROMs opens on the dropdown with it picked',
    ownRom.value === 'jgo91P3SSp' && ownRom.manual === false, JSON.stringify(ownRom));
  await click('#additionalRomDialog [data-additional-rom-close]');

  // 12. ROM Override on: the dropdown says "Not needed", and Use still works.
  await play([...PINK_FLOYD, ['override', 'romFiles', true], ['fill', 'romUrlOverride', '']]);
  await openEditor();
  await enter('additionalRomUrlOverride', TFTC_ROM_URL);
  await click('#additionalRomDialog .url-vps-match-use');
  const overridden = await look();
  check('with ROM Override on, Use still puts the ID in the Manual VPSID box',
    overridden.manualMode && overridden.manualValue === 's-4c6GqaOn' && overridden.url === '', JSON.stringify(overridden));
  await click('#additionalRomDialog [data-additional-rom-close]');

  check('no page errors', app.errors.filter(error => !/Unable to preload the VPS database/.test(error)).length === 0, app.errors.join('\n'));
}

await app.close();

// 13. Its own page, where the database is slow to arrive: a Save ROM pressed
// before it is in waits for it, so a wrong-type link is not let through
// (ui-checker, 2026-10-31). Nothing here has used the database before.
if (!PRINT) {
  const { readFileSync } = await import('node:fs');
  const { repoPath } = await import('./harness.mjs');
  const { openApp } = await import('./browser.mjs');
  const db = JSON.parse(readFileSync(repoPath('fixtures', 'vpsdb-five.json'), 'utf8'));
  const slow = await openApp({ db, windowSize: [1400, 900] });
  const raced = await slow.run(async ([settleText, url, md5]) => {
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
    // ROM Override, so the entry needs no ID and the link is the only problem.
    const override = document.querySelector('#assetMatrix .asset-row[data-category="romFiles"] .override-toggle input');
    if (!override.checked) override.click();
    await settle();
    document.getElementById('config-tab-rom').click();
    await settle();
    const realFetch = window.fetchVPSDB;
    window.fetchVPSDB = () => new Promise(resolve => setTimeout(resolve, 800)).then(() => realFetch());
    document.querySelector('#config-panel-rom .additional-rom-add').click();
    await settle();
    document.getElementById('additionalRomChecksum').value = md5;
    document.getElementById('additionalRomVersionOverride').value = '1.0';
    document.getElementById('additionalRomUrlOverride').value = url;
    const save = document.getElementById('additionalRomSave');
    save.click();
    await settle();
    const during = { open: document.getElementById('additionalRomDialog').open, disabled: save.disabled };
    await new Promise(r => setTimeout(r, 1500));
    await settle();
    const node = document.getElementById('additionalRomDialog');
    return {
      during,
      open: node.open,
      disabledAfter: save.disabled,
      saved: window.VPS_FEATURE_RUNTIME.state.values.additionalRoms || [],
      dot: node.querySelector('#additionalRomUrlOverride').closest('.field').querySelector(':scope > .field-error-dot')?.getAttribute('aria-label') || '',
      line: node.querySelector('.url-vps-match-error')?.textContent || ''
    };
  }, [settleSource, TFTC_B2S_URL, MD5_ADD]);
  check('Save ROM pressed before the database is in waits, its button disabled',
    raced.during.open === true && raced.during.disabled === true, JSON.stringify(raced));
  check('then refuses the wrong-type link: nothing saved, the dot and the red line on the URL box',
    raced.open === true && raced.saved.length === 0 && raced.dot === WRONG_TYPE + 'Backglass'
    && raced.line === WRONG_TYPE + 'Backglass' && raced.disabledAfter === false, JSON.stringify(raced));
  check('no page errors on the slow page', slow.errors.length === 0, slow.errors.join(' | '));
  await slow.close();
}

// 14. A fresh slow page: Save ROM pressed, then Cancel and a reopen while the
// database is still loading. The waiting Save must not save the reopened
// form, which nobody pressed Save on (pr-checker, 2026-11-01).
if (!PRINT) {
  const { readFileSync } = await import('node:fs');
  const { repoPath } = await import('./harness.mjs');
  const { openApp } = await import('./browser.mjs');
  const db = JSON.parse(readFileSync(repoPath('fixtures', 'vpsdb-five.json'), 'utf8'));
  const slow = await openApp({ db, windowSize: [1400, 900] });
  const raced = await slow.run(async ([settleText, md5]) => {
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
    // ROM Override, so an entry needs no ID and both forms are valid.
    const override = document.querySelector('#assetMatrix .asset-row[data-category="romFiles"] .override-toggle input');
    if (!override.checked) override.click();
    await settle();
    document.getElementById('config-tab-rom').click();
    await settle();
    const realFetch = window.fetchVPSDB;
    window.fetchVPSDB = () => new Promise(resolve => setTimeout(resolve, 800)).then(() => realFetch());
    const fill = (checksum, url) => {
      document.getElementById('additionalRomChecksum').value = checksum;
      document.getElementById('additionalRomVersionOverride').value = '1.0';
      document.getElementById('additionalRomUrlOverride').value = url;
    };
    const node = document.getElementById('additionalRomDialog');
    document.querySelector('#config-panel-rom .additional-rom-add').click();
    await settle();
    fill(md5, 'https://example.com/first-rom.zip');
    document.getElementById('additionalRomSave').click();
    await settle();
    node.querySelector('[data-additional-rom-close]').click();
    await settle();
    const closed = node.open === false;
    document.querySelector('#config-panel-rom .additional-rom-add').click();
    await settle();
    fill('FEDCBA9876543210FEDCBA9876543210', 'https://example.com/second-rom.zip');
    await new Promise(r => setTimeout(r, 1500));
    await settle();
    return {
      closed,
      open: node.open,
      saved: window.VPS_FEATURE_RUNTIME.state.values.additionalRoms || []
    };
  }, [settleSource, MD5_ADD]);
  check('a Save left waiting through Cancel and a reopen saves nothing, the reopened editor still open',
    raced.closed === true && raced.open === true && raced.saved.length === 0, JSON.stringify(raced));
  check('no page errors on the second slow page', slow.errors.length === 0, slow.errors.join(' | '));
  await slow.close();
}

report('additional-rom-url-override');
