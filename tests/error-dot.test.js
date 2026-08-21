'use strict';
// Drives the REAL presentErrorDot + the refresh() sweep, sliced out of the
// shipped js.src/featureValidationController.js at run time.

const fs = require('fs');
const { check, report, repoPath } = require('./harness');
const FVC = repoPath('js.src', 'featureValidationController.js');
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
}

const documentStub = {
  createElement: tag => new El(tag),
  querySelectorAll: selector => {
    const want = selector.replace('.', '');
    return all.filter(node => node._classes.has(want) && node.parentElement);
  }
};

// ── slice the real functions ───────────────────────────────────────────────
const source = fs.readFileSync(FVC, 'utf8');
const start = source.indexOf('  function presentErrorDot(wrapper, messages) {');
if (start < 0) throw new Error('presentErrorDot not found');
const end = source.indexOf('\n  }', start) + 4;
const presentBlock = source.slice(start, end);

const sweepStart = source.indexOf("    document.querySelectorAll('.feature-error-dot')");
if (sweepStart < 0) throw new Error('sweep not found');
const sweepBlock = source.slice(sweepStart, source.indexOf('\n    });', sweepStart) + 8);

const api = new Function('document',
  presentBlock + '\n function sweep() {\n' + sweepBlock + '\n }\n return { presentErrorDot, sweep };')(documentStub);


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

// 5 ── the additional-ROM control keeps its pseudo-element dot
{
  const w = new El('div');
  w.className = 'additional-rom-controls feature-has-field-error';
  api.presentErrorDot(w, ['nope']);
  check('additional-rom-controls gets no element dot', findDot(w) === null);
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
  check('additional-rom-controls keeps its pseudo dot',
    fex.includes('.additional-rom-controls.feature-has-field-error::after'));
}

report('feature error dot');
