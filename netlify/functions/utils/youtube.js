// YouTube Data API v3 helpers. Requires process.env.YOUTUBE_API_KEY.

const KEY = () => process.env.YOUTUBE_API_KEY;

export function hasKey() {
  return !!process.env.YOUTUBE_API_KEY;
}

// Parse an ISO 8601 duration (e.g. "PT4M13S") into seconds.
export function isoToSeconds(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return 0;
  const h = +(m[1] || 0), min = +(m[2] || 0), s = +(m[3] || 0);
  return h * 3600 + min * 60 + s;
}

// Fetch durations + titles for up to 50 video IDs at a time.
// Returns Map(id -> { seconds, title }). Skips unplayable/embed-blocked where detectable.
export async function fetchVideoMeta(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,status&id=${chunk.join(",")}&key=${KEY()}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`YouTube videos API ${r.status}`);
    const data = await r.json();
    for (const item of data.items || []) {
      const seconds = isoToSeconds(item.contentDetails?.duration);
      const embeddable = item.status?.embeddable !== false;
      out.set(item.id, {
        seconds,
        title: item.snippet?.title || "",
        embeddable,
      });
    }
  }
  return out;
}

// Expand a playlist ID into an ordered list of video IDs (handles pagination).
export async function fetchPlaylistVideoIds(playlistId, cap = 200) {
  const ids = [];
  let pageToken = "";
  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${playlistId}${pageToken ? "&pageToken=" + pageToken : ""}&key=${KEY()}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`YouTube playlistItems API ${r.status}`);
    const data = await r.json();
    for (const item of data.items || []) {
      const vid = item.contentDetails?.videoId;
      if (vid) ids.push(vid);
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken && ids.length < cap);
  return ids.slice(0, cap);
}

// Given a parsed {type,id}, return an array of track objects:
// [{ id, name, seconds }]. Playlists are expanded into individual videos.
export async function expandToTracks(parsed, fallbackName = "") {
  if (parsed.type === "video") {
    const meta = await fetchVideoMeta([parsed.id]);
    const m = meta.get(parsed.id);
    if (!m || m.seconds === 0) throw new Error("Video not found or has no duration.");
    return [{ id: parsed.id, name: fallbackName || m.title, seconds: m.seconds }];
  }
  // playlist
  const vids = await fetchPlaylistVideoIds(parsed.id);
  if (!vids.length) throw new Error("Playlist is empty or private.");
  const meta = await fetchVideoMeta(vids);
  const tracks = [];
  for (const vid of vids) {
    const m = meta.get(vid);
    if (m && m.seconds > 0 && m.embeddable) {
      tracks.push({ id: vid, name: m.title, seconds: m.seconds });
    }
  }
  if (!tracks.length) throw new Error("No playable videos found in that playlist.");
  return tracks;
}
