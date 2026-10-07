// history.js — History screen: weight chart, past workouts, export

const screenHistory = document.getElementById("screen-history");
let openWorkoutId = null; // a workout to show expanded (set when you finish one)
let historyTab = "log";   // "log" (past workouts), "stats" or "friends"

// Only count workouts where at least one set was finished (old and new flow together)
function loggedWorkouts() {
  return allWorkouts().filter(w => w.exercises.some(ex => ex.sets.some(s => s.done)));
}

function renderHistory() {
  const titles = { log: "History", stats: "Stats", friends: "Friends" };
  const tabs = `<h1>${titles[historyTab]}</h1><div class="row" style="margin-bottom:12px">
      <button data-history-tab="log" class="${historyTab === "log" ? "on" : ""}">History</button>
      <button data-history-tab="stats" class="${historyTab === "stats" ? "on" : ""}">Stats</button>
      <button data-history-tab="friends" class="${historyTab === "friends" ? "on" : ""}">Friends</button></div>`;
  if (historyTab === "stats") {
    screenHistory.innerHTML = tabs + statsHtml();
    return;
  }
  if (historyTab === "friends") {
    screenHistory.innerHTML = tabs + friendsHtml();
    ensureFriendsLoaded();
    return;
  }

  const logged = loggedWorkouts();
  const names = [...new Set(logged.flatMap(w => w.exercises
    .filter(ex => ex.sets.some(s => s.done)).map(ex => ex.name)))].sort();

  let html = tabs + `<h2>Weight over time</h2>`;
  if (names.length === 0) {
    html += `<p class="muted">Finish a set on the Today tab and it will show up here.</p>`;
  } else {
    html += `<select id="chart-pick">${names.map(n => `<option>${esc(n)}</option>`).join("")}</select>
      <p></p><div id="chart"></div>`;
  }

  html += `<h2>Past workouts</h2>`;
  logged.slice().reverse().forEach(w => {
    const length = w.minutes ? " · " + w.minutes + " min" : "";
    html += `<details ${w.id === openWorkoutId ? "open" : ""}><summary>${prettyDate(w.date)} · ${esc(w.name)}${length}</summary>`;
    w.exercises.forEach(ex => {
      const done = ex.sets.filter(s => s.done);
      if (done.length === 0) return;
      const text = done.map(s => TIMED.includes(ex.name) ? s.reps + "s" : (s.weight ? s.weight + "lb" : "BW") + "×" + s.reps + (s.failure ? " (failure)" : "")).join(" · ");
      html += `<div><b>${esc(ex.name)}</b><br>${text}</div>`;
    });
    html += `<div class="row" style="margin-top:10px"><button data-health="${w.id}">Send to Apple Health</button>
      <button data-save-preset="${w.id}">Save as preset</button>
      ${signedIn() ? `<button data-share-workout="${esc(w.id)}">Share</button>` : ""}</div></details>`;
  });
  openWorkoutId = null;
  if (logged.length === 0) html += `<p class="muted">No workouts yet.</p>`;

  html += `<h2>Apple Health</h2>
    <div class="card">
      <p class="muted">Each workout above has a "Send to Apple Health" button, and so does each cardio entry. Weights are logged as ${WEIGHTS_HEALTH_TYPE}. Cardio is logged as the type you picked (Walking, Running, Cycling...). Golf is skipped because 18Birdies already logs it in Fitness.</p>
      <label for="health-name">Name of your Shortcut</label>
      <input id="health-name" type="text" maxlength="60" value="${esc(data.shortcutName)}">
      <details><summary>One-time setup (iPhone)</summary>
        <div>1. Open the <b>Shortcuts</b> app, tap <b>+</b> and name the shortcut exactly what is in the box above.<br>
        2. Add <b>Get Dictionary from Input</b>.<br>
        3. Add <b>Get Dictionary Value</b> three times, for the keys <b>type</b>, <b>minutes</b> and <b>start</b>.<br>
        4. Add <b>Log Workout</b>. Set its <b>Type</b> to the <i>type</i> value, its <b>Duration</b> to the <i>minutes</i> value (in minutes), and its <b>Start Date</b> to the <i>start</i> value if your iPhone offers that option. Cardio with miles also sends a <b>miles</b> value you can use for <b>Distance</b>.<br>
        5. Tap <b>Send to Apple Health</b> in this app. Allow Shortcuts to write to Health the first time.<br>
        If Type won't take a value, use <b>If</b> blocks instead, one per type, each with its own Log Workout.
        The button only works on an iPhone, and the page must be open in Safari from a normal web address.</div>
      </details>
    </div>
    <h2>Backup</h2>
    <div class="stack">
      <button class="big primary" id="export-btn">Export my data</button>
      <button class="big" id="import-btn">Import data</button>
    </div>
    <input type="file" id="import-file" accept=".json,application/json" hidden>
    <p class="muted">Export saves all your workouts, cardio and presets to a file. Import adds a backup file to what you have now. It never replaces or deletes your current logs.</p>`;

  screenHistory.innerHTML = html;
  if (names.length) drawChart(names[0]);
}

// Line chart of the heaviest completed set from each session
function drawChart(name) {
  const points = [];
  loggedWorkouts().forEach(w => {
    const ex = w.exercises.find(e => e.name === name);
    if (!ex) return;
    const weights = ex.sets.filter(s => s.done).map(s => Number(s.weight) || 0);
    if (weights.length) points.push({ date: w.date, weight: Math.max(...weights) });
  });

  const box = document.getElementById("chart");
  if (points.length < 2) {
    box.innerHTML = `<p class="muted">Log this exercise in at least 2 workouts to see a line.${
      points.length ? " So far: " + points[0].weight + " lb." : ""}</p>`;
    return;
  }

  const W = 320, H = 190, left = 40, right = 12, top = 14, bottom = 30;
  const values = points.map(p => p.weight);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min = Math.max(0, min - 5); max = max + 5; }

  const x = i => left + (W - left - right) * i / (points.length - 1);
  const y = w => top + (H - top - bottom) * (1 - (w - min) / (max - min));

  const line = points.map((p, i) => x(i) + "," + y(p.weight)).join(" ");
  const dots = points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.weight)}" r="4"/>`).join("");

  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight over time for ${esc(name)}">
    <text x="${left - 6}" y="${y(max) + 4}" text-anchor="end">${max}</text>
    <text x="${left - 6}" y="${y(min) + 4}" text-anchor="end">${min}</text>
    <polyline points="${line}"/>${dots}
    <text x="${left}" y="${H - 8}">${prettyDate(points[0].date)}</text>
    <text x="${W - right}" y="${H - 8}" text-anchor="end">${prettyDate(points[points.length - 1].date)}</text>
  </svg><p class="muted">Heaviest set per workout (lb)</p>`;
}

async function exportData() {
  const text = JSON.stringify(data, null, 2);
  const filename = "workout-data-" + todayKey() + ".json";

  // Some viewers block direct downloads. There, ask the viewer to save through the "downloads" capability.
  try {
    const downloads = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
    if (downloads) {
      await downloads.save({ filename: filename, data: text });
      toast("Export saved");
      return;
    }
  } catch (e) {
    if (e && e.code === "declined") return; // they said no
  }

  // Normal browsers: download the file directly
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

screenHistory.addEventListener("change", e => {
  if (e.target.id === "chart-pick") drawChart(e.target.value);
});

// Turn a finished workout into a preset (sets = the sets you did; weight is not saved)
async function savePresetFromWorkout(id) {
  const w = allWorkouts().find(x => x.id === id);
  const name = await askText("Preset name (for example: Push Day)", w.name);
  if (!name || !name.trim()) return;
  const info = allExercises();
  const items = w.exercises.filter(ex => ex.sets.some(s => s.done)).map(ex => {
    const known = info.find(i => i.name === ex.name) || {};
    return { name: ex.name, muscle: ex.muscle || known.muscle || "Other", equipment: ex.equipment || known.equipment || "Other",
      sets: ex.sets.filter(s => s.done).length, minReps: null, maxReps: null, superset: ex.superset || null };
  });
  newPreset(name.trim(), items);
  toast("Preset saved. Find it in Workouts.");
}

screenHistory.addEventListener("click", e => {
  const tab = e.target.closest("[data-history-tab]");
  if (tab) { historyTab = tab.dataset.historyTab; renderHistory(); return; }
  if (e.target.id === "export-btn") exportData();
  else if (e.target.dataset.savePreset) savePresetFromWorkout(e.target.dataset.savePreset);
  else if (e.target.dataset.health) sendWorkoutToHealth(e.target.dataset.health);
});

screenHistory.addEventListener("input", e => {
  if (e.target.id === "health-name") {
    data.shortcutName = e.target.value;
    saveData();
  }
});

// ---------- Import ----------
// Adds a backup file (made with "Export my data") to your current data. Nothing you already have is
// replaced or deleted. The merge runs on a copy first, so we can show what it found before changing anything.

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

// Ids end up inside HTML attributes, so only allow plain ones. Anything else gets a fresh id.
function cleanId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : uid();
}

function hasDoneSets(exercises) {
  return exercises.some(ex => ex.sets.some(s => s.done));
}

// A list of exercises with sets, or null if it doesn't look right
function cleanExercises(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const ex of list) {
    if (!ex || typeof ex.name !== "string" || !Array.isArray(ex.sets)) return null;
    out.push(Object.assign({}, ex, {
      name: ex.name.slice(0, 60),
      sets: ex.sets.filter(s => s && typeof s === "object").map(s => Object.assign({}, s, { done: !!s.done })),
    }));
  }
  return out;
}

// Merge the file's contents (inc) into target. Returns counts for the summary.
function mergeImport(inc, target) {
  const stats = { workouts: 0, cardio: 0, presets: 0, exercises: 0, same: 0, skipped: 0 };

  // Push/Pull/Legs screen logs, one per date
  const oldLogs = inc.workouts && typeof inc.workouts === "object" ? inc.workouts : {};
  Object.keys(oldLogs).forEach(date => {
    const exercises = DATE_KEY.test(date) && oldLogs[date] ? cleanExercises(oldLogs[date].exercises) : null;
    if (!exercises) return void stats.skipped++;
    if (!hasDoneSets(exercises)) return; // empty placeholder days are not worth importing
    const have = target.workouts[date];
    if (have && hasDoneSets(have.exercises)) return void stats.same++; // you already logged that day
    target.workouts[date] = { day: typeof oldLogs[date].day === "string" ? oldLogs[date].day.slice(0, 20) : "Rest", exercises: exercises };
    stats.workouts++;
  });

  // Workouts from the "+" flow
  (Array.isArray(inc.sessions) ? inc.sessions : []).forEach(s => {
    const exercises = s && DATE_KEY.test(s.date) ? cleanExercises(s.exercises) : null;
    if (!exercises) return void stats.skipped++;
    const id = cleanId(s.id);
    if (target.sessions.some(x => x.id === id)) return void stats.same++;
    target.sessions.push({ id: id, date: s.date, name: String(s.name || "Workout").slice(0, 40), startedAt: Number(s.startedAt) || 0,
      minutes: Number(s.minutes) || 0, exercises: exercises });
    stats.workouts++;
  });

  // Cardio
  (Array.isArray(inc.cardio) ? inc.cardio : []).forEach(c => {
    if (!c || !DATE_KEY.test(c.date) || !(Number(c.minutes) > 0)) return void stats.skipped++;
    const id = cleanId(c.id);
    if (target.cardio.some(x => x.id === id)) return void stats.same++;
    target.cardio.push({ id: id, date: c.date, type: String(c.type || "Other").slice(0, 60), minutes: Number(c.minutes),
      miles: Number(c.miles) > 0 ? Number(c.miles) : null, climb: Number(c.climb) > 0 ? Number(c.climb) : null, notes: String(c.notes || "").slice(0, 200) });
    stats.cardio++;
  });

  // Presets. Day tags already used by one of your presets are dropped so each day keeps one workout.
  (Array.isArray(inc.templates) ? inc.templates : []).forEach(t => {
    const exercises = t && typeof t.name === "string" && Array.isArray(t.exercises) && t.exercises.every(e => e && typeof e.name === "string") ? t.exercises : null;
    if (!exercises) return void stats.skipped++;
    const id = cleanId(t.id);
    // Same preset already here? (same id, or the same name with the same exercises, like the starter presets)
    const look = p => p.name.toLowerCase() + "|" + p.exercises.map(e => [e.name, e.sets, e.minReps || "", e.maxReps || ""].join(":")).join(",");
    if (target.templates.some(x => x.id === id || look(x) === look(t))) return void stats.same++;
    const sameName = target.templates.some(x => x.name.toLowerCase() === t.name.toLowerCase());
    const taken = day => target.templates.some(x => (x.days || []).includes(day)) || target.cardioDays.includes(day);
    target.templates.push({
      id: id, name: sameName ? t.name.slice(0, 29) + " (imported)" : t.name.slice(0, 40),
      days: (Array.isArray(t.days) ? t.days : []).filter(d => Number.isInteger(d) && d >= 0 && d <= 6 && !taken(d)),
      exercises: exercises.map(e => ({ name: String(e.name).slice(0, 60), muscle: String(e.muscle || "Other").slice(0, 30), equipment: String(e.equipment || "Other").slice(0, 30),
        sets: Math.min(10, Math.max(1, Number(e.sets) || 3)), minReps: Number(e.minReps) || null, maxReps: Number(e.maxReps) || null, superset: typeof e.superset === "string" ? e.superset.slice(0, 40) : null })),
    });
    stats.presets++;
  });

  // Your own exercises
  (Array.isArray(inc.customExercises) ? inc.customExercises : []).forEach(x => {
    if (!x || typeof x.name !== "string" || !x.name.trim()) return void stats.skipped++;
    if ([...EXERCISES, ...target.customExercises].some(e => e.name.toLowerCase() === x.name.trim().toLowerCase())) return;
    target.customExercises.push({ name: x.name.trim().slice(0, 40), muscle: String(x.muscle || "Other").slice(0, 30), equipment: String(x.equipment || "Other").slice(0, 30) });
    stats.exercises++;
  });
  if (inc.presetsSeeded) target.presetsSeeded = true; // don't re-add the starter presets after importing yours
  return stats;
}

function importSummary(s) {
  const parts = [];
  if (s.workouts) parts.push(s.workouts + (s.workouts === 1 ? " workout" : " workouts"));
  if (s.cardio) parts.push(s.cardio + " cardio " + (s.cardio === 1 ? "entry" : "entries"));
  if (s.presets) parts.push(s.presets + (s.presets === 1 ? " preset" : " presets"));
  if (s.exercises) parts.push(s.exercises + " custom " + (s.exercises === 1 ? "exercise" : "exercises"));
  return parts.join(", ");
}

async function importData(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return toast("That file is too big to be a backup.");
  let inc;
  try {
    inc = JSON.parse(await file.text());
  } catch (e) {
    return toast("That isn't a workout backup file.");
  }
  if (!inc || typeof inc !== "object" || Array.isArray(inc) || !["workouts", "sessions", "cardio", "templates"].some(k => k in inc)) {
    return toast("That isn't a workout backup file.");
  }

  const copy = JSON.parse(JSON.stringify(data)); // try it on a copy first
  const stats = mergeImport(inc, copy);
  const found = importSummary(stats);
  if (!found) return toast(stats.same ? "Nothing new: you already have all of it." : "Nothing to import in that file.");

  const note = stats.same ? "\n\n" + stats.same + " already on this device, skipped." : "";
  const ok = await askConfirm("Found " + found + " in this file. Add them to your data?\n\nNothing you already have is replaced or deleted." + note, "Import");
  if (!ok) return;
  Object.keys(copy).forEach(key => { data[key] = copy[key]; });
  saveData();
  queueOnlineSync();
  toast("Imported " + found);
  renderHistory();
}

screenHistory.addEventListener("click", e => {
  if (e.target.id === "import-btn") document.getElementById("import-file").click();
});

screenHistory.addEventListener("change", e => {
  if (e.target.id === "import-file") {
    const file = e.target.files[0];
    e.target.value = ""; // so choosing the same file again still works
    importData(file);
  }
});
