// photos.js — the Photos screen (progress photos). PRIVATE: everything here stays on this phone.
// No network code, no share buttons, nothing is ever sent anywhere. See photostore.js for how photos are kept.

const screenPhotos = document.getElementById("screen-photos");
const privacyCover = document.getElementById("privacy-cover");
const PRIVATE_LABEL = `<div class="privacy-label">Private. Stored only on this phone.</div>`;
const MEASURES = [["weight", "Weight (lb)"], ["waist", "Waist (in)"], ["chest", "Chest (in)"], ["arms", "Arms (in)"]];
const FEELS = ["Great", "Good", "OK", "Tired"];

let pv = { view: "grid", id: null };          // which Photos view is open
let unlocked = false;                         // PIN entered this visit
let revealed = new Set();                     // blurred pictures the user tapped to show
let photoUrls = [];                           // temporary picture links, freed when the screen redraws
let ciDraft = null;                             // the check-in being filled in (kept in memory only)
let pinForm = null, pinMsg = "";
let pinFails = 0, pinLockUntil = 0;
let filePickAt = 0;                           // when the camera/photo picker was last opened
let cmp = { a: null, b: null, pose: "front", mode: "slider", pos: 50 };
let timelinePose = "front";
let rendering = false, again = false, keepY = false;

function openPhotos() { pv = { view: "grid", id: null }; showScreen("photos"); }

// Called by showScreen when you leave the Photos screen: nothing stays in the page
function photosLeft() {
  ciDraft = null; unlocked = false; pinForm = null; pinMsg = ""; revealed.clear();
  screenPhotos.innerHTML = "";
  photoUrls.forEach(u => URL.revokeObjectURL(u));
  photoUrls = [];
  privacyCover.hidden = true;
}

const byNewest = (a, b) => b.date.localeCompare(a.date) || b.n - a.n;
const sorted = () => photoMeta.checkins.slice().sort(byNewest);
const findCheckin = id => photoMeta.checkins.find(c => c.id === id);
const fmtNum = n => Number.isInteger(n) ? String(n) : n.toFixed(1);
const ciName = c => "Check-in #" + c.n;

function bufUrl(buf) {
  const u = URL.createObjectURL(new Blob([buf], { type: "image/jpeg" }));
  photoUrls.push(u);
  return u;
}

async function imgUrl(id, kind) {
  if (!id) return null;
  const rec = await getPhoto(id);
  return rec && rec[kind] ? bufUrl(rec[kind]) : null;
}

// ---------- drawing ----------
async function renderPhotos(keepScroll) {
  keepY = keepY || keepScroll === true;
  if (rendering) { again = true; return; }
  rendering = true;
  try {
    do {
      again = false;
      const y = window.scrollY, keep = keepY;
      keepY = false;
      const old = photoUrls;
      photoUrls = [];
      let html;
      try { html = await buildView(); } catch (e) { html = head() + `<div class="card">${esc(e && e.message ? e.message : "Something went wrong with photo storage.")}</div>`; }
      screenPhotos.innerHTML = html;
      old.forEach(u => URL.revokeObjectURL(u));
      if (keep) window.scrollTo(0, y);
    } while (again);
  } finally { rendering = false; }
}

function head() {
  const tab = (key, label, on) => `<button ${key ? `data-history-tab="${key}"` : ""} class="${on ? "on" : ""}">${label}</button>`;
  return `<h1>Photos</h1><div class="row tabs" style="margin-bottom:12px">${tab("log", "History")}${tab("stats", "Progress")}${tab("", "Photos", true)}${tab("friends", "Friends")}</div>${PRIVATE_LABEL}`;
}

async function buildView() {
  const h = head();
  if (!photoMeta.introSeen) return h + introHtml();
  if (photoMeta.pin && !unlocked) return h + lockHtml();
  const back = `<button data-ph="grid" style="margin-bottom:10px">‹ Back</button>`;
  if (pv.view === "new") return h + back + await newHtml();
  if (pv.view === "detail" && findCheckin(pv.id)) return h + back + await detailHtml(findCheckin(pv.id));
  if (pv.view === "compare") return h + back + await compareHtml();
  if (pv.view === "timeline") return h + back + await timelineHtml();
  if (pv.view === "settings") return h + back + settingsHtml();
  pv = { view: "grid", id: null };
  return h + await gridHtml();
}

function introHtml() {
  return `<div class="card"><b>Before you start</b>
    <ul class="steps"><li>Your photos stay on this phone only. They are never uploaded or shared.</li>
    <li>If you clear your browser data (or Safari website data), your photos are deleted.</li>
    <li>Use <b>Export</b> (in Photo settings) now and then to back them up.</li></ul>
    <button class="primary big" data-ph-intro="1" style="margin-top:12px">Got it</button></div>`;
}

function lockHtml() {
  return `<div class="card"><b>Enter your 4-digit PIN</b>
    <input id="ph-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="PIN" style="margin:10px 0">
    <div class="muted">${esc(pinMsg)}</div>
    <button class="primary big" data-ph-unlock="1" style="margin-top:10px">Open Photos</button></div>`;
}

// A picture that is blurred until tapped (when "Hide photos" is on)
function blurred(key) { return photoMeta.hide && !revealed.has(key); }
function wrapPic(inner, key, cls) {
  const b = blurred(key);
  return `<div class="blurwrap ${b ? "blur" : ""} ${cls || ""}" ${b ? `data-ph-reveal="${esc(key)}"` : ""}>${inner}${b ? `<div class="tap">Tap to show</div>` : ""}</div>`;
}

async function gridHtml() {
  const list = sorted();
  let html = `<button class="primary big" data-ph="new">+ New check-in</button>
    <div class="row" style="margin-top:10px"><button data-ph="compare">Compare</button><button data-ph="timeline">Timeline</button><button data-ph="settings">Settings</button></div>`;
  if (!list.length) return html + `<p class="muted" style="margin-top:14px">No check-ins yet. Add one whenever you want. It's completely optional.</p>`;
  const cards = [];
  for (const c of list) {
    const pose = POSES.map(p => p[0]).find(k => c.photos[k]);
    const url = pose ? await imgUrl(c.photos[pose], "thumb") : null;
    const pic = url ? `<img src="${url}" alt="">` : `<div class="ph-empty">No photos</div>`;
    const b = url && blurred(c.id);
    cards.push(`<button class="ph-card" ${b ? `data-ph-reveal="${esc(c.id)}"` : `data-ph-open="${esc(c.id)}"`}>
      <div class="blurwrap ${b ? "blur" : ""}">${pic}${b ? `<div class="tap">Tap to show</div>` : ""}</div>
      <div class="cap"><b>${ciName(c)}</b><small>${esc(prettyDate(c.date))}</small></div></button>`);
  }
  return html + `<div class="ph-grid">${cards.join("")}</div>`;
}

// ---------- weekly lift numbers linked to a check-in ----------
function bestInRange(names, from, to) {
  let best = null;
  allWorkouts().filter(w => w.date >= from && w.date <= to).forEach(w => w.exercises.filter(ex => names.includes(ex.name)).forEach(ex =>
    ex.sets.filter(s => s.done).forEach(s => { const wt = Number(s.weight) || 0; if (wt > 0 && (best === null || wt > best)) best = wt; })));
  return best;
}

function weekStats(date) {
  const d = new Date(date + "T00:00:00");
  const from = mondayKey(d), to = dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7) + 6));
  const lift = label => {
    const l = STRENGTH_LIFTS.find(x => x.label === label);
    return bestInRange(label === "Row" ? l.names : l.names, from, to);
  };
  return { workouts: computeStats(from, to).workouts, squat: lift("Squat"), bench: lift("Bench press"), row: lift("Row") };
}

function weekLine(s) {
  if (!s) return "";
  const lifts = [["Squat", s.squat], ["Bench", s.bench], ["Row", s.row]].filter(x => x[1] !== null).map(x => x[0] + " " + x[1] + " lb");
  return `Workouts finished: ${s.workouts}` + (lifts.length ? " · Best: " + lifts.join(", ") : "");
}

// ---------- new check-in ----------
function freshCiDraft() {
  return { date: todayKey(), note: "", feel: "", weight: "", waist: "", chest: "", arms: "", shots: {}, ghost: {} };
}

function lastWithPose(pose) { return sorted().find(c => c.photos[pose]); }

async function newHtml() {
  if (!ciDraft) ciDraft = freshCiDraft();
  let html = `<h2>New check-in</h2>`;
  for (const [pose, label] of POSES) {
    const prev = lastWithPose(pose), shot = ciDraft.shots[pose];
    const ghostOn = prev && ciDraft.ghost[pose] !== false;
    const prevUrl = ghostOn ? await imgUrl(prev.photos[pose], "full") : null;
    const newUrl = shot ? bufUrl(shot.full) : null;
    const inner = (newUrl ? `<img src="${newUrl}" alt="${label} photo">` : "") + (prevUrl ? `<img class="ph-ghost" src="${prevUrl}" alt="">` : "")
      + (!newUrl && !prevUrl ? `<span class="muted ph-none">No photo yet</span>` : "");
    html += `<div class="card"><b>${label}</b> <span class="muted">${shot ? "· ready" : "· optional"}</span>
      <div class="ph-frame">${inner}</div>
      <div class="row"><label class="btn">Take photo<input class="file-in" type="file" accept="image/*" capture data-shot="${pose}"></label>
        <label class="btn">Choose photo<input class="file-in" type="file" accept="image/*" data-shot="${pose}"></label></div>
      ${prev ? `<div class="muted" style="margin-top:8px">The faint picture is your last ${label} photo (${esc(ciName(prev))}). Line up with it.</div>
        <div class="row" style="margin-top:6px"><button data-ph-ghost="${pose}">Overlay: ${ghostOn ? "On" : "Off"}</button>${shot ? `<button data-ph-clear="${pose}" class="danger">Remove photo</button>` : ""}</div>`
        : shot ? `<div class="row" style="margin-top:8px"><button data-ph-clear="${pose}" class="danger">Remove photo</button></div>` : ""}</div>`;
  }
  const num = (k, label) => `<div><label for="ph-${k}">${label}</label><input id="ph-${k}" data-f="${k}" type="number" inputmode="decimal" min="0" max="999" step="any" value="${esc(ciDraft[k])}"></div>`;
  html += `<div class="card stack"><b>Details (all optional)</b>
    <div><label for="ph-date">Date</label><select id="ph-date" data-f="date">${dateChoices().replace(`value="${ciDraft.date}"`, `value="${ciDraft.date}" selected`)}</select></div>
    <div><label for="ph-note">Note</label><input id="ph-note" data-f="note" type="text" maxlength="200" value="${esc(ciDraft.note)}"></div>
    <div><label>How I feel</label><div class="row">${FEELS.map(f => `<button data-ph-feel="${f}" class="${ciDraft.feel === f ? "on" : ""}">${f}</button>`).join("")}</div></div>
    ${MEASURES.map(m => num(m[0], m[1])).join("")}</div>
    <div class="muted">This check-in will be linked to that week's workouts and lifts.</div>
    <button class="primary big" data-ph-save="1" style="margin-top:12px">Save check-in</button>
    <button class="big danger" data-ph-cancel="1" style="margin-top:10px">Discard</button>`;
  return html;
}

async function takeShot(pose, file) {
  if (!file) return;
  try {
    ciDraft.shots[pose] = await processPhoto(file);
  } catch (e) { toast(e && e.message ? e.message : "Couldn't use that photo."); }
  renderPhotos(true);
}

function cleanNum(v) {
  const n = Number(v);
  return v !== "" && isFinite(n) && n > 0 && n < 1000 ? Math.round(n * 10) / 10 : null;
}

async function saveDraft() {
  const d = ciDraft;
  const poses = POSES.map(p => p[0]).filter(k => d.shots[k]);
  const nums = {};
  MEASURES.forEach(m => { nums[m[0]] = cleanNum(d[m[0]]); });
  if (!poses.length && !d.note.trim() && !d.feel && !Object.values(nums).some(v => v !== null)) return toast("Add a photo or a detail first.");
  const id = uid(), photos = {};
  try {
    for (const k of poses) {
      photos[k] = id + "-" + k;
      await putPhoto({ id: photos[k], checkin: id, pose: k, full: d.shots[k].full, thumb: d.shots[k].thumb });
    }
  } catch (e) {
    await deletePhotos(Object.values(photos)).catch(() => {});
    return toast("Couldn't save: this phone has no room for the photos.");
  }
  const c = { id: id, n: photoMeta.nextNumber, date: DATE_KEY.test(d.date) ? d.date : todayKey(), note: d.note.trim().slice(0, 200), feel: d.feel,
    weight: nums.weight, waist: nums.waist, chest: nums.chest, arms: nums.arms, stats: weekStats(d.date), photos: photos };
  photoMeta.checkins.push(c);
  photoMeta.nextNumber++;
  if (!savePhotoMeta()) {
    photoMeta.checkins.pop(); photoMeta.nextNumber--;
    await deletePhotos(Object.values(photos)).catch(() => {});
    return toast("Couldn't save the check-in details.");
  }
  keepPhotosSafe();
  ciDraft = null;
  pv = { view: "detail", id: id };
  toast("Saved on this phone.");
  renderPhotos();
}

// ---------- one check-in ----------
async function detailHtml(c) {
  let html = `<h2>${ciName(c)}</h2><p class="muted">${esc(prettyDate(c.date))}</p>`;
  for (const [pose, label] of POSES) {
    if (!c.photos[pose]) continue;
    const url = await imgUrl(c.photos[pose], "full");
    html += `<div class="card"><b>${label}</b>${url ? wrapPic(`<div class="ph-frame"><img src="${url}" alt="${label} photo"></div>`, c.id) : `<div class="muted">Photo not found.</div>`}</div>`;
  }
  const meas = MEASURES.filter(m => c[m[0]] !== null && c[m[0]] !== undefined).map(m => `${m[1]}: ${fmtNum(c[m[0]])}`);
  html += `<div class="card">${c.feel ? `<div>How I feel: <b>${esc(c.feel)}</b></div>` : ""}${c.note ? `<div>${esc(c.note)}</div>` : ""}
    ${meas.length ? `<div class="muted">${meas.map(esc).join(" · ")}</div>` : ""}
    <div class="muted">${esc(weekLine(c.stats)) || "No workouts that week."}</div></div>
    <button class="big danger" data-ph-delete="${esc(c.id)}">Delete this check-in</button>`;
  return html;
}

async function deleteCheckin(id) {
  const c = findCheckin(id);
  if (!c) return;
  if (!await askConfirm("Delete " + ciName(c) + " and its photos from this phone? This can't be undone.", "Delete")) return;
  await deletePhotos(Object.values(c.photos)).catch(() => {});
  photoMeta.checkins = photoMeta.checkins.filter(x => x.id !== id);
  savePhotoMeta();
  pv = { view: "grid", id: null };
  toast("Deleted.");
  renderPhotos();
}

// ---------- compare ----------
async function compareHtml() {
  const list = sorted();
  let html = `<h2>Compare</h2>`;
  if (list.length < 2) return html + `<p class="muted">Add at least two check-ins to compare them.</p>`;
  if (!findCheckin(cmp.a) || !findCheckin(cmp.b) || cmp.a === cmp.b) { cmp.a = list[1].id; cmp.b = list[0].id; }
  const A = findCheckin(cmp.a), B = findCheckin(cmp.b);
  const opts = sel => list.map(c => `<option value="${esc(c.id)}" ${c.id === sel ? "selected" : ""}>${ciName(c)} · ${esc(prettyDate(c.date))}</option>`).join("");
  html += `<div class="two"><div><label for="cmp-a">Left</label><select id="cmp-a">${opts(cmp.a)}</select></div>
    <div><label for="cmp-b">Right</label><select id="cmp-b">${opts(cmp.b)}</select></div></div>
    <div class="row" style="margin-top:10px">${POSES.map(p => `<button data-ph-pose="${p[0]}" class="${cmp.pose === p[0] ? "on" : ""}">${p[1]}</button>`).join("")}</div>
    <div class="row" style="margin-top:8px"><button data-ph-mode="slider" class="${cmp.mode === "slider" ? "on" : ""}">Slider</button><button data-ph-mode="side" class="${cmp.mode === "side" ? "on" : ""}">Side by side</button></div>`;
  const ua = await imgUrl(A.photos[cmp.pose], "full"), ub = await imgUrl(B.photos[cmp.pose], "full");
  if (!ua || !ub) html += `<p class="muted">One of these check-ins has no ${cmp.pose} photo.</p>`;
  else if (cmp.mode === "side") {
    html += wrapPic(`<div class="two" style="margin-top:12px"><div class="ph-frame"><img src="${ua}" alt=""></div><div class="ph-frame"><img src="${ub}" alt=""></div></div>`, "cmp");
  } else {
    html += wrapPic(`<div class="cmp" id="cmp" style="margin-top:12px"><img src="${ua}" alt="${esc(ciName(A))}"><img id="cmp-top" src="${ub}" alt="${esc(ciName(B))}" style="clip-path:inset(0 0 0 ${cmp.pos}%)"><div class="cmp-line" id="cmp-line" style="left:${cmp.pos}%"></div></div>
      <input id="cmp-range" type="range" min="0" max="100" value="${cmp.pos}" aria-label="Swipe between the two photos" style="margin-top:8px">`, "cmp");
  }
  html += `<div class="card"><b>${ciName(A)} → ${ciName(B)}</b><div class="muted">${daysBetween(A.date, B.date)} days between</div>${changesHtml(A, B)}</div>`;
  return html;
}

function daysBetween(a, b) {
  return Math.round(Math.abs(new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}

function changesHtml(A, B) {
  const rows = [];
  const diff = (label, a, b, unit) => {
    if (a === null || a === undefined || b === null || b === undefined) return;
    const d = Math.round((b - a) * 10) / 10;
    rows.push(`<div class="entry"><span>${label}</span><span>${fmtNum(a)} → ${fmtNum(b)} ${unit} <span class="muted">(${d > 0 ? "+" : ""}${fmtNum(d)})</span></span></div>`);
  };
  const sa = A.stats || {}, sb = B.stats || {};
  diff("Workouts that week", sa.workouts, sb.workouts, "");
  diff("Squat", sa.squat, sb.squat, "lb");
  diff("Bench press", sa.bench, sb.bench, "lb");
  diff("Row", sa.row, sb.row, "lb");
  MEASURES.forEach(m => diff(m[1].replace(/ \(.*/, ""), A[m[0]], B[m[0]], m[0] === "weight" ? "lb" : "in"));
  return rows.length ? rows.join("") : `<div class="muted">No numbers to compare.</div>`;
}

// ---------- timeline ----------
async function timelineHtml() {
  let html = `<h2>Timeline</h2><div class="row">${POSES.map(p => `<button data-ph-tl="${p[0]}" class="${timelinePose === p[0] ? "on" : ""}">${p[1]}</button>`).join("")}</div>`;
  const list = sorted().filter(c => c.photos[timelinePose]).reverse();
  if (!list.length) return html + `<p class="muted">No ${timelinePose} photos yet.</p>`;
  const cells = [];
  for (const c of list) {
    const url = await imgUrl(c.photos[timelinePose], list.length > 8 ? "thumb" : "full");
    cells.push(`<div>${wrapPic(`<div class="ph-frame"><img src="${url}" alt=""></div>`, "tl-" + c.id)}<div class="cap"><b>${ciName(c)}</b> <span class="muted">${esc(prettyDate(c.date))}</span></div></div>`);
  }
  return html + `<p class="muted">Swipe sideways, oldest to newest.</p><div class="tl">${cells.join("")}</div>`;
}

// ---------- settings ----------
function settingsHtml() {
  const n = photoMeta.checkins.length;
  let pinHtml;
  if (pinForm) {
    const f = (id, label) => `<div><label for="${id}">${label}</label><input id="${id}" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off"></div>`;
    pinHtml = `<div class="stack">${photoMeta.pin ? f("pin0", "Current PIN") : ""}${pinForm === "set" ? f("pin1", "New 4-digit PIN") + f("pin2", "New PIN again") : ""}
      <div class="muted">${esc(pinMsg)}</div>
      <div class="row"><button class="primary" data-ph-pin="save">${pinForm === "remove" ? "Remove PIN" : "Save PIN"}</button><button data-ph-pin="cancel">Cancel</button></div></div>`;
  } else {
    pinHtml = `<div class="row">${photoMeta.pin ? `<button data-ph-pin="set">Change PIN</button><button data-ph-pin="remove">Remove PIN</button>` : `<button data-ph-pin="set">Set a PIN</button>`}</div>
      <div class="muted" style="margin-top:6px">A PIN is a simple lock for this tab. It doesn't encrypt anything.</div>`;
  }
  return `<h2>Photo settings</h2>
    <div class="card"><div class="entry"><span>Hide photos (blur until tapped)</span>
      <button data-ph-hide="1" class="${photoMeta.hide ? "on" : ""}" style="min-width:76px">${photoMeta.hide ? "On" : "Off"}</button></div></div>
    <div class="card"><b>PIN lock</b>${pinHtml}</div>
    <div class="card"><b>Back up</b>
      <p class="muted">Export saves a ZIP file on this phone only. Anyone who has that file can see your photos, so keep it private.</p>
      <div class="row"><button data-ph-export="1">Export photos</button><label class="btn">Restore backup<input class="file-in" id="ph-restore" type="file" accept=".zip,application/zip"></label></div></div>
    <div class="card"><b>Delete</b><p class="muted">${n} check-in${n === 1 ? "" : "s"} on this phone.</p>
      <button class="big danger" data-ph-wipe="1">Delete all photos</button></div>
    <div class="card muted">Photos stay on this phone. Clearing browser data deletes them, so Export now and then.</div>`;
}

async function exportPhotos() {
  if (!photoMeta.checkins.length) return toast("Nothing to export yet.");
  if (!await askConfirm("Warning: anyone who has this file can see your photos.\n\nIt is saved on this phone only. Keep it private and never upload or send it.", "Export", "Cancel")) return;
  const enc = new TextEncoder(), files = [], info = [];
  for (const c of sorted().reverse()) {
    const f = {};
    for (const [pose] of POSES) {
      const rec = c.photos[pose] && await getPhoto(c.photos[pose]);
      if (!rec) continue;
      f[pose] = "photos/checkin-" + c.n + "-" + pose + ".jpg";
      files.push({ name: f[pose], bytes: new Uint8Array(rec.full) });
    }
    info.push({ id: c.id, n: c.n, date: c.date, note: c.note, feel: c.feel, weight: c.weight, waist: c.waist, chest: c.chest, arms: c.arms, stats: c.stats, files: f });
  }
  files.unshift({ name: "checkins.json", bytes: enc.encode(JSON.stringify({ app: "workout-photos", version: 1, checkins: info }, null, 1)) });
  files.unshift({ name: "README.txt", bytes: enc.encode("PRIVATE progress photos from your workout app.\nAnyone with this file can see them. Keep it private; don't upload or share it.\n") });
  const url = URL.createObjectURL(makeZip(files)), a = document.createElement("a");
  a.href = url; a.download = "workout-photos-" + todayKey() + ".zip";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast("Saved to this phone. Keep it private.");
}

async function makeThumb(bytes) {
  const bmp = await loadBitmap(new Blob([bytes], { type: "image/jpeg" }));
  const t = await canvasJpeg(bmp, bmp.width || bmp.naturalWidth, bmp.height || bmp.naturalHeight, 320, 0.7);
  if (bmp.close) bmp.close();
  return t.arrayBuffer();
}

async function restorePhotos(file) {
  if (!file) return;
  try {
    const entries = readZip(await file.arrayBuffer());
    const byName = {};
    entries.forEach(e => { byName[e.name] = e.bytes; });
    const meta = JSON.parse(new TextDecoder().decode(byName["checkins.json"] || new Uint8Array()));
    if (!meta || meta.app !== "workout-photos" || !Array.isArray(meta.checkins)) throw new Error("That isn't a photo backup from this app.");
    if (!await askConfirm("Add the check-ins in this file to this phone? Nothing you have now is replaced.", "Add", "Cancel")) return;
    let added = 0;
    for (const m of meta.checkins) {
      const id = cleanId(m.id);
      if (findCheckin(id) || !DATE_KEY.test(m.date)) continue;
      const photos = {};
      for (const [pose] of POSES) {
        const bytes = m.files && byName[m.files[pose]];
        if (!bytes || bytes.length < 4 || bytes.length > 8e6 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) continue;
        const full = bytes.slice().buffer;
        await putPhoto({ id: id + "-" + pose, checkin: id, pose: pose, full: full, thumb: await makeThumb(bytes) });
        photos[pose] = id + "-" + pose;
      }
      const n = Number.isInteger(m.n) && m.n > 0 && !photoMeta.checkins.some(c => c.n === m.n) ? m.n : photoMeta.nextNumber;
      const num = v => cleanNum(v === null || v === undefined ? "" : String(v));
      const st = m.stats && typeof m.stats === "object" ? { workouts: Number(m.stats.workouts) || 0, squat: num(m.stats.squat), bench: num(m.stats.bench), row: num(m.stats.row) } : null;
      photoMeta.checkins.push({ id: id, n: n, date: m.date, note: String(m.note || "").slice(0, 200), feel: FEELS.includes(m.feel) ? m.feel : "",
        weight: num(m.weight), waist: num(m.waist), chest: num(m.chest), arms: num(m.arms), stats: st, photos: photos });
      photoMeta.nextNumber = Math.max(photoMeta.nextNumber, n + 1);
      added++;
    }
    savePhotoMeta();
    toast(added ? "Added " + added + " check-in" + (added === 1 ? "" : "s") + "." : "Nothing new in that file.");
  } catch (e) { toast(e && e.message ? e.message : "Couldn't read that file."); }
  renderPhotos(true);
}

async function wipeAll() {
  const answer = await askText("This deletes EVERY photo and check-in on this phone and can't be undone.\n\nType DELETE to confirm.", "", "Delete all");
  if (answer === null) return;
  if (String(answer).trim().toUpperCase() !== "DELETE") return toast("Nothing was deleted.");
  await clearPhotos().catch(() => {});
  photoMeta.checkins = [];
  photoMeta.nextNumber = 1;
  savePhotoMeta();
  revealed.clear();
  pv = { view: "grid", id: null };
  toast("All photos deleted.");
  renderPhotos();
}

async function handlePin(action) {
  const val = id => (document.getElementById(id) || {}).value || "";
  if (action === "set" || action === "remove") { pinForm = action; pinMsg = ""; return renderPhotos(true); }
  if (action === "cancel") { pinForm = null; pinMsg = ""; return renderPhotos(true); }
  try {
    if (photoMeta.pin && !(await pinMatches(val("pin0")))) { pinMsg = "That isn't your current PIN."; return renderPhotos(true); }
    if (pinForm === "remove") { photoMeta.pin = null; toast("PIN removed."); }
    else {
      const p = val("pin1");
      if (!/^\d{4}$/.test(p)) { pinMsg = "Use exactly 4 digits."; return renderPhotos(true); }
      if (p !== val("pin2")) { pinMsg = "The two PINs don't match."; return renderPhotos(true); }
      photoMeta.pin = await makePinRecord(p);
      toast("PIN saved.");
    }
    savePhotoMeta();
    pinForm = null; pinMsg = "";
  } catch (e) { pinMsg = e && e.message ? e.message : "Couldn't save the PIN."; }
  renderPhotos(true);
}

async function tryUnlock() {
  const input = document.getElementById("ph-pin");
  if (Date.now() < pinLockUntil) { pinMsg = "Too many tries. Wait " + Math.ceil((pinLockUntil - Date.now()) / 1000) + " seconds."; return renderPhotos(); }
  try {
    if (await pinMatches(input ? input.value : "")) { unlocked = true; pinFails = 0; pinMsg = ""; }
    else { pinFails++; pinMsg = "Wrong PIN."; if (pinFails >= 5) { pinLockUntil = Date.now() + 30000; pinFails = 0; pinMsg = "Too many tries. Wait 30 seconds."; } }
  } catch (e) { pinMsg = e && e.message ? e.message : "Couldn't check the PIN."; }
  renderPhotos();
}

// ---------- taps ----------
screenPhotos.addEventListener("click", async e => {
  const t = e.target.closest("button, label, [data-ph-reveal]");
  if (!t) return;
  const d = t.dataset;
  if (t.tagName === "LABEL") { filePickAt = Date.now(); return; }
  if (d.historyTab) { historyTab = d.historyTab; return showScreen("history"); }
  if (d.phReveal) { revealed.add(d.phReveal); return renderPhotos(true); }
  if (d.phIntro) { photoMeta.introSeen = true; savePhotoMeta(); keepPhotosSafe(); return renderPhotos(); }
  if (d.phUnlock) return tryUnlock();
  if (d.ph) {
    if (d.ph === "new" && !ciDraft) ciDraft = freshCiDraft();
    pv = { view: d.ph, id: null };
    if (d.ph !== "new") ciDraft = null;
    pinForm = null; pinMsg = "";
    renderPhotos();
    return window.scrollTo(0, 0);
  }
  if (d.phOpen) { pv = { view: "detail", id: d.phOpen }; renderPhotos(); return window.scrollTo(0, 0); }
  if (d.phGhost) { ciDraft.ghost[d.phGhost] = ciDraft.ghost[d.phGhost] === false; return renderPhotos(true); }
  if (d.phClear) { delete ciDraft.shots[d.phClear]; return renderPhotos(true); }
  if (d.phFeel) { ciDraft.feel = ciDraft.feel === d.phFeel ? "" : d.phFeel; return renderPhotos(true); }
  if (d.phSave) return saveDraft();
  if (d.phCancel) {
    if (Object.keys(ciDraft.shots).length && !await askConfirm("Discard this check-in and its photos?", "Discard")) return;
    ciDraft = null; pv = { view: "grid", id: null }; return renderPhotos();
  }
  if (d.phDelete) return deleteCheckin(d.phDelete);
  if (d.phPose) { cmp.pose = d.phPose; return renderPhotos(true); }
  if (d.phMode) { cmp.mode = d.phMode; return renderPhotos(true); }
  if (d.phTl) { timelinePose = d.phTl; return renderPhotos(true); }
  if (d.phHide) { photoMeta.hide = !photoMeta.hide; revealed.clear(); savePhotoMeta(); return renderPhotos(true); }
  if (d.phPin) return handlePin(d.phPin);
  if (d.phExport) return exportPhotos();
  if (d.phWipe) return wipeAll();
});

screenPhotos.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.shot) { const f = el.files && el.files[0]; el.value = ""; return takeShot(el.dataset.shot, f); }
  if (el.id === "ph-restore") { const f = el.files && el.files[0]; el.value = ""; return restorePhotos(f); }
  if (el.id === "cmp-a") { cmp.a = el.value; return renderPhotos(true); }
  if (el.id === "cmp-b") { cmp.b = el.value; return renderPhotos(true); }
  if (ciDraft && el.dataset.f) ciDraft[el.dataset.f] = el.value;
});

screenPhotos.addEventListener("input", e => {
  const el = e.target;
  if (ciDraft && el.dataset.f) ciDraft[el.dataset.f] = el.value;
  if (el.id === "cmp-range") setSlider(Number(el.value));
});

screenPhotos.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.id === "ph-pin") tryUnlock();
});

function setSlider(pos) {
  cmp.pos = Math.max(0, Math.min(100, pos));
  const top = document.getElementById("cmp-top"), line = document.getElementById("cmp-line"), range = document.getElementById("cmp-range");
  if (top) top.style.clipPath = "inset(0 0 0 " + cmp.pos + "%)";
  if (line) line.style.left = cmp.pos + "%";
  if (range) range.value = cmp.pos;
}

// Drag a finger across the picture to swipe between the two photos
let dragging = false;
function dragTo(e) {
  const box = document.getElementById("cmp");
  if (!dragging || !box) return;
  const r = box.getBoundingClientRect();
  setSlider((e.clientX - r.left) / r.width * 100);
}
screenPhotos.addEventListener("pointerdown", e => { if (e.target.closest("#cmp")) { dragging = true; dragTo(e); } });
window.addEventListener("pointermove", dragTo);
window.addEventListener("pointerup", () => { dragging = false; });
window.addEventListener("pointercancel", () => { dragging = false; });

// ---------- hide photos when the app goes to the background ----------
// (A web page can't stop screenshots, and iPhone may still take its own app-switcher picture. This covers the screen as early as it can.)
function coverNow() {
  if (screenPhotos.hidden) return;
  privacyCover.hidden = false;
  if (Date.now() - filePickAt > 120000) { unlocked = false; revealed.clear(); }
}
function uncover() {
  privacyCover.hidden = true;
  if (!screenPhotos.hidden && !rendering) renderPhotos(true);
}
document.addEventListener("visibilitychange", () => { document.hidden ? coverNow() : uncover(); });
window.addEventListener("pagehide", coverNow);
window.addEventListener("pageshow", uncover);
privacyCover.addEventListener("click", uncover);
