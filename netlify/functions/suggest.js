import { stores, readList, writeList, parseYouTube, json } from "./utils/store.js";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  const parsed = parseYouTube(body.url);
  if (!parsed) return json({ error: "Couldn't find a YouTube video or playlist in that link." }, 400);

  const note = String(body.note || "").slice(0, 300);
  const name = String(body.name || "").slice(0, 80);

  const { suggestions } = stores();
  const list = await readList(suggestions, "list");

  // Dedupe by type+id among pending suggestions
  if (list.some(s => s.type === parsed.type && s.id === parsed.id)) {
    return json({ ok: true, duplicate: true });
  }

  list.push({
    key: crypto.randomUUID(),
    type: parsed.type,
    id: parsed.id,
    note,
    name,
    at: Date.now(),
  });
  await writeList(suggestions, "list", list);
  return json({ ok: true });
};

export const config = { path: "/api/suggest" };
