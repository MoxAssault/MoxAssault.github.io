(() => {
  'use strict';

  const TARGET_SELECTOR = [
    '#previewStatusDot[title]',
    '.asset-badge[title]'
  ].join(',');

  function migrateTooltip(element) {
    if (!(element instanceof Element)) return;

    const text = element.getAttribute('title');
    if (!text) return;

    if (element.matches('.asset-badge') && !element.dataset.tooltip) {
      element.dataset.tooltip = text.replace(/\s*\n+\s*/g, ' ').trim();
    }

    element.removeAttribute('title');
  }

  function cleanTooltips(root = document) {
    if (root instanceof Element && root.matches(TARGET_SELECTOR)) {
      migrateTooltip(root);
    }

    root.querySelectorAll?.(TARGET_SELECTOR).forEach(migrateTooltip);
  }

  function start() {
    cleanTooltips();

    if (typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === 'attributes') {
          migrateTooltip(record.target);
          return;
        }

        record.addedNodes.forEach(node => {
          if (node instanceof Element) cleanTooltips(node);
        });
      });
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['title']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
