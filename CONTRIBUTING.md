# Contributing

[Overview](README.md) | **Contributing** | [Security](SECURITY.md) | [Code of Conduct](CODE_OF_CONDUCT.md) | [License](LICENSE)

Contributions that improve correctness, accessibility, documentation, browser compatibility, validation, or repeat-use workflow are welcome.

## Before contributing

- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Report vulnerabilities through [SECURITY.md](SECURITY.md) rather than a public issue containing exploit details.
- Keep changes focused and explain the user-facing reason for them.
- Preserve the browser-only architecture unless a change is explicitly approved.
- Do not add tracking, advertising, payment, account, or file-upload services.
- Do not use the repository, its files, or the hosted site for monetary gain.

## Change expectations

A useful contribution should include:

- A clear description of the problem and expected behavior.
- Screenshots for visible interface changes when practical.
- Validation of JavaScript syntax and affected browser workflows.
- Documentation updates for new fields, behavior, or limitations.
- A semantic-version changelog entry when the change is user-facing.

Avoid committing unrelated formatting changes, generated dependency folders, credentials, personal data, or large binary files. Existing fixture and bundled vendor files should only be replaced when the related feature requires it.

## Project conventions

- Keep the interface compact and suitable for repeated table builds.
- Prefer accessible native controls and keyboard-operable interactions.
- Keep browser-generated and custom tooltips from overlapping.
- Treat the Virtual Pinball Spreadsheet database as read-only.
- Validate imported data before replacing working browser state.
- Process user-selected files in the browser unless the documentation explicitly states otherwise.
- Keep YAML output aligned with the upstream VPXS schema and validator behavior.

## Credits and attribution

- **MoxAssault** — project direction, interface requirements, testing, and maintenance.
- **Virtual Pinball Spreadsheet project** — table and asset records, VPS IDs, images, metadata, and the published database version used by search.
- **libarchive.js** — browser-side inspection of ZIP, RAR, and 7Z PUP Pack archives through JavaScript and WebAssembly. Its upstream MIT notice is preserved in [LICENSE](LICENSE) and `vendor/libarchive/LICENSE`.
- **Google Fonts** — the hosted Chakra Petch, Inter, and JetBrains Mono font families used by the interface.
- **Community contributors and testers** — issue reports, workflow feedback, compatibility checks, and validation examples.

Attribution should remain visible when relevant files or derived documentation are redistributed where redistribution is otherwise permitted.
