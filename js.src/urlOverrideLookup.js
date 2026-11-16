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
  // A tick: a link in an import's run already answered.
  const CHECK_ICON = svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>');

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

  // One asset: its picture, then its ID with Copy and Use on one row, then
  // table and type, version and authors. One match is laid out exactly as
  // each of several is (Jason, 2026-11-13: one look, cleaner and uniform).
  function assetBlock(spec, match, onUse) {
    const id = String(match.item.id);
    const block = element('section', 'url-vps-match-asset');
    const image = thumbnail(match.item);
    if (image) block.appendChild(image);
    const text = element('div', 'url-vps-match-text');
    const head = element('div', 'url-vps-match-head');
    const heading = element('h3', 'url-vps-match-heading', 'VPSID ');
    heading.appendChild(idText(id));
    head.append(heading, actionButtons(spec, id, onUse));
    text.appendChild(head);
    // The table's name alone: every asset on a card is the row's own type,
    // so the pop-up names the type once, in the badge by its title (Jason,
    // 2026-11-15). The editor's card sits under the ROM editor's box.
    text.appendChild(element('p', 'url-vps-match-name', match.record?.name || 'Unknown table'));
    const details = [
      match.item.version ? `v${match.item.version}` : '',
      authorsText(match.item.authors),
      match.broken ? 'link marked broken on VPS' : ''
    ].filter(Boolean).join(' · ');
    if (details) text.appendChild(element('p', 'url-vps-match-details', details));
    block.appendChild(text);
    return block;
  }

  function findingTitle(result) {
    return result.matches.length > 1 ? 'VPS Entries Found' : 'VPS Entry Found';
  }

  // Where the link was found, the assets, and what to do about it: the
  // pop-up's body and the card's.
  function findingBody(spec, result, onUse) {
    const several = result.matches.length > 1;
    return [
      element('p', 'url-vps-match-intro', 'The link provided was found in VPSDB.'),
      ...result.matches.map(match => assetBlock(spec, match, onUse)),
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
    row.appendChild(element('h3', 'url-vps-match-card-title', findingTitle(result)));
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
  // An import's run of links (askEach), while it is on screen: the pop-up
  // stays open from one link to the next, and Close, Esc and a click outside
  // answer the card shown instead of closing (Jason, 2026-11-15). answer is
  // set only while a card waits, so a click during the slide does nothing.
  let run = null;
  function decide(choice) {
    const done = run?.answer;
    if (!done) return;
    run.answer = null;
    done(choice);
  }
  function dismiss(node) {
    if (run) decide('close');
    else node.close();
  }
  function dialog() {
    let node = document.getElementById('urlVpsMatchDialog');
    if (node) return node;
    node = document.createElement('dialog');
    node.id = 'urlVpsMatchDialog';
    node.className = 'app-dialog url-vps-match-dialog';
    node.setAttribute('aria-labelledby', 'urlVpsMatchTitle urlVpsMatchType');
    node.innerHTML = `
      <div class="dialog-header">
        <div class="url-vps-match-titlebox" id="urlVpsMatchTitlebox">
          <p class="eyebrow" id="urlVpsMatchEyebrow">URL Override</p>
          <div class="url-vps-match-title-row"><h2 id="urlVpsMatchTitle">VPS Entry Found</h2><span class="url-vps-match-type" id="urlVpsMatchType"></span></div>
        </div>
        <button class="dialog-close" data-url-vps-match-close type="button" aria-label="Close and keep the URL">${CLOSE_ICON}</button>
      </div>
      <div class="url-vps-match-progress" id="urlVpsMatchProgress" hidden>
        <ol class="url-vps-match-dots" id="urlVpsMatchDots" aria-hidden="true"></ol>
        <p class="url-vps-match-step" id="urlVpsMatchStep" aria-live="polite"><span aria-hidden="true" id="urlVpsMatchStepShort"></span><span class="visually-hidden" id="urlVpsMatchStepSaid"></span></p>
        <button class="text-btn url-vps-match-close-all" id="urlVpsMatchCloseAll" type="button">Close All</button>
      </div>
      <div class="dialog-body url-vps-match-body" id="urlVpsMatchBody"></div>`;
    document.body.appendChild(node);
    node.querySelector('[data-url-vps-match-close]').addEventListener('click', () => dismiss(node));
    node.querySelector('#urlVpsMatchCloseAll').addEventListener('click', () => decide('all'));
    node.addEventListener('click', event => { if (event.target === node) dismiss(node); });
    // Esc answers the card during a run. Stopped at the key, not at the
    // cancel event: Chrome lets a page refuse only one Esc in a row there.
    node.addEventListener('keydown', event => {
      if (run && event.key === 'Escape') {
        event.preventDefault();
        decide('close');
      }
    });
    // Back to where the user was going, if the page still has it. Closed by
    // anything else mid-run, the run ends there.
    node.addEventListener('close', () => {
      if (run) run.ended = true;
      decide('ended');
      // A Use in a run may have rebuilt the box the keyboard came from; its
      // new copy carries the same id.
      let target = returnFocus;
      returnFocus = null;
      if (target && !target.isConnected && target.id) target = document.getElementById(target.id);
      if (target?.isConnected) target.focus();
    });
    return node;
  }

  // Puts one link's finding in the pop-up: the tab or ROM it came from, the
  // title, then where the link was found, each asset with its ID and buttons,
  // and what to do about it.
  function fill(node, spec, result, onUse) {
    shown.set(spec.name, result.key);
    node.querySelector('#urlVpsMatchEyebrow').textContent = `${spec.tab} URL Override`;
    node.querySelector('#urlVpsMatchTitle').textContent = findingTitle(result);
    node.querySelector('#urlVpsMatchType').textContent = typeLabel(spec.category);
    node.querySelector('#urlVpsMatchBody').replaceChildren(...findingBody(spec, result, onUse));
  }

  function show(node) {
    if (node.open) return;
    if (typeof node.showModal === 'function') node.showModal();
    else node.setAttribute('open', '');
  }

  // The keyboard starts on Close, not Use: a stray Enter then keeps the URL
  // instead of clearing it.
  function focusClose(node) {
    node.querySelector('[data-url-vps-match-close]')?.focus();
  }

  function focusBefore(spec) {
    return document.activeElement && document.activeElement !== document.body
      ? document.activeElement
      : document.getElementById(`field-${spec.name}`);
  }

  // One link, from leaving its box. Not shown while another dialog is open.
  function openDialog(spec, result) {
    const node = dialog();
    if (node.open || document.querySelector('dialog[open]')) return;
    node.querySelector('#urlVpsMatchProgress').hidden = true;
    fill(node, spec, result, useId);
    returnFocus = focusBefore(spec);
    show(node);
    focusClose(node);
  }

  // Moves the ID into the row's Manual VPSID box, ticking Override if need be,
  // and empties the tab's Override fields, URL included (VPS_MAIN.useVpsAsset).
  // False when nothing changed (no table, no ID): the card then stays, so Use
  // is not seen to do something it did not.
  function takeId(spec, id) {
    if (window.VPS_MAIN?.useVpsAsset?.(spec.category, id) !== true) return false;
    // The box is empty again, so any link put back in it is checked afresh:
    // emptying it from state fires no input event to forget the last one
    // (Jason, 2026-11-13: the same link pasted straight back opened nothing).
    shown.delete(spec.name);
    return true;
  }

  function useId(spec, id) {
    if (!takeId(spec, id)) return;
    returnFocus = null;
    dialog().close();
    // The redraw rebuilt the row; the keyboard goes to the box that now
    // holds the ID.
    window.setTimeout(() => document.getElementById(`manualVpsId-${spec.category}`)?.focus(), 0);
  }

  // The run's place: a dot per link, ticked once answered, and "2/3".
  // Shown only for more than one link, Close All with it.
  function paintProgress(node, step, total) {
    const bar = node.querySelector('#urlVpsMatchProgress');
    if (total < 2) {
      bar.hidden = true;
      return;
    }
    // The words first, then the row shown: a live region whose text arrives
    // as it appears is often not read out.
    // "2/4" on screen (Jason, 2026-11-15: shorter than "Link 2 of 4"); the
    // full words for a screen reader.
    node.querySelector('#urlVpsMatchStepShort').textContent = `${step + 1}/${total}`;
    node.querySelector('#urlVpsMatchStepSaid').textContent = `Link ${step + 1} of ${total}`;
    bar.hidden = false;
    node.querySelector('#urlVpsMatchDots').replaceChildren(...Array.from({ length: total }, (_, index) => {
      const dot = element('li', `url-vps-match-dot is-${index < step ? 'done' : index === step ? 'current' : 'waiting'}`);
      if (index < step) dot.innerHTML = CHECK_ICON;
      return dot;
    }));
  }

  // The answered card slides out to the left and the next slides in from the
  // right; with reduced motion asked for, it fades instead. The swap happens
  // between the two, unseen.
  async function slide(node, swap) {
    const parts = [node.querySelector('#urlVpsMatchTitlebox'), node.querySelector('#urlVpsMatchBody')];
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const move = still ? ['none', 'none'] : ['translateX(-28px)', 'translateX(28px)'];
    const play = (frames, duration) => Promise.all(parts.map(part => part.animate(frames, { duration, easing: 'ease-in-out' }).finished.catch(() => {})));
    await play([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: move[0] }], 140);
    swap();
    await play([{ opacity: 0, transform: move[1] }, { opacity: 1, transform: 'none' }], 180);
  }

  // Asks about each link in turn, in one pop-up that stays open for the
  // whole run. Use and Close answer a card; Close All keeps every URL not
  // yet answered and ends the run. Not shown while another dialog is open.
  async function askEach(queue) {
    const node = dialog();
    if (!queue.length || node.open || document.querySelector('dialog[open]')) return;
    run = { answer: null };
    // Back to the Import control when nothing had the keyboard (a dropped
    // file): the first link's box may be on a tab not showing.
    returnFocus = document.activeElement && document.activeElement !== document.body
      ? document.activeElement
      : document.getElementById('ymlImportInput');
    const put = (item, step) => {
      // A card's Use counts only while it waits, never during the slide.
      fill(node, item.spec, item.result, (_, id) => {
        if (run?.answer && item.take(id)) decide('use');
      });
      paintProgress(node, step, queue.length);
    };
    // Whatever happens in the run, it ends with the pop-up closed and run
    // cleared: left set by a throw, it would turn ×, Esc and a click outside
    // into answers to a card no longer waiting, and the modal could not be
    // closed (pr-checker, 2026-11-15).
    try {
      for (const [step, item] of queue.entries()) {
        if (step === 0) put(item, step);
        else await slide(node, () => put(item, step));
        if (run.ended) break;
        show(node);
        focusClose(node);
        const choice = await new Promise(resolve => { run.answer = resolve; });
        if (choice === 'ended') break;
        // Close All is an answer for the rest too: they are not asked about
        // again on leaving their boxes.
        if (choice === 'all') {
          queue.slice(step + 1).forEach(rest => shown.set(rest.spec.name, rest.result.key));
          break;
        }
      }
    } finally {
      run = null;
      if (node.open) node.close();
    }
  }

  // After a YML import (Jason, 2026-11-15): every URL Override the file
  // brought is looked up, the tabs' in tab order and then each Additional
  // ROM's, and the matches are asked about in one run (askEach). Close keeps
  // the URL; Use takes the asset, as it does when the link is pasted. A tab's
  // link asked about here is not asked about again on leaving its box
  // (shown). Wrong-type links get no pop-up: render puts their error under
  // the box. Each lookup touches only its own row, so the whole list is
  // known before the first card, and the counter is right from the start.
  async function checkImported() {
    await ready();
    const queue = [];
    for (const spec of URL_FIELDS) {
      const result = lookup(spec);
      if (result.state === 'match') queue.push({ spec, result, take: id => takeId(spec, id) });
    }
    const roms = window.VPS_ADDITIONAL_ROMS;
    if (roms?.URL_SPEC) {
      for (const [index, entry] of roms.entries().entries()) {
        const result = lookupUrl(entry.urlOverride, roms.URL_SPEC.category);
        if (result.state !== 'match') continue;
        const spec = { ...roms.URL_SPEC, name: `${roms.URL_SPEC.name}-${index}` };
        queue.push({ spec, result, take: id => roms.useUrlMatchAt(index, id) === true });
      }
    }
    // The wrong-type notes are drawn even when the run fails: the import
    // logs the fault and finishes, and its errors should still show.
    try {
      await askEach(queue);
    } finally {
      render();
    }
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

  window.VPS_URL_OVERRIDE_LOOKUP = Object.freeze({ URL_FIELDS, urlKey, lookup, lookupUrl, issues, render, card, ready, checkImported });
})();
