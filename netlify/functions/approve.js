import { stores, readList, writeList, checkAuth, json } from "./utils/store.js";
import { expandToTracks, hasKey } from "./utils/youtube.js";

export default async (req) => {
  if (!checkAuth(req)) return json({ error: "Unauthorized" }, 401);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  if (!body.key) return json({ error: "Missing key" }, 400);

  const { suggestions, active } = stores();
  const pending = await readList(suggestions, "list");
  const item = pending.find(s => s.key === body.key);
  if (!item) return json({ error: "Suggestion not found" }, 404);

  if (!hasKey()) return json({ error: "YOUTUBE_API_KEY is not set — needed to read durations and expand playlists." }, 400);

  let tracks;
  try { tracks = await expandToTracks({ type: item.type, id: item.id }, item.name || ""); }
  catch (e) { return json({ error: e.message || "Couldn't load that suggestion." }, 400); }

  const list = await readList(active, "list");
  const existing = new Set(list.map(x => x.id));
  for (const tr of tracks) {
    if (existing.has(tr.id)) continue;
    existing.add(tr.id);
    list.push({ key: crypto.randomUUID(), id: tr.id, name: tr.name, seconds: tr.seconds, at: Date.now() });
  }
  await writeList(active, "list", list);

  await writeList(suggestions, "list", pending.filter(s => s.key !== body.key));
  return json({ ok: true, added: tracks.length });
};

export const config = { path: "/api/approve" };
