# YouTube Looper

Audio-only YouTube looper with a public suggestion box and a private admin panel.
Backend runs on Netlify Functions + Netlify Blobs (no external database, no signup).

## Pages
- `/`         — the player (audio only, shows current title + controls)
- `/suggest`  — public page for others to submit links
- `/admin`    — your review panel (password-protected)

## Deploy

1. Push this folder to a GitHub repo (or drag it into Netlify — but a repo is better since there are Functions).
2. In Netlify: **Add new site → Import from Git**, pick the repo.
   Build settings are read from `netlify.toml` automatically.
3. **Site settings → Environment variables** → add:
   - `ADMIN_PASSWORD` = whatever password you want for `/admin`
4. Deploy. Done.

Netlify Blobs is enabled automatically for the site — nothing to configure.

## Using it
- Go to `/admin`, enter your password.
- Add links directly, or approve/reject what comes in through `/suggest`.
- Open `/` and hit Start. (Browsers require one click before audio can play.)

## Notes
- "Rotation" plays items in order. A single video advances to the next item when it ends;
  a playlist plays through, then advances.
- Prev/Next skip between items. Reload (⟳) re-pulls the list without refreshing the page.
- Suggestions are deduped, and approving one moves it into the active rotation.
