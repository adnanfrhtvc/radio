// POST /api/control — admin only. Live playback control:
//   { action: "skip" }        → end the current track now; engine picks next
//   { action: "playNow", key }→ play a specific pool track immediately
//
// Both mutate the playback state through the tick service's `mutate` hook, so
// the change and the follow-up advance+persist happen in one atomic read. The
// listener's player picks the change up on its next poll.

import { stores, readList } from "./lib/store.js";
import { checkAuth } from "./lib/auth.js";
import { json, readJson } from "./lib/http.js";
import { tick } from "./lib/tick.js";
import { skipCurrent, playNow } from "./lib/playback.js";

export default async (req) => {
  if (!checkAuth(req)) return json({ error: "Unauthorized" }, 401);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await readJson(req);
  if (!body) return json({ error: "Bad JSON" }, 400);

  const s = stores();

  switch (body.action) {
    case "skip": {
      const view = await tick(s, {
        mutate: (state, _pool, now) => skipCurrent(state, now),
      });
      return json({ ok: true, view });
    }

    case "playNow": {
      if (!body.key) return json({ error: "Missing key" }, 400);
      const pool = await readList(s.active);
      const track = pool.find((t) => t.key === body.key);
      if (!track) return json({ error: "Track not found in pool" }, 404);
      const view = await tick(s, {
        mutate: (state, p, now) => playNow(state, track, now, p.length),
      });
      return json({ ok: true, view });
    }

    default:
      return json({ error: "Unknown action" }, 400);
  }
};

export const config = { path: "/api/control" };
