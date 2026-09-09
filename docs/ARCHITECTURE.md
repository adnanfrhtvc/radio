# Architecture

A static frontend plus small serverless functions, deployed on Netlify. There
is **no build step** — files deploy as they are. The structure separates four
concerns: UI, HTTP entry points, backend services, and code shared by both
sides.

```
public/                     ← everything served to the browser (publish root)
  index.html                  player page
  admin.html                  admin review panel
  suggest.html                public suggestion form
  css/                        one stylesheet per page
  js/                         one script per page (UI logic only)
  shared/                     logic used by BOTH browser and functions
    timeline.js                 sync math (epoch, livePosition) — single source of truth
    youtube-url.js              parse a YouTube link → { type, id }
  assets/                     static images, if any

netlify/functions/          ← HTTP entry points ("controllers"), one per route
  list.js                     GET  /api/list          (public)
  suggest.js                  POST /api/suggest       (public)
  suggestions.js              GET  /api/suggestions   (admin)
  approve.js                  POST /api/approve       (admin)
  manage.js                   POST /api/manage        (admin: add/remove/reject/reorder)
  lib/                        backend services (the real logic)
    store.js                    Netlify Blobs read/write for active + suggestions
    auth.js                     admin password check
    http.js                     JSON response + body-parse helpers
    youtube-api.js              YouTube Data API calls (needs secret key)
    rotation.js                 dedupe-append + reorder helpers

netlify.toml                config: publish dir, functions dir, redirects
package.json                metadata + scripts
.env.example                documents required env vars
.gitignore
```

## Layering rule

Entry points stay thin: parse the request, check auth, call a service, return
JSON. All real work lives in `lib/` (server) or `shared/` (both sides). If two
functions need the same behavior, it belongs in a service — `rotation.js` and
`youtube-api.js` exist exactly because `add` and `approve` shared logic.

## Why `shared/` lives under `public/`

The browser can only fetch files inside the publish directory, so the shared
modules live at `public/shared/` and are served at `/shared/*.js`. The functions
import them by relative path (`../../public/shared/…`) and Netlify's esbuild
bundler inlines them at deploy (`included_files` guarantees they're packaged).
One copy, imported two ways — no duplication, no build step.

## The sync model

`shared/timeline.js` defines the whole station as one long loop. Position is
`(serverNow − EPOCH) mod totalDuration`. Because `EPOCH` is fixed and every
client derives its position from the server clock, all listeners land on the
same track at the same offset. `list.js` hands the browser the track list, the
epoch, and the server clock; the player computes its local skew and seeks to the
shared position, with a startup grace window and drift correction to stay in
step (and to survive mobile players that start slowly).

## Request routes

| Method | Path              | Auth  | Purpose                                  |
|--------|-------------------|-------|------------------------------------------|
| GET    | /api/list         | none  | rotation + epoch + server clock          |
| POST   | /api/suggest      | none  | store a pending suggestion               |
| GET    | /api/suggestions  | admin | list pending suggestions                 |
| POST   | /api/approve      | admin | expand a suggestion into the rotation    |
| POST   | /api/manage       | admin | add / remove / reject / reorder          |

Admin routes expect `Authorization: Bearer <ADMIN_PASSWORD>`.
