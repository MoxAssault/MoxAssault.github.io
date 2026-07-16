# VPXS YML Builder Refactor Workspace

This directory is the staged refactor copy of the production VPXS YML Builder.

## Safety boundary

- The repository root remains the production build.
- `refactor/index.html` is the working copy used for structural changes.
- Existing production CSS and JavaScript remain available from the repository root while modules are moved one responsibility at a time.
- A feature is only detached from a production file after its replacement is loaded and covered by the refactor smoke test.
- The `<base href="../">` entry keeps existing root runtime dependencies working, including the bundled libarchive worker and WebAssembly files.

## Baseline behavior to preserve

- VPS database verification, caching, and fallback sources
- Table search and suggestions
- Asset selection and status display
- Configuration tabs and field validation
- YAML generation, copy, download, and recent builds
- YML import and edit workflow
- Checksum and PUP archive tools
- Manual and Wizard README generation
- Dark, light, and secret pink themes
- Responsive desktop and mobile layouts

## Current responsibility map

### Refactor-owned files

- `styles/tokens.css` — dark/light design tokens, semantic status colors, form-control tokens, radii, shadows, and focus rings
- `styles/components/app-shell.css` — document defaults, header, shared buttons, theme toggle, empty state, workspace shell, footer, responsive shell rules, and utility classes
- `styles/themes/pink.css` — secret pink-theme token overrides and theme-only decoration
- `src/config/fieldDefinitions.js` — asset-category configuration, bundle fields, configuration steps, and YAML exclusions
- `src/services/tableSearch.js` — search normalization, ranking, exact matching, and keyboard-selection state
- `src/controllers/themeController.js` — dark/light behavior plus secret pink-theme activation and persistence
- `tests/smoke-test.html` and `tests/smoke-test.js` — same-origin runtime regression checks

### Production files still inherited by the refactor copy

- `js.src/utilities.js`
- `js.src/apiHelper.js`
- `js.src/vpsDbToast.js`
- `js.src/uiHelper.js`
- `js.src/uiEnhancements.js`
- `js.src/v090Enhancements.js`
- `js.src/v091Corrections.js`
- `js.src/readmeGenerator.js`
- `js.src/main.js`
- `js.src/ymlImport.js`
- `js.src/v0102Fixes.js`
- `js.src/nativeTooltipCleanup.js`
- Remaining component and correction stylesheets under `css.src/`

## Smoke-test coverage

The browser test verifies:

- Required DOM structure
- Core public globals
- Stylesheet and script availability
- Required refactor-owned paths and removal of replaced legacy paths
- Archive JavaScript, worker, and WebAssembly dependencies
- Field-definition category and step counts
- Search-result ranking behavior
- VPS database loading
- Secret-theme transitions from dark, light, or pink startup states
- Initial YAML preview generation

## Refactor stages

1. Establish the working copy and verify all linked production assets. **Complete**
2. Isolate themes, design tokens, field configuration, search behavior, and shared shell styling. **In progress**
3. Move the verified VPS database loader and database-status presentation into service and UI modules.
4. Introduce explicit application state and events.
5. Split validation, preview, history, storage, import, and output responsibilities.
6. Split UI rendering into table, asset, configuration, preview, dialog, tooltip, and toast modules.
7. Consolidate version-named correction files into responsibility-based modules.
8. Convert the refactor entry point to browser-native ES modules.
9. Run full regression tests before replacing the production root.

## Next extraction targets

1. `js.src/apiHelper.js` → `src/services/vpsDatabase.js`
2. `js.src/vpsDbToast.js` → database status controller and toast UI modules
3. `css.src/vpsDbToast.css` → `styles/components/toasts.css`
4. `css.src/search.css` → `styles/components/search.css`
5. `css.src/card.css` → `styles/components/table-card.css`
