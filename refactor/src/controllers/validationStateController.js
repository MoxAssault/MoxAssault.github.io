(() => {
  'use strict';

  const store = window.VPS_APP_STORE;
  const validator = window.VPS_BUILD_VALIDATOR;
  if (!store || !validator) return;

  let validating = false;

  function validateSnapshot(snapshot, source = 'validation:store') {
    if (validating) return snapshot.validation;
    validating = true;
    try {
      const result = validator.validate({
        record: snapshot.build?.record || null,
        selections: snapshot.build?.selections || {},
        values: snapshot.build?.values || {},
        yaml: snapshot.build?.yaml || '---\n'
      });
      store.setValidation(result, { source });
      return result;
    } finally {
      validating = false;
    }
  }

  const unsubscribe = store.subscribe((snapshot, metadata) => {
    const changed = metadata?.changedSections || [];
    if (changed.length === 1 && changed[0] === 'validation') return;
    if (!changed.some(section => section === 'build' || section === 'yaml')) return;
    validateSnapshot(snapshot);
  }, { immediate: true });

  window.VPS_VALIDATION_STATE = Object.freeze({
    validateNow: () => validateSnapshot(store.getSnapshot(), 'validation:manual'),
    stop: unsubscribe
  });
})();