// recomp.js — the Recomp presets (build muscle while body weight stays about the same) and the Recomp Week schedule.
// The presets are normal presets, so you can edit, duplicate or delete them. They are added once.
//
// Exercise rows: [name, sets, min reps, max reps, { seconds, failureLast, note }]. Every lifting set stays in the 6-15 rep range.

const RECOMP_PRESETS = [
  { name: "Recomp Full Body A", short: "Full A", kind: "strength", about: 55,
    finisher: { text: "10 min easy incline walk", type: "Incline walk", minutes: 10 },
    exercises: [
      ["Squat", 4, 6, 8], ["Bench press", 4, 6, 8], ["Seated cable row", 3, 8, 10],
      ["Romanian deadlift", 3, 8, 10], ["Shoulder press", 3, 8, 10], ["Plank", 3, null, null, { seconds: 40 }] ] },
  { name: "Recomp Full Body B", short: "Full B", kind: "strength", about: 55,
    finisher: { text: "10 min easy incline walk", type: "Incline walk", minutes: 10 },
    exercises: [
      ["Leg press", 4, 8, 10], ["Incline dumbbell press", 3, 8, 10],
      ["Lat pulldown", 4, 6, 10, { note: "Or do pull-ups: tap the three dots, then Swap exercise." }],
      ["Hip thrust", 3, 8, 10], ["Lateral raises", 3, 12, 15, { failureLast: true }], ["Hanging leg raises", 3, 10, 10] ] },
  { name: "Conditioning Circuit", short: "Circuit", kind: "circuit", about: 30, cardioType: "Circuit",
    plan: { rounds: 4, restSeconds: 60 },
    steps: ["Goblet squats × 12", "Push-ups × 12", "Dumbbell rows × 10 each side", "Walking lunges × 10 each leg", "Plank × 30 sec", "Battle ropes or jumping jacks × 40 sec"] },
  { name: "Intervals", short: "Intvls", kind: "intervals", about: 25, cardioType: "Intervals (8 x 30s hard / 90s easy)",
    plan: { warmup: 300, rounds: 8, hard: 30, easy: 90, cooldown: 300 },
    steps: ["5 min easy warm-up", "8 rounds: 30 sec hard, then 90 sec easy (bike, treadmill or rower)", "5 min easy cool-down"] },
  { name: "Easy Cardio + Core", short: "Easy", kind: "cardio", about: 35, cardioType: "Incline walk",
    plan: { minutes: 25, core: ["Plank", "Side plank", "Dead bug"], coreSets: 3 },
    steps: ["25 min incline walk, bike or light jog where you can still talk", "Plank, side plank and dead bug: 3 sets each"] },
];

// Recomp Week: weekday number (0 = Sunday) -> preset name. Wednesday and Sunday are rest days.
const RECOMP_WEEK = { 1: "Recomp Full Body A", 2: "Intervals", 4: "Recomp Full Body B", 5: "Conditioning Circuit", 6: "Easy Cardio + Core" };

function recompTemplate(def) {
  const t = { id: uid(), name: def.name, short: def.short, kind: def.kind, about: def.about, days: [] };
  t.exercises = (def.exercises || []).map(([name, sets, minReps, maxReps, extra]) => {
    const info = EXERCISES.find(e => e.name === name);
    return Object.assign({ name: name, muscle: info.muscle, equipment: info.equipment, sets: sets, minReps: minReps, maxReps: maxReps, superset: null }, extra || {});
  });
  if (def.finisher) t.finisher = Object.assign({}, def.finisher);
  if (def.steps) t.steps = def.steps.slice();
  if (def.plan) t.plan = JSON.parse(JSON.stringify(def.plan));
  if (def.cardioType) t.cardioType = def.cardioType;
  return t;
}

// Add any Recomp presets you don't have yet. Returns the names that were added.
function addRecompPresets() {
  const added = [];
  RECOMP_PRESETS.forEach(def => {
    if (data.templates.some(t => t.name === def.name)) return;
    data.templates.push(recompTemplate(def));
    added.push(def.name);
  });
  if (added.length) saveData();
  return added;
}

// First launch of this version: add them once. After that, deleting one keeps it deleted.
function offerRecompPresets() {
  if (data.recompOffered) return;
  addRecompPresets();
  data.recompOffered = true;
  saveData();
}

// Fill the week: Mon Full Body A, Tue Intervals, Wed rest, Thu Full Body B, Fri Circuit, Sat Easy Cardio + Core, Sun rest
function applyRecompWeek() {
  addRecompPresets();
  [0, 1, 2, 3, 4, 5, 6].forEach(n => {
    const name = RECOMP_WEEK[n];
    const preset = name && data.templates.find(t => t.name === name);
    setDaySchedule(n, preset ? preset.id : ""); // no name = rest day
  });
}

// "Circuit · about 30 min · 4 rounds" or "6 exercises · Legs, Chest..."
function presetSummary(p) {
  const about = p.about ? " · about " + p.about + " min" : "";
  if (p.kind === "circuit") { const r = (p.plan && p.plan.rounds) || 4; return "Circuit" + about + " · " + r + (r === 1 ? " round" : " rounds"); }
  if (p.kind === "intervals") return "Intervals" + about;
  if (p.kind === "cardio") return "Cardio + core" + about;
  const muscles = presetMuscles(p).join(", ");
  return p.exercises.length + (p.exercises.length === 1 ? " exercise" : " exercises") + (muscles ? " · " + muscles : "") + about;
}
