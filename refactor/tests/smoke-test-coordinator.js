(() => {
  'use strict';

  const nativeSetTimeout = window.setTimeout.bind(window);
  const serialDelays = new Set([1200, 1800, 2200, 2600, 3000]);
  let queue = Promise.resolve();
  let scheduledSections = 0;
  let syntheticTimerId = -1;

  function wait(milliseconds = 0) {
    return new Promise(resolve => nativeSetTimeout(resolve, milliseconds));
  }

  function enqueue(name, task, options = {}) {
    const delay = Number.isFinite(options.delay) ? Math.max(0, options.delay) : 0;
    queue = queue.then(async () => {
      if (delay) await wait(delay);
      return task();
    }).catch(error => {
      console.error(`Smoke-test section failed: ${name}`, error);
    });
    return queue;
  }

  function installStoreTestFacade() {
    const frame = document.getElementById('appFrame');
    const appWindow = frame?.contentWindow;
    const originalStore = appWindow?.VPS_APP_STORE;
    if (!appWindow || !originalStore || originalStore.__smokeTestFacade === true) return;

    const facade = {
      ...originalStore,
      __smokeTestFacade: true,
      setBuild(next, options = {}) {
        if (options.source === 'smoke:store') {
          appWindow.VPS_PERSISTENCE_CONTROLLER?.stop?.();
        }
        return originalStore.setBuild(next, options);
      },
      replace(nextState, options = {}) {
        if (options.source !== 'smoke:restore') {
          return originalStore.replace(nextState, options);
        }

        const restored = originalStore.replace(nextState, {
          ...options,
          silent: true
        });

        queueMicrotask(() => {
          appWindow.VPS_PREVIEW_CONTROLLER?.renderNow?.();
          appWindow.VPS_VALIDATION_STATE?.validateNow?.();
          appWindow.VPS_PERSISTENCE_CONTROLLER?.start?.();
        });

        return restored;
      }
    };

    Object.defineProperty(appWindow, 'VPS_APP_STORE', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: Object.freeze(facade)
    });
  }

  window.setTimeout = function coordinatedSetTimeout(callback, delay = 0, ...args) {
    const normalizedDelay = Number(delay);
    if (typeof callback === 'function' && serialDelays.has(normalizedDelay)) {
      const sectionNumber = scheduledSections + 1;
      const sectionDelay = scheduledSections === 0 ? normalizedDelay : 75;
      scheduledSections += 1;
      enqueue(
        `section-${sectionNumber}`,
        () => callback(...args),
        { delay: sectionDelay }
      );
      return syntheticTimerId--;
    }
    return nativeSetTimeout(callback, delay, ...args);
  };

  const frame = document.getElementById('appFrame');
  if (frame) {
    frame.addEventListener('load', () => nativeSetTimeout(installStoreTestFacade, 0), { once: true });
  }

  window.VPS_SMOKE_COORDINATOR = Object.freeze({
    enqueue,
    wait,
    whenIdle: () => queue,
    getScheduledSectionCount: () => scheduledSections
  });
})();
