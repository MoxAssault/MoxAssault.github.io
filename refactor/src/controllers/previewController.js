(() => {
  'use strict';

  const store = window.VPS_APP_STORE;
  const modelService = window.VPS_PREVIEW_MODEL;
  if (!store || !modelService) return;

  let currentModel = modelService.create();
  let generating = false;
  let unsubscribe = null;

  function render(model) {
    const preview = document.getElementById('previewYaml');
    const lineCount = document.getElementById('previewLineCount');
    const statusDot = document.getElementById('previewStatusDot');

    if (preview) preview.innerHTML = model.highlightedYaml;
    if (lineCount) lineCount.textContent = model.lineLabel;
    if (statusDot) {
      statusDot.className = `preview-dot state-${model.status.key}`;
      statusDot.setAttribute('aria-label', `Overall asset status: ${model.status.label}`);
      statusDot.dataset.previewStatus = model.status.key;
      statusDot.removeAttribute('title');
    }
  }

  function update(snapshot = store.getSnapshot(), options = {}) {
    if (generating) return currentModel;
    generating = true;

    try {
      const nextModel = modelService.create(snapshot.build || {});
      currentModel = nextModel;
      render(nextModel);

      if (snapshot.build?.yaml !== nextModel.yaml && options.persist !== false) {
        store.setBuild({ yaml: nextModel.yaml }, { source: 'preview:generated' });
      }

      return nextModel;
    } finally {
      generating = false;
    }
  }

  function start() {
    if (unsubscribe) return;
    unsubscribe = store.subscribe((snapshot, metadata) => {
      const changed = metadata?.changedSections || [];
      if (metadata?.source === 'preview:generated') {
        render(currentModel);
        return;
      }
      if (!changed.some(section => section === 'build' || section === 'yaml')) return;
      update(snapshot);
    }, { immediate: true });
  }

  function stop() {
    unsubscribe?.();
    unsubscribe = null;
  }

  window.VPS_PREVIEW_CONTROLLER = Object.freeze({
    getModel: () => currentModel,
    renderNow: () => update(store.getSnapshot()),
    start,
    stop
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();