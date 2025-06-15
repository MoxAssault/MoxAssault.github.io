window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('searchBtn');
  const input = document.getElementById('idInput');
  const suggestions = document.getElementById('suggestions');
  const floatContainer = document.getElementById('searchFloatContainer');
  const closeBtn = document.getElementById('closeSearch');
  const gameCardContainer = document.getElementById('gameCardContainer');
  const categoryGrid = document.getElementById('categoryGrid');

  btn.addEventListener('click', () => searchById(input, gameCardContainer, categoryGrid));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (window.activeSuggestionIndex >= 0 && window.lastSuggestions.length) {
        input.value = window.lastSuggestions[window.activeSuggestionIndex].id;
        suggestions.classList.remove('active');
        searchById(input, gameCardContainer, categoryGrid);
        e.preventDefault();
      } else {
        searchById(input, gameCardContainer, categoryGrid);
      }
    }
    if (['ArrowDown', 'ArrowUp'].includes(e.key) && window.lastSuggestions.length) {
      e.preventDefault();
      if (e.key === 'ArrowDown') {
        window.activeSuggestionIndex = Math.min(window.activeSuggestionIndex + 1, window.lastSuggestions.length - 1);
      } else {
        window.activeSuggestionIndex = Math.max(window.activeSuggestionIndex - 1, 0);
      }
      window.updateSuggestionsUI(suggestions, input, () => searchById(input, gameCardContainer, categoryGrid));
    }
    if (e.key === 'Escape') {
      suggestions.classList.remove('active');
    }
  });
  input.addEventListener('input', async () => {
    const val = input.value.trim().toLowerCase();
    window.resetSuggestions();
    if (!val) {
      suggestions.classList.remove('active');
      return;
    }
    const data = await window.fetchVPSDB();
    window.lastSuggestions = window.filterSuggestions(data, val);
    if (window.lastSuggestions.length) {
      suggestions.classList.add('active');
      window.updateSuggestionsUI(suggestions, input, () => searchById(input, gameCardContainer, categoryGrid));
    } else {
      suggestions.classList.remove('active');
    }
  });

  document.addEventListener('click', (e) => {
    if (!suggestions.contains(e.target) && e.target !== input) {
      suggestions.classList.remove('active');
    }
  });
  closeBtn.addEventListener('click', () => {
    floatContainer.style.display = 'none';
    let openBtn = document.getElementById('openSearch');
    if (!openBtn) {
      openBtn = document.createElement('button');
      openBtn.id = 'openSearch';
      openBtn.className = 'open-btn';
      openBtn.title = 'Open Search';
      openBtn.innerHTML = '<span style="font-size:1.6em;">&#128269;</span>';
      document.body.appendChild(openBtn);
    }
    openBtn.style.display = 'block';
    openBtn.onclick = () => {
      floatContainer.style.display = '';
      openBtn.style.display = 'none';
    };
  });
});

async function searchById(input, gameCardContainer, categoryGrid) {
  const rawID = input.value.trim();
  gameCardContainer.innerHTML = '';
  categoryGrid.innerHTML = '';
  categoryGrid.className = 'two-per-row';
  if (!rawID) {
    input.placeholder = '!! Please enter a VPS Table ID !!';
    return;
  }
  gameCardContainer.innerHTML = `<p>Searching for “${rawID}”…</p>`;
  let record;
  try {
    const data = await window.fetchVPSDB();
    record = Array.isArray(data)
      ? data.find(r => r.id?.toLowerCase() === rawID.toLowerCase())
      : null;
  } catch (err) {
    gameCardContainer.innerHTML = `<p class=\"error\">Error: ${err.message}</p>`;
    return;
  }
  if (!record) {
    gameCardContainer.innerHTML = `<p class=\"error\">No entries found for “${rawID}”.</p>`;
    return;
  }
  const card = window.renderGameCard(record, rawID);
  gameCardContainer.innerHTML = '';
  gameCardContainer.appendChild(card);

  // Modal logic: wire up the compile button to open the modal with fields and handle YML download
  const compileBtn = document.getElementById('compileBtn');
  if (compileBtn) {
    compileBtn.disabled = false;
    compileBtn.onclick = (e) => {
      e.preventDefault();
      // EXAMPLE: You would build up your field definitions dynamically from record or selection
      // Here we pass a static example; update as needed
      const fields = [
        {name: 'applyFixes', type: 'array'},
        {name: 'enabled', type: 'bool'},
        {name: 'fps', type: 'int'},
        {name: 'mainNotes', type: 'str', multiline: true},
        {name: 'tagline', type: 'str', multiline: true},
        {name: 'testers', type: 'array'}
      ];
      window.showModal(fields, function(formData) {
        let yml = '---\n';
        for (const [name, val] of Object.entries(formData)) {
          if (Array.isArray(val)) {
            if (val.length) {
              yml += `${name}:\n`;
              val.forEach(item => yml += `  - '${item.replace(/'/g, "''")}'\n`);
            }
          } else if (typeof val === 'boolean') {
            yml += `${name}: ${val}\n`;
          } else if (typeof val === 'number') {
            yml += `${name}: ${val}\n`;
          } else if (typeof val === 'string' && val.indexOf('\n') >= 0) {
            yml += `${name}: |-\n  ${val.replace(/\n/g, "\n  ").replace(/'/g,"''")}\n`;
          } else if (val) {
            yml += `${name}: '${val.replace(/'/g,"''")}'\n`;
          }
        }
        const blob = new Blob([yml], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'table-config.yml';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      });
    };
  }
}
