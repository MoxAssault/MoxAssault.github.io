# VPXS YML Builder

A browser-based workspace for creating, validating, copying, and downloading VPXS table configuration files from the Virtual Pinball Spreadsheet database.

The builder is designed for repeated use: search for a table, select its assets, fill only the configuration fields that apply, review the generated YAML, and move directly to the next build.

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
- Validates required values, checksums, bundled-asset requirements, override conflicts, and line length.
- Calculates MD5 checksums from files dropped onto supported checksum fields.
- Reads ZIP, RAR, and 7Z PUP Pack archives and offers discovered directories as Archive Root choices.
- Saves unfinished work and recent completed builds in the browser.
- Works as a static GitHub Pages application with no server-side account or application database.

## Instructions

1. Enter a VPS table ID or part of a table name in the search box.
2. Choose the correct table from the search suggestions or submit the search.
3. Select a VPX file. The Configuration Panel becomes available after a VPX is selected.
4. Select any additional assets that belong with the table.
5. Open each enabled configuration tab and enter the required information.
6. Review the YAML Generated Preview and its combined status indicator.
7. Select **Validate** to review errors and cautions.
8. Select **Copy** to place valid YAML on the clipboard, or select **Download & Clear** to save the file and begin another build.

Copy and Download are blocked while validation errors remain. Cautions do not block output.

## Fast repeat-use workflow

The workspace is built to minimize repeated navigation and data entry:

1. Search and select a table.
2. Choose the VPX and related assets from the Assets Panel.
3. Complete only the enabled configuration tabs.
4. Drop local files onto checksum fields when an MD5 value is needed.
5. Validate the build.
6. Copy the YAML or use **Download & Clear**.
7. Start typing the next table immediately.

Recent Build History keeps the newest completed snapshot for each table. A snapshot can be restored, copied, downloaded again, or deleted.

## Asset selection

The Assets Panel supports these categories:

- **VPX**
- **Backglass**
- **ROM**
- **Color ROM**
- **PUP Pack**
- **VPU Patch**

Each row reports its current state and provides available database entries. Broken entries are disabled. Selected VPX and Backglass entries may include artwork previews.

Bundled controls indicate that an asset is included with another download instead of being supplied through a separate VPS entry. Bundled assets may require checksums and explanatory notes depending on the asset type.

## Configuration panel

Configuration is divided into compact tabs:

- **Main** — table ID, FPS, tagline, notes, testers, and table-level overrides.
- **VPX** — VPX ID, checksum, and notes.
- **Backglass** — Backglass ID, checksum, notes, and supported overrides.
- **ROM** — ROM ID, checksum, notes, URL override, and version override.
- **Color ROM** — Color ROM ID, checksum, notes, override fields, and PAL/VNI mode.
- **PUP Pack** — ID, checksum, URL, version, archive format, archive root, notes, and required status.
- **VPU Patch** — `diff*` fields used by the upstream VPXS schema.

Advanced Config is shown as an inset sub-panel within each applicable tab.

### Color ROM modes

- **Serum mode:** one Color ROM checksum is emitted and `coloredROMPin2DMD` is omitted.
- **PAL/VNI mode:** `coloredROMPin2DMD: true` is emitted and both `.pal` and `.vni` MD5 checksums are required.

## Validation and status indicators

Validation is based on the current VPXS repository checks and table example conventions.

The interface reports status in several places:

- Asset rows and asset badges show availability and selection state.
- Configuration tabs show error or warning markers.
- Individual fields with a current validation error receive a red status-dot overlay.
- The YAML Preview status dot combines both the Assets Panel and Configuration Panel.
- Hovering or focusing the YAML Preview dot shows each active status type and its quantity when the count is greater than zero.

Common blocking errors include:

- Missing VPX selection.
- Missing or invalid VPX checksum.
- Missing FPS or non-integer FPS.
- Missing testers.
- Missing checksums for selected or bundled assets.
- Invalid MD5 values.
- Missing notes for bundled Backglass, ROM, or Color ROM assets.
- ROM VPS ID and ROM URL Override conflicts.
- Missing ROM Version Override when a ROM URL Override is used.
- Missing PAL or VNI checksum in PAL/VNI mode.
- Required PUP Pack without a VPS entry or file URL.
- Generated YAML lines exceeding the supported yamllint limit.

## VPS database updates

The application verifies the database version with:

`https://virtualpinballspreadsheet.github.io/vps-db/lastUpdated.json`

On page load, a top-center status toast immediately reports that the database is being checked. The toast then reports whether the database is current, was updated, or is using a cached fallback.

Database behavior:

- The latest published version is checked when the site opens.
- The version is checked again every two hours while the page remains open.
- Returning to a tab that has been inactive for at least two hours triggers a catch-up check.
- The full database is downloaded only when the published version changes.
- Downloaded data is validated before replacing the working cache.
- The last verified database is stored in IndexedDB and remains available if an update source is temporarily unavailable.
- A version is confirmed again after download to avoid labeling data with the wrong update timestamp.

For browser diagnostics, the current status is available through:

```js
window.getVPSDBStatus()
```

A manual check can be triggered from the browser console with:

```js
window.checkVPSDBNow()
```

## Checksum and archive tools

Supported checksum fields accept file drag-and-drop and calculate MD5 in the browser. Hashing runs in a Web Worker when available so the interface remains responsive.

Accepted file types depend on the field, including:

- VPX files
- DirectB2S files
- ROM archives
- Color ROM files
- PUP Pack ZIP, RAR, and 7Z archives
- VPU Patch files

When a supported PUP Pack archive is dropped onto the PUP Pack Checksum field, the builder also reads its directory structure. Discovered directories are sorted from top-level paths downward and offered in the PUP Pack Archive Root selector.

Files are processed locally by the browser and are not uploaded by this application.

## YAML behavior

- YAML keys are emitted in alphabetical order.
- Empty strings and empty arrays are omitted.
- `enabled: false` is emitted by default.
- FPS and `tableYearOverride` are emitted as integers.
- Testers and Backglass author overrides are emitted as YAML arrays.
- A single checksum is emitted as a string.
- Multiple checksums are emitted as a YAML list.
- URL fields that exceed the line-length limit receive the supported yamllint comment.
- Long non-URL text values use folded YAML blocks.
- Unsupported UI-only values are excluded from output.
- VPU Patch values use the upstream `diffVPSId`, `diffChecksum`, `diffUrlOverride`, and `diffVersionOverride` keys.
- PUP Pack output supports `pupVPSId`, `pupBundled`, `pupChecksum`, `pupFileUrl`, `pupVersion`, `pupArchiveFormat`, `pupArchiveRoot`, `pupRequired`, and `pupNotes` when applicable.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `/` | Focus and select the table search field |
| `Ctrl`/`Cmd` + `Enter` | Validate the current build |
| `Ctrl`/`Cmd` + `Shift` + `Enter` | Download the YAML and clear the workspace |
| `Escape` | Close an open dialog |

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
js.src/
  fields.js
  utilities.js
  apiHelper.js
  vpsDbToast.js
  searchHelper.js
  uiHelper.js
  uiEnhancements.js
  main.js
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

## Troubleshooting

### The site loads without styling or scripts

Open browser developer tools and check for `404` responses. The repository must preserve the `css.src`, `js.src`, and `vendor` folder names and paths exactly as referenced by `index.html`.

### Search reports that the database could not be verified

The builder will use the last verified IndexedDB copy when available. Check the browser console and `window.getVPSDBStatus()` for the active source and state.

### A checksum drop is rejected

Confirm that the dropped file extension matches the field hint. Each checksum control accepts only the file types appropriate for that asset.

### A PUP archive checksum works but no directories appear

The archive may not contain nested directories, may be damaged, or may use an unsupported archive feature. The checksum can still be used when MD5 calculation succeeds.

### Copy or Download does nothing

Select **Validate**. Blocking validation errors open the results dialog instead of allowing invalid YAML to be copied or downloaded.

### A previous build reappears after refreshing

The current draft is intentionally restored from browser storage. Use **Clear** or **Download & Clear** to remove the active draft.

## FAQ

### Does the site upload my VPX, ROM, Backglass, or PUP files?

No. Files dropped onto checksum fields are processed locally in the browser.

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

It combines the current Assets Panel states with enabled Configuration Panel states. Hover or keyboard-focus the dot to see the count for every active status type.

### What is stored in Recent Build History?

The newest copied or downloaded snapshot for each table, including its YAML and editable form state. Up to eight recent tables are retained.

## Version history

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
- Added table search, asset selection, live YAML preview, local drafts, recent builds, keyboard shortcuts, and light/dark themes.
- Added CDN database loading with a GitHub fallback.

## Credits and bundled software

Table and asset data is provided by the **Virtual Pinball Spreadsheet** project.

Archive browsing uses **libarchive.js** and its WebAssembly worker. The bundled upstream MIT license is included at `vendor/libarchive/LICENSE`.
