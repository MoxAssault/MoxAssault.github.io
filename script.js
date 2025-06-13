// script.js

const API_URLS = [
  'https://cdn.jsdelivr.net/gh/VirtualPinballSpreadsheet/vps-db@master/db/vpsdb.json',
  'https://raw.githubusercontent.com/VirtualPinballSpreadsheet/vps-db/master/db/vpsdb.json'
];

window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('searchBtn');
  const input = document.getElementById('idInput');
  btn.addEventListener('click', searchById);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchById();
  });
});

async function fetchVPSDB() {
  for (const url of API_URLS) {
    try {
      const resp = await fetch(url);
      if (resp.ok) return await resp.json();
    } catch (e) {
      console.warn(`Failed to fetch from ${url}: ${e}`);
    }
  }
  throw new Error('Failed to load VPS DB JSON');
}

function humanize(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

async function searchById() {
  const rawID = document.getElementById('idInput').value.trim();
  const gameCardContainer = document.getElementById('gameCardContainer');
  const categoryGrid = document.getElementById('categoryGrid');

  // Reset UI
  gameCardContainer.innerHTML = '';
  categoryGrid.innerHTML = '';
  categoryGrid.className = 'two-per-row';

  if (!rawID) {
    gameCardContainer.innerHTML = `<p class="error">Please enter a VPS Table ID.</p>`;
    return;
  }
  gameCardContainer.innerHTML = `<p>Searching for “${rawID}”…</p>`;

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

  if (!record) {
    gameCardContainer.innerHTML = `<p class="error">No entries found for “${rawID}”.</p>`;
    return;
  }

  // Build game card
  const groupKeys = [
    'tableFiles','b2sFiles','romFiles',
    'altColorFiles','pupPackFiles','mediaPackFiles'
  ];
  let coverUrl = record.imgUrl ||
    groupKeys.map(g => record[g]?.[0]?.imgUrl).find(u => u);
  const card = document.createElement('div');
  card.className = 'game-card';
  if (coverUrl) {
    const img = document.createElement('img');
    img.className = 'game-cover';
    img.src = coverUrl;
    img.alt = record.name || rawID;
    card.appendChild(img);
  }
  const info = document.createElement('div');
  info.className = 'game-info';
  // Title
  const title = document.createElement('h2');
  title.textContent = record.name || rawID;
  info.appendChild(title);
  // Meta line
  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = [
    record.type && `Type: ${record.type}`,
    record.year && `Year: ${record.year}`,
    record.manufacturer && `Manufacturer: ${record.manufacturer}`
  ].filter(Boolean).join(' | ');
  info.appendChild(meta);
  // Theme tags
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

    // Header
    const lbl = document.createElement('label');
    lbl.className = 'category-label';
    lbl.textContent = humanize(group);
    container.appendChild(lbl);

    // Dropdown
    const select = document.createElement('select');
    const placeholder = document.createElement('option');
    placeholder.textContent = `Select a ${humanize(group).slice(0,-1)}`;
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.id;
      select.appendChild(opt);
    });
    container.appendChild(select);

    // Thumbnail only for tableFiles & b2sFiles
    let thumb, preview;
    if (group === 'tableFiles' || group === 'b2sFiles') {
      const thumbWrap = document.createElement('span');
      thumbWrap.className = 'thumbnail-wrapper';

      // small thumb
      thumb = document.createElement('img');
      thumb.className = 'thumb-small';
      thumb.alt = '';
      thumbWrap.appendChild(thumb);

      // hidden preview
      preview = document.createElement('img');
      preview.className = 'thumb-preview';
      preview.alt = '';
      thumbWrap.appendChild(preview);

      container.appendChild(thumbWrap);
    }

    // Details panel (no full-size image)
    const display = document.createElement('div');
    display.className = 'item-display';
    container.appendChild(display);

    select.addEventListener('change', () => {
      display.innerHTML = '';
      const item = items.find(i => i.id === select.value);
      if (!item) return;

      // update thumbnail & preview
      if (thumb)   thumb.src   = item.imgUrl || '';
      if (preview) preview.src = item.imgUrl || '';

      // metadata list
      const dl = document.createElement('dl');

      // Date row
      const dateRow = document.createElement('div');
      dateRow.style.display = 'flex';
      dateRow.style.justifyContent = 'space-between';
      dateRow.style.gap = '1rem';
      dateRow.style.marginBottom = '1rem';
      ['createdAt','updatedAt'].forEach(key => {
        if (item[key]) {
          const w = document.createElement('div');
          const dt = document.createElement('dt');
          dt.textContent = humanize(key.replace(/At$/, ''));
          const dd = document.createElement('dd');
          dd.textContent = formatDate(item[key]);
          w.appendChild(dt);
          w.appendChild(dd);
          dateRow.appendChild(w);
        }
      });
      display.appendChild(dateRow);

      // Field appender
      const appendField = (k, v) => {
        if (['authors','features','tableFormat','version'].includes(k)) {
          const dt = document.createElement('dt');
          dt.textContent = humanize(k);
          dl.appendChild(dt);
          const wrap = document.createElement('div');
          wrap.className = 'bubble-group';
          (Array.isArray(v) ? v : [v]).forEach(val => {
            const b = document.createElement('span');
            b.className = 'bubble';
            b.textContent = val;
            wrap.appendChild(b);
          });
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

      // 1) Badge fields
      ['authors','features','tableFormat','version'].forEach(k => {
        if (item[k]) appendField(k, item[k]);
      });
      // 2) Other fields
      Object.keys(item)
        .filter(k => !['id','_group','game','urls','imgUrl','createdAt','updatedAt','authors','features','tableFormat','version','comment'].includes(k))
        .sort()
        .forEach(k => appendField(k, item[k]));
      // 3) Comment last, as a BOX
      if (item.comment) {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment-box';
        commentDiv.textContent = item.comment;
        display.appendChild(commentDiv);
      }

      display.appendChild(dl);
    });

    categoryGrid.appendChild(container);
  });
}
