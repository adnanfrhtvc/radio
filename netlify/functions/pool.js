// GET /api/pool — admin only. The full track pool with durations, for the
// admin rotation list. (The public player uses /api/state instead.)

import { stores, readList } from "./lib/store.js";
import { checkAuth } from "./lib/auth.js";
import { json } from "./lib/http.js";

export default async (req) => {
  if (!checkAuth(req)) return json({ error: "Unauthorized" }, 401);
  const { active } = stores();
  const list = await readList(active);
  return json({ items: list });
};

export const config = { path: "/api/pool" };
