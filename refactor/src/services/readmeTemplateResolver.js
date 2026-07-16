(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const TEMPLATE_PATHS = Object.freeze({
    manual: '/refactor/templates/readme/man_README.md',
    wizard: '/refactor/templates/readme/wiz_README.md'
  });
  const SOURCE_ROUTES = new Map([
    ['https://raw.githubusercontent.com/TheOminousOsie/VPXS_4KP_Readme_Gen/main/Content/man_README.md', TEMPLATE_PATHS.manual],
    ['https://raw.githubusercontent.com/TheOminousOsie/VPXS_4KP_Readme_Gen/main/Content/wiz_README.md', TEMPLATE_PATHS.wizard]
  ]);

  function requestUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return input?.url || '';
  }

  function resolve(input) {
    return SOURCE_ROUTES.get(requestUrl(input)) || requestUrl(input);
  }

  window.fetch = function fetchWithVendoredReadmeTemplates(input, init) {
    const routed = SOURCE_ROUTES.get(requestUrl(input));
    return routed ? nativeFetch(routed, init) : nativeFetch(input, init);
  };

  window.VPS_README_TEMPLATE_RESOLVER = Object.freeze({
    paths: TEMPLATE_PATHS,
    resolve,
    fetchTemplate: mode => nativeFetch(TEMPLATE_PATHS[mode], { cache: 'no-cache' })
  });
})();