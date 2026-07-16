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
- `styles/components/preview-panel.css` — YAML preview panel, action row, syntax highlighting, status indicator, and responsive behavior
- `styles/components/dialogs.css` — Help, Validation, and Recent dialogs, shared placement, dialog contents, and history controls
- `styles/components/database-status-toast.css` — VPS database status toast layout, states, animation, and responsive behavior
- `styles/components/yml-import.css` — header-column alignment, YML drop control, import toast placement, and responsive header behavior
- `styles/components/readme-actions.css` — Manual and Wizard README buttons, loading states, and README toast placement
- `styles/themes/pink.css` — secret pink-theme token overrides and theme-only decoration

### Refactor-owned JavaScript

- `src/config/fieldDefinitions.js` — asset-category configuration, bundle fields, configuration steps, and YAML exclusions
- `src/utils/formatting.js` — HTML escaping, labels, dates, arrays, line wrapping, and safe filenames
- `src/services/assetCatalog.js` — VPS asset filtering, VPU Patch relationships, cover selection, and semantic asset states
- `src/services/yamlService.js` — checksum normalization, YAML generation, and YAML highlighting
- `src/services/fileOutput.js` — browser downloads and clipboard output
- `src/services/archivePaths.js` — normalized archive-directory extraction and ordering
- `src/core/builderUtilities.js` — compatibility aggregator that preserves the existing `VPS_UTILS` public contract
- `src/services/tableSearch.js` — search normalization, ranking, exact matching, and keyboard-selection state
- `src/services/vpsDatabase.js` — verified database loading, IndexedDB caching, version checks, network fallbacks, and status events
- `src/controllers/databaseStatusController.js` — database status toast, stable shared-array behavior, periodic checks, and inactive-tab catch-up
- `src/controllers/themeController.js` — dark/light behavior plus secret pink-theme activation and persistence
- `src/ui/tooltipController.js` — removes duplicate native title tooltips and migrates asset badge copy into custom tooltip data
- `tests/smoke-test.html` and `tests/smoke-test.js` — same-origin runtime regression checks

### Production files still inherited by the refactor copy

- `js.src/uiHelper.js`
- `js.src/uiEnhancements.js`
- `js.src/v090Enhancements.js`
- `js.src/v091Corrections.js`
- `js.src/readmeGenerator.js`
- `js.src/main.js`
- `js.src/ymlImport.js`
- `js.src/v0102Fixes.js`
- `css.src/category.css`
- `css.src/uiEnhancements.css`
- `css.src/v090.css`
- `css.src/v091.css`

## Smoke-test coverage

The browser test verifies:

- Required DOM structure
- Core public globals
- Split utility module namespaces
- Stylesheet and script availability
- Required refactor-owned paths and removal of replaced legacy paths
- Preview-panel flex layout
- Shared dialog positioning
- YML import and README action layouts
- Native-tooltip migration through the active MutationObserver
- Archive JavaScript, worker, and WebAssembly dependencies
- Field-definition category and step counts
- Builder utility exports and compatibility bindings
- YAML normalization, PAL/VNI checksum output, and omitted temporary fields
- Required and selected asset-state behavior
- Search-result ranking behavior
- VPS database loading and status API
- Database status toast DOM and accessibility attributes
- Secret-theme transitions from dark, light, or pink startup states
- Initial YAML preview generation

## Refactor stages

1. Establish the working copy and verify all linked production assets. **Complete**
2. Isolate themes, design tokens, field configuration, search behavior, shared shell styling, and selected-table styling. **Complete**
3. Move the verified VPS database loader and database-status presentation into service and controller modules. **Complete**
4. Split preview, dialogs, YML import, README actions, and other clear CSS boundaries into responsibility-based components. **Complete**
5. Move stable shared utility and tooltip contracts into the refactor namespace. **Complete**
6. Audit and split the combined asset/configuration workspace stylesheet. **Ownership audit complete; file split in progress**
7. Split the builder utility compatibility layer into formatting, asset-state, YAML, archive, and output modules while retaining `VPS_UTILS` during migration. **Complete**
8. Introduce explicit application state and events.
9. Split validation, preview, history, storage, import, and output responsibilities.
10. Split UI rendering into table, asset, configuration, preview, dialog, tooltip, and toast modules.
11. Consolidate version-named correction files into responsibility-based modules.
12. Convert the refactor entry point to browser-native ES modules.
13. Run full regression tests before replacing the production root.

## Large workspace stylesheet audit

`css.src/category.css` is intentionally still inherited while its replacement files are prepared. Its selector ownership, load order, cascade constraints, and regression requirements are documented in:

- `docs/workspace-style-map.md`

The mapped replacement files are:

1. `styles/components/asset-panel.css`
2. `styles/components/configuration-panel.css`
3. `styles/components/form-controls.css`

The inherited stylesheet will only be detached after all three replacements are active and the added component-level layout tests pass.

## Next extraction targets

1. Implement the three mapped workspace component stylesheets and detach `css.src/category.css`
2. Move README generation and YML importing into named service/controller modules
3. Introduce an explicit application store before splitting `main.js`
4. Consolidate version-named enhancement and correction layers after their behavior is covered by targeted tests
