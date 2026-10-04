// Shared YouTube link parsing — turns a user-pasted string into { type, id }.
//
// Pure, dependency-free, and safe to import from both the browser and Netlify
// functions. Kept separate from the server-only YouTube Data API calls (which
// need a secret key and live in netlify/functions/lib/youtube-api.js).

const VIDEO_ID = /^[\w-]{11}$/;
const PLAYLIST_ID = /^[\w-]{10,64}$/;

// Only accept IDs made of YouTube's own alphabet. Anything else (quotes, angle
// brackets, "&key=…") is rejected, because the ID ends up in API URLs and in
// admin-page links.
const video = (id) => (VIDEO_ID.test(id || "") ? { type: "video", id } : null);
const playlist = (id) => (PLAYLIST_ID.test(id || "") ? { type: "playlist", id } : null);

// Returns { type: "video" | "playlist", id } or null if nothing recognizable.
export function parseYouTube(input) {
  const s = (input || "").trim();
  if (!s) return null;

  // Raw playlist ID (PL…, UU…, FL…, LL…, RD…)
  if (/^PL[\w-]{16,}$/.test(s) || /^(UU|FL|LL|RD)[\w-]{16,}$/.test(s)) {
    return { type: "playlist", id: s };
  }
  // Raw 11-char video ID
  if (/^[\w-]{11}$/.test(s)) return { type: "video", id: s };

  let url;
  try { url = new URL(s); } catch { return null; }

  const list = url.searchParams.get("list");
  const v = url.searchParams.get("v");

  // "watch?v=X&list=RD…" is a YouTube Mix: auto-generated, and the API can't
  // expand it. Someone pasting that almost always means the song they're on.
  if (v && list && /^RD/.test(list)) return video(v);
  if (list && playlist(list)) return playlist(list);
  if (v) return video(v);

  if (url.hostname === "youtu.be") return video(url.pathname.slice(1));

  const m = url.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})(?:[/?#]|$)/);
  if (m) return video(m[2]);

  return null;
}
