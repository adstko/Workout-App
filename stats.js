// stats.js — the Stats tab (on the History screen): totals for this week, this month or all time.
// Everything here is added up from the logs already saved on your phone. Nothing is sent anywhere.

let statsPeriod = "week"; // "week", "month" or "all"

// Cardio types grouped for the mile counters
const RUN_TYPES = ["Jog", "Intervals (8 x 30s hard / 90s easy)"];
const BIKE_TYPES = ["Bike"];
// everything else with miles (walks, golf, other) counts as walked

// Monday of the week that contains a date, as "YYYY-MM-DD"
function mondayKey(date) {
  const since = (date.getDay() + 6) % 7;
  return dateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - since));
}

function periodStart(period) {
  const now = new Date();
  if (period === "week") return mondayKey(now);
  if (period === "month") return dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  return "0000-00-00";
}

// Add up everything between two dates (inclusive)
function computeStats(from, to) {
  to = to || "9999-99-99";
  const s = { lbs: 0, workouts: 0, sets: 0, run: 0, bike: 0, walk: 0, climb: 0, floors: 0, net: 0, cardioMin: 0, byLift: {} };

  allWorkouts().filter(w => w.date >= from && w.date <= to).forEach(w => {
    let didAny = false;
    w.exercises.forEach(ex => ex.sets.filter(x => x.done).forEach(x => {
      didAny = true;
      s.sets++;
      if (TIMED.includes(ex.name)) return;                        // planks have no weight x reps
      const volume = (Number(x.weight) || 0) * (Number(x.reps) || 0); // lbs lifted in this set
      s.lbs += volume;
      s.byLift[ex.name] = (s.byLift[ex.name] || 0) + volume;
    }));
    if (didAny) s.workouts++;
  });

  data.cardio.filter(c => c.date >= from && c.date <= to).forEach(c => {
    s.cardioMin += Number(c.minutes) || 0;
    const miles = Number(c.miles) || 0;
    if (RUN_TYPES.includes(c.type)) s.run += miles;
    else if (BIKE_TYPES.includes(c.type)) s.bike += miles;
    else s.walk += miles;
    s.climb += Number(c.climb) || 0;
    s.floors += Number(c.floors) || 0;
  });
  s.net = netMilesRan(s.run, s.bike, s.floors); // running-equivalent miles (bike and stairs converted)
  return s;
}

// Weeks in a row (counting back from this week) with at least one workout or cardio
function weekStreak() {
  const now = new Date();
  const active = new Set();
  allWorkouts().filter(w => w.exercises.some(ex => ex.sets.some(s => s.done))).forEach(w => active.add(mondayKey(new Date(w.date + "T00:00:00"))));
  data.cardio.forEach(c => active.add(mondayKey(new Date(c.date + "T00:00:00"))));
  let monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7);
  if (!active.has(dateKey(monday))) monday.setDate(monday.getDate() - 7); // a quiet Monday morning doesn't break the streak
  let streak = 0;
  while (active.has(dateKey(monday))) { streak++; monday.setDate(monday.getDate() - 7); }
  return streak;
}

const fmt = n => Math.round(n).toLocaleString();
const fmtMiles = n => (Math.round(n * 10) / 10).toLocaleString();

function statCard(value, label) {
  return `<div class="stat"><b>${value}</b><span>${label}</span></div>`;
}

// A small bar chart of the last 8 weeks. values: oldest first; the last bar is this week.
function barChart(values, labels, unit) {
  const W = 320, H = 150, left = 8, right = 8, top = 22, bottom = 24;
  const max = Math.max(...values, 1);
  const slot = (W - left - right) / values.length, barW = slot * 0.62;
  const short = v => v >= 10000 ? Math.round(v / 1000) + "k" : v >= 1000 ? (v / 1000).toFixed(1) + "k" : String(Math.round(v * 10) / 10);
  const bars = values.map((v, i) => {
    const h = (H - top - bottom) * v / max, x = left + slot * i + (slot - barW) / 2, y = H - bottom - h;
    return `<rect class="bar ${i === values.length - 1 ? "now" : ""}" x="${x}" y="${y}" width="${barW}" height="${Math.max(h, v ? 2 : 0)}" rx="3"/>
      ${v ? `<text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle">${short(v)}</text>` : ""}
      <text x="${x + barW / 2}" y="${H - 8}" text-anchor="middle">${labels[i]}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${unit} for the last 8 weeks">${bars}</svg>`;
}

// ---------- Weekly consistency: how many planned workouts did I finish this week? ----------
// "Planned" = a day with a preset (or a cardio day) in your weekly schedule. "Done" = you logged a workout or cardio that day.
function weekPlanProgress() {
  const now = new Date(), since = (now.getDay() + 6) % 7, days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - since + i);
    const key = dateKey(d), preset = presetForDay(d.getDay());
    const planned = !!preset || data.cardioDays.includes(d.getDay());
    days.push({ key: key, label: WEEK[i][0], planned: planned, name: preset ? (preset.short || preset.name) : planned ? "Cardio" : "",
                done: planned && didTrain(key), isToday: key === todayKey(), future: key > todayKey() });
  }
  return { days: days, planned: days.filter(d => d.planned).length, done: days.filter(d => d.done).length };
}

function consistencyHtml(compact) {
  const w = weekPlanProgress();
  if (!w.planned) {
    return `<div class="card"><b>This week</b><div class="muted">No workouts planned yet. Set your week in Workouts, or tap Use Recomp Week.</div></div>`;
  }
  const pct = Math.round(w.done / w.planned * 100);
  const detail = compact ? "" : `<div class="plan-days">` + w.days.filter(d => d.planned).map(d =>
    `<div class="plan-day ${d.done ? "done" : ""} ${d.isToday ? "today" : ""}"><span>${d.label}</span><b>${d.done ? "✓" : "·"}</b><small>${esc(d.name)}</small></div>`).join("") + `</div>`;
  return `<div class="card"><b>${w.done} of ${w.planned} planned workouts done this week</b>
    <div class="pbar"><i style="width:${pct}%"></i></div>${detail}
    ${w.done === w.planned ? '<div class="muted">Every planned workout is done. Nice.</div>' : ""}</div>`;
}

// On the 1st of the month (if you want it): a reminder, nothing is saved
function photoReminderHtml() {
  const now = new Date(), month = dateKey(now).slice(0, 7);
  if (now.getDate() !== 1 || !data.photoReminder || data.photoDismissed === month) return "";
  return `<div class="card"><b>Monthly check-in</b>
    <div class="muted">It's the 1st: time for a check-in if you want one. It's completely optional. Photos stay on this phone only.</div>
    <div class="row" style="margin-top:10px"><button data-open-photos="1">Open Photos</button><button data-photo-dismiss="1">Not this month</button></div></div>`;
}

let checkinOpen = false; // the monthly check-in fold-out on the Progress tab

// ---------- Strength: the heaviest completed set each week ----------
function weeklyBest(names, weeks) {
  const now = new Date(), thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7);
  const all = allWorkouts(), values = [], labels = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7 * i);
    const from = dateKey(start), to = dateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
    let best = null;
    all.filter(w => w.date >= from && w.date <= to).forEach(w => w.exercises.filter(ex => names.includes(ex.name)).forEach(ex =>
      ex.sets.filter(s => s.done).forEach(s => { const wt = Number(s.weight) || 0; if (wt > 0 && (best === null || wt > best)) best = wt; })));
    values.push(best);
    labels.push(start.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }));
  }
  return { values: values, labels: labels };
}

// the row exercise you've logged the most (different rows aren't comparable, so we chart one)
function mostLoggedRow(names) {
  const count = {};
  allWorkouts().forEach(w => w.exercises.forEach(ex => { if (names.includes(ex.name)) count[ex.name] = (count[ex.name] || 0) + ex.sets.filter(s => s.done).length; }));
  return names.slice().sort((a, b) => (count[b] || 0) - (count[a] || 0))[0];
}

function lineChart(values, labels, unit) {
  const W = 320, H = 160, left = 42, right = 14, top = 22, bottom = 28;
  const have = values.filter(v => v !== null);
  let min = Math.min(...have), max = Math.max(...have);
  if (min === max) { min = Math.max(0, min - 10); max += 10; } else { const pad = (max - min) * 0.2; min = Math.max(0, Math.floor(min - pad)); max = Math.ceil(max + pad); }
  const x = i => left + (W - left - right) * (values.length === 1 ? 0.5 : i / (values.length - 1));
  const y = v => top + (H - top - bottom) * (1 - (v - min) / (max - min));
  let runs = [], run = [];
  values.forEach((v, i) => { if (v === null) { if (run.length) runs.push(run); run = []; } else run.push(x(i) + "," + y(v)); });
  if (run.length) runs.push(run);
  const dots = values.map((v, i) => v === null ? "" : `<circle cx="${x(i)}" cy="${y(v)}" r="4"/>`).join("");
  const lastI = values.length - 1 - [...values].reverse().findIndex(v => v !== null);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${unit} per week">
    <text x="${left - 6}" y="${y(max) + 4}" text-anchor="end">${max}</text><text x="${left - 6}" y="${y(min) + 4}" text-anchor="end">${min}</text>
    ${runs.filter(r => r.length > 1).map(r => `<polyline points="${r.join(" ")}"/>`).join("")}${dots}
    <text x="${x(lastI)}" y="${y(values[lastI]) - 9}" text-anchor="middle">${values[lastI]}</text>
    <text x="${left}" y="${H - 8}">${labels[0]}</text><text x="${W - right}" y="${H - 8}" text-anchor="end">${labels[labels.length - 1]}</text></svg>`;
}

function strengthHtml() {
  let html = `<h2>Strength</h2><p class="muted">The heaviest set you finished each week, for the last 12 weeks.</p>`;
  STRENGTH_LIFTS.forEach(lift => {
    const rowName = lift.label === "Row" ? mostLoggedRow(lift.names) : null;
    const title = rowName ? "Row (" + rowName + ")" : lift.label;
    const { values, labels } = weeklyBest(rowName ? [rowName] : lift.names, 12);
    const have = values.filter(v => v !== null);
    if (!have.length) {
      html += `<div class="card"><b>${esc(title)}</b><div class="muted">Log it in a workout and your line starts here.</div></div>`;
      return;
    }
    const latest = have[have.length - 1], best = Math.max(...have);
    html += `<div class="card"><b>${esc(title)}</b> <span class="muted">· latest ${latest} lb · best ${best} lb</span>${lineChart(values, labels, title)}</div>`;
  });
  return html;
}

// ---------- Monthly check-in (optional and private) ----------
function checkinHtml() {
  const list = data.measurements.slice().sort((a, b) => b.date.localeCompare(a.date));
  const field = (id, label) => `<div><label for="${id}">${label}</label><input id="${id}" type="number" inputmode="decimal" min="0" max="99" step="any" placeholder="inches"></div>`;
  return `<details id="checkin" ${checkinOpen ? "open" : ""} style="margin-top:14px"><summary>Monthly check-in (optional)</summary>
    <div><p class="muted">Just for you. This stays on your phone and is never uploaded or shared. Photos have their own private place: History > Photos.</p>
      <div class="stack">${field("ci-waist", "Waist (in)")}${field("ci-chest", "Chest (in)")}${field("ci-arms", "Arms (in)")}
        <button class="big primary" data-save-checkin="1">Save today's measurements</button></div>
      ${list.map(m => `<div class="entry" style="margin-top:10px"><div>${esc(prettyDate(m.date))}<div class="muted">${[m.waist ? "waist " + m.waist : "", m.chest ? "chest " + m.chest : "", m.arms ? "arms " + m.arms : ""].filter(Boolean).join(" · ")} in</div></div>
        <button data-del-checkin="${esc(m.id)}">Delete</button></div>`).join("")}
      <div class="entry" style="margin-top:14px"><span>Remind me to take a progress photo on the 1st of each month</span>
        <button data-photo-toggle="1" class="${data.photoReminder ? "on" : ""}" style="min-width:76px">${data.photoReminder ? "On" : "Off"}</button></div></div></details>`;
}

function statsHtml() {
  const s = computeStats(periodStart(statsPeriod));
  const names = { week: "this week", month: "this month", all: "all time" };

  let html = `<div class="row" style="margin-bottom:12px">` + [["week", "This week"], ["month", "This month"], ["all", "All time"]]
    .map(([key, label]) => `<button data-stats-period="${key}" class="${key === statsPeriod ? "on" : ""}">${label}</button>`).join("") + `</div>`;

  html += `<div class="stat-grid">
    ${statCard(fmt(s.lbs), "lbs lifted")}
    ${statCard(s.workouts, s.workouts === 1 ? "workout" : "workouts")}
    ${statCard(fmt(s.sets), "sets done")}
    ${statCard(fmtMiles(s.net), "net miles ran")}
    ${statCard(fmtMiles(s.run), "miles ran")}
    ${statCard(fmtMiles(s.bike), "miles biked")}
    ${statCard(fmtMiles(s.walk), "miles walked")}
    ${statCard(fmt(s.floors), "floors climbed")}
    ${statCard(fmt(s.climb), "feet climbed")}
    ${statCard(fmt(s.cardioMin), "cardio minutes")}
  </div>`;

  const streak = weekStreak();
  html += `<div class="card"><b>${streak} ${streak === 1 ? "week" : "weeks"} in a row</b>
    <div class="muted">Weeks with at least one workout or cardio session.</div></div>`;
  html += consistencyHtml(false) + strengthHtml();

  const top = Object.entries(s.byLift).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length) {
    html += `<h2>Most lifted ${names[statsPeriod]}</h2><div class="card">` +
      top.map(([name, v]) => `<div class="entry"><span>${esc(name)}</span><b>${fmt(v)} lbs</b></div>`).join("") + `</div>`;
  }
  if (s.lbs === 0 && s.sets === 0 && !s.cardioMin) {
    html += `<p class="muted">Nothing logged ${names[statsPeriod]} yet. Finish a set or log some cardio and your totals show up here.</p>`;
  }

  // last 8 weeks, oldest first
  const now = new Date(), thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7);
  const lbs = [], miles = [], labels = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7 * i);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const w = computeStats(dateKey(start), dateKey(end));
    lbs.push(w.lbs); miles.push(w.net);
    labels.push(start.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }));
  }
  html += `<h2>Lbs lifted per week</h2>${barChart(lbs, labels, "Lbs lifted")}
    <h2>Net miles ran per week</h2>${barChart(miles, labels, "Net miles ran")}
    <p class="muted">Weeks start on Monday. Lbs lifted adds up weight × reps for every set you finished. Planks and bodyweight sets with no weight add 0.
    Net miles ran counts ${BIKE_MILES_PER_RUN_MILE} miles biked or ${FLOORS_PER_RUN_MILE} floors of stairs as 1 mile ran.</p>`;
  html += checkinHtml() + `<button class="big" data-open-tips="1" style="margin-top:14px">Recomp tips</button>`;
  return html;
}

screenHistory.addEventListener("click", e => {
  const btn = e.target.closest("[data-stats-period]");
  if (btn) { statsPeriod = btn.dataset.statsPeriod; renderHistory(); }
});

screenHistory.addEventListener("toggle", e => { if (e.target.id === "checkin") checkinOpen = e.target.open; }, true);

screenHistory.addEventListener("click", async e => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.openTips) return showScreen("tips");
  if (t.dataset.photoToggle) { data.photoReminder = !data.photoReminder; saveData(); checkinOpen = true; return renderHistory(); }
  if (t.dataset.saveCheckin) {
    const n = id => { const v = Number(document.getElementById(id).value); return v > 0 && v < 100 ? Math.round(v * 10) / 10 : null; };
    const entry = { id: uid(), date: todayKey(), waist: n("ci-waist"), chest: n("ci-chest"), arms: n("ci-arms") };
    if (!entry.waist && !entry.chest && !entry.arms) return toast("Type at least one measurement.");
    data.measurements.push(entry);
    saveData();
    checkinOpen = true;
    toast("Saved on this phone.");
    return renderHistory();
  }
  if (t.dataset.delCheckin && await askConfirm("Delete this check-in?", "Delete")) {
    data.measurements = data.measurements.filter(m => m.id !== t.dataset.delCheckin);
    saveData();
    checkinOpen = true;
    renderHistory();
  }
});
