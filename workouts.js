// workouts.js — the Workouts tab: your presets (cards, create/edit screen, start, duplicate, delete).
// A preset is saved in data.templates:
//   { id, name, days: [1, 5], exercises: [ { name, muscle, equipment, sets, minReps, maxReps, superset } ] }
// Weight is NOT part of a preset. It is pre-filled from your last workout when you start.

const screenWorkouts = document.getElementById("screen-workouts");
let draft = null; // the preset being created/edited right now (null = just showing the list)

// ---------- Helpers ----------

function starterPreset(p) {
  return {
    id: uid(),
    name: p.name,
    days: p.days.slice(),
    exercises: p.exercises.map(([name, sets, minReps, maxReps]) => {
      const info = EXERCISES.find(e => e.name === name);
      return { name: name, muscle: info.muscle, equipment: info.equipment, sets: sets, minReps: minReps, maxReps: maxReps, superset: null };
    }),
  };
}

// Add the starter presets once, on first launch, only if you have no presets yet
function seedPresets() {
  if (data.presetsSeeded) return;
  if (data.templates.length === 0) DEFAULT_PRESETS.forEach(p => data.templates.push(starterPreset(p)));
  data.presetsSeeded = true;
  saveData();
}

// The "Add starter presets" button: adds any of Push / Pull / Legs you don't already have
function addStarterPresets() {
  const missing = DEFAULT_PRESETS.filter(p => !data.templates.some(t => t.name === p.name));
  missing.forEach(p => {
    const preset = starterPreset(p);
    preset.days = preset.days.filter(d => !presetForDay(d)); // don't take a day that's already scheduled
    data.templates.push(preset);
  });
  saveData();
  toast(missing.length ? "Added " + missing.map(p => p.name).join(", ") : "Push, Pull and Legs are already there.");
}

// The preset scheduled on a weekday (0 = Sunday ... 6 = Saturday), if any
function presetForDay(n) {
  return data.templates.find(p => (p.days || []).includes(n));
}

// Schedule a preset on a weekday (or make it a rest day with id ""). One preset per day.
function setDaySchedule(n, id) {
  data.templates.forEach(p => { p.days = (p.days || []).filter(d => d !== n); });
  const p = data.templates.find(t => t.id === id);
  if (p) p.days.push(n);
  saveData();
}

// Save a new preset. items: [{ name, muscle, equipment, sets, minReps, maxReps, superset }]
function newPreset(name, items) {
  data.templates.push({ id: uid(), name: name, days: [], exercises: items });
  saveData();
}

function presetMuscles(p) {
  return [...new Set(p.exercises.map(e => e.muscle).filter(Boolean))];
}

function dayLabel(n) {
  return WEEK.find(w => w[1] === n)[0];
}

function repText(ex) {
  if (!ex.minReps) return "";
  return ex.minReps === ex.maxReps ? String(ex.maxReps) : ex.minReps + "-" + ex.maxReps;
}

// A Super Set must be two exercises next to each other. Remove any link that isn't.
function cleanSupersets(list) {
  list.forEach((ex, i) => {
    const near = (list[i - 1] && list[i - 1].superset === ex.superset) || (list[i + 1] && list[i + 1].superset === ex.superset);
    if (ex.superset && !near) ex.superset = null;
  });
}

function unlinkSuperset(ex, list) {
  if (!ex.superset) return;
  const group = ex.superset;
  list.forEach(o => { if (o.superset === group) o.superset = null; });
}

// ---------- The list of presets ----------

function renderWorkouts() {
  if (draft) return renderPresetEditor();

  let html = `<h1>Workouts</h1>`;
  if (data.active) {
    html += `<div class="card"><b>Workout in progress</b><br>
      <span class="muted">${esc(data.active.name)} · ${data.active.exercises.length} exercises</span>
      <p></p><button class="big primary" id="wk-resume">Resume workout</button></div>`;
  }
  html += `<div class="stack">
      <button class="big primary" id="wk-new">+ New preset</button>
      <button class="big" id="wk-empty">Start empty workout</button></div>
    <h2>Weekly schedule</h2>
    <div class="card">${WEEK.map(([label, n]) => {
      const current = presetForDay(n);
      return `<div class="sched-row"><b>${label}</b><select data-sched="${n}" aria-label="${label} workout">
        <option value="">Rest day</option>
        ${data.templates.map(p => `<option value="${p.id}" ${current && current.id === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
      </select></div>`;
    }).join("")}
      <p class="muted">Pick what you do each day. It shows in the week strip and on the Today screen.</p></div>
    <h2>Presets (templates)</h2>`;

  if (data.templates.length === 0) {
    html += `<p class="muted">No presets yet. Tap "+ New preset", or finish a workout and tap "Save as preset".</p>`;
  }
  data.templates.forEach(p => {
    const days = (p.days || []).slice().sort((a, b) => (a || 7) - (b || 7)).map(d => `<span class="tag day">${dayLabel(d)}</span>`).join(" ");
    html += `<div class="card">
      <b>${esc(p.name)}</b> ${days}<br>
      <span class="muted">${p.exercises.length} ${p.exercises.length === 1 ? "exercise" : "exercises"} · ${esc(presetMuscles(p).join(", "))}</span>
      <div class="row" style="margin-top:10px">
        <button class="primary" data-start="${p.id}">Start</button>
        <button data-edit="${p.id}">Edit</button>
        <button data-copy="${p.id}">Duplicate</button>
        <button class="danger" data-delete="${p.id}">Delete</button>
      </div></div>`;
  });
  html += `<button class="big" id="wk-starter" style="margin-top:14px">Add starter presets (Push / Pull / Legs)</button>`;
  screenWorkouts.innerHTML = html;
}

// Start a preset: the normal workout screen with all its exercises and set rows ready.
// Weight and reps are pre-filled from the last time you did each exercise (makeExercise).
async function startPreset(id) {
  const p = data.templates.find(t => t.id === id);
  if (data.active && !(await askConfirm("You already have a workout in progress. Replace it with this preset?", "Replace"))) return;
  data.active = {
    name: p.name,
    startedAt: Date.now(),
    presetId: p.id, // so we can offer to update the preset after you finish
    exercises: p.exercises.map(item => makeExercise(item, item.sets)),
  };
  saveData();
  showScreen("workout");
}

// ---------- Create / edit screen ----------

function renderPresetEditor() {
  const isNew = !data.templates.some(t => t.id === draft.id);
  let html = `<div class="topbar"><button id="tpl-cancel" aria-label="Cancel">‹</button><h1>${isNew ? "New preset" : "Edit preset"}</h1></div>
    <label>Name</label>
    <input id="tpl-name" type="text" maxlength="40" placeholder="e.g. Push Day" value="${esc(draft.name)}">
    <label>Day of the week (optional)</label>
    <div class="chips" id="tpl-days">${WEEK.map(([label, n]) =>
      `<button data-day="${n}" class="${draft.days.includes(n) ? "on" : ""}">${label}</button>`).join("")}</div>
    <p class="muted">Tagged presets show up on the Today screen on those days.</p>
    <h2>Exercises</h2>`;

  if (draft.exercises.length === 0) html += `<p class="muted">No exercises yet. Tap "Add exercise".</p>`;

  draft.exercises.forEach((ex, i) => {
    const timed = TIMED.includes(ex.name);
    const repsRow = timed
      ? `<p class="muted">Timed: hold with good form (no rep range).</p>`
      : `<div class="reps-row"><span class="muted">Reps</span>
          <input type="number" inputmode="numeric" min="1" max="100" placeholder="min" aria-label="Minimum reps" data-i="${i}" data-rep="minReps"
            value="${ex.minReps || ""}" class="${repsOutOfRange(ex.name, ex.minReps || "") ? "warn" : ""}">
          <span>–</span>
          <input type="number" inputmode="numeric" min="1" max="100" placeholder="max" aria-label="Maximum reps" data-i="${i}" data-rep="maxReps"
            value="${ex.maxReps || ""}" class="${repsOutOfRange(ex.name, ex.maxReps || "") ? "warn" : ""}"></div>`;
    const linkedNext = ex.superset && draft.exercises[i + 1] && draft.exercises[i + 1].superset === ex.superset;
    html += `<div class="card pcard" data-i="${i}">
      <div class="phead">
        <span class="handle" aria-label="Drag to reorder" role="button">≡</span>
        <div><b>${esc(ex.name)}</b>${ex.superset ? '<span class="tag ss">SUPER SET</span>' : ""}
          <div class="muted">${esc(ex.muscle)}</div></div>
        <button class="danger" data-remove="${i}" aria-label="Remove">✕</button>
      </div>
      <div class="rest-row">
        <button data-minus="${i}" aria-label="Fewer sets">−</button>
        <span style="flex:1;text-align:center">${ex.sets} ${ex.sets === 1 ? "set" : "sets"}</span>
        <button data-plus="${i}" aria-label="More sets">+</button>
      </div>
      ${repsRow}
      ${i < draft.exercises.length - 1 ? `<button class="${linkedNext ? "on" : ""}" style="width:100%;margin-top:8px" data-link="${i}">${linkedNext ? "Super Set with next ✓" : "Super Set with next"}</button>` : ""}
    </div>`;
  });

  html += `<p class="muted">Keep reps between 6 and 15. Weight isn't saved in a preset: you fill it in during the workout.</p>
    <div class="stack" style="margin-top:14px">
      <button class="big" id="tpl-add">Add exercise</button>
      <button class="big primary" id="tpl-save">Save preset</button></div>`;
  screenWorkouts.innerHTML = html;
}

function savePreset() {
  if (!draft.name.trim()) return toast("Give the preset a name first.");
  if (draft.exercises.length === 0) return toast("Add at least one exercise.");
  for (const ex of draft.exercises) {
    if (TIMED.includes(ex.name)) { ex.minReps = ex.maxReps = null; continue; }
    if (!ex.minReps && ex.maxReps) ex.minReps = ex.maxReps; // only one box filled: use it for both
    if (!ex.maxReps && ex.minReps) ex.maxReps = ex.minReps;
    if (ex.minReps > ex.maxReps) return toast(ex.name + ": min reps is higher than max reps.");
  }
  draft.name = draft.name.trim();
  const i = data.templates.findIndex(t => t.id === draft.id);
  if (i >= 0) data.templates[i] = draft; else data.templates.push(draft);
  saveData();
  draft = null;
  toast("Preset saved");
  renderWorkouts();
}

function addExercisesToDraft() {
  openPicker({
    mode: "add",
    onDone: items => {
      items.forEach(it => {
        const timed = TIMED.includes(it.name);
        draft.exercises.push({ name: it.name, muscle: it.muscle, equipment: it.equipment, sets: 3,
          minReps: timed ? null : 8, maxReps: timed ? null : 12, superset: it.superset });
      });
      showScreen("workouts");
    },
    onCancel: () => showScreen("workouts"),
  });
}

screenWorkouts.addEventListener("click", async e => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.id === "wk-resume") showScreen("workout");
  else if (btn.id === "wk-starter") { addStarterPresets(); renderWorkouts(); }
  else if (btn.id === "wk-empty") startWorkout();
  else if (btn.id === "wk-new") { draft = { id: uid(), name: "", days: [], exercises: [] }; renderWorkouts(); }
  else if (btn.dataset.start) startPreset(btn.dataset.start);
  else if (btn.dataset.edit) {
    draft = JSON.parse(JSON.stringify(data.templates.find(t => t.id === btn.dataset.edit))); // edit a copy
    draft.days = draft.days || [];
    renderWorkouts();
  }
  else if (btn.dataset.copy) {
    const p = data.templates.find(t => t.id === btn.dataset.copy);
    const copy = JSON.parse(JSON.stringify(p));
    copy.id = uid();
    copy.name = p.name + " (copy)";
    copy.days = []; // so two presets don't both claim the same day
    data.templates.push(copy);
    saveData();
    toast("Duplicated. Tap Edit to rename it.");
    renderWorkouts();
  }
  else if (btn.dataset.delete) {
    const p = data.templates.find(t => t.id === btn.dataset.delete);
    if (await askConfirm('Delete preset "' + p.name + '"? Your logged workouts are not affected.', "Delete")) {
      data.templates = data.templates.filter(x => x.id !== p.id);
      saveData();
      renderWorkouts();
    }
  }
  // --- editor buttons ---
  else if (btn.id === "tpl-cancel") { draft = null; renderWorkouts(); }
  else if (btn.dataset.day) {
    const n = Number(btn.dataset.day);
    draft.days = draft.days.includes(n) ? draft.days.filter(d => d !== n) : draft.days.concat(n);
    btn.classList.toggle("on", draft.days.includes(n));
  }
  else if (btn.dataset.minus) { const ex = draft.exercises[btn.dataset.minus]; ex.sets = Math.max(1, ex.sets - 1); renderWorkouts(); }
  else if (btn.dataset.plus) { const ex = draft.exercises[btn.dataset.plus]; ex.sets = Math.min(10, ex.sets + 1); renderWorkouts(); }
  else if (btn.dataset.remove) {
    const [gone] = draft.exercises.splice(Number(btn.dataset.remove), 1);
    unlinkSuperset(gone, draft.exercises); // its partner is alone now
    renderWorkouts();
  }
  else if (btn.dataset.link) {
    const i = Number(btn.dataset.link);
    const a = draft.exercises[i], b = draft.exercises[i + 1];
    if (a.superset && a.superset === b.superset) unlinkSuperset(a, draft.exercises);
    else { unlinkSuperset(a, draft.exercises); unlinkSuperset(b, draft.exercises); a.superset = b.superset = uid(); }
    renderWorkouts();
  }
  else if (btn.id === "tpl-add") addExercisesToDraft();
  else if (btn.id === "tpl-save") savePreset();
});

screenWorkouts.addEventListener("input", e => {
  if (!draft) return;
  if (e.target.id === "tpl-name") draft.name = e.target.value;
  else if (e.target.dataset.rep) {
    const ex = draft.exercises[Number(e.target.dataset.i)];
    ex[e.target.dataset.rep] = e.target.value === "" ? null : Number(e.target.value);
    e.target.classList.toggle("warn", repsOutOfRange(ex.name, e.target.value));
  }
});

// ---------- Drag to reorder (drag the ≡ handle up or down) ----------
// While dragging we only slide the card and highlight where it will land.
// The list is reordered when you let go.

let drag = null;

screenWorkouts.addEventListener("pointerdown", e => {
  const handle = e.target.closest(".handle");
  if (!handle || !draft) return;
  const card = handle.closest(".pcard");
  drag = { card: card, cards: [...screenWorkouts.querySelectorAll(".pcard")], from: Number(card.dataset.i),
           to: Number(card.dataset.i), startY: e.clientY, y: e.clientY, startScroll: window.scrollY };
  card.classList.add("dragging");
  handle.setPointerCapture(e.pointerId);
  requestAnimationFrame(autoScroll);
});

screenWorkouts.addEventListener("pointermove", e => {
  if (drag) { drag.y = e.clientY; updateDrag(); }
});

// Slide the card with the finger and work out where it would land
function updateDrag() {
  drag.card.style.transform = "translateY(" + (drag.y - drag.startY + window.scrollY - drag.startScroll) + "px)";
  const rects = drag.cards.map(c => c.getBoundingClientRect());
  const others = drag.cards.map((c, i) => i).filter(i => i !== drag.from);
  let to = drag.from;
  others.forEach(i => { if (drag.y >= rects[i].top && drag.y <= rects[i].bottom) to = i; });
  if (others.length && drag.y < rects[others[0]].top) to = others[0];
  if (others.length && drag.y > rects[others[others.length - 1]].bottom) to = others[others.length - 1];
  drag.to = to;
  drag.cards.forEach((c, i) => c.classList.toggle("drop-target", i === to && to !== drag.from));
}

// While the finger rests near the top or bottom edge, keep scrolling so you can drag a long way
function autoScroll() {
  if (!drag) return;
  if (drag.y < 90) { window.scrollBy(0, -10); updateDrag(); }
  else if (drag.y > window.innerHeight - 170) { window.scrollBy(0, 10); updateDrag(); }
  requestAnimationFrame(autoScroll);
}

function endDrag() {
  if (!drag) return;
  const { from, to } = drag;
  drag = null;
  if (from !== to) {
    const [moved] = draft.exercises.splice(from, 1);
    draft.exercises.splice(to, 0, moved);
    cleanSupersets(draft.exercises);
  }
  renderWorkouts();
}
screenWorkouts.addEventListener("pointerup", endDrag);
screenWorkouts.addEventListener("pointercancel", endDrag);

// Changing a day in the weekly schedule
screenWorkouts.addEventListener("change", e => {
  if (e.target.dataset.sched) {
    setDaySchedule(Number(e.target.dataset.sched), e.target.value);
    toast("Schedule updated");
  }
});
