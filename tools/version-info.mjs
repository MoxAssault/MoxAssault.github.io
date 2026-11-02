#!/usr/bin/env node
// Prints the version.json the page footer reads:
//   { "version": "1.0.0", "commit": "65d3853", "tagged": true, "modified": false }
//
// version  - package.json's "version", the one place the number lives.
// commit   - the short commit the files came from.
// tagged   - HEAD carries the tag v<version>, so this is exactly a release.
// modified - the working tree has uncommitted changes (ignored files aside).
//
// One script, two callers, so they cannot disagree: the dev server
// (.claude/no_cache_server.py) runs it on every request for /version.json,
// and the Pages workflow runs it once to write version.json before publishing.
// See the Versioning Standard: a build that is not exactly a tagged release
// shows its commit.
//
// Usage: node tools/version-info.mjs [repo root, default the current folder]

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');

// git run directly, never through a shell, with a timeout so a stuck git
// cannot hang the dev server's request.
const git = (...args) => execFileSync('git', args, {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
  timeout: 5000
}).trim();

const version = String(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version || '');

let commit = '';
let tagged = false;
let modified = false;
try { commit = git('rev-parse', '--short=7', 'HEAD'); } catch { /* not a git checkout */ }
if (commit) {
  try { tagged = git('tag', '--points-at', 'HEAD').split('\n').includes('v' + version); } catch { /* no tags */ }
  try { modified = git('status', '--porcelain').length > 0; } catch { /* leave false */ }
}

process.stdout.write(JSON.stringify({ version, commit, tagged, modified }) + '\n');
