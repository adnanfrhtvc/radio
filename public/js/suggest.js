const msg = document.getElementById("msg");
document.getElementById("send").addEventListener("click", async () => {
  const url = document.getElementById("url").value.trim();
  if (!url) { msg.textContent = "Add a link first."; msg.className = "err"; return; }
  msg.textContent = "Sending…"; msg.className = "";
  try {
    const r = await fetch("/api/suggest", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url,
        name: document.getElementById("name").value,
        note: document.getElementById("note").value,
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Something went wrong.");
    msg.textContent = d.duplicate ? "Already suggested — thanks!" : "Thanks! Suggestion received.";
    msg.className = "ok";
    document.getElementById("url").value = "";
    document.getElementById("name").value = "";
    document.getElementById("note").value = "";
  } catch (e) {
    msg.textContent = e.message; msg.className = "err";
  }
});
