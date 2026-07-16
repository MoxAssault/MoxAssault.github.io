(() => {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function humanize(key) {
    return String(key ?? '')
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, char => char.toUpperCase())
      .trim();
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function isItemBroken(item) {
    if (!item || typeof item !== 'object') return false;
    if (item.broken === true || item.broken === 'true') return true;

    const urls = item.urls;
    if (Array.isArray(urls)) {
      return urls.some(url => url && (url.broken === true || url.broken === 'true'));
    }
    if (urls && typeof urls === 'object') {
      return Object.values(urls).some(url => url && (url.broken === true || url.broken === 'true'));
    }
    return false;
  }

  const EXCLUDED_VPX_FORMATS = new Set(['FP', 'FX', 'FX2', 'FX3']);

  function normalizeList(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === '') return [];
    return [value];
  }

  function isExcludedVpxFormat(item) {
    return normalizeList(item?.tableFormat)
      .some(format => EXCLUDED_VPX_FORMATS.has(String(format).trim().toUpperCase()));
  }

  function isVpuPatchItem(item) {
    const features = item?.features ?? item?.Features;
    return normalizeList(features)
      .some(feature => String(feature).trim().toLowerCase().includes('vpu patch'));
  }

  function getParentId(item) {
    return String(item?.parentId ?? item?.parentID ?? item?.parentid ?? '').trim();
  }

  function uniqueItems(items) {
    const unique = new Map();
    items.filter(Boolean).forEach((item, index) => {
      const key = String(item?.id ?? `__index_${index}`);
      if (!unique.has(key)) unique.set(key, item);
    });
    return [...unique.values()];
  }

  function getCategoryItems(record, category, config = {}, context = {}) {
    if (!record) return [];

    if (category === 'tableFiles') {
      const tableFiles = Array.isArray(record.tableFiles) ? record.tableFiles : [];
      return tableFiles.filter(item => !isExcludedVpxFormat(item) && !isVpuPatchItem(item));
    }

    if (category === 'vpuPatchFiles') {
      const sourceFields = Array.isArray(config.sourceFields) && config.sourceFields.length
        ? config.sourceFields
        : [category];
      const direct = sourceFields.flatMap(field => Array.isArray(record?.[field]) ? record[field] : []);
      const inferred = (Array.isArray(record.tableFiles) ? record.tableFiles : []).filter(isVpuPatchItem);
      const selectedVpxId = String(context?.selections?.tableFiles ?? context?.selectedVpxId ?? '').trim();

      return uniqueItems([...direct, ...inferred]).filter(item => {
        const parentId = getParentId(item);
        return !parentId || (selectedVpxId && parentId === selectedVpxId);
      });
    }

    const sourceFields = Array.isArray(config.sourceFields) && config.sourceFields.length
      ? config.sourceFields
      : [category];
    for (const field of sourceFields) {
      if (Array.isArray(record?.[field])) return record[field];
    }
    return [];
  }

  function getAssetState(record, category, config = {}, selections = {}, values = {}) {
    const items = getCategoryItems(record, category, config, { selections });
    const selectedId = String(selections?.[category] || '').trim();
    const bundled = Boolean(config.bundleField && values?.[config.bundleField] === true);

    if (selectedId && bundled) {
      return { key: 'orange', label: 'Conflict', active: true, safe: false, items };
    }
    if (selectedId || bundled) {
      return { key: 'green', label: selectedId ? 'Selected' : 'Bundled', active: true, safe: true, items };
    }
    if (!items.length) {
      return { key: 'neutral', label: 'Unavailable', active: false, safe: false, items };
    }
    if (config.required) {
      return { key: 'red', label: 'Required', active: true, safe: false, items };
    }
    return { key: 'yellow', label: 'Available', active: true, safe: false, items };
  }

  function getCoverUrl(record) {
    const groups = ['tableFiles', 'b2sFiles', 'romFiles', 'altColorFiles', 'pupPackFiles', 'vpuPatchFiles', 'mediaPackFiles'];
    return record?.imgUrl || groups.map(group => record?.[group]?.[0]?.imgUrl).find(Boolean) || '';
  }

  function normalizeArray(value) {
    if (Array.isArray(value)) {
      return value.map(item => String(item).trim()).filter(Boolean);
    }
    if (typeof value !== 'string') return [];
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }

  function wrapText(text, maxLength = 120) {
    const sourceLines = String(text).replace(/\r\n?/g, '\n').split('\n');
    const output = [];

    sourceLines.forEach(sourceLine => {
      const words = sourceLine.trim().split(/\s+/).filter(Boolean);
      if (!words.length) {
        output.push('');
        return;
      }

      let line = '';
      words.forEach(word => {
        const candidate = line ? `${line} ${word}` : word;
        if (candidate.length > maxLength && line) {
          output.push(line);
          line = word;
        } else {
          line = candidate;
        }
      });
      if (line) output.push(line);
    });

    return output;
  }

  function cleanYamlString(value) {
    return String(value).replace(/"/g, "'").trim();
  }

  function isMd5Hash(value) {
    return typeof value === 'string' && /^[a-f0-9]{32}$/i.test(value.trim());
  }

  function normalizeChecksumValue(value) {
    if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
    if (value === undefined || value === null || value === '') return [];
    return [String(value).trim()].filter(Boolean);
  }

  function buildYaml(values, options = {}) {
    const data = { ...values };
    const omit = options.omit instanceof Set ? options.omit : new Set(options.omit || []);

    // The wizard flag is intentionally explicit in every generated file.
    if (typeof data.enabled !== 'boolean') data.enabled = false;

    // Deprecated applyFix values must never leak into newly generated YAML.
    delete data.bass;
    delete data.applyFixes;

    // PAL/VNI mode produces the two-checksum list expected by the upstream schema.
    // In Serum/CRZ mode, coloredROMPin2DMD is omitted entirely.
    const primaryColorChecksum = Array.isArray(data.coloredROMChecksum)
      ? data.coloredROMChecksum[0]
      : data.coloredROMChecksum;
    const secondaryColorChecksum = data.coloredROMChecksumSecondary
      ?? (Array.isArray(data.coloredROMChecksum) ? data.coloredROMChecksum[1] : '');
    if (data.coloredROMPin2DMD === true) {
      const checksums = [primaryColorChecksum, secondaryColorChecksum]
        .map(value => String(value || '').trim())
        .filter(Boolean);
      if (checksums.length) data.coloredROMChecksum = checksums;
      else delete data.coloredROMChecksum;
    } else {
      delete data.coloredROMPin2DMD;
      if (primaryColorChecksum) data.coloredROMChecksum = String(primaryColorChecksum).trim();
      else delete data.coloredROMChecksum;
    }
    delete data.coloredROMChecksumSecondary;

    ['testers', 'backglassAuthorsOverride'].forEach(key => {
      const normalized = normalizeArray(data[key]);
      if (normalized.length) data[key] = normalized;
      else delete data[key];
    });

    ['fps', 'tableYearOverride'].forEach(key => {
      if (data[key] === '' || data[key] === undefined || data[key] === null) {
        delete data[key];
        return;
      }
      const parsed = Number.parseInt(data[key], 10);
      if (Number.isFinite(parsed)) data[key] = parsed;
      else delete data[key];
    });

    const entries = Object.entries(data)
      .filter(([key, value]) => {
        if (omit.has(key) || key.startsWith('__') || key.endsWith('_check')) return false;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'string') return value.trim() !== '';
        if (typeof value === 'number') return Number.isFinite(value);
        if (typeof value === 'boolean') return value === true || key === 'enabled';
        return false;
      })
      .sort(([left], [right]) => left.localeCompare(right));

    let yaml = '---\n';

    entries.forEach(([name, value]) => {
      if (Array.isArray(value)) {
        yaml += `${name}:\n`;
        value.forEach(item => {
          yaml += `  - "${cleanYamlString(item)}"\n`;
        });
        return;
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        yaml += `${name}: ${value}\n`;
        return;
      }

      const cleanValue = cleanYamlString(value);
      const isUrlField = name.endsWith('UrlOverride') || name.endsWith('FileUrl');

      if (isUrlField) {
        if (cleanValue.length > 120) {
          yaml += '# yamllint disable-line rule:line-length\n';
        }
        yaml += `${name}: "${cleanValue.replace(/\n+/g, ' ')}"\n`;
        return;
      }

      if (cleanValue.includes('\n') || cleanValue.length > 120) {
        yaml += `${name}: >-\n`;
        wrapText(cleanValue, 120).forEach(line => {
          yaml += line ? `  ${line}\n` : '  \n';
        });
        return;
      }

      yaml += `${name}: "${cleanValue}"\n`;
    });

    return yaml;
  }

  function highlightYaml(yaml) {
    return String(yaml)
      .split('\n')
      .map(line => {
        if (line.startsWith('#') || line === '---') {
          return `<span class="yml-comment">${escapeHtml(line)}</span>`;
        }

        const listMatch = line.match(/^(\s*-\s+)(.*)$/);
        if (listMatch) {
          return `${escapeHtml(listMatch[1])}<span class="yml-value">${escapeHtml(listMatch[2])}</span>`;
        }

        const keyMatch = line.match(/^(\s*)([^:#][^:]*):(.*)$/);
        if (!keyMatch) return escapeHtml(line);

        return `${escapeHtml(keyMatch[1])}<span class="yml-key">${escapeHtml(keyMatch[2])}</span>:<span class="yml-value">${escapeHtml(keyMatch[3])}</span>`;
      })
      .join('\n');
  }

  function safeFilename(value, fallback = 'output') {
    const cleaned = String(value || fallback)
      .trim()
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-+|-+$/g, '');
    return cleaned || fallback;
  }

  function downloadText(text, filename, mimeType = 'text/yaml') {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => {
      anchor.remove();
      URL.revokeObjectURL(url);
    }, 100);
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Clipboard access is unavailable.');
  }

  function formatDateDMY(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${date.getUTCFullYear()}`;
  }

  function getItemLabel(item) {
    if (!item) return '';
    const id = item.id || 'Unknown ID';
    const version = item.version ? String(item.version).replace(/^v/i, '') : '—';
    return `${id} · ${version} · ${formatDateDMY(item.createdAt)}`;
  }

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

  window.VPS_UTILS = {
    escapeHtml,
    humanize,
    formatDate,
    isItemBroken,
    isExcludedVpxFormat,
    isVpuPatchItem,
    getParentId,
    getCategoryItems,
    getAssetState,
    getCoverUrl,
    normalizeArray,
    wrapText,
    buildYaml,
    highlightYaml,
    safeFilename,
    downloadText,
    copyText,
    getItemLabel,
    formatDateDMY,
    isMd5Hash,
    normalizeChecksumValue,
    extractArchiveDirectories
  };
})();
