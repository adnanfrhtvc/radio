import { stores, readList, writeList, checkAuth, json } from "./utils/store.js";

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

  const list = await readList(active, "list");
  if (!list.some(x => x.type === item.type && x.id === item.id)) {
    list.push({ key: crypto.randomUUID(), type: item.type, id: item.id, name: item.name, at: Date.now() });
    await writeList(active, "list", list);
  }

  await writeList(suggestions, "list", pending.filter(s => s.key !== body.key));
  return json({ ok: true });
};

export const config = { path: "/api/approve" };
