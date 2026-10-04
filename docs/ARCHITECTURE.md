# Architecture

A static frontend plus small serverless functions, deployed on Netlify. There
is **no build step** — files deploy as they are. The structure separates four
concerns: UI, HTTP entry points, backend services, and pure logic.

```
public/                     ← everything served to the browser (publish root)
  index.html                  player page
  admin.html                  admin review panel
  suggest.html                public suggestion form
  css/                        one stylesheet per page
  js/                         one script per page (UI logic only)
  assets/                     static images, if any

netlify/functions/          ← HTTP entry points ("controllers"), one per route
  state.js                    GET  /api/state         (public)  what's live now
  suggest.js                  POST /api/suggest       (public)
  control.js                  POST /api/control       (admin)   skip / play-now
  pool.js                     GET  /api/pool          (admin)   the track pool
  suggestions.js              GET  /api/suggestions   (admin)
  approve.js                  POST /api/approve       (admin)
  manage.js                   POST /api/manage        (admin: add/remove/removeAll/reject/reorder)
  lib/                        backend services (the real logic)
    playback.js                 PURE engine: pickNext / advance / offsetInto
    tick.js                     advance-and-persist, used by every playback read
    store.js                    Netlify Blobs: active pool, suggestions, playback state
    auth.js                     admin password check
    http.js                     JSON response + body-parse helpers
    youtube-api.js              YouTube Data API calls (needs secret key)
    youtube-url.js              parse a YouTube link → { type, id } (pure)
    rotation.js                 dedupe-append + reorder helpers (pure)

tests/                      unit tests for the pure modules (npm test)

netlify.toml                config: publish dir, functions dir, redirects
package.json                metadata + scripts
.env.example                documents required env vars
```

## Layering rule

Entry points stay thin: parse the request, check auth, call a service, return
JSON. All real work lives in `lib/`. Pure modules (`playback.js`,
`youtube-url.js`, `rotation.js`) have no I/O, so they can be unit-tested
directly (`tests/`).

## Playback model (server-authoritative)

The station's live state lives in the `playback` blob store:

```
{ nowPlaying: { id, name, seconds } | null,
  startedAt:  <unix seconds when nowPlaying began>,
  recent:     [id, …],      // repeat-blocker, newest first
  queue:      [track, …] }  // forced-next items (admin "play now", ads, …)
```

`lib/playback.js` is a **pure** engine:
- `pickNext(pool, recent)` — choose a track, avoiding recent repeats, relaxing
  automatically if the pool is smaller than the recent window.
- `advance(state, pool, now)` — roll the state forward: if the current track's
  time has elapsed, record it to `recent` and pick the next, repeating until the
  current track ends in the future. A track that's still within its duration
  always finishes, even if it was just removed from the pool.
- `offsetInto(state, now)` — seconds into the current track.

There is **no cron**. `lib/tick.js` calls `advance` on every read of
`/api/state`, so the station moves forward lazily on listener traffic and
persists only when something changed. With nobody listening it simply
fast-forwards on the next request — radio doesn't care about gaps in an empty
room.

Two details keep every listener on the same track:

- **Strong reads.** All blob stores are opened with `consistency: "strong"`.
  The Netlify default ("eventual") can serve reads up to ~60s stale, which
  would delay admin skips and let function instances disagree.
- **Deterministic picks.** `tick` seeds the random pick from the state being
  advanced (`stateSeed`: current track + its start time). Two requests that
  hit a track boundary at the same moment compute the same next track instead
  of racing with different random choices.

The browser calls `/api/state`, loads `nowPlaying` at `offset`, and polls every
few seconds to catch rollovers, admin skips, or vote-skips — with a startup
grace window and drift correction so slow-starting mobile players stay in step.

### Why removing a track no longer disrupts playback

The **pool** (editable list) is separate from **nowPlaying** (the live state).
Deleting a pool entry — even the one currently playing — never interrupts audio;
the current track plays to its natural end, and only then does the engine pick
the next from whatever the pool now contains. Removed tracks are also pulled
from the `queue` so they won't play next.

## Request routes

| Method | Path              | Auth  | Purpose                                  |
|--------|-------------------|-------|------------------------------------------|
| GET    | /api/state        | none  | current nowPlaying + offset + clock      |
| POST   | /api/suggest      | none  | store a pending suggestion               |
| POST   | /api/control      | admin | skip current / play a track now          |
| GET    | /api/pool         | admin | the full editable track pool             |
| GET    | /api/suggestions  | admin | list pending suggestions                 |
| POST   | /api/approve      | admin | expand a suggestion into the pool        |
| POST   | /api/manage       | admin | add / remove / removeAll / reject / reorder |

Admin routes expect `Authorization: Bearer <ADMIN_PASSWORD>`.
