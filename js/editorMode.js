/*
  VPXS YML Creator Redesign
  Stage 4: Editor mode wiring
*/

import { YML_FIELD_GROUPS, getFieldByName, FIELD_TYPES } from "./fields.js?v=20260709-3";
import { readTextFile, isLikelyYmlFile, getEditorDownloadName } from "./fileHelper.js?v=20260709-3";
import { createErrorLog } from "./errorLog.js?v=20260709-3";
import { createPreviewPane } from "./previewPane.js?v=20260709-3";
import { downloadYml, parseYml } from "./yamlHelper.js?v=20260709-3";
import { renderWizardGroups } from "./wizardModule.js?v=20260709-3";

const elements = {
  modeTabs: Array.from(document.querySelectorAll("[data-mode]")),
  modePanels: Array.from(document.querySelectorAll("[data-mode-panel]")),
  dropzone: document.querySelector("[data-editor-dropzone]"),
  fileInput: document.querySelector("[data-editor-file]"),
  parseButton: document.querySelector("[data-editor-parse]"),
  downloadButton: document.querySelector("[data-editor-download]"),
  source: document.querySelector("[data-editor-source]"),
  wizard: document.querySelector("[data-editor-wizard]"),
  previewOutput: document.querySelector("[data-editor-preview-output]"),
  previewStatus: document.querySelector("[data-editor-preview-status]"),
  errorLog: document.querySelector("[data-editor-error-log]")
};

const editorState = {
  data: {},
  filename: "table-config.yml"
};

const editorErrorLog = elements.errorLog ? createErrorLog(elements.errorLog) : null;
const editorPreview = elements.previewOutput
  ? createPreviewPane({ output: elements.previewOutput, status: elements.previewStatus, errorLog: editorErrorLog })
  : null;

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

function setMode(mode) {
  elements.modeTabs.forEach((tab) => {
    const isActive = tab.dataset.mode === mode;
    tab.setAttribute("aria-selected", String(isActive));
  });

  elements.modePanels.forEach((panel) => {
    panel.hidden = panel.dataset.modePanel !== mode;
  });
}

function renderEditorWizard(data) {
  if (!elements.wizard) return;

  renderWizardGroups({
    groups: YML_FIELD_GROUPS,
    data,
    target: elements.wizard
  });

  editorPreview?.render(data);
  if (elements.downloadButton) elements.downloadButton.disabled = false;
}

function parseEditorSource() {
  editorErrorLog?.clear();

  try {
    const parsed = parseYml(elements.source?.value ?? "");
    editorState.data = parsed;
    renderEditorWizard(editorState.data);
  } catch (error) {
    editorErrorLog?.error(error);
    elements.previewStatus && (elements.previewStatus.textContent = "Editor parse error");
  }
}

async function loadFile(file) {
  editorErrorLog?.clear();

  if (!isLikelyYmlFile(file)) {
    editorErrorLog?.warn("This does not look like a .yml or .yaml file. I will still try to read it.");
  }

  try {
    const text = await readTextFile(file);
    editorState.filename = getEditorDownloadName(file.name);
    if (elements.source) elements.source.value = text;
    parseEditorSource();
  } catch (error) {
    editorErrorLog?.error(error);
  }
}

function initEditorMode() {
  elements.modeTabs.forEach((tab) => {
    tab.disabled = false;
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
  });

  elements.fileInput?.addEventListener("change", () => {
    const file = elements.fileInput.files?.[0];
    if (file) loadFile(file);
  });

  elements.dropzone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.dropzone.classList.add("is-dragging");
  });

  elements.dropzone?.addEventListener("dragleave", () => {
    elements.dropzone.classList.remove("is-dragging");
  });

  elements.dropzone?.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.dropzone.classList.remove("is-dragging");
    const file = event.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  });

  elements.parseButton?.addEventListener("click", parseEditorSource);

  elements.wizard?.addEventListener("wizard-field-change", (event) => {
    editorState.data[event.detail.fieldName] = coerceFieldValue(event.detail.fieldName, event.detail.value);
    editorPreview?.renderDebounced(editorState.data);
  });

  elements.downloadButton?.addEventListener("click", () => {
    downloadYml(editorState.data, editorState.filename);
    editorErrorLog?.success("Edited YML download started.");
  });

  setMode("builder");
}

initEditorMode();
