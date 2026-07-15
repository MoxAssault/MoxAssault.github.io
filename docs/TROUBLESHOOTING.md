# Troubleshooting

[Overview](../README.md) | [Usage](USAGE.md) | [Reference](REFERENCE.md) | **Troubleshooting** | [FAQ](FAQ.md) | [Changelog](../CHANGELOG.md)

## The site loads without styling or scripts

Open browser developer tools and check for `404` responses. The repository must preserve the `css.src`, `js.src`, and `vendor` folder names and paths exactly as referenced by `index.html`.

## Search reports that the database could not be verified

The builder will use the last verified IndexedDB copy when available. Check the browser console and `window.getVPSDBStatus()` for the active source and state.

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

Select or bundle at least one asset. A VPX selection is not required, but the builder needs an active asset before showing its related configuration tabs.

## A VPU Patch shows an error

A selected or bundled VPU Patch requires a valid MD5 checksum. The error belongs on the **VPU Patch Checksum** field. The VPU Patch ID is informational and should not receive an error dot or red border.

## The Color ROM checksums were cleared

Unchecking **PAL/VNI** intentionally clears both Color ROM checksum fields and their dropped-file metadata before returning to single-file mode.
