// This script fetches a database of virtual pinball entries and allows searching by ID.
const DB_URL = "https://virtualpinballspreadsheet.github.io/vps-db/db/vpsdb.json";

async function fetchDB() {
    const res = await fetch(DB_URL);
    if (!res.ok) throw new Error("Failed to fetch database");
        return res.json();
}

function findLinkedEntries(db, entry, fields) {
    const linkedIds = new Set();
    for (const field of fields) {
        const val = entry[field];
        if (Array.isArray(val)) val.forEach(v => linkedIds.add(v));
        else if (val) linkedIds.add(val);
    }
    return db.filter(e => linkedIds.has(e.id));
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
        const matches = db.filter(e => e.id === id);
        if (matches.length === 0) throw new Error(`No entry found with id '${id}'`);
        const collected = [...matches];
        for (const main of matches) {
            const linked = findLinkedEntries(db, main, ["rom", "backglass", "pro"]);
            for (const e of linked) {
                if (!collected.find(c => c.id === e.id)) collected.push(e);
            }
        }
        const grouped = groupByType(collected);
        for (const [type, entries] of Object.entries(grouped)) {
            const card = document.createElement("div");
            card.className = "card";
            const title = document.createElement("h2");
            title.textContent = `${type} (${entries.length})`;
            const ul = document.createElement("ul");
            for (const entry of entries) {
                const li = document.createElement("li");
                li.textContent = `${entry.title || entry.id} (${entry.id})`;
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
