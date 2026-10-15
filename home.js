// home.js — the "Quick Home" presets (dumbbells + bodyweight), the "Short on time?" card, and the Home day.
// They are normal presets (edit, duplicate or delete them). They are added once, like the Recomp presets.
//
// Exercise rows: [name, sets, min reps, max reps, { seconds, failureLast, note }]

const HOME_PRESETS = [
  { name: "Home A: Push + Legs", short: "Home A", kind: "strength", about: 25, rest: 45, home: true,
    exercises: [
      ["Goblet squat", 3, 10, 12], ["Push-ups", 3, 8, 15, { failureLast: true }], ["Shoulder press", 3, 10, 10, { note: "Dumbbells." }],
      ["Lunges", 2, 10, 10, { note: "10 each leg." }], ["Plank", 2, null, null, { seconds: 40 }] ] },
  { name: "Home B: Pull + Legs", short: "Home B", kind: "strength", about: 25, rest: 45, home: true,
    exercises: [
      ["Dumbbell Romanian deadlift", 3, 10, 12], ["Dumbbell row", 3, 10, 10, { note: "10 each side." }], ["Curls", 3, 12, 12, { note: "Dumbbell curl." }],
      ["Glute bridge", 3, 12, 12, { note: "Or do hip thrusts: tap the three dots, then Swap exercise." }], ["Dead bug", 2, 10, 10] ] },
  { name: "Home 10-Minute Express", short: "Express", kind: "circuit", about: 10, home: true, cardioType: "Circuit",
    plan: { rounds: 1, restSeconds: 30, repeat: true },
    steps: ["Goblet squat × 12", "Push-ups × 10", "Dumbbell row × 10 each side", "Lunges × 8 each leg", "Plank × 30 sec", "No rest between exercises"] },
];

// The home versions used by the Week planner (Gym <-> Home). Dumbbells and bodyweight only.
const HOME_WEEK_PRESETS = [
  { name: "Home Full Body A", short: "HomeFB A", kind: "strength", about: 40, rest: 45, home: true,
    finisher: { text: "10 min easy walk", type: "Walk", minutes: 10 },
    exercises: [
      ["Goblet squat", 4, 8, 10], ["Push-ups", 4, 8, 15], ["Dumbbell row", 3, 8, 10, { note: "Each side." }],
      ["Dumbbell Romanian deadlift", 3, 8, 10], ["Shoulder press", 3, 8, 10, { note: "Dumbbells." }], ["Plank", 3, null, null, { seconds: 40 }] ] },
  { name: "Home Full Body B", short: "HomeFB B", kind: "strength", about: 40, rest: 45, home: true,
    finisher: { text: "10 min easy walk", type: "Walk", minutes: 10 },
    exercises: [
      ["Bulgarian split squat", 3, 8, 10, { note: "Each leg." }], ["Dumbbell bench press", 3, 8, 10, { note: "On the floor or a bench." }],
      ["Dumbbell row", 4, 8, 12, { note: "Each side." }], ["Dumbbell hip thrust", 3, 8, 10], ["Lateral raises", 3, 12, 15, { failureLast: true }], ["Dead bug", 3, 10, 10] ] },
  { name: "Home Intervals", short: "HomeInt", kind: "intervals", about: 25, home: true, cardioType: "Intervals (8 x 30s hard / 90s easy)",
    plan: { warmup: 300, rounds: 8, hard: 30, easy: 90, cooldown: 300 },
    steps: ["5 min easy warm-up (march in place or walk)", "8 rounds: 30 sec hard (fast stairs, high knees or jumping jacks), then 90 sec easy walking", "5 min easy cool-down"] },
  { name: "Easy Walk + Core", short: "Walk", kind: "cardio", about: 35, home: true, cardioType: "Walk",
    plan: { minutes: 25, core: ["Plank", "Side plank", "Dead bug"], coreSets: 3 },
    steps: ["25 min easy walk where you can still talk", "Plank, side plank and dead bug: 3 sets each"] },
];

function addHomeWeekPresets() {
  const added = [];
  HOME_WEEK_PRESETS.forEach(def => {
    if (data.templates.some(t => t.name === def.name)) return;
    data.templates.push(homeTemplate(def));
    added.push(def.name);
  });
  if (added.length) saveData();
  return added;
}

// Once per phone, like the others
function offerHomeWeekPresets() {
  if (data.homeWeekOffered) return;
  addHomeWeekPresets();
  data.homeWeekOffered = true;
  saveData();
}

function homeTemplate(def) {
  const t = recompTemplate(def); // same shape as the Recomp presets
  t.home = true;
  if (def.rest) t.rest = def.rest;
  return t;
}

function addHomePresets() {
  const added = [];
  HOME_PRESETS.forEach(def => {
    if (data.templates.some(t => t.name === def.name)) return;
    data.templates.push(homeTemplate(def));
    added.push(def.name);
  });
  if (added.length) saveData();
  return added;
}

// First launch of this version: add them once. After that, deleting one keeps it deleted.
function offerHomePresets() {
  if (data.homeOffered) return;
  addHomePresets();
  data.homeOffered = true;
  saveData();
}

const homePresets = () => data.templates.filter(t => t.home);
const homeByShort = short => data.templates.find(t => t.home && t.short === short);

// Last time you did a preset (date text), looking at finished workouts and cardio entries
function lastDoneOf(preset) {
  const dates = allWorkouts().filter(w => w.name === preset.name || w.presetId === preset.id).map(w => w.date)
    .concat(data.cardio.filter(c => c.presetId === preset.id).map(c => c.date));
  return dates.sort().pop() || "";
}

// Home A and Home B take turns: offer the one you did least recently
function nextHomeWorkout() {
  const a = homeByShort("Home A"), b = homeByShort("Home B");
  if (a && b) return lastDoneOf(a) <= lastDoneOf(b) ? a : b;
  return a || b || null;
}

// The gym workout for the day: what's scheduled, otherwise the least recently done Push / Pull / Legs
function gymWorkoutFor(date) {
  const scheduled = scheduleFor(date).preset;
  if (scheduled && !scheduled.home) return scheduled;
  const names = ["Push", "Pull", "Legs"].map(n => data.templates.find(t => t.name === n)).filter(Boolean);
  return names.sort((x, y) => lastDoneOf(x).localeCompare(lastDoneOf(y)))[0] || null;
}

// The card on Today
function shortOnTimeHtml() {
  if (viewDate() !== todayKey()) return "";
  return `<div class="card"><b>Short on time?</b>
    <div class="row" style="margin-top:10px">
      <button data-quick="express">10 min</button><button data-quick="home">25 min home</button><button data-quick="gym">Gym</button></div></div>`;
}

function quickStart(kind) {
  const p = kind === "express" ? homeByShort("Express") : kind === "home" ? nextHomeWorkout() : gymWorkoutFor(todayKey());
  if (!p) return toast(kind === "gym" ? "No gym preset yet. Add one in Workouts." : "That Home preset was deleted. Add it back in Workouts.");
  startPreset(p.id);
}

screenToday.addEventListener("click", e => {
  const q = e.target.closest("[data-quick]");
  if (q) quickStart(q.dataset.quick);
});

// ---------- Quick walk (on the Cardio screen) ----------
function quickWalkHtml() {
  return `<div class="card"><b>Quick walk</b>
    <div class="row" style="margin-top:10px"><button data-walk="10" data-note="After dinner">10 min after-dinner walk</button><button data-walk="20">20 min walk</button></div>
    <div class="two" style="margin-top:10px"><input type="number" id="walk-min" inputmode="numeric" min="1" max="300" placeholder="minutes" aria-label="Walk minutes">
      <button id="walk-log">Log walk</button></div></div>`;
}

function logWalk(minutes, note) {
  minutes = Math.round(Number(minutes));
  if (!(minutes >= 1 && minutes <= 300)) return toast("Type how many minutes you walked.");
  data.cardio.push({ id: String(Date.now()), date: todayKey(), type: "Walk", minutes: minutes, miles: null, floors: null, climb: null, effort: null, notes: note || "" });
  saveData();
  queueOnlineSync();
  toast("Logged a " + minutes + " min walk.");
  renderCardio();
}

screenCardio.addEventListener("click", e => {
  const w = e.target.closest("[data-walk]");
  if (w) return logWalk(w.dataset.walk, w.dataset.note);
  if (e.target.id === "walk-log") logWalk(document.getElementById("walk-min").value, "");
});
