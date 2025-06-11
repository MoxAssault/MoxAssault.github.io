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
    } catch {}
  }
  throw new Error('Failed to load VPS DB JSON');
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

    // locate record in array by `id`
    const record = Array.isArray(data)
      ? data.find(r => r.id?.toLowerCase() === rawID.toLowerCase())
      : null;

    if (!record) {
      resultsDiv.innerHTML = `<p class="error">No entries found for “${rawID}”.</p>`;
      return;
    }

    // only these five groups:
    const groupKeys = [
      'tableFiles',
      'b2sFiles',
      'pupPackFiles',
      'wheelArtFiles',
      'topperFiles'
    ];

    resultsDiv.innerHTML = '';
    groupKeys.forEach(group => {
      const items = record[group];
      if (!Array.isArray(items) || items.length === 0) return;

      // label
      const label = document.createElement('label');
      label.className = 'category-label';
      // humanize: "tableFiles" → "Table Files"
      label.textContent = group
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase());
      resultsDiv.appendChild(label);

      // dropdown
      const select = document.createElement('select');
      const placeholder = document.createElement('option');
      placeholder.textContent = `Select a ${label.textContent.slice(0, -1)}`;
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);

      items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.urls?.[0]?.url || '';
        opt.textContent = item.id;
        select.appendChild(opt);
      });

      // open link on change
      select.addEventListener('change', () => {
        const url = select.value;
        if (url) window.open(url, '_blank');
        select.selectedIndex = 0;
      });

      resultsDiv.appendChild(select);
    });

  } catch (err) {
    resultsDiv.innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}
