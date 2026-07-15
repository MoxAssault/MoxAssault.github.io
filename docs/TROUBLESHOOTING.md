# Troubleshooting

[Overview](../README.md) | [Usage](USAGE.md) | [Reference](REFERENCE.md) | **Troubleshooting** | [FAQ](FAQ.md) | [Changelog](../CHANGELOG.md)

## The site loads without styling or scripts

Open browser developer tools and check for `404` responses. The repository must preserve the `css.src`, `js.src`, and `vendor` folder names and paths exactly as referenced by `index.html`.

## Search reports that the database could not be verified

The builder will use the last verified IndexedDB copy when available. Check the browser console and `window.getVPSDBStatus()` for the active source and state.

## A YML file is rejected immediately

Confirm that exactly one file was selected, its name ends in `.yml`, and it is smaller than 2 MB. The `.yaml` extension is intentionally not accepted.

## A YML file cannot be parsed

The importer supports the flat VPXS YAML structure used by this builder. It rejects duplicate fields, unexpected indentation, nested objects, malformed quotes, binary content, and invalid top-level lines. Correct the file in a text editor and try again.

## A YML file reports an unavailable VPS ID

The importer validates the table and selected asset IDs against the current Virtual Pinball Spreadsheet database before clearing the active build. An old, removed, broken, or mismatched asset must be replaced with an available entry before the file can be loaded automatically.

## A checksum drop is rejected

Confirm that the dropped file extension matches the field hint. Each checksum control accepts only the file types appropriate for that asset.

In PAL/VNI mode, the second file must use the extension not already assigned to the first field.

## A PUP archive checksum works but no directories appear

The archive may not contain nested directories, may be damaged, or may use an unsupported archive feature. The checksum can still be used when MD5 calculation succeeds.

## Copy or Download does nothing

Select **Validate**. Blocking validation errors open the results dialog instead of allowing invalid YAML to be copied or downloaded.

## A previous build reappears after refreshing

The current draft is intentionally restored from browser storage. Use **Clear** or **Download & Clear** to remove the active draft.

## The Configuration Panel does not appear

Select or bundle at least one asset. A VPX selection is not required for ordinary manual entry, but imported YML files require a valid `vpxVPSId` so the complete field set can be restored reliably.

## A VPU Patch shows an error

A selected or bundled VPU Patch requires a valid MD5 checksum. The error belongs on the **VPU Patch Checksum** field. The VPU Patch ID is informational and should not receive an error dot or red border.

## The Color ROM checksums were cleared

Unchecking **PAL/VNI** intentionally clears both Color ROM checksum fields and their dropped-file metadata before returning to single-file mode.
