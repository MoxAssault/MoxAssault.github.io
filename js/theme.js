/*
  VPXS YML Creator Redesign
  Stage 0: Theme controller

  Cycles system -> light -> dark, persists the selected mode, and keeps the
  applied theme in sync with OS preference while in system mode.
*/

const THEME_STORAGE_KEY = "vpxs-theme-mode";
const THEME_SEQUENCE = ["system", "light", "dark"];

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

function normalizeThemeMode(mode) {
  return THEME_SEQUENCE.includes(mode) ? mode : "system";
}

function getStoredThemeMode() {
  try {
    return normalizeThemeMode(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function getResolvedTheme(mode) {
  if (mode === "system") {
    return prefersDark.matches ? "dark" : "light";
  }

  return mode;
}

function applyTheme(mode) {
  const normalizedMode = normalizeThemeMode(mode);
  const resolvedTheme = getResolvedTheme(normalizedMode);
  const root = document.documentElement;

  root.dataset.themeMode = normalizedMode;
  root.dataset.theme = resolvedTheme;

  const toggle = document.querySelector("[data-theme-toggle]");
  const modeLabel = document.querySelector("[data-theme-mode-label]");

  if (toggle) {
    toggle.setAttribute("aria-label", `Theme: ${normalizedMode}. Activate to switch theme.`);
    toggle.title = `Theme: ${normalizedMode}`;
  }

  if (modeLabel) {
    modeLabel.textContent = normalizedMode;
  }
}

function storeThemeMode(mode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Storage can fail in private browsing or locked-down web views.
  }
}

function cycleThemeMode() {
  const currentMode = normalizeThemeMode(document.documentElement.dataset.themeMode);
  const currentIndex = THEME_SEQUENCE.indexOf(currentMode);
  const nextMode = THEME_SEQUENCE[(currentIndex + 1) % THEME_SEQUENCE.length];

  storeThemeMode(nextMode);
  applyTheme(nextMode);
}

function initThemeToggle() {
  applyTheme(getStoredThemeMode());

  document.querySelector("[data-theme-toggle]")?.addEventListener("click", cycleThemeMode);

  prefersDark.addEventListener("change", () => {
    if (document.documentElement.dataset.themeMode === "system") {
      applyTheme("system");
    }
  });
}

initThemeToggle();
