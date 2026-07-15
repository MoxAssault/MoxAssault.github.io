# VPXS YML Builder

A browser-based workspace for creating, validating, copying, and downloading VPXS table configuration files using data from the Virtual Pinball Spreadsheet database.

The builder is designed for repeat use: search for a table, select the assets that apply, complete the enabled configuration tabs, review the generated YAML, and move directly to the next build.

## Table of contents

- [Live site](#live-site)
- [What the builder does](#what-the-builder-does)
- [Instructions](#instructions)
- [Fast repeat-use workflow](#fast-repeat-use-workflow)
- [Asset selection](#asset-selection)
- [Configuration panel](#configuration-panel)
- [Validation and status indicators](#validation-and-status-indicators)
- [VPS database updates](#vps-database-updates)
- [Checksum and archive tools](#checksum-and-archive-tools)
- [YAML behavior](#yaml-behavior)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Saved browser data](#saved-browser-data)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Version history](#version-history)
- [Credits and bundled software](#credits-and-bundled-software)

## Live site

**VPXS YML Builder:** https://moxassault.github.io/

## What the builder does

- Searches the Virtual Pinball Spreadsheet database by table name or VPS ID.
- Filters unsupported table formats and unavailable or broken database entries.
- Supports VPX, Backglass, ROM, Color ROM, PUP Pack, and VPU Patch assets.
- Generates a live YAML preview while configuration values are entered.
- Validates required values, checksums, bundled-asset requirements, override relationships, and line length.
- Calculates MD5 checksums from files dropped onto supported checksum fields.
- Reads ZIP, RAR, and 7Z PUP Pack archives and offers discovered directories as Archive Root choices.
- Saves unfinished work and recent completed builds in the browser.
- Verifies that search is using the latest published VPS database version.

## Instructions

1. Enter a VPS table ID or part of a table name in the search box.
2. Choose the correct table from the search results.
3. Select a VPX file and any additional assets that apply to the build.
4. Open the enabled Configuration Panel tabs and complete the required fields.
5. Drop supported files onto checksum fields to calculate MD5 values automatically, or enter valid hashes manually.
6. Review the YAML Preview and correct any fields marked with an error dot.
7. Select **Validate** to see the complete error and warning list.
8. Select **Copy** or **Download & Clear** when the build passes validation.

## Fast repeat-use workflow

1. Search for a table.
2. Select the applicable assets.
3. Complete only the enabled configuration tabs.
4. Use the YAML Preview status dot to inspect the build and jump to the first error.
5. Validate the configuration.
6. Download the YML and automatically clear the workspace for the next table.

The active build autosaves in the current browser. Recent copied and downloaded builds can be reopened from **Recent Build History**.

## Asset selection

The Assets Panel lists the available asset categories for the selected table:

- **VPX**
- **Backglass**
- **ROM**
- **Color ROM**
- **PUP Pack**
- **VPU Patch**

Each asset row shows its current state and available database entries. Broken entries are disabled. Supported artwork includes compact thumbnail previews.

A green asset badge is clickable and jumps to that asset's configuration tab. The Configuration Panel appears whenever at least one asset is selected or marked as bundled; selecting a VPX first is not required to begin entering other asset details.

## Configuration panel

The Configuration Panel contains tabs for Main, VPX, Backglass, ROM, Color ROM, PUP Pack, and VPU Patch settings.

- **Main** contains the Game VPS ID, FPS, tagline, notes, testers, and table metadata overrides.
- The Game VPS ID uses a compact code-style display with a copy button.
- **Enable for Wizard** is intentionally fixed off for compatibility.
- Asset-specific tabs become available when their asset is selected or marked as bundled.
- Advanced Config sections contain optional metadata and override fields.
- URL and Version Override fields must be supplied together for ROM, Color ROM, and VPU Patch entries.
- Backglass URL Override requires Backglass Authors Override and Backglass Image Override.
- VPU Patch checksum is required whenever the VPU Patch tab is enabled.

## Validation and status indicators

Validation errors block Copy and Download. Warnings are allowed but should be reviewed.

The builder provides several status indicators:

- Asset-row status labels.
- Asset badges in the Assets Panel heading.
- Configuration-tab error and warning markers.
- Field-level red error dots with custom tooltips.
- A combined YAML Preview status dot covering both assets and configuration tabs.

Hover or keyboard-focus the YAML Preview status dot to see active state counts. Entries reported only as unavailable are omitted from that tooltip. Click the dot, or press Enter while it is focused, to move to the first current validation error.

## VPS database updates

When the page opens, the builder immediately checks the Virtual Pinball Spreadsheet `lastUpdated.json` version.

- A top-entry toast shows the checking state.
- If the cached version matches, the builder continues using it.
- If a newer version exists, the database is downloaded, validated, and stored in IndexedDB.
- If the update check fails, the most recent verified cache remains available.
- While the page stays open, the version is checked again every two hours.
- Returning to a tab that has been inactive for at least two hours triggers a catch-up check.

The full database is downloaded only when the published version changes.

## Checksum and archive tools

Supported checksum fields accept file drag-and-drop and calculate MD5 in the browser. Hashing runs in a Web Worker when available so the interface remains responsive.

Accepted file types depend on the field, including:

- VPX files
- DirectB2S files
- ROM archives
- Single Color ROM files using `.crz`, `.pal`, or `.pac`
- Double Color ROM PAL/VNI pairs using one `.pal` and one `.vni` file in either checksum field
- PUP Pack ZIP, RAR, and 7Z archives
- VPU Patch files

For PAL/VNI pairs, both checksum fields initially accept either extension. After the first file is dropped, that extension is removed from the other field so the pair cannot contain two files of the same type.

When a supported PUP Pack archive is dropped onto the PUP Pack Checksum field, the builder also reads its directory structure. Discovered directories are sorted from top-level paths downward and offered in the PUP Pack Archive Root selector.

Files are processed by the browser and are not uploaded by this application.

## YAML behavior

- YAML keys are emitted in alphabetical order.
- Empty strings and empty arrays are omitted.
- `enabled: false` is emitted by default.
- FPS and `tableYearOverride` are emitted as integers.
- Testers and Backglass author overrides are emitted as YAML arrays.
- A single checksum is emitted as a string.
- Multiple checksums are emitted as a YAML list.
- PAL/VNI Color ROM mode emits `coloredROMPin2DMD: true` and a two-item `coloredROMChecksum` list.
- URL fields that exceed the line-length limit receive the supported yamllint comment.
- Long non-URL text values use folded YAML blocks.
- Unsupported UI-only values are excluded from output.
- VPU Patch values use `diffVPSId`, `diffChecksum`, `diffUrlOverride`, and `diffVersionOverride`.
- PUP Pack output supports `pupVPSId`, `pupBundled`, `pupChecksum`, `pupFileUrl`, `pupVersion`, `pupArchiveFormat`, `pupArchiveRoot`, `pupRequired`, and `pupNotes` when applicable.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `/` | Focus and select the table search field |
| `Ctrl`/`Cmd` + `Enter` | Validate the current build |
| `Ctrl`/`Cmd` + `Shift` + `Enter` | Download the YAML and clear the workspace |
| `Escape` | Close an open dialog |
| `Enter` or `Space` on the preview status dot | Open the first validation error |

## Saved browser data

The application stores the following information in the current browser:

- Theme preference.
- Active configuration tab.
- Current unfinished draft.
- Recent completed build snapshots.
- Last verified VPS database and version metadata.

No sign-in is required. Clearing site data in the browser removes these saved values.

## Project structure

```text
index.html
css.src/
  1variables.css
  base.css
  search.css
  card.css
  category.css
  modal.css
  vpsDbToast.css
  uiEnhancements.css
  v090.css
js.src/
  fields.js
  utilities.js
  apiHelper.js
  vpsDbToast.js
  searchHelper.js
  uiHelper.js
  uiEnhancements.js
  main.js
  nativeTooltipCleanup.js
  v090Enhancements.js
vendor/libarchive/
  libarchive.js
  worker-bundle.js
  libarchive.wasm
  LICENSE
fixtures/
  pup-test.zip
  pup-test.7z
test-runtime.html
README.md
```

### Main integration points

- `js.src/fields.js` defines categories, configuration tabs, fields, options, YAML exclusions, and reusable values.
- `js.src/utilities.js` contains YAML generation, formatting, asset-state, checksum, and archive helpers.
- `js.src/apiHelper.js` verifies, downloads, validates, and caches VPS database data.
- `js.src/vpsDbToast.js` displays immediate and scheduled database-check status.
- `js.src/searchHelper.js` filters and ranks table search results.
- `js.src/uiHelper.js` renders table, asset, field, tab, checksum, and archive controls.
- `js.src/uiEnhancements.js` contains image containment, field error markers, Advanced Config spacing, and combined preview status behavior.
- `js.src/main.js` manages application state, validation, drafts, history, keyboard shortcuts, and output actions.
- `js.src/v090Enhancements.js` manages the Help tabs, additional validation markers, and refined preview status behavior.

## Troubleshooting

### The site loads without styling or scripts

Open browser developer tools and check for `404` responses. The repository must preserve the `css.src`, `js.src`, and `vendor` folder names and paths exactly as referenced by `index.html`.

### Search reports that the database could not be verified

The builder will use the last verified IndexedDB copy when available. Check the browser console and `window.getVPSDBStatus()` for the active source and state.

### A checksum drop is rejected

Confirm that the dropped file extension matches the field hint. Each checksum control accepts only the file types appropriate for that asset. In PAL/VNI mode, the second file must use the extension not already assigned to the first field.

### A PUP archive checksum works but no directories appear

The archive may not contain nested directories, may be damaged, or may use an unsupported archive feature. The checksum can still be used when MD5 calculation succeeds.

### Copy or Download does nothing

Select **Validate**. Blocking validation errors open the results dialog instead of allowing invalid YAML to be copied or downloaded.

### A previous build reappears after refreshing

The current draft is intentionally restored from browser storage. Use **Clear** or **Download & Clear** to remove the active draft.

## FAQ

### Does the site upload my VPX, ROM, Backglass, Color ROM, or PUP files?

No. Files dropped onto checksum fields are processed in the browser.

### Does the site edit the Virtual Pinball Spreadsheet database?

No. The database is read-only from this application. The builder only uses it to locate tables and available assets.

### Why does the database toast appear every time the site opens?

It confirms whether the cached database matches the latest published `lastUpdated.json` version. The initial check prevents searches from silently using stale data.

### Why does the site check again every two hours?

The VPS database can change while the page remains open. The periodic check compares only the lightweight version file unless a newer database is available.

### Can I continue working if the database host is unavailable?

Yes, after at least one successful load. The last verified database remains in IndexedDB and is used as a fallback.

### Why are some asset choices disabled?

Entries marked as broken or unavailable by the VPS database cannot be selected for a valid build.

### Why are some configuration tabs disabled?

Asset-specific tabs become available only when their asset is selected or marked as bundled.

### Why is Copy or Download blocked?

The generated YAML has at least one validation error. Warnings are allowed, but errors must be corrected first.

### What does the YAML Preview dot represent?

It combines the current Assets Panel states with enabled Configuration Panel states. Hover or keyboard-focus the dot to see active status counts, or click it to move to the first current error.

### What is stored in Recent Build History?

The newest copied or downloaded snapshot for each table, including its YAML and editable form state. Up to eight recent tables are retained.

## Version history

### v0.9.0 — Workflow, Color ROM, and Help improvements

- Added slim-line Instructions, Help, and FAQ tabs to the Help dialog.
- Restyled Game VPS ID as a compact code line with an integrated copy button.
- Allowed the Configuration Panel to open when any asset is selected, even without a VPX selection.
- Made every safe green asset badge clickable.
- Fixed Enable for Wizard off and added a custom compatibility tooltip.
- Added `.crz`, `.pal`, and `.pac` support for single Color ROM files.
- Allowed PAL/VNI files to be dropped into either checksum field and dynamically removed duplicate extensions from the remaining field.
- Reorganized the Color ROM grid and renamed the second checksum field.
- Improved PUP Pack Required alignment.
- Added two-way URL and Version Override validation for ROM, Color ROM, and VPU Patch.
- Added Backglass URL dependency validation and required VPU Patch checksums.
- Removed unavailable entries from the preview tooltip and made the preview dot open the first error.
- Updated the footer credit and linked the Virtual Pinball Spreadsheet site.

### v0.8.0 — Interface validation and documentation

- Constrained selected table artwork to its designated thumbnail frame.
- Restyled Advanced Config as a properly inset sub-panel with balanced spacing.
- Combined Assets Panel and Configuration Panel states in the YAML Preview status indicator.
- Added a status breakdown showing each active state and quantity.
- Added field-level error-dot overlays and invalid-control highlighting.
- Rebuilt the README with complete instructions, workflow, FAQ, troubleshooting, architecture, and descending semantic version history.

### v0.7.0 — Verified database updates and status toast

- Added `lastUpdated.json` version verification.
- Added IndexedDB storage for the last verified VPS database.
- Added safe replacement, validation, source fallbacks, and mid-download version confirmation.
- Added an immediate top-entry status toast with checking, updating, current, updated, warning, and error states.
- Added two-hour checks and inactive-tab catch-up checks.

### v0.6.0 — Validation and archive support

- Added browser-side validation based on the upstream validator and table example.
- Added Color ROM Serum and PAL/VNI checksum behavior.
- Renamed VPU Patch output fields to the upstream `diff*` keys.
- Added `pupVPSId` and `pupBundled` output support.
- Standardized ID and checksum control sizing.
- Added PUP Pack archive directory browsing for ZIP, RAR, and 7Z files.
- Bundled libarchive.js and WebAssembly locally.
- Improved light-theme checkbox and status colors.

### v0.5.0 — Status system and recent builds

- Added the Green, Yellow, Orange, and Red asset-state system.
- Added fixed-size text asset badges and tab issue indicators.
- Added `enabled: false` by default.
- Added complete recent-build snapshots with Edit, Copy, Download, and Delete actions.
- Added table manufacturer, table year, and VPU Patch override fields.
- Removed deprecated override toggles and older fix controls.

### v0.4.0 — Checksum workflow and interface cleanup

- Added browser-side MD5 file drag-and-drop.
- Moved hashing into a Web Worker.
- Added checksum progress feedback.
- Renamed interface sections and improved selection metadata.
- Added Recent Build History management and confirmed history clearing.
- Removed preset controls.

### v0.3.0 — Asset filtering and patch relationships

- Excluded unsupported Future Pinball and Pinball FX table formats.
- Detected VPU Patch entries from table-file feature metadata.
- Filtered VPU Patches by their selected parent VPX.
- Cleared incompatible patches when the parent VPX changed.
- Improved thumbnail containment and field labeling.

### v0.2.0 — Tabbed configuration workspace

- Replaced top-level configuration accordions with Main, VPX, Backglass, ROM, Color ROM, PUP Pack, and VPU Patch tabs.
- Added a fixed-height compact configuration workspace.
- Opened Advanced Config sections by default.
- Reduced repeated descriptions and moved field names into placeholders.

### v0.1.0 — Compact workspace foundation

- Replaced the original linear wizard with a repeat-use workspace.
- Added table search, asset selection, live YAML preview, browser-saved drafts, recent builds, keyboard shortcuts, and light/dark themes.
- Added CDN database loading with a GitHub fallback.

## Credits and bundled software

Table and asset data is provided by the **Virtual Pinball Spreadsheet** project.

Archive browsing uses **libarchive.js** and its WebAssembly worker. The bundled upstream MIT license is included at `vendor/libarchive/LICENSE`.
