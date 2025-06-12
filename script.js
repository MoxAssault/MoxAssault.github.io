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

function humanize(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, s => s.toUpperCase());
}

async function searchById() {
  const rawID = document.getElementById('idInput').value.trim();
  const gameCardContainer = document.getElementById('gameCardContainer');
  const categoryGrid = document.getElementById('categoryGrid');
  const resultsDiv = document.getElementById('results');

  gameCardContainer.innerHTML = '';
  categoryGrid.innerHTML = '';
  categoryGrid.classList.remove('two-per-row', 'three-per-row');

  if (!rawID) {
    resultsDiv.innerHTML = `<p class="error">Please enter a VPS Table ID.</p>`;
    return;
  }

  gameCardContainer.innerHTML = `<p>Searching for “${rawID}”…</p>`;

  try {
    const data = await fetchVPSDB();
    const record = Array.isArray(data)
      ? data.find(r => r.id?.toLowerCase() === rawID.toLowerCase())
      : null;

    if (!record) {
      gameCardContainer.innerHTML = `<p class="error">No entries found for “${rawID}”.</p>`;
      return;
    }

    const groupKeys = [
      'tableFiles', 'b2sFiles', 'romFiles',
      'altColorFiles', 'pupPackFiles', 'mediaPackFiles'
    ];
    const present = groupKeys.filter(g => Array.isArray(record[g]) && record[g].length);
    categoryGrid.classList.add(present.length > 4 ? 'three-per-row' : 'two-per-row');

    let coverUrl = record.imgUrl;
    if (!coverUrl) {
      for (const g of groupKeys) {
        if (record[g]?.[0]?.imgUrl) {
          coverUrl = record[g][0].imgUrl;
          break;
        }
      }
    }

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

    present.forEach(group => {
      const items = record[group];
      const container = document.createElement('div');
      container.className = 'category-container';

      const label = document.createElement('label');
      label.className = 'category-label';
      label.textContent = humanize(group);
      container.appendChild(label);

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

      const display = document.createElement('div');
      display.className = 'item-display';
      container.appendChild(select);
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

        const formatDate = ts => {
          try {
            return new Date(ts).toLocaleDateString(undefined, {
              year: 'numeric', month: 'short', day: 'numeric'
            });
          } catch { return ts; }
        };

        const appendField = (key, val) => {
          if (['authors', 'features', 'tableFormat', 'version'].includes(key)) {
            const group = document.createElement('div');
            const label = document.createElement('dt');
            label.textContent = humanize(key);
            dl.appendChild(label);
            const bubbleWrap = document.createElement('div');
            bubbleWrap.className = 'bubble-group';
            (Array.isArray(val) ? val : [val]).forEach(v => {
              const bubble = document.createElement('span');
              bubble.className = 'bubble';
              bubble.textContent = v;
              bubbleWrap.appendChild(bubble);
            });
            const holder = document.createElement('dd');
            holder.appendChild(bubbleWrap);
            dl.appendChild(holder);
            return;
          }
          if (['createdAt', 'updatedAt'].includes(key)) return;

          const dt = document.createElement('dt');
          dt.textContent = humanize(key);
          const dd = document.createElement('dd');
          dd.textContent = Array.isArray(val) ? val.join(', ') : val;
          dl.appendChild(dt);
          dl.appendChild(dd);
        };

        const dateRow = document.createElement('div');
        dateRow.style.display = 'flex';
        dateRow.style.justifyContent = 'space-between';
        dateRow.style.gap = '1rem';
        dateRow.style.marginBottom = '1rem';

        ['createdAt', 'updatedAt'].forEach(dateKey => {
          if (item[dateKey]) {
            const wrap = document.createElement('div');
            const dt = document.createElement('dt');
            dt.textContent = humanize(dateKey.replace(/At$/, ''));
            const dd = document.createElement('dd');
            dd.textContent = formatDate(item[dateKey]);
            wrap.appendChild(dt);
            wrap.appendChild(dd);
            dateRow.appendChild(wrap);
          }
        });

        display.appendChild(dateRow);

        if (item.authors) appendField('authors', item.authors);
        if (item.features) appendField('features', item.features);
        if (item.tableFormat) appendField('tableFormat', item.tableFormat);
        if (item.version) appendField('version', item.version);

        const ignore = [
          'id','_group','imgUrl','game','urls','comment',
          'createdAt','updatedAt','authors','features','tableFormat','version'
        ];
        Object.keys(item)
          .filter(k => !ignore.includes(k))
          .sort()
          .forEach(k => appendField(k, item[k]));

        if (item.comment) appendField('comment', item.comment);

        display.appendChild(dl);
      });

      categoryGrid.appendChild(container);
    });

  } catch (err) {
    console.error(err);
    gameCardContainer.innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}
