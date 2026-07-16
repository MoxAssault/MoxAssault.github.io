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

  function safeFilename(value, fallback = 'output') {
    const cleaned = String(value || fallback)
      .trim()
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-+|-+$/g, '');
    return cleaned || fallback;
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

  window.VPS_FORMATTING = {
    escapeHtml,
    humanize,
    formatDate,
    normalizeArray,
    wrapText,
    safeFilename,
    formatDateDMY,
    getItemLabel
  };
})();
