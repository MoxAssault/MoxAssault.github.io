# Changelog

What changed in the LU YML Builder, newest first. From 1.0.0 on, a version number means it passed a live test before it went out. The format follows [Keep a Changelog](https://keepachangelog.com), and the numbers follow [semantic versioning](https://semver.org).

## [Unreleased]

### Added
- A YML with bad VPS IDs can now be opened. An alert lists each bad ID and why, and offers to load the file without them. Each section keeps its other fields, and picking the right ID leaves them in place.

### Changed
- The light theme orange is darker, so buttons and orange text are easier to read.
- A small label on the Short Table Name box shows it is only used for manifest testing and the Wizard README, not the YML.
- More space under the shortcuts in Help.

## [1.2.1] - 2026-11-05

Everything listed under 1.2.0, which reached the live site with this release. A test failed on the build server, so 1.2.0 itself was never published. Nothing changes for users between the two.

## [1.2.0] - 2026-11-05

### Added
- A Test Folder button in the header builds a table's manifest and config zip in your browser with the Legends Unchained release scripts, ready for the Manifest Tester. Nothing is uploaded.
- A Test This YML button in the preview panel does the same for the build on screen, using it in place of any `table.yml` in the folder you pick.
- A Short Table Name box above the README buttons, for the table's folder name in the Legends Unchained repo. Type `4aces` and it becomes `vpx-4aces` when you leave the box. It is saved with your build but never written to the YML. Spaces and special characters become `-`.

### Changed
- The whole top bar now takes a dropped YML, and a small Import YML button after Search opens the file chooser. They replace the Drop YML to Edit box.
- The status line moved above the search bar, so it no longer covers Search, and it fades away after 30 seconds.
- Wizard README now downloads as `README.md` holding the single line the Table Manager Wizard uses, with a link to the table's catalog page. It needs the Short Table Name, and no longer downloads a preview image.

### Removed
- The Manual README button. Test This YML takes its place.

## [1.1.0] - 2026-11-04

### Added
- The Backglass Checksum accepts `.b2spro` files as well as `.directb2s`, loose or inside an archive. An archive holding both types asks which one to use.

## [1.0.0] - 2026-11-02

The first live-tested release. It covers the work since 0.11.0, all of it tested live, piece by piece, before it shipped.

### Added
- The VPX tab's Advanced Config has three windows: Passwords, Post-install Renames and Extract Extra Paths. Renames and Extract can fill themselves from the folders and files of any archive you dropped, with a search box for long file lists.
- An Override row can borrow an asset from another table: type its VPS ID in the Manual VPSID box and the builder checks it is the right kind of asset. Imports keep borrowed IDs, and the Additional ROM editor accepts one too.
- URL Overrides are looked up in the VPS database. A link VPS already knows offers its VPS ID instead, and a link that belongs to a different kind of asset is stopped before it can break a table.
- An Alt Sound tab, with its own checksum and archive handling.
- A DMD tab for FlexDMD and UltraDMD packs, standalone or bundled inside the table's archive.
- Password-protected ZIP and RAR archives open with the passwords from the VPX tab, and the VPX tab holds as many passwords as you need.
- Archives over 2 GB can be browsed and checksummed.
- Stern tables accept a bare ROM `.bin` file, and a dropped archive is searched for the one `.bin` inside it.
- Every checksum field can hold additional checksums, and Additional ROMs have their own editor.
- A guided walkthrough and an updated Help window.
- A WRAP switch for long lines in the YAML preview.
- Per-asset NSFW flags, with the table-wide flag taking over when it is on.
- Every Clear in a pop-up asks for a second click.

### Changed
- One set of validation rules now drives every error dot, the tab colours and the preview counts, so they always agree. Hovering a dot explains the problem with a bold headline.
- Checksums are always uppercase.
- Asset names link to wherever the file is hosted.
- Legends Unchained branding replaces the old bolt logo.

### Fixed
- An asset with one broken link is no longer treated as broken while a working mirror exists.
- Long lines are folded or marked correctly, so the builder no longer refuses its own download.

## [0.11.0] - 2026-07-15
### Added
- Manual README and Wizard README buttons that write a README for the table.

## [0.10.3] - 2026-07-15
### Changed
- Positioned every application dialog at the same upper-page starting point.
- Moved dialogs closer to the top of the viewport while retaining responsive safe-area handling.
- Replaced the Help modal title **Fast repeat-use workflow** with **Help**.
- Preserved the Help modal's existing overall footprint and tab-panel sizing.
- Updated the consolidated README with all missing changes through v0.10.3.

## [0.10.2] - 2026-07-15
### Changed
- Excluded unused optional assets marked only as **Available** from Preview caution counts.
- Kept selected, bundled, conflicting, required, and configuration states in the Preview breakdown.
### Fixed
- Prevented completed YML imports from forcing the page to scroll to the Configuration Panel.

## [0.10.1] - 2026-07-15
### Changed
- Aligned the search area with the right edge of the main game-card/workspace column.
- Aligned the Drop YML and header-action area with the YAML Preview column.
- Restored the README to a single consolidated document and removed the split documentation pages.

## [0.10.0] - 2026-07-15
### Added
- Added the compact **Drop YML to Edit** control between search and the header actions.
- Added confirmation before replacing an open build.
- Added loading, success, and error toaster states for YML imports.
- Added safe parsing for flat VPXS YAML values, arrays, and multiline text.
- Added current-database validation for imported table and asset VPS IDs.
- Added `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, and a scoped third-party `LICENSE` notice.
### Changed
- Restricted imports to one `.yml` file at a time and added a 2 MB size limit.

Versions 0.1.0 to 0.9.2 were built before this repository existed (its first commit is 2026-07-14), and their dates were not recorded.

## [0.9.2]
### Changed
- Changed the Enable tooltip to **This option is disabled by default.**
- Restricted the tooltip trigger to the checkbox and its text.
- Kept required VPU Patch checksum errors attached to the checksum field.
### Fixed
- Prevented the informational VPU Patch ID from displaying a red border or field-level error dot, including during Clear Section rerenders.

## [0.9.1]
### Changed
- Moved the Game VPS ID copy icon to the selected-game header card without changing the existing ID text color.
- Changed the second Color ROM placeholder to `Color ROM Checksum #2   (ROM name)`.
- Raised Configuration Panel tooltips above neighboring fields and panel edges.
- Made unchecking PAL/VNI clear both Color ROM checksum fields and dropped-file metadata.

## [0.9.0]
### Added
- Added slim-line Instructions, Help, and FAQ tabs to the Help dialog.
- Added a compact copy control for the selected table's Game VPS ID.
- Added `.crz`, `.pal`, and `.pac` support for single Color ROM files.
- Added two-way URL and Version Override validation for ROM, Color ROM, and VPU Patch.
- Added Backglass URL dependency validation and required VPU Patch checksums.
### Changed
- Allowed the Configuration Panel to open when any asset is selected, even without a VPX selection.
- Made every safe green asset badge clickable.
- Allowed PAL/VNI files to be dropped into either checksum field and dynamically removed duplicate extensions from the remaining field.
- Reorganized the Color ROM grid and renamed the second checksum field.
- Improved PUP Pack Required alignment.
- Updated the footer credit and linked the Virtual Pinball Spreadsheet site.
### Fixed
- Fixed Enable for Wizard off and added a custom tooltip.
### Removed
- Removed unavailable entries from the preview tooltip and made the preview dot open the first error.

## [0.8.0]
### Added
- Added a status breakdown showing each active state and quantity.
- Added field-level error-dot overlays and invalid-control highlighting.
### Changed
- Constrained selected table artwork to its designated thumbnail frame.
- Restyled Advanced Config as a properly inset sub-panel with balanced spacing.
- Combined Assets Panel and Configuration Panel states in the YAML Preview status indicator.
- Rebuilt the README with complete instructions, workflow, FAQ, troubleshooting, architecture, and descending semantic version history.

## [0.7.0]
### Added
- Added `lastUpdated.json` version verification.
- Added IndexedDB storage for the last verified VPS database.
- Added safe replacement, validation, source fallbacks, and mid-download version confirmation.
- Added an immediate top-entry status toast with checking, updating, current, updated, warning, and error states.
- Added two-hour checks and inactive-tab catch-up checks.

## [0.6.0]
### Added
- Added browser-side validation based on the upstream validator and table example.
- Added Color ROM Serum and PAL/VNI checksum behavior.
- Added `pupVPSId` and `pupBundled` output support.
- Added PUP Pack archive directory browsing for ZIP, RAR, and 7Z files.
- Bundled libarchive.js and WebAssembly locally.
### Changed
- Renamed VPU Patch output fields to the upstream `diff*` keys.
- Standardized ID and checksum control sizing.
- Improved light-theme checkbox and status colors.

## [0.5.0]
### Added
- Added the Green, Yellow, Orange, and Red asset-state system.
- Added fixed-size text asset badges and tab issue indicators.
- Added `enabled: false` by default.
- Added complete recent-build snapshots with Edit, Copy, Download, and Delete actions.
- Added table manufacturer, table year, and VPU Patch override fields.
### Removed
- Removed deprecated override toggles and older fix controls.

## [0.4.0]
### Added
- Added browser-side MD5 file drag-and-drop.
- Added checksum progress feedback.
- Added Recent Build History management and confirmed history clearing.
### Changed
- Moved hashing into a Web Worker.
- Renamed interface sections and improved selection metadata.
### Removed
- Removed preset controls.

## [0.3.0]
### Changed
- Excluded unsupported Future Pinball and Pinball FX table formats.
- Detected VPU Patch entries from table-file feature metadata.
- Filtered VPU Patches by their selected parent VPX.
- Cleared incompatible patches when the parent VPX changed.
- Improved thumbnail containment and field labeling.

## [0.2.0]
### Added
- Added a fixed-height compact configuration workspace.
### Changed
- Replaced top-level configuration accordions with Main, VPX, Backglass, ROM, Color ROM, PUP Pack, and VPU Patch tabs.
- Opened Advanced Config sections by default.
- Reduced repeated descriptions and moved field names into placeholders.

## [0.1.0]
### Added
- Added table search, asset selection, live YAML preview, browser-saved drafts, recent builds, keyboard shortcuts, and light/dark themes.
- Added CDN database loading with a GitHub fallback.
### Changed
- Replaced the original linear wizard with a repeat-use workspace.
