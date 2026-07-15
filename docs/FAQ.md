# FAQ

[Overview](../README.md) | [Usage](USAGE.md) | [Reference](REFERENCE.md) | [Troubleshooting](TROUBLESHOOTING.md) | **FAQ** | [Changelog](../CHANGELOG.md)

## Does the site upload my VPX, ROM, Backglass, Color ROM, PUP, or YML files?

No. Files dropped onto checksum fields or the YML editor are processed in the browser by this application.

## What YML files can be reopened?

The importer is designed for flat VPXS table configuration files using the fields represented by this builder. It accepts the `.yml` extension only, with a 2 MB maximum size.

## What happens to fields the builder does not recognize?

Unknown top-level fields are skipped and reported after loading. They are not added to the generated output unless the builder has a corresponding field.

## Why does importing require the current VPS database?

The builder uses `tableVPSId` to load the correct table and verifies selected asset IDs before replacing the active build. This prevents an imported file from silently loading mismatched or unavailable selections.

## Does the site edit the Virtual Pinball Spreadsheet database?

No. The database is read-only from this application. The builder only uses it to locate tables and available assets.

## Why does the database toast appear every time the site opens?

It confirms whether the cached database matches the latest published `lastUpdated.json` version. The initial check prevents searches from silently using stale data.

## Why does the site check again every two hours?

The VPS database can change while the page remains open. The periodic check compares only the lightweight version file unless a newer database is available.

## Can I continue working if the database host is unavailable?

Yes, after at least one successful load. The last verified database remains in IndexedDB and is used as a fallback.

## Why are some asset choices disabled?

Entries marked as broken or unavailable by the VPS database cannot be selected for a valid build.

## Why are some configuration tabs disabled?

Asset-specific tabs become available only when their asset is selected or marked as bundled.

## Why is Enable for Wizard disabled?

That option is intentionally disabled by default in this builder.

## Why is Copy or Download blocked?

The generated YAML has at least one validation error. Warnings are allowed, but errors must be corrected first.

## What does the YAML Preview dot represent?

It combines the current Assets Panel states with enabled Configuration Panel states. Hover or keyboard-focus the dot to see active status counts, or activate it to move to the first current error.

## What is stored in Recent Build History?

The newest copied or downloaded snapshot for each table, including its YAML and editable form state. Up to eight recent tables are retained.

## Why did both Color ROM checksum fields clear?

Unchecking **PAL/VNI** intentionally clears both checksum fields so a previous PAL/VNI pair cannot remain attached to single-file mode.

## Why does the VPU Patch tab show an error after Clear Section?

A selected or bundled VPU Patch still requires its checksum. The checksum field may show an error, but the informational VPU Patch ID should never show a red border or error dot.
