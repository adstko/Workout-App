// history.js — History screen: weight chart, past workouts, export

const screenHistory = document.getElementById("screen-history");
let openWorkoutId = null; // a workout to show expanded (set when you finish one)

// Only count workouts where at least one set was finished (old and new flow together)
function loggedWorkouts() {
  return allWorkouts().filter(w => w.exercises.some(ex => ex.sets.some(s => s.done)));
}

function renderHistory() {
  const logged = loggedWorkouts();
  const names = [...new Set(logged.flatMap(w => w.exercises
    .filter(ex => ex.sets.some(s => s.done)).map(ex => ex.name)))].sort();

  let html = `<h1>History</h1><h2>Weight over time</h2>`;
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
    html += `<button data-save-preset="${w.id}" style="width:100%;margin-top:10px">Save as preset</button></details>`;
  });
  openWorkoutId = null;
  if (logged.length === 0) html += `<p class="muted">No workouts yet.</p>`;

  html += `<h2>Backup</h2>
    <button class="big primary" id="export-btn">Export my data</button>
    <p class="muted">Downloads all your workouts and cardio as a file.</p>`;

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
  if (e.target.id === "export-btn") exportData();
  else if (e.target.dataset.savePreset) savePresetFromWorkout(e.target.dataset.savePreset);
});
