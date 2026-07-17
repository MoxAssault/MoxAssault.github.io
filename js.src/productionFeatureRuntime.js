(() => {
  'use strict';
  const state = {
    record: null,
    selections: null,
    values: null,
    callbacks: null,
    decorationFrame: 0
  };
  const api = {
    state,
    update(patch = {}) { Object.assign(state, patch); },
    schedule() {
      if (state.decorationFrame) return;
      state.decorationFrame = window.requestAnimationFrame(() => {
        state.decorationFrame = 0;
        window.VPS_ADDITIONAL_ROMS?.render?.();
        window.VPS_FEATURE_VALIDATION?.refresh?.();
      });
    }
  };
  window.VPS_FEATURE_RUNTIME = Object.freeze(api);
})();
