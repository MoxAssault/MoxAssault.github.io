const DB_URL = "https://virtualpinballspreadsheet.github.io/vps-db/db/vpsdb.json";

document.addEventListener("DOMContentLoaded", () => {
  const searchButton = document.getElementById("searchButton");
  if (searchButton) {
    searchButton.addEventListener("click", handleSearch);
  }
});

async function fetchDB() {
  const res = await fetch(DB_URL);
  if (!res.ok) throw new Error("Failed to fetch database");
  return res.json();
}

function getLinkedEntriesRecursive(db, baseEntry, fields, visited = new Set()) {
  const stack = [baseEntry];
  const collected = [];

  while (stack.length) {
    const entry = stack.pop();
    if (visited.has(entry.id)) continue;
    visited.add(entry.id);
    collected.push(entry);

    const linkedIds = new Set();
    for (const field of fields) {
      const val = entry[field];
      if (Array.isArray(val)) val.forEach(v => linkedIds.add(v));
      else if (val) linkedIds.add(val);
    }

    for (const id of linkedIds) {
      const found = db.find(e => e.id === id);
      if (found && !visited.has(found.id)) stack.push(found);
    }
  }

  return collected;
}

function groupByType(entries) {
  const grouped = {};
  for (const entry of entries) {
    const type = entry.type || "unknown";
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(entry);
  }
  return grouped;
}

async function handleSearch() {
  const id = document.getElementById("idInput").value.trim();
  const errorDiv = document.getElementById("error");
  const resultsDiv = document.getElementById("results");
  const filterContainer = document.getElementById("filterContainer");
  const searchButton = document.getElementById("searchButton");
  const spinner = document.getElementById("spinner");
  errorDiv.textContent = "";
  resultsDiv.innerHTML = "";
  filterContainer.innerHTML = "";

  if (!searchButton || !spinner) {
    console.error("Missing searchButton or spinner element.");
    return;
  }

  searchButton.disabled = true;
  spinner.style.display = "block";

  try {
    const db = await fetchDB();
    const baseEntry = db.find(e => e.id === id);
    if (!baseEntry) throw new Error(`No entry found with id '${id}'`);

    const allFields = ["rom", "backglass", "pro", "pup", "altrom", "media"];
    const linked = getLinkedEntriesRecursive(db, baseEntry, allFields);
    const grouped = groupByType(linked);

    const types = Object.keys(grouped);
    types.forEach(type => {
      const label = document.createElement("label");
      label.style.marginRight = "10px";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = JSON.parse(localStorage.getItem(`filter_${type}`) ?? "true");
      checkbox.dataset.type = type;
      checkbox.addEventListener("change", () => {
        const cards = document.querySelectorAll(`.card[data-type='${type}']`);
        cards.forEach(card => card.style.display = checkbox.checked ? "block" : "none");
        localStorage.setItem(`filter_${type}`, checkbox.checked);
      });
      label.appendChild(checkbox);
      label.append(` ${type}`);
      filterContainer.appendChild(label);

      const cards = document.querySelectorAll(`.card[data-type='${type}']`);
      cards.forEach(card => card.style.display = checkbox.checked ? "block" : "none");
    });

    const resetButton = document.createElement("button");
    resetButton.textContent = "Reset Filters";
    resetButton.style.margin = "10px 0";
    resetButton.onclick = () => {
      types.forEach(type => {
        localStorage.setItem(`filter_${type}`, true);
        const checkbox = filterContainer.querySelector(`input[data-type='${type}']`);
        if (checkbox) checkbox.checked = true;
        const cards = document.querySelectorAll(`.card[data-type='${type}']`);
        cards.forEach(card => card.style.display = "block");
      });
    };
    filterContainer.appendChild(resetButton);

    for (const [type, entries] of Object.entries(grouped)) {
      const card = document.createElement("div");
      card.className = "card";
      card.dataset.type = type;
      const title = document.createElement("h2");
      title.textContent = `${type} (${entries.length})`;
      const ul = document.createElement("ul");
      for (const entry of entries) {
        const li = document.createElement("li");
        const fieldsHTML = allFields
          .filter(f => entry[f])
          .map(f => {
            const val = Array.isArray(entry[f]) ? entry[f].join(", ") : entry[f];
            const span = document.createElement("span");
            span.className = `tag tooltip ${f}`;
            span.textContent = `${f}: ${val}`;
            span.title = f;
            return span.outerHTML;
          }).join(" ");

        li.innerHTML = `${entry.title || entry.id} <strong>(${entry.id})</strong><div class="tags">${fieldsHTML}</div>`;
        ul.appendChild(li);
      }
      card.appendChild(title);
      card.appendChild(ul);
      resultsDiv.appendChild(card);
    }

    resultsDiv.scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    errorDiv.textContent = err.message;
  } finally {
    spinner.style.display = "none";
    searchButton.disabled = false;
  }
}
