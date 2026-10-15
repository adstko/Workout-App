// cardio.js — the Cardio screen: a small form and a list of past cardio

const screenCardio = document.getElementById("screen-cardio");

// "Today", "Yesterday", then the days before (the last 60 days), as dropdown options
function dateChoices() {
  const now = new Date();
  let html = "";
  for (let i = 0; i < 60; i++) {
    const key = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    html += `<option value="${key}">${i === 0 ? "Today" : i === 1 ? "Yesterday" : prettyDate(key)}</option>`;
  }
  return html;
}

// How hard it felt, 1 to 10
const EFFORT_LABELS = { 1: "very easy", 3: "easy", 5: "moderate", 7: "hard", 9: "very hard", 10: "as hard as it gets" };
function effortOptions() {
  let html = `<option value="">Skip</option>`;
  for (let n = 1; n <= 10; n++) html += `<option value="${n}">${n}${EFFORT_LABELS[n] ? " · " + EFFORT_LABELS[n] : ""}</option>`;
  return html;
}

// Open the Cardio form with some boxes already filled in (used by "Log it" buttons). { type, minutes, notes }
let cardioPrefill = null;
function openCardioLog(fill) {
  cardioPrefill = fill;
  showScreen("cardio");
}

function renderCardio() {
  let html = `<h1>Cardio</h1>
    <div class="card muted">
      • 20-30 min easy cardio after lifting, 3 days a week<br>
      • 1 interval day: 8 rounds of 30 sec hard / 90 sec easy<br>
      • Weekends: golf or a long walk
    </div>

    ${quickWalkHtml()}

    <form id="cardio-form" class="card">
      <label>Date</label>
      <select name="date">${dateChoices()}</select>
      <label>Type</label>
      <select name="type">${CARDIO_TYPES.map(t => `<option>${esc(t)}</option>`).join("")}</select>
      <label>Minutes</label>
      <input type="number" name="minutes" inputmode="numeric" min="1" max="300" placeholder="e.g. 25" required>
      <div id="row-stairs" hidden>
        <label>Floors climbed (optional)</label>
        <input type="number" name="floors" inputmode="numeric" min="0" max="5000" step="1" placeholder="e.g. 30">
      </div>
      <div class="two" id="row-miles">
        <div><label>Miles (optional)</label>
          <input type="number" name="miles" inputmode="decimal" min="0" max="500" step="any" placeholder="e.g. 3.1"></div>
        <div><label>Climbed, ft (optional)</label>
          <input type="number" name="climb" inputmode="numeric" min="0" max="30000" step="any" placeholder="e.g. 400"></div>
      </div>
      <label>How hard did it feel? (optional)</label>
      <select name="effort">${effortOptions()}</select>
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
      <b>${esc(c.type)}</b> · ${c.minutes} min${c.floors ? " · " + c.floors + " floors" : ""}${c.miles ? " · " + c.miles + " mi" : ""}${c.climb && !c.floors ? " · " + c.climb + " ft climbed" : ""}${c.effort ? " · felt " + c.effort + "/10" : ""}${c.mode ? " · " + (c.mode === "home" ? "Home" : "Gym") : ""}<br>
      <span class="muted">${prettyDate(c.date)}${c.notes ? " · " + esc(c.notes) : ""}${healthTypeFor(c.type) ? "" : " · already in Fitness via 18Birdies"}</span>
      </div><div class="btns">${healthTypeFor(c.type) ? `<button data-health="${c.id}">Send to Health</button>` : ""}<button data-delete="${c.id}">Delete</button></div></div>`;
  });

  screenCardio.innerHTML = html;

  if (cardioPrefill) { // "Log it" buttons fill in the form for you
    const form = document.getElementById("cardio-form");
    if (cardioPrefill.type) form.type.value = cardioPrefill.type;
    if (cardioPrefill.minutes) form.minutes.value = cardioPrefill.minutes;
    if (cardioPrefill.notes) form.notes.value = cardioPrefill.notes;
    cardioPrefill = null;
  }
}

screenCardio.addEventListener("submit", e => {
  e.preventDefault();
  const form = e.target;
  const stairs = form.type.value === "Stairs";
  const floors = stairs && form.floors.value ? Math.max(0, Math.round(Number(form.floors.value))) : null;
  data.cardio.push({
    id: String(Date.now()),
    date: form.date.value,
    type: form.type.value,
    minutes: Number(form.minutes.value),
    miles: !stairs && form.miles.value ? Math.max(0, Number(form.miles.value)) : null,   // optional
    floors: floors,                                                                      // stairs only
    climb: stairs ? (floors ? floors * 10 : null)                                         // a floor is about 10 ft
                  : (form.climb.value ? Math.max(0, Number(form.climb.value)) : null),   // optional, feet
    effort: form.effort.value ? Number(form.effort.value) : null,   // 1-10, optional
    notes: form.notes.value.trim(),
  });
  saveData();
  queueOnlineSync();
  renderCardio();
});

screenCardio.addEventListener("click", async e => {
  const healthBtn = e.target.closest("[data-health]");
  if (healthBtn) return sendCardioToHealth(healthBtn.dataset.health);
  const btn = e.target.closest("[data-delete]");
  if (btn && await askConfirm("Delete this cardio entry?", "Delete")) {
    data.cardio = data.cardio.filter(c => c.id !== btn.dataset.delete);
    saveData();
    queueOnlineSync();
    renderCardio();
  }
});

// Stairs: show the Floors box instead of Miles / Climbed
screenCardio.addEventListener("change", e => {
  if (e.target.name === "type") {
    const stairs = e.target.value === "Stairs";
    document.getElementById("row-stairs").hidden = !stairs;
    document.getElementById("row-miles").hidden = stairs;
  }
});
