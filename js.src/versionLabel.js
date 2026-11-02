(() => {
  'use strict';

  // The version in the footer (Versioning Standard).
  //   a tagged release:       "1.0.0"
  //   anything else:          "1.0.0 (dev 65d3853)"
  //   with uncommitted edits: "1.0.0 (dev 65d3853, modified)"
  // version.json is written by tools/version-info.mjs: by the Pages workflow
  // when it publishes, and by the dev server on each request. Anywhere it is
  // missing, the footer stays as it always was.

  function label(info) {
    if (!info || typeof info.version !== 'string' || !info.version) return '';
    const exactRelease = info.tagged === true && info.modified !== true;
    if (exactRelease || typeof info.commit !== 'string' || !info.commit) return info.version;
    return `${info.version} (dev ${info.commit}${info.modified === true ? ', modified' : ''})`;
  }

  function apply(info) {
    const node = document.getElementById('appVersion');
    if (!node) return '';
    const text = label(info);
    node.textContent = text;
    node.hidden = !text;
    // The dot between the name and the version comes and goes with it.
    const separator = document.getElementById('appVersionSeparator');
    if (separator) separator.hidden = !text;
    return text;
  }

  window.VPS_VERSION_LABEL = { label, apply };

  if (typeof fetch === 'function') {
    fetch('version.json', { cache: 'no-store' })
      .then(response => (response.ok ? response.json() : null))
      .then(apply)
      .catch(() => {});
  }
})();
