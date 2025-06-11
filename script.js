// script.js

// Mirror on jsDelivr to avoid rate‐limits / CORS issues
const API_URL = 'https://cdn.jsdelivr.net/gh/VirtualPinballSpreadsheet/vps-db@master/db/vpsdb.json';

window.addEventListener('DOMContentLoaded', () => {
  const btn   = document.getElementById('searchBtn');
  const input = document.getElementById('idInput');
  btn.addEventListener('click', searchById);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') searchById(); });
});

async function fetchVPSDB() {
  const resp = await fetch(API_URL);
  if (!resp.ok) throw new Error(`Failed to fetch JSON: ${resp.status}`);
  return resp.json();
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
    // 1) Fetch the JSON object
    const data = await fetchVPSDB();
    console.log('🗄 total IDs in JSON:', Object.keys(data).length);

    // 2) Find the matching key (exact or case‐insensitive)
    const keys     = Object.keys(data);
    const exactKey = keys.find(k => k === rawID);
    const ciKey    = exactKey || keys.find(k => k.toLowerCase() === rawID.toLowerCase());
    if (!ciKey) {
      console.log('🔍 no matching key found for', rawID);
      resultsDiv.innerHTML = `<p>No entries found for “${rawID}”.</p>`;
      return;
    }
    console.log('🔍 using key:', ciKey);

    // 3) Unpack whatever is under that key
    let entries = [];
    const record = data[ciKey];

    if (Array.isArray(record)) {
      // array of entries
      entries = record;
    } else if (record && typeof record === 'object') {
      // could be a single object, or nested types → array/object
      // if it has its own tableVPSId, treat as one entry:
      if (record.tableVPSId) {
        entries = [record];
      } else {
        // otherwise assume nested by type:
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
      resultsDiv.innerHTML = `<p>No entries found under key “${ciKey}”.</p>`;
      return;
    }

    // 4) Group by type
    const grouped = entries.reduce((acc, entry) => {
      const t = entry.type || 'Unknown';
      (acc[t] = acc[t] || []).push(entry);
      return acc;
    }, {});

    // 5) Render
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
