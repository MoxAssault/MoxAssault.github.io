const API_URLS = [
  'https://cdn.jsdelivr.net/gh/VirtualPinballSpreadsheet/vps-db@master/db/vpsdb.json',
  'https://raw.githubusercontent.com/VirtualPinballSpreadsheet/vps-db/master/db/vpsdb.json'
];

const YML_FIELDS = [
  {name: 'applyFixes',                type: 'array'},
  {name: 'backglassAuthorsOverride',  type: 'array'},
  {name: 'backglassBundled',          type: 'bool'},
  {name: 'backglassChecksum',         type: 'str'},
  {name: 'backglassImageOverride',    type: 'str'},
  {name: 'backglassNotes',            type: 'str'},
  {name: 'backglassUrlOverride',      type: 'str'},
  {name: 'backglassVPSId',            type: 'str'},
  {name: 'coloredROMBundled',         type: 'bool'},
  {name: 'coloredROMChecksum',        type: 'str'},
  {name: 'coloredROMNotes',           type: 'str'},
  {name: 'coloredROMUrlOverride',     type: 'str'},
  {name: 'coloredROMVersionOverride', type: 'str'},
  {name: 'coloredROMVPSId',           type: 'str'},
  {name: 'enabled',                   type: 'bool'},
  {name: 'fps',                       type: 'int'},
  {name: 'mainNotes',                 type: 'str', multiline: true},
  {name: 'pupArchiveFormat',          type: 'str'},
  {name: 'pupArchiveRoot',            type: 'str'},
  {name: 'pupChecksum',               type: 'str'},
  {name: 'pupFileUrl',                type: 'str'},
  {name: 'pupNotes',                  type: 'str'},
  {name: 'pupRequired',               type: 'bool'},
  {name: 'pupVersion',                type: 'str'},
  {name: 'romBundled',                type: 'bool'},
  {name: 'romChecksum',               type: 'str'},
  {name: 'romNotes',                  type: 'str'},
  {name: 'romUrlOverride',            type: 'str'},
  {name: 'romVersionOverride',        type: 'str'},
  {name: 'romVPSId',                  type: 'str'},
  {name: 'tableNameOverride',         type: 'str'},
  {name: 'tableNotes',                type: 'str'},
  {name: 'tableVPSId',                type: 'str'},
  {name: 'tagline',                   type: 'str', multiline: true},
  {name: 'testers',                   type: 'array'},
  {name: 'vpxChecksum',               type: 'str'},
  {name: 'vpxVPSId',                  type: 'str'},
];
// MANDATORY, BUNDLE, and FIELD GROUP ARRAYS
const YML_MANDATORY_FIELDS = [
  {name: 'applyFixes', type: 'array'},
  {name: 'enabled',    type: 'bool'},
  {name: 'fps',        type: 'int'},
  {name: 'mainNotes',  type: 'str', multiline: true},
  {name: 'tagline',    type: 'str', multiline: true},
  {name: 'testers',    type: 'array'}
];
const YML_BUNDLE_FIELDS = [
  {name: 'backglassBundled', type: 'bool'},
  {name: 'romBundled',       type: 'bool'},
  {name: 'coloredROMBundled',type: 'bool'}
];
const TABLE_FIELDS = [
  {name: 'tableVPSId',        type: 'str'},
  {name: 'tableNotes',        type: 'str'},
  {name: 'tableNameOverride', type: 'str'}
];
const VPX_FIELDS = [
  {name: 'vpxVPSId',   type: 'str'},
  {name: 'vpxChecksum',type: 'str'}
];
const B2S_FIELDS = [
  {name: 'backglassVPSId',         type: 'str'},
  {name: 'backglassChecksum',      type: 'str'},
  {name: 'backglassNotes',         type: 'str'},
  {name: 'backglassAuthorsOverride',type:'array'},
  {name: 'backglassImageOverride', type: 'str'},
  {name: 'backglassUrlOverride',   type: 'str'}
];
const ROM_FIELDS = [
  {name: 'romVPSId',         type: 'str'},
  {name: 'romChecksum',      type: 'str'},
  {name: 'romNotes',         type: 'str'},
  {name: 'romUrlOverride',   type: 'str'},
  {name: 'romVersionOverride',type:'str'}
];
const COLOR_ROM_FIELDS = [
  {name: 'coloredROMVPSId',         type: 'str'},
  {name: 'coloredROMChecksum',      type: 'str'},
  {name: 'coloredROMNotes',         type: 'str'},
  {name: 'coloredROMUrlOverride',   type: 'str'},
  {name: 'coloredROMVersionOverride',type:'str'}
];
const PUP_FIELDS = [
  {name: 'pupRequired',     type: 'bool'},
  {name: 'pupVersion',      type: 'str'},
  {name: 'pupChecksum',     type: 'str'},
  {name: 'pupNotes',        type: 'str'},
  {name: 'pupFileUrl',      type: 'str'},
  {name: 'pupArchiveFormat',type: 'str'},
  {name: 'pupArchiveRoot',  type: 'str'}
];


let vpsCache = null;
let lastSuggestions = [];
let activeSuggestionIndex = -1;

// Fetch VPS DB JSON from Multiple Sources to Ensure Availability
/**
  * Fetches the VPS DB JSON from multiple URLs and caches the result.
  * Returns the cached data if available, otherwise fetches from the first successful URL.
  * Throws an error if all fetch attempts fail.
**/
async function fetchVPSDB() {
  if (vpsCache) return vpsCache;
  for (const url of API_URLS) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        vpsCache = await resp.json();
        return vpsCache;
      }
    } catch (e) {
      console.warn(`Failed to fetch from ${url}: ${e}`);
    }
  }
  throw new Error('Failed to load VPS DB JSON');
}

// Humanize Keys for Headers (e.g. "tableFiles" -> "Table Files")
function humanize(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

// Initialize on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('searchBtn');
  const input = document.getElementById('idInput');
  const suggestions = document.getElementById('suggestions');
  const floatContainer = document.getElementById('searchFloatContainer');
  const closeBtn = document.getElementById('closeSearch');

  btn.addEventListener('click', searchById);
  // Handle Enter Key on Input
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && lastSuggestions.length) {
        // Select current suggestion
        input.value = lastSuggestions[activeSuggestionIndex].id;
        suggestions.classList.remove('active');
        searchById();
        e.preventDefault();
      } else {
        searchById();
      }
    }
    // Handle Up/Down for Suggestions
    if (['ArrowDown', 'ArrowUp'].includes(e.key) && lastSuggestions.length) {
      e.preventDefault();
      if (e.key === 'ArrowDown') {
        activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, lastSuggestions.length - 1);
      } else {
        activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
      }
      updateSuggestionsUI();
    }
    // Handle Escape to Close Suggestions
    if (e.key === 'Escape') {
      suggestions.classList.remove('active');
    }
  });

  // Handle Input for Suggestions
  input.addEventListener('input', async () => {
    const val = input.value.trim().toLowerCase();
    suggestions.innerHTML = '';
    lastSuggestions = [];
    activeSuggestionIndex = -1;
    if (!val) {
      suggestions.classList.remove('active');
      return;
    }
    const data = await fetchVPSDB();
    // Show up to 8 matches by name or id
    lastSuggestions = data.filter(
      r => r.id?.toLowerCase().includes(val) || r.name?.toLowerCase().includes(val)
    ).slice(0, 8);
    if (lastSuggestions.length) {
      suggestions.classList.add('active');
      updateSuggestionsUI();
    } else {
      suggestions.classList.remove('active');
    }
  });

  // Handle Clicks on Suggestions
  document.addEventListener('click', (e) => {
    // Hide suggestions if click outside
    if (!suggestions.contains(e.target) && e.target !== input) {
      suggestions.classList.remove('active');
    }
  });

  // Handle Mouseover for Suggestions
  function updateSuggestionsUI() {
    suggestions.innerHTML = '';
    lastSuggestions.forEach((s, i) => {
      const div = document.createElement('div');
      div.className = 'suggestion-item' + (i === activeSuggestionIndex ? ' active' : '');
      div.textContent = `${s.name || '[No Name]'} (${s.id})`;
      div.addEventListener('mousedown', (e) => {
        input.value = s.id;
        suggestions.classList.remove('active');
        searchById();
        e.preventDefault();
      });
      suggestions.appendChild(div);
    });
  }

  // Close button logic for mobile
  closeBtn.addEventListener('click', () => {
    floatContainer.style.display = 'none';
    let openBtn = document.getElementById('openSearch');
    if (!openBtn) {
      openBtn = document.createElement('button');
      openBtn.id = 'openSearch';
      openBtn.className = 'open-btn';
      openBtn.title = 'Open Search';
      openBtn.innerHTML = '<span style="font-size:1.6em;">&#128269;</span>';
      document.body.appendChild(openBtn);
    }
    openBtn.style.display = 'block';
    openBtn.onclick = () => {
      floatContainer.style.display = '';
      openBtn.style.display = 'none';
    };
  });
});

// Function to Search by Table ID
async function searchById() {
  const rawID = document.getElementById('idInput').value.trim();
  const gameCardContainer = document.getElementById('gameCardContainer');
  const categoryGrid = document.getElementById('categoryGrid');
  // Reset UI
  gameCardContainer.innerHTML = '';
  categoryGrid.innerHTML = '';
  categoryGrid.className = 'two-per-row';
  // Validate Input
  if (!rawID) {
    document.getElementById('idInput').placeholder = '!! Please enter a VPS Table ID !!';
    return;
  }
  gameCardContainer.innerHTML = `<p>Searching for “${rawID}”…</p>`;
  // Fetch Database to Find Table ID
  let record;
  try {
    const data = await fetchVPSDB();
    record = Array.isArray(data)
      ? data.find(r => r.id?.toLowerCase() === rawID.toLowerCase())
      : null;
  } catch (err) {
    gameCardContainer.innerHTML = `<p class="error">Error: ${err.message}</p>`;
    return;
  }
  // If No Table Found
  if (!record) {
    gameCardContainer.innerHTML = `<p class="error">No entries found for “${rawID}”.</p>`;
    return;
  }
  
  // Build Game Card
  const groupKeys = [
    'tableFiles',
    'b2sFiles',
    'romFiles',
    'altColorFiles',
    'pupPackFiles',
    'mediaPackFiles'
  ];
  const card = document.createElement('div');
  card.className = 'game-card';
  // Left : Cover Image
  const leftCol = document.createElement('div');
  leftCol.className = 'card-left';
  let coverUrl = record.imgUrl ||
    groupKeys.map(g => record[g]?.[0]?.imgUrl).find(u => u);
  if (coverUrl) {
    // Main thumb
    const thumb = document.createElement('img');
    thumb.className = 'game-thumb';
    thumb.src = coverUrl;
    thumb.alt = record.name || rawID;
    leftCol.appendChild(thumb);
    // Pop-out preview
    const preview = document.createElement('img');
    preview.className = 'main-thumb-preview';
    preview.src = coverUrl;
    preview.alt = record.name || rawID;
    leftCol.appendChild(preview);
  }
  card.appendChild(leftCol);

  // Middle : Info Panel
  const info = document.createElement('div');
  info.className = 'game-info';
  ////// Title
  const title = document.createElement('h2');
  title.textContent = record.name || rawID;
  info.appendChild(title);
  ////// Meta Box Container
  const metaBoxes = document.createElement('div');
  metaBoxes.className = 'meta-boxes';
  //////////// Manufacturer (Year)
  const manufBox = document.createElement('div');
  manufBox.classList.add('meta-box');
  manufBox.classList.add('meta-left');
  let manufacturer = record.manufacturer || '';
  let year = record.year ? ` (${record.year})` : '';
  manufBox.textContent = `${manufacturer}${year}`;
  //////////// Updated
  const updatedBox = document.createElement('div');
  updatedBox.classList.add('meta-box');
  updatedBox.classList.add('meta-middle');
  const updatedAt = record.updatedAt
    ? (new Date(record.updatedAt)).toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric'})
    : '';
  updatedBox.textContent = updatedAt ? `Updated: ${updatedAt}` : '';
  //////////// VPS ID
  const idBox = document.createElement('div');
  idBox.classList.add('meta-box');
  idBox.classList.add('meta-right');
  idBox.textContent = record.id || '';
  ////// Add to Container
  metaBoxes.appendChild(manufBox);
  metaBoxes.appendChild(updatedBox);
  metaBoxes.appendChild(idBox);
  info.appendChild(metaBoxes);
  ////// Meta Tags
  if (Array.isArray(record.theme)) {
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'tags';
    record.theme.forEach(tag => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = tag;
      tagsDiv.appendChild(span);
    });
    info.appendChild(tagsDiv);
  }
  card.appendChild(info);

  // Right : Compile Button
  const btnCol = document.createElement('div');
  btnCol.className = 'card-btncol';
  const compileBtn = document.createElement('button');
  compileBtn.id = 'compileBtn';
  compileBtn.className = 'compile-btn';
  compileBtn.textContent = 'LFG!!';
  compileBtn.disabled = true;
  btnCol.appendChild(compileBtn);
  card.appendChild(btnCol);
  // Clear and Insert New Card
  gameCardContainer.innerHTML = '';
  gameCardContainer.appendChild(card);

  // Date formatter
  const formatDate = ts => {
    try {
      return new Date(ts).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch {
      return ts;
    }
  };

  // Render categories
  const present = groupKeys.filter(g => Array.isArray(record[g]) && record[g].length);
  present.forEach(group => {
    const items = record[group];
    const container = document.createElement('div');
    container.className = 'category-container';
    ////// Header
    const lbl = document.createElement('label');
    lbl.className = 'category-label';
    lbl.textContent = humanize(group);
    container.appendChild(lbl);
    ////// Dropdown
    const select = document.createElement('select');
    const placeholder = document.createElement('option');
    placeholder.textContent = `Select a ${humanize(group).slice(0,-1)}`;
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);
    ////// Edit non-Table/B2S Dropdown : Make Full Width
    if (group !== 'tableFiles' && group !== 'b2sFiles') {
      select.classList.add('fullwidth-select');
    }
    ////// Option creation -- robust "broken" check
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.id;
      ////// Multi-level Detection for "broken" Options (top or nested in urls)
      let isBroken = false;
      if (item.broken === true || item.broken === "true") isBroken = true;
      if (!isBroken && item.urls) {
        if (Array.isArray(item.urls)) {
          isBroken = item.urls.some(
            u => (u && (u.broken === true || u.broken === "true"))
          );
        } else if (typeof item.urls === 'object') {
          isBroken = Object.values(item.urls).some(
            u => (u && (u.broken === true || u.broken === "true"))
          );
        }
      }
      ////// If Broken, Mark Option as Disabled and Add "(Broken)"
      if (isBroken) {
        opt.disabled = true;
        opt.textContent += ' (❌Broken)';
        opt.className = 'broken-option';
      }
    ////// Add select to container
      select.appendChild(opt);
    });
    container.appendChild(select);

    //=== Details Panel (with thumbnail image) ===//
    let thumb, preview;
    if (group === 'tableFiles' || group === 'b2sFiles') {
      const thumbWrap = document.createElement('span');
      thumbWrap.className = 'thumbnail-wrapper';
      ////// Small Thumb
      thumb = document.createElement('img');
      thumb.className = 'thumb-small';
      thumb.alt = '';
      thumbWrap.appendChild(thumb);
      ////// Hidden Preview
      preview = document.createElement('img');
      preview.className = 'thumb-preview';
      preview.alt = '';
      thumbWrap.appendChild(preview);
      container.appendChild(thumbWrap);
    }
    ////// Details Panel (no full-size image)
    const display = document.createElement('div');
    display.className = 'item-display';
    container.appendChild(display);

    //=== Event Listener for Dropdown Change ===//
    select.addEventListener('change', () => {
      display.innerHTML = '';
      const item = items.find(i => i.id === select.value);
      if (!item) return;
      ////// Update Thumbnail & Preview
      if (thumb)   thumb.src   = item.imgUrl || '';
      if (preview) preview.src = item.imgUrl || '';
      ////// Metadata List
      const dl = document.createElement('dl');
      ////// Date Row
      const dateRow = document.createElement('div');
      dateRow.className = 'date';
      ['createdAt','updatedAt'].forEach(key => {
        if (item[key]) {
          const w = document.createElement('div');
          const dt = document.createElement('dt');
          dt.textContent = `${humanize(key.replace(/At$/, ''))}:  ${formatDate(item[key])}`;
          w.appendChild(dt);
          dateRow.appendChild(w);
        }
      });
      display.appendChild(dateRow);
      ////// Field Appender
      const appendField = (k, v) => {
        if (['authors','features','tableFormat','version'].includes(k)) {
          const dt = document.createElement('dt');
          dt.textContent = humanize(k);
          dl.appendChild(dt);

          const wrap = document.createElement('div');
          wrap.className = 'bubble-group';

          const arr = Array.isArray(v) ? v : [v];
          if (arr.length <= 4) {
            // Show all if 4 or fewer
            arr.forEach(val => {
              const b = document.createElement('span');
              b.className = 'bubble';
              b.textContent = val;
              wrap.appendChild(b);
            });
          } else {
            // Show 3, then "+QTY More" bubble for the rest
            arr.slice(0,3).forEach(val => {
              const b = document.createElement('span');
              b.className = 'bubble';
              b.textContent = val;
              wrap.appendChild(b);
            });

            const moreBubble = document.createElement('span');
            moreBubble.className = 'bubble bubble-more';
            moreBubble.textContent = `+${arr.length-3} More`;
            moreBubble.tabIndex = 0;
            // Pop-out container
            const popout = document.createElement('div');
            popout.className = 'bubble-popout';
            arr.slice(3).forEach(val => {
              const li = document.createElement('div');
              li.className = 'bubble';
              li.textContent = val;
              popout.appendChild(li);
            });
            moreBubble.appendChild(popout);
            // Open on click, close on mouseleave or blur ---
            moreBubble.addEventListener('click', (e) => {
              e.stopPropagation();
              // Toggle visibility
              const isVisible = popout.style.display === 'block';
              document.querySelectorAll('.bubble-popout').forEach(p => p.style.display = 'none'); // close others
              popout.style.display = isVisible ? 'none' : 'block';
            });
            moreBubble.addEventListener('mouseleave', () => {
              popout.style.display = 'none';
            });
            // Also close on keyboard blur (accessibility)
            moreBubble.addEventListener('blur', () => {
              popout.style.display = 'none';
            });
            // Optional: clicking elsewhere closes all popouts
            document.body.addEventListener('click', () => {
              popout.style.display = 'none';
            });
            wrap.appendChild(moreBubble);
          }
          const dd = document.createElement('dd');
          dd.appendChild(wrap);
          dl.appendChild(dd);
          return;
        }
        if (['game','urls','imgUrl','createdAt','updatedAt'].includes(k)) return;
        const dt = document.createElement('dt');
        dt.textContent = humanize(k);
        const dd = document.createElement('dd');
        dd.textContent = Array.isArray(v) ? v.join(', ') : v;
        dl.appendChild(dt);
        dl.appendChild(dd);
      };
      ////// 1) Badge fields
      ['authors','features','tableFormat','version'].forEach(k => {
        if (item[k]) appendField(k, item[k]);
      });
      ////// 2) Other fields
      Object.keys(item)
        .filter(k => !['id','_group','game','urls','imgUrl','createdAt','updatedAt','authors','features','tableFormat','version','comment'].includes(k))
        .sort()
        .forEach(k => appendField(k, item[k]));
      ////// 3) Append all fields first
      display.appendChild(dl);
      ////// 4) Comment last, as a BOX with label
      if (item.comment) {
        const commentLabel = document.createElement('div');
        commentLabel.className = 'comment-label';
        commentLabel.textContent = 'Comments';
        display.appendChild(commentLabel);

        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment-box';
        commentDiv.textContent = item.comment;
        display.appendChild(commentDiv);
      }
    });

    categoryGrid.appendChild(container);
  });

  // Check for Selection from any Dropdown
  function checkIfAnySelected() {
    const selects = categoryGrid.querySelectorAll('select');
    for (const sel of selects) {
      if (sel.value && sel.selectedIndex > 0 && !sel.options[sel.selectedIndex].disabled) {
        return true;
      }
    }
    return false;
  }

  // Listen for changes in ALL dropdowns to enable/disable compile button
  categoryGrid.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', () => {
      compileBtn.disabled = !checkIfAnySelected();
    });
  });

  // --- MODAL LOGIC FOR SUBMIT --- //
  compileBtn.onclick = (e) => {
    e.preventDefault();
    // 1. Gather selected values
  const selects = categoryGrid.querySelectorAll('select');
  let selectedGroups = {}; // eg: {tableFiles: <id>, b2sFiles: <id>, ...}
  selects.forEach(sel => {
    if (
      sel.value &&
      sel.selectedIndex > 0 &&
      !sel.options[sel.selectedIndex].disabled
    ) {
      const container = sel.closest('.category-container');
      const label = container ? container.querySelector('.category-label')?.textContent : '';
      const group = (label || '').toLowerCase().replace(/\s+/g,'');
      selectedGroups[group] = sel.value;
    }
  });

  // 2. Open modal and render
  const overlay = document.getElementById('modalOverlay');
  const fieldsDiv = document.getElementById('modalFields');
  fieldsDiv.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'modal-fields-grid';

  // --- Helper function to add a section header
  const addHeader = txt => {
    const hdr = document.createElement('div');
    hdr.textContent = txt;
    hdr.className = 'modal-section-header';
    hdr.style.gridColumn = '1/-1';
    hdr.style.margin = '0.7em 0 0.25em 0';
    hdr.style.fontWeight = 'bold';
    hdr.style.fontSize = '1.12em';
    hdr.style.color = '#47cfff';
    grid.appendChild(hdr);
  };

  // --- Add mandatory fields
  addHeader('Mandatory Fields');
  YML_MANDATORY_FIELDS.forEach(field => addYMLFieldInput(field, grid));

  // --- Add Bundles
  addHeader('Bundles');
  YML_BUNDLE_FIELDS.forEach(field => addYMLFieldInput(field, grid));

  // --- TABLE FIELDS (always shown, filled with the original searched ID)
  addHeader('Table Fields');
  TABLE_FIELDS.forEach(field => addYMLFieldInput(field, grid));

  // --- VPX (Table File) if selected
  if (selectedGroups.tablefiles) {
    addHeader('VPX File Fields');
    VPX_FIELDS.forEach(field => addYMLFieldInput(field, grid));
  }
  // --- B2S (Backglass) if selected
  if (selectedGroups.b2sfiles) {
    addHeader('Backglass (B2S) Fields');
    B2S_FIELDS.forEach(field => addYMLFieldInput(field, grid));
  }
  // --- ROM if selected
  if (selectedGroups.romfiles) {
    addHeader('ROM Fields');
    ROM_FIELDS.forEach(field => addYMLFieldInput(field, grid));
  }
  // --- COLORED ROM if selected
  if (selectedGroups.altcolorfiles) {
    addHeader('Colored ROM Fields');
    COLOR_ROM_FIELDS.forEach(field => addYMLFieldInput(field, grid));
  }
  // --- PUP if selected
  if (selectedGroups.puppackfiles) {
    addHeader('PUP Pack Fields');
    PUP_FIELDS.forEach(field => addYMLFieldInput(field, grid));
  }

  fieldsDiv.appendChild(grid);

  overlay.style.display = 'flex';

  document.getElementById('modalClose').onclick = () => {
    overlay.style.display = 'none';
  };
  overlay.onclick = (evt) => {
    if (evt.target === overlay) overlay.style.display = 'none';
  };

  // --- On submit, output as YML
  const modalForm = document.getElementById('modalForm');
  modalForm.onsubmit = (evt) => {
    evt.preventDefault();
    let yml = "---\n";
    // Gather all inputs, in display order
    grid.querySelectorAll('[name]').forEach(el => {
      const name = el.name;
      let val;
      if (el.type === "checkbox") {
        val = el.checked ? true : false;
        yml += `${name}: ${val}\n`;
      } else if (el.type === "number") {
        val = el.value.trim();
        if (val !== "") yml += `${name}: ${parseInt(val)}\n`;
      } else if (el.classList.contains('modal-input-array')) {
        val = el.value.trim();
        if (val) {
          const arr = val.split('\n').map(v=>v.trim()).filter(Boolean);
          if (arr.length > 0) {
            yml += `${name}:\n`;
            arr.forEach(item => yml += `  - '${item.replace(/'/g, "''")}'\n`);
          }
        }
      } else {
        val = el.value;
        if (val && val.indexOf('\n') >= 0) {
          yml += `${name}: |-\n  ${val.replace(/\n/g,"\n  ").replace(/'/g,"''")}\n`;
        } else if (val) {
          yml += `${name}: '${val.replace(/'/g,"''")}'\n`;
        }
      }
    });
    const blob = new Blob([yml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'table-config.yml';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    overlay.style.display = 'none';
  };
};
}
