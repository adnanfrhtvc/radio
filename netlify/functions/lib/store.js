// Storage service — wraps Netlify Blobs so functions never touch the raw store.
//
// Two named stores:
//   active      → the live rotation (array of track objects)
//   suggestions → pending submissions awaiting review
//
// A "track" in active is always a single video:
//   { key, id, name, seconds, at }
// A "suggestion" is an unexpanded submission:
//   { key, type, id, name, note, at }

import { getStore } from "@netlify/blobs";

const LIST_KEY = "list";

export function stores() {
  return {
    active: getStore("active"),
    suggestions: getStore("suggestions"),
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
