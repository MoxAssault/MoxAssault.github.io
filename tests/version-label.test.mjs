// The version in the footer (Versioning Standard, 2026-11-01).
// 1. The label: "1.0.0" on a tagged release, "1.0.0 (dev <commit>)" off one,
//    ", modified" with uncommitted edits, nothing without a version.
// 2. tools/version-info.mjs, run against a scratch git repository in each
//    state it reports: untagged, tagged, tagged with the wrong version, an
//    untracked file, an edited file, and no git at all.
// 3. The real page: the label sits in the footer, hidden while there is no
//    version.json (the test server has none), shown once one arrives.

import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { check, report, repoPath } from './harness.mjs';
import { openApp } from './browser.mjs';

// 1. The label, from the shipped file.
const source = readFileSync(repoPath('js.src', 'versionLabel.js'), 'utf8');
const node = { textContent: '', hidden: true };
const fakeWindow = {};
new Function('window', 'document', 'fetch', source)(fakeWindow, { getElementById: id => (id === 'appVersion' ? node : null) }, undefined);
const { label, apply } = fakeWindow.VPS_VERSION_LABEL;

check('a tagged release shows the bare version', label({ version: '1.0.0', commit: 'abc1234', tagged: true, modified: false }) === '1.0.0');
check('an untagged build shows its commit', label({ version: '1.0.0', commit: 'abc1234', tagged: false, modified: false }) === '1.0.0 (dev abc1234)');
check('local edits add ", modified"', label({ version: '1.0.0', commit: 'abc1234', tagged: false, modified: true }) === '1.0.0 (dev abc1234, modified)');
check('a tagged commit with local edits is not the release',
  label({ version: '1.0.0', commit: 'abc1234', tagged: true, modified: true }) === '1.0.0 (dev abc1234, modified)');
check('no commit known: the version alone', label({ version: '1.0.0', commit: '', tagged: false }) === '1.0.0');
check('no version, or no file: no label', label(null) === '' && label({}) === '' && label({ version: '' }) === '');
check('apply shows the label', apply({ version: '1.2.0', commit: 'def5678', tagged: false }) === '1.2.0 (dev def5678)'
  && node.textContent === '1.2.0 (dev def5678)' && node.hidden === false, JSON.stringify(node));
check('apply with nothing hides it again', apply(null) === '' && node.hidden === true && node.textContent === '', JSON.stringify(node));

// 2. tools/version-info.mjs against a scratch repository.
const SCRIPT = repoPath('tools', 'version-info.mjs');
const scratch = mkdtempSync(path.join(tmpdir(), 'version-info-'));
const git = (...args) => execFileSync('git', args, { cwd: scratch, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const info = dir => JSON.parse(execFileSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' }));
try {
  writeFileSync(path.join(scratch, 'package.json'), JSON.stringify({ version: '1.2.3' }));
  const bare = info(scratch);
  check('no git: the version, no commit, not tagged, not modified',
    bare.version === '1.2.3' && bare.commit === '' && bare.tagged === false && bare.modified === false, JSON.stringify(bare));

  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');
  writeFileSync(path.join(scratch, 'page.html'), 'one\n');
  git('add', '.');
  git('commit', '-q', '-m', 'first');
  const head = git('rev-parse', '--short=7', 'HEAD');

  const untagged = info(scratch);
  check('untagged: the commit, not tagged, not modified',
    untagged.commit === head && untagged.tagged === false && untagged.modified === false, JSON.stringify(untagged));

  git('tag', '-a', 'v9.9.9', '-m', 'another version');
  check('a tag for a different version is not this release', info(scratch).tagged === false);

  git('tag', '-a', 'v1.2.3', '-m', '1.2.3');
  const tagged = info(scratch);
  check('tagged v<version>: tagged, clean', tagged.tagged === true && tagged.modified === false && tagged.commit === head, JSON.stringify(tagged));

  writeFileSync(path.join(scratch, 'new.txt'), 'untracked\n');
  check('an untracked file counts as modified', info(scratch).modified === true);
  rmSync(path.join(scratch, 'new.txt'));
  check('removing it makes it clean again', info(scratch).modified === false);

  writeFileSync(path.join(scratch, 'page.html'), 'two\n');
  check('an edited file counts as modified', info(scratch).modified === true);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

// 3. The real page.
const app = await openApp();
const page = await app.run(async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const node = document.getElementById('appVersion');
  const separator = document.getElementById('appVersionSeparator');
  const visibleFooter = () => [...document.querySelector('.site-footer').children]
    .filter(child => child.getClientRects().length > 0).map(child => child.textContent.trim());
  const before = {
    inFooter: node?.parentElement?.classList.contains('site-footer') === true,
    hidden: node?.hidden,
    text: node?.textContent,
    separatorHidden: separator?.hidden,
    order: [...document.querySelector('.site-footer').children].map(child => child.id || child.textContent.trim().slice(0, 14)),
    visible: visibleFooter()
  };
  window.VPS_VERSION_LABEL.apply({ version: '1.0.0', commit: 'abc1234', tagged: false, modified: false });
  const after = { visible: visibleFooter(), separatorSpoken: separator.getAttribute('aria-hidden') };
  window.VPS_VERSION_LABEL.apply(null);
  const cleared = visibleFooter();
  window.VPS_VERSION_LABEL.apply({ version: '1.0.0', commit: 'abc1234', tagged: false, modified: false });
  return {
    before, after, cleared,
    color: getComputedStyle(node).color !== getComputedStyle(node.parentElement).color
  };
});
check('the label and its dot sit after the name, both hidden while there is no version.json',
  page.before.inFooter === true && page.before.hidden === true && page.before.text === '' && page.before.separatorHidden === true
  && page.before.order.slice(0, 3).join('|') === 'LU YML Builder|appVersionSeparator|appVersion', JSON.stringify(page.before));
check('with no version the footer reads as before: name, dot, credit',
  page.before.visible.length === 3 && page.before.visible[0] === 'LU YML Builder' && page.before.visible[1] === '•', JSON.stringify(page.before.visible));
check('once applied: "LU YML Builder • 1.0.0 (dev abc1234) • Powered by..."',
  page.after.visible.slice(0, 4).join('|') === 'LU YML Builder|•|1.0.0 (dev abc1234)|•' && /^Powered by/.test(page.after.visible[4] || ''),
  JSON.stringify(page.after.visible));
check('the dot is not read aloud', page.after.separatorSpoken === 'true');
check('cleared again, the dot goes with the version', JSON.stringify(page.cleared) === JSON.stringify(page.before.visible), JSON.stringify(page.cleared));
check('the version is drawn in its own, readable colour', page.color === true, JSON.stringify(page));
check('no page errors', app.errors.filter(error => !/Unable to preload the VPS database/.test(error)).length === 0, app.errors.join('\n'));
await app.close();

report('version-label');
