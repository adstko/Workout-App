// guided.js — the cardio-style presets: Conditioning Circuit (round tracker), Intervals (timer), Easy Cardio + Core.
// When you finish, you log how long it took and how hard it felt (1 to 10) in the cardio log.

const screenGuided = document.getElementById("screen-guided");
let guided = null;      // the session in progress (kept in memory only)
let guidedId = null;    // the timer tick
let wakeLock = null;    // keeps the screen on while a timer runs (if the phone allows it)

// ---------- Building a session ----------
function buildPhases(p) {
  const plan = p.plan || {};
  if (p.kind === "intervals") {
    const rounds = plan.rounds || 8, phases = [];
    if (plan.warmup) phases.push({ label: "Warm-up", sec: plan.warmup, tone: "easy" });
    for (let r = 1; r <= rounds; r++) {
      phases.push({ label: "HARD", sec: plan.hard || 30, tone: "hard", round: r });
      phases.push({ label: "EASY", sec: plan.easy || 90, tone: "easy", round: r });
    }
    if (plan.cooldown) phases.push({ label: "Cool-down", sec: plan.cooldown, tone: "easy" });
    return phases;
  }
  if (p.kind === "cardio") return [{ label: "Easy cardio", sec: (plan.minutes || 25) * 60, tone: "easy" }];
  return []; // the circuit has no timer, just rounds
}

function startGuided(id) {
  const p = data.templates.find(t => t.id === id);
  clearInterval(guidedId);
  letSleep();
  guided = { mode: modeForPreset(p), p: JSON.parse(JSON.stringify(p)), startedAt: Date.now(), activeMs: 0, round: 0, core: {}, finishing: false,
             phases: buildPhases(p), idx: 0, running: false, end: 0, left: 0, lastStart: 0, done: false };
  if (guided.phases.length) guided.left = guided.phases[0].sec * 1000;
  ((p.plan && p.plan.core) || []).forEach(name => { guided.core[name] = Array((p.plan && p.plan.coreSets) || 3).fill(false); });
  showScreen("guided");
}

// ---------- The timer ----------
async function keepAwake() { try { wakeLock = await navigator.wakeLock.request("screen"); } catch (e) {} }
function letSleep() { try { if (wakeLock) wakeLock.release(); } catch (e) {} wakeLock = null; }

function gAlert() { // a beep and a buzz when the phase changes
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  try { audioCtx = audioCtx || new AudioContext(); beep(); } catch (e) {}
}

function gStart() {
  try { audioCtx = audioCtx || new AudioContext(); audioCtx.resume(); } catch (e) {} // sound is only allowed after a tap
  guided.running = true;
  guided.lastStart = Date.now();
  guided.end = Date.now() + guided.left;
  clearInterval(guidedId);
  guidedId = setInterval(gTick, 250);
  keepAwake();
  renderGuided();
}

function gPause() {
  guided.activeMs += Date.now() - guided.lastStart;
  guided.left = Math.max(0, guided.end - Date.now());
  guided.running = false;
  clearInterval(guidedId);
  letSleep();
}

function gNextPhase() { // move on when a phase runs out; false if that was the last one
  if (guided.idx + 1 >= guided.phases.length) return false;
  guided.idx++;
  guided.end += guided.phases[guided.idx].sec * 1000;
  return true;
}

function gTick() {
  if (!guided || !guided.running) return clearInterval(guidedId);
  while (guided.end - Date.now() <= 0) {
    if (!gNextPhase()) return gDone();
    gAlert();
  }
  gUpdate();
}

// Skip to the next phase right now
function gSkip() {
  if (guided.idx + 1 >= guided.phases.length) return gDone();
  guided.idx++;
  const ms = guided.phases[guided.idx].sec * 1000;
  guided.left = ms;
  if (guided.running) guided.end = Date.now() + ms;
  gAlert();
  renderGuided();
}

function gDone() {
  if (guided.running) gPause();
  guided.idx = Math.min(guided.idx, guided.phases.length - 1); // stay on the last phase
  guided.left = 0;
  guided.done = true;
  guided.finishing = true;
  gAlert();
  if (screenGuided.hidden === false) renderGuided();
}

function gLeftMs() {
  return guided.running ? Math.max(0, guided.end - Date.now()) : guided.left;
}

// Update the clock, phase and bar without redrawing the whole screen
function gUpdate() {
  const phase = guided.phases[guided.idx];
  if (!phase || !document.getElementById("g-time")) return;
  const left = gLeftMs();
  document.getElementById("g-time").textContent = fmtClock(left / 1000);
  document.getElementById("g-phase").textContent = phase.label;
  document.getElementById("g-round").textContent = phase.round ? "Round " + phase.round + " of " + roundsTotal() : "";
  document.getElementById("g-card").className = "card phase " + phase.tone;
  document.getElementById("g-bar").style.width = Math.round((1 - left / (phase.sec * 1000)) * 100) + "%";
  const rest = guided.phases.slice(guided.idx + 1).reduce((sum, ph) => sum + ph.sec, 0) * 1000 + left;
  document.getElementById("g-total").textContent = fmtClock(rest / 1000) + " left in total";
}

function roundsTotal() {
  return guided.phases.filter(ph => ph.label === "HARD").length;
}

// ---------- The screen ----------
function stepsHtml(p) {
  return `<div class="card"><b>${esc(p.name)}</b><div class="muted">${p.about ? "About " + p.about + " minutes" : ""}</div>
    <ul class="steps">${(p.steps || []).map(s => `<li>${esc(s)}</li>`).join("")}</ul></div>`;
}

function timerHtml() {
  const phase = guided.phases[guided.idx];
  const left = gLeftMs();
  return `<div class="card phase ${phase.tone}" id="g-card">
      <div class="muted" id="g-round">${phase.round ? "Round " + phase.round + " of " + roundsTotal() : ""}</div>
      <div class="phase-name" id="g-phase">${esc(phase.label)}</div>
      <div class="clock phase-time" id="g-time">${fmtClock(left / 1000)}</div>
      <div class="pbar"><i id="g-bar" style="width:${Math.round((1 - left / (phase.sec * 1000)) * 100)}%"></i></div>
      <div class="muted" id="g-total"></div></div>
    <div class="row"><button id="g-toggle" class="primary big">${guided.running ? "Pause" : guided.activeMs ? "Resume" : "Start"}</button>
      ${guided.phases.length > 1 ? '<button id="g-skip" class="big">Skip</button>' : ""}</div>
    <p class="muted">${guided.p.kind === "intervals" ? "Hard is a strong push you could keep up for 30 seconds, not an all-out sprint. Easy means you could talk. Stop if you feel dizzy or something hurts." : "Keep it easy enough that you can still talk."}</p>`;
}

function circuitHtml() {
  const plan = guided.p.plan || {}, rounds = plan.rounds || 4;
  const chips = Array.from({ length: rounds }, (_, i) => `<span class="rchip ${i < guided.round ? "on" : ""}">${i + 1}</span>`).join("");
  return `<div class="card"><div class="muted">Rounds done (${guided.round} of ${rounds})</div><div class="rchips">${chips}</div>
      <button id="g-round-done" class="big primary" style="margin-top:12px">${guided.round + 1 >= rounds ? "Last round done" : "Round " + (guided.round + 1) + " done"}</button>
      ${plan.repeat ? `<button id="g-repeat" class="big" style="margin-top:10px">Repeat round</button>` : ""}
      <p class="muted">${plan.repeat ? "No rest between exercises. " : ""}Rest ${plan.restSeconds || 60} seconds between rounds. The rest timer starts when you tap.</p></div>`;
}

function coreHtml() {
  const names = Object.keys(guided.core);
  if (!names.length) return "";
  return `<div class="card"><b>Core</b><div class="muted">Tick each set when you finish it.</div>` + names.map(name =>
    `<div class="entry" style="margin-top:8px"><span>${esc(name)}</span><div class="rchips">` +
    guided.core[name].map((on, i) => `<button class="rchip ${on ? "on" : ""}" data-core="${esc(name)}" data-set="${i}" aria-label="${esc(name)} set ${i + 1}">${i + 1}</button>`).join("") +
    `</div></div>`).join("") + `</div>`;
}

function coreSummary() {
  return Object.keys(guided.core).map(n => n + " " + guided.core[n].filter(Boolean).length + "/" + guided.core[n].length).join(", ");
}

function finishHtml() {
  const p = guided.p;
  const planned = p.about || 20;
  const minutes = p.kind === "circuit"
    ? Math.max(1, Math.round((Date.now() - guided.startedAt) / 60000))
    : guided.activeMs > 0 ? Math.max(1, Math.round(guided.activeMs / 60000)) : planned;
  const core = coreSummary();
  return `<div class="card stack"><b>${guided.done ? "Nice work. Log it." : "Log it"}</b>
      ${p.plan && p.plan.repeat ? `<button id="g-repeat" class="big">Repeat round</button>` : ""}
      <div><label for="gf-type">Type</label><select id="gf-type">${CARDIO_TYPES.map(t => `<option ${t === p.cardioType ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
      <div><label for="gf-min">Minutes</label><input id="gf-min" type="number" inputmode="numeric" min="1" max="300" value="${minutes}"></div>
      <div><label for="gf-miles">Miles (optional)</label><input id="gf-miles" type="number" inputmode="decimal" min="0" max="500" step="any" placeholder="e.g. 1.5"></div>
      <div><label for="gf-effort">How hard did it feel? (1 = very easy, 10 = very hard)</label><select id="gf-effort">${effortOptions()}</select></div>
      <div><label for="gf-notes">Notes</label><input id="gf-notes" type="text" maxlength="120" value="${esc(core ? "Core: " + core : "")}"></div>
      <button id="gf-save" class="big primary">Save to cardio log</button>
      <button id="gf-back" class="big">Back</button></div>`;
}

function renderGuided() {
  if (!guided) return showScreen("workouts");
  const p = guided.p;
  let html = `<div class="topbar"><button id="g-leave" aria-label="Leave">‹</button><h1>${esc(p.name)}</h1></div>`;
  if (guided.finishing) {
    screenGuided.innerHTML = html + finishHtml();
    return;
  }
  html += stepsHtml(p);
  html += p.kind === "circuit" ? circuitHtml() : timerHtml();
  if (p.kind === "cardio") html += coreHtml();
  html += `<button id="g-finish" class="big" style="margin-top:12px">Finish and log</button>`;
  screenGuided.innerHTML = html;
  if (guided.phases.length) gUpdate();
}

// A small card on Today and Workouts so you can get back to a session you left
function guidedBannerHtml() {
  if (!guided) return "";
  return `<div class="card"><b>Session in progress</b><div class="muted">${esc(guided.p.name)}</div>
    <button class="big primary" id="g-resume" style="margin-top:10px">Open session</button></div>`;
}

function endGuided() {
  clearInterval(guidedId);
  letSleep();
  stopTimer(); // the rest timer from the circuit
  guided = null;
}

// ---------- Buttons ----------
screenGuided.addEventListener("click", async e => {
  const t = e.target.closest("button");
  if (!t || !guided) return;

  if (t.id === "g-toggle") { if (guided.running) { gPause(); renderGuided(); } else gStart(); }
  else if (t.id === "g-skip") gSkip();
  else if (t.id === "g-round-done") {
    guided.round++;
    const rounds = (guided.p.plan && guided.p.plan.rounds) || 4;
    if (guided.round >= rounds) { guided.done = true; guided.finishing = true; toast("All rounds done!"); }
    else { startTimer((guided.p.plan && guided.p.plan.restSeconds) || 60); }
    renderGuided();
  }
  else if (t.id === "g-repeat") { // one more round: back to the tracker
    const plan = guided.p.plan;
    plan.rounds = Math.min(10, (plan.rounds || 1) + 1);
    guided.done = false; guided.finishing = false;
    toast("Round " + plan.rounds + " added");
    renderGuided();
  }
  else if (t.dataset.core) { const arr = guided.core[t.dataset.core]; arr[Number(t.dataset.set)] = !arr[Number(t.dataset.set)]; renderGuided(); }
  else if (t.id === "g-finish") { if (guided.running) gPause(); guided.finishing = true; renderGuided(); }
  else if (t.id === "gf-back") { guided.finishing = false; renderGuided(); }
  else if (t.id === "g-leave") {
    const started = guided.running || guided.activeMs > 0 || guided.round > 0 || guided.finishing;
    if (started && !(await askConfirm("Leave this session without logging it?", "Leave"))) return;
    endGuided();
    showScreen("workouts");
  }
  else if (t.id === "gf-save") {
    const minutes = Math.round(Number(document.getElementById("gf-min").value));
    if (!(minutes >= 1)) return toast("Type how many minutes it took.");
    const miles = Number(document.getElementById("gf-miles").value);
    const effort = Number(document.getElementById("gf-effort").value);
    data.cardio.push({
      id: String(Date.now()), date: todayKey(), type: document.getElementById("gf-type").value, minutes: minutes,
      miles: miles > 0 ? miles : null, floors: null, climb: null, effort: effort >= 1 ? effort : null,
      presetId: guided.p.id, presetName: guided.p.name, mode: guided.mode || modeForPreset(guided.p), notes: document.getElementById("gf-notes").value.trim(),
    });
    saveData();
    queueOnlineSync();
    endGuided();
    toast("Saved to your cardio log.");
    showScreen("today");
  }
});

// the "Session in progress" card (on Today and Workouts)
document.addEventListener("click", e => {
  if (e.target.id === "g-resume" && guided) showScreen("guided");
});
