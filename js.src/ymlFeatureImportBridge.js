(() => {
  'use strict';

  const runtime = window.VPS_FEATURE_RUNTIME;
  const fields = window.VPS_YML_FIELDS;
  if (!runtime || !fields) return;

  // The YML blocks the flat importer (ymlImport.js) cannot read: additionalRoms
  // and postInstallRename, both lists of objects. ymlImport calls prepare()
  // before it parses a file; the blocks are cut out, and the apply() handed
  // back puts their rows in once the rest of the file has loaded.
  //
  // Until 2026-11-15 this file caught the file input's change and drop events
  // ahead of the importer, sent a stripped copy back through the input, then
  // polled the drop zone's CSS class for up to 30 minutes to learn when the
  // import ended. ymlImport now calls it directly (Jason, task 4: the import's
  // URL Override check has to run after the Additional ROMs are in).

  const SUPPORTED_KEYS = new Set(['vpsId', 'checksum', 'versionOverride', 'urlOverride']);

  function stripInlineComment(value) {
    let single = false;
    let double = false;
    let escaped = false;
    for (let index = 0; index < value.length; index += 1) {
      const character = value[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === '\\' && double) {
        escaped = true;
        continue;
      }
      if (character === "'" && !double) single = !single;
      else if (character === '"' && !single) double = !double;
      else if (character === '#' && !single && !double && (index === 0 || /\s/.test(value[index - 1]))) {
        return value.slice(0, index).trimEnd();
      }
    }
    return value.trimEnd();
  }

  function parseScalar(raw) {
    const value = stripInlineComment(String(raw || '').trim());
    if (!value) return '';
    if (value.startsWith('"')) {
      if (!value.endsWith('"')) throw new Error('An Additional ROM double-quoted value is not closed.');
      try { return JSON.parse(value); } catch (_) { return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\'); }
    }
    if (value.startsWith("'")) {
      if (!value.endsWith("'")) throw new Error('An Additional ROM single-quoted value is not closed.');
      return value.slice(1, -1).replace(/''/g, "'");
    }
    return value;
  }

  function parseAdditionalRoms(lines) {
    const entries = [];
    let current = null;
    let sawContent = false;

    lines.forEach((line, offset) => {
      if (!line.trim() || /^\s*#/.test(line)) return;
      sawContent = true;

      const itemMatch = line.match(/^\s{2,}-\s+([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
      if (itemMatch) {
        if (current) entries.push(current);
        current = {};
        const key = itemMatch[1];
        if (!SUPPORTED_KEYS.has(key)) throw new Error(`Unsupported Additional ROM field “${key}” near line ${offset + 1}.`);
        current[key] = parseScalar(itemMatch[2]);
        return;
      }

      const propertyMatch = line.match(/^\s{4,}([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
      if (!propertyMatch || !current) {
        throw new Error(`Could not parse the Additional ROM block near line ${offset + 1}.`);
      }
      const key = propertyMatch[1];
      if (!SUPPORTED_KEYS.has(key)) throw new Error(`Unsupported Additional ROM field “${key}” near line ${offset + 1}.`);
      current[key] = parseScalar(propertyMatch[2]);
    });

    if (current) entries.push(current);
    if (sawContent && !entries.length) throw new Error('The Additional ROM block does not contain any valid ROM entries.');
    return entries.map(entry => ({
      vpsId: String(entry.vpsId || '').trim(),
      checksum: String(entry.checksum || '').trim(),
      versionOverride: String(entry.versionOverride || '').trim(),
      urlOverride: String(entry.urlOverride || '').trim()
    }));
  }

  function extractFeatureBlock(text) {
    const normalized = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');
    const start = lines.findIndex(line => /^additionalRoms:\s*(?:\[\s*\])?\s*(?:#.*)?$/.test(line));
    if (start < 0) {
      return { found: false, entries: [], strippedText: normalized };
    }

    let end = start + 1;
    while (end < lines.length && (!lines[end].trim() || /^\s/.test(lines[end]))) end += 1;
    const inlineEmpty = /^additionalRoms:\s*\[\s*\]/.test(lines[start]);
    const entries = inlineEmpty ? [] : parseAdditionalRoms(lines.slice(start + 1, end));
    const stripped = [...lines.slice(0, start), ...lines.slice(end)].join('\n');
    return { found: true, entries, strippedText: stripped };
  }

  // postInstallRename is a list of { source, destination }, which the flat
  // importer cannot read either (2026-10-27). Same treatment as additionalRoms:
  // the block is cut out before the original importer runs and its rows are
  // handed to vpxRenamesController afterwards.
  const RENAME_KEYS = new Set(['source', 'destination']);

  function parseRenames(lines) {
    const entries = [];
    let current = null;
    lines.forEach((line, offset) => {
      if (!line.trim() || /^\s*#/.test(line)) return;
      const itemMatch = line.match(/^\s*-\s+([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
      const propertyMatch = itemMatch ? null : line.match(/^\s{2,}([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
      const match = itemMatch || propertyMatch;
      if (!match || (!itemMatch && !current)) {
        throw new Error(`Could not parse the postInstallRename block near line ${offset + 1}.`);
      }
      if (!RENAME_KEYS.has(match[1])) throw new Error(`Unsupported postInstallRename field “${match[1]}” near line ${offset + 1}.`);
      if (itemMatch) {
        if (current) entries.push(current);
        current = {};
      }
      current[match[1]] = parseScalar(match[2]);
    });
    if (current) entries.push(current);
    return entries.map(entry => ({
      source: String(entry.source || ''),
      destination: String(entry.destination || '')
    }));
  }

  function extractRenameBlock(normalized) {
    const lines = normalized.split('\n');
    const start = lines.findIndex(line => /^postInstallRename:\s*(?:\[\s*\])?\s*(?:#.*)?$/.test(line));
    if (start < 0) return { found: false, entries: [], strippedText: normalized };
    let end = start + 1;
    while (end < lines.length && (!lines[end].trim() || /^\s/.test(lines[end]))) end += 1;
    const inlineEmpty = /^postInstallRename:\s*\[\s*\]/.test(lines[start]);
    const entries = inlineEmpty ? [] : parseRenames(lines.slice(start + 1, end));
    return { found: true, entries, strippedText: [...lines.slice(0, start), ...lines.slice(end)].join('\n') };
  }

  function transformedFile(source, text) {
    return new File([text], source.name, {
      type: source.type || 'text/yaml',
      lastModified: source.lastModified
    });
  }

  function additionalRomsDefinition() {
    return fields.WIZARD_STEPS.find(step => step.id === 'rom')?.fields
      .find(field => field.yml_field === 'additionalRoms') || { yml_field: 'additionalRoms', type: 'additional-roms' };
  }

  // { file, apply }: the file for the flat importer, and what to do once it
  // has loaded. A block that will not parse leaves the file whole, so the
  // importer's own error says what is wrong with it.
  async function prepare(source) {
    let extracted;
    let renames;
    try {
      extracted = extractFeatureBlock(await source.text());
      renames = extractRenameBlock(extracted.strippedText);
    } catch (error) {
      console.warn('Additional ROM / rename import preprocessing failed; using the original importer error path.', error);
      return { file: source };
    }
    if (!extracted.found && !renames.found) return { file: source };
    return {
      file: transformedFile(source, renames.strippedText),
      apply() {
        if (extracted.found) {
          runtime.state.callbacks.onChange('additionalRoms', extracted.entries, additionalRomsDefinition());
          window.VPS_ADDITIONAL_ROMS?.render?.();
        }
        if (renames.found) window.VPS_INSTALL_RENAMES?.applyImported?.(renames.entries);
        window.VPS_PRODUCTION_UI_EXTENSIONS?.scheduleControlCorrections?.();
      }
    };
  }

  window.VPS_YML_FEATURE_IMPORT = Object.freeze({ extractFeatureBlock, prepare });
})();
