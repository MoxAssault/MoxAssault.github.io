# Workspace Stylesheet Ownership Map

This map defines how the inherited `css.src/category.css` file will be divided without changing its rendered behavior.

## Planned load order

1. `styles/components/asset-panel.css`
2. `styles/components/configuration-panel.css`
3. `styles/components/form-controls.css`
4. Existing enhancement and correction stylesheets, until their rules are consolidated separately

The component files must retain the relative rule order shown below. Later state-color and layout corrections intentionally override earlier compatibility rules.

## Asset panel ownership

The asset component owns:

- `.asset-matrix`
- `.asset-row` and its selection/detail states
- `.asset-name`
- `.asset-select-wrap`
- `.asset-row select`
- `.bundle-toggle`
- `.asset-status` and `.status-dot`
- `.asset-info-button`
- `.asset-thumbnail`, frame, image, preview, hover, focus, and reduced-motion rules
- `.asset-detail`, `.asset-comment`, and `.broken-option`
- Asset-specific responsive grid rules at 760px and 520px
- `.asset-status.state-*` rules, including the final semantic `--state-*` color overrides

## Configuration panel ownership

The configuration component owns:

- Legacy `.accordion-stack` and `.config-accordion` compatibility rules
- `.accordion-*` titles, state labels, bodies, and responsive rules
- `.configuration-tabs`, `.config-tab-list`, `.config-tab`, and `.config-tab-panel`
- `.field-grid`, `.field`, labels, hints, readonly IDs, array options, and advanced sections
- Main, PUP Pack, Color ROM, and advanced grid-area layouts
- Checksum drop-zone presentation and loading animation
- Responsive tagline input/textarea switching
- Configuration-tab warning and error indicators
- PUP archive-directory selector presentation
- Configuration-specific responsive rules at 760px and 520px

## Shared form-control ownership

The form-control component owns the global themed checkbox system:

- `input[type="checkbox"]`
- Checkbox checkmark pseudo-elements
- Checked and disabled states
- Accent-color reset rules for `.checkbox-row`, `.array-option`, `.toggle-check`, and `.bundle-toggle`

These rules remain global because checkboxes appear in both asset and configuration components.

## Cascade constraints

- The final `.asset-status.state-*` declarations must remain later than the original compatibility state declarations.
- The global checkbox appearance must load after the asset and configuration component base rules.
- The later equal-column PUP layout must remain later than the earlier PUP grid definition.
- The later standard ID/checksum sizing and Color ROM PAL/VNI layout must remain later than the base field-grid rules.
- Existing `uiEnhancements.css`, `v090.css`, and `v091.css` remain later in the page until their selectors are mapped and consolidated.

## Regression requirements before detaching `category.css`

The smoke test must verify:

- Asset rows render as a grid with the expected minimum height.
- Asset status semantic colors resolve through `--state-green`, `--state-yellow`, `--state-orange`, and `--state-red`.
- Configuration tab panels render as vertical flex containers with their expected minimum height.
- Main, PUP Pack, and Color ROM grids retain their named areas and responsive single-column behavior.
- Checkboxes retain the custom 16px appearance and checked-state fill.
- No direct `css.src/category.css` link remains after the three replacement files are active.
