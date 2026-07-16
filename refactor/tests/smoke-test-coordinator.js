(() => {
  'use strict';

  let queue = Promise.resolve();

  function wait(milliseconds = 0) {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
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

  window.VPS_SMOKE_COORDINATOR = Object.freeze({
    enqueue,
    wait,
    whenIdle: () => queue
  });
})();
