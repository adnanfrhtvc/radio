// GET /api/state — public. Advances the station to now and returns what's
// playing, how far in, and the server clock. Playback is server-authoritative:
// the server owns "now playing", the client just follows.

import { stores } from "./lib/store.js";
import { json } from "./lib/http.js";
import { tick } from "./lib/tick.js";

export default async () => {
  const view = await tick(stores());
  return json(view);
};

export const config = { path: "/api/state" };
