// exercise.js — one exercise of the workout in progress: log weight, reps, failure per set

const screenExercise = document.getElementById("screen-exercise");
let currentEx = 0;      // which exercise (position in data.active.exercises)
let menuOpen = false;   // the three-dot menu
let noteOpen = false;   // the note box

function openExercise(i) {
  currentEx = i;
  menuOpen = false;
  noteOpen = false;
  showScreen("exercise");
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
        <span id="rest-top">${fmtClock(data.customRest)}</span>
        <button data-adj="15">+15</button>
        <button id="rest-skip">Skip</button>
      </div>
    </div>

    <div class="head">
      <div><h1>${esc(ex.name)}</h1><p class="muted">${esc(ex.muscle)} · ${esc(ex.equipment)}</p>
        ${ex.minReps ? `<p class="muted">Target: ${ex.sets.length} sets × ${repText(ex)} reps</p>` : ""}</div>
      <button class="dots" id="ex-menu" aria-label="More">⋮</button>
    </div>`;

  if (ex.superset) {
    const partner = a.exercises.find((o, k) => k !== currentEx && o.superset === ex.superset);
    if (partner) html += `<p><span class="tag ss">SUPER SET</span> with ${esc(partner.name)}</p>`;
  }

  if (menuOpen) {
    html += `<div class="menu">
      <button id="m-remove" class="danger">Remove exercise</button>
      <button id="m-swap">Swap exercise</button>
      <button id="m-note">Add note</button></div>`;
  }
  if (noteOpen || ex.note) {
    html += `<textarea id="ex-note" placeholder="Notes (seat height, how it felt...)">${esc(ex.note)}</textarea>`;
  }

  html += `<div class="tset head-row"><div>Set</div><div>${timed ? "" : "Weight (lb)"}</div><div>${timed ? "Seconds" : "Reps"}</div><div>Fail</div><div>✓</div></div>`;
  ex.sets.forEach((s, j) => {
    html += `<div class="tset ${s.done ? "done" : ""}">
      <div class="set-n">${j + 1}</div>
      <input type="number" inputmode="decimal" placeholder="lb" aria-label="Weight" value="${esc(s.weight)}" data-set="${j}" data-field="weight">
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

  if (btn.dataset.adj) {
    const change = Number(btn.dataset.adj);
    data.customRest = Math.min(300, Math.max(15, data.customRest + change));
    saveData();
    if (timerOn) adjustTimer(change);
    else document.getElementById("rest-top").textContent = fmtClock(data.customRest);
  }
  else if (btn.id === "rest-skip") stopTimer();
  else if (btn.id === "ex-back") showScreen("workout");
  else if (btn.id === "ex-menu") { menuOpen = !menuOpen; renderExercise(); }
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
    if (s.done) startTimer(data.customRest);
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
