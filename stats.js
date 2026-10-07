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
  return html;
}

screenHistory.addEventListener("click", e => {
  const btn = e.target.closest("[data-stats-period]");
  if (btn) { statsPeriod = btn.dataset.statsPeriod; renderHistory(); }
});
