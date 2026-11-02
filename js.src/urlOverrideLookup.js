(() => {
  'use strict';
  const runtime = window.VPS_FEATURE_RUNTIME;
  const fields = window.VPS_YML_FIELDS;
  const utils = window.VPS_UTILS;
  if (!runtime || !fields || !utils) return;

  const { CATEGORY_CONFIG, WIZARD_STEPS } = fields;

  // The URL Override check (Jason, 2026-10-27; queue note "URL override lookup
  // against VPSDB"; redesigned with him 2026-10-30). On leaving a *UrlOverride
  // box, the link is looked up in the VPS database:
  // - an asset of the row's own type carries it: a pop-up names the asset,
  //   with a button that moves its VPSID into the row's Manual VPSID box and
  //   clears the URL. Shown once per link; closing it keeps the URL.
  // - only assets of other types carry it: a blocking error on the box, as
  //   a link to the wrong kind of file would break the table on install.
  // - nothing carries it: nothing happens.
  // Only the rows with a Manual VPSID box have the check; the DMD row has no
  // VPS ID and a VPU Patch belongs to one table's VPX file (Jason).

  const MANUAL_CATEGORIES = window.VPS_MANUAL_VPSID?.CATEGORIES || [];

  // Every *UrlOverride field on those rows, read from the steps so a new one
  // is picked up without a list to keep in step.
  const URL_FIELDS = WIZARD_STEPS.flatMap(step => (step.fields || [])
    .filter(field => field.type === 'url' && /UrlOverride$/.test(field.yml_field))
    .filter(() => MANUAL_CATEGORIES.includes(step.category))
    .map(field => ({ name: field.yml_field, stepId: step.id, category: step.category, tab: step.label })));

  // Asset kinds the rows do not cover, named in the wrong-type error.
  const EXTRA_LABELS = {
    tableFiles: 'VPX file',
    wheelArtFiles: 'Wheel Art',
    topperFiles: 'Topper',
    mediaPackFiles: 'Media Pack',
    povFiles: 'POV',
    ruleFiles: 'Rules',
    tutorialFiles: 'Tutorial',
    soundFiles: 'Sound'
  };

  // Two links match when they lead to the same file (Jason, 2026-10-30): http
  // and https, the host's letter case, a leading www., a trailing slash and a
  // #fragment are ignored. The ?query is kept, because some hosts name the
  // file there (vpforums: ?showfile=11340), and so is the path's letter case.
  function urlKey(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return '';
    let url;
    try {
      url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
    } catch (_) {
      return '';
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const port = url.port ? `:${url.port}` : '';
    const path = url.pathname.replace(/\/+$/, '');
    // A slash typed at the very end lands in the query when there is one
    // (?showfile=14159/, found by Jason 2026-10-30), so it goes from there too.
    const search = url.search.replace(/\/+$/, '').replace(/^\?$/, '');
    return `${host}${port}${path}${search}`;
  }

  let index = null;
  let failed = false;
  let loading = null;
  // Field name -> the link key whose pop-up has been shown. Kept for the
  // page's life only, so leaving the box again does not reopen it.
  const shown = new Map();

  // A VPU Patch is a VPX file tagged as one, or sits under one of the VPU
  // Patch row's own source names (getCategoryItems reads it the same way).
  const PATCH_SOURCES = CATEGORY_CONFIG.vpuPatchFiles?.sourceFields || ['vpuPatchFiles'];

  function kindOf(category, item) {
    if (PATCH_SOURCES.includes(category)) return 'vpuPatchFiles';
    if (category === 'tableFiles' && utils.isVpuPatchItem(item)) return 'vpuPatchFiles';
    return category;
  }

  // Every link on every asset, all of an item's links and broken ones too.
  // Any array of objects with an id counts as assets; "designers" and
  // "theme" hold plain strings.
  function buildIndex(db) {
    const map = new Map();
    const records = Array.isArray(db) ? db : (Array.isArray(db?.tables) ? db.tables : []);
    records.forEach(record => {
      Object.keys(record || {}).forEach(source => {
        const items = Array.isArray(record[source]) ? record[source] : [];
        items.forEach(item => {
          const id = String(item?.id || '').trim();
          if (!id || !item || typeof item !== 'object') return;
          const category = kindOf(source, item);
          const entries = Array.isArray(item.urls) ? item.urls : (item.urls && typeof item.urls === 'object' ? Object.values(item.urls) : []);
          entries.forEach(entry => {
            const key = urlKey(entry?.url);
            if (!key) return;
            if (!map.has(key)) map.set(key, []);
            const list = map.get(key);
            const broken = entry.broken === true || entry.broken === 'true';
            const known = list.find(match => match.item === item);
            if (known) known.broken = known.broken && broken;
            else list.push({ category, record, item, broken });
          });
        });
      });
    });
    return map;
  }

  function ensureIndex() {
    if (index || failed || loading || typeof window.fetchVPSDB !== 'function') return;
    loading = window.fetchVPSDB()
      .then(db => { index = buildIndex(db); })
      // No check is the right answer when the database will not load: the
      // app already says the database is missing.
      .catch(() => { failed = true; })
      .finally(() => {
        loading = null;
        render();
        // A wrong-type link saved while the index loaded now blocks.
        window.VPS_MAIN?.refreshOutput?.();
        window.VPS_PRODUCTION_UI_EXTENSIONS?.scheduleControlCorrections?.();
      });
  }

  function typeLabel(category) {
    const step = WIZARD_STEPS.find(candidate => candidate.category === category);
    return step?.label || EXTRA_LABELS[category] || CATEGORY_CONFIG[category]?.label || category;
  }

  // For a box outside the main tabs (the Additional ROM editor): resolves
  // once the index is in, loading it first if need be, and again after a
  // failed load, as leaving a main-tab box does.
  function ready() {
    failed = false;
    ensureIndex();
    return loading ? loading.then(() => undefined) : Promise.resolve();
  }

  // { state: 'none' | 'match' | 'wrong', matches, message }. The row's own
  // type wins: a link VPS lists as both is a match, not an error.
  function lookup(spec) {
    return lookupUrl(runtime.state.values?.[spec.name], spec.category);
  }

  function lookupUrl(raw, category) {
    const key = urlKey(raw);
    if (!key) return { state: 'none', key };
    ensureIndex();
    if (!index) return { state: 'none', key };
    const all = index.get(key) || [];
    const tableId = runtime.state.record?.id;
    const matches = all.filter(match => match.category === category)
      .sort((a, b) => (a.record?.id === tableId ? 0 : 1) - (b.record?.id === tableId ? 0 : 1)
        || String(a.record?.name || '').localeCompare(String(b.record?.name || '')));
    if (matches.length) return { state: 'match', key, matches };
    if (!all.length) return { state: 'none', key };
    const types = [...new Set(all.map(match => typeLabel(match.category)))].join(', ');
    return { state: 'wrong', key, message: `This link is currently active on VPS, but not for this asset type. Type: ${types}` };
  }

  // For the rulebook: a wrong-type link blocks Copy and Download (Jason,
  // 2026-10-30: better stopped than a table broken on install).
  function issues(isStepEnabled) {
    return URL_FIELDS.flatMap(spec => {
      const step = WIZARD_STEPS.find(candidate => candidate.id === spec.stepId);
      if (step && typeof isStepEnabled === 'function' && !isStepEnabled(step)) return [];
      const result = lookup(spec);
      return result.state === 'wrong' ? [{ stepId: spec.stepId, fieldName: spec.name, message: result.message }] : [];
    });
  }

  function svg(paths) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
  }
  const COPY_ICON = svg('<path d="M8 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/><rect x="4" y="7" width="12" height="14" rx="2"/>');
  // An arrow into a tray: put this ID in place.
  const USE_ICON = svg('<path d="M12 3v11M7.5 9.5 12 14l4.5-4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>');
  // Drawn, not the × character, which sits low in the button (Jason,
  // 2026-10-30); the Additional Checksums dialog closes the same way.
  const CLOSE_ICON = svg('<path d="M6 6l12 12M18 6L6 18"/>');

  // The ID as the table card shows one: plain monospace, quieter than the
  // words around it.
  function idText(id) {
    return element('span', 'url-vps-match-id', id);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Styled as the header card's copy button (v091.css), tooltip included.
  function iconButton(className, tip, label, icon) {
    const button = element('button', `table-id-copy-button url-vps-match-icon ${className}`);
    button.type = 'button';
    button.dataset.tooltip = tip;
    button.setAttribute('aria-label', label);
    button.innerHTML = icon;
    return button;
  }

  function copyButton(id) {
    const button = iconButton('url-vps-match-copy', 'Copy VPSID', `Copy VPSID ${id}`, COPY_ICON);
    button.addEventListener('click', async () => {
      let done = true;
      try {
        await utils.copyText(id);
      } catch (error) {
        // Said on the button too, so a refused clipboard is not taken for a copy.
        console.warn('Unable to copy VPSID', error);
        done = false;
      }
      button.classList.toggle('copied', done);
      button.dataset.tooltip = done ? 'Copied' : 'Copy failed';
      button.setAttribute('aria-label', done ? `Copied VPSID ${id}` : `Copy failed for VPSID ${id}`);
      window.setTimeout(() => {
        button.classList.remove('copied');
        button.dataset.tooltip = 'Copy VPSID';
        button.setAttribute('aria-label', `Copy VPSID ${id}`);
      }, 1100);
    });
    return button;
  }

  // Three names at most: a team release can list twenty.
  function authorsText(authors) {
    const names = (Array.isArray(authors) ? authors : []).map(name => String(name).trim()).filter(Boolean);
    if (!names.length) return '';
    const more = names.length - 3;
    return `by ${names.slice(0, 3).join(', ')}${more > 0 ? ` and ${more} more` : ''}`;
  }

  // Copy and "Use this Asset ID?", side by side. onUse is the main tabs' own
  // unless a caller (the Additional ROM editor) brings its own.
  function actionButtons(spec, id, onUse = useId) {
    const label = typeof spec.useLabel === 'function'
      ? spec.useLabel(id)
      : `Use VPSID ${id} as the ${spec.tab} Manual VPSID and remove the URL`;
    const use = iconButton('url-vps-match-use', 'Use this Asset ID?', label, USE_ICON);
    use.addEventListener('click', () => onUse(spec, id));
    const actions = element('div', 'url-vps-match-actions');
    actions.append(copyButton(id), use);
    return actions;
  }

  // The asset's own picture, when VPS has one (Backglass and VPX files do;
  // ROMs and Alt Sounds do not). The name beside it says what it is.
  function thumbnail(item) {
    const url = String(item?.imgUrl || item?.imageUrl || item?.thumbnailUrl || item?.image || '').trim();
    if (!/^https?:\/\//i.test(url)) return null;
    const image = element('img', 'url-vps-match-thumb');
    image.alt = '';
    image.src = url;
    image.addEventListener('error', () => image.remove(), { once: true });
    return image;
  }

  // One asset: its picture, then table and type, version and authors. With
  // several assets, each carries its own ID and buttons; with one, the title
  // does.
  function assetBlock(spec, match, several, onUse) {
    const id = String(match.item.id);
    const block = element('section', 'url-vps-match-asset');
    const image = thumbnail(match.item);
    if (image) block.appendChild(image);
    const text = element('div', 'url-vps-match-text');
    if (several) {
      const head = element('div', 'url-vps-match-head');
      const heading = element('h3', 'url-vps-match-heading', 'VPSID ');
      heading.appendChild(idText(id));
      head.append(heading, actionButtons(spec, id, onUse));
      text.appendChild(head);
    }
    text.appendChild(element('p', 'url-vps-match-name', `${match.record?.name || 'Unknown table'} · ${typeLabel(match.category)}`));
    const details = [
      match.item.version ? `v${match.item.version}` : '',
      authorsText(match.item.authors),
      match.broken ? 'link marked broken on VPS' : ''
    ].filter(Boolean).join(' · ');
    if (details) text.appendChild(element('p', 'url-vps-match-details', details));
    block.appendChild(text);
    return block;
  }

  // Where the link was found, the assets, and what to do about it: the
  // pop-up's body and the card's.
  function findingBody(spec, result, onUse) {
    const several = result.matches.length > 1;
    return [
      element('p', 'url-vps-match-intro', 'The link provided was found in VPSDB.'),
      ...result.matches.map(match => assetBlock(spec, match, several, onUse)),
      element('p', 'url-vps-match-advice', several
        ? 'If one of these is the correct asset, please use its VPSID instead of the URL.'
        : 'If this is the correct asset, please use the associated VPSID instead of the URL.')
    ];
  }

  // The same finding as a card, for a box already inside a dialog: the
  // Additional ROM editor (Jason, 2026-10-30). Copy and Use come before the
  // close button in the tab order (his step 5 from the first test), so the
  // button is the card's last child, drawn in its corner by CSS.
  function card(spec, result, { onUse, onClose } = {}) {
    const several = result.matches.length > 1;
    const node = element('section', 'url-vps-match-card');
    node.setAttribute('aria-label', several ? 'VPS entries found for this link' : 'VPS entry found for this link');
    const row = element('div', 'url-vps-match-title-row');
    const title = element('h3', 'url-vps-match-card-title');
    row.appendChild(title);
    if (several) {
      title.textContent = 'VPS Entries Found';
    } else {
      const id = String(result.matches[0].item.id);
      title.append('VPS Entry Found | ', idText(id));
      row.appendChild(actionButtons(spec, id, onUse));
    }
    const close = element('button', 'dialog-close url-vps-match-card-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close and keep the URL');
    close.innerHTML = CLOSE_ICON;
    close.addEventListener('click', () => onClose?.());
    node.append(row, ...findingBody(spec, result, onUse), close);
    return node;
  }

  // Built once and kept: dialogs bind their handlers once, never per open
  // (vault note "VPXS UI Gotchas").
  let returnFocus = null;
  function dialog() {
    let node = document.getElementById('urlVpsMatchDialog');
    if (node) return node;
    node = document.createElement('dialog');
    node.id = 'urlVpsMatchDialog';
    node.className = 'app-dialog url-vps-match-dialog';
    node.setAttribute('aria-labelledby', 'urlVpsMatchTitle');
    node.innerHTML = `
      <div class="dialog-header">
        <div class="url-vps-match-titlebox">
          <p class="eyebrow" id="urlVpsMatchEyebrow">URL Override</p>
          <div class="url-vps-match-title-row"><h2 id="urlVpsMatchTitle">VPS Entry Found</h2><div class="url-vps-match-title-actions" id="urlVpsMatchTitleActions"></div></div>
        </div>
        <button class="dialog-close" data-url-vps-match-close type="button" aria-label="Close and keep the URL">${CLOSE_ICON}</button>
      </div>
      <div class="dialog-body url-vps-match-body" id="urlVpsMatchBody"></div>`;
    document.body.appendChild(node);
    node.querySelector('[data-url-vps-match-close]').addEventListener('click', () => node.close());
    node.addEventListener('click', event => { if (event.target === node) node.close(); });
    // Back to where the user was going, if the page still has it.
    node.addEventListener('close', () => {
      const target = returnFocus;
      returnFocus = null;
      if (target?.isConnected) target.focus();
    });
    return node;
  }

  function openDialog(spec, result) {
    const node = dialog();
    if (node.open || document.querySelector('dialog[open]')) return;
    shown.set(spec.name, result.key);
    node.querySelector('#urlVpsMatchEyebrow').textContent = `${spec.tab} URL Override`;
    // Jason's wording (2026-10-30): "VPS Entry Found | {id}", then where the
    // link was found, the asset, and what to do about it.
    const several = result.matches.length > 1;
    const title = node.querySelector('#urlVpsMatchTitle');
    const titleActions = node.querySelector('#urlVpsMatchTitleActions');
    if (several) {
      title.textContent = 'VPS Entries Found';
      titleActions.replaceChildren();
    } else {
      const id = String(result.matches[0].item.id);
      title.replaceChildren('VPS Entry Found | ', idText(id));
      titleActions.replaceChildren(actionButtons(spec, id));
    }
    node.querySelector('#urlVpsMatchBody').replaceChildren(...findingBody(spec, result));
    returnFocus = document.activeElement && document.activeElement !== document.body
      ? document.activeElement
      : document.getElementById(`field-${spec.name}`);
    if (typeof node.showModal === 'function') node.showModal();
    else node.setAttribute('open', '');
    // The keyboard starts on Close, not Use: a stray Enter then keeps the
    // URL instead of clearing it.
    node.querySelector('[data-url-vps-match-close]')?.focus();
  }

  // Moves the ID into the row's Manual VPSID box and clears the URL. Override
  // is ticked first when it is not: the box only exists under Override, and
  // ticking it through the row's own box runs the app's own rules for it.
  function useId(spec, id) {
    const node = dialog();
    returnFocus = null;
    runtime.state.callbacks?.onChange?.(spec.name, '');
    const config = CATEGORY_CONFIG[spec.category];
    if (runtime.state.values?.[config.overrideField] !== true) {
      document.querySelector(`#assetMatrix .asset-row[data-category="${spec.category}"] .override-toggle input`)?.click();
    }
    window.VPS_MANUAL_VPSID?.apply?.(spec.category, id);
    node.close();
    // The redraw rebuilt the row; the keyboard goes to the box that now
    // holds the ID.
    window.setTimeout(() => document.getElementById(`manualVpsId-${spec.category}`)?.focus(), 0);
  }

  // The wrong-type message under the box, beside the rulebook's dot.
  function render() {
    URL_FIELDS.forEach(spec => {
      const input = document.getElementById(`field-${spec.name}`);
      const wrapper = input?.closest('.field');
      if (!wrapper) return;
      let note = wrapper.querySelector(':scope > .url-vps-match-error');
      const result = input.disabled || document.activeElement === input ? { state: 'none' } : lookup(spec);
      if (result.state !== 'wrong') {
        note?.remove();
        return;
      }
      if (!note) {
        note = element('p', 'url-vps-match-error');
        note.id = `urlVpsMatchError-${spec.name}`;
        wrapper.appendChild(note);
      }
      if (note.textContent !== result.message) note.textContent = result.message;
    });
  }

  // A timeout, so the pasted text is in the box, or focus has landed
  // wherever it went.
  function check(spec) {
    // A load that failed is tried again here, as the Manual VPSID box does on
    // a commit, so a dropped connection does not end the check for the page.
    failed = false;
    window.setTimeout(() => {
      render();
      const result = lookup(spec);
      if (result.state === 'match' && shown.get(spec.name) !== result.key) openDialog(spec, result);
      else if (result.state === 'none' && loading) {
        // First use: the index is still loading. Check again once it is in.
        loading.then(() => {
          const later = lookup(spec);
          if (later.state === 'match' && shown.get(spec.name) !== later.key) openDialog(spec, later);
        });
      }
    }, 0);
  }

  // On leaving a URL box, and on pasting or dropping a link into one: a
  // pasted link is whole, so it is checked without waiting for the user to
  // leave (Jason, 2026-10-30). Typing waits for the leave, as a half-typed
  // link could match a shorter one.
  ['focusout', 'paste', 'drop'].forEach(type => document.addEventListener(type, event => {
    const spec = URL_FIELDS.find(candidate => event.target?.id === `field-${candidate.name}`);
    if (spec) check(spec);
  }));

  // Typing a different link lets its own pop-up show; going back to one
  // already shown does not bring it back until the page reloads.
  document.addEventListener('input', event => {
    const spec = URL_FIELDS.find(candidate => event.target?.id === `field-${candidate.name}`);
    if (spec && urlKey(event.target.value) !== shown.get(spec.name)) shown.delete(spec.name);
  });

  window.VPS_URL_OVERRIDE_LOOKUP = Object.freeze({ URL_FIELDS, urlKey, lookup, lookupUrl, issues, render, card, ready });
})();
