// script.js

// Fetch from the 'master' branch where your 7bjYHY-8wv entry lives:
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
      console.log(`📡 Fetch ${url} → ${r.status}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      console.warn(`⚠️  Couldn’t load from ${url}: ${e.message}`);
    }
  }
  throw new Error('All fetch attempts failed');
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

    // 1) Find the matching key (exact or CI)
    const keys     = Object.keys(data);
    const exactKey = keys.find(k => k === rawID);
    const ciKey    = exactKey || keys.find(k => k.toLowerCase() === rawID.toLowerCase());
    console.log('🔑 match key:', ciKey);
    if (!ciKey) {
      resultsDiv.innerHTML = `<p class="error">No entries found for “${rawID}”.</p>`;
      return;
    }

    // 2) Pull out just the five groups we want:
    const record    = data[ciKey];
    const groupKeys = [
      'tableFiles',
      'b2sFiles',
      'pupPackFiles',
      'wheelArtFiles',
      'topperFiles'
    ];

    let entries = [];
    for (const g of groupKeys) {
      const chunk = record[g];
      if (Array.isArray(chunk) && chunk.length) {
        chunk.forEach(item => {
          // tag it so we know which list it goes in
          item._group = g;
          entries.push(item);
        });
        console.log(`📦 pulled ${chunk.length} items from ${g}`);
      }
    }

    if (entries.length === 0) {
      resultsDiv.innerHTML = `<p class="error">No file entries under “${ciKey}”.</p>`;
      return;
    }

    // 3) Group by _group
    const grouped = entries.reduce((acc, it) => {
      (acc[it._group] = acc[it._group] || []).push(it);
      return acc;
    }, {});

    // 4) Render
    resultsDiv.innerHTML = '';
    for (const [group, list] of Object.entries(grouped)) {
      // humanize the heading
      const heading = group
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase());
      const h2 = document.createElement('h2');
      h2.textContent = heading;
      resultsDiv.appendChild(h2);

      const ul = document.createElement('ul');
      list.forEach(item => {
        const li = document.createElement('li');
        // show filename or fallback to id
        li.textContent = item.id || JSON.stringify(item);
        // if there's a URL, link it
        if (item.urls?.length) {
          const a = document.createElement('a');
          a.href = item.urls[0].url;
          a.textContent = ' [Download]';
          a.target = '_blank';
          li.appendChild(a);
        }
        ul.appendChild(li);
      });
      resultsDiv.appendChild(ul);
    }

  } catch (err) {
    console.error(err);
    resultsDiv.innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}
