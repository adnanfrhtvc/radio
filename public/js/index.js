// Player — server-driven synced radio.
//
// The server (/api/state) is authoritative: it says what's playing and how many
// seconds in. The player loads that video at that offset, then polls to catch
// track changes (from natural rollover, an admin skip, or a vote-skip). Local
// playback is corrected toward the server offset, with a startup grace window
// and auto-resume so mobile players (which start slowly and fire spurious
// pauses) don't stall.

let player, ready = false, playing = false, userPaused = false;
let lastLoadAt = 0, loadedId = null, loadedStartedAt = null;
let playError = false; // current track failed to load in this browser
const STARTUP_GRACE_MS = 6000;
const POLL_MS = 4000;

// Current server view: { nowPlaying:{id,name,seconds}, offset, serverNow, poolSize }
let view = { nowPlaying: null, offset: 0, serverNow: 0, poolSize: 0 };
let clockSkew = 0; // serverNow - localNow (seconds), to project offset forward

// ---- Equalizer (unchanged visual) ----
const eq = document.getElementById("eq");
const BAR_COUNT = 28; const bars = []; const phases = [];
for (let i = 0; i < BAR_COUNT; i++) { const s = document.createElement("span"); eq.appendChild(s); bars.push(s); phases.push(Math.random() * Math.PI * 2); }
let t = 0;
function animateEq() {
  t += 0.08;
  const vol = player && ready ? (player.getVolume ? player.getVolume() / 100 : 0.7) : 0.7;
  for (let i = 0; i < BAR_COUNT; i++) {
    let h;
    if (playing) {
      const base = Math.sin(t * (0.7 + i % 5 * 0.12) + phases[i]);
      const flick = Math.sin(t * 2.3 + i) * 0.4;
      h = (0.5 + 0.5 * base) * (0.6 + 0.4 * flick);
      h = Math.max(0.08, Math.min(1, h)) * (0.35 + 0.65 * vol);
    } else { h = 0.06; }
    bars[i].style.height = (h * 100) + "%";
  }
  requestAnimationFrame(animateEq);
}
animateEq();

// ---- Server state ----
async function fetchState() {
  try {
    const r = await fetch("/api/state");
    const d = await r.json();
    view = d;
    if (typeof d.serverNow === "number") clockSkew = d.serverNow - (Date.now() / 1000);
    return d;
  } catch {
    view = { nowPlaying: null, offset: 0, serverNow: 0, poolSize: 0 };
    return view;
  }
}

// Project the current server-side offset for nowPlaying, accounting for the
// time elapsed since we fetched (using the skew-corrected clock).
function liveOffset() {
  if (!view.nowPlaying) return 0;
  const serverNow = (Date.now() / 1000) + clockSkew;
  const elapsedSinceStart = serverNow - (view.serverNow - view.offset);
  return Math.max(0, elapsedSinceStart);
}

// ---- YouTube player ----
const tag = document.createElement("script"); tag.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(tag);
window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player("player", {
    height: "120", width: "200",
    playerVars: { autoplay: 0, controls: 0, rel: 0 },
    events: { onReady: () => { ready = true; }, onStateChange, onError }
  });
};

// Load whatever the server says is live, seeking to the right offset.
function goLive() {
  if (!ready || !view.nowPlaying) return;
  const it = view.nowPlaying;
  loadedId = it.id;
  loadedStartedAt = view.startedAt;
  lastLoadAt = Date.now();
  playError = false;
  player.loadVideoById({ videoId: it.id, startSeconds: Math.floor(liveOffset()) });
  setTitle(it.name);
  setTimeout(updateTitleFromPlayer, 900);
}

// A "play" is identified by track ID + the moment it started, so the same
// song starting again (one-track station, admin replay) still counts as new.
const isLoadedPlay = () =>
  view.nowPlaying?.id === loadedId && view.startedAt === loadedStartedAt;

// Poll the server: if the live track changed, reload; otherwise correct drift.
async function poll() {
  if (!playing) return;
  await fetchState();
  const nowId = view.nowPlaying?.id;

  if (!nowId) { return; } // station went empty; keep last frame

  if (!isLoadedPlay()) {
    // Track rolled over or admin/vote changed it — load the new one. During
    // the startup grace window only a different track forces a reload.
    if (Date.now() - lastLoadAt > STARTUP_GRACE_MS || nowId !== loadedId) goLive();
    return;
  }
  // Same track: gently correct if we've drifted from the server offset.
  if (playError || Date.now() - lastLoadAt < STARTUP_GRACE_MS) return;
  try {
    const local = player.getCurrentTime();
    const target = liveOffset();
    if (Math.abs(local - target) > 6) player.seekTo(target, true);
  } catch {}
}
setInterval(poll, POLL_MS);

// A video can fail in one browser (removed, region-blocked, embedding turned
// off after it was added). Other listeners may be fine, so we don't skip for
// everyone — we say so and pick up the next track when the server rolls over.
function onError() {
  playError = true;
  document.getElementById("nowtitle").textContent =
    "This track can't play here — the next one will start automatically.";
}

// ---- UI plumbing ----
function setTitle(name) {
  if (!name) return;
  // textContent, not innerHTML: titles come from YouTube / admin labels.
  const b = document.createElement("b");
  b.textContent = name;
  document.getElementById("nowtitle").replaceChildren(b);
}
function updateTitleFromPlayer() {
  try {
    const d = player.getVideoData();
    if (d && d.title) setTitle(d.title);
  } catch {}
}

function setPlaying(on) {
  playing = on;
  document.getElementById("vinyl").classList.toggle("playing", on);
  document.getElementById("tonearm").classList.toggle("off", !on);
  document.getElementById("play").textContent = on ? "\u275a\u275a" : "\u25b6";
}

function onStateChange(e) {
  if (e.data === YT.PlayerState.PLAYING) { setPlaying(true); updateTitleFromPlayer(); }
  else if (e.data === YT.PlayerState.PAUSED) {
    if (!userPaused && Date.now() - lastLoadAt < STARTUP_GRACE_MS) {
      try { player.playVideo(); } catch {}
      return;
    }
    setPlaying(false);
  }
  else if (e.data === YT.PlayerState.ENDED) {
    // Our copy ended; ask the server what's next and load it.
    followAfterEnd();
  }
}

// Our local copy can finish a moment before the server rolls over (clock
// rounding, small drift). Reloading then would replay the last second of the
// same track in a loop, so wait until the server has actually moved on.
let endRetry = null;
async function followAfterEnd(attempt = 0) {
  clearTimeout(endRetry);
  await fetchState();
  const np = view.nowPlaying;
  if (np && isLoadedPlay() && attempt < 10) {
    const left = Math.max(0, (np.seconds || 0) - liveOffset());
    endRetry = setTimeout(() => followAfterEnd(attempt + 1), Math.min(left + 0.5, 5) * 1000);
    return;
  }
  goLive();
}

// ---- Controls ----
document.getElementById("play").onclick = () => {
  if (!ready) return;
  if (playing) { userPaused = true; player.pauseVideo(); }
  else { userPaused = false; fetchState().then(goLive); }
};
document.getElementById("resync").onclick = async () => { userPaused = false; await fetchState(); goLive(); };
document.getElementById("vol").oninput = (e) => { if (player) { player.unMute(); player.setVolume(+e.target.value); } };
document.getElementById("mute").onclick = () => {
  if (!player) return;
  const b = document.getElementById("mute");
  if (player.isMuted()) { player.unMute(); b.textContent = "\ud83d\udd0a"; }
  else { player.mute(); b.textContent = "\ud83d\udd07"; }
};

document.getElementById("overlay").onclick = async () => {
  await fetchState();
  if (!view.nowPlaying) { document.getElementById("nowtitle").textContent = "Nothing on air yet \u2014 add something in admin."; }
  document.getElementById("overlay").classList.add("hidden");
  if (ready && view.nowPlaying) { userPaused = false; player.setVolume(+document.getElementById("vol").value); goLive(); }
};
