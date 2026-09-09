// POST /api/manage — admin only. One endpoint, several actions:
//   { action: "add",     url, name }  → expand + append to rotation
//   { action: "remove",  key }        → drop a track from rotation
//   { action: "reject",  key }        → drop a pending suggestion
//   { action: "reorder", keys }       → reorder rotation to match keys[]

import { stores, readList, writeList } from "./lib/store.js";
import { checkAuth } from "./lib/auth.js";
import { json, readJson } from "./lib/http.js";
import { hasKey, expandToTracks } from "./lib/youtube-api.js";
import { appendTracks, reorderByKeys } from "./lib/rotation.js";
import { parseYouTube } from "../../public/shared/youtube-url.js";

export default async (req) => {
  if (!checkAuth(req)) return json({ error: "Unauthorized" }, 401);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await readJson(req);
  if (!body) return json({ error: "Bad JSON" }, 400);

  const { suggestions, active } = stores();

  switch (body.action) {
    case "reject": {
      const pending = await readList(suggestions);
      await writeList(suggestions, pending.filter((s) => s.key !== body.key));
      return json({ ok: true });
    }

    case "remove": {
      const list = await readList(active);
      await writeList(active, list.filter((x) => x.key !== body.key));
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
