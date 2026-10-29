// The Legends Unchained images (2026-10-28, Jason): the wordmark replaced the
// lightning bolt beside the header title, and the wizard replaced the bolt in
// the main page's empty-state tile. Both are copies in images/, prepared from
// Jason's originals: the wordmark's canvas trimmed to the drawing, the wizard
// a real 128px PNG (the original was a 1108px PNG wrapped in an SVG).
//
// Runs the real app in headless Chrome.

import { check, report } from './harness.mjs';
import { openApp } from './browser.mjs';

const app = await openApp({ windowSize: [1400, 900] });

const seen = await app.run(async () => {
  const wait = img => img.complete ? Promise.resolve() : new Promise(resolve => img.addEventListener('load', resolve, { once: true }));
  const logo = document.querySelector('.brand .brand-logo');
  const wizard = document.querySelector('#emptyState .empty-state-icon img');
  await Promise.all([logo, wizard].filter(Boolean).map(wait));
  const box = img => img ? { loaded: img.complete && img.naturalWidth > 0, alt: img.getAttribute('alt'), height: Math.round(img.getBoundingClientRect().height) } : null;
  return {
    logo: box(logo),
    wizard: box(wizard),
    tileHidden: document.querySelector('#emptyState .empty-state-icon')?.getAttribute('aria-hidden'),
    brandLabel: document.querySelector('.brand')?.getAttribute('aria-label'),
    title: document.querySelector('.brand > span')?.textContent,
    tabTitle: document.title,
    icon: await (async () => {
      const link = document.querySelector('link[rel="icon"]');
      if (!link) return null;
      const response = await fetch(link.href);
      return { href: link.getAttribute('href'), ok: response.ok, type: response.headers.get('content-type') };
    })(),
    footer: document.querySelector('.site-footer > span')?.textContent,
    bolts: (document.body.textContent.match(/⚡/g) || []).length
  };
});
const shown = JSON.stringify(seen);
check('the header wordmark loads', seen.logo?.loaded === true, shown);
check('the wordmark is 34px tall beside the title at desktop width', seen.logo?.height === 34, shown);
check('the wordmark is decorative: the link already names the page', seen.logo?.alt === '' && seen.brandLabel === 'YML Builder home', shown);
check('the empty-state wizard loads', seen.wizard?.loaded === true, shown);
check('the wizard is decorative', seen.wizard?.alt === '' && seen.tileHidden === 'true', shown);
check('the header reads "YML Builder" (Jason, 2026-10-28: VPXS dropped)', seen.title === 'YML Builder', shown);
check('the tab title and the footer read "LU YML Builder"', seen.tabTitle === 'LU YML Builder' && seen.footer === 'LU YML Builder', shown);
check('the tab icon is the wizard, and it loads', seen.icon?.href === 'images/legends-unchained-wizard.png' && seen.icon?.ok === true && /png/.test(seen.icon?.type || ''), shown);
check('no lightning bolt is left on the page', seen.bolts === 0, shown);
check('no page errors', app.errors.filter(error => !/Unable to preload the VPS database/.test(error)).length === 0, app.errors.join('\n'));

await app.close();
report('brand-images');
