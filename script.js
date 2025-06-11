// Try jsDelivr first, then raw GitHub if needed
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

    // 1) Locate the record
    let record;
    if (Array.isArray(data)) {
      console.log('🔍 Data is array, length:', data.length);
      record = data.find(r =>
        typeof r.id === 'string' &&
        r.id.toLowerCase() === rawID.toLowerCase()
      );
    } else {
      const keys     = Object.keys(data);
      console.log('🔑 Data is object, total IDs:', keys.length);
      const exactKey = keys.find(k => k === rawID);
      const ciKey    = exactKey || keys.find(k => k.toLowerCase() === rawID.toLowerCase());
      console.log('🔍 Using key:', ciKey);
      if (ciKey) record = data[ciKey];
    }

    if (!record) {
      resultsDiv.innerHTML = `<p class="error">No entries found for “${rawID}”.</p>`;
      return;
    }

    // 2) Pull only the five file‐groups
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
        console.log(`📦 pulled ${chunk.length} items from ${g}`);
        chunk.forEach(item => {
          item._group = g;
          entries.push(item);
        });
      }
    }

    if (entries.length === 0) {
      resultsDiv.innerHTML = `<p class="error">No file entries under “${rawID}”.</p>`;
      return;
    }

    // 3) Group them by _group
    const grouped = entries.reduce((acc, it) => {
      (acc[it._group] = acc[it._group] || []).push(it);
      return acc;
    }, {});

    // 4) Render
    resultsDiv.innerHTML = '';
    for (const [group, list] of Object.entries(grouped)) {
      // humanize heading: e.g. "b2sFiles" → "B2s Files"
      const heading = group
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase());
      const h2 = document.createElement('h2');
      h2.textContent = heading;
      resultsDiv.appendChild(h2);

      const ul = document.createElement('ul');
      list.forEach(item => {
        const li = document.createElement('li');
        // display the file ID, or fallback to a JSON string
        li.textContent = item.id || JSON.stringify(item);
        // if there's a URL array, link the first one
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
