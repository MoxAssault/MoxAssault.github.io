(() => {
  'use strict';

  const store = window.VPS_APP_STORE;
  const validationState = window.VPS_VALIDATION_STATE;
  if (!store || !validationState) return;

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function render(result = store.getSnapshot().validation) {
    const body = document.getElementById('validationBody');
    if (!body) return result;

    body.replaceChildren();
    const list = document.createElement('ul');
    list.className = 'validation-list';
    const entries = [...(result?.errors || []), ...(result?.warnings || [])];

    if (!entries.length) {
      const item = document.createElement('li');
      item.className = 'validation-item success';

      const title = document.createElement('strong');
      title.textContent = 'Everything looks good.';

      const message = document.createElement('span');
      message.textContent = 'The build is ready to copy or download.';

      item.append(title, message);
      list.appendChild(item);
    } else {
      entries.forEach(entry => {
        const item = document.createElement('li');
        item.className = `validation-item ${entry.type || 'error'}`;

        const title = document.createElement('strong');
        title.textContent = entry.title || 'Validation issue';

        const message = document.createElement('span');
        message.textContent = entry.message || '';

        item.append(title, message);
        list.appendChild(item);
      });
    }

    body.appendChild(list);
    return result;
  }

  function validate() {
    return validationState.validateNow();
  }

  function show(result = validate()) {
    render(result);
    openDialog(document.getElementById('validationDialog'));
    return result;
  }

  function hasErrors(result = store.getSnapshot().validation) {
    return Array.isArray(result?.errors) && result.errors.length > 0;
  }

  function firstError(result = store.getSnapshot().validation) {
    return result?.errors?.[0] || null;
  }

  window.VPS_VALIDATION_DIALOG = Object.freeze({
    validate,
    render,
    show,
    hasErrors,
    firstError
  });
})();
