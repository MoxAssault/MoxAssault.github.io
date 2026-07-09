/*
  VPXS YML Creator Redesign
  Stage 2: YML read/write engine

  This intentionally handles the subset of YAML used by VPXS table config
  files instead of pulling in a framework or parser dependency.
*/

import { FIELD_TYPES, YML_FIELD_GROUPS, getFieldByName } from "./fields.js";

const LINE_LENGTH_LIMIT = 120;
const INDENT = "  ";
const OUTPUT_FIELD_ORDER = YML_FIELD_GROUPS.flatMap((group) => group.fields.map((field) => field.name));
const ARRAY_FIELD_NAMES = new Set(
  YML_FIELD_GROUPS
    .flatMap((group) => group.fields)
    .filter((field) => field.type === FIELD_TYPES.ARRAY)
    .map((field) => field.name)
);
const ALWAYS_ARRAY_FIELD_NAMES = new Set(["applyFixes", "backglassAuthorsOverride", "testers"]);
const NUMBER_FIELD_NAMES = new Set(
  YML_FIELD_GROUPS
    .flatMap((group) => group.fields)
    .filter((field) => field.type === FIELD_TYPES.NUMBER)
    .map((field) => field.name)
);
const BOOLEAN_FIELD_NAMES = new Set(
  YML_FIELD_GROUPS
    .flatMap((group) => group.fields)
    .filter((field) => field.type === FIELD_TYPES.BOOLEAN)
    .map((field) => field.name)
);
const URL_FIELD_NAMES = new Set(
  YML_FIELD_GROUPS
    .flatMap((group) => group.fields)
    .filter((field) => field.type === FIELD_TYPES.URL)
    .map((field) => field.name)
);

// Preserved from the original tool's output behavior. PUP selections can help
// the UI, but these two values should not be emitted into generated YML.
const OUTPUT_EXCLUDED_FIELDS = new Set(["pupBundled", "pupVPSId"]);

function stripQuotes(value) {
  const trimmed = value.trim();

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function isEmptyValue(value) {
  if (Array.isArray(value)) return value.length === 0 || value.every(isEmptyValue);
  if (typeof value === "boolean") return false;
  if (typeof value === "number") return !Number.isFinite(value);
  if (value === null || value === undefined) return true;
  return String(value).trim() === "";
}

function normalizeScalar(fieldName, value) {
  if (value === null || value === undefined) return "";

  if (BOOLEAN_FIELD_NAMES.has(fieldName)) {
    return value === true || value === "true";
  }

  if (NUMBER_FIELD_NAMES.has(fieldName)) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : "";
  }

  return String(value).trim();
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeYmlData(data = {}) {
  const normalized = {};

  OUTPUT_FIELD_ORDER.forEach((fieldName) => {
    if (!(fieldName in data)) return;

    if (ARRAY_FIELD_NAMES.has(fieldName)) {
      normalized[fieldName] = normalizeArray(data[fieldName]);
      return;
    }

    normalized[fieldName] = normalizeScalar(fieldName, data[fieldName]);
  });

  return normalized;
}

function quoteString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function shouldFold(fieldName, value) {
  if (URL_FIELD_NAMES.has(fieldName)) return false;
  return String(value).includes("\n") || `${fieldName}: ${quoteString(value)}`.length > LINE_LENGTH_LIMIT;
}

function serializeScalarLine(fieldName, value) {
  if (typeof value === "boolean") return `${fieldName}: ${value}`;
  if (typeof value === "number") return `${fieldName}: ${value}`;

  const stringValue = String(value);

  if (shouldFold(fieldName, stringValue)) {
    const lines = stringValue.split("\n").flatMap((line) => foldLine(line, LINE_LENGTH_LIMIT - INDENT.length));
    return [`${fieldName}: >-`, ...lines.map((line) => `${INDENT}${line}`)].join("\n");
  }

  const rendered = `${fieldName}: ${quoteString(stringValue)}`;

  if (URL_FIELD_NAMES.has(fieldName) && rendered.length > LINE_LENGTH_LIMIT) {
    return `# yamllint disable-line rule:line-length\n${rendered}`;
  }

  return rendered;
}

function serializeArray(fieldName, values) {
  if (values.length === 0) return "";

  const forceArray = ALWAYS_ARRAY_FIELD_NAMES.has(fieldName);

  if (!forceArray && values.length === 1) {
    return serializeScalarLine(fieldName, values[0]);
  }

  return [`${fieldName}:`, ...values.map((value) => `${INDENT}- ${quoteString(value)}`)].join("\n");
}

function foldLine(line, maxLength) {
  const words = String(line).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export function serializeYml(data = {}) {
  const normalized = normalizeYmlData(data);
  const chunks = [];

  OUTPUT_FIELD_ORDER.forEach((fieldName) => {
    if (OUTPUT_EXCLUDED_FIELDS.has(fieldName)) return;
    if (!(fieldName in normalized)) return;

    const value = normalized[fieldName];
    if (isEmptyValue(value)) return;

    if (Array.isArray(value)) {
      const serializedArray = serializeArray(fieldName, value);
      if (serializedArray) chunks.push(serializedArray);
      return;
    }

    chunks.push(serializeScalarLine(fieldName, value));
  });

  return `${chunks.join("\n")}\n`;
}

function parseValue(fieldName, rawValue) {
  const value = rawValue.trim();

  if (BOOLEAN_FIELD_NAMES.has(fieldName)) {
    return value === "true";
  }

  if (NUMBER_FIELD_NAMES.has(fieldName)) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : stripQuotes(value);
  }

  return stripQuotes(value);
}

export function parseYml(text = "") {
  const data = {};
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      index += 1;
      continue;
    }

    const match = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if (!match) {
      throw new Error(`Unable to parse YML line ${index + 1}: ${line}`);
    }

    const [, fieldName, rawValue] = match;

    if (!getFieldByName(fieldName)) {
      data[fieldName] = stripQuotes(rawValue);
      index += 1;
      continue;
    }

    if (rawValue === ">-" || rawValue === "|") {
      const blockLines = [];
      index += 1;

      while (index < lines.length && lines[index].startsWith(INDENT)) {
        blockLines.push(lines[index].slice(INDENT.length));
        index += 1;
      }

      data[fieldName] = blockLines.join("\n").trimEnd();
      continue;
    }

    if (rawValue === "") {
      const values = [];
      index += 1;

      while (index < lines.length && lines[index].startsWith(`${INDENT}- `)) {
        values.push(stripQuotes(lines[index].slice(`${INDENT}- `.length)));
        index += 1;
      }

      data[fieldName] = values;
      continue;
    }

    data[fieldName] = parseValue(fieldName, rawValue);
    index += 1;
  }

  return data;
}

export function downloadYml(data, filename = "table-config.yml") {
  const yaml = serializeYml(data);
  const blob = new Blob([yaml], { type: "text/yaml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
