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

  // -----------------------------------------------------------------------
  // Streaming RAR5 entry lister — walks the archive header-by-header using
  // `blob.slice()` reads so it never has to load the whole file into memory.
  // Required for archives larger than ~2 GB (Chrome's Blob.arrayBuffer limit).
  // -----------------------------------------------------------------------

  function readRarVint(bytes, offset) {
    let value = 0n;
    let shift = 0n;
    let pos = offset;
    while (pos < bytes.length) {
      const b = bytes[pos];
      pos += 1;
      value |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) return { value, next: pos };
      shift += 7n;
      if (shift > 63n) throw new Error('vint overflow');
    }
    throw new Error('vint truncated');
  }

  async function readSlice(blob, offset, length) {
    const buf = await blob.slice(offset, offset + length).arrayBuffer();
    return new Uint8Array(buf);
  }

  async function listRar5EntryPaths(blob) {
    if (!blob || typeof blob.slice !== 'function' || typeof blob.arrayBuffer !== 'function') return null;
    const total = blob.size;
    if (total < 8) return null;

    const sig = await readSlice(blob, 0, 8);
    const isRar5 = sig[0] === 0x52 && sig[1] === 0x61 && sig[2] === 0x72 && sig[3] === 0x21
                && sig[4] === 0x1A && sig[5] === 0x07 && sig[6] === 0x01 && sig[7] === 0x00;
    if (!isRar5) return null;

    const decoder = new TextDecoder('utf-8', { fatal: false });
    const entries = [];
    let offset = 8;
    let iterations = 0;
    const MAX_ITERATIONS = 200000;
    const MAX_HEADER_BYTES = 1024 * 1024;

    while (offset < total && iterations < MAX_ITERATIONS) {
      iterations += 1;

      let windowSize = 512;
      let bytes = await readSlice(blob, offset, Math.min(windowSize, total - offset));
      if (bytes.length < 5) break;

      let headerSize;
      let headerBodyStart;
      let attempts = 0;
      while (true) {
        try {
          const info = readRarVint(bytes, 4);
          headerSize = Number(info.value);
          headerBodyStart = info.next;
          break;
        } catch (_) {
          attempts += 1;
          if (attempts > 3) return entries;
          windowSize *= 4;
          if (windowSize > MAX_HEADER_BYTES) return entries;
          bytes = await readSlice(blob, offset, Math.min(windowSize, total - offset));
          if (bytes.length < 5) return entries;
        }
      }

      const headerEnd = headerBodyStart + headerSize;
      if (headerSize < 0 || headerEnd > MAX_HEADER_BYTES) return entries;

      if (headerEnd > bytes.length) {
        const need = Math.min(headerEnd, total - offset);
        bytes = await readSlice(blob, offset, need);
        if (bytes.length < headerEnd) return entries;
      }

      let pos = headerBodyStart;
      let headerType;
      let headerFlags;
      let dataSize = 0;
      try {
        const typeInfo = readRarVint(bytes, pos); pos = typeInfo.next;
        const flagsInfo = readRarVint(bytes, pos); pos = flagsInfo.next;
        headerType = Number(typeInfo.value);
        headerFlags = Number(flagsInfo.value);
        if (headerFlags & 0x01) {
          const extraInfo = readRarVint(bytes, pos); pos = extraInfo.next;
        }
        if (headerFlags & 0x02) {
          const dataInfo = readRarVint(bytes, pos); pos = dataInfo.next;
          const raw = dataInfo.value;
          dataSize = raw > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(raw);
        }
      } catch (_) {
        return entries;
      }

      if (headerType === 2) {
        try {
          const fileFlagsInfo = readRarVint(bytes, pos); pos = fileFlagsInfo.next;
          const fileFlags = Number(fileFlagsInfo.value);
          const unpackedInfo = readRarVint(bytes, pos); pos = unpackedInfo.next;
          const attrInfo = readRarVint(bytes, pos); pos = attrInfo.next;
          if (fileFlags & 0x02) pos += 4;
          if (fileFlags & 0x04) pos += 4;
          const compInfo = readRarVint(bytes, pos); pos = compInfo.next;
          const hostOsInfo = readRarVint(bytes, pos); pos = hostOsInfo.next;
          const nameLenInfo = readRarVint(bytes, pos); pos = nameLenInfo.next;
          const nameLen = Number(nameLenInfo.value);
          if (nameLen > 0 && pos + nameLen <= bytes.length) {
            const name = decoder.decode(bytes.subarray(pos, pos + nameLen));
            if (name) entries.push({ path: name });
          }
        } catch (_) { /* skip malformed entry */ }
      }

      if (headerType === 5) break;

      offset += headerEnd + dataSize;
    }

    return entries;
  }

  async function listArchiveEntryPaths(blob) {
    try {
      const rar5 = await listRar5EntryPaths(blob);
      if (rar5) return rar5;
    } catch (_) { /* fall through */ }
    return null;
  }

  window.VPS_ARCHIVE_PATHS = {
    extractArchiveDirectories,
    listArchiveEntryPaths
  };
})();
