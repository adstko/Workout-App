// workout.js — the workout you're doing right now (started with the "+" button).
// It lives in data.active, so closing the tab doesn't lose it. "Finish Workout"
// moves it into data.sessions, which History and the chart read.

const screenWorkout = document.getElementById("screen-workout");
let elapsedId = null; // interval for the running clock (cleared by showScreen in app.js)

// Make one exercise for a workout from a list item { name, muscle, equipment, superset }.
// Weight and reps are pre-filled from the last time you did it.
function makeExercise(item, setCount) {
  const last = lastSession(item.name, "9999-12-31");
  const done = last ? last.sets.filter(s => s.done) : [];
  const count = setCount || done.length || 3;
  const sets = [];
  for (let i = 0; i < count; i++) {
    const src = done[Math.min(i, done.length - 1)];
    sets.push({ weight: src ? src.weight : "", reps: src ? src.reps : "", done: false, failure: false });
  }
  return { name: item.name, muscle: item.muscle, equipment: item.equipment, note: "", superset: item.superset || null, sets: sets };
}

// The big "+" button: start a new workout, or go back to the one in progress
function startWorkout() {
  if (!data.active) {
    data.active = { name: "Workout", startedAt: Date.now(), exercises: [] };
    saveData();
  }
  showScreen("workout");
}

function renderWorkout() {
  const a = data.active;
  if (!a) return showScreen("workouts");

  let html = `<div class="card head">
      <div><div class="muted">Duration</div><div class="clock" id="elapsed">${fmtClock((Date.now() - a.startedAt) / 1000)}</div></div>
      <button class="primary big" id="w-finish">Finish Workout</button>
    </div>
    <label>Workout name</label>
    <input id="w-name" type="text" maxlength="40" value="${esc(a.name)}">`;

  if (a.exercises.length === 0) html += `<p class="muted">No exercises yet. Tap "Select exercise" to add some.</p>`;

  a.exercises.forEach((ex, i) => {
    const doneCount = ex.sets.filter(s => s.done).length;
    html += `<button class="exrow" data-open="${i}">
      <b>${esc(ex.name)}</b>
      ${ex.superset ? '<span class="tag ss">SUPER SET</span>' : ""}
      ${doneCount ? `<span class="tag ok">${doneCount}/${ex.sets.length} ✓</span>` : ""}
      <span class="muted">${ex.sets.length} ${ex.sets.length === 1 ? "set" : "sets"}, ${esc(ex.muscle)}</span>
    </button>`;
  });

  html += `<div class="stack" style="margin-top:14px">
      <button class="big" id="w-select">Select exercise</button>
      ${a.exercises.length ? '<button class="big" id="w-template">Save as template</button>' : ""}
      <button class="big danger" id="w-discard">Discard workout</button>
    </div>`;

  screenWorkout.innerHTML = html;

  // Running clock
  const clock = document.getElementById("elapsed");
  elapsedId = setInterval(() => { clock.textContent = fmtClock((Date.now() - a.startedAt) / 1000); }, 1000);
}

function finishWorkout() {
  const a = data.active;
  const finished = a.exercises
    .filter(ex => ex.sets.some(s => s.done))
    .map(ex => Object.assign({}, ex, { sets: ex.sets.filter(s => s.done) })); // keep only the sets you did
  if (finished.length === 0) {
    if (confirm("You haven't finished any sets. Discard this workout?")) {
      data.active = null;
      saveData();
      showScreen("workouts");
    }
    return;
  }
  data.sessions.push({
    id: uid(),
    date: dateKey(new Date(a.startedAt)),
    name: a.name.trim() || "Workout",
    startedAt: a.startedAt,
    minutes: Math.max(1, Math.round((Date.now() - a.startedAt) / 60000)),
    exercises: finished,
  });
  data.active = null;
  saveData();
  stopTimer();
  toast("Workout saved 💪");
  showScreen("history");
}

function saveAsTemplate() {
  const a = data.active;
  const name = prompt("Template name (for example: Push Day)", a.name === "Workout" ? "" : a.name);
  if (!name || !name.trim()) return;
  data.templates.push({
    id: uid(),
    name: name.trim(),
    exercises: a.exercises.map(ex => ({ name: ex.name, muscle: ex.muscle, equipment: ex.equipment, sets: ex.sets.length, superset: ex.superset })),
  });
  saveData();
  toast("Template saved. Find it in Workouts.");
}

screenWorkout.addEventListener("click", e => {
  const a = data.active;
  const open = e.target.closest("[data-open]");
  if (open) return openExercise(Number(open.dataset.open));

  const id = e.target.id;
  if (id === "w-finish") finishWorkout();
  else if (id === "w-template") saveAsTemplate();
  else if (id === "w-discard") {
    if (confirm("Discard this workout? Everything you logged in it will be lost.")) {
      data.active = null;
      saveData();
      stopTimer();
      showScreen("workouts");
    }
  } else if (id === "w-select") {
    openPicker({
      mode: "add",
      onDone: items => {
        items.forEach(item => a.exercises.push(makeExercise(item)));
        saveData();
        showScreen("workout");
      },
      onCancel: () => showScreen("workout"),
    });
  }
});

screenWorkout.addEventListener("input", e => {
  if (e.target.id === "w-name") {
    data.active.name = e.target.value;
    saveData();
  }
});
