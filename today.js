// today.js — the Today screen: today's workout, set logging, progress tips, week strip

const screenToday = document.getElementById("screen-today");

// Which day the Today screen is showing. Tap a day in the week strip to change it.
let viewKey = null;
function viewDate() { return viewKey || todayKey(); }

// ---------- Building a workout ----------

// Find the most recent earlier workout where this exercise was actually done
function lastSession(name, beforeDate) {
  const list = allWorkouts().filter(w => w.date < beforeDate).reverse();
  for (const w of list) {
    const ex = w.exercises.find(e => e.name === name && e.sets.some(s => s.done));
    if (ex) return { date: w.date, sets: ex.sets };
  }
  return null;
}

// Make empty sets for one exercise. Weight is pre-filled from the last session.
function buildExercise(def, name, date) {
  const last = lastSession(name, date);
  const sets = [];
  for (let i = 0; i < def.sets; i++) {
    let weight = "";
    if (last) weight = last.sets[Math.min(i, last.sets.length - 1)].weight;
    sets.push({ weight: weight, reps: "", done: false });
  }
  return { name: name, sets: sets };
}

function buildWorkout(day, date) {
  return { day: day, exercises: PLAN[day].map(def => buildExercise(def, def.options[0], date)) };
}

// Get (or create) the workout for a date
function getWorkout(date) {
  if (!data.workouts[date]) {
    const weekday = new Date(date + "T00:00:00").getDay();
    data.workouts[date] = buildWorkout(DEFAULT_DAYS[weekday], date);
    saveData();
  }
  return data.workouts[date];
}

// ---------- Progress suggestion ----------

// If every set last time hit the TOP of the rep range, suggest adding weight
function progressTip(def, name, last) {
  if (!last || TIMED.includes(name)) return null;
  const done = last.sets.filter(s => s.done);
  const hitTop = done.length >= def.sets && done.every(s => Number(s.reps) >= def.max);
  if (!hitTop) return null;
  const best = Math.max(...done.map(s => Number(s.weight) || 0));
  const add = def.small ? 2.5 : 5;
  return { add: add, newWeight: best + add };
}

function repsOutOfRange(name, value) {
  if (value === "" || TIMED.includes(name)) return false;
  return Number(value) < 6 || Number(value) > 15;
}

// ---------- Drawing the screen ----------

function didTrain(key) {
  const lifted = allWorkouts().some(w => w.date === key && w.exercises.some(ex => ex.sets.some(s => s.done)));
  return lifted || data.cardio.some(c => c.date === key);
}

function renderWeek() {
  const now = new Date();
  const sinceMonday = (now.getDay() + 6) % 7;
  let html = "";
  for (let i = 0; i < 7; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday + i);
    const key = dateKey(date);
    const preset = presetForDay(date.getDay());
    html += `<button class="weekday ${didTrain(key) ? "trained" : ""} ${key === todayKey() ? "today" : ""} ${key === viewDate() ? "selected" : ""}" data-daykey="${key}">
      ${WEEK[i][0]}<b>${date.getDate()}${didTrain(key) ? '<span class="ck">✓</span>' : ""}</b><small>${preset ? esc(preset.name) : "Rest"}</small></button>`;
  }
  document.getElementById("week").innerHTML = html;
}

function dayNote(day) {
  const weekday = new Date(viewDate() + "T00:00:00").getDay();
  if (weekday === 0 && day === "Legs") return "Sunday: Legs or rest. Your call. Tap Rest if you're beat.";
  if (day === "Cardio") return "Rest + cardio day. 20-30 min easy cardio, or the interval day: 8 rounds of 30 sec hard / 90 sec easy. Log it on the Cardio tab.";
  if (day === "Rest") return "Rest day. Recovery is when you grow. A walk or golf is great. Log it on the Cardio tab.";
  if (weekday === 6) return "Weekend tip: golf or a long walk counts as cardio too.";
  return "";
}

function exerciseHtml(w, i, date) {
  const def = PLAN[w.day][i];
  const ex = w.exercises[i];
  const timed = TIMED.includes(ex.name);
  const last = lastSession(ex.name, date);

  // Title: a dropdown if there are choices (e.g. pull-ups or lat pulldown)
  let title = `<h3>${esc(ex.name)}</h3>`;
  if (def.options.length > 1) {
    title = `<select class="pick" data-ex="${i}">` +
      def.options.map(o => `<option ${o === ex.name ? "selected" : ""}>${esc(o)}</option>`).join("") + `</select>`;
  }

  const range = def.min === def.max ? def.max : def.min + "-" + def.max;
  let target = `${def.sets} sets × ${range} reps`;
  if (timed) target = `${def.sets} sets. Hold with good form (log seconds)`;
  if (def.failure) target += ` · last set to failure`;

  let html = `<div class="card">${title}<div class="target">${target}</div>`;

  if (last) {
    const text = last.sets.filter(s => s.done).map(s => (s.weight || 0) + "×" + s.reps).join(", ");
    html += `<div class="target">Last time (${prettyDate(last.date)}): ${text}</div>`;
  }

  const tip = progressTip(def, ex.name, last);
  if (tip) {
    html += `<div class="tip">📈 You hit ${def.max} reps on every set last time. Add ${tip.add} lb!
      <button data-usetip="${i}" data-weight="${tip.newWeight}">Use ${tip.newWeight} lb</button></div>`;
  }

  ex.sets.forEach((set, j) => {
    const isFailure = def.failure && j === ex.sets.length - 1;
    html += `<div class="set ${set.done ? "done" : ""}">
      <div class="set-n">Set ${j + 1}${isFailure ? '<br><span class="tag">FAILURE</span>' : ""}</div>
      <input type="number" inputmode="decimal" placeholder="lb" aria-label="Weight" value="${esc(set.weight)}" data-ex="${i}" data-set="${j}" data-field="weight">
      <input type="number" inputmode="numeric" placeholder="${timed ? "sec" : "reps"}" aria-label="Reps" value="${esc(set.reps)}"
        class="${repsOutOfRange(ex.name, set.reps) ? "warn" : ""}" data-ex="${i}" data-set="${j}" data-field="reps">
      <button class="check" data-toggle="1" data-ex="${i}" data-set="${j}" aria-label="Finish set">✓</button>
    </div>`;
  });

  return html + `</div>`;
}

// Preset(s) tagged for the day being viewed
function todaysPresetsHtml() {
  const day = new Date(viewDate() + "T00:00:00");
  const isToday = viewDate() === todayKey();
  const title = isToday ? "Today's preset" : day.toLocaleDateString(undefined, { weekday: "long" }) + "'s preset";
  const list = data.templates.filter(p => (p.days || []).includes(day.getDay()));
  if (list.length === 0) {
    return `<div class="card"><div class="muted">${title}</div>
      <p class="muted">Rest day. Nothing scheduled. Set your week in the Workouts tab.</p></div>`;
  }
  return list.map(p => `<div class="card">
      <div class="muted">${title}</div>
      <h3>${esc(p.name)}</h3>
      <p class="muted">${p.exercises.length} exercises · ${esc(presetMuscles(p).join(", "))}</p>
      <button class="big primary" data-preset-start="${p.id}">Start</button></div>`).join("");
}

function renderToday() {
  const date = viewDate();
  const w = getWorkout(date);
  const label = new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  let html = `<h1>${w.day} Day</h1><p class="muted">${label}</p>${todaysPresetsHtml()}<div id="week"></div>`;

  html += `<div class="row days">` + ["Push", "Pull", "Legs", "Cardio", "Rest"]
    .map(d => `<button data-day="${d}" class="${d === w.day ? "on" : ""}">${d}</button>`).join("") + `</div>`;

  const note = dayNote(w.day);
  if (note) html += `<div class="card">${note}</div>`;

  if (w.exercises.length) {
    html += `<p class="muted">Rest timer after each set:</p><div class="row">` + [60, 90, 120]
      .map(s => `<button data-rest="${s}" class="${s === data.restSeconds ? "on" : ""}">${s}s</button>`).join("") + `</div>`;
    html += `<p class="muted">Keep every set between 6 and 15 reps. Stop if form breaks down.</p>`;
    w.exercises.forEach((ex, i) => { html += exerciseHtml(w, i, date); });
  }

  screenToday.innerHTML = html;
  renderWeek();
}

// ---------- Handling taps and typing ----------

screenToday.addEventListener("click", async e => {
  const dayCell = e.target.closest("[data-daykey]");
  if (dayCell) { viewKey = dayCell.dataset.daykey; renderToday(); return; }

  const presetBtn = e.target.closest("[data-preset-start]");
  if (presetBtn) return startPreset(presetBtn.dataset.presetStart);

  const w = getWorkout(viewDate());

  const dayBtn = e.target.closest("[data-day]");
  if (dayBtn) {
    const anyDone = w.exercises.some(ex => ex.sets.some(s => s.done));
    if (anyDone && !(await askConfirm("Switching days clears today's logged sets. Continue?", "Switch"))) return;
    data.workouts[viewDate()] = buildWorkout(dayBtn.dataset.day, viewDate());
    saveData();
    renderToday();
    return;
  }

  const restBtn = e.target.closest("[data-rest]");
  if (restBtn) {
    data.restSeconds = Number(restBtn.dataset.rest);
    saveData();
    renderToday();
    return;
  }

  const tipBtn = e.target.closest("[data-usetip]");
  if (tipBtn) {
    // Put the suggested weight in every set that isn't finished yet
    w.exercises[Number(tipBtn.dataset.usetip)].sets.forEach(s => {
      if (!s.done) s.weight = tipBtn.dataset.weight;
    });
    saveData();
    renderToday();
    return;
  }

  const checkBtn = e.target.closest("[data-toggle]");
  if (checkBtn) {
    const set = w.exercises[Number(checkBtn.dataset.ex)].sets[Number(checkBtn.dataset.set)];
    const row = checkBtn.closest(".set");
    if (!set.done && set.reps === "") {
      row.querySelector('[data-field="reps"]').focus(); // need reps before it counts as done
      return;
    }
    set.done = !set.done;
    saveData();
    row.classList.toggle("done", set.done);
    renderWeek();
    if (set.done) startTimer();
  }
});

// Save every keystroke so nothing is lost if the tab closes
screenToday.addEventListener("input", e => {
  const field = e.target.dataset.field;
  if (!field) return;
  const w = getWorkout(viewDate());
  const ex = w.exercises[Number(e.target.dataset.ex)];
  ex.sets[Number(e.target.dataset.set)][field] = e.target.value;
  saveData();
  if (field === "reps") e.target.classList.toggle("warn", repsOutOfRange(ex.name, e.target.value));
});

// Picking a different option (e.g. Lat pulldown instead of Pull-ups)
screenToday.addEventListener("change", async e => {
  if (!e.target.classList.contains("pick")) return;
  const w = getWorkout(viewDate());
  const i = Number(e.target.dataset.ex);
  if (w.exercises[i].sets.some(s => s.done) && !(await askConfirm("Switching clears the sets you logged for this exercise. Continue?", "Switch"))) {
    renderToday();
    return;
  }
  w.exercises[i] = buildExercise(PLAN[w.day][i], e.target.value, viewDate());
  saveData();
  renderToday();
});
