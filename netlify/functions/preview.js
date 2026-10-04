// POST /api/preview — public. Resolves a YouTube link into the tracks it would
// add, WITHOUT adding anything. Powers the suggestion modal's preview list so a
// submitter sees exactly what they're suggesting (one video, or every track a
// playlist expands into).
//
// Read-only, but it does spend a little YouTube API quota per call, so we cap
// how many tracks we return and don't persist anything.

import { json, readJson } from "./lib/http.js";
import { hasKey, expandToTracks } from "./lib/youtube-api.js";
import { parseYouTube } from "./lib/youtube-url.js";

const PREVIEW_CAP = 100;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await readJson(req);
  if (!body) return json({ error: "Bad JSON" }, 400);

  const parsed = parseYouTube(body.url);
  if (!parsed) return json({ error: "Couldn't find a YouTube video or playlist in that link." }, 400);

  if (!hasKey()) {
    return json({ error: "Preview unavailable (server missing YouTube API key)." }, 400);
  }

  let tracks;
  try {
    tracks = await expandToTracks(parsed, "");
  } catch (e) {
    return json({ error: e.message || "Couldn't load that link." }, 400);
  }

  const total = tracks.length;
  const items = tracks.slice(0, PREVIEW_CAP).map((t) => ({ name: t.name, seconds: t.seconds }));
  return json({ type: parsed.type, total, items });
};

export const config = { path: "/api/preview" };
