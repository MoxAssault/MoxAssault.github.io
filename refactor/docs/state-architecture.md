# Application State and Events

The refactor build exposes one authoritative application state through `window.VPS_APP_STORE` and one event interface through `window.VPS_APP_EVENTS`.

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

All public reads return detached plain-data snapshots. Mutating a returned snapshot does not mutate stored state.

## Store API

- `getSnapshot()` returns the complete detached state.
- `select(selector)` reads a selected detached value.
- `subscribe(listener, options)` observes state changes and returns an unsubscribe function.
- `setBuild(partial, options)` updates the record, selections, values, or generated YAML.
- `setUi(partial, options)` updates the active configuration step or open asset details.
- `setValidation(result, options)` updates validation errors and warnings.
- `replace(state, options)` replaces the complete state for restoration and tests.
- `clearBuild(options)` resets build, UI, and validation state.

Every write accepts an optional `source` string. Notification source, revision, timestamp, changed sections, and snapshot are captured before subscriber delivery, so nested writes cannot relabel the originating notification.

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

## Authoritative writer

`src/app/applicationController.js` is the authoritative writer for interactive application changes:

- Search and table loading
- Asset selection and bundled state
- Configuration field changes and active steps
- Open asset details
- Build clearing and next-build presets
- Recent-build restoration

It writes directly to `VPS_APP_STORE`; UI rendering reads snapshots from the store.

## Store-backed consumers

- `previewController.js` generates and renders YAML from shared state.
- `validationStateController.js` maintains shared errors and warnings.
- `validationDialogController.js` renders shared validation results.
- `outputController.js` gates copy/download through shared validation.
- `persistenceController.js` autosaves shared state.
- `readmeGenerator.js` creates README files from shared state.
- `ymlImportController.js` drives the authoritative controller through normal UI actions.

## Removed compatibility layer

`legacyStateBridge.js` has been removed, and `/refactor/` no longer loads the production `js.src/main.js`. No renderer interception or preview DOM scraping is required to keep application state synchronized.

## Production boundary

The repository root remains the production build. These authoritative-state changes currently apply only to `/refactor/`.
