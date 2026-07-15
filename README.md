# VPXS YML Builder

**Overview** | [Usage](docs/USAGE.md) | [Reference](docs/REFERENCE.md) | [Troubleshooting](docs/TROUBLESHOOTING.md) | [FAQ](docs/FAQ.md) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [Security](SECURITY.md) | [Conduct](CODE_OF_CONDUCT.md) | [License](LICENSE)

A browser-based workspace for creating, validating, editing, copying, and downloading VPXS table configuration files using data from the Virtual Pinball Spreadsheet database.

The builder is designed for repeat use: search for a table or reopen an existing `.yml` file, select the assets that apply, complete the enabled configuration tabs, review the generated YAML, and move directly to the next build.

## Live site

**VPXS YML Builder:** https://moxassault.github.io/

## Documentation

The larger documentation sections are split into linked pages so they can be browsed on GitHub like a set of tabs:

- [Usage Guide](docs/USAGE.md) — instructions, repeat-use workflow, YML editing, assets, configuration, Color ROM, and PUP Pack workflows.
- [Reference](docs/REFERENCE.md) — validation, database updates, YAML behavior, shortcuts, saved data, security boundaries, and project structure.
- [Troubleshooting](docs/TROUBLESHOOTING.md) — common problems and corrective steps.
- [FAQ](docs/FAQ.md) — frequently asked questions.
- [Changelog](CHANGELOG.md) — complete descending semantic version history.

Project policies and attribution are maintained separately:

- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Third-Party License Notice](LICENSE)

## What the builder does

- Searches the Virtual Pinball Spreadsheet database by table name or VPS ID.
- Opens supported `.yml` files and loads their values back into the editor.
- Confirms before replacing a currently loaded build.
- Filters unsupported table formats and unavailable or broken database entries.
- Supports VPX, Backglass, ROM, Color ROM, PUP Pack, and VPU Patch assets.
- Generates a live YAML preview while configuration values are entered.
- Validates required values, checksums, bundled-asset requirements, override relationships, and line length.
- Calculates MD5 checksums from files dropped onto supported checksum fields.
- Reads ZIP, RAR, and 7Z PUP Pack archives and offers discovered directories as Archive Root choices.
- Saves unfinished work and recent completed builds in the browser.
- Verifies that search is using the latest published VPS database version.

## Quick start

1. Search for a table by name or VPS ID, or drop an existing `.yml` file into **Drop YML to Edit**.
2. Select the assets that apply.
3. Complete the enabled Configuration Panel tabs.
4. Drop supported files onto checksum fields or enter valid MD5 values manually.
5. Correct any field-level errors shown by red status dots.
6. Validate the generated YAML.
7. Copy it or use **Download & Clear** to begin the next build.

## Current version

### v0.10.0 — YML editing and repository policy files

- Added the compact **Drop YML to Edit** control between search and the header actions.
- Restricted imports to one `.yml` file at a time.
- Added confirmation before replacing a loaded build.
- Added a loading toaster while files are read, parsed, matched to the VPS database, and loaded into the editor.
- Added safe parsing for the flat VPXS YAML structure, including lists and folded text blocks.
- Added current-database checks for imported table and asset VPS IDs before clearing the active build.
- Added `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, and a scoped third-party `LICENSE` notice.
- Moved attribution and bundled-software information out of the README.

See the [complete changelog](CHANGELOG.md) for every version.
