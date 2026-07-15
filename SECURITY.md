# Security Policy

[Overview](README.md) | [Contributing](CONTRIBUTING.md) | **Security** | [Code of Conduct](CODE_OF_CONDUCT.md) | [License](LICENSE)

## Supported version

Security fixes are applied to the current version published from the default branch. Older versions and copied deployments are not maintained separately.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository when that option is available. Do not publish exploit details, private data, credentials, or a working proof of concept in a public issue.

When private reporting is unavailable, open a minimal public issue asking the maintainer for a private contact method. Include no sensitive technical details in that issue.

A useful report includes:

- The affected page, file, or feature.
- Clear reproduction steps that do not expose other users or systems.
- The likely impact.
- Browser and operating-system information.
- A suggested mitigation when known.

## Security boundaries

This is a static, browser-based application. It has no account system, application server, or payment system.

- YML files, checksum files, and PUP Pack archives are processed in the browser.
- Imported YML files are limited to the `.yml` extension and a 2 MB maximum size.
- The YML importer accepts the flat VPXS field structure, rejects unexpected indentation and duplicate keys, and only loads fields represented by the builder.
- Unknown imported fields are skipped rather than executed or inserted as HTML.
- Files selected for checksum calculation or YML editing are not intentionally uploaded by this application.
- Drafts, recent builds, preferences, and the verified VPS database cache are stored in the current browser.
- The application reads table and asset data from the Virtual Pinball Spreadsheet project.
- Archive inspection uses the bundled libarchive.js JavaScript and WebAssembly files.

## Security-sensitive areas

Reports are especially useful for issues involving:

- Script injection through database records, imported YML values, filenames, or URLs.
- Unexpected network transmission of user-selected files or their contents.
- Path, memory, or denial-of-service problems involving archive inspection.
- Dependency or WebAssembly integrity concerns.
- IndexedDB or local-storage exposure beyond the current site origin.
- Bypasses of file-extension, file-size, or YAML-structure restrictions.

## Responsible testing

Do not test against systems or data you do not own or have permission to use. Do not disrupt the public site, VPS data providers, GitHub Pages, or other users.
