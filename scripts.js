// script.js

// Use jsDelivr mirror to avoid GitHub-Pages rate-limits:
const API_URL = 'https://cdn.jsdelivr.net/gh/VirtualPinballSpreadsheet/vps-db/db/vpsdb.json';

window.addEventListener('DOMContentLoaded', () => {
  const btn   = document.getElementById('searchBtn');
  const input = document.getElementById('idInput');

  btn.addEventListener('click', searchById);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchById();
  });
});

async function fetchVPSDB() {
  const resp = await fetch(API_URL);
  if (!resp.ok) throw new Error(`Network error: ${resp.status}`);
  return resp.json();
}

async function searchById() {
  const rawID = document.getElementById('idInput').value.trim();
  const idUC  = rawID.toUpperCase();      // normalize for case-insensitive
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';

  if (!rawID) {
    return resultsDiv.innerHTML = `<p class="error">Please enter a VPS Table ID.</p>`;
  }

  resultsDiv.innerHTML = `<p>Loading results for “${rawID}”…</p>`;

  try {
    const raw = await fetchVPSDB();

    let matches = [];

    // 1) If it's an object, try to find the matching key (ignore case)
    if (!Array.isArray(raw)) {
      const allKeys = Object.keys(raw);
      console.log('🔑 JSON keys sample:', allKeys.slice(0,10));
      const foundKey = allKeys.find(k => k.toUpperCase() === idUC);
      console.log('🔍 foundKey (object lookup):', foundKey);
      if (foundKey) {
        // raw[foundKey] might be a single entry or an array of entries
        const entry = raw[foundKey];
        matches = Array.isArray(entry) ? entry : [entry];
      }
    }

    // 2) Fallback: if still no matches and raw is array or object-values, filter by tableVPSId
    if (matches.length === 0) {
      const list = Array.isArray(raw)
        ? raw
        : Object.values(raw);

      matches = list.filter(e => {
        return (
          typeof e.tableVPSId === 'string' &&
          e.tableVPSId.toUpperCase() === idUC
        );
      });
      console.log('🔍 fallback array filter found:', matches.length);
    }

    if (matches.length === 0) {
      return resultsDiv.innerHTML = `<p>No entries found for “${rawID}”.</p>`;
    }

    // 3) Group by type
    const grouped = matches.reduce((acc, entry) => {
      const t = entry.type || 'Unknown';
      (acc[t] = acc[t]||[]).push(entry);
      return acc;
    }, {});

    // 4) Render
    resultsDiv.innerHTML = '';
    for (const [type, items] of Object.entries(grouped)) {
      const h2 = document.createElement('h2');
      h2.textContent = type;
      resultsDiv.appendChild(h2);

      const ul = document.createElement('ul');
      items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item.tableName || item.name || JSON.stringify(item);
        // show the real key if desired (for debugging)
        if (item._vpsID) li.textContent += ` (ID: ${item._vpsID})`;

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
