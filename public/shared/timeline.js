// Shared timeline logic — the heart of the synced radio.
//
// Both the browser player and the backend need to agree on where the station
// "is" at any moment. Keeping that math here, in one file imported by both,
// means the rule can never drift between client and server.
//
// The model: concatenate every track into one long loop. The position at a
// given instant is (now - EPOCH) mod totalDuration. Because EPOCH is fixed and
// every listener derives the same number from the same server clock, everyone
// lands on the same track at the same offset.

// Fixed anchor for the shared timeline: 2024-01-01T00:00:00Z, in seconds.
// Never change this after launch — it would jump every listener to a new spot.
export const EPOCH = 1704067200;

// Sum of all track durations (seconds). Guards against missing/zero values.
export function totalDuration(items) {
  return (items || []).reduce((sum, it) => sum + (it && it.seconds > 0 ? it.seconds : 0), 0);
}

// Given the track list and a server-aligned clock (in seconds), return
// { index, offset, item } for what should be playing right now, or null if the
// station is empty / has no usable durations.
export function livePosition(items, nowSeconds, epoch = EPOCH) {
  const total = totalDuration(items);
  if (!items || !items.length || total <= 0) return null;

  let pos = (nowSeconds - epoch) % total;
  if (pos < 0) pos += total; // JS % can be negative

  for (let i = 0; i < items.length; i++) {
    const dur = items[i].seconds > 0 ? items[i].seconds : 0;
    if (pos < dur) return { index: i, offset: pos, item: items[i] };
    pos -= dur;
  }
  // Floating-point edge: land at the start of the last track.
  const last = items.length - 1;
  return { index: last, offset: 0, item: items[last] };
}
