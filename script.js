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
    } catch (e) {
      console.warn(`Failed to fetch from ${url}: ${e}`);
    }
  }
  throw new Error('Failed to load VPS DB JSON');
}

// Utility to humanize keys
function humanize(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, s => s.toUpperCase());
}

async function searchById() {
  const rawID      = document.getElementById('idInput').value.trim();
  const resultsDiv = document.getElementById('results');
  resultsDiv.classList.remove('two-per-row','three-per-row');
  resultsDiv.innerHTML = '';

  if (!rawID) {
    resultsDiv.innerHTML = `<p class=\"error\">Please enter a VPS Table ID.</p>`;
    return;
  }

  resultsDiv.innerHTML = `<p>Searching for “${rawID}”…</p>`;

  try {
    const data = await fetchVPSDB();
    const record = Array.isArray(data)
      ? data.find(r => r.id?.toLowerCase() === rawID.toLowerCase())
      : null;

    if (!record) {
      resultsDiv.innerHTML = `<p class=\"error\">No entries found for “${rawID}”.</p>`;
      return;
    }

    // Clear loading text
    resultsDiv.innerHTML = '';

    // Define categories
    const groupKeys = [
      'tableFiles',
      'b2sFiles',
      'pupPackFiles',
      'mediaPackFiles',
      'romFiles'
    ];

    // Determine cover image URL: top-level or first available in file groups
    let coverUrl = record.imgUrl;
    if (!coverUrl) {
      for (const g of groupKeys) {
        if (Array.isArray(record[g]) && record[g].length && record[g][0].imgUrl) {
          coverUrl = record[g][0].imgUrl;
          break;
        }
      }
    }

    // ---- Game Card ----
    const card = document.createElement('div');
    card.className = 'game-card';

    if (coverUrl) {
      const cover = document.createElement('img');
      cover.className = 'game-cover';
      cover.src = coverUrl;
      cover.alt = record.name || rawID;
      card.appendChild(cover);
    }

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

    if (Array.isArray(record.theme)) {
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
    resultsDiv.appendChild(card);

    // Decide layout based on category count
    const present = groupKeys.filter(g => Array.isArray(record[g]) && record[g].length);
    const layoutClass = present.length > 4 ? 'three-per-row' : 'two-per-row';
    resultsDiv.classList.add(layoutClass);

    // ---- Category Dropdowns ----
    present.forEach(group => {
      const items = record[group];
      const container = document.createElement('div');
      container.className = 'category-container';

      // Label
      const label = document.createElement('label');
      label.className = 'category-label';
      label.textContent = humanize(group);
      container.appendChild(label);

      // Dropdown
      const select = document.createElement('select');
      const placeholder = document.createElement('option');
      placeholder.textContent = `Select a ${humanize(group).replace(/s$/, '')}`;
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

      // Display panel
      const display = document.createElement('div');
      display.className = 'item-display';
      container.appendChild(display);

      select.addEventListener('change', () => {
        display.innerHTML = '';
        const item = items.find(i => i.id === select.value);
        if (!item) return;

        if (item.imgUrl) {
          const img = document.createElement('img');
          img.src = item.imgUrl;
          img.alt = item.id;
          display.appendChild(img);
        }

        const dl = document.createElement('dl');
        Object.entries(item).forEach(([key,val]) => {
          if (['id','_group','imgUrl','game','urls'].includes(key)) return;
          const dt = document.createElement('dt');
          dt.textContent = humanize(key);
          const dd = document.createElement('dd');
          if (Array.isArray(val)) dd.textContent = val.join(', ');
          else dd.textContent = val;
          dl.appendChild(dt);
          dl.appendChild(dd);
        });
        display.appendChild(dl);
      });

      resultsDiv.appendChild(container);
    });

  } catch (err) {
    console.error(err);
    resultsDiv.innerHTML = `<p class=\"error\">Error: ${err.message}</p>`;
  }
}
