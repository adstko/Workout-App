// workouts.js — the Workouts tab: your templates (start, edit, delete) and a template editor

const screenWorkouts = document.getElementById("screen-workouts");
let draft = null; // the template being edited right now (null = just showing the list)

function renderWorkouts() {
  if (draft) return renderTemplateEditor();

  let html = `<h1>Workouts</h1>`;
  if (data.active) {
    html += `<div class="card"><b>Workout in progress</b><br>
      <span class="muted">${esc(data.active.name)} · ${data.active.exercises.length} exercises</span>
      <p></p><button class="big primary" id="wk-resume">Resume workout</button></div>`;
  }
  html += `<div class="stack">
      <button class="big" id="wk-empty">Start empty workout</button>
      <button class="big" id="wk-new">New template</button></div>
    <h2>Templates</h2>`;

  if (data.templates.length === 0) {
    html += `<p class="muted">No templates yet. Build a workout with the "+" button, then tap "Save as template".</p>`;
  }
  data.templates.forEach(t => {
    html += `<div class="card">
      <b>${esc(t.name)}</b><br>
      <span class="muted">${t.exercises.length} exercises: ${esc(t.exercises.map(e => e.name).join(", "))}</span>
      <div class="row" style="margin-top:10px">
        <button class="primary" data-start="${t.id}">Start</button>
        <button data-edit="${t.id}">Edit</button>
        <button class="danger" data-delete="${t.id}">Delete</button>
      </div></div>`;
  });
  screenWorkouts.innerHTML = html;
}

function startTemplate(id) {
  const t = data.templates.find(t => t.id === id);
  if (data.active && !confirm("You already have a workout in progress. Replace it with this template?")) return;
  data.active = {
    name: t.name,
    startedAt: Date.now(),
    exercises: t.exercises.map(item => makeExercise(item, item.sets)), // weights/reps pre-filled from last time
  };
  saveData();
  showScreen("workout");
}

// ---------- Template editor ----------

function renderTemplateEditor() {
  let html = `<div class="topbar"><button id="tpl-cancel" aria-label="Cancel">‹</button><h1>Template</h1></div>
    <label>Name</label>
    <input id="tpl-name" type="text" maxlength="40" placeholder="e.g. Push Day" value="${esc(draft.name)}">`;

  if (draft.exercises.length === 0) html += `<p class="muted">No exercises yet.</p>`;
  draft.exercises.forEach((ex, i) => {
    html += `<div class="card">
      <b>${esc(ex.name)}</b>${ex.superset ? '<span class="tag ss">SUPER SET</span>' : ""}
      <span class="muted"> · ${esc(ex.muscle)}</span>
      <div class="rest-row">
        <button data-minus="${i}" aria-label="Fewer sets">−</button>
        <span style="flex:1;text-align:center">${ex.sets} ${ex.sets === 1 ? "set" : "sets"}</span>
        <button data-plus="${i}" aria-label="More sets">+</button>
        <button class="danger" data-remove="${i}" aria-label="Remove">✕</button>
      </div></div>`;
  });

  html += `<div class="stack" style="margin-top:14px">
      <button class="big" id="tpl-add">Select exercise</button>
      <button class="big primary" id="tpl-save">Save template</button></div>`;
  screenWorkouts.innerHTML = html;
}

screenWorkouts.addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.id === "wk-resume") showScreen("workout");
  else if (btn.id === "wk-empty") startWorkout();
  else if (btn.id === "wk-new") { draft = { id: uid(), name: "", exercises: [] }; renderWorkouts(); }
  else if (btn.dataset.start) startTemplate(btn.dataset.start);
  else if (btn.dataset.edit) {
    draft = JSON.parse(JSON.stringify(data.templates.find(t => t.id === btn.dataset.edit))); // edit a copy
    renderWorkouts();
  }
  else if (btn.dataset.delete) {
    const t = data.templates.find(t => t.id === btn.dataset.delete);
    if (confirm('Delete template "' + t.name + '"? Your logged workouts are not affected.')) {
      data.templates = data.templates.filter(x => x.id !== t.id);
      saveData();
      renderWorkouts();
    }
  }
  // --- editor buttons ---
  else if (btn.id === "tpl-cancel") { draft = null; renderWorkouts(); }
  else if (btn.dataset.minus) { const ex = draft.exercises[btn.dataset.minus]; ex.sets = Math.max(1, ex.sets - 1); renderWorkouts(); }
  else if (btn.dataset.plus) { const ex = draft.exercises[btn.dataset.plus]; ex.sets = Math.min(10, ex.sets + 1); renderWorkouts(); }
  else if (btn.dataset.remove) {
    const [gone] = draft.exercises.splice(Number(btn.dataset.remove), 1);
    if (gone.superset && draft.exercises.filter(x => x.superset === gone.superset).length < 2) {
      draft.exercises.forEach(x => { if (x.superset === gone.superset) x.superset = null; }); // partner is alone now
    }
    renderWorkouts();
  }
  else if (btn.id === "tpl-add") {
    openPicker({
      mode: "add",
      onDone: items => {
        items.forEach(it => draft.exercises.push({ name: it.name, muscle: it.muscle, equipment: it.equipment, sets: 3, superset: it.superset }));
        showScreen("workouts");
      },
      onCancel: () => showScreen("workouts"),
    });
  }
  else if (btn.id === "tpl-save") {
    if (!draft.name.trim()) return toast("Give the template a name first.");
    if (draft.exercises.length === 0) return toast("Add at least one exercise.");
    draft.name = draft.name.trim();
    const i = data.templates.findIndex(t => t.id === draft.id);
    if (i >= 0) data.templates[i] = draft; else data.templates.push(draft);
    saveData();
    draft = null;
    toast("Template saved");
    renderWorkouts();
  }
});

screenWorkouts.addEventListener("input", e => {
  if (e.target.id === "tpl-name") draft.name = e.target.value;
});
