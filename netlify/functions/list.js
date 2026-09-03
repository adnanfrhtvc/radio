import { stores, readList, json } from "./utils/store.js";

// Fixed anchor for the shared timeline. Everyone computes their position
// as (serverNow - EPOCH) mod totalDuration, so all listeners are in sync.
const EPOCH = 1704067200; // 2024-01-01T00:00:00Z (seconds)

export default async () => {
  const { active } = stores();
  const list = await readList(active, "list");

  const items = list.map(x => ({ key: x.key, id: x.id, name: x.name, seconds: x.seconds || 0 }));
  const total = items.reduce((a, b) => a + (b.seconds || 0), 0);

  return json({
    items,
    total,
    epoch: EPOCH,
    serverNow: Math.floor(Date.now() / 1000),
  });
};

export const config = { path: "/api/list" };
