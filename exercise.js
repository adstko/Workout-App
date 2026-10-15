// exercise.js — one exercise of the workout in progress: log weight, reps, failure per set

const screenExercise = document.getElementById("screen-exercise");
let currentEx = 0;      // which exercise (position in data.active.exercises)
let menuOpen = false;   // the three-dot menu
let noteOpen = false;   // the note box

// Rest time for this workout: the preset's own (Home presets use 45 s), otherwise your default
function currentRest() { return (data.active && data.active.rest) || data.customRest; }

// Push-ups, plank, dead bugs...: log reps or seconds, no weight box (the menu can add one back)
function noWeight(ex) { return (ex.equipment === "Bodyweight" || TIMED.includes(ex.name)) && !ex.showWeight; }

// The other exercise in this one's Super Set
function supersetPartner(a, ex) { return ex.superset ? a.exercises.find(o => o !== ex && o.superset === ex.superset) : null; }

function openExercise(i) {
  currentEx = i;
  menuOpen = false;
  noteOpen = false;
  showScreen("exercise");
}

// "Target: 4 sets × 6-8 reps" (or seconds), plus "last set to failure" and a hint if the preset has one
function targetLine(ex) {
  let text = "";
  if (ex.seconds) text = `Target: ${ex.sets.length} sets × ${ex.seconds} sec`;
  else if (ex.minReps) text = `Target: ${ex.sets.length} sets × ${repText(ex)} reps`;
  if (text && ex.failureLast) text += " · last set to failure (stop if your form breaks)";
  return (text ? `<p class="muted">${text}</p>` : "") + (ex.hint ? `<p class="muted">${esc(ex.hint)}</p>` : "");
}

// Hit the top of the rep range on every set last time? Suggest adding weight (5 lb, or 2.5 lb for small lifts)
function progressTipFor(ex) {
  if (TIMED.includes(ex.name) || !ex.maxReps) return null;
  const last = lastSession(ex.name, "9999-12-31");
  if (!last) return null;
  const done = last.sets.filter(s => s.done);
  if (done.length < ex.sets.length || !done.every(s => Number(s.reps) >= ex.maxReps)) return null;
  const best = Math.max(...done.map(s => Number(s.weight) || 0));
  const add = SMALL_LIFTS.includes(ex.name) ? 2.5 : 5;
  if (ex.sets.every(s => Number(s.weight) >= best + add)) return null; // you already moved up
  return { add: add, newWeight: best + add };
}

function renderExercise() {
  const a = data.active;
  const ex = a && a.exercises[currentEx];
  if (!ex) return showScreen("workout");
  const timed = TIMED.includes(ex.name);

  let html = `<div class="topbar"><button id="ex-back" aria-label="Back to workout">‹</button><h1>${esc(a.name)}</h1></div>

    <div class="card" id="rest-card">
      <div class="muted">Rest Timer</div>
      <div class="rest-row">
        <button data-adj="-15">−15</button>
        <span id="rest-top">${fmtClock(currentRest())}</span>
        <button data-adj="15">+15</button>
        <button id="rest-skip">Skip</button>
      </div>
    </div>

    <div class="head">
      <div><h1>${esc(ex.name)}</h1><p class="muted">${esc(ex.muscle)} · ${esc(ex.equipment)}</p>
        ${targetLine(ex)}</div>
      <button class="dots" id="ex-menu" aria-label="More">⋮</button>
    </div>`;

  if (ex.superset) {
    const partner = supersetPartner(a, ex);
    if (partner) html += `<p><span class="tag ss">SUPER SET</span> with ${esc(partner.name)}</p>
      <p class="muted">Do a set of each, back to back. The rest timer starts after both.</p>
      <button id="ss-go" data-partner="${a.exercises.indexOf(partner)}">Go to ${esc(partner.name)}</button>`;
  }

  const tip = progressTipFor(ex);
  if (tip) {
    html += `<div class="tip">You hit ${ex.maxReps} reps on every set last time. Time to add ${tip.add} lb.
      <button data-usetip="1" data-weight="${tip.newWeight}">Use ${tip.newWeight} lb</button></div>`;
  }

  if (menuOpen) {
    html += `<div class="menu">
      <button id="m-remove" class="danger">Remove exercise</button>
      <button id="m-swap">Swap exercise</button>
      <button id="m-note">Add note</button>
      ${currentEx < a.exercises.length - 1 || ex.superset ? `<button id="m-ss">${ex.superset ? "Remove Super Set" : "Super Set with next exercise"}</button>` : ""}
      ${ex.equipment === "Bodyweight" && !TIMED.includes(ex.name) ? `<button id="m-weight">${ex.showWeight ? "Hide weight" : "Add weight"}</button>` : ""}</div>`;
  }
  if (noteOpen || ex.note) {
    html += `<textarea id="ex-note" placeholder="Notes (seat height, how it felt...)">${esc(ex.note)}</textarea>`;
  }

  const nw = noWeight(ex);
  html += `<div class="tset head-row ${nw ? "nowt" : ""}"><div>Set</div>${nw ? "" : `<div>${timed ? "" : "Weight (lb)"}</div>`}<div>${timed ? "Seconds" : "Reps"}</div><div>Fail</div><div>✓</div></div>`;
  ex.sets.forEach((s, j) => {
    html += `<div class="tset ${s.done ? "done" : ""} ${nw ? "nowt" : ""}">
      <div class="set-n">${j + 1}</div>
      ${nw ? "" : `<input type="number" inputmode="decimal" placeholder="lb" aria-label="Weight" value="${esc(s.weight)}" data-set="${j}" data-field="weight">`}
      <input type="number" inputmode="numeric" placeholder="${timed ? "sec" : "reps"}" aria-label="Reps" value="${esc(s.reps)}"
        class="${repsOutOfRange(ex.name, s.reps) ? "warn" : ""}" data-set="${j}" data-field="reps">
      <button class="failbtn ${s.failure ? "on" : ""}" data-fail="${j}" aria-label="Failure set">FAIL</button>
      <button class="check" data-check="${j}" aria-label="Finish set">✓</button>
    </div>`;
  });

  const last = currentEx === a.exercises.length - 1;
  html += `<div class="stack" style="margin-top:16px">
      <button class="big" id="ex-add">+ Add set</button>
      <button class="big primary" id="ex-next">${last ? "Save &amp; Finish exercises" : "Save &amp; Continue"}</button>
    </div>
    <p class="muted">Keep every set between 6 and 15 reps.</p>`;

  screenExercise.innerHTML = html;
  if (timerOn) tickTimer(); // a running timer keeps showing in the new clock
}

screenExercise.addEventListener("click", async e => {
  const a = data.active;
  const ex = a.exercises[currentEx];
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.dataset.usetip) {
    ex.sets.forEach(s => { if (!s.done) s.weight = btn.dataset.weight; }); // weight for the sets still to do
    saveData();
    renderExercise();
    return;
  }
  if (btn.dataset.adj) {
    const change = Number(btn.dataset.adj), next = Math.min(300, Math.max(15, currentRest() + change));
    if (a.rest) a.rest = next; else data.customRest = next; // a Home workout changes only its own rest time
    saveData();
    if (timerOn) adjustTimer(change);
    else document.getElementById("rest-top").textContent = fmtClock(currentRest());
  }
  else if (btn.id === "rest-skip") stopTimer();
  else if (btn.id === "ex-back") showScreen("workout");
  else if (btn.id === "ex-menu") { menuOpen = !menuOpen; renderExercise(); }
  else if (btn.id === "ss-go") openExercise(Number(btn.dataset.partner));
  else if (btn.id === "m-ss") {
    if (ex.superset) { const p = supersetPartner(a, ex); ex.superset = null; if (p) p.superset = null; }
    else { const next = a.exercises[currentEx + 1]; const g = uid(); if (next.superset) { const old = supersetPartner(a, next); if (old) old.superset = null; } ex.superset = next.superset = g; }
    menuOpen = false; saveData(); renderExercise();
  }
  else if (btn.id === "m-weight") { ex.showWeight = !ex.showWeight; menuOpen = false; saveData(); renderExercise(); }
  else if (btn.id === "m-note") { noteOpen = true; menuOpen = false; renderExercise(); document.getElementById("ex-note").focus(); }
  else if (btn.id === "m-remove") {
    if (!(await askConfirm("Remove " + ex.name + " from this workout?", "Remove"))) return;
    a.exercises.splice(currentEx, 1);
    if (ex.superset && a.exercises.filter(o => o.superset === ex.superset).length < 2) {
      a.exercises.forEach(o => { if (o.superset === ex.superset) o.superset = null; }); // partner is alone now
    }
    saveData();
    showScreen("workout");
  }
  else if (btn.id === "m-swap") {
    openPicker({
      mode: "swap",
      onDone: items => {
        const fresh = makeExercise(items[0]);
        fresh.superset = ex.superset;
        fresh.note = ex.note;
        fresh.minReps = ex.minReps; // a swap keeps the target rep range
        fresh.maxReps = ex.maxReps;
        a.exercises[currentEx] = fresh;
        saveData();
        showScreen("exercise");
      },
      onCancel: () => showScreen("exercise"),
    });
  }
  else if (btn.dataset.fail) {
    const s = ex.sets[Number(btn.dataset.fail)];
    s.failure = !s.failure;
    saveData();
    btn.classList.toggle("on", s.failure);
  }
  else if (btn.dataset.check) {
    const s = ex.sets[Number(btn.dataset.check)];
    const row = btn.closest(".tset");
    if (!s.done && s.reps === "") { row.querySelector('[data-field="reps"]').focus(); return; } // need reps first
    s.done = !s.done;
    saveData();
    queueOnlineSync();
    row.classList.toggle("done", s.done);
    if (s.done) {
      const partner = supersetPartner(a, ex), idx = Number(btn.dataset.check);
      // In a Super Set the rest starts once the partner's matching set is done too
      if (!partner || (partner.sets[idx] && partner.sets[idx].done) || !partner.sets[idx]) startTimer(currentRest());
      else toast("Now do " + partner.name);
    }
  }
  else if (btn.id === "ex-add") {
    const prev = ex.sets[ex.sets.length - 1];
    ex.sets.push({ weight: prev ? prev.weight : "", reps: prev ? prev.reps : "", done: false, failure: false });
    saveData();
    renderExercise();
  }
  else if (btn.id === "ex-next") {
    saveData();
    if (currentEx < a.exercises.length - 1) openExercise(currentEx + 1);
    else showScreen("workout");
  }
});

// Save every keystroke
screenExercise.addEventListener("input", e => {
  const ex = data.active.exercises[currentEx];
  if (e.target.id === "ex-note") ex.note = e.target.value;
  else if (e.target.dataset.field) {
    ex.sets[Number(e.target.dataset.set)][e.target.dataset.field] = e.target.value;
    if (e.target.dataset.field === "reps") e.target.classList.toggle("warn", repsOutOfRange(ex.name, e.target.value));
  } else return;
  saveData();
});
