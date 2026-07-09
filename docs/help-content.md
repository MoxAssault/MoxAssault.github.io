# VPXS YML Creator Help

## Builder Mode

Builder Mode creates a new VPXS table configuration from VPS database data.

1. Search by table name, manufacturer, year, or VPS ID.
2. Select the matching table from autocomplete.
3. Choose table files such as VPX, Backglass, ROM, Colored ROM, VPU Patch, and PUP Pack.
4. Fill in the wizard fields required for the generated YML.
5. Review the live preview.
6. Download the generated `.yml` file.

## Editor Mode

Editor Mode updates an existing table configuration.

1. Open the Editor tab.
2. Drop a `.yml` or `.yaml` file into the upload area, choose a file, or paste YML into the source box.
3. Click **Parse YML** if you pasted content manually.
4. Edit the parsed wizard fields.
5. Review the edited YML preview.
6. Download the updated file.

## Required Fields

The minimum generated table config usually needs:

- `tableVPSId`
- `vpxVPSId`
- `vpxChecksum`
- `fps`
- `mainNotes`
- `tagline`
- `testers`

Other checksum fields become required when their related file is selected or marked as bundled.

## File Sections

- **Base**: Overall table metadata shared by the generated YML.
- **VPX**: The playable Visual Pinball table file.
- **Backglass**: DirectB2S metadata, checksum, bundled state, and overrides.
- **ROM**: ROM ID, checksum, version override, URL override, and notes.
- **Colored ROM**: Color ROM or serum metadata, including multiple checksum support.
- **VPU Patch**: Diff/VPU patch metadata from the selected table or related patch file.
- **PUP Pack**: PUP pack URL, archive format, archive root, required state, version, and checksum.

## Long URLs and Notes

The generator keeps long URL fields on a single line and adds a yamllint line-length suppression comment when needed. Long note fields may be folded to keep the YML readable.

## Troubleshooting

- If search does not load, refresh the page and confirm the VPS DB status panel does not show an error.
- If a search result loads but no wizard fields appear, open the browser console and check the exact error message.
- If a YML file starts with `---`, that document marker is supported and should be ignored by the parser.
- If colors or layout appear stale, hard-refresh the page or open the site with the latest cache-busting query string.
