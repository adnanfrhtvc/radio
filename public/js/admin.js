let PW = sessionStorage.getItem("pw") || "";

const H = () => ({ "content-type": "application/json", "authorization": "Bearer " + PW });
const ytLink = (it) => it.type === "playlist"
  ? `https://youtube.com/playlist?list=${it.id}`
  : `https://youtube.com/watch?v=${it.id}`;
const videoLink = (id) => `https://youtube.com/watch?v=${id}`;
// Escape anything that didn't come from us before it goes into innerHTML.
// Suggestion labels/notes are typed by the public, and track names come from
// YouTube, so both must be treated as untrusted text.
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDur = (s) => { s = Math.round(s||0); const m = Math.floor(s/60); const ss = String(s%60).padStart(2,"0"); return m + ":" + ss; };

async function loadAll() {
  const [sres, ares] = await Promise.all([
    fetch("/api/suggestions", { headers: H() }),
    fetch("/api/pool", { headers: H() }),
  ]);
  if (sres.status === 401 || ares.status === 401) { logout(); return; }
  const s = await sres.json();
  const a = await ares.json();
  renderSuggestions(s.items || []);
  renderActive(a.items || []);
}

function renderSuggestions(list) {
  const el = document.getElementById("suggestions");
  if (!list.length) { el.innerHTML = '<div class="empty">Nothing pending.</div>'; return; }
  el.innerHTML = "";
  for (const it of list) {
    const div = document.createElement("div");
    div.className = "row";
    div.innerHTML = `
      <span class="tag">${esc(it.type)}</span>
      <div class="main">
        <b>${esc(it.name || "(no label)")}</b>
        <small>${it.note ? esc(it.note) + " · " : ""}<a class="linkout" target="_blank" rel="noopener" href="${esc(ytLink(it))}">${esc(ytLink(it))}</a></small>
      </div>
      <button class="act ok">Approve</button>
      <button class="act no">Reject</button>`;
    div.querySelector(".ok").onclick = async (e) => {
      e.target.disabled = true; e.target.textContent = "Approving…";
      const d = await post("/api/approve", { key: it.key });
      if (d.error) alert(d.error);
      loadAll();
    };
    div.querySelector(".no").onclick = async () => { await post("/api/manage", { action: "reject", key: it.key }); loadAll(); };
    el.appendChild(div);
  }
}

let dragKey = null;

function renderActive(list) {
  const el = document.getElementById("active");
  if (!list.length) { el.innerHTML = '<div class="empty">Rotation is empty.</div>'; return; }
  el.innerHTML = "";
  const totalSec = list.reduce((a,b)=>a+(b.seconds||0),0);
  const hdr = document.createElement("div");
  hdr.className = "runtime";
  hdr.textContent = `${list.length} track(s) · total loop ${fmtDur(totalSec)}`;
  el.appendChild(hdr);
  for (const it of list) {
    const div = document.createElement("div");
    div.className = "row";
    div.draggable = true;
    div.dataset.key = it.key;
    div.innerHTML = `
      <span class="grip" title="Drag to reorder">⠿</span>
      <span class="tag">${fmtDur(it.seconds)}</span>
      <div class="main">
        <b>${esc(it.name || "(no label)")}</b>
        <small><a class="linkout" target="_blank" rel="noopener" href="${esc(videoLink(it.id))}">${esc(videoLink(it.id))}</a></small>
      </div>
      <button class="act no">Remove</button>`;
    div.querySelector(".no").onclick = async () => { await post("/api/manage", { action: "remove", key: it.key }); loadAll(); };

    div.addEventListener("dragstart", () => { dragKey = it.key; div.classList.add("dragging"); });
    div.addEventListener("dragend", () => { div.classList.remove("dragging"); saveOrder(); });
    div.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = el.querySelector(".dragging");
      if (!dragging || dragging === div) return;
      const rect = div.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      el.insertBefore(dragging, after ? div.nextSibling : div);
    });
    el.appendChild(div);
  }
}

async function saveOrder() {
  const keys = [...document.querySelectorAll("#active .row")].map(r => r.dataset.key);
  if (keys.length) await post("/api/manage", { action: "reorder", keys });
}

async function post(url, body) {
  try {
    const r = await fetch(url, { method: "POST", headers: H(), body: JSON.stringify(body) });
    if (r.status === 401) { logout(); return { error: "Unauthorized" }; }
    return await r.json().catch(() => ({ error: `Server error (${r.status})` }));
  } catch {
    return { error: "Network error — check your connection." };
  }
}

document.getElementById("addbtn").onclick = async () => {
  const url = document.getElementById("addurl").value.trim();
  if (!url) return;
  const btn = document.getElementById("addbtn");
  btn.textContent = "Adding…"; btn.disabled = true;
  const d = await post("/api/manage", { action: "add", url, name: document.getElementById("addname").value });
  btn.textContent = "Add"; btn.disabled = false;
  if (d.error) { alert(d.error); return; }
  if (typeof d.added === "number" && d.total > 1) alert(`Added ${d.added} of ${d.total} track(s) from that playlist.`);
  document.getElementById("addurl").value = "";
  document.getElementById("addname").value = "";
  loadAll();
};

document.getElementById("removeAll").onclick = async () => {
  if (!confirm("Remove ALL tracks from the rotation? This can't be undone.")) return;
  await post("/api/manage", { action: "removeAll" });
  loadAll();
};

function login() {
  document.getElementById("gate").style.display = "none";
  document.getElementById("app").style.display = "block";
  loadAll();
}
function logout() {
  sessionStorage.removeItem("pw"); PW = "";
  document.getElementById("gate").style.display = "block";
  document.getElementById("app").style.display = "none";
  document.getElementById("gerr").textContent = "Wrong password.";
}

document.getElementById("enter").onclick = async () => {
  PW = document.getElementById("pw").value;
  const r = await fetch("/api/suggestions", { headers: H() });
  if (r.ok) { sessionStorage.setItem("pw", PW); login(); }
  else { document.getElementById("gerr").textContent = "Wrong password."; }
};
document.getElementById("pw").addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("enter").click(); });

if (PW) { fetch("/api/suggestions", { headers: H() }).then(r => r.ok ? login() : sessionStorage.removeItem("pw")); }
