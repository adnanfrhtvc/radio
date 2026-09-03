import { stores, readList, checkAuth, json } from "./utils/store.js";

export default async (req) => {
  if (!checkAuth(req)) return json({ error: "Unauthorized" }, 401);
  const { suggestions } = stores();
  const list = await readList(suggestions, "list");
  return json({ items: list.sort((a, b) => b.at - a.at) });
};

export const config = { path: "/api/suggestions" };
