# Reference

[Overview](../README.md) | [Usage](USAGE.md) | **Reference** | [Troubleshooting](TROUBLESHOOTING.md) | [FAQ](FAQ.md) | [Changelog](../CHANGELOG.md)

## Validation and status indicators

Validation errors block Copy and Download. Warnings are allowed but should be reviewed.

The builder provides:

- Asset-row status labels.
- Asset badges in the Assets Panel heading.
- Configuration-tab error and warning markers.
- Field-level red error dots with custom tooltips.
- A combined YAML Preview status dot covering both assets and configuration tabs.

Hover or keyboard-focus the YAML Preview status dot to see active state counts. Entries reported only as unavailable are omitted. Click the dot, or press Enter or Space while it is focused, to move to the first current validation error.

The VPU Patch ID is informational and never receives field-level validation styling. VPU Patch checksum errors are displayed on the checksum field.

## YML import behavior

The YML editor accepts one `.yml` file at a time and rejects other extensions.

- Maximum imported file size: 2 MB.
- Existing table data requires confirmation before replacement.
- The current build is not cleared until the file, table ID, and imported asset IDs have passed initial checks.
- Parsing and field loading are reported through a top-entry toaster.
- The parser accepts the flat VPXS document structure, block lists, quoted or plain scalars, booleans, numbers, and folded or literal text blocks.
- Duplicate keys, unexpected indentation, binary content, unavailable table IDs, unavailable asset IDs, and unsupported nested structures are rejected.
- Only fields represented by the builder are loaded; unknown fields are skipped and reported.
- Imported PAL/VNI checksum arrays are split back into the two Color ROM checksum fields.
- Imported arrays such as testers and Backglass authors are converted into editable comma-separated field values.

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
- Double Color ROM PAL/VNI pairs using one `.pal` and one `.vni` file
- PUP Pack ZIP, RAR, and 7Z archives
- VPU Patch files

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

Imported YML file contents are used to populate the active build. The original file is not retained as a separate browser object after processing.

No sign-in is required. Clearing site data in the browser removes saved values.

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
  v091.css
  ymlImport.css
js.src/
  fields.js
  utilities.js
  apiHelper.js
  vpsDbToast.js
  searchHelper.js
  uiHelper.js
  uiEnhancements.js
  v090Enhancements.js
  v091Corrections.js
  main.js
  ymlImport.js
  nativeTooltipCleanup.js
docs/
  USAGE.md
  REFERENCE.md
  TROUBLESHOOTING.md
  FAQ.md
vendor/libarchive/
fixtures/
test-runtime.html
README.md
CHANGELOG.md
CONTRIBUTING.md
SECURITY.md
CODE_OF_CONDUCT.md
LICENSE
```

## Main integration points

- `js.src/fields.js` defines categories, configuration tabs, fields, options, YAML exclusions, and reusable values.
- `js.src/utilities.js` contains YAML generation, formatting, asset-state, checksum, and archive helpers.
- `js.src/apiHelper.js` verifies, downloads, validates, and caches VPS database data.
- `js.src/vpsDbToast.js` displays immediate and scheduled database-check status.
- `js.src/searchHelper.js` filters and ranks table search results.
- `js.src/uiHelper.js` renders table, asset, field, tab, checksum, and archive controls.
- `js.src/uiEnhancements.js` contains image containment, field error markers, Advanced Config spacing, and combined preview status behavior.
- `js.src/v090Enhancements.js` manages Help tabs, additional validation, Color ROM behavior, and refined preview status behavior.
- `js.src/v091Corrections.js` contains follow-up interface corrections and state cleanup.
- `js.src/main.js` manages application state, validation, drafts, history, keyboard shortcuts, and output actions.
- `js.src/ymlImport.js` validates, parses, and reloads supported VPXS YML files through the existing interface controls.
