// Storage service — wraps Netlify Blobs so functions never touch the raw store.
//
// Three named stores:
//   active      → the station's track pool (array of track objects)
//   suggestions → pending submissions awaiting review
//   playback    → the live playback state (what's playing, since when, history)
//
// A "track" in active is always a single video:
//   { key, id, name, seconds, at }
// A "suggestion" is an unexpanded submission:
//   { key, type, id, name, note, at }
// The playback state:
//   { nowPlaying: {id,name,seconds}|null, startedAt, recent: [id], queue: [track] }

import { getStore } from "@netlify/blobs";

const LIST_KEY = "list";
const STATE_KEY = "state";

// Strong consistency: Netlify Blobs defaults to "eventual", where a read can
// return data up to ~60s stale. For a synced radio that means an admin skip
// (or a track rollover) might not reach some listeners for a minute, and two
// function instances could disagree about what's playing. Strong reads always
// see the latest write, at a small latency cost.
const open = (name) => getStore({ name, consistency: "strong" });

export function stores() {
  return {
    active: open("active"),
    suggestions: open("suggestions"),
    playback: open("playback"),
  };
}

// Read a stored array, tolerating an empty/absent store.
export async function readList(store) {
  const data = await store.get(LIST_KEY, { type: "json" });
  return Array.isArray(data) ? data : [];
}

// Overwrite a stored array.
export async function writeList(store, list) {
  await store.setJSON(LIST_KEY, list);
}

// Read the playback state, returning a fresh empty state if none exists.
export async function readState(store) {
  const data = await store.get(STATE_KEY, { type: "json" });
  if (data && typeof data === "object") return data;
  return { nowPlaying: null, startedAt: 0, recent: [], queue: [] };
}

// Overwrite the playback state.
export async function writeState(store, state) {
  await store.setJSON(STATE_KEY, state);
}
