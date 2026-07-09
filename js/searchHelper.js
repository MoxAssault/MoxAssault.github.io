/*
  VPXS YML Creator Redesign
  Stage 3: VPS search/autocomplete helper
*/

import { getRecordId, getRecordManufacturer, getRecordName, getRecordYear } from "./apiHelper.js?v=20260709-2";

const MAX_SUGGESTIONS = 8;

function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

export function findVpsMatches(records, query, limit = MAX_SUGGESTIONS) {
  const term = normalize(query);

  if (!term) return [];

  return records
    .filter((record) => {
      const id = normalize(getRecordId(record));
      const name = normalize(getRecordName(record));
      const manufacturer = normalize(getRecordManufacturer(record));
      const year = normalize(getRecordYear(record));

      return id.includes(term) || name.includes(term) || manufacturer.includes(term) || year.includes(term);
    })
    .slice(0, limit);
}

function renderSuggestion(record, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "search-suggestion";
  button.dataset.vpsId = getRecordId(record);
  button.dataset.index = String(index);
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", "false");

  const title = document.createElement("span");
  title.className = "search-suggestion__title";
  title.textContent = getRecordName(record);

  const meta = document.createElement("span");
  meta.className = "search-suggestion__meta";
  meta.textContent = [getRecordId(record), getRecordManufacturer(record), getRecordYear(record)].filter(Boolean).join(" • ");

  button.append(title, meta);
  return button;
}

export function createSearchController({ input, suggestions, records = [], onSelect }) {
  let activeIndex = -1;
  let currentMatches = [];

  function clear() {
    suggestions.innerHTML = "";
    suggestions.hidden = true;
    activeIndex = -1;
    currentMatches = [];
  }

  function selectRecord(record) {
    if (!record) return;

    input.value = getRecordId(record);
    clear();
    onSelect?.(record);
  }

  function setActive(index) {
    const buttons = Array.from(suggestions.querySelectorAll("button"));

    activeIndex = index;
    buttons.forEach((button, buttonIndex) => {
      button.classList.toggle("is-active", buttonIndex === activeIndex);
      button.setAttribute("aria-selected", String(buttonIndex === activeIndex));
    });
  }

  function render(query) {
    currentMatches = findVpsMatches(records, query);
    suggestions.innerHTML = "";

    if (currentMatches.length === 0) {
      clear();
      return;
    }

    currentMatches.forEach((record, index) => {
      suggestions.appendChild(renderSuggestion(record, index));
    });

    setActive(0);
    suggestions.hidden = false;
  }

  suggestions.addEventListener("pointerdown", (event) => {
    const button = event.target.closest(".search-suggestion");
    if (!button || !suggestions.contains(button)) return;

    event.preventDefault();
    const index = Number(button.dataset.index);
    selectRecord(currentMatches[index]);
  });

  suggestions.addEventListener("click", (event) => {
    const button = event.target.closest(".search-suggestion");
    if (!button || !suggestions.contains(button)) return;

    event.preventDefault();
    const index = Number(button.dataset.index);
    selectRecord(currentMatches[index]);
  });

  input.addEventListener("input", () => render(input.value));
  input.addEventListener("focus", () => render(input.value));
  input.addEventListener("keydown", (event) => {
    if (suggestions.hidden || currentMatches.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % currentMatches.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + currentMatches.length) % currentMatches.length);
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectRecord(currentMatches[activeIndex] ?? currentMatches[0]);
    }

    if (event.key === "Escape") {
      clear();
    }
  });

  document.addEventListener("click", (event) => {
    if (!suggestions.contains(event.target) && event.target !== input) {
      clear();
    }
  });

  return {
    clear,
    setRecords(nextRecords) {
      records = nextRecords;
      render(input.value);
    },
    selectByQuery(query) {
      const exact = records.find((record) => normalize(getRecordId(record)) === normalize(query));
      const fallback = findVpsMatches(records, query, 1)[0];
      selectRecord(exact ?? fallback);
    }
  };
}
