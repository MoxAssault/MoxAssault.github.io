# Usage Guide

[Overview](../README.md) | **Usage** | [Reference](REFERENCE.md) | [Troubleshooting](TROUBLESHOOTING.md) | [FAQ](FAQ.md) | [Changelog](../CHANGELOG.md)

## Instructions

1. Enter a VPS table ID or part of a table name in the search box, or drop an existing `.yml` file onto **Drop YML to Edit**.
2. Choose the correct table from the search results when starting a new build.
3. Select the VPX and any additional assets that apply to the build.
4. Open the enabled Configuration Panel tabs and complete the required fields.
5. Drop supported files onto checksum fields to calculate MD5 values automatically, or enter valid hashes manually.
6. Review the YAML Preview and correct any fields marked with an error dot.
7. Select **Validate** to see the complete error and warning list.
8. Select **Copy** or **Download & Clear** when the build passes validation.

## Editing an existing YML file

The compact **Drop YML to Edit** area appears between search and the header action buttons.

1. Drop exactly one file ending in `.yml`, or select the area to open the file picker.
2. When a build is already loaded, confirm that it may be replaced.
3. A loading toaster remains visible while the file is read, parsed, matched to the current VPS database, and loaded.
4. The importer verifies `tableVPSId`, `vpxVPSId`, and any other selected asset IDs before clearing the active build.
5. Supported values are loaded into their matching asset and configuration fields.
6. Continue editing, validating, copying, and downloading normally.

The importer supports the flat VPXS YAML structure produced by this builder, including scalar values, arrays, and folded or literal text blocks. Unknown fields are skipped and reported after loading. Files using unsupported nested structures, duplicate keys, unexpected indentation, or unavailable VPS IDs are rejected.

Only `.yml` files are accepted. A file must be smaller than 2 MB.

## Fast repeat-use workflow

1. Search for a table or reopen an existing YML file.
2. Select the applicable assets.
3. Complete only the enabled configuration tabs.
4. Use the YAML Preview status dot to inspect the build and jump to the first error.
5. Validate the configuration.
6. Download the YML and automatically clear the workspace for the next table.

The active build autosaves in the current browser. Recent copied and downloaded builds can be reopened from **Recent Build History**.

## Asset selection

The Assets Panel supports:

- VPX
- Backglass
- ROM
- Color ROM
- PUP Pack
- VPU Patch

Each row shows the current state and available database entries. Broken entries are disabled. Supported artwork includes compact thumbnail previews.

A green asset badge is clickable and jumps to that asset's configuration tab. The Configuration Panel appears whenever at least one asset is selected or marked as bundled; selecting a VPX first is not required to begin entering other asset details.

## Configuration panel

The Configuration Panel contains tabs for Main, VPX, Backglass, ROM, Color ROM, PUP Pack, and VPU Patch settings.

- **Main** contains the Game VPS ID, FPS, tagline, notes, testers, and table metadata overrides.
- The selected-game header includes a copy icon beside the Game VPS ID.
- **Enable for Wizard** is intentionally fixed off.
- Asset-specific tabs become available when their asset is selected or marked as bundled.
- Advanced Config sections contain optional metadata and override fields.
- URL and Version Override fields must be supplied together for ROM, Color ROM, and VPU Patch entries.
- Backglass URL Override requires Backglass Authors Override and Backglass Image Override.
- VPU Patch Checksum is required whenever the VPU Patch tab is enabled.

## Color ROM workflow

### Single-file mode

With **PAL/VNI** unchecked, the first checksum accepts:

- `.crz`
- `.pal`
- `.pac`

Unchecking **PAL/VNI** clears both Color ROM checksum fields and their dropped-file metadata.

### PAL/VNI mode

With **PAL/VNI** checked, both checksum fields initially accept `.pal` or `.vni`.

After the first file is dropped, its extension is removed from the second field so the pair cannot contain two files of the same type.

## PUP Pack workflow

Dropping a supported ZIP, RAR, or 7Z archive onto the PUP Pack Checksum field calculates its MD5 value and reads its directory structure. Discovered directories are sorted from top-level paths downward and become available in the Archive Root selector.

Files are processed by the browser and are not uploaded by this application.
