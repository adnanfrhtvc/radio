// Playback engine — the pure, server-authoritative core of the radio.
//
// State shape (persisted in Netlify Blobs by lib/store.js):
//   {
//     nowPlaying: { id, name, seconds } | null,
//     startedAt:  <unix seconds> when nowPlaying began,
//     recent:     [id, ...]   most-recently-finished first (repeat-blocker),
//     queue:      [ { id, name, seconds }, ... ]  optional forced-next items
//   }
//
// This module is PURE: no I/O, no Date.now baked in (callers pass `now`). That
// makes every rule here unit-testable and identical whether it runs on the
// server tick or in a test. Persistence and randomness policy live in the
// caller (the function), not here.

// How many recently-played track IDs to remember and avoid repeating.
// The picker will relax this automatically if the pool is too small.
export const DEFAULT_RECENT_LIMIT = 10;

// Pick the next track from `pool`, avoiding IDs in `recent` when possible.
// `randomFn` defaults to Math.random but is injectable for deterministic tests.
// Returns a track object or null if the pool is empty.
export function pickNext(pool, recent = [], randomFn = Math.random) {
  if (!pool || pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  const recentSet = new Set(recent);
  let candidates = pool.filter((t) => !recentSet.has(t.id));

  // If the recent list has swallowed the whole pool, relax: drop the oldest
  // restrictions by allowing anything except the single most-recent track.
  if (candidates.length === 0) {
    const mostRecent = recent[0];
    candidates = pool.filter((t) => t.id !== mostRecent);
    if (candidates.length === 0) candidates = pool.slice();
  }

  const i = Math.floor(randomFn() * candidates.length);
  return candidates[i];
}

// Push a finished track ID onto the recent list (newest first), capped.
// The cap is min(limit, pool-1) so a small station can't deadlock itself.
export function recordRecent(recent, id, poolSize, limit = DEFAULT_RECENT_LIMIT) {
  const effective = Math.max(0, Math.min(limit, poolSize - 1));
  const next = [id, ...recent.filter((x) => x !== id)];
  return next.slice(0, effective);
}

// Advance the playback state forward until `startedAt + duration` is in the
// future relative to `now`, or until we've taken `maxSteps` (safety valve
// against a pathological all-zero-duration pool).
//
// Inputs:
//   state    current playback state (may have a stale/finished nowPlaying)
//   pool     the station's full track list [{id,name,seconds}]
//   now      unix seconds (server clock)
//   opts     { randomFn, recentLimit, maxSteps }
//
// Returns a NEW state object; does not mutate the input.
export function advance(state, pool, now, opts = {}) {
  const randomFn = opts.randomFn || Math.random;
  const recentLimit = opts.recentLimit ?? DEFAULT_RECENT_LIMIT;
  const maxSteps = opts.maxSteps ?? 10000;

  let nowPlaying = state?.nowPlaying || null;
  let startedAt = state?.startedAt || 0;
  let recent = Array.isArray(state?.recent) ? state.recent.slice() : [];
  let queue = Array.isArray(state?.queue) ? state.queue.slice() : [];

  const poolEmpty = (!pool || pool.length === 0);

  // If the current track is still within its duration, it always keeps playing —
  // even if the pool was just emptied. Only once it ends do we consult the pool.
  if (nowPlaying) {
    const dur = nowPlaying.seconds > 0 ? nowPlaying.seconds : 0;
    if (dur > 0 && startedAt + dur > now) {
      return { nowPlaying, startedAt, recent, queue };
    }
  }

  // Nothing playing (or current just ended) and nothing to play: idle.
  if (poolEmpty && queue.length === 0) {
    return { nowPlaying: null, startedAt: 0, recent, queue };
  }

  // Bootstrap: if nothing is playing, start something as of `now`.
  if (!nowPlaying) {
    const first = queue.length ? queue.shift() : pickNext(pool, recent, randomFn);
    if (!first) return { nowPlaying: null, startedAt: 0, recent, queue };
    return { nowPlaying: first, startedAt: now, recent, queue };
  }

  // Advance through any tracks whose time has fully elapsed.
  let steps = 0;
  while (steps++ < maxSteps) {
    const dur = nowPlaying.seconds > 0 ? nowPlaying.seconds : 0;
    const endsAt = startedAt + dur;
    if (dur > 0 && endsAt > now) break; // current track still playing

    // Current track finished: record it, then choose the next.
    recent = recordRecent(recent, nowPlaying.id, pool.length, recentLimit);
    const next = queue.length ? queue.shift() : pickNext(pool, recent, randomFn);
    if (!next) { // pool became empty
      return { nowPlaying: null, startedAt: 0, recent, queue };
    }
    // The next track logically started when the previous ended (no drift),
    // unless the previous had zero/unknown duration, in which case start now.
    startedAt = dur > 0 ? endsAt : now;
    nowPlaying = next;
  }

  return { nowPlaying, startedAt, recent, queue };
}

// Deterministic PRNG (mulberry32) seeded from a string. Used so that two
// requests advancing the SAME stored state pick the SAME next track, instead
// of racing with different random picks and making listeners flip-flop.
export function seededRandom(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The seed for advancing a given state: identical inputs → identical seed.
// When nothing is playing yet there is no history to key on, so use the
// current minute (concurrent bootstraps still agree).
export function stateSeed(state, now) {
  const np = state?.nowPlaying;
  return np ? `${np.id}|${state.startedAt}` : `boot|${Math.floor(now / 60)}`;
}

// How far into the current track we are, given the server clock.
export function offsetInto(state, now) {
  if (!state?.nowPlaying) return 0;
  return Math.max(0, now - (state.startedAt || now));
}

// ---- Live-control mutations (pure) ----
// These transform state BEFORE advance() runs. They set things up so the very
// next advance() produces the intended result, rather than duplicating advance's
// bookkeeping here.

// Skip the current track: mark it finished as of `now` by backdating startedAt
// so its duration has fully elapsed. The subsequent advance() records it to
// `recent` and picks the next track normally.
export function skipCurrent(state, now) {
  if (!state?.nowPlaying) return state;
  const dur = state.nowPlaying.seconds > 0 ? state.nowPlaying.seconds : 1;
  return { ...state, startedAt: now - dur };
}

// Play a specific track immediately for everyone. The current track (if any) is
// recorded to `recent` so the repeat-blocker still respects it, then `track`
// becomes nowPlaying starting at `now`.
export function playNow(state, track, now, poolSize = 0, limit = DEFAULT_RECENT_LIMIT) {
  if (!track) return state;
  let recent = Array.isArray(state?.recent) ? state.recent.slice() : [];
  if (state?.nowPlaying) recent = recordRecent(recent, state.nowPlaying.id, poolSize, limit);
  return {
    nowPlaying: { id: track.id, name: track.name, seconds: track.seconds },
    startedAt: now,
    recent,
    queue: Array.isArray(state?.queue) ? state.queue.slice() : [],
  };
}
