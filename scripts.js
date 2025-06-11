const API_URL = 'https://cdn.jsdelivr.net/gh/VirtualPinballSpreadsheet/vps-db/db/vpsdb.json';

console.log('⏱ script.js loaded');

// ensure DOM is ready
    window.addEventListener('DOMContentLoaded', () => {
      console.log('✅ DOMContentLoaded');

      const btn = document.getElementById('searchBtn');
      console.log('🔘 Found button:', btn);
      if (!btn) return console.error('❌ searchBtn not found in DOM');

      btn.addEventListener('click', searchById);
      document.getElementById('idInput')
              .addEventListener('keydown', e => { if (e.key==='Enter') searchById(); });
    });

    const API_URL = 'https://virtualpinballspreadsheet.github.io/vps-db/db/vpsdb.json';

    async function searchById() {
      console.log('▶️ searchById() called');
      const id = document.getElementById('idInput').value.trim();
      const resultsDiv = document.getElementById('results');
      resultsDiv.innerHTML = '';

      if (!id) {
        console.log('⚠️ empty ID');
        return resultsDiv.innerHTML = `<p class="error">Please enter a VPS Table ID.</p>`;
      }

      resultsDiv.innerHTML = `<p>Loading results for “${id}”…</p>`;

      try {
        const resp = await fetch(API_URL);
        console.log('📶 fetch status:', resp.status);
        if (!resp.ok) throw new Error(`Network error: ${resp.status}`);

        const data = await resp.json();
        console.log('🔍 raw data type:', typeof data);

        const items = Array.isArray(data) ? data : Object.values(data);
        console.log('📋 total items:', items.length);

        if (items.length === 0) {
          return resultsDiv.innerHTML = `<p class="error">Database is empty!</p>`;
        }

        const sample = items[0];
        const idKey = Object.keys(sample)
                             .find(k => k.toLowerCase().includes('vpsid'));
        console.log('🔑 detected ID key:', idKey);

        if (!idKey) {
          return resultsDiv.innerHTML = `<p class="error">No “VPS ID” field found.</p>`;
        }

        const matches = items.filter(item => item[idKey] === id);
        console.log(`✅ found ${matches.length} matches for ID “${id}”`);

        if (matches.length === 0) {
          return resultsDiv.innerHTML = `<p>No entries found for “${id}”.</p>`;
        }

        // group by type
        const grouped = matches.reduce((acc, item) => {
          const t = item.type || 'Unknown';
          (acc[t] = acc[t]||[]).push(item);
          return acc;
        }, {});

        // render
        resultsDiv.innerHTML = '';
        for (const [type, list] of Object.entries(grouped)) {
          const h2 = document.createElement('h2');
          h2.textContent = type;
          resultsDiv.appendChild(h2);

          const ul = document.createElement('ul');
          list.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.tableName || item.name || JSON.stringify(item);
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
