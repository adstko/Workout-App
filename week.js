// week.js — the Week planner: pick the workout for each day, flip a day between Gym and Home, swap days,
// save a week with a name. It edits the same schedule the Today screen and the Workouts tab already use
// (presets' days + cardioDays), so everything stays in step.
//
// Extra saved data (all optional, so old data needs no migration):
//   data.weekMode   { weekday: { mode: "home", gym: presetId } }  days flipped to Home, and the gym workout to come back to
//   data.dateMode   { "YYYY-MM-DD": "gym" | "home" }               one-day flips from the Today screen
//   data.savedWeeks [ { id, name, days: [ 7 x { kind, id, mode, gym } ] } ]   (index 0 = Sunday)
//   preset.homeId / preset.gymId  link a preset to its home / gym version; preset.home = true marks a home workout

const screenWeek = document.getElementById("screen-week");

// Gym preset name -> home preset name. Add more pairs here. (You can also link two presets when you edit a preset.)
const GYM_HOME_PAIRS = [
  ["Recomp Full Body A", "Home Full Body A"],
  ["Recomp Full Body B", "Home Full Body B"],
  ["Intervals", "Home Intervals"],
  ["Conditioning Circuit", "Conditioning Circuit"], // works at either place: stays the same
  ["Easy Cardio + Core", "Easy Walk + Core"],
  ["Push", "Home A: Push + Legs"],
  ["Pull", "Home B: Pull + Legs"],
  ["Legs", "Home A: Push + Legs"],
];

const presetById = id => data.templates.find(t => t.id === id);
const presetByName = name => data.templates.find(t => t.name === name);

// The home (or gym) version of a preset, or null if there isn't one. A link you set when editing a preset wins over the table.
function counterpart(p, mode) {
  if (!p) return null;
  if (mode === "home") {
    if (p.home) return p;
    const linked = p.homeId && presetById(p.homeId);
    if (linked) return linked;
    const pair = GYM_HOME_PAIRS.find(x => x[0] === p.name);
    return pair ? presetByName(pair[1]) || null : null;
  }
  if (!p.home) return p;
  const linked = p.gymId && presetById(p.gymId);
  if (linked) return linked;
  const pair = GYM_HOME_PAIRS.find(x => x[1] === p.name && x[0] !== x[1]);
  return pair ? presetByName(pair[0]) || null : null;
}

// ---------- Gym or Home for a weekday / a date ----------
function weekdayMode(n) { // "gym", "home" or null (rest / cardio-only day)
  const p = presetForDay(n);
  if (!p) return null;
  const wm = (data.weekMode || {})[n];
  return p.home || (wm && wm.mode === "home") ? "home" : "gym";
}

function modeFor(key) {
  const p = scheduleFor(key).preset;
  if (!p) return null;
  const dm = (data.dateMode || {})[key];
  if (dm && key in (data.dayOverrides || {})) return dm;
  if (key in (data.dayOverrides || {})) return p.home ? "home" : "gym";
  return weekdayMode(new Date(key + "T00:00:00").getDay());
}

// The tag saved on a logged workout: Gym or Home
function modeForPreset(p) {
  if (p && p.home) return "home";
  const today = scheduleFor(todayKey());
  return p && today.preset === p && modeFor(todayKey()) === "home" ? "home" : "gym";
}

// Old logs have no tag: a workout from a Home preset is Home, everything else is Gym
function workoutMode(w) {
  return w.mode || (/^Home /.test(w.name || "") ? "home" : "gym");
}

// ---------- Reading and changing the plan ----------
function dayAssign(n) {
  const p = presetForDay(n);
  if (p) { const wm = (data.weekMode || {})[n]; return { kind: "preset", id: p.id, mode: weekdayMode(n), gym: wm ? wm.gym : null }; }
  return { kind: data.cardioDays.includes(n) ? "cardio" : "rest" };
}

function applyAssign(n, a) {
  setDaySchedule(n, a.kind === "preset" && presetById(a.id) ? a.id : a.kind === "cardio" ? "cardio" : "");
  if (a.kind === "preset" && a.mode === "home" && presetById(a.id)) {
    data.weekMode = data.weekMode || {};
    data.weekMode[n] = { mode: "home", gym: a.gym || null };
    saveData();
  }
}

// Flip one weekday to "home" or "gym". Returns false if there is no version to switch to.
function flipDay(n, to) {
  const p = presetForDay(n);
  if (!p || weekdayMode(n) === to) return !!p;
  const wm = (data.weekMode || {})[n];
  const target = to === "home" ? counterpart(p, "home") : (wm && wm.gym && presetById(wm.gym)) || counterpart(p, "gym");
  if (!target) return false;
  const gymId = to === "home" ? (p.home ? (wm && wm.gym) || null : p.id) : null;
  setDaySchedule(n, target.id); // (this also clears the old Home note for the day)
  if (to === "home") { data.weekMode = data.weekMode || {}; data.weekMode[n] = { mode: "home", gym: gymId }; saveData(); }
  return true;
}

function swapDays(a, b) {
  const x = dayAssign(a), y = dayAssign(b);
  applyAssign(a, y);
  applyAssign(b, x);
}

function planCounts() {
  const c = { gym: 0, home: 0, cardio: 0, rest: 0 };
  WEEK.forEach(([, n]) => { const a = dayAssign(n); if (a.kind === "preset") c[a.mode]++; else c[a.kind]++; });
  return c;
}

// ---------- Saved weeks ----------
function saveWeek(name) {
  data.savedWeeks = data.savedWeeks || [];
  const entry = { id: uid(), name: name, days: [0, 1, 2, 3, 4, 5, 6].map(dayAssign) };
  const i = data.savedWeeks.findIndex(w => w.name.toLowerCase() === name.toLowerCase());
  if (i >= 0) data.savedWeeks[i] = entry; else data.savedWeeks.push(entry);
  saveData();
}

function loadWeek(id) {
  const w = (data.savedWeeks || []).find(x => x.id === id);
  if (!w) return;
  let missing = 0;
  w.days.forEach((a, n) => { if (a.kind === "preset" && !presetById(a.id)) missing++; applyAssign(n, a); });
  toast(missing ? "Loaded " + w.name + ". " + missing + " deleted preset" + (missing === 1 ? " is" : "s are") + " now a rest day." : "Loaded " + w.name + ".");
}

// ---------- The screen ----------
let weekUi = { pick: null, swap: null }; // which day's list is open / which day is waiting to be swapped
function openWeek() { weekUi = { pick: null, swap: null }; showScreen("week"); }

function dayCardHtml(label, n) {
  const a = dayAssign(n), p = a.kind === "preset" ? presetById(a.id) : null;
  const mode = p ? a.mode : null;
  const tag = p ? (mode === "home" ? "Home" : "Gym") : a.kind === "cardio" ? "Cardio" : "Rest";
  const name = p ? p.name : a.kind === "cardio" ? "Cardio only" : "Rest day";
  const waiting = weekUi.swap !== null;
  const swapBtn = weekUi.swap === n ? `<button data-wk-swap="${n}" class="on">Cancel swap</button>`
    : waiting ? `<button data-wk-swap="${n}" class="primary">Swap here</button>` : `<button data-wk-swap="${n}">Swap days</button>`;
  let html = `<div class="card daycard ${weekUi.swap === n ? "picked" : ""}" data-daycard="${n}">
    <div class="entry"><div><b>${label}</b> <span class="tag day ${mode === "home" ? "ok" : ""}">${tag}</span></div></div>
    <h3>${esc(name)}</h3>${p ? `<p class="muted">${esc(presetSummary(p))}</p>` : ""}
    <div class="row seg" style="margin-top:10px">
      <button data-wk-mode="${n}:gym" class="${mode === "gym" ? "on" : ""}" ${p ? "" : "disabled"}>Gym</button>
      <button data-wk-mode="${n}:home" class="${mode === "home" ? "on" : ""}" ${p ? "" : "disabled"}>Home</button></div>
    <div class="row" style="margin-top:8px"><button data-wk-change="${n}">${weekUi.pick === n ? "Close" : "Change"}</button>${swapBtn}</div>`;
  if (weekUi.pick === n) {
    const opt = (value, text, on) => `<button data-wk-set="${n}:${value}" class="${on ? "on" : ""}">${esc(text)}</button>`;
    html += `<div class="chips">${opt("", "Rest day", a.kind === "rest")}${opt("cardio", "Cardio only", a.kind === "cardio")}
      ${data.templates.map(t => opt(t.id, t.name, p && p.id === t.id)).join("")}</div>`;
  }
  return html + `</div>`;
}

function renderWeekPlan() {
  const c = planCounts();
  const parts = [c.gym + " gym", c.home + " home"]; if (c.cardio) parts.push(c.cardio + " cardio"); parts.push(c.rest + " rest");
  let html = `<div class="topbar"><button id="wk-back" aria-label="Back">‹</button><h1>Week</h1></div>
    <div class="card"><b>This week</b><div class="muted">${parts.join(" · ")} days</div></div>
    ${weekUi.swap !== null ? `<p class="muted">Tap "Swap here" on the day to swap with.</p>` : ""}`;
  WEEK.forEach(([label, n]) => { html += dayCardHtml(label, n); });
  const saved = data.savedWeeks || [];
  html += `<h2>Saved weeks</h2>
    <div class="stack"><button class="big" id="wk-save">Save this week as…</button>
      <button class="big" id="wk-reset-recomp">Reset to Recomp Week</button></div>`;
  saved.forEach(w => {
    const tags = w.days.map(d => d.kind === "preset" ? (d.mode === "home" ? "H" : "G") : d.kind === "cardio" ? "C" : "–");
    html += `<div class="card"><b>${esc(w.name)}</b> <span class="muted">${WEEK.map(([l, n]) => l[0] + tags[n]).join(" ")}</span>
      <div class="row" style="margin-top:10px"><button data-wk-load="${w.id}" class="primary">Load</button><button data-wk-del="${w.id}" class="danger">Delete</button></div></div>`;
  });
  if (!saved.length) html += `<p class="muted">Nothing saved yet. Set up a week, then tap "Save this week as…" (for example School Week or Break Week).</p>`;
  html += `<p class="muted">Gym/Home swaps in the matching version of a workout. To link your own pair, open a preset in Workouts and pick its Home or Gym version.</p>`;
  screenWeek.innerHTML = html;
}

screenWeek.addEventListener("click", async e => {
  const t = e.target.closest("button");
  if (!t) return;
  const d = t.dataset;
  if (t.id === "wk-back") return showScreen("workouts");
  if (d.wkChange !== undefined) { weekUi.pick = weekUi.pick === Number(d.wkChange) ? null : Number(d.wkChange); return renderWeekPlan(); }
  if (d.wkSet !== undefined) {
    const [n, value] = d.wkSet.split(":");
    setDaySchedule(Number(n), value);
    weekUi.pick = null;
    return renderWeekPlan();
  }
  if (d.wkMode !== undefined) {
    const [n, to] = d.wkMode.split(":");
    if (!flipDay(Number(n), to)) toast("No " + to + " version of this one yet. Link one when you edit the preset.");
    return renderWeekPlan();
  }
  if (d.wkSwap !== undefined) {
    const n = Number(d.wkSwap);
    if (weekUi.swap === null) weekUi.swap = n;
    else if (weekUi.swap === n) weekUi.swap = null;
    else { swapDays(weekUi.swap, n); weekUi.swap = null; toast("Days swapped"); }
    return renderWeekPlan();
  }
  if (t.id === "wk-save") {
    const name = await askText("Name this week (for example School Week)", "");
    if (!name || !name.trim()) return;
    const clean = name.trim().slice(0, 30);
    if ((data.savedWeeks || []).some(w => w.name.toLowerCase() === clean.toLowerCase()) && !(await askConfirm('Replace the saved week "' + clean + '"?', "Replace"))) return;
    saveWeek(clean);
    toast("Saved " + clean);
    return renderWeekPlan();
  }
  if (d.wkLoad) {
    const w = data.savedWeeks.find(x => x.id === d.wkLoad);
    if (!(await askConfirm('Load "' + w.name + '"? It replaces your current week plan. Your presets and logs stay.', "Load"))) return;
    loadWeek(d.wkLoad);
    return renderWeekPlan();
  }
  if (d.wkDel) {
    const w = data.savedWeeks.find(x => x.id === d.wkDel);
    if (!(await askConfirm('Delete the saved week "' + w.name + '"?', "Delete"))) return;
    data.savedWeeks = data.savedWeeks.filter(x => x.id !== d.wkDel);
    saveData();
    return renderWeekPlan();
  }
  if (t.id === "wk-reset-recomp") {
    if (!(await askConfirm("Set the week to Recomp Week? It replaces your current week plan. Your presets and logs stay.", "Set it"))) return;
    applyRecompWeek();
    toast("Recomp Week is set.");
    renderWeekPlan();
  }
});

// ---------- Today: switch just today ----------
function switchDate(key, to) {
  const current = scheduleFor(key).preset;
  const weekly = presetForDay(new Date(key + "T00:00:00").getDay());
  const target = to === "home" ? counterpart(current, "home") : (weekly && !weekly.home ? weekly : null) || counterpart(current, "gym");
  if (!target) return toast("No " + to + " version of this one yet. Link one when you edit the preset.");
  setDateWorkout(key, target, to);
  toast("Switched to " + (to === "home" ? "Home" : "Gym") + " for this day only");
}

// Use one preset for one date (nothing else changes)
function setDateWorkout(key, preset, mode) {
  data.dayOverrides = data.dayOverrides || {};
  data.dateMode = data.dateMode || {};
  data.dayOverrides[key] = preset.id;
  data.dateMode[key] = mode;
  const w = data.workouts[key];
  if (w && !w.exercises.some(ex => ex.sets.some(s => s.done))) delete data.workouts[key]; // redrawn from the new preset
  saveData();
  renderToday();
}

function todaySwitchHtml() {
  const key = viewDate();
  if (key < todayKey()) return "";
  const p = scheduleFor(key).preset, mode = modeFor(key), express = homeByShort("Express");
  const to = mode === "home" ? "gym" : "home";
  return `<div class="row" style="margin-top:-6px;margin-bottom:12px">
    ${p ? `<button data-switch="${to}">Switch to ${to === "home" ? "Home" : "Gym"}</button>` : ""}
    ${express && !(p && p.id === express.id) ? `<button data-switch-express="1">Short on time? Use 10-min Express</button>` : ""}</div>`;
}

screenToday.addEventListener("click", e => {
  const s = e.target.closest("[data-switch]");
  if (s) return switchDate(viewDate(), s.dataset.switch);
  if (e.target.closest("[data-switch-express]")) { const x = homeByShort("Express"); if (x) { setDateWorkout(viewDate(), x, "home"); toast("Today is the 10-min Express"); } return; }
  if (e.target.closest("[data-open-week]")) openWeek();
});
