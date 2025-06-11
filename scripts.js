// Use jsDelivr mirror of the GitHub repo for CORS & no rate-limits
const API_URL = 'https://cdn.jsdelivr.net/gh/VirtualPinballSpreadsheet/vps-db@master/db/vpsdb.json';

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
    console.log('🗄️ total keys in JSON:', Object.keys(data).length);

    let entries = [];

    // 1️⃣ Direct lookup by exact key
    if (data.hasOwnProperty(rawID)) {
      entries = Array.isArray(data[rawID]) ? data[rawID] : [data[rawID]];
      console.log(`🔍 Direct match: found ${entries.length} entries for key “${rawID}”`);
    }

    // 2️⃣ Case-insensitive key lookup
    if (entries.length === 0) {
      const foundKey = Object.keys(data)
        .find(k => k.toLowerCase() === rawID.toLowerCase());
      if (foundKey) {
        entries = Array.isArray(data[foundKey]) ? data[foundKey] : [data[foundKey]];
        console.log(`🔍 CI match: found ${entries.length} entries for key “${foundKey}”`);
      }
    }

    // 3️⃣ Fallback: scan every entry’s tableVPSId
    if (entries.length === 0) {
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
      console.log(`🔍 Fallback: found ${entries.length} entries via tableVPSId`);
    }

    if (entries.length === 0) {
      return resultsDiv.innerHTML = `<p>No entries found for “${rawID}”.</p>`;
    }

    // Group by `type`
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
