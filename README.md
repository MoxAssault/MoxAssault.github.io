# VPXS YML Builder

**Overview** | [Usage](docs/USAGE.md) | [Reference](docs/REFERENCE.md) | [Troubleshooting](docs/TROUBLESHOOTING.md) | [FAQ](docs/FAQ.md) | [Changelog](CHANGELOG.md)

A browser-based workspace for creating, validating, copying, and downloading VPXS table configuration files using data from the Virtual Pinball Spreadsheet database.

The builder is designed for repeat use: search for a table, select the assets that apply, complete the enabled configuration tabs, review the generated YAML, and move directly to the next build.

## Live site

**VPXS YML Builder:** https://moxassault.github.io/

## Documentation

The project documentation is split into linked pages so it can be browsed on GitHub like a set of tabs:

- [Usage Guide](docs/USAGE.md) — instructions, repeat-use workflow, assets, configuration, Color ROM, and PUP Pack workflows.
- [Reference](docs/REFERENCE.md) — validation, database updates, YAML behavior, shortcuts, saved data, and project structure.
- [Troubleshooting](docs/TROUBLESHOOTING.md) — common problems and corrective steps.
- [FAQ](docs/FAQ.md) — frequently asked questions.
- [Changelog](CHANGELOG.md) — complete descending semantic version history.

Each documentation page includes the same navigation bar at the top for quick movement between sections.

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

## Quick start

1. Search for a table by name or VPS ID.
2. Select the assets that apply.
3. Complete the enabled Configuration Panel tabs.
4. Drop supported files onto checksum fields or enter valid MD5 values manually.
5. Correct any field-level errors shown by red status dots.
6. Validate the generated YAML.
7. Copy it or use **Download & Clear** to begin the next build.

## Current version

### v0.9.2 — Validation display and GitHub documentation

- Changed the Enable tooltip to **“This option is disabled by default.”**
- Restricted that tooltip to the checkbox and its text.
- Prevented the informational VPU Patch ID from ever displaying a red error border or error dot, including during Clear Section rerenders.
- Kept required VPU Patch checksum errors attached to the checksum field.
- Moved the larger README sections into linked GitHub documentation pages with consistent navigation.

See the [complete changelog](CHANGELOG.md) for every version.

## Credits and bundled software

Table and asset data is provided by the **Virtual Pinball Spreadsheet** project.

Archive browsing uses **libarchive.js** and its WebAssembly worker. The bundled upstream MIT license is included at `vendor/libarchive/LICENSE`.
