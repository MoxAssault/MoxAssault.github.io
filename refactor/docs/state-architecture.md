# Application State and Events

The refactor build exposes one shared read model through `window.VPS_APP_STORE` and one event interface through `window.VPS_APP_EVENTS`.

## State shape

```text
build
  record
  selections
  values
  yaml
ui
  activeStep
  openAssetDetails
validation
  errors
  warnings
meta
  revision
  source
  changedAt
```

All public reads return detached plain-data snapshots. Mutating a returned snapshot does not mutate the stored state.

## Store API

- `getSnapshot()` returns the complete detached state.
- `select(selector)` reads a selected detached value.
- `subscribe(listener, options)` observes all state changes and returns an unsubscribe function.
- `setBuild(partial, options)` updates the current record, selections, values, or generated YAML.
- `setUi(partial, options)` updates active configuration and open asset-detail state.
- `setValidation(result, options)` updates validation errors and warnings.
- `replace(state, options)` replaces the full state, primarily for restoration and tests.
- `clearBuild(options)` resets build, UI, and validation state.

Every write accepts an optional `source` string. The source is copied into `meta.source` and included in subscriber and event metadata.

## Event API

`VPS_APP_EVENTS.types` defines:

- `state:changed`
- `build:loaded`
- `build:changed`
- `build:cleared`
- `yaml:changed`
- `ui:changed`
- `validation:changed`

`on(type, listener)` returns an unsubscribe function. `emit(type, detail)` publishes a custom application event.

## Transitional bridge

`src/app/legacyStateBridge.js` is intentionally temporary. It wraps the final enhanced `VPS_UI` rendering methods and observes the workspace and YAML preview so the current production `main.js` state is mirrored into the shared store.

This allows new refactor-owned services to consume explicit state immediately without modifying the production root. The bridge will be removed after the refactor-owned application controller becomes the authoritative state writer.

## First migrated consumer

`src/services/readmeGenerator.js` reads its record, selections, and values from `VPS_APP_STORE`. It no longer wraps `renderTableStrip` or `renderAssetMatrix` and no longer maintains a private renderer-derived snapshot.

## Compatibility boundary

The production root remains unchanged. Only `/refactor/` loads the store, bridge, and store-backed README service.