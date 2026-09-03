import { getStore } from "@netlify/blobs";

// Extract a YouTube video ID or playlist ID from a URL or raw ID.
export function parseYouTube(input) {
  const s = (input || "").trim();
  if (!s) return null;

  // Raw playlist ID
  if (/^PL[\w-]{16,}$/.test(s) || /^(UU|FL|LL|RD)[\w-]{16,}$/.test(s)) {
    return { type: "playlist", id: s };
  }
  // Raw video ID
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

export function stores() {
  return {
    active: getStore("active"),        // the playable list
    suggestions: getStore("suggestions"), // pending review
  };
}

export async function readList(store, key) {
  const data = await store.get(key, { type: "json" });
  return Array.isArray(data) ? data : [];
}

export async function writeList(store, key, list) {
  await store.setJSON(key, list);
}

export function checkAuth(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  return token === expected;
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
