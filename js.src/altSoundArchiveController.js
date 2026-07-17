(() => {
  'use strict';

  const runtime = window.VPS_FEATURE_RUNTIME;
  const utils = window.VPS_UTILS;
  if (!runtime || !utils) return;

  const ALLOWED_EXTENSIONS = ['.zip', '.rar', '.7z'];
  let archiveModulePromise = null;
  let refreshFrame = 0;

  function getFileExtension(filename) {
    return String(filename || '').toLowerCase().match(/\.[^.]+$/)?.[0] || '';
  }

  function md5ArrayBuffer(buffer) {
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
    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;

    for (let offset = 0; offset < total; offset += 64) {
      const words = Array.from({ length: 16 }, (_, index) => view.getUint32(offset + index * 4, true));
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
          g = (5 * index + 1) % 16;
        } else if (index < 48) {
          f = b ^ c ^ d;
          g = (3 * index + 5) % 16;
        } else {
          f = c ^ (b | (~d));
          g = (7 * index) % 16;
        }
        const previousD = d;
        d = c;
        c = b;
        b = (b + rotate((a + f + constants[index] + words[g]) >>> 0, shifts[index])) >>> 0;
        a = previousD;
      }

      a0 = (a0 + a) >>> 0;
      b0 = (b0 + b) >>> 0;
      c0 = (c0 + c) >>> 0;
      d0 = (d0 + d) >>> 0;
    }

    return [a0, b0, c0, d0].map(value => [0, 8, 16, 24]
      .map(shift => ((value >>> shift) & 0xff).toString(16).padStart(2, '0')).join('')).join('');
  }

  function createMd5Worker() {
    const source = `self.onmessage=function(event){try{const bytes=new Uint8Array(event.data),length=bytes.length,total=(((length+8)>>>6)+1)*64,data=new Uint8Array(total);data.set(bytes);data[length]=128;const view=new DataView(data.buffer),bits=length*8;view.setUint32(total-8,bits>>>0,true);view.setUint32(total-4,Math.floor(bits/4294967296),true);const shifts=[7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21],constants=Array.from({length:64},(_,i)=>Math.floor(Math.abs(Math.sin(i+1))*4294967296)>>>0),rotate=(value,amount)=>((value<<amount)|(value>>>(32-amount)))>>>0;let a0=1732584193,b0=4023233417,c0=2562383102,d0=271733878;for(let offset=0;offset<total;offset+=64){const words=Array.from({length:16},(_,i)=>view.getUint32(offset+i*4,true));let a=a0,b=b0,c=c0,d=d0;for(let i=0;i<64;i++){let f,g;if(i<16){f=(b&c)|((~b)&d);g=i}else if(i<32){f=(d&b)|((~d)&c);g=(5*i+1)%16}else if(i<48){f=b^c^d;g=(3*i+5)%16}else{f=c^(b|(~d));g=(7*i)%16}const previousD=d;d=c;c=b;b=(b+rotate((a+f+constants[i]+words[g])>>>0,shifts[i]))>>>0;a=previousD}a0=(a0+a)>>>0;b0=(b0+b)>>>0;c0=(c0+c)>>>0;d0=(d0+d)>>>0}const checksum=[a0,b0,c0,d0].map(value=>[0,8,16,24].map(shift=>((value>>>shift)&255).toString(16).padStart(2,'0')).join('')).join('');self.postMessage({checksum})}catch(error){self.postMessage({error:error&&error.message?error.message:'MD5 calculation failed.'})}};`;
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    return worker;
  }

  function calculateMd5(buffer) {
    return new Promise((resolve, reject) => {
      if (typeof Worker === 'undefined') {
        window.setTimeout(() => {
          try { resolve(md5ArrayBuffer(buffer)); }
          catch (error) { reject(error); }
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

  function loadArchiveModule() {
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

  async function readDirectories(file) {
    const Archive = await loadArchiveModule();
    const archive = await Archive.open(file);
    try {
      return utils.extractArchiveDirectories(await archive.getFilesArray());
    } finally {
      try { await archive.close(); } catch (_) { /* worker may already be closed */ }
    }
  }

  function populateRootSelect() {
    const select = document.getElementById('field-altSoundArchiveRoot');
    if (!select) return;

    const directories = Array.isArray(runtime.state.values?.__altSoundArchiveDirectories)
      ? runtime.state.values.__altSoundArchiveDirectories
      : [];
    const currentValue = String(runtime.state.values?.altSoundArchiveRoot || select.value || '');
    const labels = directories.length
      ? [`Choose from ${directories.length} archive director${directories.length === 1 ? 'y' : 'ies'}…`]
      : ['Drop an Alt Sound archive to browse directories'];
    const desiredValues = ['', ...directories];
    const currentValues = [...select.options].map(option => option.value);

    if (currentValues.length !== desiredValues.length || currentValues.some((value, index) => value !== desiredValues[index])) {
      select.replaceChildren();
      select.add(new Option(labels[0], ''));
      directories.forEach(directory => select.add(new Option(directory, directory)));
    }

    select.disabled = directories.length === 0;
    if (currentValue && directories.includes(currentValue)) select.value = currentValue;
    else if (!currentValue) select.value = '';
  }

  function ensureDefaultFormat() {
    const { values, selections, callbacks } = runtime.state;
    if (!values || !callbacks) return;
    const active = Boolean(selections?.altSoundFiles || values.altSoundVPSId || values.altSoundBundled || values.altSoundUrlOverride);
    if (active && !values.altSoundArchiveFormat) {
      callbacks.onChange('altSoundArchiveFormat', 'zip', { yml_field: 'altSoundArchiveFormat', type: 'select' });
      return;
    }
    const select = document.getElementById('field-altSoundArchiveFormat');
    if (select && values.altSoundArchiveFormat && select.value !== values.altSoundArchiveFormat) {
      select.value = values.altSoundArchiveFormat;
    }
  }

  function checksumValues() {
    const value = runtime.state.values?.altSoundChecksum;
    return Array.isArray(value) ? value.map(String).filter(Boolean) : String(value || '');
  }

  function decorateChecksumField() {
    const input = document.getElementById('field-altSoundChecksum');
    const wrapper = input?.closest('.field');
    if (!input || !wrapper) return;

    const displayed = Array.isArray(checksumValues()) ? checksumValues().join(', ') : checksumValues();
    if (input.value !== displayed) input.value = displayed;
    input.placeholder = 'Alt Sound Checksum(s)';
    wrapper.classList.add('checksum-drop-field', 'field-alt-sound-checksum', 'field-checksum-standard');

    let status = wrapper.querySelector(':scope > .checksum-drop-status');
    if (!status) {
      status = document.createElement('span');
      status.className = 'checksum-drop-status';
      status.innerHTML = '<span class="checksum-loading-track" aria-hidden="true"><span class="checksum-loading-dot"></span></span><span class="checksum-drop-hint">Drop .zip / .rar / .7z file to calculate MD5 and browse folders</span>';
      wrapper.appendChild(status);
    }

    if (wrapper.dataset.altSoundArchiveBound === 'true') return;
    wrapper.dataset.altSoundArchiveBound = 'true';
    const hint = status.querySelector('.checksum-drop-hint');
    const setActive = active => wrapper.classList.toggle('checksum-drop-active', active);
    const setLoading = active => {
      wrapper.classList.toggle('checksum-is-loading', active);
      wrapper.setAttribute('aria-busy', active ? 'true' : 'false');
    };

    wrapper.addEventListener('dragenter', event => {
      event.preventDefault();
      setActive(true);
    });
    wrapper.addEventListener('dragover', event => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      setActive(true);
    });
    wrapper.addEventListener('dragleave', event => {
      if (!wrapper.contains(event.relatedTarget)) setActive(false);
    });
    wrapper.addEventListener('drop', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      setActive(false);
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;

      const extension = getFileExtension(file.name);
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        hint.textContent = `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
        hint.classList.add('error');
        return;
      }

      hint.classList.remove('error');
      hint.textContent = `Processing ${file.name}…`;
      setLoading(true);

      const checksumTask = file.arrayBuffer().then(calculateMd5);
      const directoryTask = readDirectories(file);
      const [checksumResult, directoryResult] = await Promise.allSettled([checksumTask, directoryTask]);
      const messages = [];

      if (checksumResult.status === 'fulfilled' && checksumResult.value) {
        input.value = checksumResult.value;
        runtime.state.callbacks?.onChange?.('altSoundChecksum', checksumResult.value, {
          yml_field: 'altSoundChecksum', type: 'array'
        });
        const sources = { ...(runtime.state.values?.__checksumSources || {}) };
        sources.altSoundChecksum = { name: file.name, extension };
        runtime.state.callbacks?.onChange?.('__checksumSources', sources, { uiOnly: true });
        messages.push('MD5 calculated');
      } else {
        messages.push('MD5 failed');
        hint.classList.add('error');
      }

      if (directoryResult.status === 'fulfilled') {
        const directories = directoryResult.value || [];
        runtime.state.callbacks?.onChange?.('__altSoundArchiveDirectories', directories, { uiOnly: true });
        populateRootSelect();
        messages.push(directories.length
          ? `${directories.length} director${directories.length === 1 ? 'y' : 'ies'} loaded`
          : 'no directories found');
      } else {
        messages.push('directory browse failed');
        hint.classList.add('error');
      }

      hint.textContent = `${messages.join(' · ')} from ${file.name}`;
      setLoading(false);
      window.VPS_FEATURE_VALIDATION?.refresh?.();
    }, true);
  }

  function apply() {
    refreshFrame = 0;
    decorateChecksumField();
    populateRootSelect();
    ensureDefaultFormat();
  }

  function schedule() {
    if (refreshFrame) return;
    refreshFrame = window.requestAnimationFrame(apply);
  }

  function init() {
    document.addEventListener('click', schedule, true);
    document.addEventListener('input', schedule, true);
    document.addEventListener('change', schedule, true);
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(schedule);
      observer.observe(document.getElementById('accordionStack') || document.body, { childList: true, subtree: true });
    }
    schedule();
  }

  window.VPS_ALT_SOUND_ARCHIVE = Object.freeze({
    calculateMd5,
    readDirectories,
    refresh: schedule
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();