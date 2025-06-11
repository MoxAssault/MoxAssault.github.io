import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const DB_URL = "https://virtualpinballspreadsheet.github.io/vps-db/db/vpsdb.json";

export default function VPSDBSearch() {
  const [id, setId] = useState("");
  const [results, setResults] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    setError("");
    setResults({});
    setLoading(true);
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
      setResults(grouped);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">VPS DB ID Search</h1>
      <div className="flex gap-2">
        <Input
          placeholder="Enter ID Code"
          value={id}
          onChange={e => setId(e.target.value)}
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>
      {error && <div className="text-red-500">{error}</div>}
      {Object.keys(results).length > 0 && (
        <div className="space-y-4">
          {Object.entries(results).map(([type, entries]) => (
            <Card key={type}>
              <CardContent className="p-4">
                <h2 className="text-xl font-semibold mb-2">{type} ({entries.length})</h2>
                <ul className="list-disc pl-5 space-y-1">
                  {entries.map(entry => (
                    <li key={entry.id}>
                      <span className="font-medium">{entry.title || entry.id}</span> ({entry.id})
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
