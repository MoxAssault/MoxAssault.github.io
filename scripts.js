const API_URL = 'https://virtualpinballspreadsheet.github.io/vps-db/db/vpsdb.json';

document.getElementById('searchBtn').addEventListener('click', searchById);
document.getElementById('idInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchById();
});

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
    const resp = await fetch(API_URL);
    if (!resp.ok) throw new Error(`Network error: ${resp.status}`);
    const data = await resp.json();

    // Filter all entries matching the table ID
    const matches = data.filter(item => item.tableVPSId === id);

    if (matches.length === 0) {
      resultsDiv.innerHTML = `<p>No entries found for ID “${id}”.</p>`;
      return;
    }

    // Group by type
    const grouped = matches.reduce((acc, item) => {
      const t = item.type || 'Unknown';
      if (!acc[t]) acc[t] = [];
      acc[t].push(item);
      return acc;
    }, {});

    // Render each group
    resultsDiv.innerHTML = '';
    for (const [type, items] of Object.entries(grouped)) {
      const h2 = document.createElement('h2');
      h2.textContent = type;
      resultsDiv.appendChild(h2);

      const ul = document.createElement('ul');
      items.forEach(item => {
        const li = document.createElement('li');
        // Display the most relevant field(s). Adjust as needed:
        li.textContent = item.tableName || item.name || JSON.stringify(item);
        // If there's a URL field, link it:
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
    resultsDiv.innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}
