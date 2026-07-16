(() => {
  'use strict';

  function stripInlineComment(value) {
    let single = false;
    let double = false;
    let escaped = false;

    for (let index = 0; index < value.length; index += 1) {
      const char = value[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\' && double) {
        escaped = true;
        continue;
      }
      if (char === "'" && !double) single = !single;
      else if (char === '"' && !single) double = !double;
      else if (char === '#' && !single && !double && (index === 0 || /\s/.test(value[index - 1]))) {
        return value.slice(0, index).trimEnd();
      }
    }

    return value.trimEnd();
  }

  function parseQuotedScalar(value) {
    if (value.startsWith('"')) {
      if (!value.endsWith('"')) throw new Error('A double-quoted YAML value is not closed.');
      try {
        return JSON.parse(value);
      } catch (_) {
        return value.slice(1, -1)
          .replace(/\\"/g, '"')
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\');
      }
    }

    if (value.startsWith("'")) {
      if (!value.endsWith("'")) throw new Error('A single-quoted YAML value is not closed.');
      return value.slice(1, -1).replace(/''/g, "'");
    }

    return null;
  }

  function splitFlowSequence(value) {
    const body = value.slice(1, -1).trim();
    if (!body) return [];

    const output = [];
    let token = '';
    let single = false;
    let double = false;
    let escaped = false;

    for (const char of body) {
      if (escaped) {
        token += char;
        escaped = false;
        continue;
      }
      if (char === '\\' && double) {
        token += char;
        escaped = true;
        continue;
      }
      if (char === "'" && !double) single = !single;
      else if (char === '"' && !single) double = !double;

      if (char === ',' && !single && !double) {
        output.push(parseScalar(token.trim()));
        token = '';
      } else {
        token += char;
      }
    }
    output.push(parseScalar(token.trim()));
    return output;
  }

  function parseScalar(rawValue) {
    const value = stripInlineComment(String(rawValue || '').trim());
    if (!value) return '';

    const quoted = parseQuotedScalar(value);
    if (quoted !== null) return quoted;
    if (value.startsWith('[') && value.endsWith(']')) return splitFlowSequence(value);
    if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
    if (/^(null|~)$/i.test(value)) return null;
    if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
    if (/^-?(?:\d+\.\d*|\d*\.\d+)$/.test(value)) return Number.parseFloat(value);
    return value;
  }

  function foldBlock(lines, literal) {
    if (literal) return lines.join('\n').replace(/\n+$/, '');

    const paragraphs = [];
    let current = [];
    lines.forEach(line => {
      if (line === '') {
        if (current.length) {
          paragraphs.push(current.join(' '));
          current = [];
        }
        paragraphs.push('');
      } else {
        current.push(line);
      }
    });
    if (current.length) paragraphs.push(current.join(' '));
    return paragraphs.join('\n').replace(/\n+$/, '');
  }

  function parseFlatYaml(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('The YML file is empty.');
    if (text.includes('\0')) throw new Error('The selected file does not appear to be plain-text YML.');

    const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
    const output = {};
    let index = 0;

    while (index < lines.length) {
      const rawLine = lines[index];
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed === '---' || trimmed === '...' || trimmed.startsWith('#')) {
        index += 1;
        continue;
      }

      if (/^\s/.test(rawLine)) {
        throw new Error(`Unexpected indentation near line ${index + 1}. Only top-level VPXS fields are supported.`);
      }

      const match = rawLine.match(/^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$/);
      if (!match) throw new Error(`Could not parse YML line ${index + 1}: ${trimmed}`);

      const key = match[1];
      const inlineValue = (match[2] || '').trim();
      if (Object.prototype.hasOwnProperty.call(output, key)) {
        throw new Error(`Duplicate YML field: ${key}`);
      }
      index += 1;

      if (/^[>|][+-]?$/.test(inlineValue)) {
        const literal = inlineValue.startsWith('|');
        const blockLines = [];
        while (index < lines.length && (/^\s/.test(lines[index]) || !lines[index].trim())) {
          const line = lines[index];
          if (!line.trim()) blockLines.push('');
          else blockLines.push(line.replace(/^ {2}/, ''));
          index += 1;
        }
        output[key] = foldBlock(blockLines, literal);
        continue;
      }

      if (!inlineValue) {
        const list = [];
        while (index < lines.length) {
          const listMatch = lines[index].match(/^\s+-\s*(.*)$/);
          if (!listMatch) break;
          list.push(parseScalar(listMatch[1]));
          index += 1;
        }
        output[key] = list.length ? list : '';
        continue;
      }

      output[key] = parseScalar(inlineValue);
    }

    return output;
  }

  window.VPS_YML_PARSER = Object.freeze({
    parseFlatYaml,
    parseScalar,
    stripInlineComment
  });
})();