(() => {
  'use strict';

  const modules = [
    window.VPS_FORMATTING,
    window.VPS_ASSET_CATALOG,
    window.VPS_YAML_SERVICE,
    window.VPS_FILE_OUTPUT,
    window.VPS_ARCHIVE_PATHS
  ];

  if (modules.some(module => !module || typeof module !== 'object')) {
    throw new Error('Builder utility modules must load before the VPS_UTILS compatibility layer.');
  }

  window.VPS_UTILS = Object.assign({}, ...modules);
})();
