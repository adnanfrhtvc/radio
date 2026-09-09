// Tick service — the one place that advances playback and persists it.
//
// Every endpoint that reports or changes what's live calls tick() so the
// station moves forward lazily on request traffic (there's no cron). It reads
// the pool + state, advances to `now`, writes back only if something changed,
// and returns the current view for the client.

import { readList, readState, writeState } from "./store.js";
import { advance, offsetInto } from "./playback.js";

// Advance the station to the present and persist. Returns a client-facing view.
// `mutate` optionally transforms the state BEFORE advancing (used by skip /
// play-now / clear to inject a change), and receives (state, pool) → newState.
export async function tick(stores, { mutate } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const pool = await readList(stores.active);
  let state = await readState(stores.playback);

  const before = JSON.stringify(state);

  if (typeof mutate === "function") {
    state = mutate(state, pool) || state;
  }

  state = advance(state, pool, now);

  if (JSON.stringify(state) !== before) {
    await writeState(stores.playback, state);
  }

  return {
    nowPlaying: state.nowPlaying,
    offset: offsetInto(state, now),
    startedAt: state.startedAt,
    serverNow: now,
    poolSize: pool.length,
    recent: state.recent || [],
  };
}
