// Importing a YML with a DMD bundled in the VPX archive (Jason found the bug
// 2026-10-30). Bundled, the export writes the DMD tab's archive format as
// vpxArchiveFormat and leaves specialDMDArchiveFormat out (yamlFeatureSupport,
// Jason's call 2026-08-26). The import has to put it back on the DMD tab, or
// the format is lost on import and every later export leaves it out.
//
// Runs the real app in headless Chrome through the scenario runner.

import { check, report } from './harness.mjs';
import { startScenarios } from './yaml-scenarios.mjs';

const { app, play, PRINT } = await startScenarios();

const yml = lines => ['---', 'tableVPSId: "Lgi1JLk0Vf"', 'vpxVPSId: "qV3Z3oQ8md"', ...lines].join('\n') + '\n';
const BUNDLED = ['specialDMDBundled: true', 'specialDMDType: "FlexDMD"', 'specialDMDArchiveRoot: "DMD/Root"'];

async function look() {
  return app.run(() => {
    const values = window.VPS_FEATURE_RUNTIME.state.values;
    const yaml = document.getElementById('previewYaml').textContent;
    return {
      dmdFormat: values.specialDMDArchiveFormat ?? null,
      bundled: values.specialDMDBundled === true,
      formatLines: yaml.split('\n').filter(line => /ArchiveFormat/.test(line)),
      yaml
    };
  });
}

if (!PRINT) {
  // 1. Bundled: vpxArchiveFormat comes back as the DMD tab's format.
  await play([['import', yml([...BUNDLED, 'vpxArchiveFormat: "rar"'])]]);
  const first = await look();
  check('bundled: the DMD tab gets its archive format back from vpxArchiveFormat',
    first.bundled && first.dmdFormat === 'rar', JSON.stringify(first));
  check('bundled: and the export writes it again, as vpxArchiveFormat only',
    JSON.stringify(first.formatLines) === '["vpxArchiveFormat: \\"rar\\""]', JSON.stringify(first.formatLines));

  // 2. The round trip Jason ran: export, import that, export again.
  await play([['import', first.yaml]]);
  const second = await look();
  check('bundled: an exported file imports back with the same format, and exports it again',
    second.dmdFormat === 'rar' && JSON.stringify(second.formatLines) === '["vpxArchiveFormat: \\"rar\\""]', JSON.stringify(second));

  // 3. Upper case in a hand-edited file still lands on the option.
  await play([['import', yml([...BUNDLED, 'vpxArchiveFormat: "ZIP"'])]]);
  check('bundled: a hand-written "ZIP" lands on the zip option', (await look()).dmdFormat === 'zip');

  // 4. A file that does carry the DMD key keeps its own value.
  await play([['import', yml([...BUNDLED, 'specialDMDArchiveFormat: "7z"', 'vpxArchiveFormat: "rar"'])]]);
  const both = await look();
  check('bundled: a DMD key the file carries wins over vpxArchiveFormat',
    both.dmdFormat === '7z' && JSON.stringify(both.formatLines) === '["vpxArchiveFormat: \\"7z\\""]', JSON.stringify(both));

  // 5. Standalone DMD: vpxArchiveFormat means nothing and is not copied over.
  await play([['import', yml(['specialDMDOverride: true', 'specialDMDType: "FlexDMD"', 'vpxArchiveFormat: "rar"'])]]);
  const standalone = await look();
  check('standalone: vpxArchiveFormat is not copied to the DMD tab, nor written',
    standalone.bundled === false && standalone.dmdFormat === null && !standalone.formatLines.some(line => /vpxArchiveFormat/.test(line)),
    JSON.stringify(standalone));

  check('no page errors', app.errors.filter(error => !/Unable to preload the VPS database/.test(error)).length === 0, app.errors.join('\n'));
}

await app.close();
report('dmd-bundled-import');
