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

    // 1) Normalize to an array
    const items = Array.isArray(data) ? data : Object.values(data);
    console.log('🔍 total items:', items.length);
    if (items.length === 0) {
      resultsDiv.innerHTML = `<p class="error">Database is empty!</p>`;
      return;
    }

    // 2) Figure out which key holds the table ID
    const sample = items[0];
    const idKey = Object.keys(sample)
      .find(k => k.toLowerCase().includes('vpsid')) || null;
    console.log('🔑 detected ID field:', idKey);
    if (!idKey) {
      resultsDiv.innerHTML = `<p class="error">Could not find a “VPS ID” field in your data.</p>`;
      return;
    }

    // 3) Filter by that key
    const matches = items.filter(item => item[idKey] === id);
    console.log(`✅ found ${matches.length} matches for “${id}”`);

    if (matches.length === 0) {
      resultsDiv.innerHTML = `<p>No entries found for ID “${id}”.</p>`;
      return;
    }

    // 4) Group by type (falling back to “Unknown”)
    const grouped = matches.reduce((acc, item) => {
      const t = item.type || 'Unknown';
      (acc[t] = acc[t] || []).push(item);
      return acc;
    }, {});

    // 5) Render
    resultsDiv.innerHTML = '';
    for (const [type, items] of Object.entries(grouped)) {
      const h2 = document.createElement('h2');
      h2.textContent = type;
      resultsDiv.appendChild(h2);

      const ul = document.createElement('ul');
      items.forEach(item => {
        const li = document.createElement('li');
        // show the table name or fall back to JSON
        li.textContent = item.tableName || item.name || JSON.stringify(item);
        // if there’s a download link, append it
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
