function md5ArrayBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  const originalLength = bytes.length;
  const totalLength = (((originalLength + 8) >>> 6) + 1) * 64;
  const padded = new Uint8Array(totalLength);
  padded.set(bytes);
  padded[originalLength] = 0x80;

  const bitLength = originalLength * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(totalLength - 8, bitLength >>> 0, true);
  view.setUint32(totalLength - 4, Math.floor(bitLength / 0x100000000), true);

  const shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];
  const constants = Array.from(
    { length: 64 },
    (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0
  );
  const rotateLeft = (value, amount) => (
    ((value << amount) | (value >>> (32 - amount))) >>> 0
  );

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < totalLength; offset += 64) {
    const words = new Uint32Array(16);
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + (index * 4), true);
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let index = 0; index < 64; index += 1) {
      let f;
      let g;

      if (index < 16) {
        f = (b & c) | ((~b) & d);
        g = index;
      } else if (index < 32) {
        f = (d & b) | ((~d) & c);
        g = ((5 * index) + 1) % 16;
      } else if (index < 48) {
        f = b ^ c ^ d;
        g = ((3 * index) + 5) % 16;
      } else {
        f = c ^ (b | (~d));
        g = (7 * index) % 16;
      }

      const previousD = d;
      d = c;
      c = b;
      const roundValue = (a + f + constants[index] + words[g]) >>> 0;
      b = (b + rotateLeft(roundValue, shifts[index])) >>> 0;
      a = previousD;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  return [a0, b0, c0, d0]
    .map(value => [0, 8, 16, 24]
      .map(shift => ((value >>> shift) & 0xff).toString(16).padStart(2, '0'))
      .join(''))
    .join('');
}

function createMd5Worker() {
  // Streaming MD5 worker. Accepts incremental chunks so files larger than the
  // single-ArrayBuffer allocation limit (~2 GB in Chrome) can still be hashed.
  // Protocol:
  //   { type: 'init' }                       -> reset state
  //   { type: 'chunk', buffer: ArrayBuffer } -> feed bytes (transferable)
  //   { type: 'finish' }                     -> emit { checksum } or { error }
  const source = `
    'use strict';
    let a0, b0, c0, d0;
    let buffered = new Uint8Array(0);
    let totalLength = 0;
    const shifts = new Uint8Array([7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21]);
    const constants = new Uint32Array(64);
    for (let i = 0; i < 64; i += 1) constants[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
    function rotate(value, amount) { return ((value << amount) | (value >>> (32 - amount))) >>> 0; }
    function processBlocks(bytes, byteCount) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, byteCount);
      const words = new Uint32Array(16);
      for (let offset = 0; offset < byteCount; offset += 64) {
        for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4, true);
        let a = a0, b = b0, c = c0, d = d0;
        for (let i = 0; i < 64; i += 1) {
          let f, g;
          if (i < 16) { f = (b & c) | (~b & d); g = i; }
          else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) & 15; }
          else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) & 15; }
          else { f = c ^ (b | ~d); g = (7 * i) & 15; }
          const nextD = d;
          d = c; c = b;
          b = (b + rotate((a + f + constants[i] + words[g]) >>> 0, shifts[i])) >>> 0;
          a = nextD;
        }
        a0 = (a0 + a) >>> 0;
        b0 = (b0 + b) >>> 0;
        c0 = (c0 + c) >>> 0;
        d0 = (d0 + d) >>> 0;
      }
    }
    function reset() {
      a0 = 0x67452301; b0 = 0xefcdab89; c0 = 0x98badcfe; d0 = 0x10325476;
      buffered = new Uint8Array(0);
      totalLength = 0;
    }
    reset();
    self.onmessage = event => {
      try {
        const message = event.data;
        if (message && message.type === 'init') { reset(); return; }
        if (message && message.type === 'chunk') {
          const chunk = new Uint8Array(message.buffer);
          totalLength += chunk.length;
          let combined;
          if (buffered.length === 0) {
            combined = chunk;
          } else {
            combined = new Uint8Array(buffered.length + chunk.length);
            combined.set(buffered, 0);
            combined.set(chunk, buffered.length);
          }
          const completeBytes = combined.length - (combined.length % 64);
          if (completeBytes > 0) processBlocks(combined, completeBytes);
          const leftover = combined.subarray(completeBytes);
          buffered = leftover.length > 0 ? new Uint8Array(leftover) : new Uint8Array(0);
          return;
        }
        if (message && message.type === 'finish') {
          const bitLength = totalLength * 8;
          const remaining = buffered.length;
          const paddedLength = (((remaining + 8) >>> 6) + 1) * 64;
          const padded = new Uint8Array(paddedLength);
          padded.set(buffered);
          padded[remaining] = 0x80;
          const view = new DataView(padded.buffer);
          view.setUint32(paddedLength - 8, bitLength >>> 0, true);
          view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true);
          processBlocks(padded, paddedLength);
          const checksum = [a0, b0, c0, d0].map(value =>
            [0, 8, 16, 24].map(shift =>
              ((value >>> shift) & 0xff).toString(16).padStart(2, '0')).join('')).join('');
          self.postMessage({ checksum });
        }
      } catch (error) {
        self.postMessage({ error: error?.message || 'MD5 calculation failed.' });
      }
    };
  `;
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  return worker;
}

export function calculateMd5(input) {
  // Accepts a Blob/File (streamed) or an ArrayBuffer/typed array (wrapped).
  const blob = input instanceof Blob
    ? input
    : new Blob([input instanceof ArrayBuffer ? input : (input?.buffer || new ArrayBuffer(0))]);

  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined' || typeof blob.stream !== 'function') {
      blob.arrayBuffer()
        .then(buffer => resolve(md5ArrayBuffer(buffer)))
        .catch(reject);
      return;
    }

    const worker = createMd5Worker();
    let settled = false;
    const done = value => { if (settled) return; settled = true; worker.terminate(); resolve(value); };
    const fail = error => { if (settled) return; settled = true; worker.terminate(); reject(error); };

    worker.addEventListener('message', event => {
      if (event.data?.error) fail(new Error(event.data.error));
      else if (event.data?.checksum !== undefined) done(event.data.checksum);
    });
    worker.addEventListener('error', event => {
      fail(event.error || new Error(event.message || 'MD5 worker failed.'));
    });

    worker.postMessage({ type: 'init' });

    (async () => {
      let reader;
      try {
        reader = blob.stream().getReader();
        while (!settled) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          const buffer = (value.byteOffset === 0 && value.byteLength === value.buffer.byteLength)
            ? value.buffer
            : value.slice().buffer;
          worker.postMessage({ type: 'chunk', buffer }, [buffer]);
        }
        if (!settled) worker.postMessage({ type: 'finish' });
      } catch (error) {
        const sizeMb = blob?.size ? (blob.size / (1024 * 1024)).toFixed(1) : '?';
        const reason = error?.name === 'NotReadableError'
          ? `browser could not read the file (${sizeMb} MB) \u2014 file may be locked, on a slow drive, or the download is incomplete`
          : (error?.message || error?.name || 'unknown read error');
        fail(new Error(`MD5 read failed: ${reason}`));
      } finally {
        try { reader?.releaseLock?.(); } catch (_) { /* ignore */ }
      }
    })();
  });
}

let archiveModulePromise = null;

async function loadArchiveModule() {
  if (!archiveModulePromise) {
    const moduleUrl = new URL('/vendor/libarchive/libarchive.js', window.location.origin).href;
    const workerUrl = new URL('/vendor/libarchive/worker-bundle.js', window.location.origin).href;
    archiveModulePromise = import(moduleUrl).then(module => {
      module.Archive.init({ workerUrl });
      return module.Archive;
    });
  }
  return archiveModulePromise;
}

export async function readArchiveDirectories(file) {
  const archivePaths = window.VPS_ARCHIVE_PATHS;
  // Fast path: streaming header parsers (currently RAR5) work for archives of
  // any size — they never load the whole file into memory.
  try {
    const streamedEntries = await archivePaths?.listArchiveEntryPaths?.(file);
    if (streamedEntries && streamedEntries.length > 0) {
      return archivePaths.extractArchiveDirectories(streamedEntries);
    }
  } catch (error) {
    console.warn('Streaming archive parse failed, falling back to libarchive:', error);
  }

  const Archive = await loadArchiveModule();
  // Fallback path: libarchive.js. Requires the whole file in memory; will fail
  // for files larger than ~2 GB in Chrome.
  let source;
  try {
    const buffer = await file.arrayBuffer();
    source = new Blob([buffer], { type: file.type || 'application/octet-stream' });
  } catch (error) {
    const sizeMb = file?.size ? (file.size / (1024 * 1024)).toFixed(1) : '?';
    const reason = error?.name === 'NotReadableError'
      ? `archive is too large to browse in-browser (${sizeMb} MB) \u2014 enter the directory manually`
      : (error?.message || error?.name || 'unknown read error');
    const friendly = new Error(`Could not browse "${file?.name || 'archive'}": ${reason}.`);
    friendly.cause = error;
    throw friendly;
  }
  const archive = await Archive.open(source);
  try {
    const entries = await archive.getFilesArray();
    return archivePaths.extractArchiveDirectories(entries);
  } finally {
    try {
      await archive.close();
    } catch (_) {
      // The worker may already be closed.
    }
  }
}

export function getFileExtension(filename) {
  return String(filename || '').toLowerCase().match(/\.[^.]+$/)?.[0] || '';
}

function configuredExtensions(field, values) {
  if (field.checksumExtensionsByFlag) {
    const config = field.checksumExtensionsByFlag;
    const enabled = values[config.field] === true;
    return (config[String(enabled)] || []).map(extension => extension.toLowerCase());
  }
  return Array.isArray(field.checksumExtensions)
    ? field.checksumExtensions.map(extension => extension.toLowerCase())
    : [];
}

export function getChecksumExtensions(field, values = {}) {
  const allowed = configuredExtensions(field, values);
  const colorFields = ['coloredROMChecksum', 'coloredROMChecksumSecondary'];
  if (values.coloredROMPin2DMD !== true || !colorFields.includes(field.yml_field)) {
    return allowed;
  }

  const otherField = field.yml_field === colorFields[0] ? colorFields[1] : colorFields[0];
  const used = String(values.__checksumSources?.[otherField]?.extension || '').toLowerCase();
  return used ? allowed.filter(extension => extension !== used) : allowed;
}

export function populateDirectoryPicker(select, directories = []) {
  if (!select) return;
  select.replaceChildren();

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = directories.length
    ? `Choose from ${directories.length} archive director${directories.length === 1 ? 'y' : 'ies'}…`
    : 'Drop a PUP Pack archive to browse directories';
  select.appendChild(placeholder);

  directories.forEach(directory => {
    const option = document.createElement('option');
    option.value = directory;
    option.textContent = directory;
    select.appendChild(option);
  });
  select.disabled = directories.length === 0;
}

export function attachChecksumDrop({ wrapper, input, field, values, onChange, statusRow, dropHint }) {
  const setDropState = active => wrapper.classList.toggle('checksum-drop-active', active);
  const setLoading = active => {
    wrapper.classList.toggle('checksum-is-loading', active);
    wrapper.setAttribute('aria-busy', active ? 'true' : 'false');
  };

  wrapper.addEventListener('dragenter', event => {
    if (input.disabled) return;
    event.preventDefault();
    setDropState(true);
  });

  wrapper.addEventListener('dragover', event => {
    if (input.disabled) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDropState(true);
  });

  wrapper.addEventListener('dragleave', event => {
    if (!wrapper.contains(event.relatedTarget)) setDropState(false);
  });

  wrapper.addEventListener('drop', async event => {
    if (input.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    setDropState(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    const extension = getFileExtension(file.name);
    const currentAllowed = getChecksumExtensions(field, values);
    if (!currentAllowed.includes(extension)) {
      dropHint.textContent = `Invalid file type. Allowed: ${currentAllowed.join(', ') || 'none'}`;
      dropHint.classList.add('error');
      return;
    }

    dropHint.classList.remove('error');
    dropHint.textContent = `Processing ${file.name}…`;
    setLoading(true);

    try {
      const checksumTask = calculateMd5(file);
      const archiveTask = field.archiveBrowser
        ? readArchiveDirectories(file)
        : Promise.resolve(null);
      const [checksumResult, archiveResult] = await Promise.allSettled([
        checksumTask,
        archiveTask
      ]);
      const messages = [];

      if (checksumResult.status === 'fulfilled' && checksumResult.value) {
        input.value = checksumResult.value;
        onChange(field.yml_field, checksumResult.value, field);
        const sources = { ...(values.__checksumSources || {}) };
        sources[field.yml_field] = { name: file.name, extension };
        onChange('__checksumSources', sources, { uiOnly: true });
        messages.push('MD5 calculated');
      } else {
        const reason = checksumResult.reason?.message || 'MD5 failed';
        messages.push(reason);
        dropHint.classList.add('error');
        console.warn('MD5 failed:', checksumResult.reason);
      }

      if (field.archiveBrowser) {
        if (archiveResult.status === 'fulfilled') {
          const directories = archiveResult.value || [];
          onChange('__pupArchiveDirectories', directories, { uiOnly: true });
          populateDirectoryPicker(
            document.getElementById('field-pupArchiveRoot-directory-select'),
            directories
          );
          messages.push(directories.length
            ? `${directories.length} director${directories.length === 1 ? 'y' : 'ies'} loaded`
            : 'no directories found');
        } else {
          const reason = archiveResult.reason?.message || 'directory browse failed';
          messages.push(reason);
          dropHint.classList.add('error');
          console.warn('Archive browse failed:', archiveResult.reason);
        }
      }

      dropHint.textContent = `${messages.join(' · ')} from ${file.name}`;
    } catch (error) {
      dropHint.classList.add('error');
      dropHint.textContent = error?.message || `Unable to process ${file.name}`;
    } finally {
      setLoading(false);
    }
  });

  wrapper.append(input, statusRow);
}

window.VPS_CHECKSUM_TOOLS = Object.freeze({
  calculateMd5,
  readArchiveDirectories,
  getFileExtension,
  getChecksumExtensions,
  populateDirectoryPicker,
  attachChecksumDrop
});
