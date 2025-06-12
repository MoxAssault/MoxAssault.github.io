// script.js

const API_URLS = [
  'https://cdn.jsdelivr.net/gh/VirtualPinballSpreadsheet/vps-db@master/db/vpsdb.json',
  'https://raw.githubusercontent.com/VirtualPinballSpreadsheet/vps-db/master/db/vpsdb.json'
];

window.addEventListener('DOMContentLoaded', () => {
  const btn   = document.getElementById('searchBtn');
  const input = document.getElementById('idInput');
  btn.addEventListener('click', searchById);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchById();
  });
});

async function fetchVPSDB() {
  for (const url of API_URLS) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch {}
  }
  throw new Error('Failed to load VPS DB JSON');
}

async function searchById() {
  const rawID      = document.getElementById('idInput').value.trim();
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';

  if (!rawID) {
    resultsDiv.innerHTML = `<p class="error">Please enter a VPS Table ID.</p>`;
    return;
  }
  resultsDiv.innerHTML = `<p>Searching for “${rawID}”…</p>`;

  try {
    const data = await fetchVPSDB();

    // locate record by `id`
    const record = Array.isArray(data)
      ? data.find(r => r.id?.toLowerCase() === rawID.toLowerCase())
      : null;

    if (!record) {
      resultsDiv.innerHTML = `<p class="error">No entries found for “${rawID}”.</p>`;
      return;
    }

    // ---- build the game card ----
    const card = document.createElement('div');
    card.className = 'game-card';

    // cover image
    if (record.imgUrl) {
      const cover = document.createElement('img');
      cover.className = 'game-cover';
      cover.src = record.imgUrl;
      cover.alt = record.name || rawID;
      card.appendChild(cover);
    }

    // info panel
    const info = document.createElement('div');
    info.className = 'game-info';

    const title = document.createElement('h2');
    title.textContent = record.name || rawID;
    info.appendChild(title);

    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = [
      record.type && `Type: ${record.type}`,
      record.year && `Year: ${record.year}`,
      record.manufacturer && `Manufacturer: ${record.manufacturer}`
    ].filter(Boolean).join(' | ');
    info.appendChild(meta);

    if (Array.isArray(record.theme) && record.theme.length) {
      const tagsDiv = document.createElement('div');
      tagsDiv.className = 'tags';
      record.theme.forEach(t => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = t;
        tagsDiv.appendChild(span);
      });
      info.appendChild(tagsDiv);
    }

    card.appendChild(info);
    resultsDiv.innerHTML = '';
    resultsDiv.appendChild(card);

    // ---- now the category dropdowns + displays ----
    const groupKeys = [
      'tableFiles',
      'b2sFiles',
      'pupPackFiles',
      'wheelArtFiles',
      'topperFiles'
    ];

    groupKeys.forEach(group => {
      const items = record[group];
      if (!Array.isArray(items) || items.length === 0) return;

      // label
      const label = document.createElement('label');
      label.className = 'category-label';
      label.textContent = group
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase());
      resultsDiv.appendChild(label);

      // dropdown
      const select = document.createElement('select');
      const placeholder = document.createElement('option');
      placeholder.textContent = `Select a ${label.textContent.replace(/s$/, '')}`;
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);

      items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.id;
        select.appendChild(opt);
      });

      // display container
      const display = document.createElement('div');
      display.className = 'item-display';

      select.addEventListener('change', () => {
        display.innerHTML = '';
        const selectedId = select.value;
        const item = items.find(i => i.id === selectedId);
        if (!item) return;

        // image if available
        if (item.imgUrl) {
          const img = document.createElement('img');
          img.src = item.imgUrl;
          img.alt = selectedId;
          display.appendChild(img);
        }

        // metadata
        const dl = document.createElement('dl');
        Object.entries(item).forEach(([key, val]) => {
          if (['id','_group','imgUrl'].includes(key)) return;
          const dt = document.createElement('dt');
          dt.textContent = key;
          const dd = document.createElement('dd');
          if (Array.isArray(val)) {
            dd.textContent = val.join(', ');
          } else if (key === 'urls' && Array.isArray(val)) {
            const a = document.createElement('a');
            a.href = val[0].url;
            a.textContent = val[0].url;
            a.target = '_blank';
            dd.appendChild(a);
          } else {
            dd.textContent = val;
          }
          dl.appendChild(dt);
          dl.appendChild(dd);
        });
        display.appendChild(dl);
      });

      resultsDiv.appendChild(select);
      resultsDiv.appendChild(display);
    });

  } catch (err) {
    console.error(err);
    resultsDiv.innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}
