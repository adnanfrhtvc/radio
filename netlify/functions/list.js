// GET /api/list — public. Returns the rotation plus the data the client needs
// to compute the synced position: the fixed epoch and the server's clock.

import { stores, readList } from "./lib/store.js";
import { json } from "./lib/http.js";
import { EPOCH, totalDuration } from "../../public/shared/timeline.js";

export default async () => {
  const { active } = stores();
  const list = await readList(active);

  const items = list.map((x) => ({
    key: x.key,
    id: x.id,
    name: x.name,
    seconds: x.seconds || 0,
  }));

  return json({
    items,
    total: totalDuration(items),
    epoch: EPOCH,
    serverNow: Math.floor(Date.now() / 1000),
  });
};

export const config = { path: "/api/list" };
