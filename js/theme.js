/*
  VPXS YML Creator Redesign
  Theme controller

  Uses a switch-style control for light/dark mode and persists the user's choice.
*/

const THEME_STORAGE_KEY = "vpxs-theme-mode";
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

function normalizeThemeMode(mode) {
  return mode === "light" || mode === "dark" ? mode : null;
}

function getInitialThemeMode() {
  try {
    const stored = normalizeThemeMode(localStorage.getItem(THEME_STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // Storage can fail in private browsing or locked-down web views.
  }

  return prefersDark.matches ? "dark" : "light";
}

function storeThemeMode(mode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Storage can fail in private browsing or locked-down web views.
  }
}

function applyTheme(mode) {
  const normalizedMode = normalizeThemeMode(mode) ?? "dark";
  const root = document.documentElement;
  const isDark = normalizedMode === "dark";

  root.dataset.themeMode = normalizedMode;
  root.dataset.theme = normalizedMode;

  const toggle = document.querySelector("[data-theme-toggle]");
  const modeLabel = document.querySelector("[data-theme-mode-label]");

  if (toggle) {
    toggle.setAttribute("aria-checked", String(isDark));
    toggle.setAttribute("aria-label", `${isDark ? "Dark" : "Light"} mode. Activate to switch color mode.`);
    toggle.title = `${isDark ? "Dark" : "Light"} mode`;
  }

  if (modeLabel) {
    modeLabel.textContent = isDark ? "Dark" : "Light";
  }
}

function toggleThemeMode() {
  const currentMode = normalizeThemeMode(document.documentElement.dataset.themeMode) ?? getInitialThemeMode();
  const nextMode = currentMode === "dark" ? "light" : "dark";

  storeThemeMode(nextMode);
  applyTheme(nextMode);
}

function initThemeToggle() {
  applyTheme(getInitialThemeMode());
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", toggleThemeMode);
}

initThemeToggle();
