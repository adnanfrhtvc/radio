import { stores, readList, writeList, checkAuth, parseYouTube, json } from "./utils/store.js";
import { expandToTracks, hasKey } from "./utils/youtube.js";

// Active items are always individual videos with a known duration:
//   { key, id, name, seconds, at }
// Playlists are expanded into their videos at add-time (snapshot).
export default async (req) => {
  if (!checkAuth(req)) return json({ error: "Unauthorized" }, 401);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  const { suggestions, active } = stores();

  if (body.action === "reject") {
    const pending = await readList(suggestions, "list");
    await writeList(suggestions, "list", pending.filter(s => s.key !== body.key));
    return json({ ok: true });
  }

  if (body.action === "remove") {
    const list = await readList(active, "list");
    await writeList(active, "list", list.filter(x => x.key !== body.key));
    return json({ ok: true });
  }

  if (body.action === "add") {
    if (!hasKey()) return json({ error: "YOUTUBE_API_KEY is not set — needed to read durations and expand playlists." }, 400);
    const parsed = parseYouTube(body.url);
    if (!parsed) return json({ error: "Couldn't parse that link." }, 400);

    let tracks;
    try { tracks = await expandToTracks(parsed, String(body.name || "")); }
    catch (e) { return json({ error: e.message || "Couldn't load that link." }, 400); }

    const list = await readList(active, "list");
    const existing = new Set(list.map(x => x.id));
    let added = 0;
    for (const tr of tracks) {
      if (existing.has(tr.id)) continue;
      existing.add(tr.id);
      list.push({ key: crypto.randomUUID(), id: tr.id, name: tr.name, seconds: tr.seconds, at: Date.now() });
      added++;
    }
    await writeList(active, "list", list);
    return json({ ok: true, added, total: tracks.length });
  }

  if (body.action === "reorder") {
    const list = await readList(active, "list");
    const map = new Map(list.map(x => [x.key, x]));
    const next = body.keys.map(k => map.get(k)).filter(Boolean);
    for (const x of list) if (!body.keys.includes(x.key)) next.push(x);
    await writeList(active, "list", next);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
};

export const config = { path: "/api/manage" };
