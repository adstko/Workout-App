// storage.js — everything is saved in the browser's localStorage as one JSON object:
//
// data = {
//   workouts: { "2026-10-06": { day: "Push", exercises: [ { name, sets: [ {weight, reps, done} ] } ] } },
//   cardio:   [ { id, date, type, minutes, notes } ],
//   restSeconds: 90
// }

const STORAGE_KEY = "workout-tracker-data";

function loadData() {
  const empty = { workouts: {}, cardio: [], restSeconds: 90 };
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
