let lastSuggestions = [];
let activeSuggestionIndex = -1;
function filterSuggestions(data, val) {
  return data.filter(
    r => r.id?.toLowerCase().includes(val) || r.name?.toLowerCase().includes(val)
  ).slice(0, 8);
}
function updateSuggestionsUI(suggestions, input, searchFn) {
  const suggestionsEl = document.getElementById('suggestions');
  suggestionsEl.innerHTML = '';
  lastSuggestions.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'suggestion-item' + (i === activeSuggestionIndex ? ' active' : '');
    div.textContent = `${s.name || '[No Name]'} (${s.id})`;
    div.addEventListener('mousedown', (e) => {
      input.value = s.id;
      suggestionsEl.classList.remove('active');
      searchFn();
      e.preventDefault();
    });
    suggestionsEl.appendChild(div);
  });
}
function resetSuggestions() {
  lastSuggestions = [];
  activeSuggestionIndex = -1;
  document.getElementById('suggestions').innerHTML = '';
}

window.filterSuggestions = filterSuggestions;
window.updateSuggestionsUI = updateSuggestionsUI;
window.resetSuggestions = resetSuggestions;
window.lastSuggestions = lastSuggestions;
window.activeSuggestionIndex = activeSuggestionIndex;
