// Avoid GitHub-Pages rate limits + CORS issues:
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
    const data = await fetchVPSDB();
    console.log('🗄️ total keys:', Object.keys(data).length);

    let entries = [];

    // 1️⃣ Direct exact-key lookup
    if (data.hasOwnProperty(rawID)) {
      const val = data[rawID];
      console.log('🔍 Direct lookup by key:', rawID);

      if (Array.isArray(val)) {
        entries = val;
      } else if (val && typeof val === 'object') {
        // Single-entry object?
        if (val.tableVPSId) {
          entries = [val];
        } else {
          // Nested by type (e.g. { "Table": {...}, "Backglass": {...} })
          console.log('🔧 Unpacking nested types under key');
          entries = Object.entries(val).map(([type, sub]) => {
            sub.type = sub.type || type;
            return sub;
          });
        }
      }
      console.log(`📦 entries from direct lookup: ${entries.length}`);
    }

    // 2️⃣ Case-insensitive key lookup
    if (entries.length === 0) {
      const foundKey = Object.keys(data)
        .find(k => k.toLowerCase() === rawID.toLowerCase());
      if (foundKey) {
        console.log('🔍 CI key match:', foundKey);
        const val = data[foundKey];
        if (Array.isArray(val)) {
          entries = val;
        } else if (val.tableVPSId) {
          entries = [val];
        } else {
          entries = Object.entries(val).map(([type, sub]) => {
            sub.type = sub.type || type;
            return sub;
          });
        }
        console.log(`📦 entries from CI lookup: ${entries.length}`);
      }
    }

    // 3️⃣ Fallback: scan every entry’s tableVPSId (case-insensitive)
    if (entries.length === 0) {
      console.log('🔍 Fallback: scanning all entries’ tableVPSId');
      Object.values(data).forEach(val => {
        const arr = Array.isArray(val) ? val : [val];
        arr.forEach(item => {
          if (
            item.tableVPSId &&
            item.tableVPSId.toLowerCase() === rawID.toLowerCase()
          ) {
            entries.push(item);
          }
        });
      });
      console.log(`📦 entries from fallback scan: ${entries.length}`);
    }

    if (entries.length === 0) {
      return resultsDiv.innerHTML = `<p>No entries found for “${rawID}”.</p>`;
    }

    // Group by type
    const grouped = entries.reduce((acc, entry) => {
      const t = entry.type || 'Unknown';
      (acc[t] = acc[t] || []).push(entry);
      return acc;
    }, {});

    // Render
    resultsDiv.innerHTML = '';
    Object.entries(grouped).forEach(([type, list]) => {
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
    });

  } catch (err) {
    console.error(err);
    resultsDiv.innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}
