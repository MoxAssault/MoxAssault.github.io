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

  function validFixture(appWindow) {
    const checksum = 'a'.repeat(32);
    const record = {
      id: 'validation-table',
      name: 'Validation Table',
      tableFiles: [{ id: 'validation-vpx', urls: [] }]
    };
    const selections = { tableFiles: 'validation-vpx' };
    const values = {
      tableVPSId: 'validation-table',
      vpxVPSId: 'validation-vpx',
      vpxChecksum: checksum,
      fps: 60,
      testers: 'Alpha',
      enabled: false
    };
    const yaml = appWindow.VPS_YAML_SERVICE.buildYaml(values, {
      omit: appWindow.VPS_YML_FIELDS.OMIT_FROM_YAML
    });
    return { record, selections, values, yaml };
  }

  function run() {
    const appWindow = frame.contentWindow;
    const appDocument = frame.contentDocument;
    if (!appWindow || !appDocument) {
      append('Validation iframe access', false, 'Unable to access the refactor frame.');
      updateSummary();
      return;
    }

    const validator = appWindow.VPS_BUILD_VALIDATOR;
    const validationState = appWindow.VPS_VALIDATION_STATE;
    append(
      'Validation module globals',
      typeof validator?.validate === 'function'
        && typeof validator?.isStepEnabled === 'function'
        && typeof validationState?.validateNow === 'function'
    );

    const scriptPaths = new Set([...appDocument.scripts].map(script => {
      try { return new URL(script.src, appWindow.location.href).pathname; } catch (_) { return ''; }
    }));
    const requiredPaths = [
      '/refactor/src/services/buildValidator.js',
      '/refactor/src/controllers/validationStateController.js'
    ];
    const missingPaths = requiredPaths.filter(path => !scriptPaths.has(path));
    append('Validation script ownership', missingPaths.length === 0, missingPaths.join(', '));

    try {
      const invalid = validator.validate({
        record: null,
        selections: {},
        values: {},
        yaml: '---\n'
      });
      const titles = invalid.errors.map(entry => entry.title);
      const invalidValid = titles.includes('No table selected')
        && titles.includes('Missing table VPS ID')
        && titles.includes('VPX file required')
        && titles.includes('FPS is required')
        && titles.includes('Testers are required')
        && titles.includes('VPX Checksum is required');
      append('Invalid build validation contract', invalidValid, `${invalid.errors.length} errors`);

      const fixture = validFixture(appWindow);
      const valid = validator.validate(fixture);
      append(
        'Valid build validation contract',
        valid.errors.length === 0 && valid.warnings.length === 0,
        `${valid.errors.length} errors, ${valid.warnings.length} warnings`
      );

      const palInvalid = validator.validate({
        ...fixture,
        values: {
          ...fixture.values,
          coloredROMPin2DMD: true,
          coloredROMChecksum: 'b'.repeat(32),
          coloredROMChecksumSecondary: ''
        }
      });
      append(
        'PAL/VNI validation contract',
        palInvalid.errors.some(entry => entry.title === 'PAL/VNI requires two checksums')
      );
    } catch (error) {
      append('Invalid build validation contract', false, error?.message || 'Validation fixture failed.');
      append('Valid build validation contract', false, 'Validation fixture failed.');
      append('PAL/VNI validation contract', false, 'Validation fixture failed.');
    }

    try {
      const store = appWindow.VPS_APP_STORE;
      const original = store.getSnapshot();
      const fixture = validFixture(appWindow);
      store.setBuild(fixture, { source: 'smoke:validation' });
      const synchronized = store.getSnapshot();
      const synchronizedValid = synchronized.validation.errors.length === 0
        && synchronized.validation.warnings.length === 0
        && synchronized.meta.source === 'validation:store';
      append(
        'Validation store synchronization',
        synchronizedValid,
        `${synchronized.validation.errors.length} errors, source ${synchronized.meta.source}`
      );
      store.replace(original, { source: 'smoke:validation:restore' });
    } catch (error) {
      append('Validation store synchronization', false, error?.message || 'Store synchronization failed.');
    }

    updateSummary();
  }

  frame.addEventListener('load', () => {
    window.setTimeout(run, 2200);
  }, { once: true });
})();