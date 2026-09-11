// GET /api/suggestions — admin only. Newest suggestions first.

import { stores, readList } from "./lib/store.js";
import { checkAuth } from "./lib/auth.js";
import { json } from "./lib/http.js";

export default async (req) => {
  if (!checkAuth(req)) return json({ error: "Unauthorized" }, 401);
  const { suggestions } = stores();
  const list = await readList(suggestions);
  return json({ items: list.sort((a, b) => b.at - a.at) });
};

export const config = { path: "/api/suggestions" };
