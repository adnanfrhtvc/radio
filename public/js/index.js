import { livePosition as sharedLivePosition } from "/shared/timeline.js";

let player, items = [], idx = 0, ready = false, playing = false;
let lastLoadAt = 0, loadedIndex = -1, userPaused = false;
const STARTUP_GRACE_MS = 6000;
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
// ---- Synced radio engine ----
// The backend gives us the full track timeline + its own clock. We compute
// the shared position as (now - epoch) mod total, so every listener lands on
// the same track at the same offset. clockSkew corrects our local clock.
let timeline = { items: [], total: 0, epoch: 0 };
let clockSkew = 0; // serverNow - localNow (seconds)

async function fetchList() {
  try {
    const r = await fetch("/api/list");
    const d = await r.json();
    timeline = { items: d.items || [], total: d.total || 0, epoch: d.epoch || 0 };
    items = timeline.items;
    if (typeof d.serverNow === "number") clockSkew = d.serverNow - (Date.now() / 1000);
  } catch { items = []; timeline = { items: [], total: 0, epoch: 0 }; }
}

function serverSeconds() { return (Date.now() / 1000) + clockSkew; }

// Where should the station be right now? Delegates to the shared timeline
// module so the client and server never disagree on the math.
function livePosition() {
  return sharedLivePosition(timeline.items, serverSeconds(), timeline.epoch);
}

const tag = document.createElement("script"); tag.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(tag);
window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player("player", { height: "120", width: "200", playerVars: { autoplay: 0, controls: 0, rel: 0 }, events: { onReady: () => { ready = true; }, onStateChange } });
};

// Load whatever is live now and seek into it.
function goLive() {
  const p = livePosition();
  if (!p || !ready) return;
  idx = p.index;
  loadedIndex = p.index;
  lastLoadAt = Date.now();
  const it = timeline.items[idx];
  player.loadVideoById({ videoId: it.id, startSeconds: Math.floor(p.offset) });
  setTimeout(updateTitle, 900);
}

// Drift correction: nudge playback back toward the shared position.
// Mobile players start slowly, so we (1) never touch a track that was just
// loaded (grace window), (2) prefer seekTo over a full reload, and (3) only
// reload when the live track is genuinely different AND we're past startup.
// This stops the "plays a split second then pauses" reload loop on Android.
function driftCheck() {
  if (!ready || !playing) return;
  // Give a freshly loaded track time to actually begin before judging drift.
  if (Date.now() - lastLoadAt < STARTUP_GRACE_MS) return;
  const p = livePosition();
  if (!p) return;
  // The live track has rolled over to a different song — reload to catch it.
  if (p.index !== loadedIndex) { goLive(); return; }
  // Same track, just correct position without reloading.
  try {
    const local = player.getCurrentTime();
    if (Math.abs(local - p.offset) > 6) player.seekTo(p.offset, true);
  } catch {}
}
setInterval(driftCheck, 5000);

function setPlaying(on) {
  playing = on;
  document.getElementById("vinyl").classList.toggle("playing", on);
  document.getElementById("tonearm").classList.toggle("off", !on);
  document.getElementById("play").textContent = on ? "\u275a\u275a" : "\u25b6";
}

function onStateChange(e) {
  if (e.data === YT.PlayerState.PLAYING) { setPlaying(true); updateTitle(); }
  else if (e.data === YT.PlayerState.PAUSED) {
    // Mobile browsers (incl. Vivaldi Android) often fire a transient PAUSED
    // right after a video loads. If the user didn't press pause and we're
    // still in the startup window, resume automatically instead of stopping.
    if (!userPaused && Date.now() - lastLoadAt < STARTUP_GRACE_MS) {
      try { player.playVideo(); } catch {}
      return;
    }
    setPlaying(false);
  }
  else if (e.data === YT.PlayerState.ENDED) { goLive(); } // next track = whatever's live
}

function updateTitle() {
  try {
    const d = player.getVideoData();
    if (d && d.title) document.getElementById("nowtitle").innerHTML = "<b>" + d.title + "</b>";
  } catch {}
}
setInterval(() => { if (ready && playing) updateTitle(); }, 3000);

// Controls
document.getElementById("play").onclick = () => {
  if (!ready) return;
  if (playing) { userPaused = true; player.pauseVideo(); }
  else { userPaused = false; goLive(); } // resuming rejoins the live position, not where you paused
};
document.getElementById("resync").onclick = async () => { userPaused = false; await fetchList(); goLive(); };
document.getElementById("vol").oninput = (e) => { if (player) { player.unMute(); player.setVolume(+e.target.value); } };
document.getElementById("mute").onclick = () => {
  if (!player) return;
  const b = document.getElementById("mute");
  if (player.isMuted()) { player.unMute(); b.textContent = "\ud83d\udd0a"; }
  else { player.mute(); b.textContent = "\ud83d\udd07"; }
};

document.getElementById("overlay").onclick = async () => {
  await fetchList();
  if (!items.length) { document.getElementById("nowtitle").textContent = "Nothing in rotation yet \u2014 add something in admin."; }
  document.getElementById("overlay").classList.add("hidden");
  if (ready && items.length) { userPaused = false; player.setVolume(+document.getElementById("vol").value); goLive(); }
};
