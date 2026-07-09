/*
  VPXS YML Creator Redesign
  Stage 6: Help modal controller
*/

const helpDialog = document.querySelector("[data-help-dialog]");
const openButton = document.querySelector("[data-help-open]");
const closeButton = document.querySelector("[data-help-close]");
const helpBody = document.querySelector("[data-help-body]");

const fallbackHelp = [
  {
    title: "Builder Mode",
    body: "Search VPS, select the table files, fill required wizard fields, review the live preview, then download a new YML file."
  },
  {
    title: "Editor Mode",
    body: "Load, drop, or paste an existing YML file. The parser maps known fields into the shared wizard cards so you can edit and download a revised file."
  },
  {
    title: "Required Fields",
    body: "Base table metadata, VPX ID, VPX checksum, FPS, notes, tagline, and testers are the main required fields. Other checksums become required when related files are selected."
  },
  {
    title: "Troubleshooting",
    body: "Hard-refresh if assets look stale. If an error appears, copy the exact text from the page or browser console so the broken module can be patched directly."
  }
];

function renderFallbackHelp() {
  if (!helpBody) return;

  helpBody.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "help-grid";

  fallbackHelp.forEach((section) => {
    const card = document.createElement("article");
    card.className = "help-card";

    const title = document.createElement("h3");
    title.textContent = section.title;

    const body = document.createElement("p");
    body.textContent = section.body;

    card.append(title, body);
    grid.appendChild(card);
  });

  helpBody.appendChild(grid);
}

async function loadHelpContent() {
  try {
    const response = await fetch("docs/help-content.md?v=20260709-5", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Unable to load help content.");
    }

    const markdown = await response.text();
    renderMarkdownHelp(markdown);
  } catch {
    renderFallbackHelp();
  }
}

function renderMarkdownHelp(markdown) {
  if (!helpBody) return;

  const sections = markdown
    .split(/\n##\s+/)
    .map((section) => section.trim())
    .filter(Boolean)
    .map((section, index) => index === 0 ? section.replace(/^#\s+/, "") : section);

  helpBody.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "help-grid";

  sections.slice(1).forEach((section) => {
    const [titleLine = "Help", ...bodyLines] = section.split("\n");
    const card = document.createElement("article");
    card.className = "help-card";

    const title = document.createElement("h3");
    title.textContent = titleLine.trim();
    card.appendChild(title);

    let list = null;

    bodyLines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        if (!list) {
          list = document.createElement(/^\d+\.\s+/.test(trimmed) ? "ol" : "ul");
          card.appendChild(list);
        }
        const item = document.createElement("li");
        item.innerHTML = formatInline(trimmed.replace(/^[-*]\s+|^\d+\.\s+/, ""));
        list.appendChild(item);
        return;
      }

      list = null;
      const paragraph = document.createElement("p");
      paragraph.innerHTML = formatInline(trimmed);
      card.appendChild(paragraph);
    });

    grid.appendChild(card);
  });

  helpBody.appendChild(grid);
}

function formatInline(value) {
  return String(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function openHelp() {
  if (!helpDialog) return;

  if (typeof helpDialog.showModal === "function") {
    helpDialog.showModal();
    return;
  }

  helpDialog.setAttribute("open", "");
}

function closeHelp() {
  helpDialog?.close?.();
  helpDialog?.removeAttribute("open");
}

openButton?.addEventListener("click", openHelp);
closeButton?.addEventListener("click", closeHelp);
helpDialog?.addEventListener("click", (event) => {
  if (event.target === helpDialog) closeHelp();
});

loadHelpContent();
