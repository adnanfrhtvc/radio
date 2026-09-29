# Hidrocibalae — Synced House Radio

A vinyl-themed web radio. Everyone who opens the page hears the **same track at
the same moment** — playback position is derived from a shared clock, so it
behaves like a real station rather than a per-visitor playlist.

Static frontend + Netlify Functions + Netlify Blobs. No build step.

## Project layout

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full picture. In short:

- `public/` — the site (HTML/CSS/JS), served as-is.
- `netlify/functions/` — HTTP endpoints; `lib/` holds the backend services they
  call.
- Root — `netlify.toml`, `package.json`, `.env.example`.

## Pages

- `/`        — the player (spinning vinyl, on-air panel, synced playback, suggest modal)
- `/admin`   — your review panel (password-protected)

## Environment variables

Set these in **Netlify → Site settings → Environment variables**, and locally in
a `.env` (copy from `.env.example`) if you run `netlify dev`.

| Variable          | Purpose                                            |
|-------------------|----------------------------------------------------|
| `ADMIN_PASSWORD`  | password for `/admin`                              |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key — reads durations, expands playlists |

Mark both as **secret** in Netlify so they're masked.

### Getting a YouTube Data API key (free)

1. https://console.cloud.google.com → create/select a project.
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **APIs & Services → Credentials → Create credentials → API key** → copy it.
4. Restrict the key to the YouTube Data API v3 (recommended), add it in Netlify,
   redeploy. The free quota is far more than a personal station needs.

## Deploy

1. Push to a GitHub repo.
2. Netlify → **Add new site → Import from Git** → pick the repo. Build settings
   come from `netlify.toml` (publish `public/`, functions in `netlify/functions/`).
3. Add the two environment variables, then deploy (or redeploy so functions pick
   them up).

## Local development (optional)

```bash
npm install
cp .env.example .env      # fill in your values
npm run dev               # netlify dev — serves site + functions locally
```

## How sync works (short version)

Playback is **server-authoritative**. The server owns "now playing" — which
track and the moment it started — in the `playback` blob store. The player calls
`/api/state`, loads that track at the right offset, and polls every few seconds
to catch changes. Every rotation item is a single video with a known duration;
playlists are expanded into their videos at add-time (a fixed snapshot).

Because the server owns playback, removing a track from the pool never
interrupts what's playing — the current track finishes, then the next is chosen
from whatever remains. The station advances lazily on request traffic (no cron):
with nobody listening it fast-forwards on the next request. Full detail in
`docs/ARCHITECTURE.md`.

Run the unit tests (playback engine + link parsing) with `npm test`.
