// storage.js — everything is saved in the browser's localStorage as one JSON object:
//
// data = {
//   workouts: { "2026-10-06": { day: "Push", exercises: [ { name, sets: [ {weight, reps, done} ] } ] } },
//   cardio:   [ { id, date, type, minutes, notes } ],
//   restSeconds: 90,
//   sessions: [ { id, date, name, startedAt, minutes, exercises: [ { name, muscle, sets: [ {weight, reps, done, failure} ] } ] } ],
//   active: null or { name, startedAt, exercises: [...] },
//   templates: [ { id, name, days: [1, 5], exercises: [ { name, muscle, equipment, sets, minReps, maxReps, superset } ] } ],
//              ^ these are your "presets". Old templates without days/minReps/maxReps still work.
//   presetsSeeded: true once the starter presets have been offered (so deleting them keeps them deleted)
//   customExercises: [ { name, muscle, equipment } ], customRest: 30
// }

const STORAGE_KEY = "workout-tracker-data";

function loadData() {
  // New keys (sessions, active, ...) are optional: old saved data simply gets these
  // defaults, so earlier logs load unchanged and no migration is needed.
  const empty = {
    workouts: {}, cardio: [], restSeconds: 90,
    sessions: [],          // finished workouts from the "+" flow
    active: null,          // the workout in progress (so closing the tab loses nothing)
    templates: [],         // saved presets
    presetsSeeded: false,  // starter presets are added only once
    customExercises: [],   // exercises you added yourself
    customRest: 30,        // rest timer (seconds) for the "+" flow
  };
  try {
    return Object.assign(empty, JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch (e) {
    return empty; // nothing saved yet, or the saved text was broken
  }
}

const data = loadData();

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Dates are stored as "YYYY-MM-DD" in local time, so they sort correctly as text
function dateKey(d) {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + month + "-" + day;
}

function todayKey() {
  return dateKey(new Date());
}

function prettyDate(key) {
  return new Date(key + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// Escape text before putting it into HTML (protects against odd characters in notes)
function esc(text) {
  return String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Seconds -> "00:30" (or "1:05:00" once it passes an hour)
function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), r = sec % 60;
  const mm = String(m).padStart(2, "0"), ss = String(r).padStart(2, "0");
  return h ? h + ":" + mm + ":" + ss : mm + ":" + ss;
}

// Every workout in one list, oldest first: the old Push/Pull/Legs logs (data.workouts)
// plus workouts finished with the "+" flow (data.sessions).
// Each item: { id, date, name, exercises, startedAt?, minutes? }
function allWorkouts() {
  const list = Object.keys(data.workouts).map(d =>
    ({ id: d, date: d, name: data.workouts[d].day, exercises: data.workouts[d].exercises }));
  data.sessions.forEach(s => list.push(s));
  return list.sort((a, b) => a.date.localeCompare(b.date) || (a.startedAt || 0) - (b.startedAt || 0));
}
