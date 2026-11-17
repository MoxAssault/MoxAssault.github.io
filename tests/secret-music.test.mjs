// Secret background music (Jason, 2026-11-16): the word "magic" in the footer
// plays this week's tracks, streamed from four public-domain Internet Archive
// collections (js.src/secretMusicTracks.json, made by tools/secret-music-tracks.mjs).
// 1. Nothing is created or fetched at load.
// 2. start() fetches the pool once, builds one player on this week's first
//    track and plays it; stop() and toggle() pause and resume that player.
// 3. The week's pick: 10 to 20 tracks, the same for everyone all week, a new
//    set each Monday 00:00 UTC, no repeats, only https links.
// 4. When a track ends the next one plays, and after the last the first.
// 5. A track that fails is skipped, while starting or mid-play; if all fail
//    the music stops. A refused start (no click yet) and a missing pool leave
//    it stopped, and the next click tries again.
// 6. Clicks faster than the track loads end in the state the last click asked.
// 7. Volume is clamped to 0..1 and carried onto the player.
// 8. The page loads the script, and the pool is well formed.
// 9. The trigger: the footer's "magic" is a button that toggles the music and
//    reports it through aria-pressed, bound once.
// 10. Pixie dust: nine specks per puff, at most one puff per 700 ms, none for
//    a visitor who asks for less motion.
// 11. The real page, in headless Chrome: the word reads as plain text, a
//    hover's specks clear away, and the page's own pool gives a week's list.
// 12. The floating player (step 2): loading, playing and paused, its controls,
//    dragging and arrow keys kept on screen and remembered, close, reload,
//    themes. 13. A phone-sized window. 14. Less motion. 8b covers its state,
//    and pauses and plays from outside the page (media keys).

import { readFileSync, existsSync } from 'node:fs';
import { check, report, repoPath } from './harness.mjs';
import { openApp } from './browser.mjs';

const source = readFileSync(repoPath('js.src', 'secretMusic.js'), 'utf8');
const poolText = readFileSync(repoPath('js.src', 'secretMusicTracks.json'), 'utf8');
const realPool = JSON.parse(poolText);

function poolOf(count) {
  return { tracks: Array.from({ length: count }, (_, i) => ({ title: `Track ${i}`, composer: 'C', src: `https://example.test/${i}.mp3` })) };
}

// broken: srcs whose play() fails as a missing file. refuse: every play() is
// refused (NotAllowedError). slow: play() waits until finish(), and pause()
// interrupts it with an AbortError, as a real browser does while loading.
function load({ pool = poolOf(30), poolStatus = 200, refuse = false, broken = [], lessMotion = false, slow = false } = {}) {
  const made = [];
  const warnings = [];
  const fetches = [];
  const warms = [];
  class FakeAudio {
    constructor() {
      this.paused = true; this.loop = true; this.preload = 'auto'; this.volume = 1; this.src = ''; this.plays = 0;
      this.ended = false; this.currentTime = 0;
      this.pending = []; this.listeners = {};
      made.push(this);
    }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    emit(type) { (this.listeners[type] || []).forEach(fn => fn()); }
    play() {
      this.plays += 1;
      if (refuse) { const error = new Error('refused'); error.name = 'NotAllowedError'; return Promise.reject(error); }
      this.paused = false;
      // A missing file, as a browser reports it: the error event fires first,
      // then play() rejects.
      if (broken.includes(this.src)) {
        return new Promise((resolve, reject) => setTimeout(() => {
          this.emit('error');
          const error = new Error('no source'); error.name = 'NotSupportedError'; reject(error);
        }, 0));
      }
      if (slow) return new Promise((resolve, reject) => this.pending.push({ resolve, reject }));
      // Sound arrives: the browser fires "playing", then play() resolves.
      this.emit('playing');
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
      const interrupted = this.pending.splice(0);
      interrupted.forEach(({ reject }) => { const error = new Error('interrupted'); error.name = 'AbortError'; reject(error); });
      this.emit('pause');
    }
    finish() {
      const waiting = this.pending.splice(0);
      if (waiting.length) this.emit('playing');
      waiting.forEach(({ resolve }) => resolve());
    }
    // A pause or play from outside the page: keyboard media keys or the
    // browser's own media controls, which act on the element directly.
    outsidePause() { this.pause(); }
    outsidePlay() { this.paused = false; this.emit('play'); this.emit('playing'); }
    // The loading track's failure is already on its way when a stop arrives,
    // so the stop cannot turn it into an AbortError.
    failLater() {
      const taken = this.pending.splice(0);
      setTimeout(() => taken.forEach(({ reject }) => { const error = new Error('no source'); error.name = 'NotSupportedError'; reject(error); }), 0);
    }
  }
  const fakeFetch = (url, options) => {
    if (options && options.headers) { warms.push({ url, range: options.headers.Range }); return Promise.reject(new Error('warm-up refused')); }
    fetches.push(url);
    if (poolStatus === 'offline') return Promise.reject(new Error('offline'));
    return Promise.resolve({ ok: poolStatus === 200, status: poolStatus, json: () => Promise.resolve(pool) });
  };
  const fakeWindow = { matchMedia: query => ({ matches: lessMotion && query.includes('reduce') }) };
  const quietConsole = { info() {}, warn: (...args) => warnings.push(args.map(String).join(' ')) };
  new Function('window', 'Audio', 'console', 'fetch', source)(fakeWindow, FakeAudio, quietConsole, fakeFetch);
  return { music: fakeWindow.VPS_SECRET_MUSIC, made, warnings, fetches, warms };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const DAY = 24 * 60 * 60 * 1000;

// 1. Nothing at load.
{
  const { music, made, fetches } = load();
  check('loading the script creates no player', made.length === 0);
  check('loading the script fetches nothing', fetches.length === 0);
  check('it is not playing before start', music.isPlaying() === false && music.current() === null);
  check('stop before any start is harmless', music.stop() === false && made.length === 0);
}

// 2. Start, stop, toggle.
{
  const pool = poolOf(30);
  const { music, made, fetches } = load({ pool });
  const week = music.pickWeek(pool, music.weekNumber());
  const started = await music.start();
  const player = made[0];
  check('start resolves true and plays', started === true && music.isPlaying() === true);
  check('start fetches the pool from js.src', fetches.length === 1 && fetches[0] === 'js.src/secretMusicTracks.json', fetches.join());
  check("one player, on this week's first track", made.length === 1 && player.src === week[0].src, player && player.src);
  check('current() names the playing track', Boolean(music.current()) && music.current().title === week[0].title);
  check('the player does not loop one track', player.loop === false);
  check('the player waits to download until asked', player.preload === 'none');
  check('the default volume is quiet (0.35)', player.volume === 0.35, String(player.volume));
  await music.start();
  check('a second start does not restart the track', player.plays === 1 && made.length === 1, String(player.plays));
  check('stop pauses it', music.stop() === false && player.paused === true && music.isPlaying() === false);
  check('toggle resumes the same player on the same track', (await music.toggle()) === true && music.isPlaying() === true && made.length === 1 && player.src === week[0].src);
  check('toggle stops it again', (await music.toggle()) === false && music.isPlaying() === false);
  check('the pool is fetched only once', fetches.length === 1, String(fetches.length));
}

// 3. The week's pick.
{
  const { music } = load();
  const monday = Date.UTC(2026, 10, 16);
  check('Monday 00:00 UTC starts a new week', music.weekNumber(monday) === music.weekNumber(monday - 1) + 1);
  check('the week holds until the next Monday', music.weekNumber(monday) === music.weekNumber(monday + 7 * DAY - 1));
  const week = music.weekNumber(monday);
  const thisWeek = music.pickWeek(realPool, week);
  check('the same week always gives the same list', JSON.stringify(thisWeek) === JSON.stringify(music.pickWeek(realPool, week)));
  check('the next week gives a different list', JSON.stringify(thisWeek) !== JSON.stringify(music.pickWeek(realPool, week + 1)));
  const sizes = new Set();
  let allGood = true;
  for (let w = week; w < week + 200; w += 1) {
    const list = music.pickWeek(realPool, w);
    sizes.add(list.length);
    const srcs = list.map(t => t.src);
    if (list.length < 10 || list.length > 20 || new Set(srcs).size !== srcs.length || !list.every(t => realPool.tracks.includes(t))) allGood = false;
  }
  check('200 weeks: always 10 to 20 tracks from the pool, never a repeat', allGood);
  check('200 weeks: sizes run the whole range from 10 to 20', sizes.size === 11, [...sizes].sort((a, b) => a - b).join());
  const reached = new Set();
  const openers = new Set();
  for (let w = week; w < week + 200; w += 1) {
    const list = music.pickWeek(realPool, w);
    list.forEach(t => reached.add(t.src));
    openers.add(list[0].src);
  }
  check('200 weeks reach most of the pool, not just its first tracks', reached.size > realPool.tracks.length * 0.9, `${reached.size} of ${realPool.tracks.length}`);
  check('200 weeks open with many different tracks', openers.size > 100, String(openers.size));
  check('picking leaves the pool in its order', JSON.stringify(realPool) === JSON.stringify(JSON.parse(poolText)));
  check('a small pool gives all of it', music.pickWeek(poolOf(3), 1).length === 3);
  check('an empty or broken pool gives nothing', music.pickWeek({ tracks: [] }, 1).length === 0 && music.pickWeek(null, 1).length === 0 && music.pickWeek({}, 1).length === 0);
  const mixed = { tracks: [{ title: 'a', src: 'http://plain.test/a.mp3' }, { title: 'b', src: 'javascript:alert(1)' }, { title: 'c', src: 'https://ok.test/c.mp3' }, null] };
  const kept = music.pickWeek(mixed, 1);
  check('only https links are kept', kept.length === 1 && kept[0].title === 'c', JSON.stringify(kept));
}

// 4. One track after another.
{
  const pool = poolOf(12);
  const { music, made } = load({ pool });
  const week = music.pickWeek(pool, music.weekNumber());
  await music.start();
  const player = made[0];
  player.emit('ended');
  await settle();
  check('when a track ends the next one plays', player.src === week[1].src && music.isPlaying() === true && player.plays === 2, player.src);
  for (let i = 2; i < week.length; i += 1) { player.emit('ended'); await settle(); }
  check('the last track is reached in order', player.src === week[week.length - 1].src);
  player.emit('ended');
  await settle();
  check('after the last track the first plays again', player.src === week[0].src && music.isPlaying() === true);
  music.stop();
  player.emit('ended');
  await settle();
  check('an end after stop does not start the next track', player.src === week[0].src && music.isPlaying() === false);
}

// 4b. Waking the next track (the Archive can take 10 s or more on a file it
//     has not served lately).
{
  const pool = poolOf(12);
  const { music, made, warms, warnings } = load({ pool });
  const week = music.pickWeek(pool, music.weekNumber());
  check('nothing is warmed before anything plays', warms.length === 0);
  await music.start();
  made[0].emit('playing');
  await settle();
  check("when a track plays, the next one's first two bytes are asked for", warms.length === 1 && warms[0].url === week[1].src && warms[0].range === 'bytes=0-1', JSON.stringify(warms));
  made[0].emit('playing');
  check('the same track is not warmed twice', warms.length === 1);
  check('a refused warm-up changes nothing and says nothing', music.isPlaying() === true && warnings.length === 0, warnings.join(' | '));
  made[0].emit('ended');
  await settle();
  made[0].emit('playing');
  check('the track after that is warmed when its turn is next', warms.length === 2 && warms[1].url === week[2].src, JSON.stringify(warms));
  const solo = load({ pool: poolOf(1) });
  await solo.music.start();
  solo.made[0].emit('playing');
  check('a one-track week warms nothing', solo.warms.length === 0);
}

// 5. Failures.
{
  const pool = poolOf(12);
  const probe = load({ pool }).music;
  const week = probe.pickWeek(pool, probe.weekNumber());

  const one = load({ pool, broken: [week[0].src] });
  const started = await one.music.start();
  check('a broken first track is skipped to the next', started === true && one.made[0].src === week[1].src && one.music.isPlaying() === true, one.made[0].src);
  check('the skip is reported once in the console: the error event while starting is not counted twice', one.warnings.length === 1 && one.warnings[0].includes(week[0].title), one.warnings.join(' | '));
  await settle();
  check('...and it does not skip a second time', one.made[0].src === week[1].src && one.made[0].plays === 2, `${one.made[0].src} plays ${one.made[0].plays}`);

  const mixedUp = load({ pool, broken: [week[0].src] });
  const clicks = [mixedUp.music.toggle(), mixedUp.music.toggle(), mixedUp.music.toggle()];
  await Promise.all(clicks);
  await settle();
  check('start, stop, start during the list fetch still skips a broken first track', mixedUp.music.isPlaying() === true && mixedUp.made[0].src === week[1].src, mixedUp.made[0] && mixedUp.made[0].src);

  const mid = load({ pool });
  await mid.music.start();
  mid.made[0].emit('error');
  await settle();
  check('a track that breaks mid-play is skipped', mid.made[0].src === week[1].src && mid.music.isPlaying() === true);

  const all = load({ pool, broken: week.map(t => t.src) });
  const watched = [];
  all.music.onChange(now => watched.push(now));
  const none = await all.music.start();
  check('if every track fails the music stops', none === false && all.music.isPlaying() === false);
  check('each track was tried once, then it gave up', all.made[0].plays === week.length, String(all.made[0].plays));
  check('giving up says so in the console', all.warnings.some(w => w.includes("none of this week's tracks")), all.warnings.join(' | '));
  const last = watched[watched.length - 1];
  check('watchers hear that it stopped, with the reason, the player still open', Boolean(last) && last.open === true && last.wanted === false && last.playing === false
    && last.problem === "None of this week's tracks could be played.", JSON.stringify(last));
  all.music.togglePlay();
  await settle();
  check("the player's play button tries again, clearing the problem while it does", all.made[0].plays > week.length && all.music.state().problem === null && all.music.state().loading === true, String(all.made[0].plays));

  const refused = load({ refuse: true });
  const r = await refused.music.start();
  check('refused sound: start resolves false and stays stopped', r === false && refused.made[0].paused === true && refused.music.isPlaying() === false);
  check('refused sound: the player stays open, paused, with no problem shown', refused.music.state().open === true && refused.music.state().wanted === false && refused.music.state().problem === null, JSON.stringify(refused.music.state()));
  check("refused sound: the player's play button tries again", (await refused.music.togglePlay()) === false && refused.made[0].plays === 2, String(refused.made[0].plays));
  check('refused sound is not reported as a broken track', refused.warnings.length === 0, refused.warnings.join(' | '));

  for (const status of [404, 'offline']) {
    const gone = load({ poolStatus: status });
    const g = await gone.music.start();
    check(`pool ${status}: start resolves false, no player, a console note`, g === false && gone.made.length === 0 && gone.music.isPlaying() === false && gone.warnings.some(w => w.includes('track list could not be loaded')), gone.warnings.join(' | '));
    check(`pool ${status}: the player stays open and says the music could not be loaded`, gone.music.state().open === true && gone.music.state().problem === "This week's music could not be loaded.", JSON.stringify(gone.music.state()));
    check(`pool ${status}: its play button tries the fetch again`, (await gone.music.togglePlay()) === false && gone.fetches.length === 2, String(gone.fetches.length));
  }
  const empty = load({ pool: { tracks: [] } });
  check('an empty pool: start resolves false, no player', (await empty.music.start()) === false && empty.made.length === 0);
}

// 6. Clicks faster than the track loads (found live 2026-11-16: five quick
//    toggles ended stopped, because an interrupted start's late clean-up
//    paused the newest one).
{
  const { music, made, warnings } = load({ slow: true });
  const clicks = [music.toggle(), music.toggle(), music.toggle(), music.toggle(), music.toggle()];
  await settle();
  made[0].finish();
  const results = await Promise.all(clicks);
  await settle();
  check('five quick toggles end playing, as the last click asked', music.isPlaying() === true, JSON.stringify(results));
  check('the last click reports that it started', results[4] === true, JSON.stringify(results));
  check('an interrupted start is not reported as a fault', warnings.length === 0, warnings.join(' | '));
  const even = load({ slow: true });
  const four = [even.music.toggle(), even.music.toggle(), even.music.toggle(), even.music.toggle()];
  await settle();
  if (even.made[0]) even.made[0].finish();
  await Promise.all(four);
  await settle();
  check('four quick toggles end stopped', even.music.isPlaying() === false);
  const late = load({ slow: true });
  const first = late.music.toggle();
  await settle();
  const second = late.music.toggle();
  const third = late.music.toggle();
  await settle();
  late.made[0].finish();
  await Promise.all([first, second, third]);
  await settle();
  check('stop then start while a track loads ends playing, with no warning', late.music.isPlaying() === true && late.warnings.length === 0, late.warnings.join(' | '));

  const lateFail = load({ slow: true });
  lateFail.music.toggle();
  await settle();
  lateFail.made[0].failLater();
  lateFail.music.stop();
  await settle();
  await settle();
  check('a failure that lands just after a stop does not restart the music', lateFail.music.isPlaying() === false && lateFail.made[0].plays === 1 && lateFail.warnings.length === 0, `plays ${lateFail.made[0].plays} ${lateFail.warnings.join(' | ')}`);

  const outside = load({ slow: true });
  outside.music.toggle();
  await settle();
  const loadingSrc = outside.made[0].src;
  outside.made[0].pause();
  await settle();
  check('a pause from outside the page (media keys) while a track loads is not treated as broken', outside.warnings.length === 0 && outside.made[0].src === loadingSrc && outside.made[0].plays === 1, outside.warnings.join(' | '));
}

// 7. Volume.
{
  const { music, made } = load();
  check('volume set before start is used when it starts', music.setVolume(0.2) === 0.2);
  await music.start();
  check('the player takes the earlier volume', made[0].volume === 0.2, String(made[0].volume));
  check('volume above 1 is held at 1', music.setVolume(5) === 1 && made[0].volume === 1);
  check('volume below 0 is held at 0', music.setVolume(-1) === 0 && made[0].volume === 0);
  check('a non-number leaves the volume as it was', music.setVolume('loud') === 0 && made[0].volume === 0);
}

// 8. Wiring and the pool.
{
  const html = readFileSync(repoPath('index.html'), 'utf8');
  check('index.html loads secretMusic.js', html.includes('<script src="js.src/secretMusic.js"></script>'));
  const { music } = load();
  check('the pool the script fetches is in the repo', existsSync(repoPath(...music.POOL.split('/'))), music.POOL);
  const ids = new Set(realPool.collections.map(c => c.id));
  check('the pool names four collections, each with a licence and page', realPool.collections.length === 4
    && realPool.collections.every(c => c.label && /public domain/i.test(c.licence) && c.page === `https://archive.org/details/${c.id}`));
  check('the pool holds more than a week can use', realPool.tracks.length > 20, String(realPool.tracks.length));
  const badTrack = realPool.tracks.find(t => !t.title || !t.composer || !ids.has(t.collection)
    || !t.src.startsWith(`https://archive.org/download/${encodeURIComponent(t.collection)}/`) || !/\.mp3$/i.test(decodeURIComponent(t.src))
    || !(t.seconds > 0) || /[ÃÂ�™]/.test(`${t.title} ${t.composer} ${t.performer || ''}`));
  check('every track has a clean title, composer, length and Archive link', !badTrack, JSON.stringify(badTrack));
  check('no track is listed twice', new Set(realPool.tracks.map(t => t.src)).size === realPool.tracks.length);
}

// 8b. The player's own state and controls (the floating player, step 2).
{
  const pool = poolOf(12);
  const slowOne = load({ pool, slow: true });
  const week = slowOne.music.pickWeek(pool, slowOne.music.weekNumber());
  check('the player is closed before anything starts', slowOne.music.state().open === false && slowOne.music.state().canSkip === false);
  const opening = slowOne.music.start();
  check('start opens the player at once, loading, before the list arrives', slowOne.music.state().open === true && slowOne.music.state().loading === true && slowOne.music.state().track === null);
  await settle();
  check('while the track loads: loading, the track already named', slowOne.music.state().loading === true && slowOne.music.state().playing === false && slowOne.music.state().track.title === week[0].title, JSON.stringify(slowOne.music.state()));
  slowOne.made[0].finish();
  await opening;
  check('when sound arrives: playing, no longer loading', slowOne.music.state().playing === true && slowOne.music.state().loading === false);

  const { music, made } = load({ pool });
  check('next and previous before any start do nothing', (await music.next()) === false && (await music.previous()) === false && made.length === 0);
  await music.start();
  const player = made[0];
  check('skipping is offered once a week of several tracks is playing', music.state().canSkip === true);
  music.pause();
  check('pause keeps the player open and stops the sound', music.state().open === true && music.state().wanted === false && player.paused === true && music.state().playing === false);
  await music.togglePlay();
  check('the play button resumes the same track', music.state().wanted === true && player.src === week[0].src && music.isPlaying() === true);
  await music.next();
  check('next plays the following track', player.src === week[1].src && music.isPlaying() === true && music.state().track.title === week[1].title);
  await music.previous();
  check('previous at the start of a track goes back one', player.src === week[0].src);
  await music.previous();
  check('previous from the first track wraps to the last', player.src === week[week.length - 1].src);
  player.currentTime = 42;
  await music.previous();
  check('previous a few seconds in starts the same track again', player.src === week[week.length - 1].src && player.currentTime === 0);
  music.pause();
  await music.next();
  check('next while paused plays', music.isPlaying() === true && music.state().wanted === true && player.src === week[0].src);
  check('toggle (the word "magic") on an open player closes it and stops', (await music.toggle()) === false && music.state().open === false && music.isPlaying() === false);
  await music.toggle();
  check('opening it again resumes the same track', music.state().open === true && music.isPlaying() === true && player.src === week[0].src);
  const heard = [];
  music.onChange(now => heard.push(now.volume));
  music.setVolume(0.6);
  check('a volume change reaches the watchers', heard[heard.length - 1] === 0.6);

  // The media-key fix (deferred to step 2 by Jason, 2026-11-16): a pause from
  // outside the page used to leave the music "wanted", so the next click on
  // "magic" did nothing you could hear.
  const keys = load({ pool });
  await keys.music.start();
  keys.made[0].outsidePause();
  check('a pause from outside the page shows as paused, the player still open', keys.music.state().open === true && keys.music.state().wanted === false && keys.music.isPlaying() === false);
  await keys.music.togglePlay();
  check("after it, the player's play button plays again", keys.music.isPlaying() === true && keys.music.state().wanted === true);
  keys.made[0].outsidePause();
  check('after it, the word "magic" closes the player at once', (await keys.music.toggle()) === false && keys.music.state().open === false);
  keys.made[0].outsidePlay();
  check('a play from outside the page reopens the player as playing', keys.music.state().open === true && keys.music.state().wanted === true && keys.music.state().playing === true);
  const ending = load({ pool });
  await ending.music.start();
  ending.made[0].paused = true;
  ending.made[0].ended = true;
  ending.made[0].emit('pause');
  check('the pause a browser fires as a track ends is not taken as an outside pause', ending.music.state().wanted === true);
  const late = load({ pool });
  await late.music.start();
  late.made[0].emit('pause');
  check('a late pause event from a track change that already moved on is ignored', late.music.state().wanted === true && late.music.isPlaying() === true);
  const pausedLate = load({ slow: true });
  pausedLate.music.togglePlay();
  await settle();
  pausedLate.made[0].failLater();
  pausedLate.music.pause();
  await settle();
  await settle();
  check("a failure that lands just after the player's pause does not restart the music", pausedLate.music.isPlaying() === false && pausedLate.made[0].plays === 1 && pausedLate.music.state().open === true, `plays ${pausedLate.made[0].plays}`);
  const early = load({ pool });
  early.music.start();
  const earlyAnswer = await early.music.togglePlay();
  await settle();
  check('the play button pauses even before the list has arrived', earlyAnswer === false && early.music.state().wanted === false && early.made.length === 0, JSON.stringify(early.music.state()));
  const listed = load({ pool });
  await listed.music.playlist();
  check('skip is not offered just because the list has loaded', listed.music.state().canSkip === false);
  const single = load({ pool: poolOf(1) });
  await single.music.start();
  check('skip is not offered in a one-track week', single.music.state().canSkip === false);
  late.music.stop();
  late.made[0].emit('play');
  check('a late play event from our own start, arriving after a stop, does not reopen the player', late.music.state().open === false && late.music.state().wanted === false);
}

function fakeButton() {
  const listeners = {};
  const attrs = {};
  const children = [];
  const ownerDocument = {
    createElement: () => {
      const props = {};
      const el = { className: '', style: { setProperty: (k, v) => { props[k] = v; } }, props,
        attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {},
        remove() { const i = children.indexOf(el); if (i >= 0) children.splice(i, 1); } };
      return el;
    }
  };
  return {
    dataset: {}, listeners, attrs, children, ownerDocument,
    setAttribute(k, v) { attrs[k] = v; }, getAttribute(k) { return attrs[k]; },
    addEventListener(type, fn) { listeners[type] = fn; },
    appendChild(el) { children.push(el); return el; }
  };
}

// 9. The trigger.
{
  const { music } = load();
  const button = fakeButton();
  check('binding the trigger succeeds once', music.bindTrigger(button) === true && music.bindTrigger(button) === false);
  check('no trigger on the page is harmless', music.bindTrigger(null) === false);
  check('it starts unpressed', button.attrs['aria-pressed'] === 'false');
  await button.listeners.click();
  check('a click starts the music and marks it pressed', music.isPlaying() === true && button.attrs['aria-pressed'] === 'true');
  await button.listeners.click();
  check('a second click stops it and clears pressed', music.isPlaying() === false && button.attrs['aria-pressed'] === 'false');
  const solo = load({ pool: poolOf(1) });
  const soloButton = fakeButton();
  solo.music.bindTrigger(soloButton);
  await soloButton.listeners.click();
  solo.made[0].emit('error');
  await settle();
  check('when the music stops on its own, the word still shows the player open', soloButton.attrs['aria-pressed'] === 'true' && solo.music.isPlaying() === false && solo.music.state().problem !== null, soloButton.attrs['aria-pressed']);
  solo.music.stop();
  check('closing the player from elsewhere (its close button) clears pressed', soloButton.attrs['aria-pressed'] === 'false');
  const refused = load({ refuse: true });
  const quiet = fakeButton();
  refused.music.bindTrigger(quiet);
  await quiet.listeners.click();
  check('a refused start still opens the player, so the word is pressed', quiet.attrs['aria-pressed'] === 'true' && refused.music.isPlaying() === false);
}

// 10. Pixie dust.
{
  const { music } = load();
  const button = fakeButton();
  const first = music.sprinkleDust(button, 10000);
  check('a puff adds nine specks', first === 9 && button.children.length === 9, String(button.children.length));
  const speck = button.children[0];
  check('specks are hidden from screen readers', speck.attrs['aria-hidden'] === 'true');
  check('each speck gets its own drift', ['--start', '--x', '--y', '--size', '--delay'].every(k => k in speck.props), JSON.stringify(speck.props));
  check('some specks take the second colour', button.children.some(s => s.className.includes('is-alt'))
    && button.children.some(s => !s.className.includes('is-alt')));
  check('a second puff inside 700 ms is skipped', music.sprinkleDust(button, 10699) === 0 && button.children.length === 9);
  check('a puff after 700 ms is allowed', music.sprinkleDust(button, 10700) === 9);
  const still = load({ lessMotion: true });
  const calm = fakeButton();
  check('less motion: no specks', still.music.sprinkleDust(calm, 10000) === 0 && calm.children.length === 0);
}

// 11. The real page.
{
  const app = await openApp();
  try {
    const page = await app.run(async () => {
      await document.fonts.ready;
      const button = document.getElementById('secretMagic');
      const span = button.parentElement;
      const style = getComputedStyle(button);
      const around = getComputedStyle(span);
      const layout = () => [...span.parentElement.children]
        .map(c => { const r = c.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(n => n.toFixed(2)).join(','); }).join('|');
      const withButton = layout();
      const text = document.createTextNode(button.textContent);
      span.replaceChild(text, button);
      const plain = layout();
      span.replaceChild(button, text);
      button.dispatchEvent(new PointerEvent('pointerenter'));
      const specks = button.querySelectorAll('.secret-magic-speck').length;
      const first = button.querySelector('.secret-magic-speck');
      const drift = first ? getComputedStyle(first).animationName : '';
      const word = button.getBoundingClientRect();
      const dot = first ? first.getBoundingClientRect() : null;
      const onWord = Boolean(dot) && dot.left >= word.left - 4 && dot.right <= word.right + 4 && Math.abs((dot.top + dot.bottom) / 2 - (word.top + word.bottom) / 2) < 6;
      button.focus();
      const focusRing = button.matches(':focus-visible') ? getComputedStyle(button).outlineStyle : 'not focus-visible';
      button.blur();
      await new Promise(resolve => setTimeout(resolve, 1600));
      const week = await window.VPS_SECRET_MUSIC.playlist();
      const again = await window.VPS_SECRET_MUSIC.playlist();
      return {
        weekCount: week.length, weekArchive: week.every(t => t.src.startsWith('https://archive.org/download/') && Boolean(t.title)),
        weekSame: JSON.stringify(week) === JSON.stringify(again), playingAfterList: window.VPS_SECRET_MUSIC.isPlaying(),
        tag: button.tagName, type: button.type, cursor: style.cursor, font: style.font === around.font,
        colour: style.color === around.color, border: style.borderTopWidth, background: style.backgroundColor,
        sameLayout: withButton === plain, specks, drift, onWord, select: style.userSelect, focusRing, left: button.querySelectorAll('.secret-magic-speck').length,
        name: button.textContent, bound: button.dataset.secretMusicBound
      };
    });
    check('the trigger is a real button', page.tag === 'BUTTON' && page.type === 'button', JSON.stringify(page));
    check('it shows the text cursor', page.cursor === 'text', page.cursor);
    check('it matches the words around it', page.font && page.colour && page.border === '0px' && page.background === 'rgba(0, 0, 0, 0)', JSON.stringify(page));
    check('the footer lays out exactly as plain text would', page.sameLayout === true);
    check('the word can be selected like the text around it', page.select === 'text', page.select);
    check('keyboard focus draws an outline on the word', page.focusRing === 'solid', page.focusRing);
    check('the specks start on the word itself', page.onWord === true, JSON.stringify(page));
    check('the page binds it on load', page.bound === 'true');
    check('a hover gives off nine drifting specks', page.specks === 9 && page.drift === 'secret-magic-drift', JSON.stringify(page));
    check('the specks clear away and the word is unchanged', page.left === 0 && page.name === 'magic', JSON.stringify(page));
    check("the page loads its own pool and picks this week's 10 to 20 Archive tracks", page.weekCount >= 10 && page.weekCount <= 20 && page.weekArchive, JSON.stringify(page));
    check('asking twice gives the same week, and asking plays nothing', page.weekSame && page.playingAfterList === false);
    check('no page errors', app.errors.filter(error => !/Unable to preload the VPS database/.test(error)).length === 0, app.errors.join('\n'));
  } finally {
    await app.close();
  }
}

// 12. The floating player on the real page, in headless Chrome. The tests run
//     offline, so a stand-in for Audio takes the browser's place: it plays
//     nothing, but fires the same events. The track list is the page's own.
const STUB_AUDIO = () => {
  class StubAudio extends EventTarget {
    constructor() {
      super();
      this.paused = true; this.ended = false; this.currentTime = 0; this.volume = 1; this.src = ''; this.preload = ''; this.loop = false;
      window.__stubAudio = this;
    }
    play() {
      this.paused = false;
      this.dispatchEvent(new Event('play'));
      return new Promise(resolve => { this.arrive = () => { this.dispatchEvent(new Event('playing')); resolve(); }; });
    }
    pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  }
  window.Audio = StubAudio;
  window.__tick = () => new Promise(resolve => setTimeout(resolve, 30));
  // The player fades in over 180 ms, scaling slightly; boxes are measured after it.
  window.__settled = () => new Promise(resolve => setTimeout(resolve, 260));
  window.__rect = el => { const r = el.getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width) }; };
  window.__drag = (bar, from, to) => {
    const at = (type, [x, y]) => bar.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, buttons: 1, pointerId: 7, clientX: x, clientY: y }));
    at('pointerdown', from); at('pointermove', to); at('pointerup', to);
  };
};

{
  const app = await openApp();
  try {
    const first = await app.run(async stub => {
      new Function(`(${stub})()`)();
      const magic = document.getElementById('secretMagic');
      const before = Boolean(document.getElementById('secretPlayer'));
      magic.click();
      await __tick();
      const root = document.getElementById('secretPlayer');
      const q = s => root.querySelector(s);
      const dotOf = () => { const s = getComputedStyle(q('.secret-player-dot')); return { bg: s.backgroundColor, img: s.backgroundImage, ring: s.borderTopWidth, gap: s.borderRightColor, anim: s.animationName }; };
      const loading = { dot: dotOf(), shown: !root.hidden && getComputedStyle(root).display !== 'none', status: q('.secret-player-state').textContent, busy: root.hasAttribute('aria-busy'), title: q('.secret-player-title').textContent, play: q('[data-action="play"]').getAttribute('aria-label') };
      __stubAudio.arrive();
      await __settled();
      const style = getComputedStyle(root);
      const width = document.documentElement.clientWidth;
      const height = document.documentElement.clientHeight;
      const box = __rect(root);
      const source = q('.secret-player-source');
      const station = q('.secret-player-station');
      const stateBox = q('.secret-player-state').getBoundingClientRect();
      const playing = {
        dot: dotOf(),
        station: { text: station.textContent, shown: station.getBoundingClientRect().width > 0, whole: station.scrollWidth <= station.clientWidth, caps: getComputedStyle(station).textTransform,
          stateHidden: stateBox.width <= 1 && stateBox.height <= 1, stateRead: q('.secret-player-state').getAttribute('aria-hidden') === null,
          stateLive: q('.secret-player-state').getAttribute('aria-live'), separator: getComputedStyle(q('.secret-player-state'), '::before').content },
        status: q('.secret-player-state').textContent, busy: root.hasAttribute('aria-busy'),
        linkHeight: Math.round(source.getBoundingClientRect().height),
        title: q('.secret-player-title').textContent, meta: q('.secret-player-meta').textContent,
        play: q('[data-action="play"]').getAttribute('aria-label'), pressed: magic.getAttribute('aria-pressed'),
        source: { href: source.href, target: source.target, rel: source.rel, hidden: source.hidden },
        position: style.position, blur: style.backdropFilter, radius: style.borderRadius,
        corner: { right: width - box.right, bottom: height - box.bottom },
        sizes: [...root.querySelectorAll('button')].filter(b => getComputedStyle(b).display !== 'none').map(b => Math.round(b.getBoundingClientRect().height)),
        names: [...root.querySelectorAll('button, input')].map(b => b.getAttribute('aria-label')),
        live: q('.secret-player-now').getAttribute('aria-live'),
        text: getComputedStyle(q('.secret-player-title')).color, muted: getComputedStyle(q('.secret-player-meta')).color,
        current: VPS_SECRET_MUSIC.current()
      };
      q('[data-action="play"]').click();
      await __tick();
      const paused = { dot: dotOf(), status: q('.secret-player-state').textContent, shown: !root.hidden, play: q('[data-action="play"]').getAttribute('aria-label'), pressed: magic.getAttribute('aria-pressed'), stubPaused: __stubAudio.paused };
      q('[data-action="play"]').click();
      await __tick();
      __stubAudio.arrive();
      await __tick();
      const volume = q('.secret-player-volume');
      volume.value = '80';
      volume.dispatchEvent(new Event('input', { bubbles: true }));
      const volumeNow = { state: VPS_SECRET_MUSIC.state().volume, audio: __stubAudio.volume };

      const bar = q('.secret-player-bar');
      const start = __rect(root);
      __drag(bar, [start.left + 60, start.top + 10], [160, 140]);
      const dragged = __rect(root);
      const saved = JSON.parse(localStorage.getItem('vpxs-yml-secret-player-position'));
      __drag(bar, [dragged.left + 60, dragged.top + 10], [-500, -500]);
      const topLeft = __rect(root);
      __drag(bar, [topLeft.left + 60, topLeft.top + 10], [5000, 5000]);
      const bottomRight = __rect(root);
      const pressOn = selector => {
        q(selector).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 9, clientX: 0, clientY: 0 }));
        const dragging = root.classList.contains('is-dragging');
        root.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 9, clientX: 300, clientY: 300 }));
        root.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, clientX: 300, clientY: 300 }));
        return dragging;
      };
      const closeDragged = pressOn('.secret-player-close') || pressOn('.secret-player-minimize');
      const notDraggedByClose = __rect(root);
      __drag(bar, [bottomRight.left + 60, bottomRight.top + 10], [300, 120]);
      const grip = q('.secret-player-grip');
      grip.focus();
      const ring = { visible: grip.matches(':focus-visible'), outline: getComputedStyle(grip).outlineStyle, colour: getComputedStyle(grip).outlineColor, shadow: getComputedStyle(grip).boxShadow };
      const beforeKeys = __rect(root);
      grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      const afterRight = __rect(root);
      grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true, cancelable: true }));
      const afterShiftDown = __rect(root);
      const keySaved = JSON.parse(localStorage.getItem('vpxs-yml-secret-player-position'));

      q('.secret-player-close').click();
      await __tick();
      const closed = { hidden: root.hidden, display: getComputedStyle(root).display, pressed: magic.getAttribute('aria-pressed'), focus: document.activeElement === magic, stubPaused: __stubAudio.paused, open: VPS_SECRET_MUSIC.state().open };
      magic.click();
      await __settled();
      const reopened = { shown: !root.hidden, box: __rect(root), panels: document.querySelectorAll('.secret-player').length };
      magic.click();
      await __tick();
      document.documentElement.dataset.theme = 'pink';
      const pinkAccent = getComputedStyle(root).getPropertyValue('--sp-accent').trim();
      document.documentElement.dataset.theme = 'light';
      const lightAccent = getComputedStyle(root).getPropertyValue('--sp-accent').trim();
      return { before, loading, playing, paused, volumeNow, start, dragged, saved, topLeft, bottomRight, notDraggedByClose, closeDragged, width, height, ring, beforeKeys, afterRight, afterShiftDown, keySaved, closed, reopened, pinkAccent, lightAccent };
    }, STUB_AUDIO.toString());
    const r = first;
    const J = JSON.stringify;
    check('the page holds no player until the first click', r.before === false);
    check('a click on "magic" shows the player at once, loading', r.loading.shown && r.loading.status === 'Loading' && r.loading.play === 'Pause', J(r.loading));
    check('no aria-busy, which could stop a screen reader announcing the track', r.loading.busy === false && r.playing.busy === false, J([r.loading.busy, r.playing.busy]));
    check('while loading it already names the track', r.loading.title.length > 0 && r.loading.title !== "Finding this week's music", J(r.loading));
    check('when sound arrives it says "Now playing"', r.playing.status === 'Now playing', J(r.playing));
    check('the header shows the station name, M-ROCJR 73.0 FM, in full', r.playing.station.text === 'M-ROCJR 73.0 FM' && r.playing.station.shown && r.playing.station.whole, J(r.playing.station));
    check('the state in words is hidden from sight but kept for screen readers', r.playing.station.stateHidden && r.playing.station.stateRead, J(r.playing.station));
    check('a screen reader hears "station, state" and is told when the state changes', r.playing.station.separator === '", "' && r.playing.station.stateLive === 'polite', J(r.playing.station));
    const orange = 'rgb(255, 159, 28)';
    const grey = 'rgb(201, 206, 214)';
    check('loading: the dot is an orange ring with a gap, turning', r.loading.dot.ring === '2px' && r.loading.dot.gap === 'rgba(0, 0, 0, 0)' && r.loading.dot.bg === 'rgba(0, 0, 0, 0)' && r.loading.dot.anim === 'secret-player-turn', J(r.loading.dot));
    check('playing: the dot is a solid green circle, pulsing', r.playing.dot.img.startsWith('radial-gradient(') && r.playing.dot.img.includes('rgb(74, 222, 128)') && !r.playing.dot.img.includes(orange) && r.playing.dot.ring === '0px' && r.playing.dot.anim === 'secret-player-pulse', J(r.playing.dot));
    check('paused: the dot is solid grey and still', r.paused.dot.bg === grey && r.paused.dot.ring === '0px' && r.paused.dot.anim === 'none', J(r.paused.dot));
    check('the source link is at least 24px tall, easy to hit', r.playing.linkHeight >= 24, String(r.playing.linkHeight));
    check('it shows the title, and the composer with the performer', r.playing.title === r.playing.current.title && r.playing.meta.startsWith(r.playing.current.composer), J(r.playing));
    check('the source link opens the Archive collection in a new tab, safely', r.playing.source.href.startsWith('https://archive.org/details/') && r.playing.source.target === '_blank' && r.playing.source.rel.includes('noopener') && !r.playing.source.hidden, J(r.playing.source));
    check('the word "magic" reports the player as open', r.playing.pressed === 'true');
    check('it floats, rounded, over a blur of the page', r.playing.position === 'fixed' && r.playing.blur.includes('blur(20px)') && r.playing.radius === '18px', J(r.playing));
    check('it starts in the bottom-right corner, 16px in', r.playing.corner.right === 16 && r.playing.corner.bottom === 16, J(r.playing.corner));
    check('every control is at least 32px', r.playing.sizes.every(s => s >= 32), J(r.playing.sizes));
    check('every control has a name', r.playing.names.every(Boolean) && r.playing.names.includes('Previous track') && r.playing.names.includes('Next track') && r.playing.names.includes('Volume') && r.playing.names.includes('Move the music player'), J(r.playing.names));
    check('track changes are announced politely', r.playing.live === 'polite');
    check('its text uses the measured smoke colours', r.playing.text === 'rgb(244, 246, 249)' && r.playing.muted === 'rgb(201, 206, 214)', J([r.playing.text, r.playing.muted]));
    check('pause keeps the player open and says "Paused"', r.paused.shown && r.paused.status === 'Paused' && r.paused.play === 'Play' && r.paused.pressed === 'true' && r.paused.stubPaused, J(r.paused));
    check('the volume slider sets the volume', r.volumeNow.state === 0.8 && r.volumeNow.audio === 0.8, J(r.volumeNow));
    check('dragging the bar moves the player with the pointer', r.dragged.left === 100 && r.dragged.top === 130, J(r.dragged));
    check('where it was dropped is remembered', r.saved && r.saved.x === 100 && r.saved.y === 130, J(r.saved));
    check('dragged past the top-left it stops 8px in', r.topLeft.left === 8 && r.topLeft.top === 8, J(r.topLeft));
    check('dragged past the bottom-right it stops 8px in', r.width - r.bottomRight.right === 8 && r.height - r.bottomRight.bottom === 8, J([r.bottomRight, r.width, r.height]));
    check('pressing on close or minimize does not start a drag, even if the pointer then moves', !r.closeDragged && J(r.notDraggedByClose) === J(r.bottomRight), J([r.closeDragged, r.notDraggedByClose, r.bottomRight]));
    check('keyboard focus on the grip shows the accent ring, and only that one', r.ring.visible && r.ring.outline === 'solid' && r.ring.colour === 'rgb(255, 159, 28)' && r.ring.shadow === 'none', J(r.ring));
    check('an arrow key moves it 16px', r.afterRight.left === r.beforeKeys.left + 16 && r.afterRight.top === r.beforeKeys.top, J([r.beforeKeys, r.afterRight]));
    check('Shift with an arrow key moves it 64px', r.afterShiftDown.top === r.afterRight.top + 64, J([r.afterRight, r.afterShiftDown]));
    check('a keyboard move is remembered too', r.keySaved && r.keySaved.x === r.afterShiftDown.left && r.keySaved.y === r.afterShiftDown.top, J(r.keySaved));
    check('the close button stops the music and hides the player', r.closed.hidden && r.closed.display === 'none' && r.closed.stubPaused && r.closed.open === false, J(r.closed));
    check('closing hands focus back to "magic" and clears pressed', r.closed.focus && r.closed.pressed === 'false', J(r.closed));
    check('"magic" again reopens the one player where it was left', r.reopened.shown && r.reopened.panels === 1 && r.reopened.box.left === r.afterShiftDown.left && r.reopened.box.top === r.afterShiftDown.top, J(r.reopened));
    check('the pink theme gives the player its lighter pink accent', r.pinkAccent === '#ff9dd5', r.pinkAccent);
    check('the light theme keeps the measured orange, not its own darker accent', r.lightAccent === '#ff9f1c', r.lightAccent);

    await app.reload();
    const again = await app.run(async stub => {
      new Function(`(${stub})()`)();
      document.getElementById('secretMagic').click();
      await __settled();
      return __rect(document.getElementById('secretPlayer'));
    }, STUB_AUDIO.toString());
    check('after a reload the player opens where it was left', again.left === r.afterShiftDown.left && again.top === r.afterShiftDown.top, JSON.stringify([again, r.afterShiftDown]));
    check('no page errors with the player', app.errors.filter(error => !/Unable to preload the VPS database/.test(error)).length === 0, app.errors.join('\n'));
  } finally {
    await app.close();
  }
}

// 12b. Jason's changes (2026-11-17): long lines slide instead of wrapping,
//      a progress slider, minimize to one row in the bottom-right corner, the X
//      and the grip lined up with the content, a smaller play button and a
//      smaller right-aligned source link.
{
  const app = await openApp({ windowSize: [1280, 800] });
  try {
    const r = await app.run(async stub => {
      new Function(`(${stub})()`)();
      const magic = document.getElementById('secretMagic');
      magic.click();
      await __tick();
      __stubAudio.arrive();
      await __settled();
      const root = document.getElementById('secretPlayer');
      const q = s => root.querySelector(s);
      const width = document.documentElement.clientWidth;
      const height = document.documentElement.clientHeight;
      const box = root.getBoundingClientRect();
      const contentLeft = box.left + 1 + 12;
      const contentRight = box.right - 1 - 12;
      const xMark = q('.secret-player-close path').getBoundingClientRect();
      const gripDot = q('.secret-player-grip circle').getBoundingClientRect();
      // The title's letters, not its box: a sliding title's box reaches into
      // the side padding to make room for the edge fades.
      const titleRange = document.createRange();
      titleRange.selectNodeContents(q('.secret-player-title').firstElementChild);
      const titleBox = titleRange.getBoundingClientRect();
      const xButton = q('.secret-player-close').getBoundingClientRect();
      const statusBox = q('.secret-player-status').getBoundingClientRect();
      const align = {
        xToEdge: +(contentRight - xMark.right).toFixed(1), gripToEdge: +(gripDot.left - contentLeft).toFixed(1),
        titleToEdge: +(titleBox.left - contentLeft).toFixed(1),
        xMiddle: +((xButton.top + xButton.bottom) / 2 - (statusBox.top + statusBox.bottom) / 2).toFixed(1)
      };
      const sizes = { play: Math.round(q('[data-action="play"]').getBoundingClientRect().height), others: [...root.querySelectorAll('.secret-player-icon, [data-action="previous"], [data-action="next"]')].map(b => Math.round(b.getBoundingClientRect().height)) };
      const source = q('.secret-player-source');
      const controls = q('.secret-player-controls');
      const withLink = { player: __rect(root), controls: Math.round(controls.getBoundingClientRect().height) };
      source.hidden = true;
      const withoutLink = { player: __rect(root), controls: Math.round(controls.getBoundingClientRect().height) };
      source.hidden = false;
      const sourceBox = source.getBoundingClientRect();
      const controlsBox = controls.getBoundingClientRect();
      const link = {
        position: getComputedStyle(source).position, icon: Boolean(source.querySelector('svg')), text: source.textContent.trim(),
        name: source.getAttribute('aria-label'), rightGap: +(contentRight - sourceBox.right).toFixed(1),
        width: Math.round(sourceBox.width), height: Math.round(sourceBox.height),
        middle: +((sourceBox.top + sourceBox.bottom) / 2 - (controlsBox.top + controlsBox.bottom) / 2).toFixed(1),
        same: JSON.stringify(withLink) === JSON.stringify(withoutLink), withLink, withoutLink
      };

      // Volume: a speaker button that opens a slider above it.
      const speaker = q('.secret-player-volume-button');
      const pop = q('.secret-player-volume-pop');
      const slider = q('.secret-player-volume');
      const playButton = q('[data-action="play"]').getBoundingClientRect();
      const closedAtFirst = { hidden: pop.hidden, shown: pop.getClientRects().length, expanded: speaker.getAttribute('aria-expanded'), controls: speaker.getAttribute('aria-controls') === pop.id, icon: speaker.dataset.icon };
      const mouseClick = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      mouseClick(speaker);
      const popBox = pop.getBoundingClientRect();
      const speakerBox = speaker.getBoundingClientRect();
      const opened = { hidden: pop.hidden, expanded: speaker.getAttribute('aria-expanded'), above: popBox.bottom <= speakerBox.top, inside: popBox.left >= box.left && popBox.right <= box.right,
        leftOfPlay: speakerBox.right <= playButton.left, edge: +(speakerBox.left - (box.left + 1 + 12)).toFixed(1), focusMoved: document.activeElement === slider };
      slider.value = '0';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      const muted = { icon: speaker.dataset.icon, volume: VPS_SECRET_MUSIC.state().volume };
      slider.value = '30';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      const low = speaker.dataset.icon;
      slider.value = '80';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      const high = speaker.dataset.icon;
      mouseClick(speaker);
      const secondPress = pop.hidden;
      // From the keyboard: Enter on the button opens it with focus on the slider, Escape closes it back to the button.
      speaker.focus();
      speaker.click();
      const keyOpen = { hidden: pop.hidden, focus: document.activeElement === slider };
      // Arrow keys fire `change` on every step; the slider stays open under them.
      slider.value = '70';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 800));
      keyOpen.afterArrows = pop.hidden;
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const escaped = { hidden: pop.hidden, focus: document.activeElement === speaker, expanded: speaker.getAttribute('aria-expanded') };
      mouseClick(speaker);
      slider.focus();
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      const outside = pop.hidden;
      const focusKept = document.activeElement === speaker;
      // Escape works even when focus is not inside it (a Mac browser's click leaves focus where it was).
      q('[data-action="next"]').focus();
      mouseClick(speaker);
      const escapeSetup = { open: !pop.hidden, focusOutside: !speaker.closest('.secret-player-volume-group').contains(document.activeElement) };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const escapedFromPage = escapeSetup.open && escapeSetup.focusOutside && pop.hidden;
      // A finger lifting is not the pointer leaving.
      mouseClick(speaker);
      speaker.closest('.secret-player-volume-group').dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'touch' }));
      await new Promise(resolve => setTimeout(resolve, 800));
      const touchLeft = pop.hidden;
      if (pop.hidden) mouseClick(speaker); // still open after the touch, as it should be
      speaker.closest('.secret-player-volume-group').dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      const lingering = pop.hidden;
      await new Promise(resolve => setTimeout(resolve, 800));
      const leftAlone = pop.hidden;
      mouseClick(speaker);
      slider.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      speaker.closest('.secret-player-volume-group').dispatchEvent(new PointerEvent('pointerleave'));
      await new Promise(resolve => setTimeout(resolve, 800));
      const whileHeld = pop.hidden;
      slider.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 800));
      const afterRelease = pop.hidden;
      mouseClick(speaker);
      slider.focus();
      q('[data-action="next"]').focus();
      const tabbedAway = pop.hidden;
      const volume = { closedAtFirst, opened, muted, low, high, secondPress, keyOpen, escaped, outside, focusKept, escapedFromPage, touchLeft, lingering, leftAlone, whileHeld, afterRelease, tabbedAway };

      // A line too long for the player slides; a short one stays still.
      const titleLine = q('.secret-player-title');
      const inner = titleLine.firstElementChild;
      const keep = inner.textContent;
      inner.textContent = 'Symphony No. 1 in C Minor, Op. 68 - Adagio - Più andante - Allegro non troppo, ma con brio';
      window.dispatchEvent(new Event('resize'));
      const extra = titleLine.scrollWidth - titleLine.clientWidth;
      const long = { scrolling: titleLine.classList.contains('is-scrolling'), distance: titleLine.style.getPropertyValue('--scroll-distance'), extra,
        anim: getComputedStyle(inner).animationName, oneLine: Math.round(titleLine.getBoundingClientRect().height) <= 20, wraps: getComputedStyle(titleLine).whiteSpace };
      // One way only: sampled across the loop, it moves left (or holds) to
      // the end, then is back at the start, never sliding back.
      const slide = inner.getAnimations()[0];
      const loop = parseFloat(titleLine.style.getPropertyValue('--scroll-time')) * 1000;
      const at = share => {
        slide.currentTime = loop * share;
        const style = getComputedStyle(inner);
        return { x: +new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform).m41.toFixed(1), o: +(+style.opacity).toFixed(2) };
      };
      const samples = [0, 0.1, 0.3, 0.5, 0.7, 0.8, 0.85, 0.9, 0.925, 0.95, 0.99].map(at);
      // Every letter clear of the 10px edge fades: the first one at rest, the
      // last one at the end of the slide. The resting text lines up with the
      // composer line below it.
      const glyphs = () => {
        const range = document.createRange();
        range.selectNodeContents(inner);
        const text = range.getBoundingClientRect();
        const box = titleLine.getBoundingClientRect();
        return { fromLeft: +(text.left - box.left).toFixed(1), fromRight: +(box.right - text.right).toFixed(1), left: +text.left.toFixed(1) };
      };
      at(0);
      long.atRest = glyphs();
      const metaRange = document.createRange();
      metaRange.selectNodeContents(q('.secret-player-meta').firstElementChild);
      long.metaLeft = +metaRange.getBoundingClientRect().left.toFixed(1);
      long.metaScrolling = q('.secret-player-meta').classList.contains('is-scrolling');
      at(0.85);
      long.atEnd = glyphs();
      // The fade is exactly as wide as the room the text gets for it.
      const mask = getComputedStyle(titleLine).maskImage || getComputedStyle(titleLine).webkitMaskImage;
      long.fadeStop = parseFloat((mask.match(/(\d+(?:\.\d+)?)px/) || [])[1]);
      long.room = parseFloat(getComputedStyle(inner).paddingLeft);
      // A refit with nothing changed leaves the slide running (the full
      // player's sliding line is wider than its still one).
      slide.currentTime = 1234;
      window.dispatchEvent(new Event('resize'));
      long.kept = inner.getAnimations()[0] === slide && slide.currentTime >= 1234;
      slide.currentTime = 0;
      long.samples = samples;
      long.loop = loop;
      // Only a little too long: the loop keeps its 7-second floor.
      let nearly = 'A';
      while (true) {
        inner.textContent = nearly;
        const over = titleLine.scrollWidth - titleLine.clientWidth;
        if (over >= 10) break;
        nearly += 'W';
      }
      window.dispatchEvent(new Event('resize'));
      long.nearly = { extra: titleLine.scrollWidth - titleLine.clientWidth, time: titleLine.style.getPropertyValue('--scroll-time') };
      inner.textContent = 'Short';
      window.dispatchEvent(new Event('resize'));
      const short ={ scrolling: titleLine.classList.contains('is-scrolling'), anim: getComputedStyle(inner).animationName };
      inner.textContent = keep;
      window.dispatchEvent(new Event('resize'));

      // Progress.
      const seek = q('.secret-player-seek');
      const early = { max: seek.max, label: seek.getAttribute('aria-label'), expected: VPS_SECRET_MUSIC.current().seconds };
      __stubAudio.duration = 200;
      __stubAudio.currentTime = 50;
      __stubAudio.dispatchEvent(new Event('timeupdate'));
      const elapsed = q('.secret-player-elapsed');
      const total = q('.secret-player-total');
      const seekBox = seek.getBoundingClientRect();
      const progress = { max: seek.max, value: seek.value, elapsed: elapsed.textContent, total: total.textContent, valuetext: seek.getAttribute('aria-valuetext'), share: root.style.getPropertyValue('--progress'),
        order: elapsed.getBoundingClientRect().right <= seekBox.left && total.getBoundingClientRect().left >= seekBox.right,
        leftEdge: +(elapsed.getBoundingClientRect().left - contentLeft).toFixed(1), rightEdge: +(contentRight - total.getBoundingClientRect().right).toFixed(1) };
      seek.value = '120';
      seek.dispatchEvent(new Event('input', { bubbles: true }));
      const jumped = __stubAudio.currentTime;

      // Minimize from the default corner, then expand back to it. The volume
      // slider is left open first: minimizing closes it.
      const before = __rect(root);
      const minimize = q('.secret-player-minimize');
      q('.secret-player-volume-button').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      const popBeforeMini = q('.secret-player-volume-pop').hidden;
      minimize.click();
      const popOnMini = q('.secret-player-volume-pop').hidden;
      const flying = root.classList.contains('is-flying');
      await new Promise(resolve => setTimeout(resolve, 600));
      const small = __rect(root);
      const hiddenParts = ['.secret-player-status', '.secret-player-meta', '.secret-player-progress', '[data-action="previous"]', '[data-action="next"]', '.secret-player-volume-button', '.secret-player-volume', '.secret-player-source', '.secret-player-controls [data-action="play"]']
        .filter(s => q(s).getClientRects().length > 0);
      const rowParts = ['.secret-player-grip', '.secret-player-mini-play', '.secret-player-title', '.secret-player-minimize', '.secret-player-close']
        .map(s => q(s).getBoundingClientRect()).map(b => Math.round((b.top + b.bottom) / 2));
      const clear = ['helpBtn', 'themeToggle'].map(id => document.getElementById(id).getBoundingClientRect());
      const covers = (a, b) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
      const mini = {
        coversHeader: clear.some(r => covers(root.getBoundingClientRect(), r)),
        rightGap: width - small.right, bottomGap: height - small.bottom, top: small.top, height: Math.round(root.getBoundingClientRect().height), flying,
        expanded: minimize.getAttribute('aria-expanded'), label: minimize.getAttribute('aria-label'),
        line: getComputedStyle(root, '::after').content, shown: hiddenParts, rows: rowParts,
        saved: localStorage.getItem('vpxs-yml-secret-player-position'),
        // The buttons a keyboard reaches, in the order it reaches them, and
        // where each sits on screen.
        tabbing: [...root.querySelectorAll('button, input, a[href]')].filter(el => getComputedStyle(el).display !== 'none' && el.getClientRects().length)
          .map(el => Math.round(el.getBoundingClientRect().left)),
        miniPlay: q('.secret-player-mini-play').getAttribute('aria-label')
      };
      q('.secret-player-mini-play').click();
      await __tick();
      const miniPaused ={ label: q('.secret-player-mini-play').getAttribute('aria-label'), wanted: VPS_SECRET_MUSIC.state().wanted };
      q('.secret-player-mini-play').click();
      await __tick();
      __stubAudio.arrive();
      await __tick();
      __drag(q('.secret-player-bar'), [small.left + 15, small.top + 15], [400, 300]);
      const draggedMini = { saved: localStorage.getItem('vpxs-yml-secret-player-position'), left: __rect(root).left, top: __rect(root).top };
      // Dragged off the corner, a resize does not pull it back there.
      window.dispatchEvent(new Event('resize'));
      draggedMini.afterResize = __rect(root).top;
      q('.secret-player-minimize').click();
      await new Promise(resolve => setTimeout(resolve, 600));
      const back = __rect(root);
      const restored = { box: back, inline: root.style.left, before, expanded: q('.secret-player-minimize').getAttribute('aria-expanded'),
        popBeforeMini, popOnMini, popAfter: q('.secret-player-volume-pop').hidden, popExpanded: q('.secret-player-volume-button').getAttribute('aria-expanded') };

      // Minimize from a moved spot, then expand back to that spot.
      __drag(q('.secret-player-bar'), [back.left + 60, back.top + 10], [300, 260]);
      const spot = __rect(root);
      q('.secret-player-minimize').click();
      await new Promise(resolve => setTimeout(resolve, 600));
      q('.secret-player-minimize').click();
      await new Promise(resolve => setTimeout(resolve, 600));
      const spotBack = __rect(root);

      // Close while minimized: next time it opens full, where it was.
      q('.secret-player-minimize').click();
      await new Promise(resolve => setTimeout(resolve, 600));
      q('.secret-player-close').click();
      await __tick();
      magic.click();
      await __settled();
      const reopened = { minimized: root.classList.contains('is-minimized'), box: __rect(root), meta: getComputedStyle(q('.secret-player-meta')).display };
      // A press on the progress slider that ends without a move lets go.
      const seekNow = q('.secret-player-seek');
      seekNow.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      seekNow.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      __stubAudio.duration = 300;
      __stubAudio.currentTime = 30;
      __stubAudio.dispatchEvent(new Event('timeupdate'));
      const released = seekNow.value;
      // A click on a line holds it; another lets it go.
      const line = q('.secret-player-title');
      line.click();
      const held = line.classList.contains('is-held');
      line.click();
      const letGo = !line.classList.contains('is-held');
      return { width, height, align, sizes, link, volume, long, short, early, progress, jumped, mini, miniPaused, draggedMini, restored, spot, spotBack, reopened, released, held, letGo };
    }, STUB_AUDIO.toString());
    const J = JSON.stringify;
    check('the X lines up with the right edge of the content below it', Math.abs(r.align.xToEdge) <= 1.5, J(r.align));
    check("the grip's dots line up with the title's left edge", Math.abs(r.align.gripToEdge) <= 1.5 && Math.abs(r.align.titleToEdge) <= 0.5, J(r.align));
    check('the X sits level with the status text', Math.abs(r.align.xMiddle) <= 1, J(r.align));
    check('the play button is 36px, the others 32px', r.sizes.play === 36 && r.sizes.others.every(s => s === 32), J(r.sizes));
    check('the source link is an icon with a name, no text', r.link.icon && r.link.text === '' && /^Internet Archive: .+ \(opens in a new tab\)$/.test(r.link.name || ''), J(r.link));
    check('the source icon floats: the player and its controls are the same size with or without it', r.link.position === 'absolute' && r.link.same, J(r.link));
    check('the source icon sits at the right edge, level with the controls, 24px', Math.abs(r.link.rightGap) <= 1 && Math.abs(r.link.middle) <= 1 && r.link.width === 24 && r.link.height === 24, J(r.link));
    const v = r.volume;
    check('volume is a speaker button, its slider hidden until pressed', v.closedAtFirst.hidden && v.closedAtFirst.shown === 0 && v.closedAtFirst.expanded === 'false' && v.closedAtFirst.controls && v.closedAtFirst.icon === 'volume1', J(v.closedAtFirst));
    check('the speaker sits at the left edge of the controls', v.opened.leftOfPlay && Math.abs(v.opened.edge) <= 1, J(v.opened));
    check('pressing it opens a slider above it, inside the player, without taking focus from a mouse', !v.opened.hidden && v.opened.expanded === 'true' && v.opened.above && v.opened.inside && !v.opened.focusMoved, J(v.opened));
    check('the slider sets the volume, and the speaker shows none, low or high', v.muted.volume === 0 && v.muted.icon === 'volume0' && v.low === 'volume1' && v.high === 'volume2', J([v.muted, v.low, v.high]));
    check('a second press closes it', v.secondPress === true);
    check('opened from the keyboard, focus goes to the slider; Escape closes it back to the button', !v.keyOpen.hidden && v.keyOpen.focus && v.escaped.hidden && v.escaped.focus && v.escaped.expanded === 'false', J([v.keyOpen, v.escaped]));
    check('the arrow keys do not close it under a keyboard user', v.keyOpen.afterArrows === false, J(v.keyOpen));
    check('a press anywhere else closes it, and focus on the slider goes back to the speaker, not the page', v.outside === true && v.focusKept === true, J([v.outside, v.focusKept]));
    check('Escape closes it even when focus is not inside it', v.escapedFromPage === true);
    check('a finger lifting does not close it; only a mouse or pen leaving does', v.touchLeft === false, String(v.touchLeft));
    check('the pointer leaving it closes it after a moment, not at once', v.lingering === false && v.leftAlone === true, J([v.lingering, v.leftAlone]));
    check('it stays open while the slider is held, and closes once let go', v.whileHeld === false && v.afterRelease === true, J([v.whileHeld, v.afterRelease]));
    check('focus moving out of it closes it', v.tabbedAway === true);
    check('a title too long for the player stays on one line and slides', r.long.scrolling && r.long.oneLine && r.long.wraps === 'nowrap' && r.long.anim === 'secret-player-slide', J(r.long));
    {
      const s = r.long.samples;
      const end = -r.long.extra;
      const forward = s.slice(0, 8).every((p, i) => i === 0 || p.x <= s[i - 1].x + 0.5);
      check('it holds at the start, then slides one way to the end', s[0].x === 0 && s[1].x === 0 && s[3].x < 0 && Math.abs(s[6].x - end) <= 1 && forward, J(s));
      check('at the end it fades and starts again from the beginning, never sliding back', s[8].o < 1 && s[9].x === 0 && s[10].x === 0 && s[10].o === 1, J(s));
      check('the loop is at least 7 seconds, at about 30px a second', r.long.loop >= 7000 && r.long.loop >= (r.long.extra / 30 / 0.65) * 1000 - 100, J([r.long.loop, r.long.extra]));
    }
    check('it slides exactly as far as the hidden part', r.long.distance === `${-r.long.extra}px` && r.long.extra > 0, J(r.long));
    check('the first letter at rest and the last at the end sit clear of the edge fades', r.long.atRest.fromLeft >= 9.5 && r.long.atEnd.fromRight >= 9.5 && r.long.atEnd.fromRight <= 11, J([r.long.atRest, r.long.atEnd]));
    check('the edge fade is exactly as wide as the room the text gets for it', r.long.fadeStop === 10 && r.long.room === 10, J([r.long.fadeStop, r.long.room]));
    check('in the full player, a refit with nothing changed leaves the slide running', r.long.kept === true, J(r.long.kept));
    check('the sliding title still lines up with the composer line', Math.abs(r.long.atRest.left - r.long.metaLeft) <= 1, J([r.long.atRest, r.long.metaLeft]));
    check('a title that fits does not move', !r.short.scrolling && r.short.anim === 'none', J(r.short));
    check('before the file reports its length, the pool length is used', r.early.max === String(r.early.expected) && r.early.label === 'Position in track', J(r.early));
    check('the progress slider follows the track', r.progress.max === '200' && r.progress.value === '50' && r.progress.valuetext === '0:50 of 3:20' && r.progress.share === '0.2500', J(r.progress));
    check('the time so far is on the left of the slider, the length on the right', r.progress.elapsed === '0:50' && r.progress.total === '3:20' && r.progress.order && Math.abs(r.progress.leftEdge) <= 1 && Math.abs(r.progress.rightEdge) <= 1, J(r.progress));
    check('moving the progress slider jumps within the track', r.jumped === 120, String(r.jumped));
    check('minimize sends the player to the bottom-right corner, 16px in', r.mini.flying && r.mini.rightGap === 16 && r.mini.bottomGap === 16, J(r.mini));
    check('minimized, it covers nothing in the header', !r.mini.coversHeader, J(r.mini));
    check('minimized, it is one row',r.mini.height <= 50 && new Set(r.mini.rows).size === 1, J(r.mini));
    check('minimized, everything but grip, play, title, expand and close is hidden', r.mini.shown.length === 0, J(r.mini.shown));
    check('minimized, the progress shows as a line', r.mini.line === '""', r.mini.line);
    check('the minimize button becomes "Expand the player"', r.mini.expanded === 'false' && r.mini.label === 'Expand the player', J(r.mini));
    check('minimizing does not overwrite the remembered spot', r.mini.saved === null, r.mini.saved);
    check("minimized, the keyboard meets the row's buttons left to right", r.mini.tabbing.length === 4 && r.mini.tabbing.every((x, i, all) => i === 0 || x > all[i - 1]), J(r.mini.tabbing));
    check("the minimized row's play button pauses and plays", r.mini.miniPlay === 'Pause' && r.miniPaused.label === 'Play' && r.miniPaused.wanted === false, J([r.mini.miniPlay, r.miniPaused]));
    check('a press on the progress slider without a move lets go, so it keeps following', r.released === '30', r.released);
    check('a click on a sliding line holds it, another lets it go', r.held && r.letGo, J([r.held, r.letGo]));
    check('dragging the minimized player is not remembered as the spot', r.draggedMini.saved === null, J(r.draggedMini));
    check('dragged off the corner, a resize does not pull it back there', r.draggedMini.afterResize === r.draggedMini.top, J(r.draggedMini));
    check('the loop of a line only a little too long keeps its 7-second floor', r.long.nearly.extra > 2 && r.long.nearly.extra < 60 && r.long.nearly.time === '7.0s', J(r.long.nearly));
    check('minimizing closes the volume slider, and it stays closed on expand', r.restored.popBeforeMini === false && r.restored.popOnMini === true && r.restored.popAfter === true && r.restored.popExpanded === 'false', J(r.restored));
    check('expand returns it to the bottom-right corner it came from', r.restored.box.right === r.width - 16 && r.restored.box.bottom === r.height - 16 && r.restored.inline === '' && r.restored.expanded === 'true', J([r.restored, r.width, r.height]));
    check('expand returns a moved player to its spot', r.spotBack.left === r.spot.left && r.spotBack.top === r.spot.top, J([r.spot, r.spotBack]));
    check('closed while minimized, it reopens full, where it was', !r.reopened.minimized && r.reopened.meta !== 'none' && r.reopened.box.left === r.spot.left && r.reopened.box.top === r.spot.top, J(r.reopened));
    check('no page errors in the new parts', app.errors.filter(error => !/Unable to preload the VPS database/.test(error)).length === 0, app.errors.join('\n'));
  } finally {
    await app.close();
  }
}

// 12c. A wide window: minimized from a spot near the top, the player still
//      goes to the bottom-right corner (Jason, 2026-11-17).
{
  const app = await openApp({ windowSize: [1920, 900] });
  try {
    const wide = await app.run(async stub => {
      new Function(`(${stub})()`)();
      document.getElementById('secretMagic').click();
      await __tick();
      __stubAudio.arrive();
      await __settled();
      const root = document.getElementById('secretPlayer');
      const box0 = __rect(root);
      __drag(root.querySelector('.secret-player-bar'), [box0.left + 60, box0.top + 10], [300, 60]);
      VPS_SECRET_MUSIC.minimize();
      await new Promise(resolve => setTimeout(resolve, 600));
      const box = root.getBoundingClientRect();
      return { bottomGap: Math.round(document.documentElement.clientHeight - box.bottom), rightGap: Math.round(document.documentElement.clientWidth - box.right) };
    }, STUB_AUDIO.toString());
    check('minimized from near the top of a wide window, it still goes to the bottom-right corner', wide.bottomGap === 16 && wide.rightGap === 16, JSON.stringify(wide));
  } finally {
    await app.close();
  }
}

// 12d. A size change during the minimize flight is caught up when it lands.
{
  const app = await openApp({ windowSize: [1280, 800] });
  try {
    const flight = await app.run(async stub => {
      new Function(`(${stub})()`)();
      document.getElementById('secretMagic').click();
      await __tick();
      __stubAudio.arrive();
      await __settled();
      const root = document.getElementById('secretPlayer');
      VPS_SECRET_MUSIC.minimize();
      // The player narrows mid-flight; the resize check is skipped while it flies.
      root.style.width = '200px';
      window.dispatchEvent(new Event('resize'));
      await new Promise(resolve => setTimeout(resolve, 600));
      const box = root.getBoundingClientRect();
      return { rightGap: Math.round(document.documentElement.clientWidth - box.right), bottomGap: Math.round(document.documentElement.clientHeight - box.bottom), flying: root.classList.contains('is-flying') };
    }, STUB_AUDIO.toString());
    check('a size change during the flight to the corner is caught up when it lands', flight.rightGap === 16 && flight.bottomGap === 16 && !flight.flying, JSON.stringify(flight));
    // The player was never dragged. Expand, then minimize again before it
    // lands, then expand: it must still be anchored by the stylesheet.
    const quick = await app.run(async () => {
      const root = document.getElementById('secretPlayer');
      root.style.width = '';
      const press = () => root.querySelector('.secret-player-minimize').click();
      press();
      await new Promise(resolve => setTimeout(resolve, 100));
      press();
      await new Promise(resolve => setTimeout(resolve, 600));
      press();
      await new Promise(resolve => setTimeout(resolve, 600));
      return { left: root.style.left, top: root.style.top, minimized: root.classList.contains('is-minimized') };
    });
    check('a quick expand then minimize still returns an unmoved player to its stylesheet corner', !quick.minimized && quick.left === '' && quick.top === '', JSON.stringify(quick));
  } finally {
    await app.close();
  }
}

// 12e. Jason, 2026-11-17: a short buffering pause leaves the playing dot
//      pulsing (it was swapping to the loading ring and back, restarting the
//      pulse with a jump), and minimized, every title is a ticker that comes
//      in at the right edge, leaves past the left, and gives way to the
//      station name fading in and out.
{
  const app = await openApp({ windowSize: [1280, 800] });
  try {
    const t = await app.run(async stub => {
      new Function(`(${stub})()`)();
      document.getElementById('secretMagic').click();
      await __tick();
      __stubAudio.arrive();
      await __settled();
      const root = document.getElementById('secretPlayer');
      const q = s => root.querySelector(s);
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const dot = q('.secret-player-dot');
      const pulse = dot.getAnimations()[0];
      // The pulse animates the painted circle's radius, not a scale, and the
      // dot's box never changes size (Firefox rounded a scaled 8px dot to 8px
      // or 6px). Sampled at the start, a quarter and the middle of the loop.
      const radius = [0, 400, 800].map(ms => {
        pulse.currentTime = ms;
        const s = getComputedStyle(dot);
        const box = dot.getBoundingClientRect();
        return { r: +parseFloat(s.getPropertyValue('--sp-dot-r')).toFixed(2), transform: s.transform, w: +box.width.toFixed(2), h: +box.height.toFixed(2) };
      });
      pulse.currentTime = 0;
      __stubAudio.dispatchEvent(new Event('waiting'));
      await wait(300);
      const briefDuring = root.dataset.state;
      __stubAudio.dispatchEvent(new Event('playing'));
      await __tick();
      const brief = { during: briefDuring, after: root.dataset.state, same: dot.getAnimations()[0] === pulse };
      // The grace is cancelled by sound coming back, so a later wait starts afresh.
      await wait(900);
      brief.later = root.dataset.state;
      __stubAudio.dispatchEvent(new Event('waiting'));
      await wait(1200);
      const stalled = { during: root.dataset.state, dot: getComputedStyle(dot).animationName };
      __stubAudio.dispatchEvent(new Event('playing'));
      await __tick();
      stalled.after = root.dataset.state;
      // The colours by state (Jason, 2026-11-17): the problem ring, read in
      // the browser by setting the state the player sets when it gives up.
      root.dataset.state = 'problem';
      const ps = getComputedStyle(dot);
      const problemDot = { ring: ps.borderTopWidth, colour: ps.borderTopColor, gap: ps.borderRightColor, img: ps.backgroundImage, bg: ps.backgroundColor, anim: ps.animationName };
      root.dataset.state = 'playing';

      // A title that fits, set before minimizing, so it is first measured
      // still (a running ticker's offset would make any title look long).
      q('.secret-player-title').firstElementChild.textContent = 'Short';
      window.dispatchEvent(new Event('resize'));
      VPS_SECRET_MUSIC.minimize();
      await wait(600);
      const now = q('.secret-player-now');
      const line = q('.secret-player-title');
      const words = line.firstElementChild;
      const station = q('.secret-player-ticker-station');
      const run = text => {
        words.textContent = text;
        window.dispatchEvent(new Event('resize'));
        const width = line.clientWidth;
        const textWidth = words.offsetWidth;
        const loop = parseFloat(now.style.getPropertyValue('--ticker-time')) * 1000;
        const slideMs = (width + textWidth) / 40 * 1000;
        const anims = [words.getAnimations()[0], station.getAnimations()[0]];
        const at = ms => {
          anims.forEach(a => { if (a) a.currentTime = ms; });
          const range = document.createRange();
          range.selectNodeContents(words);
          const tr = range.getBoundingClientRect();
          const box = line.getBoundingClientRect();
          return { fromLeft: +(tr.left - box.left).toFixed(1), rightPastLeft: +(box.left - tr.right).toFixed(1), station: +(+getComputedStyle(station).opacity).toFixed(2) };
        };
        const out = {
          ticker: now.classList.contains('is-ticker'), width, textWidth, loop, slideMs,
          names: anims.map(a => a && a.animationName),
          sameLength: anims.every(a => a && Math.abs(a.effect.getComputedTiming().duration - loop) < 1),
          start: at(0), middle: at(slideMs / 2), gone: at(slideMs + 1), held: at(slideMs + 300 + 500 + 1250), last: at(loop - 5)
        };
        anims.forEach(a => { if (a) a.currentTime = 0; });
        return out;
      };
      const short = run('Short');
      const long = run('Symphony No. 1 in C Minor, Op. 68 - Adagio - Più andante - Allegro non troppo, ma con brio');
      const lineBox = line.getBoundingClientRect();
      station.getAnimations()[0].currentTime = long.slideMs + 2000;
      const stationBox = station.getBoundingClientRect();
      const place = { inside: stationBox.left >= lineBox.left - 0.5 && stationBox.right <= lineBox.right + 0.5,
        centred: Math.abs((stationBox.left + stationBox.right) / 2 - (lineBox.left + lineBox.right) / 2) <= 1,
        sameRow: Math.abs((stationBox.top + stationBox.bottom) / 2 - (lineBox.top + lineBox.bottom) / 2) <= 2,
        text: station.textContent, hidden: station.getAttribute('aria-hidden'), titleText: line.textContent };
      // Nothing changed: the ticker keeps running rather than restarting.
      const running = words.getAnimations()[0];
      running.currentTime = 2345;
      window.dispatchEvent(new Event('resize'));
      const kept = words.getAnimations()[0] === running && running.currentTime >= 2345;
      // A tap on the title holds the ticker and the station name together.
      line.click();
      const held = [words, station].map(el => el.getAnimations()[0].playState);
      line.click();
      q('.secret-player-minimize').click();
      await wait(600);
      const expanded = { ticker: now.classList.contains('is-ticker'), station: station.getClientRects().length, minimized: root.classList.contains('is-minimized') };
      return { brief, stalled, short, long, place, kept, held, expanded, radius, problemDot };
    }, STUB_AUDIO.toString());
    const J = JSON.stringify;
    check('the playing dot pulses its painted radius from 4px to 2.8px, smoothly, with no scale', t.radius[0].r === 4 && t.radius[1].r > 2.8 && t.radius[1].r < 4 && t.radius[2].r === 2.8 && t.radius.every(x => x.transform === 'none'), J(t.radius));
    {
      const css = readFileSync(repoPath('css.src', 'secretMusic.css'), 'utf8');
      check('a browser without @property still gets a solid playing dot', /\.secret-player\[data-state="playing"\] \.secret-player-dot \{[^}]*--sp-dot-r: 4px;/.test(css));
    }
    check('unavailable: the dot is a red ring all round, still and empty', t.problemDot.ring === '2px' && t.problemDot.colour === 'rgb(255, 138, 128)' && t.problemDot.gap === 'rgb(255, 138, 128)' && t.problemDot.img === 'none' && t.problemDot.bg === 'rgba(0, 0, 0, 0)' && t.problemDot.anim === 'none', J(t.problemDot));
    check('the dot\'s box stays 8px through the pulse, so nothing beside it moves', t.radius.every(x => x.w === 8 && x.h === 8), J(t.radius));
    check('a buffering pause under a second keeps the dot pulsing, without a restart', t.brief.during === 'playing' && t.brief.after === 'playing' && t.brief.same && t.brief.later === 'playing', J(t.brief));
    check('a buffering pause over a second shows loading, and playing again after', t.stalled.during === 'loading' && t.stalled.dot === 'secret-player-turn' && t.stalled.after === 'playing', J(t.stalled));
    for (const [name, r] of [['a short title', t.short], ['a long title', t.long]]) {
      check(`minimized, ${name} runs as the ticker, with the station name on the same loop`, r.ticker && r.names[0] === 'secret-player-ticker' && r.names[1] === 'secret-player-ticker-station' && r.sameLength, J(r));
      check(`minimized, ${name} comes in at the right edge and leaves past the left`, Math.abs(r.start.fromLeft - r.width) <= 1 && r.middle.fromLeft < r.width && r.gone.rightPastLeft >= -1, J([r.width, r.start, r.middle, r.gone]));
      check(`minimized, ${name}: the station name is hidden while it crosses, shown after, and gone as it comes round`, r.start.station === 0 && r.middle.station === 0 && r.gone.station === 0 && r.held.station === 1 && r.last.station <= 0.05, J([r.start, r.middle, r.gone, r.held, r.last]));
      check(`minimized, ${name}: 40px a second, then 0.3 s, 0.5 s in, 2.5 s held, 0.5 s out`, Math.abs(r.loop - (r.slideMs + 3800)) <= 15, J([r.loop, r.slideMs]));
    }
    check('the station name sits centred in the title\'s spot, on the one row', t.place.inside && t.place.centred && t.place.sameRow, J(t.place));
    check('the station name is M-ROCJR 73.0 FM, hidden from screen readers, and not part of the title', t.place.text === 'M-ROCJR 73.0 FM' && t.place.hidden === 'true' && !t.place.titleText.includes('ROCJR'), J(t.place));
    check('a refit with nothing changed leaves the ticker running instead of restarting it', t.kept === true);
    check('a tap on the title holds the ticker and the station name together', t.held.every(s => s === 'paused'), J(t.held));
    check('expanded, the ticker stops and the station name is gone', !t.expanded.minimized && !t.expanded.ticker && t.expanded.station === 0, J(t.expanded));
  } finally {
    await app.close();
  }
}

// 13. A narrow window: a position saved on a wide screen is pulled back
//     inside this one, and the player adds no sideways scroll. Headless Chrome
//     will not go below 500px wide, so a real phone width (the 16px-gutter
//     rule, min(320px, 100vw - 32px)) is a by-eye check in the live test.
{
  const app = await openApp({ windowSize: [500, 800] });
  try {
    const phone = await app.run(async stub => {
      new Function(`(${stub})()`)();
      localStorage.setItem('vpxs-yml-secret-player-position', JSON.stringify({ x: 1200, y: 700 }));
      document.getElementById('secretMagic').click();
      await __settled();
      const root = document.getElementById('secretPlayer');
      __stubAudio.arrive();
      await __settled();
      return { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight, box: __rect(root), scroll: document.documentElement.scrollWidth };
    }, STUB_AUDIO.toString());
    check('in a narrow window the player keeps its 320px width', phone.box.width === Math.min(320, phone.width - 32), JSON.stringify(phone));
    check('a wide-screen position is pulled back inside the window, even after the text grows', phone.box.left >= 8 && phone.box.right <= phone.width - 8 && phone.box.bottom <= phone.height - 8, JSON.stringify(phone));
    check('the player adds no sideways scroll', phone.scroll <= phone.width, JSON.stringify(phone));
  } finally {
    await app.close();
  }
}

// 14. Less motion: the player's fade-in is switched off.
{
  const css = readFileSync(repoPath('css.src', 'secretMusic.css'), 'utf8');
  check('less motion switches off the fade-in', /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.secret-player \{ animation: none; \}/.test(css));
  const calm = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  check('less motion: no flight, no sliding, and long lines wrap in full', calm.includes('.secret-player.is-flying { transition: none; }')
    && calm.includes('.secret-player-line.is-scrolling .secret-player-scroll { animation: none; }')
    && calm.includes('.secret-player:not(.is-minimized) .secret-player-line { white-space: normal;'));
  check('less motion: the state dot does not pulse or turn', calm.includes('.secret-player-dot { animation: none !important; }'));
  check('unavailable: the dot is a red ring, a shape of its own', /\.secret-player\[data-state="problem"\] \.secret-player-dot \{\s*border: 2px solid var\(--sp-problem\);\s*background: none;/.test(css));
  check('the state colours: green playing, red unavailable, measured for 3:1 on the worst-case smoke', css.includes('--sp-playing: #4ade80;') && css.includes('--sp-problem: #ff8a80;'));
  check('keyboard focus and a held line pause the slide too', css.includes('.secret-player:has(:focus-visible) .secret-player-line.is-scrolling .secret-player-scroll') && css.includes('.secret-player-line.is-scrolling.is-held .secret-player-scroll'));
  check('keyboard focus only: a mouse click leaving a button focused does not freeze it', !css.includes('.secret-player:focus-within .secret-player-line'));
  check('the minimized ticker and its station name pause the same three ways', css.includes('.secret-player-now.is-ticker:hover :is(.secret-player-scroll, .secret-player-ticker-station)')
    && css.includes('.secret-player:has(:focus-visible) .secret-player-now.is-ticker :is(.secret-player-scroll, .secret-player-ticker-station)')
    && css.includes('.secret-player-title.is-held .secret-player-scroll') && css.includes('.secret-player-title.is-held ~ .secret-player-ticker-station'));
  check('less motion: no ticker either', calm.includes('.secret-player-now.is-ticker :is(.secret-player-scroll, .secret-player-ticker-station) { animation: none; }'));
}

report('secret-music');
