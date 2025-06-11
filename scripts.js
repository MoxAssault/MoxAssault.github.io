// Use jsDelivr mirror to avoid GitHub-Pages rate-limits
const API_URL = 'https://cdn.jsdelivr.net/gh/VirtualPinballSpreadsheet/vps-db/db/vpsdb.json';

window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('searchBtn');
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
  const id = document.getElementById('idInput').value.trim();
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';

  if (!id) {
    resultsDiv.innerHTML = `<p class="error">Please enter a VPS Table ID.</p>`;
    return;
  }

  resultsDiv.innerHTML = `<p>Loading results for “${id}”…</p>`;

  try {
    // 1) Fetch and parse
    const raw = await fetchVPSDB();

    // 2) Normalize into [{ id, entry }, …]
    const list = Array.isArray(raw)
      ? raw.map(entry => ({ id: entry.tableVPSId || null, entry }))
      : Object.entries(raw).map(([key, entry]) => ({ id: key, entry }));

    console.log('🔢 total items:', list.length);

    // 3) Filter by either the key or internal field
    const matches = list
      .filter(item => item.id === id || item.entry.tableVPSId === id)
      .map(item => {
        item.entry._vpsID = item.id;
        return item.entry;
      });

    console.log('✅ matches found:', matches.length);

    if (matches.length === 0) {
      resultsDiv.innerHTML = `<p>No entries found for “${id}”.</p>`;
      return;
    }

    // 4) Group by `type`
    const grouped = matches.reduce((acc, entry) => {
      const t = entry.type || 'Unknown';
      (acc[t] = acc[t] || []).push(entry);
      return acc;
    }, {});

    // 5) Render each group
    resultsDiv.innerHTML = '';
    for (const [type, items] of Object.entries(grouped)) {
      const heading = document.createElement('h2');
      heading.textContent = type;
      resultsDiv.appendChild(heading);

      const ul = document.createElement('ul');
      items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item.tableName || item.name || JSON.stringify(item);
        li.textContent += ` (ID: ${item._vpsID})`;

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
