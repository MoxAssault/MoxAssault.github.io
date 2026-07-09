/*
  VPXS YML Creator Redesign
  Stage 1: Shared UI helpers
*/

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) {
    return value.some(hasMeaningfulValue);
  }

  if (typeof value === "boolean") {
    return value === true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return value !== null && value !== undefined;
}

export function humanize(value = "") {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

export function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

export function getFieldValue(data, fieldName) {
  if (!data || !fieldName) return undefined;
  return data[fieldName];
}

export function isFieldPopulated(data, field) {
  return hasMeaningfulValue(getFieldValue(data, field.name));
}

export function evaluateGroupState(fields, data = {}) {
  const populatedFields = fields.filter((field) => isFieldPopulated(data, field));
  const requiredFields = fields.filter((field) => field.required);
  const missingRequired = requiredFields.filter((field) => !isFieldPopulated(data, field));

  return {
    isEmpty: populatedFields.length === 0,
    isComplete: missingRequired.length === 0,
    populatedCount: populatedFields.length,
    totalCount: fields.length,
    missingRequired,
    requiredCount: requiredFields.length
  };
}

export function getGroupStateLabel(groupState) {
  if (groupState.isEmpty) {
    return "Empty";
  }

  if (!groupState.isComplete) {
    return `${groupState.missingRequired.length} required missing`;
  }

  return `${groupState.populatedCount} populated`;
}

export function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  const {
    className,
    text,
    attrs = {},
    dataset = {},
    children = []
  } = options;

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  Object.entries(attrs).forEach(([name, value]) => {
    if (value === null || value === undefined || value === false) return;
    element.setAttribute(name, String(value));
  });

  Object.entries(dataset).forEach(([name, value]) => {
    if (value === null || value === undefined) return;
    element.dataset[name] = String(value);
  });

  children.forEach((child) => {
    if (child) element.appendChild(child);
  });

  return element;
}
