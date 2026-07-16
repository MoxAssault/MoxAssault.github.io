(() => {
  'use strict';

  const nativeSetTimeout = window.setTimeout.bind(window);
  const serialDelays = new Set([1200, 1800, 2200, 2600]);
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

  window.VPS_SMOKE_COORDINATOR = Object.freeze({
    enqueue,
    wait,
    whenIdle: () => queue,
    getScheduledSectionCount: () => scheduledSections
  });
})();
