import { stores, readList, writeList, checkAuth, parseYouTube, json } from "./utils/store.js";

// Handles: reject a suggestion, remove an active item, manually add to active.
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
    const parsed = parseYouTube(body.url);
    if (!parsed) return json({ error: "Couldn't parse that link." }, 400);
    const list = await readList(active, "list");
    if (!list.some(x => x.type === parsed.type && x.id === parsed.id)) {
      list.push({ key: crypto.randomUUID(), type: parsed.type, id: parsed.id, name: String(body.name || "").slice(0, 80), at: Date.now() });
      await writeList(active, "list", list);
    }
    return json({ ok: true });
  }

  if (body.action === "reorder") {
    // body.keys = array of keys in the new order
    const list = await readList(active, "list");
    const map = new Map(list.map(x => [x.key, x]));
    const next = body.keys.map(k => map.get(k)).filter(Boolean);
    // append any not included, to be safe
    for (const x of list) if (!body.keys.includes(x.key)) next.push(x);
    await writeList(active, "list", next);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
};

export const config = { path: "/api/manage" };
