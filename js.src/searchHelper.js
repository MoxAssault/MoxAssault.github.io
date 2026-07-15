(() => {
  'use strict';

  const state = {
    results: [],
    activeIndex: -1
  };

  function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function scoreRecord(record, query) {
    const id = normalize(record?.id);
    const name = normalize(record?.name);
    if (id === query) return 0;
    if (name === query) return 1;
    if (id.startsWith(query)) return 2;
    if (name.startsWith(query)) return 3;
    if (id.includes(query)) return 4;
    if (name.includes(query)) return 5;
    return Number.POSITIVE_INFINITY;
  }

  function filterSuggestions(data, value, limit = 8) {
    const query = normalize(value);
    if (!query || !Array.isArray(data)) return [];

    return data
      .map((record, index) => ({ record, index, score: scoreRecord(record, query) }))
      .filter(entry => Number.isFinite(entry.score))
      .sort((left, right) => left.score - right.score || left.index - right.index)
      .slice(0, limit)
      .map(entry => entry.record);
  }

  function findExactRecord(data, value) {
    const query = normalize(value);
    if (!query || !Array.isArray(data)) return null;
    return data.find(record => normalize(record?.id) === query || normalize(record?.name) === query) || null;
  }

  function setResults(results) {
    state.results = Array.isArray(results) ? results : [];
    state.activeIndex = -1;
  }

  function moveActive(direction) {
    if (!state.results.length) return -1;
    if (direction > 0) {
      state.activeIndex = Math.min(state.activeIndex + 1, state.results.length - 1);
    } else {
      state.activeIndex = state.activeIndex <= 0 ? 0 : state.activeIndex - 1;
    }
    return state.activeIndex;
  }

  function getActive() {
    return state.activeIndex >= 0 ? state.results[state.activeIndex] : null;
  }

  function clear() {
    state.results = [];
    state.activeIndex = -1;
  }

  window.VPS_SEARCH = {
    state,
    filterSuggestions,
    findExactRecord,
    setResults,
    moveActive,
    getActive,
    clear
  };
})();
