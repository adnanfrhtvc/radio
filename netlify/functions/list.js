import { stores, readList, json } from "./utils/store.js";

export default async () => {
  const { active } = stores();
  const list = await readList(active, "list");
  return json({ items: list });
};

export const config = { path: "/api/list" };
