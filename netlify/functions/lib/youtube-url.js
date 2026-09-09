// Shared YouTube link parsing — turns a user-pasted string into { type, id }.
//
// Pure, dependency-free, and safe to import from both the browser and Netlify
// functions. Kept separate from the server-only YouTube Data API calls (which
// need a secret key and live in netlify/functions/lib/youtube-api.js).

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
  if (list) return { type: "playlist", id: list };

  const v = url.searchParams.get("v");
  if (v) return { type: "video", id: v };

  if (url.hostname === "youtu.be") {
    const id = url.pathname.slice(1);
    if (/^[\w-]{11}$/.test(id)) return { type: "video", id };
  }

  const m = url.pathname.match(/\/(embed|shorts)\/([\w-]{11})/);
  if (m) return { type: "video", id: m[2] };

  return null;
}
