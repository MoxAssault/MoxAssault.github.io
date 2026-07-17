(() => {
  'use strict';
  const state = {
    record: null,
    selections: null,
    values: null,
    callbacks: null
  };
  const api = {
    state,
    update(patch = {}) { Object.assign(state, patch); },
    schedule() {
      window.VPS_PRODUCTION_UI_EXTENSIONS?.scheduleControlCorrections?.();
    }
  };
  window.VPS_FEATURE_RUNTIME = Object.freeze(api);
})();
