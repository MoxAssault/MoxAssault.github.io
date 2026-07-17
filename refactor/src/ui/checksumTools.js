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
  const source = `
    const md5ArrayBuffer = ${md5ArrayBuffer.toString()};
    self.onmessage = event => {
      try {
        self.postMessage({ checksum: md5ArrayBuffer(event.data) });
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

export function calculateMd5(buffer) {
  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined') {
      window.setTimeout(() => {
        try {
          resolve(md5ArrayBuffer(buffer));
        } catch (error) {
          reject(error);
        }
      }, 0);
      return;
    }

    const worker = createMd5Worker();
    const cleanup = () => worker.terminate();

    worker.addEventListener('message', event => {
      cleanup();
      if (event.data?.error) reject(new Error(event.data.error));
      else resolve(event.data?.checksum || '');
    }, { once: true });

    worker.addEventListener('error', event => {
      cleanup();
      reject(event.error || new Error(event.message || 'MD5 worker failed.'));
    }, { once: true });

    worker.postMessage(buffer, [buffer]);
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
  const Archive = await loadArchiveModule();
  const archive = await Archive.open(file);
  try {
    const entries = await archive.getFilesArray();
    return window.VPS_ARCHIVE_PATHS.extractArchiveDirectories(entries);
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
      const checksumTask = file.arrayBuffer().then(calculateMd5);
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
        messages.push('MD5 failed');
        dropHint.classList.add('error');
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
          messages.push('directory browse failed');
          dropHint.classList.add('error');
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
