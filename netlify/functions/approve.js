// POST /api/approve { key } — admin only. Expands the suggestion into tracks,
// appends them to the rotation, and removes it from the pending list.

import { stores, readList, writeList } from "./lib/store.js";
import { checkAuth } from "./lib/auth.js";
import { json, readJson } from "./lib/http.js";
import { hasKey, expandToTracks } from "./lib/youtube-api.js";
import { appendTracks } from "./lib/rotation.js";

export default async (req) => {
  if (!checkAuth(req)) return json({ error: "Unauthorized" }, 401);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await readJson(req);
  if (!body || !body.key) return json({ error: "Missing key" }, 400);

  const { suggestions, active } = stores();
  const pending = await readList(suggestions);
  const item = pending.find((s) => s.key === body.key);
  if (!item) return json({ error: "Suggestion not found" }, 404);

  if (!hasKey()) {
    return json({ error: "YOUTUBE_API_KEY is not set — needed to read durations and expand playlists." }, 400);
  }

  let tracks;
  try {
    tracks = await expandToTracks({ type: item.type, id: item.id }, item.name || "");
  } catch (e) {
    return json({ error: e.message || "Couldn't load that suggestion." }, 400);
  }

  const list = await readList(active);
  const { list: updated, added } = appendTracks(list, tracks);
  await writeList(active, updated);
  await writeList(suggestions, pending.filter((s) => s.key !== body.key));

  return json({ ok: true, added });
};

export const config = { path: "/api/approve" };
