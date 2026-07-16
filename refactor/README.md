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

### Refactor-owned styles

- `styles/tokens.css` — dark/light design tokens, semantic status colors, form-control tokens, radii, shadows, and focus rings
- `styles/components/app-shell.css` — document defaults, header, shared buttons, theme toggle, empty state, workspace shell, footer, responsive shell rules, and utility classes
- `styles/components/search.css` — search input, search status, suggestion list, focus, and disabled states
- `styles/components/table-card.css` — selected-table strip, artwork preview, metadata, asset badges, badge states, and responsive behavior
- `styles/components/asset-panel.css` — asset rows, selectors, thumbnails, details, status indicators, semantic state colors, and responsive asset layouts
- `styles/components/configuration-panel.css` — configuration tabs, fields, named layouts, checksum drop zones, PUP archive controls, issue indicators, and responsive configuration layouts
- `styles/components/form-controls.css` — shared custom checkbox appearance used across asset and configuration controls
- `styles/components/preview-panel.css` — YAML preview panel, action row, syntax highlighting, status indicator, and responsive behavior
- `styles/components/dialogs.css` — Help, Validation, and Recent dialogs, shared placement, dialog contents, and history controls
- `styles/components/database-status-toast.css` — VPS database status toast layout, states, animation, and responsive behavior
- `styles/components/yml-import.css` — header-column alignment, YML drop control, import toast placement, and responsive header behavior
- `styles/components/readme-actions.css` — Manual and Wizard README buttons, loading states, and README toast placement
- `styles/themes/pink.css` — secret pink-theme token overrides and theme-only decoration

### Refactor-owned JavaScript

- `src/config/fieldDefinitions.js` — asset-category configuration, bundle fields, configuration steps, and YAML exclusions
- `src/app/appStore.js` — detached application-state snapshots, state updates, subscriptions, revisions, and named events
- `src/app/legacyStateBridge.js` — temporary bridge that mirrors production controller state into the shared store; it no longer observes the rendered YAML preview
- `src/utils/formatting.js` — HTML escaping, labels, dates, arrays, line wrapping, and safe filenames
- `src/services/assetCatalog.js` — VPS asset filtering, VPU Patch relationships, cover selection, and semantic asset states
- `src/services/yamlService.js` — checksum normalization, YAML generation, and YAML highlighting
- `src/services/previewModel.js` — pure generated-YAML, line-count, syntax-highlight, and overall asset-status model
- `src/controllers/previewController.js` — renders the preview from shared state and writes generated YAML back to `VPS_APP_STORE`
- `src/services/ymlParser.js` — pure flat-YML parsing for top-level VPXS fields, quoted values, arrays, and folded/literal blocks
- `src/services/ymlImportModel.js` — supported-field filtering, import normalization, selection extraction, and VPS asset-ID validation
- `src/controllers/ymlImportController.js` — file limits, import toasts, database lookup, DOM orchestration, field loading, and drop-zone behavior
- `src/services/buildValidator.js` — pure build validation for required fields, checksums, asset conflicts, bundled notes, PAL/VNI, PUP requirements, and YAML line length
- `src/controllers/validationStateController.js` — recalculates validation on shared build/YAML changes and writes errors and warnings into `VPS_APP_STORE`
- `src/services/storageService.js` — guarded text/JSON localStorage access and stable application storage keys
- `src/services/buildPersistence.js` — draft snapshots, workspace preferences, recent-build entries, deduplication, filenames, and history limits
- `src/controllers/persistenceController.js` — shared-state autosave scheduling plus draft, preference, and history APIs
- `src/services/fileOutput.js` — browser downloads and clipboard output
- `src/services/archivePaths.js` — normalized archive-directory extraction and ordering
- `src/services/readmeTemplateResolver.js` — redirects the original upstream README-template URLs to local vendored copies
- `src/services/readmeGenerator.js` — Manual and Wizard README generation driven directly by shared application state
- `src/core/builderUtilities.js` — compatibility aggregator that preserves the existing `VPS_UTILS` public contract
- `src/services/tableSearch.js` — search normalization, ranking, exact matching, and keyboard-selection state
- `src/services/vpsDatabase.js` — verified database loading, IndexedDB caching, version checks, network fallbacks, and status events
- `src/controllers/databaseStatusController.js` — database status toast, stable shared-array behavior, periodic checks, and inactive-tab catch-up
- `src/controllers/themeController.js` — dark/light behavior plus secret pink-theme activation and persistence
- `src/ui/tooltipController.js` — removes duplicate native title tooltips and migrates asset badge copy into custom tooltip data
- `tests/smoke-test.html`, `tests/smoke-test.js`, and the Stage 9 smoke extensions — same-origin runtime regression checks

### Vendored README templates

- `templates/readme/man_README.md` — exact copy of upstream `Content/man_README.md`
- `templates/readme/wiz_README.md` — exact copy of upstream `Content/wiz_README.md`

The copies include the source files' final newline, so their Git blob SHAs match the upstream repository exactly. README generation is routed to these local files and no longer depends on the upstream files remaining available.

### Production files still inherited by the refactor copy

- `js.src/uiHelper.js`
- `js.src/uiEnhancements.js`
- `js.src/v090Enhancements.js`
- `js.src/v091Corrections.js`
- `js.src/main.js`
- `js.src/v0102Fixes.js`
- `css.src/uiEnhancements.css`
- `css.src/v090.css`
- `css.src/v091.css`

## Smoke-test coverage

The browser test verifies:

- Required DOM structure and dependency availability
- Refactor-owned paths and removal of replaced legacy paths
- Application store updates, events, nested notifications, detached snapshots, and restoration
- README shared-state context and exact vendored-template integrity
- Flat-YML parsing, duplicate rejection, normalization, asset-ID validation, and import-controller behavior
- Pure build validation, PAL/VNI requirements, and validation-store synchronization
- Preview model output, status calculation, line counting, DOM synchronization, and store-generated YAML
- Storage JSON round trips, draft snapshot compatibility, recent-build deduplication, history snapshots, and workspace preferences
- Asset, configuration, checkbox, preview, dialog, YML import, and README action layouts
- Tooltip migration, archive runtime dependencies, database loading/status, search ranking, and all theme transitions

## Refactor stages

1. Establish the working copy and verify all linked production assets. **Complete**
2. Isolate themes, design tokens, field configuration, search behavior, shared shell styling, and selected-table styling. **Complete**
3. Move the verified VPS database loader and database-status presentation into service and controller modules. **Complete**
4. Split preview, dialogs, YML import, README actions, and other clear CSS boundaries into responsibility-based components. **Complete**
5. Move stable shared utility and tooltip contracts into the refactor namespace. **Complete**
6. Audit and split the combined asset/configuration workspace stylesheet. **Complete**
7. Split the builder utility compatibility layer into formatting, asset-state, YAML, archive, and output modules while retaining `VPS_UTILS` during migration. **Complete**
8. Introduce explicit application state and events. **Complete**
9. Split validation, preview, history, storage, import, and output responsibilities. **In progress — service and shared-state layers complete; legacy UI gates remain**
10. Split UI rendering into table, asset, configuration, preview, dialog, tooltip, and toast modules.
11. Consolidate version-named correction files into responsibility-based modules.
12. Convert the refactor entry point to browser-native ES modules.
13. Run full regression tests before replacing the production root.

## Shared state transition

The state shape, write methods, subscriptions, named events, compatibility boundary, and temporary bridge are documented in `docs/state-architecture.md`.

The production `main.js` still owns its internal mutable state. `legacyStateBridge.js` mirrors that state into `VPS_APP_STORE` until a refactor-owned application controller replaces it. New modules read from the store rather than intercepting UI render functions or scraping the DOM.

The shared preview is now generated by `previewModel.js` and rendered by `previewController.js`. The bridge no longer watches `previewYaml`; generated YAML is written directly into the store by the preview controller.

Drafts, preferences, and recent-build formats are now owned by `storageService.js` and `buildPersistence.js`. `persistenceController.js` autosaves shared build state and cancels stale timers when a build is cleared or restored to empty.

Shared validation is maintained by `buildValidator.js` and `validationStateController.js`. The production `main.js` validator remains temporarily for the current dialog and copy/download gates.

## Workspace stylesheet split

The former `css.src/category.css` responsibilities are separated into:

1. `styles/components/asset-panel.css`
2. `styles/components/configuration-panel.css`
3. `styles/components/form-controls.css`

The ownership map and cascade constraints remain documented in `docs/workspace-style-map.md`. The refactor entry point no longer loads `css.src/category.css`, and the smoke test rejects that legacy path.

## Stage 9 import split

The former `js.src/ymlImport.js` has been replaced in the refactor build by:

1. `services/ymlParser.js`
2. `services/ymlImportModel.js`
3. `controllers/ymlImportController.js`

The parser and model are pure, directly testable modules. The controller retains the existing browser workflow, file-size limit, confirmation behavior, current-database validation, asset ordering, field loading, toasts, and drag-and-drop behavior.

## Next extraction targets

1. Move the validation dialog and copy/download gates onto the shared validator and output services
2. Introduce a refactor-owned application controller as the authoritative store writer and remove `legacyStateBridge.js`
3. Split UI rendering after state and event ownership are authoritative
4. Consolidate version-named enhancement and correction layers
5. Convert the refactor entry point to browser-native ES modules
6. Run the full replacement regression pass before changing the production root
