(() => {
  'use strict';

  const frame = document.getElementById('appFrame');
  const results = document.getElementById('results');

  function append(name, passed, detail = '') {
    const item = document.createElement('li');
    item.className = passed ? 'pass' : 'fail';
    item.textContent = `${passed ? 'PASS' : 'FAIL'} — ${name}${detail ? `: ${detail}` : ''}`;
    results.appendChild(item);
  }

  function updateSummary() {
    const items = [...results.querySelectorAll('li')];
    const summary = items.find(item => /smoke tests? failed|All \d+ smoke tests passed/.test(item.textContent));
    if (!summary) return;
    const checks = items.filter(item => item !== summary && !item.classList.contains('pending'));
    const failed = checks.filter(item => item.classList.contains('fail')).length;
    summary.className = failed ? 'fail' : 'pass';
    summary.textContent = failed
      ? `${failed} smoke test${failed === 1 ? '' : 's'} failed.`
      : `All ${checks.length} smoke tests passed.`;
  }

  async function run() {
    const appWindow = frame.contentWindow;
    const appDocument = frame.contentDocument;
    if (!appWindow || !appDocument) {
      append('Authoritative controller iframe access', false);
      updateSummary();
      return;
    }

    const scriptPaths = new Set([...appDocument.scripts].map(script => {
      try { return new URL(script.src, appWindow.location.href).pathname; }
      catch (_) { return ''; }
    }));
    append(
      'Legacy controller removal',
      scriptPaths.has('/refactor/src/app/applicationController.js')
        && scriptPaths.has('/refactor/src/controllers/validationDialogController.js')
        && scriptPaths.has('/refactor/src/controllers/outputController.js')
        && !scriptPaths.has('/js.src/main.js')
        && !scriptPaths.has('/refactor/src/app/legacyStateBridge.js')
    );

    const application = appWindow.VPS_APPLICATION_CONTROLLER;
    const store = appWindow.VPS_APP_STORE;
    const persistence = appWindow.VPS_PERSISTENCE_CONTROLLER;
    const validator = appWindow.VPS_BUILD_VALIDATOR;
    const validationDialog = appWindow.VPS_VALIDATION_DIALOG;
    const output = appWindow.VPS_OUTPUT_CONTROLLER;

    const original = store.getSnapshot();
    persistence.stop();

    try {
      const record = {
        id: 'authoritative-table',
        name: 'Authoritative Table',
        tableFiles: [{ id: 'authoritative-vpx', urls: [] }]
      };
      application.selectRecord(record, {
        selections: { tableFiles: 'authoritative-vpx' },
        values: {
          vpxChecksum: 'a'.repeat(32),
          fps: 60,
          testers: 'Alpha'
        },
        source: 'smoke:authoritative'
      });

      await new Promise(resolve => appWindow.setTimeout(resolve, 80));
      const selected = store.getSnapshot();
      const loadedId = appDocument.querySelector('#tableStrip .table-id')?.textContent?.trim();
      append(
        'Store-authoritative record selection',
        selected.build.record?.id === 'authoritative-table'
          && selected.build.values.tableVPSId === 'authoritative-table'
          && selected.build.values.vpxVPSId === 'authoritative-vpx'
          && loadedId === 'authoritative-table',
        `${selected.build.record?.id || 'missing'} / ${loadedId || 'missing DOM'}`
      );

      const outputGate = output.validateForOutput();
      append(
        'Shared output validation gate',
        outputGate.ok
          && outputGate.validation.errors.length === 0
          && outputGate.snapshot.build.record?.id === 'authoritative-table',
        `${outputGate.validation.errors.length} errors`
      );

      const customValidation = validator.validate({
        record: {
          id: 'custom-validation',
          tableFiles: [{ id: 'custom-vpx', urls: [] }],
          b2sFiles: [{ id: 'custom-b2s', urls: [] }],
          vpuPatchFiles: [{ id: 'custom-patch', urls: [] }]
        },
        selections: {
          tableFiles: 'custom-vpx',
          b2sFiles: 'custom-b2s',
          vpuPatchFiles: 'custom-patch'
        },
        values: {
          tableVPSId: 'custom-validation',
          vpxVPSId: 'custom-vpx',
          vpxChecksum: 'a'.repeat(32),
          fps: 60,
          testers: 'Alpha',
          backglassVPSId: 'custom-b2s',
          backglassChecksum: 'b'.repeat(32),
          backglassUrlOverride: 'https://example.invalid/backglass',
          coloredROMUrlOverride: 'https://example.invalid/color',
          diffVPSId: 'custom-patch'
        },
        yaml: '---\n'
      });
      const titles = customValidation.errors.map(entry => entry.title);
      append(
        'Consolidated validation gates',
        titles.includes('Backglass authors override is required')
          && titles.includes('Backglass image override is required')
          && titles.includes('Color ROM version override is required')
          && titles.includes('VPU Patch Checksum is required'),
        `${customValidation.errors.length} errors`
      );

      validationDialog.render(customValidation);
      const renderedTitles = [...appDocument.querySelectorAll('#validationBody .validation-item strong')]
        .map(node => node.textContent);
      append(
        'Shared validation dialog rendering',
        renderedTitles.includes('Backglass authors override is required')
          && renderedTitles.includes('VPU Patch Checksum is required'),
        `${renderedTitles.length} rendered`
      );
    } catch (error) {
      append('Store-authoritative record selection', false, error?.message || 'Controller check failed.');
      append('Shared output validation gate', false, 'Controller check failed.');
      append('Consolidated validation gates', false, 'Controller check failed.');
      append('Shared validation dialog rendering', false, 'Controller check failed.');
    } finally {
      store.replace(original, { source: 'smoke:authoritative:restore' });
      validationDialog.render(store.getSnapshot().validation);
      persistence.start();
    }

    updateSummary();
  }

  frame.addEventListener('load', () => {
    window.setTimeout(run, 3000);
  }, { once: true });
})();
