/*
  VPXS YML Creator Redesign
  Stage 3: VPS DB API helper
*/

const API_URLS = Object.freeze([
  "https://cdn.jsdelivr.net/gh/VirtualPinballSpreadsheet/vps-db@gh-pages/db/vpsdb.json",
  "https://raw.githubusercontent.com/VirtualPinballSpreadsheet/vps-db/gh-pages/db/vpsdb.json"
]);

let vpsCache = null;
let pendingFetch = null;

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`VPS DB request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function normalizeVpsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.tables)) return payload.tables;
  if (payload && typeof payload === "object") return Object.values(payload);
  return [];
}

export async function fetchVPSDB({ forceRefresh = false } = {}) {
  if (vpsCache && !forceRefresh) return vpsCache;
  if (pendingFetch && !forceRefresh) return pendingFetch;

  pendingFetch = (async () => {
    const errors = [];

    for (const url of API_URLS) {
      try {
        const payload = await fetchJson(url);
        const records = normalizeVpsPayload(payload).filter(Boolean);

        if (records.length === 0) {
          throw new Error("VPS DB returned no records.");
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
