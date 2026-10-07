// online.js — the online side: accounts, talking to Supabase, and sending your totals / shared workouts.
// Everything online is optional. Your workout data stays on your phone either way.
//
// Your login is saved under its own key (not inside the workout data), so "Export my data" never contains it.

const SESSION_KEY = "workout-online-session";
const QUEUE_KEY = "workout-online-queue"; // shared workouts that could not be sent yet (for example, no internet)

class OnlineError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function onlineReady() {
  return !!(ONLINE_CONFIG.url && ONLINE_CONFIG.key);
}

// ---------- Your login ----------
function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}
function writeJson(key, value) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

let session = readJson(SESSION_KEY); // { access_token, refresh_token, expires_at, user_id, nickname, backfilled }
function signedIn() { return !!(session && session.access_token); }
function saveSession(s) { session = s; writeJson(SESSION_KEY, s); }

// ---------- Talking to Supabase ----------
let refreshing = null;
async function refreshIfNeeded() {
  if (!session || session.expires_at - Date.now() / 1000 > 60) return;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const r = await rawFetch("/auth/v1/token?grant_type=refresh_token", "POST", { refresh_token: session.refresh_token }, ONLINE_CONFIG.key);
        saveSession(Object.assign({}, session, sessionFrom(r)));
      } catch (e) {
        if (e.code !== "offline") saveSession(null); // the login ran out: sign in again
      }
    })().finally(() => { refreshing = null; });
  }
  await refreshing;
}

function sessionFrom(r) {
  return { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at || Math.floor(Date.now() / 1000) + (r.expires_in || 3600) };
}

async function rawFetch(path, method, body, token, extraHeaders) {
  let res;
  try {
    res = await fetch(ONLINE_CONFIG.url + path, {
      method: method,
      headers: Object.assign({ apikey: ONLINE_CONFIG.key, Authorization: "Bearer " + token, "Content-Type": "application/json" }, extraHeaders || {}),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new OnlineError("offline", "Can't reach the online service. Check your internet. (Online features only work from your GitHub Pages link, not the claude.ai preview.)");
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) {}
  if (!res.ok) {
    const message = (json && (json.msg || json.message || json.error_description || json.error)) || res.statusText || "Something went wrong";
    throw new OnlineError(json && json.code ? String(json.code) : "http_" + res.status, String(message));
  }
  return json;
}

async function api(path, method, body, extraHeaders) {
  await refreshIfNeeded();
  if (!signedIn()) throw new OnlineError("signed_out", "Please sign in again.");
  return rawFetch(path, method || "GET", body, session.access_token, extraHeaders);
}

const rest = path => api("/rest/v1/" + path);
const rpc = (fn, args) => api("/rest/v1/rpc/" + fn, "POST", args || {});

// ---------- Accounts ----------
const NICKNAME = /^[A-Za-z0-9_]{3,20}$/;

function accountEmail(nick) {
  return nick.toLowerCase() + "@" + ONLINE_CONFIG.emailDomain;
}

function checkCredentials(nick, password) {
  if (!NICKNAME.test(nick)) throw new OnlineError("bad_nick", "Nicknames are 3-20 letters, numbers or underscores.");
  if (!password || password.length < 8) throw new OnlineError("bad_password", "Use a password with at least 8 characters.");
}

async function signUp(nick, password) {
  checkCredentials(nick, password);
  let r;
  try {
    r = await rawFetch("/auth/v1/signup", "POST", { email: accountEmail(nick), password: password }, ONLINE_CONFIG.key);
  } catch (e) {
    if (/already|registered|exists/i.test(e.message + e.code)) throw new OnlineError("taken", "That nickname is taken. Pick another one.");
    if (/invalid/i.test(e.message + e.code) && /email/i.test(e.message + e.code)) {
      throw new OnlineError("email_rejected", "The online service didn't accept this nickname's login address (" + e.message + "). Tell whoever set this up.");
    }
    throw e;
  }
  if (!r || !r.access_token) {
    throw new OnlineError("confirm_on", "The online service still wants email confirmation. Whoever set it up needs to turn 'Confirm email' off.");
  }
  saveSession(Object.assign(sessionFrom(r), { user_id: r.user.id, nickname: nick }));
  const result = await rpc("create_profile", { nick: nick });
  if (result !== "ok") {
    await rpc("delete_my_account").catch(() => {});
    saveSession(null);
    throw new OnlineError("taken", result === "taken" ? "That nickname is taken. Pick another one." : "That nickname isn't allowed.");
  }
  myProfile = null;
}

async function signIn(nick, password) {
  checkCredentials(nick, password);
  let r;
  try {
    r = await rawFetch("/auth/v1/token?grant_type=password", "POST", { email: accountEmail(nick), password: password }, ONLINE_CONFIG.key);
  } catch (e) {
    if (/invalid|credentials|grant/i.test(e.message + e.code)) throw new OnlineError("bad_login", "Wrong nickname or password.");
    throw e;
  }
  saveSession(Object.assign(sessionFrom(r), { user_id: r.user.id, nickname: nick }));
  // An account whose nickname step never finished (lost connection while signing up): finish it now
  const rows = await rest("profiles?select=id&id=eq." + encodeURIComponent(session.user_id));
  if (!rows.length) await rpc("create_profile", { nick: nick });
  myProfile = null;
}

function signOut() {
  saveSession(null);
  myProfile = null;
}

async function deleteMyOnlineAccount() {
  await rpc("delete_my_account");
  saveSession(null);
  writeJson(QUEUE_KEY, null);
  myProfile = null;
}

// ---------- My profile (friend code and sharing switches) ----------
let myProfile = null;
async function getMyProfile(force) {
  if (myProfile && !force) return myProfile;
  const rows = await rest("profiles?select=id,nickname,friend_code,share_workouts,share_stats&id=eq." + encodeURIComponent(session.user_id));
  myProfile = rows[0] || null;
  return myProfile;
}

async function setSharing(changes) {
  await api("/rest/v1/profiles?id=eq." + encodeURIComponent(session.user_id), "PATCH", changes, { Prefer: "return=minimal" });
  myProfile = Object.assign({}, await getMyProfile(), changes);
  if (changes.share_stats) { await syncStats(!session.backfilled); }
}

// ---------- Sending my totals ----------
function mondayOf(dateKeyText) {
  return mondayKey(new Date(dateKeyText + "T00:00:00"));
}

function weekRange(mondayText) {
  const start = new Date(mondayText + "T00:00:00");
  return [mondayText, dateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6))];
}

let oldDatabase = false; // true if the online database doesn't have the "floors" update yet

async function sendWeek(mondayText) {
  const [from, to] = weekRange(mondayText);
  const s = computeStats(from, to);
  const args = {
    p_week: mondayText, p_lbs: Math.round(s.lbs), p_workouts: s.workouts, p_sets: s.sets,
    p_ran: Math.round(s.run * 10) / 10, p_biked: Math.round(s.bike * 10) / 10, p_walked: Math.round(s.walk * 10) / 10,
    p_feet: Math.round(s.climb), p_minutes: Math.round(s.cardioMin),
  };
  if (!oldDatabase) {
    try {
      await rpc("save_week_stats", Object.assign({ p_floors: Math.round(s.floors) }, args));
      return s;
    } catch (e) {
      if (!/PGRST202|could not find the function|does not exist/i.test(e.code + " " + e.message)) throw e;
      oldDatabase = true; // not updated yet: use the older version (floors just won't show on the board)
    }
  }
  await rpc("save_week_stats", args);
  return s;
}

// all = true: every week that has anything in it (the first time). Otherwise just this week and last week.
async function syncStats(all) {
  const thisMonday = mondayKey(new Date());
  const weeks = new Set([thisMonday]);
  const last = new Date(thisMonday + "T00:00:00"); last.setDate(last.getDate() - 7);
  weeks.add(dateKey(last));
  if (all) {
    const dates = allWorkouts().filter(w => w.exercises.some(ex => ex.sets.some(s => s.done))).map(w => w.date).concat(data.cardio.map(c => c.date));
    dates.forEach(d => { if (d >= dateKey(new Date(Date.now() - 700 * 86400000))) weeks.add(mondayOf(d)); });
  }
  for (const w of [...weeks].sort()) {
    const always = !all || w === thisMonday || w === dateKey(last); // this and last week are always refreshed
    if (always || hasAnythingIn(w)) await sendWeek(w);
  }
  if (all) saveSession(Object.assign({}, session, { backfilled: true }));
}

function hasAnythingIn(mondayText) {
  const [from, to] = weekRange(mondayText);
  const s = computeStats(from, to);
  return s.sets > 0 || s.cardioMin > 0 || s.run + s.bike + s.walk > 0;
}

// ---------- Sharing a finished workout ----------
function sharePayload(w) {
  const exercises = w.exercises.filter(ex => ex.sets.some(s => s.done)).slice(0, 30).map(ex => {
    const known = allExercises().find(e => e.name === ex.name) || {};
    return {
      name: ex.name, muscle: ex.muscle || known.muscle || "Other", equipment: ex.equipment || known.equipment || "Other",
      sets: ex.sets.filter(s => s.done).slice(0, 20).map(s => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0, failure: !!s.failure })),
    };
  });
  return { p_local_id: String(w.id), p_name: String(w.name || "Workout").slice(0, 40), p_date: w.date, p_minutes: Number(w.minutes) || 0, p_exercises: exercises };
}

async function shareWorkout(w) {
  const payload = sharePayload(w);
  if (!payload.p_exercises.length) return;
  await rpc("share_workout", payload);
}

function queueWorkout(id) {
  const q = readJson(QUEUE_KEY) || { workouts: [] };
  if (!q.workouts.includes(id)) q.workouts.push(id);
  writeJson(QUEUE_KEY, q);
}

async function flushWorkoutQueue() {
  const q = readJson(QUEUE_KEY);
  if (!q || !q.workouts.length) return;
  const left = [];
  for (const id of q.workouts) {
    const w = allWorkouts().find(x => String(x.id) === id);
    if (!w) continue;
    try { await shareWorkout(w); } catch (e) { if (e.code === "offline") left.push(id); }
  }
  writeJson(QUEUE_KEY, left.length ? { workouts: left } : null);
}

// Called when you finish a workout: share it if sharing is on (or remember to, if you're offline)
async function onWorkoutFinished(finished) {
  if (!signedIn() || !onlineReady()) return;
  try {
    const me = await getMyProfile();
    if (me && me.share_workouts) await shareWorkout(finished);
  } catch (e) {
    if (e.code === "offline") queueWorkout(String(finished.id));
  }
}

// ---------- Keeping things up to date ----------
let syncTimer = null;
function queueOnlineSync() { // call after anything that changes your totals; sends a few seconds later
  if (!signedIn() || !onlineReady()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, 2500);
}

async function syncNow() {
  if (!signedIn() || !onlineReady()) return;
  try {
    const me = await getMyProfile(true);
    if (!me) return;
    if (me.share_stats) await syncStats(!session.backfilled);
    if (me.share_workouts) await flushWorkoutQueue();
  } catch (e) {
    // offline or a hiccup: the next change, or the next time you open the app, sends it
  }
}
