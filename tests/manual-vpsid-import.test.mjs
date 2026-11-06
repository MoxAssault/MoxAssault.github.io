// Importing a YML whose asset ID is not on the loaded table (Jason,
// 2026-10-28, decision 2 in the "Override VPX checkbox" queue note). An ID
// that is a real VPS asset of its row's type, on one of the five rows with a
// Manual VPSID box (Backglass, ROM, Color ROM, PUP Pack, Alt Sound), imports
// as Override with that Manual VPSID. An ID found nowhere, of the wrong type,
// on a row without the box (VPU Patch), or marked Bundled still refuses the
// import with its old message.
//
// Runs the real app in headless Chrome through the scenario runner, with the
// five-table VPS fixture: Pink Floyd is loaded, and its "borrowed" assets come
// from Tales from the Crypt.

import { check, report } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, play, PRINT } = await startScenarios();

const settleSource = `() => new Promise(resolve => {
  const frames = n => n ? requestAnimationFrame(() => frames(n - 1)) : setTimeout(resolve, 0);
  frames(3);
})`;

// Pink Floyd (Lgi1JLk0Vf) with its VPX file; extra lines are added per case.
const yml = lines => ['---', 'tableVPSId: "Lgi1JLk0Vf"', 'vpxVPSId: "qV3Z3oQ8md"', ...lines].join('\n') + '\n';

// Tales from the Crypt's assets, none of them on Pink Floyd.
const TFTC = { rom: 's-4c6GqaOn', pup: 'npaTMr83', altSound: 'z_U1GKNuSy', b2s: 'Pr7aybcEBQ', color: '1IkglzKX', vpx: 'TJMo9ycfSP' };
const PINK_FLOYD_ROM = 'jgo91P3SSp';

// Imports a YML through the real file input and reports the toast and what
// the build ended up holding.
async function importYml(text) {
  return app.run(async ([text, settleText]) => {
    const settle = eval(settleText);
    const input = document.getElementById('ymlImportInput');
    const transfer = new DataTransfer();
    transfer.items.add(new File([text], 'case.yml', { type: 'text/yaml' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const toast = () => document.querySelector('#ymlImportToast');
    const title = () => toast()?.querySelector('.vps-db-toast-title')?.textContent || '';
    const started = Date.now();
    let alert = '';
    while (Date.now() - started < 15000 && !/YML loaded|could not be loaded|Import cancelled/.test(title())) {
      if (/bad VPS ID/.test(title()) && !alert) {
        alert = toast().querySelector('.vps-db-toast-message').textContent;
        [...toast().querySelectorAll('button')].find(button => button.textContent === 'Cancel').click();
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await new Promise(resolve => setTimeout(resolve, 150));
    await settle();
    const runtime = window.VPS_FEATURE_RUNTIME;
    const values = runtime?.state?.values || {};
    const box = category => document.getElementById(`manualVpsId-${category}`);
    const label = category => document.getElementById(`manualVpsIdLabel-${category}`)?.textContent || '';
    const select = category => document.querySelector(`#assetMatrix .asset-row[data-category="${category}"] select`);
    return {
      title: title(),
      alert,
      message: toast()?.querySelector('.vps-db-toast-message')?.textContent || '',
      values: JSON.parse(JSON.stringify({
        romOverride: values.romOverride, romVPSId: values.romVPSId, romNotes: values.romNotes,
        pupOverride: values.pupOverride, pupVPSId: values.pupVPSId,
        altSoundOverride: values.altSoundOverride, altSoundVPSId: values.altSoundVPSId
      })),
      selections: JSON.parse(JSON.stringify(runtime?.state?.selections || {})),
      romBox: box('romFiles')?.value ?? null,
      romLabel: label('romFiles'),
      romVerified: window.VPS_MANUAL_VPSID?.verified('romFiles') === true,
      romSelect: select('romFiles')?.value ?? null,
      pupBox: box('pupPackFiles')?.value ?? null,
      pupLabel: label('pupPackFiles'),
      altBox: box('altSoundFiles')?.value ?? null,
      altLabel: label('altSoundFiles'),
      yaml: document.getElementById('previewYaml')?.textContent || '',
      // Leaving a Manual VPSID box by Tab puts the keyboard on its row's first
      // checkbox; an import is no Tab and must not.
      focusOnRow: Boolean(document.activeElement?.closest?.('.asset-toggle-stack'))
    };
  }, [text, settleSource]);
}

// A bad ID now asks first; these tests answer Cancel.
const refused = (result, label, id) => result.title === 'Import cancelled' && result.alert.includes(`${label} [${id}]:`);

if (!PRINT) {
  // 1. A ROM from another table imports as Override with that Manual VPSID.
  await play([]);
  const rom = await importYml(yml([`romVPSId: "${TFTC.rom}"`, 'romNotes: "Borrowed ROM"']));
  check('a ROM from another table imports', rom.title === 'YML loaded for editing', JSON.stringify(rom));
  check('it imports as Override, the ID in the Manual VPSID box, verified',
    rom.values.romOverride === true && rom.values.romVPSId === TFTC.rom && rom.romBox === TFTC.rom && rom.romVerified,
    JSON.stringify(rom));
  check('the box names the asset it found', rom.romLabel === 'Tales from the Crypt · ROM', rom.romLabel);
  check('nothing is picked from the table\'s own dropdown', rom.selections.romFiles === undefined, JSON.stringify(rom.selections));
  check('the other ROM fields import with it', rom.values.romNotes === 'Borrowed ROM', JSON.stringify(rom.values));
  check('the YML writes the ID in the normal key, with nothing marking it borrowed',
    rom.yaml.includes(`romVPSId: "${TFTC.rom}"`) && !/romOverride/.test(rom.yaml), rom.yaml);
  check('the import leaves the keyboard where it was, not on the ROM row', rom.focusOnRow === false, JSON.stringify(rom));

  // 1b. A database load that failed earlier in the page's life does not
  //     refuse a good borrowed ID: the import has just loaded the database.
  await play([]);
  const stale = await app.run(async id => {
    const real = window.fetchVPSDB;
    window.fetchVPSDB = () => Promise.reject(new Error('offline for a moment'));
    const whileOffline = await window.VPS_MANUAL_VPSID.isAssetOfType('romFiles', id);
    window.fetchVPSDB = real;
    return whileOffline;
  }, TFTC.rom);
  const afterStale = await importYml(yml([`romVPSId: "${TFTC.rom}"`]));
  check('a load that failed earlier is retried, and the borrowed ID imports',
    stale === false && afterStale.title === 'YML loaded for editing' && afterStale.romVerified, JSON.stringify({ stale, afterStale }));

  // 2. Exported and imported again, it comes back the same way. Each import
  //    starts from a fresh page: importing over a loaded build asks to
  //    replace it through window.confirm, which halts a headless page.
  await play([]);
  const again = await importYml(rom.yaml);
  check('the exported YML imports back the same way',
    again.title === 'YML loaded for editing' && again.values.romOverride === true && again.romBox === TFTC.rom && again.romVerified,
    JSON.stringify(again));

  // 3. Two rows at once.
  await play([]);
  const two = await importYml(yml([`pupVPSId: "${TFTC.pup}"`, `altSoundVPSId: "${TFTC.altSound}"`]));
  check('a PUP Pack and an Alt Sound from another table import together',
    two.title === 'YML loaded for editing' && two.values.pupOverride === true && two.values.altSoundOverride === true
    && two.pupBox === TFTC.pup && two.altBox === TFTC.altSound, JSON.stringify(two));
  check('each box names its own asset',
    two.pupLabel === 'Tales from the Crypt · PUP Pack' && two.altLabel === 'Tales from the Crypt · Alt Sound', JSON.stringify(two));

  // 4. The table's own ID still picks from the dropdown, no Override.
  await play([]);
  const own = await importYml(yml([`romVPSId: "${PINK_FLOYD_ROM}"`]));
  check('the table\'s own ROM still imports into the dropdown, without Override',
    own.title === 'YML loaded for editing' && own.values.romOverride !== true && own.romSelect === PINK_FLOYD_ROM && own.romBox === null,
    JSON.stringify(own));

  // 5. What still refuses, each with its old message.
  await play([]);
  const wrongType = await importYml(yml([`romVPSId: "${TFTC.altSound}"`]));
  check('an Alt Sound ID in the ROM key is refused', refused(wrongType, 'ROM', TFTC.altSound), JSON.stringify(wrongType));
  await play([]);
  const nowhere = await importYml(yml(['romVPSId: "NOTAREALID"']));
  check('an ID found nowhere is refused', refused(nowhere, 'ROM', 'NOTAREALID'), JSON.stringify(nowhere));
  await play([]);
  const bundled = await importYml(yml(['romBundled: true', `romVPSId: "${TFTC.rom}"`]));
  check('a borrowed ID marked Bundled is refused: a bundled asset is the table\'s own',
    refused(bundled, 'ROM', TFTC.rom), JSON.stringify(bundled));
  await play([]);
  const vpx = await importYml(['---', 'tableVPSId: "Lgi1JLk0Vf"', `vpxVPSId: "${TFTC.vpx}"`].join('\n') + '\n');
  check('a VPX file from another table is refused: that row has no Manual VPSID box',
    refused(vpx, 'VPX', TFTC.vpx), JSON.stringify(vpx));

  // 6. The table's own asset, marked broken in VPS, is refused as before, not
  //    slipped in as a borrowed one. The fixture has no broken asset, so one
  //    is marked in the page's copy of the database, which the import and the
  //    Manual VPSID check both read.
  await play([]);
  const marked = await app.run(async id => {
    const db = await window.fetchVPSDB();
    const records = Array.isArray(db) ? db : (db?.tables || []);
    const item = records.find(record => record.id === 'Lgi1JLk0Vf')?.romFiles?.find(candidate => candidate.id === id);
    if (item) item.broken = true;
    return Boolean(item);
  }, PINK_FLOYD_ROM);
  const broken = await importYml(yml([`romVPSId: "${PINK_FLOYD_ROM}"`]));
  check('the table\'s own broken ROM is still refused, not borrowed', marked && refused(broken, 'ROM', PINK_FLOYD_ROM), JSON.stringify(broken));

  // 7. A Manual VPSID that fails its check is left out of the YML (Jason,
  //    2026-10-30): the box keeps it, the dot stays, the ID key is not written.
  //    Typed for real and left by Tab.
  await play([['search', 'Lgi1JLk0Vf'], ['asset', 'tableFiles', 'qV3Z3oQ8md'], ['override', 'romFiles', true]]);
  const typeInBox = async text => {
    await app.run(() => {
      const box = document.getElementById('manualVpsId-romFiles');
      box.focus();
      box.select();
    });
    await app.typeText(text);
    await app.pressKey('Tab');
    return app.run(async settleText => {
      const settle = eval(settleText);
      await settle();
      const box = document.getElementById('manualVpsId-romFiles');
      const label = document.getElementById('manualVpsIdLabel-romFiles');
      const style = label ? getComputedStyle(label) : null;
      return {
        box: box?.value ?? null,
        saved: window.VPS_FEATURE_RUNTIME.state.values.romVPSId ?? null,
        dot: Boolean(box?.closest('.manual-vpsid')?.querySelector(':scope > .field-error-dot')),
        label: label?.textContent || '',
        title: label?.getAttribute('title'),
        wraps: style ? style.whiteSpace !== 'nowrap' && style.webkitLineClamp === '3' : false,
        romLines: document.getElementById('previewYaml').textContent.split('\n').filter(line => /^romVPSId:/.test(line))
      };
    }, settleSource);
  };
  const wrong = await typeInBox(TFTC.altSound);
  check('a wrong-type Manual VPSID stays in its box, with its dot, and is kept',
    wrong.box === TFTC.altSound && wrong.saved === TFTC.altSound && wrong.dot, JSON.stringify(wrong));
  check('but the YML leaves its ID out', wrong.romLines.length === 0, JSON.stringify(wrong.romLines));
  const unknown = await typeInBox('NOTAREALID');
  check('an ID found nowhere is left out too', unknown.dot && unknown.romLines.length === 0, JSON.stringify(unknown));
  const good = await typeInBox(TFTC.rom);
  check('once it checks out, the YML writes it',
    !good.dot && JSON.stringify(good.romLines) === JSON.stringify([`romVPSId: "${TFTC.rom}"`]), JSON.stringify(good));
  check('the name beside the box wraps, up to three lines, with no native title',
    good.label === 'Tales from the Crypt · ROM' && good.wraps && good.title === null, JSON.stringify(good));

  const unexpected = app.errors.filter(error => !/Unable to preload the VPS database/.test(error));
  check('no page errors', unexpected.length === 0, unexpected.join('\n'));
}

await app.close();
report('manual-vpsid-import');
