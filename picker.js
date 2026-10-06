// picker.js — the "Select exercise" list: search, filters, checkboxes, Super Set, custom exercises
//
// Open it with openPicker({ mode, onDone, onCancel }).
//   mode "add"  : pick several exercises (can link two as a Super Set)
//   mode "swap" : pick just one
// onDone(items) gets a list like [{ name, muscle, equipment, superset }]

const screenPicker = document.getElementById("screen-picker");
let pick = null; // what's going on in the picker right now

function openPicker(options) {
  pick = {
    mode: options.mode || "add",
    onDone: options.onDone,
    onCancel: options.onCancel,
    selected: [],    // names, in the order you ticked them
    links: {},       // name -> Super Set group id (two names share one id)
    search: "",
    showSearch: false,
    muscle: "All",
    equipment: "All",
    panel: "",       // which panel is open under the buttons: "muscle", "equipment" or "custom"
    message: "",
  };
  showScreen("picker");
}

// The page frame is drawn once. The list and panel below it are redrawn on every change,
// so the search box keeps its keyboard focus while you type.
function renderPicker() {
  if (!pick) return showScreen("workouts");
  const swap = pick.mode === "swap";
  screenPicker.innerHTML = `
    <div class="topbar">
      <button id="pk-cancel" aria-label="Back">‹</button>
      <h1>Select exercise</h1>
      <button id="pk-search" aria-label="Search">🔍</button>
    </div>
    <input id="pk-q" type="search" placeholder="Search exercises" value="${esc(pick.search)}" ${pick.showSearch ? "" : "hidden"}>
    <div class="row">
      <button id="pk-muscle">Muscle groups</button>
      <button id="pk-equip">Equipment</button>
    </div>
    <div id="pk-panel"></div>
    <div class="row" style="margin-top:10px">
      ${swap ? "" : '<button id="pk-ss">Super Set</button>'}
      <button id="pk-custom">+ Custom exercise</button>
    </div>
    <p id="pk-msg" class="muted"></p>
    <div id="pk-list"></div>
    <div class="sticky-bar"><button class="big primary" id="pk-done"></button></div>`;
  drawPicker();
}

function chips(options, current, attr) {
  return `<div class="chips">` + ["All"].concat(options)
    .map(o => `<button ${attr}="${esc(o)}" class="${o === current ? "on" : ""}">${esc(o)}</button>`).join("") + `</div>`;
}

function drawPicker() {
  // Filter buttons show what's active
  const muscleBtn = document.getElementById("pk-muscle");
  const equipBtn = document.getElementById("pk-equip");
  muscleBtn.textContent = "Muscle groups" + (pick.muscle === "All" ? "" : ": " + pick.muscle);
  equipBtn.textContent = "Equipment" + (pick.equipment === "All" ? "" : ": " + pick.equipment);
  muscleBtn.classList.toggle("on", pick.muscle !== "All");
  equipBtn.classList.toggle("on", pick.equipment !== "All");

  // Panel under the buttons
  const panel = document.getElementById("pk-panel");
  if (pick.panel === "muscle") panel.innerHTML = chips(MUSCLES, pick.muscle, "data-muscle");
  else if (pick.panel === "equipment") panel.innerHTML = chips(EQUIPMENT, pick.equipment, "data-equipment");
  else if (pick.panel === "custom") {
    panel.innerHTML = `<div class="card stack">
      <input id="cx-name" type="text" placeholder="Exercise name" maxlength="40">
      <select id="cx-muscle">${MUSCLES.map(m => `<option>${m}</option>`).join("")}</select>
      <select id="cx-equip">${EQUIPMENT.map(m => `<option>${m}</option>`).join("")}</select>
      <button class="big primary" id="cx-save">Save exercise</button></div>`;
  } else panel.innerHTML = "";

  document.getElementById("pk-msg").textContent = pick.message;

  // The list
  const q = pick.search.trim().toLowerCase();
  const rows = allExercises().filter(ex =>
    (pick.muscle === "All" || ex.muscle === pick.muscle) &&
    (pick.equipment === "All" || ex.equipment === pick.equipment) &&
    (!q || (ex.name + " " + ex.muscle).toLowerCase().includes(q)));

  document.getElementById("pk-list").innerHTML = rows.map(ex => `
    <label class="pick-row">
      <input type="checkbox" data-name="${esc(ex.name)}" ${pick.selected.includes(ex.name) ? "checked" : ""}>
      <div><b>${esc(ex.name)}</b>${pick.links[ex.name] ? '<span class="tag ss">SUPER SET</span>' : ""}
        <div class="muted">${esc(ex.muscle)} · ${esc(ex.equipment)}</div></div>
    </label>`).join("") || `<p class="muted">No exercises match.</p>`;

  const done = document.getElementById("pk-done");
  const n = pick.selected.length;
  done.disabled = n === 0;
  done.textContent = pick.mode === "swap" ? "Swap exercise" : n === 1 ? "Add 1 exercise" : "Add " + n + " exercises";
}

function unlinkName(name) {
  const group = pick.links[name];
  if (!group) return;
  Object.keys(pick.links).forEach(n => { if (pick.links[n] === group) delete pick.links[n]; });
}

function toggleSuperSet() {
  if (pick.selected.length !== 2) {
    pick.message = "Tick exactly 2 exercises, then tap Super Set.";
  } else {
    const [a, b] = pick.selected;
    if (pick.links[a] && pick.links[a] === pick.links[b]) {
      unlinkName(a);
      pick.message = "Super Set removed.";
    } else {
      unlinkName(a); unlinkName(b);
      pick.links[a] = pick.links[b] = uid();
      pick.message = a + " + " + b + " linked as a Super Set.";
    }
  }
  drawPicker();
}

function finishPicker() {
  // Put linked exercises next to each other, in the order they were ticked
  const order = [];
  pick.selected.forEach(name => {
    if (order.includes(name)) return;
    order.push(name);
    const group = pick.links[name];
    if (group) pick.selected.forEach(other => {
      if (!order.includes(other) && pick.links[other] === group) order.push(other);
    });
  });
  const all = allExercises();
  const items = order.map(name => Object.assign({}, all.find(ex => ex.name === name), { superset: pick.links[name] || null }));
  const callback = pick.onDone;
  pick = null;
  callback(items);
}

function saveCustomExercise() {
  const name = document.getElementById("cx-name").value.trim();
  if (!name) { pick.message = "Type a name for the exercise."; return drawPicker(); }
  if (allExercises().some(ex => ex.name.toLowerCase() === name.toLowerCase())) {
    pick.message = "That exercise is already in the list.";
    return drawPicker();
  }
  data.customExercises.push({
    name: name,
    muscle: document.getElementById("cx-muscle").value,
    equipment: document.getElementById("cx-equip").value,
  });
  saveData();
  pick.selected = pick.mode === "swap" ? [name] : pick.selected.concat(name);
  pick.panel = "";
  pick.message = "Added " + name + " and ticked it.";
  drawPicker();
}

screenPicker.addEventListener("click", e => {
  if (!pick) return;
  const id = e.target.id;
  if (id === "pk-cancel") { const cb = pick.onCancel; pick = null; cb(); }
  else if (id === "pk-search") {
    pick.showSearch = !pick.showSearch;
    document.getElementById("pk-q").hidden = !pick.showSearch;
    if (pick.showSearch) document.getElementById("pk-q").focus();
  }
  else if (id === "pk-muscle") { pick.panel = pick.panel === "muscle" ? "" : "muscle"; drawPicker(); }
  else if (id === "pk-equip") { pick.panel = pick.panel === "equipment" ? "" : "equipment"; drawPicker(); }
  else if (id === "pk-custom") { pick.panel = pick.panel === "custom" ? "" : "custom"; drawPicker(); }
  else if (id === "pk-ss") toggleSuperSet();
  else if (id === "pk-done") finishPicker();
  else if (id === "cx-save") saveCustomExercise();
  else if (e.target.dataset.muscle) { pick.muscle = e.target.dataset.muscle; pick.panel = ""; drawPicker(); }
  else if (e.target.dataset.equipment) { pick.equipment = e.target.dataset.equipment; pick.panel = ""; drawPicker(); }
});

screenPicker.addEventListener("input", e => {
  if (e.target.id === "pk-q" && pick) { pick.search = e.target.value; drawPicker(); }
});

// Ticking a checkbox
screenPicker.addEventListener("change", e => {
  if (!pick || !e.target.dataset.name) return;
  const name = e.target.dataset.name;
  pick.message = "";
  if (e.target.checked) {
    pick.selected = pick.mode === "swap" ? [name] : pick.selected.concat(name);
  } else {
    pick.selected = pick.selected.filter(n => n !== name);
    unlinkName(name); // un-ticking one half of a Super Set breaks the link
  }
  drawPicker();
});
