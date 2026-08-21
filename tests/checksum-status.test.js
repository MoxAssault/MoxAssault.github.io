'use strict';
// Drives the REAL checksum status registry, sliced out of the shipped
// js.src/uiHelper.js at run time.

const fs = require('fs');
const { check, report, repoPath } = require('./harness');
const UI_PATH = repoPath('js.src', 'uiHelper.js');

// ── minimal DOM, with ids and closest() ────────────────────────────────────
const byId = new Map();

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this._classes = new Set();
    this._text = '';
    this._id = '';
  }
  get id() { return this._id; }
  set id(value) { this._id = value; byId.set(value, this); }
  get className() { return [...this._classes].join(' '); }
  set className(value) { this._classes = new Set(String(value).split(/\s+/).filter(Boolean)); }
  get classList() {
    const set = this._classes;
    return {
      add: (...c) => c.forEach(x => set.add(x)),
      remove: (...c) => c.forEach(x => set.delete(x)),
      contains: c => set.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !set.has(c) : !!force;
        if (on) set.add(c); else set.delete(c);
        return on;
      }
    };
  }
  get textContent() { return this._text; }
  set textContent(value) { this._text = String(value); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  appendChild(node) { node.parentNode = this; this.children.push(node); return node; }
  append(...nodes) { nodes.forEach(n => this.appendChild(n)); }
  closest(selector) {
    const want = selector.replace('.', '');
    let cursor = this;
    while (cursor) { if (cursor._classes.has(want)) return cursor; cursor = cursor.parentNode; }
    return null;
  }
  querySelector(selector) {
    const want = selector.replace('.', '');
    const walk = node => {
      for (const child of node.children) {
        if (child._classes.has(want)) return child;
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(this);
  }
}

const documentStub = { createElement: tag => new El(tag), getElementById: id => byId.get(id) || null };

function element(tag, className = '', text = '') {
  const node = documentStub.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null && text !== '') node.textContent = text;
  return node;
}

// ── slice the real source ──────────────────────────────────────────────────
const source = fs.readFileSync(UI_PATH, 'utf8');
const start = source.indexOf('  const checksumStatuses = new Map();');
if (start < 0) throw new Error('checksumStatuses not found in uiHelper.js');
const endMarker = '  function setChecksumStatus(fieldId, status) {';
const endAt = source.indexOf(endMarker);
if (endAt < 0) throw new Error('setChecksumStatus not found in uiHelper.js');
const block = source.slice(start, source.indexOf('\n  }', endAt) + 4);

const api = new Function('element', 'document',
  block + '\n return { checksumStatuses, paintChecksumStatus, applyChecksumStatus, setChecksumStatus };')(element, documentStub);


const FIELD = 'field-pupChecksum';

// Builds the field the way createFieldControl does, replacing any previous one
// for the same id — exactly what renderAccordions() does on a tab switch.
function renderField() {
  const wrapper = element('div', 'field checksum-drop-field');
  const input = element('input');
  input.id = FIELD;
  const status = element('span', 'checksum-drop-status');
  const hint = element('span', 'checksum-drop-hint', 'Drop .zip file to calculate MD5');
  status.append(hint);
  wrapper.append(input, status);
  // the restore call createFieldControl makes at build time
  api.paintChecksumStatus(wrapper, hint, api.checksumStatuses.get(FIELD));
  return { wrapper, hint };
}

const loading = w => w._classes.has('checksum-is-loading');

// 1 ── a drop paints the spinner and the message
{
  api.setChecksumStatus(FIELD, null);
  const first = renderField();
  api.setChecksumStatus(FIELD, { loading: true, message: 'Processing TheMatrixPup.zip…' });
  check('spinner class is set', loading(first.wrapper) === true);
  check('aria-busy is set', first.wrapper.getAttribute('aria-busy') === 'true');
  check('progress message is shown', first.hint.textContent === 'Processing TheMatrixPup.zip…');
}

// 2 ── THE BUG: a tab switch rebuilds the field mid-drop
{
  api.setChecksumStatus(FIELD, null);
  const before = renderField();
  api.setChecksumStatus(FIELD, { loading: true, message: 'Processing TheMatrixPup.zip…' });

  const after = renderField();          // tab away and back
  check('rebuilt field still shows the spinner', loading(after.wrapper) === true,
    'the animation vanished on tab change — this is the reported bug');
  check('rebuilt field still shows the message',
    after.hint.textContent === 'Processing TheMatrixPup.zip…', after.hint.textContent);
  check('the old detached field is irrelevant now', before.wrapper !== after.wrapper);
}

// 3 ── the job finishing reaches the NEW field, not the detached one
{
  api.setChecksumStatus(FIELD, null);
  const before = renderField();
  api.setChecksumStatus(FIELD, { loading: true, message: 'Processing TheMatrixPup.zip…' });
  const after = renderField();

  api.setChecksumStatus(FIELD, { message: 'MD5 calculated · 812 directories loaded from TheMatrixPup.zip' });
  check('spinner stops on the visible field', loading(after.wrapper) === false);
  check('result lands on the visible field',
    after.hint.textContent.startsWith('MD5 calculated'), after.hint.textContent);
  check('result did NOT go to the detached field',
    before.hint.textContent === 'Processing TheMatrixPup.zip…',
    'the completion handler wrote into the old node');
  check('aria-busy cleared', after.wrapper.getAttribute('aria-busy') === 'false');
}

// 4 ── errors carry the error class across a rebuild
{
  api.setChecksumStatus(FIELD, null);
  renderField();
  api.setChecksumStatus(FIELD, { message: 'MD5 failed', error: true });
  const after = renderField();
  check('error message survives the rebuild', after.hint.textContent === 'MD5 failed');
  check('error class survives the rebuild', after.hint._classes.has('error') === true);
  check('not spinning on an error', loading(after.wrapper) === false);
}

// 5 ── clearing the status stops a later rebuild repainting a stale message
{
  api.setChecksumStatus(FIELD, null);
  renderField();
  api.setChecksumStatus(FIELD, { loading: true, message: 'Processing lone.vni…' });
  api.setChecksumStatus(FIELD, null);                     // the lone .vni branch
  const after = renderField();
  check('cleared status leaves the default hint',
    after.hint.textContent === 'Drop .zip file to calculate MD5', after.hint.textContent);
  check('cleared status is not spinning', loading(after.wrapper) === false);
}

// 6 ── a field that is not on screen must not throw
{
  api.setChecksumStatus(FIELD, null);
  let threw = false;
  try { api.setChecksumStatus('field-thatDoesNotExist', { loading: true, message: 'x' }); }
  catch (_) { threw = true; }
  check('missing field does not throw', threw === false);
}

// 7 ── two fields keep separate status
{
  api.setChecksumStatus(FIELD, null);
  const pup = renderField();
  const secondary = (() => {
    const wrapper = element('div', 'field checksum-drop-field');
    const input = element('input');
    input.id = 'field-coloredROMChecksumSecondary';
    const status = element('span', 'checksum-drop-status');
    const hint = element('span', 'checksum-drop-hint', 'Drop .vni');
    status.append(hint);
    wrapper.append(input, status);
    return { wrapper, hint };
  })();

  api.setChecksumStatus(FIELD, { loading: true, message: 'Processing pup.zip…' });
  api.setChecksumStatus('field-coloredROMChecksumSecondary', { message: 'MD5 calculated (rom.vni)' });
  check('pup field still spinning', loading(pup.wrapper) === true);
  check('secondary field not spinning', loading(secondary.wrapper) === false);
  check('secondary message is its own', secondary.hint.textContent === 'MD5 calculated (rom.vni)');
  check('pup message is its own', pup.hint.textContent === 'Processing pup.zip…');
}

report('checksum status registry');
