// Builds js.src/secretMusicTracks.json, the pool the secret music player
// picks each week's tracks from (Jason, 2026-11-16).
//
// The music is not in this repo. It streams from four Internet Archive
// collections, chosen because each has a release that can be traced (a
// licence label on the Archive is set by whoever uploads, so it proves
// nothing by itself):
//   - the Musopen Kickstarter recordings, paid for in 2012 to be released
//     into the public domain;
//   - Musopen's complete Chopin, CC0;
//   - Kimiko Ishizaka's Open Goldberg Variations and Well-Tempered Clavier
//     Book 1, which she released into the public domain herself.
//
// Run it by hand when the pool should change, then commit the JSON:
//   node tools/secret-music-tracks.mjs
// It reads the Archive's public metadata API and nothing else. The site never
// runs it, so the page does not depend on that API.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js.src', 'secretMusicTracks.json');

const COLLECTIONS = [
  {
    id: 'MusopenCollectionAsFlac',
    label: 'Musopen Kickstarter Project',
    licence: 'Public domain (Public Domain Mark 1.0)',
    // Titles read "Composer - 01 - Work - Movement".
    parse: file => {
      const parts = fixText(file.title || stem(file.name)).split(' - ').map(s => s.trim()).filter(s => !/^\d+$/.test(s));
      return { composer: parts.shift(), title: parts.join(' - '), performer: fixText(file.creator || '') || null };
    }
  },
  {
    id: 'musopen-chopin',
    label: 'Musopen: The Complete Chopin Collection',
    licence: 'Public domain (CC0 1.0)',
    parse: file => ({ composer: 'Frédéric Chopin', title: fixText(file.title || stem(file.name)), performer: null })
  },
  {
    id: 'The_Open_Goldberg_Variations-11823',
    label: 'The Open Goldberg Variations',
    licence: 'Public domain (CC0 1.0)',
    parse: file => ({ composer: 'Johann Sebastian Bach', title: `Goldberg Variations - ${fixText(file.title || stem(file.name))}`, performer: 'Kimiko Ishizaka' })
  },
  {
    id: 'bach-well-tempered-clavier-book-1',
    label: 'Bach: Well-Tempered Clavier, Book 1 (Kimiko Ishizaka)',
    licence: 'Public domain (Public Domain Mark 1.0)',
    parse: file => ({ composer: 'Johann Sebastian Bach', title: `Well-Tempered Clavier, Book 1 - ${fixText(file.title || stem(file.name))}`, performer: 'Kimiko Ishizaka' })
  }
];

function stem(name) {
  return path.posix.basename(name).replace(/\.mp3$/i, '').replace(/_/g, ' ');
}

// Some Archive titles are UTF-8 read as Windows-1252 ("PathÃ©tique",
// "DvoÅ™Ã¡k"). Turn each character back into its Windows-1252 byte and read
// the bytes as UTF-8 again, keeping the original unless the round trip is clean.
const CP1252 = new Map([...'€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ'].map((ch, i) => [ch, 0x80 + i]));

function fixText(text) {
  const value = String(text || '').trim();
  if (!/[ÃÂÅÄ]/.test(value)) return value;
  const bytes = [];
  for (const ch of value) {
    const code = ch.codePointAt(0);
    if (code < 0x100 && !(code >= 0x80 && code < 0xA0)) bytes.push(code);
    else if (CP1252.has(ch)) bytes.push(CP1252.get(ch));
    else return value;
  }
  const fixed = Buffer.from(bytes).toString('utf8');
  return fixed.includes('�') ? value : fixed;
}

function fileUrl(id, name) {
  return `https://archive.org/download/${encodeURIComponent(id)}/${name.split('/').map(encodeURIComponent).join('/')}`;
}

function seconds(length) {
  const parts = String(length || '').split(':').map(Number);
  if (!parts.length || parts.some(n => !Number.isFinite(n))) return null;
  return Math.round(parts.reduce((total, n) => total * 60 + n, 0));
}

async function main() {
  const tracks = [];
  for (const collection of COLLECTIONS) {
    const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(collection.id)}`);
    if (!response.ok) throw new Error(`${collection.id}: HTTP ${response.status}`);
    const item = await response.json();
    const files = (item.files || []).filter(file => /\.mp3$/i.test(file.name)).sort((a, b) => a.name.localeCompare(b.name));
    if (!files.length) throw new Error(`${collection.id}: no MP3 files`);
    for (const file of files) {
      const { composer, title, performer } = collection.parse(file);
      if (!composer || !title) throw new Error(`${collection.id}: could not read a title from ${file.name}`);
      tracks.push({ composer, title, performer, collection: collection.id, seconds: seconds(file.length), src: fileUrl(collection.id, file.name) });
    }
    console.log(`${collection.id}: ${files.length} tracks`);
  }
  const pool = {
    about: 'Made by tools/secret-music-tracks.mjs. Do not edit by hand; run the tool again.',
    made: new Date().toISOString().slice(0, 10),
    collections: COLLECTIONS.map(({ id, label, licence }) => ({ id, label, licence, page: `https://archive.org/details/${id}` })),
    tracks
  };
  writeFileSync(OUT, JSON.stringify(pool, null, 1) + '\n');
  console.log(`wrote ${tracks.length} tracks to ${path.relative(process.cwd(), OUT)}`);
}

main().catch(error => { console.error(error.message); process.exit(1); });
