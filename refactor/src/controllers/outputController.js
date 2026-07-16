(() => {
  'use strict';

  const store = window.VPS_APP_STORE;
  const fileOutput = window.VPS_FILE_OUTPUT;
  const persistence = window.VPS_PERSISTENCE_CONTROLLER;
  const validationDialog = window.VPS_VALIDATION_DIALOG;
  const buildPersistence = window.VPS_BUILD_PERSISTENCE;
  if (!store || !fileOutput || !persistence || !validationDialog || !buildPersistence) return;

  let statusReporter = () => {};

  function configure(options = {}) {
    if (typeof options.reportStatus === 'function') statusReporter = options.reportStatus;
  }

  function validateForOutput() {
    const result = validationDialog.validate();
    if (validationDialog.hasErrors(result)) {
      validationDialog.show(result);
      return { ok: false, validation: result, snapshot: store.getSnapshot() };
    }
    return { ok: true, validation: result, snapshot: store.getSnapshot() };
  }

  async function copy(button) {
    const gate = validateForOutput();
    if (!gate.ok) return gate;

    try {
      await fileOutput.copyText(gate.snapshot.build.yaml);
      persistence.addRecent('Copied', undefined, gate.snapshot);

      if (button) {
        const previous = button.textContent;
        button.textContent = 'Copied';
        window.setTimeout(() => {
          if (button.isConnected) button.textContent = previous;
        }, 1200);
      }

      return { ...gate, action: 'Copied' };
    } catch (error) {
      statusReporter(error?.message || 'The YAML could not be copied.', true);
      return { ...gate, ok: false, error };
    }
  }

  function download() {
    const gate = validateForOutput();
    if (!gate.ok) return gate;

    try {
      const filename = buildPersistence.currentFilename(gate.snapshot);
      fileOutput.downloadText(gate.snapshot.build.yaml, filename);
      persistence.addRecent('Downloaded', filename, gate.snapshot);
      return { ...gate, action: 'Downloaded', filename };
    } catch (error) {
      statusReporter(error?.message || 'The YAML could not be downloaded.', true);
      return { ...gate, ok: false, error };
    }
  }

  window.VPS_OUTPUT_CONTROLLER = Object.freeze({
    configure,
    validateForOutput,
    copy,
    download
  });
})();
