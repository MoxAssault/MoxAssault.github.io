// script.js

// We'll try jsDelivr on the 'main' branch (default is "main" :contentReference[oaicite:0]{index=0}),
// then fall back to raw.githubusercontent if needed.
const API_URLS = [
  'https://cdn.jsdelivr.net/gh/VirtualPinballSpreadsheet/vps-db@main/db/vpsdb.json',
  'https://raw.githubusercontent.com/VirtualPinballSpreadsheet/vps-db/main/db/vpsdb.json'
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
      const resp = await fetch(url);
      console.log(`🗄️ Trying fetch from: ${url} → ${resp.status}`);
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      return resp.json();
    } catch (err) {
      console.warn(`⚠️ Fetch failed from ${url}: ${err.message}`);
    }
  }
  throw new Error('All VPS DB fetch attempts failed');
}

async function searchById() {
  const rawID      = document.getElementById('idInput').value.trim();
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';

  if (!rawID) {
    resultsDiv.innerHTML = `<p class="error">Please enter a VPS Table ID.</p>`;
    return;
  }

  resultsDiv.innerHTML = `<p>Loading results for “${rawID}”…</p>`;

  try {
    const data = await fetchVPSDB();

    const keys     = Object.keys(data);
    console.log('🔑 total IDs in JSON:', keys.length);

    // 1) Exact or CI key lookup
    const exactKey = keys.find(k => k === rawID);
    const ciKey    = exactKey || keys.find(k => k.toLowerCase() === rawID.toLowerCase());
    if (!ciKey) {
      console.log('🔍 no matching key found for', rawID);
      resultsDiv.innerHTML = `<p>No entries found for “${rawID}”.</p>`;
      return;
    }
    console.log('🔍 using key:', ciKey);

    // 2) Unpack everything under that key
    const record = data[ciKey];
    let entries = [];
    if (Array.isArray(record)) {
      entries = record;
    } else if (record && typeof record === 'object') {
      if (record.tableVPSId) {
        entries = [record];
      } else {
        // nested by type → either array or single object
        for (const [type, chunk] of Object.entries(record)) {
          if (Array.isArray(chunk)) {
            chunk.forEach(item => {
              item.type = type;
              entries.push(item);
            });
          } else if (chunk && typeof chunk === 'object') {
            chunk.type = type;
            entries.push(chunk);
          }
        }
      }
    }

    console.log('📦 total entries unpacked:', entries.length);
    if (entries.length === 0) {
      resultsDiv.innerHTML = `<p>No usable entries under key “${ciKey}”.</p>`;
      return;
    }

    // 3) Group by type
    const grouped = entries.reduce((acc, entry) => {
      const t = entry.type || 'Unknown';
      (acc[t] = acc[t] || []).push(entry);
      return acc;
    }, {});

    // 4) Render
    resultsDiv.innerHTML = '';
    for (const [type, list] of Object.entries(grouped)) {
      const h2 = document.createElement('h2');
      h2.textContent = type;
      resultsDiv.appendChild(h2);

      const ul = document.createElement('ul');
      list.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item.tableName || item.name || 'Unnamed Entry';
        if (item.mediaUrl) {
          const a = document.createElement('a');
          a.href = item.mediaUrl;
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
