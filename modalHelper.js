export function addYMLFieldInput(field, grid) {
  const label = document.createElement('label');
  label.className = 'modal-field-label tight';
  label.textContent = field.name;
  label.setAttribute('for', 'modal-input-' + field.name);

  let input;
  if (field.type === 'bool') {
    input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'modal-input modal-input-bool';
    input.id = 'modal-input-' + field.name;
    input.name = field.name;
    input.style.width = "18px";
    input.style.height = "18px";
    input.style.margin = "0 5px 0 0";
    const boolWrap = document.createElement('div');
    boolWrap.style.display = "flex";
    boolWrap.style.alignItems = "center";
    boolWrap.appendChild(input);
    boolWrap.appendChild(label);
    grid.appendChild(boolWrap);
    return;
  } else if (field.type === 'array') {
    input = document.createElement('textarea');
    input.className = 'modal-input modal-input-array';
    input.rows = 2;
    input.placeholder = "One item per line";
    input.id = 'modal-input-' + field.name;
    input.name = field.name;
  } else if (field.type === 'int') {
    input = document.createElement('input');
    input.type = 'number';
    input.className = 'modal-input modal-input-int';
    input.id = 'modal-input-' + field.name;
    input.name = field.name;
    input.style.width = "70px";
  } else if (field.type === 'str' && field.multiline) {
    input = document.createElement('textarea');
    input.className = 'modal-input modal-input-multiline';
    input.rows = 2;
    input.id = 'modal-input-' + field.name;
    input.name = field.name;
  } else {
    input = document.createElement('input');
    input.type = 'text';
    input.className = 'modal-input';
    input.id = 'modal-input-' + field.name;
    input.name = field.name;
  }

  const fieldWrap = document.createElement('div');
  fieldWrap.className = 'modal-field-wrap';
  fieldWrap.appendChild(label);
  fieldWrap.appendChild(input);
  grid.appendChild(fieldWrap);
}
