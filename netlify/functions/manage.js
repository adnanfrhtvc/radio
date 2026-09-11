// POST /api/manage — admin only. One endpoint, several actions:
//   { action: "add",       url, name }  → expand + append to the pool
//   { action: "remove",    key }        → drop a track from the pool
//   { action: "removeAll" }             → clear the entire pool
//   { action: "reject",    key }        → drop a pending suggestion
//   { action: "reorder",   keys }       → reorder the pool to match keys[]
//
// Removing tracks never disrupts what's currently playing: the pool is separate
// from the live playback state, so the current track plays to its end. We only
// drop the removed track from the upcoming queue, if it's sitting there.

import { stores, readList, writeList, readState, writeState } from "./lib/store.js";
import { checkAuth } from "./lib/auth.js";
import { json, readJson } from "./lib/http.js";
import { hasKey, expandToTracks } from "./lib/youtube-api.js";
import { appendTracks, reorderByKeys } from "./lib/rotation.js";
import { parseYouTube } from "./lib/youtube-url.js";

export default async (req) => {
  if (!checkAuth(req)) return json({ error: "Unauthorized" }, 401);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await readJson(req);
  if (!body) return json({ error: "Bad JSON" }, 400);

  const { suggestions, active, playback } = stores();

  switch (body.action) {
    case "reject": {
      const pending = await readList(suggestions);
      await writeList(suggestions, pending.filter((s) => s.key !== body.key));
      return json({ ok: true });
    }

    case "remove": {
      const list = await readList(active);
      const target = list.find((x) => x.key === body.key);
      await writeList(active, list.filter((x) => x.key !== body.key));
      if (target) {
        const state = await readState(playback);
        if (state.queue?.some((t) => t.id === target.id)) {
          state.queue = state.queue.filter((t) => t.id !== target.id);
          await writeState(playback, state);
        }
      }
      return json({ ok: true });
    }

    case "removeAll": {
      await writeList(active, []);
      const state = await readState(playback);
      state.queue = [];
      await writeState(playback, state);
      return json({ ok: true });
    }

    case "add": {
      if (!hasKey()) {
        return json({ error: "YOUTUBE_API_KEY is not set — needed to read durations and expand playlists." }, 400);
      }
      const parsed = parseYouTube(body.url);
      if (!parsed) return json({ error: "Couldn't parse that link." }, 400);

      let tracks;
      try {
        tracks = await expandToTracks(parsed, String(body.name || ""));
      } catch (e) {
        return json({ error: e.message || "Couldn't load that link." }, 400);
      }

      const list = await readList(active);
      const { list: updated, added } = appendTracks(list, tracks);
      await writeList(active, updated);
      return json({ ok: true, added, total: tracks.length });
    }

    case "reorder": {
      const list = await readList(active);
      await writeList(active, reorderByKeys(list, body.keys || []));
      return json({ ok: true });
    }

    default:
      return json({ error: "Unknown action" }, 400);
  }
};

export const config = { path: "/api/manage" };
