# VPXS YML Builder Refactor Workspace

This directory is the staged refactor copy of the production VPXS YML Builder.

## Safety boundary

- The repository root remains the production build.
- `refactor/index.html` is the working copy used for structural changes.
- Existing production CSS and JavaScript remain available from the repository root while modules are moved one responsibility at a time.
- A feature is detached from a production file only after its replacement is loaded and covered by the refactor smoke test.
- The `<base href="../">` entry keeps root runtime dependencies working, including the bundled libarchive worker and WebAssembly files.

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

### Refactor-owned styles

- `styles/tokens.css` — dark/light design tokens and semantic state values
- `styles/components/app-shell.css` — application shell, header, workspace, footer, buttons, and responsive shell rules
- `styles/components/search.css` — search controls and suggestion results
- `styles/components/table-card.css` — selected-table presentation and badges
- `styles/components/asset-panel.css` — asset rows, selectors, details, thumbnails, and status states
- `styles/components/configuration-panel.css` — configuration tabs, fields, checksums, archive controls, and responsive layouts
- `styles/components/form-controls.css` — shared custom checkbox presentation
- `styles/components/preview-panel.css` — generated-YAML preview and status presentation
- `styles/components/dialogs.css` — Help, Validation, and Recent dialogs
- `styles/components/database-status-toast.css` — VPS database status toast
- `styles/components/yml-import.css` — YML import control and toast placement
- `styles/components/readme-actions.css` — Manual and Wizard README actions
- `styles/themes/pink.css` — secret pink-theme overrides

### Refactor-owned application and services

- `src/app/appStore.js` — authoritative build, UI, validation, metadata, subscriptions, and named events
- `src/app/applicationController.js` — authoritative search, table loading, asset/configuration editing, workspace rendering, recent history UI, shortcuts, and clear/next workflow
- `src/config/fieldDefinitions.js` — asset categories, configuration steps, bundle fields, presets, and YAML exclusions
- `src/utils/formatting.js` — labels, dates, arrays, wrapping, escaping, and safe filenames
- `src/services/assetCatalog.js` — asset filtering, VPU Patch relationships, cover selection, and asset states
- `src/services/yamlService.js` — checksum normalization, YAML generation, and YAML highlighting
- `src/services/previewModel.js` — pure YAML preview, line count, highlighting, and overall status model
- `src/controllers/previewController.js` — preview rendering from shared state and generated-YAML synchronization
- `src/services/ymlParser.js` — flat-YML parsing
- `src/services/ymlImportModel.js` — imported-field normalization and asset-ID validation
- `src/controllers/ymlImportController.js` — import file limits, database lookup, DOM orchestration, drag-and-drop, and toasts
- `src/services/buildValidator.js` — required fields, checksums, override pairs, asset conflicts, bundled notes, PAL/VNI, PUP, VPU Patch, and line-length rules
- `src/controllers/validationStateController.js` — shared validation-state synchronization
- `src/controllers/validationDialogController.js` — validation-results rendering and dialog behavior
- `src/controllers/outputController.js` — validation-gated copy and download actions plus recent-history recording
- `src/services/storageService.js` — guarded localStorage access and stable storage keys
- `src/services/buildPersistence.js` — drafts, preferences, recent builds, deduplication, filenames, and history limits
- `src/controllers/persistenceController.js` — shared-state autosave scheduling and persistence APIs
- `src/services/fileOutput.js` — browser downloads and clipboard output
- `src/services/archivePaths.js` — normalized archive-directory extraction
- `src/services/readmeTemplateResolver.js` — local README-template routing
- `src/services/readmeGenerator.js` — store-backed Manual and Wizard README generation
- `src/core/builderUtilities.js` — temporary `VPS_UTILS` compatibility aggregator
- `src/services/tableSearch.js` — search normalization, ranking, exact matching, and keyboard state
- `src/services/vpsDatabase.js` — verified database loading, caching, version checks, and fallbacks
- `src/controllers/databaseStatusController.js` — database status presentation and periodic checks
- `src/controllers/themeController.js` — dark, light, and secret pink themes
- `src/ui/tooltipController.js` — native-title removal and custom tooltip migration

### Vendored README templates

- `templates/readme/man_README.md` — exact copy of upstream `Content/man_README.md`
- `templates/readme/wiz_README.md` — exact copy of upstream `Content/wiz_README.md`

The copies include the source files' final newline, so their Git blob SHAs match the upstream repository exactly. README generation no longer depends on those upstream files remaining available.

### Production files still inherited by the refactor copy

- `js.src/uiHelper.js`
- `js.src/uiEnhancements.js`
- `js.src/v090Enhancements.js`
- `js.src/v091Corrections.js`
- `js.src/v0102Fixes.js`
- `css.src/uiEnhancements.css`
- `css.src/v090.css`
- `css.src/v091.css`

The refactor entry point no longer loads `js.src/main.js` or `src/app/legacyStateBridge.js`.

## Smoke-test coverage

The browser suite verifies:

- Required DOM structure and runtime dependencies
- Refactor ownership and absence of replaced legacy paths
- Application-store events, nested updates, detached snapshots, and restoration
- Store-authoritative table selection and rendered workspace state
- Shared validation and output-controller gates
- Consolidated Backglass, Color ROM, and VPU Patch validation rules
- README shared-state context and exact vendored-template integrity
- YML parsing, normalization, asset validation, and import behavior
- Preview model and shared-state synchronization
- Draft, preference, and recent-build persistence
- Component layouts, tooltip migration, archive runtime files, database loading/status, search ranking, and theme transitions

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
10. Split remaining inherited UI rendering and enhancement responsibilities.
11. Consolidate version-named enhancement and correction files.
12. Convert the refactor entry point to browser-native ES modules.
13. Run the full replacement regression pass before changing the production root.

## Shared state ownership

`VPS_APP_STORE` is now the authoritative state owner. `applicationController.js` writes record, selection, value, and UI changes directly to the store. Preview, validation, persistence, output, import, and README modules consume that shared state.

The temporary `legacyStateBridge.js` and inherited `js.src/main.js` are no longer loaded by `/refactor/`; the bridge file has been removed.

The store contract and event behavior are documented in `docs/state-architecture.md`.

## Workspace stylesheet split

The former `css.src/category.css` responsibilities are separated into:

1. `styles/components/asset-panel.css`
2. `styles/components/configuration-panel.css`
3. `styles/components/form-controls.css`

The ownership map and cascade constraints remain documented in `docs/workspace-style-map.md`.

## Remaining work

1. Split inherited UI rendering and enhancement behavior into responsibility-based modules
2. Consolidate `uiEnhancements`, `v090`, `v091`, and `v0102` behavior
3. Convert the refactor entry point to browser-native ES modules
4. Run the full replacement regression pass before changing the production root
