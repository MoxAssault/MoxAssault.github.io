(() => {
  'use strict';

  const runtime = window.VPS_FEATURE_RUNTIME;
  const utils = window.VPS_UTILS;
  if (!runtime || !utils) return;

  const ALLOWED = ['.zip', '.rar', '.7z'];
  let archiveModulePromise = null;
  let frame = 0;

  function extension(name) {
    return String(name || '').toLowerCase().match(/\.[^.]+$/)?.[0] || '';
  }

  function md5(buffer) {
    const bytes = new Uint8Array(buffer);
    const length = bytes.length;
    const total = (((length + 8) >>> 6) + 1) * 64;
    const data = new Uint8Array(total);
    data.set(bytes);
    data[length] = 0x80;
    const view = new DataView(data.buffer);
    const bits = length * 8;
    view.setUint32(total - 8, bits >>> 0, true);
    view.setUint32(total - 4, Math.floor(bits / 0x100000000), true);
    const shifts = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
    const constants = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0);
    const rotate = (value, amount) => ((value << amount) | (value >>> (32 - amount))) >>> 0;
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let offset = 0; offset < total; offset += 64) {
      const words = Array.from({ length: 16 }, (_, index) => view.getUint32(offset + index * 4, true));
      let a = a0, b = b0, c = c0, d = d0;
      for (let index = 0; index < 64; index += 1) {
        let f, g;
        if (index < 16) { f = (b & c) | ((~b) & d); g = index; }
        else if (index < 32) { f = (d & b) | ((~d) & c); g = (5 * index + 1) % 16; }
        else if (index < 48) { f = b ^ c ^ d; g = (3 * index + 5) % 16; }
        else { f = c ^ (b | (~d)); g = (7 * index) % 16; }
        const previousD = d;
        d = c; c = b;
        b = (b + rotate((a + f + constants[index] + words[g]) >>> 0, shifts[index])) >>> 0;
        a = previousD;
      }
      a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
    }
    return [a0, b0, c0, d0].map(value => [0,8,16,24].map(shift => ((value >>> shift) & 255).toString(16).padStart(2, '0')).join('')).join('');
  }

  function loadArchive() {
    if (!archiveModulePromise) {
      const moduleUrl = new URL('vendor/libarchive/libarchive.js', document.baseURI).href;
      const workerUrl = new URL('vendor/libarchive/worker-bundle.js', document.baseURI).href;
      archiveModulePromise = import(moduleUrl).then(module => {
        module.Archive.init({ workerUrl });
        return module.Archive;
      });
    }
    return archiveModulePromise;
  }

  async function directories(file) {
    const Archive = await loadArchive();
    const archive = await Archive.open(file);
    try {
      return utils.extractArchiveDirectories(await archive.getFilesArray());
    } finally {
      try { await archive.close(); } catch (_) { /* worker already closed */ }
    }
  }

  function values() { return runtime.state.values || {}; }
  function update(key, value, definition = {}) {
    runtime.state.callbacks?.onChange?.(key, value, { yml_field: key, ...definition });
  }

  function directoryHolder() {
    const grid = document.querySelector('#config-panel-altSound > .field-grid-altSound');
    if (!grid) return null;
    let holder = grid.querySelector(':scope > .field-alt-sound-directory');
    if (!holder) {
      holder = document.createElement('div');
      holder.className = 'field field-wide field-alt-sound-directory';
      grid.appendChild(holder);
    }
    return holder;
  }

  function populateDirectorySelect() {
    const root = document.getElementById('field-altSoundArchiveRoot');
    const holder = directoryHolder();
    if (!root || !holder) return;
    let select = holder.querySelector('.alt-sound-directory-select');
    if (!select) {
      select = document.createElement('select');
      select.className = 'archive-directory-select alt-sound-directory-select';
      select.setAttribute('aria-label', 'Choose Alt Sound archive directory');
      select.addEventListener('change', () => {
        if (!select.value) return;
        root.value = select.value;
        update('altSoundArchiveRoot', select.value, { type: 'str' });
      });
      holder.appendChild(select);
    }
    const list = Array.isArray(values().__altSoundArchiveDirectories) ? values().__altSoundArchiveDirectories : [];
    const desired = ['', ...list];
    const current = [...select.options].map(option => option.value);
    if (current.length !== desired.length || current.some((item, index) => item !== desired[index])) {
      select.replaceChildren(new Option(list.length ? `Choose from ${list.length} archive director${list.length === 1 ? 'y' : 'ies'}…` : 'Drop an Alt Sound archive to browse directories', ''));
      list.forEach(item => select.add(new Option(item, item)));
    }
    select.disabled = list.length === 0;
  }

  function decorateChecksum() {
    const input = document.getElementById('field-altSoundChecksum');
    const wrapper = input?.closest('.field');
    if (!input || !wrapper) return;
    input.placeholder = 'Alt Sound Checksum(s)';
    wrapper.classList.add('checksum-drop-field', 'field-alt-sound-checksum');
    let status = wrapper.querySelector(':scope > .checksum-drop-status');
    if (!status) {
      status = document.createElement('span');
      status.className = 'checksum-drop-status';
      status.innerHTML = '<span class="checksum-loading-track" aria-hidden="true"><span class="checksum-loading-dot"></span></span><span class="checksum-drop-hint">Drop .zip / .rar / .7z file to calculate MD5 and browse folders</span>';
      wrapper.appendChild(status);
    }
    if (wrapper.dataset.altSoundBound === 'true') return;
    wrapper.dataset.altSoundBound = 'true';
    const hint = status.querySelector('.checksum-drop-hint');
    ['dragenter', 'dragover'].forEach(type => wrapper.addEventListener(type, event => {
      event.preventDefault();
      wrapper.classList.add('checksum-drop-active');
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }));
    wrapper.addEventListener('dragleave', event => {
      if (!wrapper.contains(event.relatedTarget)) wrapper.classList.remove('checksum-drop-active');
    });
    wrapper.addEventListener('drop', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      wrapper.classList.remove('checksum-drop-active');
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      const ext = extension(file.name);
      if (!ALLOWED.includes(ext)) {
        hint.textContent = `Invalid file type. Allowed: ${ALLOWED.join(', ')}`;
        hint.classList.add('error');
        return;
      }
      hint.classList.remove('error');
      hint.textContent = `Processing ${file.name}…`;
      wrapper.classList.add('checksum-is-loading');
      const [checksumResult, directoryResult] = await Promise.allSettled([file.arrayBuffer().then(md5), directories(file)]);
      const messages = [];
      if (checksumResult.status === 'fulfilled') {
        input.value = checksumResult.value;
        update('altSoundChecksum', checksumResult.value, { type: 'array' });
        const sources = { ...(values().__checksumSources || {}) };
        sources.altSoundChecksum = { name: file.name, extension: ext };
        update('__checksumSources', sources, { uiOnly: true });
        messages.push('MD5 calculated');
      } else {
        messages.push('MD5 failed');
        hint.classList.add('error');
      }
      if (directoryResult.status === 'fulfilled') {
        const list = directoryResult.value || [];
        update('__altSoundArchiveDirectories', list, { uiOnly: true });
        populateDirectorySelect();
        messages.push(list.length ? `${list.length} director${list.length === 1 ? 'y' : 'ies'} loaded` : 'no directories found');
      } else {
        messages.push('directory browse failed');
        hint.classList.add('error');
      }
      hint.textContent = `${messages.join(' · ')} from ${file.name}`;
      wrapper.classList.remove('checksum-is-loading');
      window.VPS_FEATURE_VALIDATION?.refresh?.();
    });
  }

  function apply() {
    frame = 0;
    if (!document.getElementById('config-panel-altSound')) return;
    decorateChecksum();
    populateDirectorySelect();
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(apply);
  }

  document.addEventListener('input', schedule, true);
  document.addEventListener('change', schedule, true);
  document.addEventListener('click', schedule, true);
  if (typeof MutationObserver !== 'undefined') new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.VPS_ALT_SOUND_ARCHIVE = Object.freeze({ refresh: schedule, md5 });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();