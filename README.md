# VPXS YML Builder — Compact Workspace Front End

A modular front end based on the supplied “cabinet, not dashboard” visual prototype, redesigned for users who may create many VPS YML files in repeated sessions.

The previous step-by-step wizard has been replaced with a compact workspace that keeps the selected table, assets, configuration sections, validation state, and main actions visible without forcing the user through a long linear flow.


## Round 2 interface updates

- Table cover artwork now opens a larger hover/focus preview.
- The asset summary badges now sit in the Assets Available header, while Clear sits in the selected-table strip.
- Empty asset selectors display **No Files Available**.
- Required assets use bold uppercase red status styling in both themes.
- Info buttons are non-interactive until a file is selected.
- Selected VPX and B2S files can display compact thumbnails with hover/focus previews when their database entries include image URLs.
- The YAML preview line count is bold for quicker scanning.

## Main workflow

1. Search by VPS table ID or table name.
2. Select the VPX file and any optional B2S, ROM, Color ROM, PUP Pack, or VPU Patch entries.
3. Edit enabled configuration sections using compact tabs. Advanced Config accordions start open.
4. Validate, copy, or download the generated YAML from the live preview panel.
5. Use **Download & Clear** to save the file and clear the workspace.

## Repeat-use features

- Compact selected-table status strip
- Asset matrix instead of large asset cards
- Expandable asset metadata
- Tab-based configuration sections
- Compact Advanced Config sections open by default
- Sticky live YAML preview panel
- Preview actions for Validate, Copy, and Download & Clear
- Local autosave and draft recovery
- Reusable values carried into the next build during the current session
- Recent copied/downloaded build snapshots with Edit, Copy, Download, and Delete actions
- Keyboard shortcuts
- Dark and light themes with saved preference

## Keyboard shortcuts

- `/` focuses the table search
- `Ctrl + Enter` validates the current build
- `Ctrl + Shift + Enter` downloads and clears the current build
- `Escape` closes an open dialog

## Data and YAML behavior

The implementation retains the existing VPS database and YAML behavior:

- VPS database CDN with GitHub fallback
- Search by exact or partial table ID and name
- Broken database entries are disabled
- Keys are sorted alphabetically
- Empty strings and empty arrays are omitted; `enabled: false` is always emitted by default
- FPS and `tableYearOverride` are emitted as integers
- Testers and B2S author overrides become YAML arrays
- Long URL fields receive the yamllint line-length comment
- Long or multiline strings use folded YAML blocks
- `pupVPSId` and `pupBundled` are emitted when present

## Local storage

The browser stores the following locally:

- Theme preference
- Active configuration tab
- Current draft
- Complete recent build snapshots, newest-only per table

No server-side account or database is required for these features.

## Run locally

The project has no build step. Serve the folder through a local web server:

```bash
cd vps-yml-builder-frontend
python -m http.server 8080
```

Then open `http://localhost:8080`.

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
js.src/
  fields.js
  utilities.js
  apiHelper.js
  searchHelper.js
  uiHelper.js
  main.js
vendor/libarchive/
  libarchive.js
  worker-bundle.js
  libarchive.wasm
  LICENSE
```

## Main integration points

- `js.src/fields.js` defines categories, sections, fields, advanced fields, preset-safe values, and YAML exclusions.
- `js.src/apiHelper.js` loads and caches the VPS database.
- `js.src/searchHelper.js` scores and filters search suggestions.
- `js.src/utilities.js` builds, highlights, copies, and downloads YAML.
- `js.src/uiHelper.js` renders the compact table strip, asset matrix, fields, and configuration tabs.
- `js.src/main.js` manages application state, validation, autosave, presets, recent builds, shortcuts, and repeat-use flow.

## Validation currently included

The browser-side validator mirrors the current repository checks used by the GitHub workflow:

- VPX ID, VPX checksum, FPS, and Testers are required.
- Checksum fields must contain valid MD5 values; a single hash is a string and multiple hashes are emitted as a YAML list.
- Selected or bundled Backglass, ROM, and Color ROM assets require the corresponding checksum; bundled versions also require notes.
- Selected or linked PUP Packs require a checksum.
- ROM URL Override conflicts with ROM VPS ID and requires ROM Version Override.
- Broken or unavailable selected VPS entries block Copy and Download.
- Selected-plus-bundled conflicts remain cautions and do not block output.
- Generated YAML is checked against the repository’s 120-character line-length rule.

## Testing performed

- JavaScript syntax validation for every source file
- YAML utility tests for filtering, arrays, integer conversion, fixes, exclusions, and safe filenames
- Headless Chromium interaction test using a mock VPS database
- Desktop viewport verification
- Mobile width and overflow verification

## Round 3 updates

- Keeps selected VPX/B2S thumbnails clipped inside a fixed 34×34 frame while retaining the hover/focus pop-out preview.
- Moves editable text and textarea field names into placeholders while preserving accessible labels.
- Excludes VPX entries whose `tableFormat` is `FP`, `FX`, `FX2`, or `FX3`.
- Treats `tableFiles` entries containing `VPU Patch` in `features`/`Features` as patch entries instead of VPX choices.
- Filters parent-linked VPU patches so they appear only when their `parentId`, `parentID`, or `parentid` matches the selected VPX file.
- Clears a selected VPU patch automatically when the user changes to a different VPX parent.
- Includes expanded runtime fixtures covering excluded formats and parent-linked VPU patches.



## Configuration Tabs Update

- Replaced the top-level configuration accordions with a compact tab bar: Main, VPX, Backglass, ROM, Color ROM, PUP Pack, and VPU Patch.
- The Main tab opens first and all tab panels use a consistent fixed minimum height.
- Text and textarea field names remain inside placeholders; tab description lines have been removed.
- Main Notes and Testers use compact three-row textareas.
- Advanced Config remains a slim, left-aligned nested accordion and opens by default whenever a tab is rendered.
- The sticky YAML preview and the rest of the workspace are unchanged.


## Round 4 Update

- Renamed Local History to Recent Build History, added confirmed Clear History, and added immediate per-item deletion.
- Renamed Assets Available to Assets Panel.
- Asset options now display ID, version, and created date in DD.MM.YYYY format.
- Added browser-side MD5 drag-and-drop checksum calculation with category-specific file validation.
- Renamed Configuration to Configuration Panel and removed all preset controls.
- Replaced orange configuration borders with standard panel borders and a green selected-tab indicator.
- Main Enable for Wizard is unboxed; Tagline is a text field on desktop; Testers remains a textarea.
- Asset Info behavior is unchanged for this round.

### Round 4 follow-up

- MD5 hashing now runs in a Web Worker so the rest of the form remains responsive during checksum calculation.
- Checksum fields show a small sliding loading dot while hashing is in progress.
- Asset selector dates now use `DD.MM.YYYY`.


## Round 5 Update

- Emits `enabled: false` in the YAML preview and generated file by default.
- Adds fixed-width asset badges and a shared Green / Yellow / Orange / Red state system for badges, row status, and the YAML preview dot.
- Green asset badges display a “Jump to {tab}” prompt and focus the corresponding configuration tab when clicked.
- Configuration tabs display error or warning indicators for issues in their section.
- Adds `diffBundled` behavior to the VPU Patch asset row.
- Removes tab description paragraphs, all “Enable override” controls, and deprecated BASS/applyFix UI.
- Opens every Advanced Config accordion by default and reduces its summary height to 24px.
- Adds `tableManufacturerOverride`, integer `tableYearOverride`, `diffUrlOverride`, and `diffVersionOverride` fields.
- Corrects the PUP Pack field order and keeps PUP Pack Required unboxed beside Archive Root.
- Copy and Download & Clear both save a complete recent-build snapshot. Only the newest snapshot per table is kept, with Edit, Copy, Download, and Delete actions.


## Round 6 Update

- Reworks light-theme checkbox styling so controls match the rest of the theme.
- Adds dedicated high-contrast light-theme colors for Green, Yellow, Orange, and Red badges and status dots.
- Changes asset badges to centered text-only pills at a fixed 80×25px size.
- Displays the YAML preview line count in uppercase.
- Adds a browser-side verification system based on the repository’s current validator and `table.yml.example` rules. Errors block Copy and Download; cautions remain allowed.
- Adds `coloredROMPin2DMD: true` support. PAL/VNI mode enables a second checksum and emits `coloredROMChecksum` as a two-item list; unchecked Serum mode emits one checksum and omits the flag.
- Renames all VPU Patch YAML fields to the upstream `diff*` keys.
- Includes `pupVPSId` and `pupBundled` in generated YAML.
- Makes ID and checksum controls equal width across configuration tabs.
- Removes the visible PUP Pack Archive Format label while keeping an accessible label and placeholder option.
- Renames every PUP control with the “PUP Pack” prefix.
- Dropping a ZIP, RAR, or 7Z PUP archive onto PUP Pack Checksum now calculates MD5 and loads nested archive directories for the PUP Pack Archive Root picker. Directories are ordered from top-level paths down.
- Bundles `libarchive.js` and its WebAssembly worker locally under `vendor/libarchive/`; no CDN is required for archive browsing. The upstream MIT license is included.
