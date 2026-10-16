'use strict';
// Drives the REAL presentErrorDot + the decorateCurrentFields sweep, sliced
// out of the shipped js.src/uiEnhancements.js at run time. Both moved there
// from featureValidationController.js on 2026-10-06, when one pass began
// drawing every error dot.

const fs = require('fs');
const { check, report, repoPath } = require('./harness');
const DOTS = repoPath('js.src', 'uiEnhancements.js');
const CSS_DIR = repoPath('css.src') + '/';

const all = [];

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = {};
    this._classes = new Set();
    this.mutations = 0;      // childList changes only
    all.push(this);
  }
  get className() { return [...this._classes].join(' '); }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() {
    const set = this._classes;
    return {
      add: (...c) => c.forEach(x => set.add(x)),
      remove: (...c) => c.forEach(x => set.delete(x)),
      contains: c => set.has(c)
    };
  }
  matches(selector) {
    return selector.split(',').map(s => s.trim().replace('.', '')).some(c => this._classes.has(c));
  }
  setAttribute(n, v) { this.attributes[n] = String(v); }
  getAttribute(n) { return this.attributes[n] ?? null; }
  removeAttribute(n) { delete this.attributes[n]; }
  querySelectorAll(selector) {
    const attr = selector.match(/^\[([\w-]+)="([^"]*)"\]$/);
    const found = [];
    const walk = node => node.children.forEach(child => {
      if (attr ? child.attributes[attr[1]] === attr[2] : child.matches(selector)) found.push(child);
      walk(child);
    });
    walk(this);
    return found;
  }
  appendChild(node) { node.parentElement = this; this.children.push(node); this.mutations += 1; return node; }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter(c => c !== this);
    this.parentElement.mutations += 1;
    this.parentElement = null;
  }
  querySelector(selector) {
    const want = selector.replace(':scope > ', '').replace('.', '');
    return this.children.find(c => c._classes.has(want)) || null;
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }
}

const documentStub = {
  createElement: tag => new El(tag),
  querySelectorAll: selector => {
    const want = selector.replace('.', '');
    return all.filter(node => node._classes.has(want) && node.parentElement);
  }
};

// ── slice the real functions ───────────────────────────────────────────────
const source = fs.readFileSync(DOTS, 'utf8');
const start = source.indexOf('  function presentErrorDot(wrapper, messages) {');
if (start < 0) throw new Error('presentErrorDot not found');
const end = source.indexOf('\n  }', start) + 4;
const presentBlock = source.slice(start, end);

const sweepStart = source.indexOf("    document.querySelectorAll('.feature-error-dot')");
if (sweepStart < 0) throw new Error('sweep not found');
const sweepBlock = source.slice(sweepStart, source.indexOf('\n    });', sweepStart) + 8);

const api = new Function('document',
  presentBlock + '\n function sweep() {\n' + sweepBlock + '\n }\n return { presentErrorDot, sweep };')(documentStub);

// restoreControlLabel through presentFeatureField, for the screen-reader half.
const fieldStart = source.indexOf('  function restoreControlLabel(control) {');
const fieldEnd = source.indexOf('  // Dot texts per field');
if (fieldStart < 0 || fieldEnd < 0) throw new Error('presentFeatureField block not found');
const fieldApi = new Function('document',
  source.slice(fieldStart, fieldEnd) + '\n return { presentFeatureField, clearFeaturePresentation };')(documentStub);


const field = (...classes) => { const n = new El('div'); n.className = ['field', ...classes].join(' '); return n; };
const dotOf = w => w.children.find(c => c._classes.contains ? false : c._classes.has('feature-error-dot')) || null;
const findDot = w => w.children.find(c => c.className.split(' ').includes('feature-error-dot')) || null;

// 1 ── a dot is created, carrying the message
{
  const w = field('checksum-drop-field', 'feature-has-field-error');
  api.presentErrorDot(w, ['Add a valid MD5 value for Alt Sound Checksum.']);
  const dot = findDot(w);
  check('a dot element is created', !!dot);
  check('dot carries the message', dot?.dataset.tooltip === 'Add a valid MD5 value for Alt Sound Checksum.');
  check('dot is labelled for screen readers',
    dot?.getAttribute('aria-label') === 'Add a valid MD5 value for Alt Sound Checksum.');
  check('dot is announced as an image', dot?.getAttribute('role') === 'img');
  check('dot is NOT class field-error-dot',
    dot && !dot.className.split(' ').includes('field-error-dot'),
    'legacy cleanup would delete it');
}

// 2 ── repeat passes must not churn the DOM (the loop hazard)
{
  const w = field('checksum-drop-field', 'feature-has-field-error');
  api.presentErrorDot(w, ['same message']);
  const first = findDot(w);
  const afterCreate = w.mutations;
  api.presentErrorDot(w, ['same message']);
  api.presentErrorDot(w, ['same message']);
  api.presentErrorDot(w, ['same message']);
  check('no second dot is created', w.children.filter(c => c.className.includes('feature-error-dot')).length === 1,
    'duplicate dots');
  check('same node reused', findDot(w) === first);
  check('no further DOM mutations across three passes', w.mutations === afterCreate,
    'mutations=' + w.mutations + ' after=' + afterCreate);
}

// 3 ── a changed message updates in place
{
  const w = field('checksum-drop-field', 'feature-has-field-error');
  api.presentErrorDot(w, ['first']);
  const dot = findDot(w);
  const afterCreate = w.mutations;
  api.presentErrorDot(w, ['second']);
  check('message updated', findDot(w)?.dataset.tooltip === 'second');
  check('updated on the same node', findDot(w) === dot);
  check('updating did not touch childList', w.mutations === afterCreate);
}

// 4 ── two messages join into one tooltip
{
  const w = field('feature-has-field-error');
  api.presentErrorDot(w, ['one.', 'two.']);
  check('messages joined', findDot(w)?.dataset.tooltip === 'one. two.');
}

// 5 ── the Additional ROM dot sits on the indicator, not on the header row
//      (until 2026-10-11 it was a pseudo-element on the whole row)
{
  const row = new El('summary');
  row.className = 'additional-rom-controls feature-has-field-error';
  const indicator = row.appendChild(new El('button'));
  indicator.className = 'additional-rom-indicator';
  const add = row.appendChild(new El('button'));
  add.className = 'additional-rom-add';
  api.presentErrorDot(row, ['one.', 'two.']);
  check('the header row gets no dot of its own', findDot(row) === null);
  check('the indicator gets the dot', findDot(indicator)?.dataset.tooltip === 'one. two.');
  check('the + button gets no dot while the indicator is there', findDot(add) === null);

  const bare = new El('summary');
  bare.className = 'additional-rom-controls feature-has-field-error';
  const onlyAdd = bare.appendChild(new El('button'));
  onlyAdd.className = 'additional-rom-add';
  api.presentErrorDot(bare, ['nope']);
  check('with no indicator the + button gets it', findDot(onlyAdd)?.dataset.tooltip === 'nope');

  api.sweep();
  check('the sweep keeps it while the row is in error', findDot(indicator) !== null);
  row.classList.remove('feature-has-field-error');
  api.sweep();
  check('the sweep removes it once the row clears', findDot(indicator) === null);
}

// 5b ── a screen reader hears the Additional ROM error from the indicator
//       (the dot is inside a button, whose children are not announced)
{
  const row = new El('details').appendChild(new El('summary'));   // the sweep only sees attached nodes
  row.className = 'additional-rom-controls';
  const indicator = row.appendChild(new El('button'));
  indicator.className = 'additional-rom-indicator';
  indicator.setAttribute('aria-label', 'Additional ROM: x. Activate to edit.');
  fieldApi.presentFeatureField(row, ['Select a ROM VPS ID.']);
  const dot = findDot(indicator);
  check('the indicator is described by its dot',
    !!dot?.id && indicator.getAttribute('aria-describedby') === dot.id);
  check('the indicator is marked invalid', indicator.getAttribute('aria-invalid') === 'true');
  check('the indicator keeps its own label', indicator.getAttribute('aria-label') === 'Additional ROM: x. Activate to edit.');
  fieldApi.clearFeaturePresentation();
  check('clearing drops the description', indicator.getAttribute('aria-describedby') === null);
  check('clearing drops the invalid mark', indicator.getAttribute('aria-invalid') === null);
  check('the row carries no dead error attributes',
    row.dataset.featureErrorMessage === undefined && row.dataset.featureErrorCount === undefined);
}

// 6 ── the sweep clears dots whose error is gone, and only those
{
  const stillBad = field('feature-has-field-error');
  const nowFixed = field('feature-has-field-error');
  api.presentErrorDot(stillBad, ['still wrong']);
  api.presentErrorDot(nowFixed, ['was wrong']);
  nowFixed.classList.remove('feature-has-field-error');   // clearPresentation()
  api.sweep();
  check('dot removed once the error clears', findDot(nowFixed) === null);
  check('dot kept while the error stands', findDot(stillBad) !== null);
}

// ── the CSS half: the new class must share every legacy rule ───────────────
{
  const read = f => fs.readFileSync(CSS_DIR + f, 'utf8');
  const uie = read('uiEnhancements.css');
  const v090 = read('v090.css');
  const fex = read('featureExtensions.css');

  check('dot shares the base appearance rule', /\.field-error-dot,\s*\n\.feature-error-dot \{/.test(uie));
  check('dot shares the tooltip rule', v090.includes('.feature-error-dot[data-tooltip]::before'));
  check('tooltip shows on dot hover', v090.includes('.feature-error-dot[data-tooltip]:hover::before'));
  check('dot anchors to the checksum input corner', fex.includes('.checksum-drop-field > .feature-error-dot'));
  check('the field-wide hover trigger is gone',
    !fex.includes('.field.feature-has-field-error:hover::before'),
    'hovering anywhere in the field still pops the tooltip');
  check('the field-wide pseudo tooltip is gone', !fex.includes('.field.feature-has-field-error::before'));
  check('the field-wide pseudo dot is gone', !fex.includes('.field.feature-has-field-error::after'));
  check('the header-row pseudo dot is gone',
    !fex.includes('.additional-rom-controls.feature-has-field-error::after'));
  check('the header-row hover trigger is gone',
    !fex.includes('.additional-rom-controls.feature-has-field-error:hover::before'),
    'hovering anywhere on the Advanced Config row still pops the tooltip');
  check('the dot is styled on the indicator',
    /\.additional-rom-indicator > \.feature-error-dot,\s*\.additional-rom-add > \.feature-error-dot \{/.test(fex));
  check('the indicator tooltip steps aside for the dot',
    fex.includes('.additional-rom-indicator:has(> .feature-error-dot:hover)::after'));
}

// ── the multi-error count pill is GONE, on purpose ─────────────────────────
// It painted a numbered red pill above any field with two or more errors. It
// spent most of its life painting an EMPTY pill (the count lived on the .field
// while attr() resolved against the dot), was fixed on 2026-08-26, and was then
// removed the same day: the dot alone says "there is a problem here", and the
// tooltip says what it is. Nothing should reintroduce data-error-count.
{
  const w = field('checksum-drop-field', 'feature-has-field-error');
  api.presentErrorDot(w, ['one', 'two', 'three']);
  const dot = findDot(w);
  check('a multi-error field still gets its dot', !!dot);
  check('the dot carries NO error count', dot?.dataset.errorCount === undefined,
    String(dot?.dataset.errorCount));
  check('the tooltip still carries every message', dot?.dataset.tooltip === 'one two three');

  const sources = [
    'js.src/uiEnhancements.js',
    'js.src/additionalRomsController.js',
    'js.src/v091Corrections.js'
  ];
  sources.forEach(rel => {
    const src = fs.readFileSync(repoPath(...rel.split('/')), 'utf8');
    check(`${rel} writes no error count`, !src.includes('dataset.errorCount'));
    check(`${rel} has no data-error-count cleanup left`, !src.includes('data-error-count'));
  });

  const uie = fs.readFileSync(CSS_DIR + 'uiEnhancements.css', 'utf8');
  check('no CSS rule reads the count', !uie.includes('attr(data-error-count)'));
  check('no CSS rule selects on the count', !uie.includes('[data-error-count]'));
  check('the dot itself is untouched by the removal', uie.includes('.feature-error-dot {'));
}

// ── the red tab alert dot is GONE too ──────────────────────────────────────
// A tab in error is red and carries an inset top strip. That is the signal; a
// separate dot on top of it was noise.
{
  const category = fs.readFileSync(CSS_DIR + 'category.css', 'utf8');
  check('no .config-tab-alert rule survives', !category.includes('.config-tab-alert'));
  check('the error tab is still coloured red', category.includes('.config-tab.has-error {'));
  check('the error tab still gets its inset strip',
    category.includes('inset 0 3px 0 var(--danger)'));
  check('the warning tab still gets its own colour', category.includes('.config-tab.has-warning {'));
  check('the ready tab is untouched', category.includes('.config-tab.has-ready'));

  ['js.src/uiHelper.js', 'js.src/main.js'].forEach(rel => {
    const src = fs.readFileSync(repoPath(...rel.split('/')), 'utf8');
    check(`${rel} builds no alert marker`, !src.includes('config-tab-alert'));
    check(`${rel} still sets the has-error class`, src.includes('has-${status.className}'));
  });
}

report('feature error dot');
