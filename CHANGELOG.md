# Changelog

[Overview](README.md) | [Usage](docs/USAGE.md) | [Reference](docs/REFERENCE.md) | [Troubleshooting](docs/TROUBLESHOOTING.md) | [FAQ](docs/FAQ.md) | **Changelog**

Newest versions are listed first.

## v0.10.0 — YML editing and repository policy files

- Added a compact **Drop YML to Edit** area between search and the header action buttons.
- Restricted the editor to one `.yml` file at a time with a 2 MB maximum size.
- Added confirmation before replacing a currently loaded table build.
- Added a loading toaster while an imported file is read, parsed, matched to the current VPS database, and loaded into the interface.
- Added safe parsing for flat VPXS YAML documents, including quoted and plain scalars, block lists, booleans, numbers, and folded or literal text blocks.
- Added rejection for duplicate keys, unexpected indentation, unsupported nested structures, binary content, unavailable table IDs, and unavailable asset IDs.
- Added imported PAL/VNI list restoration into the two Color ROM checksum fields.
- Added import guidance to Help, Usage, Reference, Troubleshooting, and FAQ documentation.
- Added `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, and a scoped third-party `LICENSE` notice.
- Moved attribution and bundled-software information out of the README and into the appropriate repository files.

## v0.9.2 — Validation display and GitHub documentation

- Changed the Enable tooltip to **“This option is disabled by default.”**
- Restricted the Enable tooltip trigger to the checkbox and its text instead of the full field width.
- Prevented the informational VPU Patch ID from displaying a red border or field-level error dot, including during Clear Section rerenders.
- Kept required VPU Patch checksum errors attached to the checksum field.
- Split the larger README sections into linked GitHub documentation pages for Usage, Reference, Troubleshooting, and FAQ.
- Added a consistent documentation navigation bar that behaves like file tabs when browsing on GitHub.

## v0.9.1 — Follow-up interface corrections

- Moved the Game VPS ID copy icon to the selected-game header card without changing the existing ID text color.
- Changed the second Color ROM placeholder to `Color ROM Checksum #2   (ROM name)`.
- Raised Configuration Panel tooltips above neighboring fields and panel edges.
- Made unchecking PAL/VNI clear both Color ROM checksum fields and dropped-file metadata.
- Removed an incorrect VPU Patch ID error marker after section clearing.
- Simplified the Enable tooltip wording.

## v0.9.0 — Workflow, Color ROM, and Help improvements

- Added slim-line Instructions, Help, and FAQ tabs to the Help dialog.
- Added a compact copy control for the selected table's Game VPS ID.
- Allowed the Configuration Panel to open when any asset is selected, even without a VPX selection.
- Made every safe green asset badge clickable.
- Fixed Enable for Wizard off and added a custom tooltip.
- Added `.crz`, `.pal`, and `.pac` support for single Color ROM files.
- Allowed PAL/VNI files to be dropped into either checksum field and dynamically removed duplicate extensions from the remaining field.
- Reorganized the Color ROM grid and renamed the second checksum field.
- Improved PUP Pack Required alignment.
- Added two-way URL and Version Override validation for ROM, Color ROM, and VPU Patch.
- Added Backglass URL dependency validation and required VPU Patch checksums.
- Removed unavailable entries from the preview tooltip and made the preview dot open the first error.
- Updated the footer credit and linked the Virtual Pinball Spreadsheet site.

## v0.8.0 — Interface validation and documentation

- Constrained selected table artwork to its designated thumbnail frame.
- Restyled Advanced Config as a properly inset sub-panel with balanced spacing.
- Combined Assets Panel and Configuration Panel states in the YAML Preview status indicator.
- Added a status breakdown showing each active state and quantity.
- Added field-level error-dot overlays and invalid-control highlighting.
- Rebuilt the README with complete instructions, workflow, FAQ, troubleshooting, architecture, and descending semantic version history.

## v0.7.0 — Verified database updates and status toast

- Added `lastUpdated.json` version verification.
- Added IndexedDB storage for the last verified VPS database.
- Added safe replacement, validation, source fallbacks, and mid-download version confirmation.
- Added an immediate top-entry status toast with checking, updating, current, updated, warning, and error states.
- Added two-hour checks and inactive-tab catch-up checks.

## v0.6.0 — Validation and archive support

- Added browser-side validation based on the upstream validator and table example.
- Added Color ROM Serum and PAL/VNI checksum behavior.
- Renamed VPU Patch output fields to the upstream `diff*` keys.
- Added `pupVPSId` and `pupBundled` output support.
- Standardized ID and checksum control sizing.
- Added PUP Pack archive directory browsing for ZIP, RAR, and 7Z files.
- Bundled libarchive.js and WebAssembly locally.
- Improved light-theme checkbox and status colors.

## v0.5.0 — Status system and recent builds

- Added the Green, Yellow, Orange, and Red asset-state system.
- Added fixed-size text asset badges and tab issue indicators.
- Added `enabled: false` by default.
- Added complete recent-build snapshots with Edit, Copy, Download, and Delete actions.
- Added table manufacturer, table year, and VPU Patch override fields.
- Removed deprecated override toggles and older fix controls.

## v0.4.0 — Checksum workflow and interface cleanup

- Added browser-side MD5 file drag-and-drop.
- Moved hashing into a Web Worker.
- Added checksum progress feedback.
- Renamed interface sections and improved selection metadata.
- Added Recent Build History management and confirmed history clearing.
- Removed preset controls.

## v0.3.0 — Asset filtering and patch relationships

- Excluded unsupported Future Pinball and Pinball FX table formats.
- Detected VPU Patch entries from table-file feature metadata.
- Filtered VPU Patches by their selected parent VPX.
- Cleared incompatible patches when the parent VPX changed.
- Improved thumbnail containment and field labeling.

## v0.2.0 — Tabbed configuration workspace

- Replaced top-level configuration accordions with Main, VPX, Backglass, ROM, Color ROM, PUP Pack, and VPU Patch tabs.
- Added a fixed-height compact configuration workspace.
- Opened Advanced Config sections by default.
- Reduced repeated descriptions and moved field names into placeholders.

## v0.1.0 — Compact workspace foundation

- Replaced the original linear wizard with a repeat-use workspace.
- Added table search, asset selection, live YAML preview, browser-saved drafts, recent builds, keyboard shortcuts, and light/dark themes.
- Added CDN database loading with a GitHub fallback.
