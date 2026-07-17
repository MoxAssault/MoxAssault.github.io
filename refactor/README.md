# VPXS YML Builder Refactor Workspace

This directory contains the staged replacement for the production VPXS YML Builder.

## Safety boundary

- The repository root remains the production build.
- `/refactor/` is the isolated working and regression environment.
- Production root files are not replaced until the complete automated and deployed-browser regression gates pass.
- `<base href="../">` preserves root-hosted runtime assets such as the libarchive worker and WebAssembly file.

## Final architecture

### Entry point

`src/bootstrap.js` is the single browser-native ES-module entry point. It loads foundational services in dependency order, imports the split UI facade, starts application controllers, publishes `VPS_MODULE_MANIFEST`, and exposes `VPS_BOOTSTRAP_STATUS`.

`refactor/index.html` contains one application script:

```html
<script type="module" src="/refactor/src/bootstrap.js"></script>
```

The refactor entry point no longer loads production JavaScript or version-named correction files.

### State and application ownership

- `src/app/appStore.js` — authoritative build, UI, validation, metadata, subscriptions, and named events
- `src/app/applicationController.js` — search, table loading, asset/configuration editing, workspace rendering, history UI, shortcuts, and clear/next workflow
- `src/controllers/previewController.js` — generated preview and YAML synchronization
- `src/controllers/validationStateController.js` — validation-state synchronization
- `src/controllers/validationDialogController.js` — validation results and dialog presentation
- `src/controllers/outputController.js` — validation-gated copy and download actions
- `src/controllers/persistenceController.js` — draft autosave, preferences, and history APIs
- `src/controllers/ymlImportController.js` — import workflow and browser orchestration
- `src/controllers/workflowUiController.js` — field error markers, help tabs, preview status breakdown, first-error navigation, and import scrolling protection

### Split UI rendering

- `src/ui/dom.js` — shared DOM and copy-control helpers
- `src/ui/searchRenderer.js` — search suggestions
- `src/ui/tableRenderer.js` — selected-table card, artwork, badges, and VPS ID copy control
- `src/ui/assetRenderer.js` — asset rows, selectors, thumbnails, status, and details
- `src/ui/checksumTools.js` — background MD5 calculation, archive browsing, checksum drops, and PAL/VNI extension pairing
- `src/ui/configurationRenderer.js` — configuration tabs, fields, advanced controls, conditional inputs, and checksum controls
- `src/ui/index.js` — stable `VPS_UI` compatibility facade
- `src/ui/tooltipController.js` — native-title cleanup and custom tooltip migration

### Services

- `src/config/fieldDefinitions.js` — asset categories, configuration steps, bundle fields, presets, and YAML exclusions
- `src/utils/formatting.js` — labels, dates, arrays, wrapping, escaping, and safe filenames
- `src/services/assetCatalog.js` — asset filtering, relationships, cover selection, and semantic asset states
- `src/services/yamlService.js` — checksum normalization, YAML generation, and highlighting
- `src/services/previewModel.js` — pure preview model and overall asset state
- `src/services/ymlParser.js` — flat-YML parsing
- `src/services/ymlImportModel.js` — import normalization and asset-ID validation
- `src/services/buildValidator.js` — required fields, checksums, override pairs, conflicts, bundled notes, PAL/VNI, PUP, VPU Patch, and line-length rules
- `src/services/storageService.js` — guarded localStorage access
- `src/services/buildPersistence.js` — drafts, preferences, history, deduplication, and filenames
- `src/services/fileOutput.js` — browser download and clipboard output
- `src/services/archivePaths.js` — normalized archive-directory extraction
- `src/services/readmeTemplateResolver.js` — local README-template routing
- `src/services/readmeGenerator.js` — store-backed Manual and Wizard README generation
- `src/services/tableSearch.js` — search normalization, ranking, exact matching, and keyboard state
- `src/services/vpsDatabase.js` — verified database loading, caching, version checks, and fallbacks
- `src/controllers/databaseStatusController.js` — database status presentation and periodic checks
- `src/controllers/themeController.js` — dark, light, and secret pink themes
- `src/core/builderUtilities.js` — temporary `VPS_UTILS` compatibility facade during final promotion

### Styles

All application styles loaded by `/refactor/` are refactor-owned. The former `uiEnhancements`, `v090`, and `v091` styles are consolidated into:

- `styles/components/workflow-enhancements.css`

That file owns table artwork containment, compact advanced controls, Help tabs, copy controls, field-error markers, control tooltips, Color ROM/PUP corrections, preview status breakdowns, stacking, and responsive corrections.

The remaining component styles continue to own the shell, search, selected table, assets, configuration, controls, preview, dialogs, database status, import, README actions, tokens, and pink theme.

## Vendored README templates

- `templates/readme/man_README.md` — exact copy of upstream `Content/man_README.md`
- `templates/readme/wiz_README.md` — exact copy of upstream `Content/wiz_README.md`

Their Git blob SHAs match the original files, including the final newline. README generation no longer depends on the source templates remaining available.

## Regression gate

`tests/smoke-test.html` now runs one coordinated end-to-end suite through `tests/final-smoke.js`. It verifies:

- Native-module bootstrap and the complete responsibility-based module manifest
- Absence of production JavaScript, inherited CSS, version-named files, and the removed state bridge
- Required DOM, globals, module files, stylesheets, and archive runtime dependencies
- Store events, nested updates, detached snapshots, restoration, and authoritative rendering
- UI facade methods and split table, asset, configuration, checksum, help, validation, preview, and tooltip behavior
- YAML, YML parsing/import, search ranking, MD5 calculation, output gates, README templates, persistence, database status, and theme transitions

`.github/workflows/refactor-regression.yml` starts a static server, installs Chromium through Playwright, and executes `tests/run-browser-regression.mjs` on every refactor change and through manual dispatch.

## Refactor stages

1. Establish the working copy and verify linked production assets. **Complete**
2. Isolate themes, tokens, field configuration, search behavior, shell styling, and table styling. **Complete**
3. Move VPS database loading and status presentation. **Complete**
4. Split clear CSS component boundaries. **Complete**
5. Move stable utility and tooltip contracts. **Complete**
6. Split the asset/configuration workspace stylesheet. **Complete**
7. Split the builder utility compatibility layer. **Complete**
8. Introduce explicit application state and events. **Complete**
9. Split validation, preview, history, storage, import, and output responsibilities; make the shared store authoritative. **Complete**
10. Split inherited UI rendering and enhancement responsibilities. **Complete**
11. Consolidate version-named enhancement and correction files. **Complete**
12. Convert the refactor entry point to browser-native ES modules. **Complete**
13. Run the full replacement regression pass before changing the production root. **Gate installed — awaiting passing automated and deployed-browser runs**

## Production promotion checklist

Production replacement is allowed only after all of the following are true:

1. The GitHub Actions **Refactor Regression** workflow passes on the final refactor commit.
2. `/refactor/tests/smoke-test.html` reports every regression check as passing on GitHub Pages.
3. Manual spot checks confirm search, asset selection, configuration editing, YML import, checksum/archive tools, validation, copy/download, README generation, recent history, and all themes.
4. The root production files are backed up or retained in commit history before promotion.
5. The promoted root is tested again after replacement.
