(() => {
  'use strict';

  function extractArchiveDirectories(entries) {
    const directories = [];
    (Array.isArray(entries) ? entries : []).forEach(entry => {
      const path = String(entry?.path || '')
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '');
      if (!path) return;
      const segments = path.split('/').filter(Boolean);
      for (let index = 1; index <= segments.length; index += 1) {
        directories.push(segments.slice(0, index).join('/'));
      }
    });
    return [...new Set(directories)]
      .filter(Boolean)
      .sort((left, right) => {
        const depthDifference = left.split('/').length - right.split('/').length;
        return depthDifference || left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
      });
  }

  window.VPS_ARCHIVE_PATHS = {
    extractArchiveDirectories
  };
})();
