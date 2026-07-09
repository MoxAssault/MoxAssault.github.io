/*
  VPXS YML Creator Redesign
  Stage 3: Builder mode wiring
*/

import {
  fetchVPSDB,
  getRecordId,
  getRecordImage,
  getRecordManufacturer,
  getRecordName,
  getRecordUpdated,
  getRecordYear
} from "./apiHelper.js";
import { YML_FIELD_GROUPS, getFieldByName, FIELD_TYPES } from "./fields.js";
import { createErrorLog } from "./errorLog.js";
import { createPreviewPane } from "./previewPane.js";
import { createSearchController } from "./searchHelper.js";
import { formatDate } from "./uiHelper.js";
import { downloadYml, normalizeYmlData } from "./yamlHelper.js";
import { renderWizardGroups } from "./wizardModule.js";

const CATEGORY_CONFIG = Object.freeze([
  {
    key: "tableFiles",
    title: "VPX Table",
    fieldName: "vpxVPSId",
    emptyText: "No VPX table files found."
  },
  {
    key: "b2sFiles",
    title: "Backglass",
    fieldName: "backglassVPSId",
    emptyText: "No backglass files found."
  },
  {
    key: "romFiles",
    title: "ROM",
    fieldName: "romVPSId",
    emptyText: "No ROM files found."
  },
  {
    key: "altColorFiles",
    title: "Colored ROM",
    fieldName: "coloredROMVPSId",
    emptyText: "No color ROM files found."
  },
  {
    key: "vpuPatchFiles",
    title: "VPU Patch",
    fieldName: "diffVPSId",
    emptyText: "No VPU patch files found."
  },
  {
    key: "pupPackFiles",
    title: "PUP Pack",
    fieldName: "pupVPSId",
    emptyText: "No PUP pack files found."
  }
]);

const REQUIRED_BASE_FIELDS = ["tableVPSId", "fps", "mainNotes", "tagline", "testers", "vpxVPSId", "vpxChecksum"];

const elements = {
  searchForm: document.querySelector("[data-search-form]"),
  searchInput: document.querySelector("[data-search-input]"),
  suggestions: document.querySelector("[data-search-suggestions]"),
  builderStatus: document.querySelector("[data-builder-status]"),
  resultPanel: document.querySelector("[data-result-panel]"),
  resultCard: document.querySelector("[data-result-card]"),
  fileSelectors: document.querySelector("[data-file-selectors]"),
  wizard: document.querySelector("[data-builder-wizard]"),
  previewOutput: document.querySelector("[data-preview-output]"),
  previewStatus: document.querySelector("[data-preview-status]"),
  downloadButton: document.querySelector("[data-download-yml]"),
  errorLog: document.querySelector("[data-error-log]")
};

const state = {
  records: [],
  currentRecord: null,
  formData: {}
};

const errorLog = createErrorLog(elements.errorLog);
const previewPane = createPreviewPane({
  output: elements.previewOutput,
  status: elements.previewStatus,
  errorLog
});

function setStatus(message) {
  if (elements.builderStatus) {
    elements.builderStatus.textContent = message;
  }
}

function isMeaningful(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value === true;
  return String(value ?? "").trim().length > 0;
}

function coerceFieldValue(fieldName, value) {
  const field = getFieldByName(fieldName);

  if (!field) return value;

  if (field.type === FIELD_TYPES.ARRAY) {
    if (Array.isArray(value)) return value;
    return String(value ?? "")
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (field.type === FIELD_TYPES.NUMBER) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : "";
  }

  if (field.type === FIELD_TYPES.BOOLEAN) {
    return value === true || value === "true";
  }

  return value ?? "";
}

function updateFormData(fieldName, value) {
  state.formData[fieldName] = coerceFieldValue(fieldName, value);
  previewPane.renderDebounced(state.formData);
}

function getFiles(record, key) {
  if (!record) return [];

  if (key === "vpuPatchFiles") {
    return collectVpuPatchFiles(record);
  }

  const value = record[key];
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function collectVpuPatchFiles(record) {
  const direct = Array.isArray(record?.vpuPatchFiles) ? record.vpuPatchFiles : [];
  const inferred = Array.isArray(record?.tableFiles)
    ? record.tableFiles.filter((file) => {
        const haystack = [file?._group, file?.category, ...(Array.isArray(file?.features) ? file.features : [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes("vpu patch") || haystack.includes("patch");
      })
    : [];

  const unique = new Map();
  [...direct, ...inferred].forEach((file) => {
    const id = getFileId(file);
    if (id && !unique.has(id)) unique.set(id, file);
  });

  return Array.from(unique.values());
}

function getFileId(file) {
  return file?.id ?? file?.vpsId ?? file?.vpsID ?? file?.fileId ?? "";
}

function getFileLabel(file) {
  return file?.name ?? file?.title ?? file?.version ?? getFileId(file) ?? "Untitled file";
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function renderResultCard(record) {
  elements.resultCard.innerHTML = "";

  const image = getRecordImage(record);
  const media = document.createElement("div");
  media.className = "result-card__media";

  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = "";
    img.loading = "lazy";
    media.appendChild(img);
  } else {
    media.textContent = "VPXS";
  }

  const body = document.createElement("div");
  body.className = "result-card__body";

  const title = document.createElement("h3");
  title.textContent = getRecordName(record);

  const meta = document.createElement("p");
  meta.className = "result-card__meta";
  meta.textContent = [
    getRecordId(record),
    getRecordManufacturer(record),
    getRecordYear(record),
    getRecordUpdated(record) ? `Updated ${formatDate(getRecordUpdated(record))}` : ""
  ].filter(Boolean).join(" • ");

  body.append(title, meta);
  elements.resultCard.append(media, body);
}

function renderFileSelectors(record) {
  elements.fileSelectors.innerHTML = "";

  CATEGORY_CONFIG.forEach((category) => {
    const files = getFiles(record, category.key);
    const card = document.createElement("div");
    card.className = "file-picker";

    const label = document.createElement("label");
    label.textContent = category.title;

    const select = document.createElement("select");
    select.name = category.key;
    select.disabled = files.length === 0;
    select.appendChild(createOption("", files.length ? `Choose ${category.title}` : category.emptyText));

    files.forEach((file) => {
      const id = getFileId(file);
      if (!id) return;
      select.appendChild(createOption(id, `${getFileLabel(file)} — ${id}`));
    });

    select.addEventListener("change", () => {
      updateFormData(category.fieldName, select.value);
      if (category.key === "tableFiles") {
        const selectedFile = files.find((file) => getFileId(file) === select.value);

        if (selectedFile?.parentId) {
          updateFormData("vpxVPSId", selectedFile.parentId);
          updateFormData("diffVPSId", getFileId(selectedFile));
        }
      }
    });

    card.append(label, select);
    elements.fileSelectors.appendChild(card);
  });
}

function buildInitialData(record) {
  return {
    tableVPSId: getRecordId(record),
    enabled: true
  };
}

function renderWizard(data) {
  renderWizardGroups({
    groups: YML_FIELD_GROUPS,
    data,
    target: elements.wizard
  });
}

function selectRecord(record) {
  errorLog.clear();
  state.currentRecord = record;
  state.formData = buildInitialData(record);

  renderResultCard(record);
  renderFileSelectors(record);
  renderWizard(state.formData);
  previewPane.render(state.formData);

  elements.resultPanel.hidden = false;
  elements.downloadButton.disabled = false;
  setStatus(`Loaded ${getRecordName(record)}.`);
}

function validateFormData(data) {
  const normalized = normalizeYmlData(data);
  const errors = [];

  REQUIRED_BASE_FIELDS.forEach((fieldName) => {
    if (!isMeaningful(normalized[fieldName])) {
      errors.push(`${fieldName} is required.`);
    }
  });

  if ((isMeaningful(normalized.backglassVPSId) || normalized.backglassBundled === true) && !isMeaningful(normalized.backglassChecksum)) {
    errors.push("backglassChecksum is required when a backglass is selected or bundled.");
  }

  if (normalized.backglassBundled === true && !isMeaningful(normalized.backglassNotes)) {
    errors.push("backglassNotes is required when the backglass is bundled.");
  }

  if ((isMeaningful(normalized.romVPSId) || normalized.romBundled === true) && !isMeaningful(normalized.romChecksum)) {
    errors.push("romChecksum is required when a ROM is selected or bundled.");
  }

  if (isMeaningful(normalized.romUrlOverride) && !isMeaningful(normalized.romVersionOverride)) {
    errors.push("romVersionOverride is required when romUrlOverride is used.");
  }

  if ((isMeaningful(normalized.coloredROMVPSId) || normalized.coloredROMBundled === true) && !isMeaningful(normalized.coloredROMChecksum)) {
    errors.push("coloredROMChecksum is required when a colored ROM is selected or bundled.");
  }

  if (isMeaningful(normalized.coloredROMUrlOverride) && !isMeaningful(normalized.coloredROMVersionOverride)) {
    errors.push("coloredROMVersionOverride is required when coloredROMUrlOverride is used.");
  }

  if (isMeaningful(normalized.diffVPSId) && !isMeaningful(normalized.diffChecksum)) {
    errors.push("diffChecksum is required when a VPU patch is selected.");
  }

  if ((isMeaningful(normalized.pupFileUrl) || normalized.pupRequired === true) && !isMeaningful(normalized.pupChecksum)) {
    errors.push("pupChecksum is required when a PUP pack URL is used or required.");
  }

  return errors;
}

function getDownloadFilename() {
  const id = state.formData.tableVPSId || getRecordId(state.currentRecord) || "table-config";
  return `${id}_table-config.yml`;
}

async function initBuilder() {
  setStatus("Loading VPS database…");

  const searchController = createSearchController({
    input: elements.searchInput,
    suggestions: elements.suggestions,
    records: [],
    onSelect: selectRecord
  });

  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    searchController.selectByQuery(elements.searchInput.value);
  });

  elements.wizard.addEventListener("wizard-field-change", (event) => {
    updateFormData(event.detail.fieldName, event.detail.value);
  });

  elements.downloadButton.addEventListener("click", () => {
    errorLog.clear();
    const errors = validateFormData(state.formData);

    if (errors.length > 0) {
      errors.forEach((error) => errorLog.error(error));
      setStatus("YML needs required fields before download.");
      return;
    }

    downloadYml(state.formData, getDownloadFilename());
    errorLog.success("YML download started.");
    setStatus("YML generated.");
  });

  try {
    state.records = await fetchVPSDB();
    searchController.setRecords(state.records);
    setStatus(`Loaded ${state.records.length.toLocaleString()} VPS records. Search by table name or VPS ID.`);
  } catch (error) {
    errorLog.error(error);
    setStatus("Unable to load VPS database.");
  }
}

initBuilder();
