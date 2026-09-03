# Hidrocibalae — Synced House Radio

A vinyl-themed web radio. Everyone who opens the page hears the **same track at
the same moment** — playback position is derived from a shared clock, so it
behaves like a real station rather than a per-visitor playlist.

Backend runs on Netlify Functions + Netlify Blobs. Reading YouTube durations and
expanding playlists needs a free YouTube Data API key.

## Pages
- `/`         — the player (spinning vinyl, on-air panel, synced playback)
- `/suggest`  — public page for others to submit links
- `/admin`    — your review panel (password-protected)

## How sync works
- Every item in the rotation is a single video with a known duration.
- Add a **playlist** and it's expanded into its individual videos at add-time
  (a fixed snapshot — later changes to the original playlist aren't tracked).
- The player computes `(server_time − epoch) mod total_runtime` to find the
  current track + offset, and seeks there. It re-checks every few seconds and
  quietly corrects drift.
- Pausing then playing rejoins the **live** position (you don't resume where you
  left off — it's radio). The "⟳ LIVE" button forces a re-sync.

## Deploy

1. Push this folder to a GitHub repo.
2. Netlify → **Add new site → Import from Git** → pick the repo. Settings come
   from `netlify.toml`.
3. **Site settings → Environment variables** → Add a key/value pair:
   - `ADMIN_PASSWORD` = your admin password
   - `YOUTUBE_API_KEY` = your YouTube Data API v3 key (see below)
4. Deploy (or re-deploy after adding the vars so functions pick them up).

### Getting a YouTube Data API key (free)
1. https://console.cloud.google.com → create/select a project.
2. **APIs & Services → Library** → search **YouTube Data API v3** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → API key** → copy it.
4. Add it in Netlify as `YOUTUBE_API_KEY`, then redeploy.

The default free quota (10,000 units/day) is far more than a personal station
needs — adding tracks costs a few units; playback uses no quota at all.

## Using it
- Go to `/admin`, enter your password.
- Paste a video or playlist link. Playlists expand into their tracks, each shown
  with its duration; the panel shows the total loop length.
- Approve/reject incoming suggestions; drag the ⠿ handle to reorder.
- Open `/` and hit **TUNE IN** (one tap is required before browsers allow sound).

## Notes
- Sync is only as precise as each video's reported duration; ads or region blocks
  on a given video can nudge a listener slightly until the next track resets it.
- Mobile: the decorative tonearm is hidden on narrow screens; everything else
  reflows to a single column.
