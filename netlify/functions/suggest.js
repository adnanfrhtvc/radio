// POST /api/suggest — public. Stores an unexpanded submission for review.
// Playlists are NOT expanded here (that costs API quota); expansion happens at
// approval time in approve.js.

import { stores, readList, writeList } from "./lib/store.js";
import { json, readJson } from "./lib/http.js";
import { parseYouTube } from "./lib/youtube-url.js";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await readJson(req);
  if (!body) return json({ error: "Bad JSON" }, 400);

  const parsed = parseYouTube(body.url);
  if (!parsed) return json({ error: "Couldn't find a YouTube video or playlist in that link." }, 400);

  const { suggestions } = stores();
  const list = await readList(suggestions);

  // Dedupe among pending suggestions.
  if (list.some((s) => s.type === parsed.type && s.id === parsed.id)) {
    return json({ ok: true, duplicate: true });
  }

  list.push({
    key: crypto.randomUUID(),
    type: parsed.type,
    id: parsed.id,
    name: String(body.name || "").slice(0, 80),
    note: String(body.note || "").slice(0, 300),
    at: Date.now(),
  });
  await writeList(suggestions, list);
  return json({ ok: true });
};

export const config = { path: "/api/suggest" };
