// Secret background music (Jason, 2026-11-16). Clicking the word "magic" in
// the footer opens a small floating player and plays this week's tracks, one
// after another, on a loop. Clicking "magic" again, or the player's close
// button, stops the music and hides the player. Also driven from the console:
// VPS_SECRET_MUSIC.toggle(), .next(), .setVolume(0.2), .playlist().
//
// The music streams from four Internet Archive collections, all public
// domain. The pool of tracks is js.src/secretMusicTracks.json, made by
// tools/secret-music-tracks.mjs; nothing is downloaded until the first start.
//
// Each week (Monday 00:00 UTC) picks 10 to 20 tracks from the pool. The week
// number is the seed, so every visitor hears the same set that week and it
// changes on its own, with nothing to schedule or push.
//
// Rules that shape it:
// 1. Browsers refuse sound until the visitor has clicked or pressed a key on
//    the page, so start() can be refused. The player then shows as paused,
//    and its play button (a real click) starts it.
// 2. A track on another site can vanish. One that fails is skipped; if every
//    track this week fails, the player says so and offers to try again.
// 3. The Archive can take ten seconds or more to start a file it has not
//    served lately, so the player shows "Loading" until sound arrives.
(() => {
  'use strict';

  const POOL = 'js.src/secretMusicTracks.json';
  const DEFAULT_VOLUME = 0.35;
  const MIN_TRACKS = 10;
  const MAX_TRACKS = 20;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const FIRST_MONDAY = Date.UTC(1970, 0, 5);
  const POSITION_KEY = 'vpxs-yml-secret-player-position';
  const EDGE = 8;
  const STALL_GRACE_MS = 1000;

  let audio = null;
  let volume = DEFAULT_VOLUME;
  let tracks = null;
  let pages = {};
  let loading = null;
  let index = 0;
  let open = false;      // the player is showing
  let wanted = false;    // the music should be playing
  let sounding = false;  // sound is actually coming out
  let problem = null;    // why the music stopped by itself, shown in the player
  let starting = false;
  let failures = 0;
  let stall = null;      // timer: a buffering pause long enough to show as loading
  const watchers = new Set();

  // Every stop or pause takes a new number. A start that finishes after one
  // (a click faster than the track loads) sees the number has moved on and
  // leaves the player alone, so the newest click always wins.
  let request = 0;

  function clampVolume(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return volume;
    return Math.min(1, Math.max(0, number));
  }

  function weekNumber(now = Date.now()) {
    return Math.floor((now - FIRST_MONDAY) / WEEK_MS);
  }

  // A small seeded random number generator (mulberry32): the same seed
  // always gives the same sequence, in every browser.
  function seeded(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickWeek(pool, week) {
    const list = Array.isArray(pool && pool.tracks)
      ? pool.tracks.filter(track => track && typeof track.src === 'string' && track.src.startsWith('https://'))
      : [];
    const random = seeded(week);
    const count = Math.min(list.length, MIN_TRACKS + Math.floor(random() * (MAX_TRACKS - MIN_TRACKS + 1)));
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list.slice(0, count);
  }

  function loadWeek() {
    if (tracks) return Promise.resolve(tracks);
    if (!loading) {
      loading = fetch(POOL)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then(pool => {
          const week = pickWeek(pool, weekNumber());
          if (!week.length) throw new Error('the list has no tracks');
          pages = {};
          (Array.isArray(pool.collections) ? pool.collections : []).forEach(c => {
            if (c && typeof c.page === 'string' && c.page.startsWith('https://')) pages[c.id] = c.page;
          });
          tracks = week;
          return tracks;
        })
        .catch(error => {
          console.warn('Secret music: the track list could not be loaded.', error);
          return null;
        })
        .finally(() => { loading = null; });
    }
    return loading;
  }

  function isPlaying() {
    return Boolean(audio) && !audio.paused;
  }

  function current() {
    if (!tracks || !audio) return null;
    const track = tracks[index];
    return { ...track, page: pages[track.collection] || null };
  }

  function state() {
    return {
      open,
      wanted,
      playing: isPlaying() && sounding,
      loading: open && wanted && !sounding,
      problem,
      track: current(),
      volume,
      canSkip: Boolean(audio && tracks && tracks.length > 1)
    };
  }

  function notify() {
    const now = state();
    watchers.forEach(watcher => {
      try { watcher(now); } catch (error) { console.warn('Secret music: a watcher failed.', error); }
    });
  }

  function onChange(watcher) {
    watchers.add(watcher);
    return () => watchers.delete(watcher);
  }

  function setTrack(i) {
    index = ((i % tracks.length) + tracks.length) % tracks.length;
    sounding = false;
    audio.src = tracks[index].src;
  }

  function giveUp() {
    wanted = false;
    request += 1;
    problem = "None of this week's tracks could be played.";
    if (audio) audio.pause();
    console.warn("Secret music: none of this week's tracks could be played.");
    notify();
  }

  // Plays the current track; one that fails moves on to the next.
  async function playCurrent(mine) {
    const player = audio;
    for (;;) {
      starting = true;
      try {
        await player.play();
        starting = false;
        if (mine !== request) return false;
        return true;
      } catch (error) {
        starting = false;
        if (mine !== request) return false;
        if (error && error.name === 'AbortError') return false;
        if (error && error.name === 'NotAllowedError') {
          wanted = false;
          request += 1;
          player.pause();
          console.info('Secret music: the browser blocked sound until the page is clicked or a key is pressed.');
          notify();
          return false;
        }
        failures += 1;
        // A fixed message with the title passed on its own: a "%" in a title
        // is never read as a format placeholder (semgrep, 2026-11-17).
        console.warn('Secret music: a track could not be played:', tracks[index].title, error);
        if (failures >= tracks.length) { giveUp(); return false; }
        setTrack(index + 1);
        notify();
      }
    }
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'none';
    audio.loop = false;
    audio.volume = volume;
    audio.addEventListener('ended', () => {
      sounding = false;
      if (!wanted) return;
      failures = 0;
      setTrack(index + 1);
      notify();
      playCurrent(request);
    });
    // A track that breaks after it started playing. A failure while starting
    // is handled by playCurrent itself, so it is not counted twice.
    audio.addEventListener('error', () => {
      sounding = false;
      if (!wanted || starting) return;
      failures += 1;
      console.warn('Secret music: a track stopped with an error:', tracks[index].title);
      if (failures >= tracks.length) { giveUp(); return; }
      setTrack(index + 1);
      notify();
      playCurrent(request);
    });
    audio.addEventListener('playing', () => { clearTimeout(stall); sounding = true; notify(); warmNext(); });
    // A stream pauses for a moment now and then to buffer. Only a pause that
    // lasts STALL_GRACE_MS shows as loading; a shorter one would swap the
    // dot to the loading ring and back, restarting its pulse with a jump
    // (Jason, 2026-11-17). Every other way out of playing cancels the wait.
    audio.addEventListener('waiting', () => {
      clearTimeout(stall);
      stall = setTimeout(() => { if (sounding) { sounding = false; notify(); } }, STALL_GRACE_MS);
    });
    ['ended', 'error', 'pause'].forEach(type => audio.addEventListener(type, () => clearTimeout(stall)));
    ['timeupdate', 'durationchange', 'loadedmetadata'].forEach(type => audio.addEventListener(type, renderProgress));
    // A pause or play from outside the page (keyboard media keys, the
    // browser's media controls). Our own pauses set `wanted` first, and our
    // own plays are already wanted, so only an outside one gets past these
    // checks. `paused` is read when the event arrives, so a late event from
    // a track change that has already moved on is ignored.
    audio.addEventListener('pause', () => {
      sounding = false;
      if (wanted && audio.paused && !audio.ended) {
        wanted = false;
        request += 1;
      }
      notify();
    });
    audio.addEventListener('play', () => {
      if (!wanted && !audio.paused) {
        wanted = true;
        open = true;
        problem = null;
        showPanel();
      }
      notify();
    });
    return audio;
  }

  // The Archive can take ten seconds or more to serve a file it has not
  // served lately (measured 2026-11-16: about one first request in fifteen;
  // the same file a second time took 0.4 s). Asking for the next track's
  // first two bytes while this one plays wakes it up, so it starts at once
  // when its turn comes. A plain Range request needs no extra permission
  // from the Archive, and a failure here changes nothing.
  const warmed = new Set();

  function warmNext() {
    if (!tracks || tracks.length < 2) return;
    const next = tracks[(index + 1) % tracks.length].src;
    if (warmed.has(next)) return;
    warmed.add(next);
    try { Promise.resolve(fetch(next, { headers: { Range: 'bytes=0-1' } })).catch(() => {}); } catch (_) { /* nothing to undo */ }
  }

  // Opens the player (if it is not open) and plays.
  async function start() {
    open = true;
    wanted = true;
    problem = null;
    const mine = request;
    showPanel();
    notify();
    const list = await loadWeek();
    if (mine !== request || !wanted) return false;
    if (!list) {
      wanted = false;
      problem = "This week's music could not be loaded.";
      notify();
      return false;
    }
    const player = ensureAudio();
    if (!player.paused) return true;
    if (!player.src) setTrack(index);
    failures = 0;
    notify();
    return playCurrent(mine);
  }

  // Pauses, keeping the player open.
  function pause() {
    wanted = false;
    request += 1;
    if (audio) audio.pause();
    notify();
    return false;
  }

  // Stops the music and hides the player.
  function stop() {
    open = false;
    wanted = false;
    problem = null;
    request += 1;
    if (audio) audio.pause();
    notify();
    return false;
  }

  function toggle() {
    return open ? Promise.resolve(stop()) : start();
  }

  function togglePlay() {
    return wanted ? Promise.resolve(pause()) : start();
  }

  function move(step) {
    if (!audio || !tracks) return Promise.resolve(false);
    failures = 0;
    problem = null;
    wanted = true;
    request += 1;
    setTrack(index + step);
    notify();
    return playCurrent(request);
  }

  function next() {
    return move(1);
  }

  // Like a music player's back button: a few seconds into a track it starts
  // that track again; at the very start it goes to the one before.
  function previous() {
    if (audio && tracks && audio.currentTime > 3) {
      audio.currentTime = 0;
      return wanted ? Promise.resolve(true) : start();
    }
    return move(-1);
  }

  function setVolume(value) {
    volume = clampVolume(value);
    if (audio) audio.volume = volume;
    notify();
    return volume;
  }

  function playlist() {
    return loadWeek().then(list => (list ? list.map(track => ({ ...track })) : []));
  }

  // Where the current track is: the file's own length once the browser knows
  // it, the pool's figure until then.
  function timing() {
    if (!audio || !tracks) return { time: 0, duration: 0 };
    const fromFile = Number(audio.duration);
    const duration = Number.isFinite(fromFile) && fromFile > 0 ? fromFile : (Number(tracks[index].seconds) || 0);
    const time = Math.max(0, Number(audio.currentTime) || 0);
    return { time: duration > 0 ? Math.min(time, duration) : time, duration };
  }

  // Jumps within the current track (the progress slider).
  function seek(seconds) {
    if (!audio || !tracks) return false;
    const { duration } = timing();
    audio.currentTime = Math.max(0, Math.min(Number(seconds) || 0, duration || 0));
    renderProgress();
    return true;
  }

  function clock(seconds) {
    const whole = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  // The floating player: smoked glass, built on the first start so the page
  // holds no trace of it until someone finds the secret. Drag it by its top
  // bar, or focus the grip and use the arrow keys (Shift moves further). Where
  // it was left is remembered in this browser only. Minimize shrinks it to one
  // row and sends it to the bottom-right corner; expand brings it back.
  const ICONS = {
    grip: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="5" cy="4" r="1.3"/><circle cx="11" cy="4" r="1.3"/><circle cx="5" cy="8" r="1.3"/><circle cx="11" cy="8" r="1.3"/><circle cx="5" cy="12" r="1.3"/><circle cx="11" cy="12" r="1.3"/></svg>',
    minimize: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 8h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
    expand: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>',
    close: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
    previous: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 3v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13 3.6v8.8L6 8z"/></svg>',
    next: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M12.5 3v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 3.6v8.8L10 8z"/></svg>',
    play: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 3.2v9.6L13 8z"/></svg>',
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="4" y="3" width="2.8" height="10" rx="0.8"/><rect x="9.2" y="3" width="2.8" height="10" rx="0.8"/></svg>',
    // A speaker with no, one or two sound waves, for the volume button.
    volume0: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2 6h2.5L8 3v10L4.5 10H2z"/><path d="M10.5 6l3.5 4M14 6l-3.5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>',
    volume1: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2 6h2.5L8 3v10L4.5 10H2z"/><path d="M10.2 5.8a3 3 0 0 1 0 4.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>',
    volume2: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2 6h2.5L8 3v10L4.5 10H2z"/><path d="M10.2 5.8a3 3 0 0 1 0 4.4M12.2 3.8a5.8 5.8 0 0 1 0 8.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>',
    // "Opens elsewhere": a box with an arrow leaving it, for the source link.
    source: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M7 3.5H4.5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V9M9.5 3.5h3v3M12.5 3.5L7.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
  };

  // The header shows a made-up radio station (Jason, 2026-11-17, his own
  // name for it). The state (Loading, Now playing, Paused, Unavailable) is
  // the dot beside it, by shape as well as colour, and is still there in
  // words for screen readers.
  const STATION = 'M-ROCJR 73.0 FM';

  const TEMPLATE = `
    <div class="secret-player-bar">
      <button type="button" class="secret-player-icon secret-player-grip" aria-label="Move the music player" aria-describedby="secretPlayerMoveHint">${ICONS.grip}</button>
      <button type="button" class="secret-player-button is-main secret-player-mini-play" data-action="play-mini"></button>
      <span class="secret-player-status"><span class="secret-player-dot" aria-hidden="true"></span><span class="secret-player-station">${STATION}</span><span class="secret-player-state" aria-live="polite"></span></span>
      <button type="button" class="secret-player-icon secret-player-minimize" aria-expanded="true" aria-label="Minimize the player">${ICONS.minimize}</button>
      <button type="button" class="secret-player-icon secret-player-close" aria-label="Stop the music and close the player">${ICONS.close}</button>
    </div>
    <span class="secret-player-hint" id="secretPlayerMoveHint" hidden>Drag the bar, or use the arrow keys. Hold Shift to move further.</span>
    <div class="secret-player-now" aria-live="polite">
      <p class="secret-player-line secret-player-title"><span class="secret-player-scroll"></span></p>
      <p class="secret-player-line secret-player-meta"><span class="secret-player-scroll"></span></p>
      <span class="secret-player-ticker-station" aria-hidden="true">${STATION}</span>
    </div>
    <div class="secret-player-progress">
      <span class="secret-player-time secret-player-elapsed" aria-hidden="true">0:00</span>
      <input class="secret-player-seek" type="range" min="0" max="0" step="1" value="0" aria-label="Position in track">
      <span class="secret-player-time secret-player-total" aria-hidden="true">0:00</span>
    </div>
    <div class="secret-player-controls">
      <div class="secret-player-volume-group">
        <button type="button" class="secret-player-button secret-player-volume-button" aria-label="Volume" aria-expanded="false" aria-controls="secretPlayerVolume"></button>
        <div class="secret-player-volume-pop" id="secretPlayerVolume" hidden>
          <input class="secret-player-volume" type="range" min="0" max="100" step="1" aria-label="Volume level">
        </div>
      </div>
      <button type="button" class="secret-player-button" data-action="previous" aria-label="Previous track">${ICONS.previous}</button>
      <button type="button" class="secret-player-button is-main" data-action="play"></button>
      <button type="button" class="secret-player-button" data-action="next" aria-label="Next track">${ICONS.next}</button>
      <a class="secret-player-source" target="_blank" rel="noopener noreferrer" hidden>${ICONS.source}</a>
    </div>`;

  const CORNER = 16;
  const FLIGHT_MS = 450;
  const SLIDE_SHARE = 0.65;
  const SLIDE_MIN_S = 7;
  const VOLUME_LINGER_MS = 700;
  // The minimized ticker: px a second, then the station name's gap after the
  // title leaves, its fade in, its hold and its fade out, in seconds.
  const TICKER_SPEED = 40;
  const TICKER_GAP_S = 0.3;
  const STATION_FADE_S = 0.5;
  const STATION_HOLD_S = 2.5;
  let panel = null;

  function readPosition() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(POSITION_KEY) || 'null');
      return saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : null;
    } catch (_) { return null; }
  }

  function savePosition(x, y) {
    if (panel && panel.minimized) return; // the corner is not where the full player lives
    try { window.localStorage.setItem(POSITION_KEY, JSON.stringify({ x: Math.round(x), y: Math.round(y) })); } catch (_) { /* storage can be blocked */ }
  }

  // Keeps the whole player on screen, EDGE pixels in from every side.
  function place(x, y) {
    const root = panel.root;
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const maxX = Math.max(EDGE, width - root.offsetWidth - EDGE);
    const maxY = Math.max(EDGE, height - root.offsetHeight - EDGE);
    const left = Math.min(maxX, Math.max(EDGE, x));
    const top = Math.min(maxY, Math.max(EDGE, y));
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    panel.moved = { x: left, y: top };
    return panel.moved;
  }

  // Back to the stylesheet's own corner (bottom-right), forgetting any move.
  function unplace() {
    const { style } = panel.root;
    style.left = ''; style.top = ''; style.right = ''; style.bottom = '';
    panel.moved = null;
  }

  // The minimized player's spot: the bottom-right corner, 16px in (Jason,
  // 2026-11-17; it was the top-right, where it could cover the header's Help
  // button and theme switch). Worked out again on resize while it sits there,
  // so it stays in the corner of a window that changes size.
  function dock() {
    const { root } = panel;
    const { clientWidth, clientHeight } = document.documentElement;
    place(clientWidth - root.offsetWidth - CORNER, clientHeight - root.offsetHeight - CORNER);
    panel.docked = true;
  }

  function nudge(dx, dy) {
    panel.docked = false;
    const rect = panel.root.getBoundingClientRect();
    const spot = place(rect.left + dx, rect.top + dy);
    savePosition(spot.x, spot.y);
  }

  function wireDragging(root, bar, grip) {
    let drag = null;
    bar.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('.secret-player-close, .secret-player-minimize, .secret-player-mini-play')) return;
      const rect = root.getBoundingClientRect();
      drag = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      try { root.setPointerCapture(event.pointerId); } catch (_) { /* a synthetic pointer */ }
      root.classList.add('is-dragging');
      event.preventDefault();
    });
    // On the player itself, not the bar: the bar has no box of its own when
    // the player is minimized.
    root.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      panel.docked = false;
      place(event.clientX - drag.dx, event.clientY - drag.dy);
    });
    const end = event => {
      if (!drag || event.pointerId !== drag.id) return;
      drag = null;
      root.classList.remove('is-dragging');
      if (panel.moved) savePosition(panel.moved.x, panel.moved.y);
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    root.addEventListener('lostpointercapture', end);
    grip.addEventListener('keydown', event => {
      const step = event.shiftKey ? 64 : 16;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (!moves[event.key]) return;
      event.preventDefault();
      nudge(...moves[event.key]);
    });
    // A smaller window, or a player that grows, keeps a moved player on
    // screen; a long title or composer line re-checks whether it must scroll.
    const keepOnScreen = () => {
      if (root.hidden) return;
      if (panel.moved && !root.classList.contains('is-flying')) {
        if (panel.minimized && panel.docked) dock(); else place(panel.moved.x, panel.moved.y);
      }
      fitLine(panel.title);
      fitLine(panel.meta);
    };
    window.addEventListener('resize', keepOnScreen);
    if (typeof ResizeObserver === 'function') {
      const watcher = new ResizeObserver(keepOnScreen);
      watcher.observe(root);
      watcher.observe(panel.title);
    }
  }

  // A title or composer line too long for the player slides sideways to show
  // the rest, then fades and starts again from the beginning (Jason,
  // 2026-11-17: sliding back left the start cut off at the end). It stops
  // while the pointer is on it. A visitor who asks for less motion gets a
  // still line instead (wrapped in the full player, "…" when minimized).
  // Minimized, the title is a ticker instead, whatever its length (see
  // startTicker below).
  function fitLine(line) {
    const text = line.textContent;
    const ticker = line === panel.title && panel.minimized && !prefersLessMotion();
    // The width is remembered as it was measured last time, sliding or not
    // (a sliding line in the full player is wider), so an unchanged line is
    // left alone instead of restarting its slide. The minimized and full
    // players differ in width, so a switch between them always refits.
    if (line.dataset.fitWidth === String(line.clientWidth) && line.dataset.fitText === text) return;
    line.dataset.fitText = text;
    line.classList.remove('is-scrolling');
    if (line === panel.title) panel.now.classList.remove('is-ticker');
    const width = line.clientWidth;
    if (ticker) {
      if (width > 0) startTicker(line, width);
      line.dataset.fitWidth = String(line.clientWidth);
      return;
    }
    const extra = line.scrollWidth - width;
    if (width === 0 || extra <= 2 || prefersLessMotion()) {
      line.dataset.fitWidth = String(width);
      return;
    }
    // Sliding adds room for the edge fades (secretMusic.css), so the distance
    // is measured with it in place: from the first letter clear of the left
    // fade to the last letter clear of the right one.
    line.classList.add('is-scrolling');
    const travel = Math.max(0, line.firstElementChild.offsetWidth - line.clientWidth);
    line.style.setProperty('--scroll-distance', `${-travel}px`);
    // The slide is 65% of the loop (secret-player-slide in secretMusic.css),
    // at about 30px a second, and the loop is never under 7 seconds, so the
    // pause before it starts is long enough to read the beginning.
    line.style.setProperty('--scroll-time', `${Math.max(SLIDE_MIN_S, travel / 30 / SLIDE_SHARE).toFixed(1)}s`);
    line.dataset.fitWidth = String(line.clientWidth);
  }

  // Minimized, every title runs as a ticker (Jason, 2026-11-17): in at the
  // right edge, across, out past the left, then the station name fades in,
  // holds and fades out, and round again. The two parts share one loop, so
  // the keyframes are written here with each part's share of it.
  function startTicker(line, width) {
    const words = line.firstElementChild;
    panel.now.classList.add('is-ticker');
    const textWidth = words.offsetWidth;
    const slide = (width + textWidth) / TICKER_SPEED;
    const shown = slide + TICKER_GAP_S;
    const total = shown + STATION_FADE_S * 2 + STATION_HOLD_S;
    const at = seconds => `${(seconds / total * 100).toFixed(3)}%`;
    if (!panel.tickerKeys) {
      panel.tickerKeys = document.createElement('style');
      panel.tickerKeys.id = 'secretPlayerTicker';
      document.head.appendChild(panel.tickerKeys);
    }
    panel.tickerKeys.textContent =
      `@keyframes secret-player-ticker { 0% { transform: translateX(${width}px); } ${at(slide)}, 100% { transform: translateX(${-textWidth}px); } }\n` +
      `@keyframes secret-player-ticker-station { 0%, ${at(shown)} { opacity: 0; } ${at(shown + STATION_FADE_S)}, ${at(shown + STATION_FADE_S + STATION_HOLD_S)} { opacity: 1; } 100% { opacity: 0; } }`;
    panel.now.style.setProperty('--ticker-time', `${total.toFixed(2)}s`);
  }

  function setLine(line, text) {
    const inner = line.firstElementChild;
    if (inner.textContent !== text) inner.textContent = text;
    fitLine(line);
  }

  // Volume (Jason, 2026-11-17): a speaker button that opens a small slider
  // above it. It closes on a second press, Escape, a press anywhere else,
  // focus moving out of it, or the pointer leaving it for a moment (never
  // while the slider is held). Opened from the keyboard, focus goes to the
  // slider so the arrow keys work straight away.
  function setVolumeOpen(on, focusButton = false) {
    if (!panel) return;
    clearTimeout(panel.volumeTimer);
    if (panel.volumePop.hidden === !on) return;
    // Closing under a focused slider would drop focus to the page, so it
    // goes back to the speaker first (ui-checker, 2026-11-17).
    if (!on && (focusButton || panel.volumePop.contains(document.activeElement))) panel.volumeButton.focus();
    panel.volumePop.hidden = !on;
    panel.volumeButton.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  function wireVolume() {
    const { volumeGroup: group, volumeButton: button, volume: slider } = panel;
    let holding = false;
    const linger = () => {
      clearTimeout(panel.volumeTimer);
      panel.volumeTimer = setTimeout(() => setVolumeOpen(false), VOLUME_LINGER_MS);
    };
    button.addEventListener('click', event => {
      const opening = panel.volumePop.hidden;
      setVolumeOpen(opening);
      if (opening && event.detail === 0) slider.focus(); // detail 0: Enter or Space, not a click
    });
    // On the document, not the group: Safari and Firefox on a Mac do not
    // focus a button on click, so focus may not be inside it.
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || panel.volumePop.hidden) return;
      event.stopPropagation();
      setVolumeOpen(false, group.contains(document.activeElement));
    });
    group.addEventListener('focusout', event => {
      if (!group.contains(event.relatedTarget)) setVolumeOpen(false);
    });
    // Only a mouse or pen "leaves": a finger lifting fires pointerleave too,
    // and the slider would vanish under it.
    const hovers = event => event.pointerType !== 'touch';
    group.addEventListener('pointerenter', () => clearTimeout(panel.volumeTimer));
    group.addEventListener('pointerleave', event => {
      if (hovers(event) && !holding && !panel.volumePop.hidden) linger();
    });
    slider.addEventListener('pointerdown', () => { holding = true; });
    // Not on `change`: the arrow keys fire it on every step, and the slider
    // closed under a keyboard user (ui-checker, 2026-11-17).
    ['pointerup', 'pointercancel'].forEach(type => slider.addEventListener(type, event => {
      holding = false;
      if (hovers(event) && !panel.volumePop.hidden && !group.matches(':hover')) linger();
    }));
    document.addEventListener('pointerdown', event => {
      if (!panel.volumePop.hidden && !group.contains(event.target)) setVolumeOpen(false);
    }, true);
  }

  function renderProgress() {
    if (!panel || panel.root.hidden) return;
    const { time, duration } = timing();
    const max = String(Math.max(0, Math.round(duration)));
    if (panel.seek.max !== max) panel.seek.max = max;
    if (!panel.seeking) panel.seek.value = String(Math.round(time));
    panel.seek.disabled = !(duration > 0);
    panel.seek.setAttribute('aria-valuetext', `${clock(time)} of ${clock(duration)}`);
    panel.elapsed.textContent = clock(time);
    panel.total.textContent = clock(duration);
    panel.root.style.setProperty('--progress', duration > 0 ? (time / duration).toFixed(4) : '0');
  }

  function showMinimizeButton() {
    const { minimize, minimized } = panel;
    minimize.setAttribute('aria-expanded', minimized ? 'false' : 'true');
    minimize.setAttribute('aria-label', minimized ? 'Expand the player' : 'Minimize the player');
    minimize.innerHTML = minimized ? ICONS.expand : ICONS.minimize;
  }

  // Shrinks the player to one row and flies it to the bottom-right corner, or
  // expands it back to where it was.
  function setMinimized(on) {
    if (!panel || panel.root.hidden || panel.minimized === Boolean(on)) return false;
    const { root } = panel;
    const from = root.getBoundingClientRect();
    // A player still flying home to the default corner has no spot of its
    // own yet, so a quick minimize does not save the flight's numbers
    // (ui-checker, 2026-11-17).
    if (on) panel.restoreSpot = panel.moved && !panel.homing ? { ...panel.moved } : null;
    panel.homing = false;
    setVolumeOpen(false);
    panel.minimized = Boolean(on);
    panel.docked = false;
    root.classList.toggle('is-minimized', panel.minimized);
    showMinimizeButton();
    // Pin it where it is now, so the move from here to there can be animated.
    root.classList.remove('is-flying');
    root.style.left = `${from.left}px`;
    root.style.top = `${from.top}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    void root.offsetWidth;
    const flying = !prefersLessMotion();
    if (flying) root.classList.add('is-flying');
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    let back = null;
    if (panel.minimized) dock();
    else if (panel.restoreSpot) place(panel.restoreSpot.x, panel.restoreSpot.y);
    else {
      place(width - root.offsetWidth - CORNER, height - root.offsetHeight - CORNER);
      back = 'corner';
      panel.homing = true;
    }
    clearTimeout(panel.landing);
    const land = () => {
      root.classList.remove('is-flying');
      // A resize during the flight was skipped; catch up now.
      if (panel.minimized && panel.docked) dock();
      if (back === 'corner' && !panel.minimized) unplace();
      panel.homing = false;
      fitLine(panel.title);
      fitLine(panel.meta);
    };
    if (flying) panel.landing = setTimeout(land, FLIGHT_MS); else land();
    return true;
  }

  // Closing always leaves the full player ready for next time, where it was.
  function resetMinimized() {
    setVolumeOpen(false);
    if (!panel.minimized) return;
    panel.minimized = false;
    panel.docked = false;
    panel.root.classList.remove('is-minimized', 'is-flying');
    clearTimeout(panel.landing);
    showMinimizeButton();
    if (panel.restoreSpot) place(panel.restoreSpot.x, panel.restoreSpot.y);
    else unplace();
  }

  function ensurePanel() {
    if (panel) return panel;
    if (typeof document === 'undefined' || !document.body) return null;
    const root = document.createElement('section');
    root.className = 'secret-player';
    root.id = 'secretPlayer';
    root.setAttribute('aria-label', 'Music player');
    root.hidden = true;
    root.innerHTML = TEMPLATE;
    document.body.appendChild(root);
    const find = selector => root.querySelector(selector);
    panel = {
      root,
      placed: false,
      moved: null,
      minimized: false,
      restoreSpot: null,
      seeking: false,
      landing: 0,
      status: find('.secret-player-state'),
      title: find('.secret-player-title'),
      now: find('.secret-player-now'),
      tickerKeys: null,
      meta: find('.secret-player-meta'),
      seek: find('.secret-player-seek'),
      elapsed: find('.secret-player-elapsed'),
      total: find('.secret-player-total'),
      volumeGroup: find('.secret-player-volume-group'),
      volumeButton: find('.secret-player-volume-button'),
      volumePop: find('.secret-player-volume-pop'),
      volumeTimer: 0,
      docked: false,
      source: find('.secret-player-source'),
      play: find('[data-action="play"]'),
      miniPlay: find('[data-action="play-mini"]'),
      previous: find('[data-action="previous"]'),
      next: find('[data-action="next"]'),
      volume: find('.secret-player-volume'),
      minimize: find('.secret-player-minimize')
    };
    panel.play.addEventListener('click', () => togglePlay());
    panel.previous.addEventListener('click', () => previous());
    panel.next.addEventListener('click', () => next());
    panel.volume.addEventListener('input', () => setVolume(Number(panel.volume.value) / 100));
    wireVolume();
    // While the slider is held, the playing track does not pull it back.
    // A press that ends without a move fires no change, so every way a press
    // can end lets go (ui-checker, 2026-11-17: the slider froze otherwise).
    panel.seek.addEventListener('pointerdown', () => { panel.seeking = true; });
    panel.seek.addEventListener('input', () => seek(Number(panel.seek.value)));
    const letGo = () => { panel.seeking = false; renderProgress(); };
    ['change', 'pointerup', 'pointercancel', 'blur'].forEach(type => panel.seek.addEventListener(type, letGo));
    panel.miniPlay.addEventListener('click', () => togglePlay());
    // A tap or click on a sliding line holds it still; another lets it go.
    [panel.title, panel.meta].forEach(line => line.addEventListener('click', () => line.classList.toggle('is-held')));
    panel.minimize.addEventListener('click', () => setMinimized(!panel.minimized));
    find('.secret-player-close').addEventListener('click', () => {
      stop();
      const trigger = document.getElementById('secretMagic');
      if (trigger) trigger.focus();
    });
    wireDragging(root, find('.secret-player-bar'), find('.secret-player-grip'));
    onChange(render);
    return panel;
  }

  function showPanel() {
    if (ensurePanel()) render(state());
  }

  function render(now) {
    if (!panel) return;
    const { root } = panel;
    const wasHidden = root.hidden;
    if (!now.open) {
      resetMinimized();
      root.hidden = true;
      return;
    }
    root.hidden = false;
    const label = now.problem ? 'Unavailable' : now.loading ? 'Loading' : now.playing ? 'Now playing' : 'Paused';
    panel.status.textContent = label;
    root.dataset.state = now.problem ? 'problem' : now.loading ? 'loading' : now.playing ? 'playing' : 'paused';
    // No aria-busy while loading: it can stop a screen reader announcing the
    // track name, which arrives during loading (ui-checker, 2026-11-17).
    const track = now.track;
    setLine(panel.title, now.problem || (track ? track.title : "Finding this week's music"));
    setLine(panel.meta, !now.problem && track ? [track.composer, track.performer].filter(Boolean).join(' · ') : '');
    if (!now.problem && track && track.page) {
      panel.source.href = track.page;
      panel.source.hidden = false;
      panel.source.setAttribute('aria-label', `Internet Archive: ${track.composer}, ${track.title} (opens in a new tab)`);
    } else {
      panel.source.hidden = true;
      panel.source.removeAttribute('href');
    }
    // Two play buttons, one shown at a time: the full player's, and the
    // minimized row's (which sits next to the grip so the keyboard meets
    // the row's buttons in the order they appear).
    [panel.play, panel.miniPlay].forEach(button => {
      if (button.dataset.icon !== (now.wanted ? 'pause' : 'play')) {
        button.innerHTML = now.wanted ? ICONS.pause : ICONS.play;
        button.dataset.icon = now.wanted ? 'pause' : 'play';
      }
      button.setAttribute('aria-label', now.wanted ? 'Pause' : now.problem ? 'Try again' : 'Play');
    });
    panel.previous.disabled = !now.canSkip;
    panel.next.disabled = !now.canSkip;
    const level = String(Math.round(now.volume * 100));
    if (panel.volume.value !== level) panel.volume.value = level;
    const speaker = now.volume === 0 ? 'volume0' : now.volume < 0.5 ? 'volume1' : 'volume2';
    if (panel.volumeButton.dataset.icon !== speaker) {
      panel.volumeButton.innerHTML = ICONS[speaker];
      panel.volumeButton.dataset.icon = speaker;
    }
    renderProgress();
    // The saved spot is applied once the text is in, so the player's real
    // height is the one kept on screen.
    if (wasHidden && !panel.placed) {
      panel.placed = true;
      const saved = readPosition();
      if (saved) place(saved.x, saved.y);
    }
  }

  // The trigger (Jason, 2026-11-16): the word "magic" in the footer. A real
  // button, so it works from the keyboard, styled to read as plain text with
  // the text cursor. Hovering it gives off a puff of pixie dust; a click
  // opens the player and plays, or stops and hides it. aria-pressed says
  // whether the player is open.
  const DUST_SPECKS = 9;
  const DUST_GAP_MS = 700;
  const DUST_LIFE_MS = 1400;
  let lastDust = -Infinity;

  function prefersLessMotion() {
    try { return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; }
  }

  function sprinkleDust(button, now = Date.now()) {
    if (prefersLessMotion() || now - lastDust < DUST_GAP_MS) return 0;
    lastDust = now;
    const doc = button.ownerDocument;
    for (let i = 0; i < DUST_SPECKS; i += 1) {
      const speck = doc.createElement('span');
      speck.className = i % 3 === 0 ? 'secret-magic-speck is-alt' : 'secret-magic-speck';
      speck.setAttribute('aria-hidden', 'true');
      const angle = -Math.PI * (0.15 + 0.7 * Math.random());
      const reach = 10 + Math.random() * 16;
      speck.style.setProperty('--start', `${Math.round(Math.random() * 100)}%`);
      speck.style.setProperty('--x', `${(Math.cos(angle) * reach).toFixed(1)}px`);
      speck.style.setProperty('--y', `${(Math.sin(angle) * reach).toFixed(1)}px`);
      speck.style.setProperty('--size', `${(2 + Math.random() * 2).toFixed(1)}px`);
      speck.style.setProperty('--delay', `${Math.round(Math.random() * 160)}ms`);
      speck.addEventListener('animationend', () => speck.remove(), { once: true });
      setTimeout(() => speck.remove(), DUST_LIFE_MS);
      button.appendChild(speck);
    }
    return DUST_SPECKS;
  }

  function bindTrigger(button) {
    if (!button || button.dataset.secretMusicBound === 'true') return false;
    button.dataset.secretMusicBound = 'true';
    const show = () => button.setAttribute('aria-pressed', open ? 'true' : 'false');
    show();
    onChange(show);
    button.addEventListener('pointerenter', () => sprinkleDust(button));
    button.addEventListener('click', async () => {
      await toggle();
      show();
    });
    return true;
  }

  window.VPS_SECRET_MUSIC = Object.freeze({
    POOL, start, stop, pause, toggle, togglePlay, next, previous, seek, isPlaying, setVolume, playlist, current, state, onChange,
    minimize: on => setMinimized(on !== false),
    weekNumber, pickWeek, sprinkleDust, bindTrigger
  });

  if (typeof document !== 'undefined') bindTrigger(document.getElementById('secretMagic'));
})();
