/*
  VPXS YML Creator Redesign
  Stage 3: VPS DB API helper
*/

const API_URLS = Object.freeze([
  "https://virtualpinballspreadsheet.github.io/vps-db/db/vpsdb.json",
  "https://virtualpinballspreadsheet.github.io/vps-db/lastUpdated.json",
  "https://raw.githubusercontent.com/VirtualPinballSpreadsheet/vps-db/gh-pages/db/vpsdb.json"
]);

let vpsCache = null;
let pendingFetch = null;

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function withRecordId(record, fallbackId = "") {
  if (!record || typeof record !== "object") {
    return record;
  }

  return {
    ...record,
    id: record.id ?? record.tableVPSId ?? record.vpsId ?? record.vpsID ?? fallbackId
  };
}

function normalizeVpsCollection(collection) {
  if (Array.isArray(collection)) {
    return collection.map((record) => withRecordId(record));
  }

  if (collection && typeof collection === "object") {
    return Object.entries(collection).map(([id, record]) => withRecordId(record, id));
  }

  return [];
}

function normalizeVpsPayload(payload) {
  if (Array.isArray(payload)) return normalizeVpsCollection(payload);
  if (payload?.items) return normalizeVpsCollection(payload.items);
  if (payload?.tables) return normalizeVpsCollection(payload.tables);
  if (payload?.version && !payload?.items && !payload?.tables) return [];
  if (payload && typeof payload === "object") return normalizeVpsCollection(payload);
  return [];
}

export async function fetchVPSDB({ forceRefresh = false } = {}) {
  if (vpsCache && !forceRefresh) return vpsCache;
  if (pendingFetch && !forceRefresh) return pendingFetch;

  pendingFetch = (async () => {
    const errors = [];

    for (const url of API_URLS) {
      try {
        if (url.endsWith("lastUpdated.json")) {
          await fetchJson(url);
          continue;
        }

        const payload = await fetchJson(url);
        const records = normalizeVpsPayload(payload).filter(Boolean);

        if (records.length === 0) {
          throw new Error(`${url} returned no records.`);
        }

        vpsCache = records;
        return records;
      } catch (error) {
        errors.push(error.message);
      }
    }

    throw new Error(`Unable to load VPS DB. ${errors.join(" | ")}`);
  })();

  try {
    return await pendingFetch;
  } finally {
    pendingFetch = null;
  }
}

export function getRecordId(record) {
  return record?.id ?? record?.tableVPSId ?? record?.vpsId ?? record?.vpsID ?? "";
}

export function getRecordName(record) {
  return record?.name ?? record?.title ?? record?.tableName ?? "Untitled table";
}

export function getRecordManufacturer(record) {
  return record?.manufacturer ?? record?.brand ?? "";
}

export function getRecordYear(record) {
  return record?.year ?? record?.releaseYear ?? "";
}

export function getRecordUpdated(record) {
  return record?.updatedAt ?? record?.updated ?? record?.lastUpdated ?? "";
}

export function getRecordImage(record) {
  const candidates = [
    record?.imgUrl,
    record?.image,
    record?.imageUrl,
    record?.tableImgUrl,
    record?.tableFiles?.[0]?.imgUrl,
    record?.tableFiles?.[0]?.image,
    record?.b2sFiles?.[0]?.imgUrl,
    record?.b2sFiles?.[0]?.image
  ];

  return candidates.find(Boolean) ?? "";
}
