const DB_URL = "https://virtualpinballspreadsheet.github.io/vps-db/db/vpsdb.json";

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
  errorDiv.textContent = "";
  resultsDiv.innerHTML = "";

  try {
    const db = await fetchDB();
    const baseEntry = db.find(e => e.id === id);
    if (!baseEntry) throw new Error(`No entry found with id '${id}'`);

    const linked = getLinkedEntriesRecursive(db, baseEntry, ["rom", "backglass", "pro"]);
    const grouped = groupByType(linked);

    for (const [type, entries] of Object.entries(grouped)) {
      const card = document.createElement("div");
      card.className = "card";
      const title = document.createElement("h2");
      title.textContent = `${type} (${entries.length})`;
      const ul = document.createElement("ul");
      for (const entry of entries) {
        const li = document.createElement("li");
        const fields = ["rom", "backglass", "pro"]
          .filter(f => entry[f])
          .map(f => `${f}: ${Array.isArray(entry[f]) ? entry[f].join(', ') : entry[f]}`)
          .join(" | ");
        li.textContent = `${entry.title || entry.id} (${entry.id})${fields ? ' [' + fields + ']' : ''}`;
        ul.appendChild(li);
      }
      card.appendChild(title);
      card.appendChild(ul);
      resultsDiv.appendChild(card);
    }
  } catch (err) {
    errorDiv.textContent = err.message;
  }
}
