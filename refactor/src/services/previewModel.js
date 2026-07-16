(() => {
  'use strict';

  const fields = window.VPS_YML_FIELDS;
  const yamlService = window.VPS_YAML_SERVICE;
  const assetCatalog = window.VPS_ASSET_CATALOG;
  if (!fields || !yamlService || !assetCatalog) return;

  const PRIORITY = Object.freeze({ neutral: 0, green: 1, yellow: 2, orange: 3, red: 4 });

  function overallAssetState(record, selections = {}, values = {}) {
    if (!record) return { key: 'neutral', label: 'No table loaded' };

    return Object.entries(fields.CATEGORY_CONFIG || {})
      .map(([category, config]) => assetCatalog.getAssetState(record, category, config, selections, values))
      .reduce(
        (highest, current) => PRIORITY[current.key] > PRIORITY[highest.key] ? current : highest,
        { key: 'neutral', label: 'Unavailable' }
      );
  }

  function lineCount(yaml) {
    return String(yaml || '---\n').trimEnd().split('\n').length;
  }

  function create(build = {}) {
    const values = build.values || {};
    const yaml = yamlService.buildYaml(values, { omit: fields.OMIT_FROM_YAML });
    const count = lineCount(yaml);

    return Object.freeze({
      yaml,
      highlightedYaml: yamlService.highlightYaml(yaml),
      lineCount: count,
      lineLabel: `${count} ${count === 1 ? 'LINE' : 'LINES'}`,
      status: Object.freeze(overallAssetState(build.record || null, build.selections || {}, values))
    });
  }

  window.VPS_PREVIEW_MODEL = Object.freeze({
    create,
    lineCount,
    overallAssetState
  });
})();