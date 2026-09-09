// Rotation service — mutations on the active track list.
//
// Extracted because "add" (manage.js) and "approve" (approve.js) both need the
// exact same dedupe-and-append behavior. One implementation, one place to fix.

// Append tracks to the list, skipping any video ID already present.
// Returns { list, added } — the new list and how many were actually added.
export function appendTracks(list, tracks) {
  const existing = new Set(list.map((x) => x.id));
  let added = 0;
  for (const tr of tracks) {
    if (existing.has(tr.id)) continue;
    existing.add(tr.id);
    list.push({
      key: crypto.randomUUID(),
      id: tr.id,
      name: tr.name,
      seconds: tr.seconds,
      at: Date.now(),
    });
    added++;
  }
  return { list, added };
}

// Reorder the list to match an array of keys; any keys not listed are appended
// in their original order so nothing is ever lost.
export function reorderByKeys(list, keys) {
  const map = new Map(list.map((x) => [x.key, x]));
  const next = keys.map((k) => map.get(k)).filter(Boolean);
  for (const x of list) if (!keys.includes(x.key)) next.push(x);
  return next;
}
