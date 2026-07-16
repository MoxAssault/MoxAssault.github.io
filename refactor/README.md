# VPXS YML Builder Refactor Workspace

This directory is the staged refactor copy of the production VPXS YML Builder.

## Safety boundary

- The repository root remains the production build.
- `refactor/index.html` is the working copy used for structural changes.
- Existing production CSS and JavaScript are initially loaded from the repository root to preserve behavior while modules are moved one responsibility at a time.
- A feature is only detached from the production files after its replacement has been tested in this directory.

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

## Refactor stages

1. Establish the working copy and verify all linked production assets.
2. Move theme behavior into `src/controllers/themeController.js` and theme variables into `styles/themes/pink.css`.
3. Introduce explicit application state and events.
4. Split validation, preview, search, history, storage, and output responsibilities.
5. Split UI rendering into table, asset, configuration, preview, dialog, tooltip, and toast modules.
6. Consolidate version-named correction files into responsibility-based modules.
7. Convert the refactor entry point to browser-native ES modules.
8. Run full regression tests before replacing the production root.

## Current stage

Stage 2 has started. The secret pink theme is now isolated under responsibility-based paths in the refactor copy. All other behavior still uses the production files.
