// cardio.js — the Cardio screen: a small form and a list of past cardio

const screenCardio = document.getElementById("screen-cardio");

function renderCardio() {
  let html = `<h1>Cardio</h1>
    <div class="card muted">
      • 20-30 min easy cardio after lifting, 3 days a week<br>
      • 1 interval day: 8 rounds of 30 sec hard / 90 sec easy<br>
      • Weekends: golf or a long walk
    </div>

    <form id="cardio-form" class="card">
      <label>Date</label>
      <input type="date" name="date" value="${todayKey()}" required>
      <label>Type</label>
      <select name="type">${CARDIO_TYPES.map(t => `<option>${esc(t)}</option>`).join("")}</select>
      <label>Minutes</label>
      <input type="number" name="minutes" inputmode="numeric" min="1" max="300" placeholder="e.g. 25" required>
      <label>Notes</label>
      <input type="text" name="notes" placeholder="Optional">
      <p></p>
      <button class="big primary" type="submit">Save cardio</button>
    </form>

    <h2>Recent cardio</h2>`;

  // Newest first
  const list = data.cardio.slice().sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  if (list.length === 0) html += `<p class="muted">Nothing logged yet.</p>`;
  list.forEach(c => {
    html += `<div class="card entry"><div>
      <b>${esc(c.type)}</b> · ${c.minutes} min<br>
      <span class="muted">${prettyDate(c.date)}${c.notes ? " · " + esc(c.notes) : ""}</span>
      </div><div class="btns"><button data-health="${c.id}">Send to Health</button><button data-delete="${c.id}">Delete</button></div></div>`;
  });

  screenCardio.innerHTML = html;
}

screenCardio.addEventListener("submit", e => {
  e.preventDefault();
  const form = e.target;
  data.cardio.push({
    id: String(Date.now()),
    date: form.date.value,
    type: form.type.value,
    minutes: Number(form.minutes.value),
    notes: form.notes.value.trim(),
  });
  saveData();
  renderCardio();
});

screenCardio.addEventListener("click", async e => {
  const healthBtn = e.target.closest("[data-health]");
  if (healthBtn) return sendCardioToHealth(healthBtn.dataset.health);
  const btn = e.target.closest("[data-delete]");
  if (btn && await askConfirm("Delete this cardio entry?", "Delete")) {
    data.cardio = data.cardio.filter(c => c.id !== btn.dataset.delete);
    saveData();
    renderCardio();
  }
});
