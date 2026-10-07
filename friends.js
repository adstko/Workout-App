// friends.js — the Friends tab (on the History screen): sign in, leaderboard, friends' workouts, friend codes.
// Whatever comes from other people is treated as untrusted text: it is escaped before it goes on the page.

let friendsView = "board";    // "board", "feed", "friends" or "me"
let boardMetric = "lbs";      // "lbs", "ran", "workouts" or "miles"
let boardPeriod = "week";     // "week" or "all"
let fr = { loaded: false, loading: false, error: "", at: 0, profiles: [], friendships: [], stats: [], feed: [] };

const METRICS = {
  lbs: { label: "Lbs lifted", unit: "lbs", value: r => r.lbs },
  ran: { label: "Miles ran", unit: "mi", value: r => r.ran },
  workouts: { label: "Workouts", unit: "", value: r => r.workouts },
  miles: { label: "All miles", unit: "mi", value: r => r.ran + r.biked + r.walked },
};

// ---------- Loading everything from the online service ----------
async function loadFriends() {
  if (!signedIn()) return;
  if (fr.loading) { fr.again = true; return; } // something changed while loading: load once more when this one ends
  fr.loading = true;
  try {
    await syncNow(); // make sure my own numbers are up to date first
    const [profiles, friendships, stats, feed] = await Promise.all([
      rest("profiles?select=id,nickname,friend_code,share_workouts,share_stats"),
      rest("friendships?select=id,status,requester,addressee,created_at&order=created_at.desc"),
      rest("weekly_stats?select=owner,week_start,lbs_lifted,workouts,sets,miles_ran,miles_biked,miles_walked,feet_climbed,cardio_minutes,profiles(nickname)&limit=1000"),
      rest("shared_workouts?select=id,owner,name,workout_date,minutes,exercises,profiles(nickname)&order=workout_date.desc,created_at.desc&limit=40"),
    ]);
    fr = Object.assign(fr, { profiles: profiles, friendships: friendships, stats: stats, feed: feed, loaded: true, error: "", at: Date.now() });
    myProfile = profiles.find(p => p.id === session.user_id) || myProfile;
  } catch (e) {
    fr.error = e.message;
  }
  fr.loading = false;
  if (fr.again) { fr.again = false; return loadFriends(); }
  if (historyTab === "friends" && !screenHistory.hidden) redrawKeepingInput();
}

// Redraw the screen without wiping what you are typing (or closing your keyboard) if a refresh finishes at that moment
function redrawKeepingInput() {
  const typed = [...screenHistory.querySelectorAll("input[id]")].map(el => ({
    id: el.id, value: el.value, focused: el === document.activeElement, start: el.selectionStart, end: el.selectionEnd }));
  renderHistory();
  typed.forEach(t => {
    const el = document.getElementById(t.id);
    if (!el) return;
    el.value = t.value;
    if (t.focused) { el.focus(); try { el.setSelectionRange(t.start, t.end); } catch (e) {} }
  });
}

function ensureFriendsLoaded() {
  if (signedIn() && !fr.loaded && !fr.loading) loadFriends();
}

function nameOf(id) {
  const p = fr.profiles.find(x => x.id === id);
  return p ? p.nickname : "someone";
}

// ---------- Pieces of the screen ----------
function authHtml() {
  return `<div class="card stack">
    <p>Make a free account to compare with friends: a leaderboard, and a feed of the workouts they share.</p>
    <div><label for="auth-nick">Nickname</label>
      <input id="auth-nick" type="text" maxlength="20" autocapitalize="none" autocorrect="off" autocomplete="username" placeholder="3-20 letters, numbers, _"></div>
    <div><label for="auth-pass">Password</label>
      <input id="auth-pass" type="password" autocomplete="current-password" placeholder="at least 8 characters"></div>
    <div class="row"><button id="auth-signin">Sign in</button><button id="auth-signup" class="primary">Create account</button></div>
    <p id="auth-msg" class="muted" role="status"></p>
    <p class="muted">Use a nickname, not your real name. No email is needed. If you forget your password you'd make a new account. Your workout logs stay on your phone. Ask a parent before making an account.</p>
  </div>`;
}

function friendsTabs() {
  const incoming = fr.friendships.filter(f => f.status === "pending" && f.addressee === session.user_id).length;
  const tabs = [["board", "Board"], ["feed", "Feed"], ["friends", "Friends" + (incoming ? " (" + incoming + ")" : "")], ["me", "Me"]];
  return `<div class="row" style="margin-bottom:12px">` + tabs.map(([key, label]) =>
    `<button data-fr-view="${key}" class="${key === friendsView ? "on" : ""}">${label}</button>`).join("") + `</div>`;
}

// Add up a person's weekly rows for the chosen period
function boardRows() {
  const thisMonday = mondayKey(new Date());
  const byOwner = {};
  fr.stats.forEach(row => {
    if (boardPeriod === "week" && row.week_start !== thisMonday) return;
    const r = byOwner[row.owner] || (byOwner[row.owner] = { id: row.owner, name: row.profiles ? row.profiles.nickname : "someone", lbs: 0, ran: 0, biked: 0, walked: 0, workouts: 0 });
    r.lbs += Number(row.lbs_lifted) || 0; r.ran += Number(row.miles_ran) || 0; r.biked += Number(row.miles_biked) || 0;
    r.walked += Number(row.miles_walked) || 0; r.workouts += Number(row.workouts) || 0;
  });
  return Object.values(byOwner);
}

function boardHtml() {
  const m = METRICS[boardMetric];
  const rows = boardRows().sort((a, b) => m.value(b) - m.value(a));
  const top = Math.max(...rows.map(m.value), 1);
  let html = `<div class="row grid2" style="margin-bottom:8px">` + Object.entries(METRICS).map(([key, x]) =>
    `<button data-fr-metric="${key}" class="${key === boardMetric ? "on" : ""}">${x.label}</button>`).join("") + `</div>
    <div class="row" style="margin-bottom:12px">` + [["week", "This week"], ["all", "All time"]].map(([key, label]) =>
    `<button data-fr-period="${key}" class="${key === boardPeriod ? "on" : ""}">${label}</button>`).join("") + `</div>`;

  if (myProfile && !myProfile.share_stats) {
    html += `<div class="card"><b>You're not on the board yet.</b><div class="muted">Turn on "Share my stats" in the Me tab so friends can see your totals.</div></div>`;
  }
  if (!rows.length) {
    return html + `<p class="muted">Nothing to rank yet. Friends who turn on "Share my stats" show up here.</p>`;
  }
  html += rows.map((r, i) => {
    const v = m.value(r), shown = (Math.round(v * 10) / 10).toLocaleString();
    return `<div class="board-row ${r.id === session.user_id ? "me" : ""}">
      <span class="rank">${i + 1}</span>
      <div class="who"><b>${esc(r.name)}${r.id === session.user_id ? " (you)" : ""}</b>
        <div class="bar"><i style="width:${Math.max(2, Math.round(v / top * 100))}%"></i></div></div>
      <b class="val">${shown}<small> ${m.unit}</small></b></div>`;
  }).join("");
  return html + `<p class="muted">Totals come from what each person shares. They're self-reported.</p>`;
}

// "4 × 8 @ 100 lb" or a list when the sets differ
function setsText(sets) {
  const list = Array.isArray(sets) ? sets : [];
  if (!list.length) return "";
  const key = s => (Number(s.reps) || 0) + "@" + (Number(s.weight) || 0);
  if (list.every(s => key(s) === key(list[0]))) {
    const s = list[0];
    return list.length + " × " + (Number(s.reps) || 0) + (Number(s.weight) ? " @ " + Number(s.weight) + " lb" : "");
  }
  return list.map(s => (Number(s.weight) ? Number(s.weight) + "×" : "") + (Number(s.reps) || 0) + (s.failure ? " (failure)" : "")).join(", ");
}

function feedHtml() {
  const items = fr.feed.filter(w => w.owner !== session.user_id);
  if (!items.length) {
    return `<p class="muted">No shared workouts yet. When a friend turns on "Share my workouts" and finishes one, it shows up here, and you can copy it as a preset.</p>`;
  }
  return items.map(w => {
    const exs = (Array.isArray(w.exercises) ? w.exercises : []).slice(0, 30);
    return `<div class="card">
      <b>${esc(w.name)}</b> <span class="muted">· ${esc(w.profiles ? w.profiles.nickname : "someone")} · ${esc(prettyDate(String(w.workout_date)))}${w.minutes ? " · " + Number(w.minutes) + " min" : ""}</span>
      <div class="feed-list">${exs.map(ex => `<div><b>${esc(String(ex.name).slice(0, 60))}</b> <span class="muted">${esc(setsText(ex.sets))}</span></div>`).join("")}</div>
      <button class="big" data-copy-workout="${esc(w.id)}" style="margin-top:10px">Copy as preset</button>
    </div>`;
  }).join("");
}

function friendsListHtml() {
  const me = session.user_id;
  const incoming = fr.friendships.filter(f => f.status === "pending" && f.addressee === me);
  const outgoing = fr.friendships.filter(f => f.status === "pending" && f.requester === me);
  const friends = fr.friendships.filter(f => f.status === "accepted");
  let html = `<div class="card stack"><b>Add a friend</b>
      <div class="muted">Ask them for their friend code (in their Me tab) and type it here.</div>
      <input id="friend-code" type="text" maxlength="12" autocapitalize="characters" autocorrect="off" placeholder="Friend code, like K7PQ2ABC">
      <button id="friend-add" class="big primary">Send friend request</button></div>`;
  if (incoming.length) {
    html += `<h2>Requests for you</h2>` + incoming.map(f => `<div class="card entry"><div><b>${esc(nameOf(f.requester))}</b> wants to be friends</div>
      <div class="btns"><button class="primary" data-accept="${esc(f.id)}">Accept</button><button data-unfriend="${esc(f.id)}">Decline</button></div></div>`).join("");
  }
  if (outgoing.length) {
    html += `<h2>Waiting for them</h2>` + outgoing.map(f => `<div class="card entry"><div><b>${esc(nameOf(f.addressee))}</b><div class="muted">hasn't accepted yet</div></div>
      <div class="btns"><button data-unfriend="${esc(f.id)}">Cancel</button></div></div>`).join("");
  }
  html += `<h2>Your friends</h2>` + (friends.length ? friends.map(f => {
    const other = f.requester === me ? f.addressee : f.requester;
    const p = fr.profiles.find(x => x.id === other);
    return `<div class="card entry"><div><b>${esc(nameOf(other))}</b><div class="muted">${p && p.share_stats ? "shares stats" : "not sharing stats"}</div></div>
      <div class="btns"><button class="danger" data-unfriend="${esc(f.id)}" data-name="${esc(nameOf(other))}">Remove</button></div></div>`;
  }).join("") : `<p class="muted">No friends yet.</p>`);
  return html;
}

function meHtml() {
  const p = myProfile;
  if (!p) return `<p class="muted">Loading your account...</p>`;
  const sw = (key, title, text) => `<div class="card"><div class="entry"><div><b>${title}</b><div class="muted">${text}</div></div>
      <button data-share="${key}" class="${p[key] ? "on" : ""}" style="min-width:76px">${p[key] ? "On" : "Off"}</button></div></div>`;
  return `<div class="card"><div class="muted">Signed in as</div><h3>${esc(p.nickname)}</h3>
      <div class="muted" style="margin-top:10px">Your friend code</div>
      <div class="entry"><b class="clock" style="font-size:28px;letter-spacing:2px">${esc(p.friend_code)}</b><button id="copy-code">Copy</button></div>
      <div class="muted">Give this code to a friend so they can add you.</div></div>
    ${sw("share_stats", "Share my stats", "Friends can see your weekly totals (lbs lifted, miles, workouts) on the board.")}
    ${sw("share_workouts", "Share my workouts", "Friends can see the workouts you finish, and copy them as presets. Weights are shown; your notes are not.")}
    <p class="muted">Only accepted friends can see anything, and only what you turn on. Your logs stay on your phone.</p>
    <div class="stack"><button id="signout" class="big">Sign out</button>
      <button id="delete-online" class="big danger">Delete my online account</button></div>`;
}

// The whole Friends tab
function friendsHtml() {
  if (!onlineReady()) return `<div class="card"><p>Online features aren't set up in this copy of the app.</p></div>`;
  if (!signedIn()) return authHtml();
  if (!fr.loaded) {
    if (fr.error) return `<div class="card stack"><p>${esc(fr.error)}</p><button id="fr-retry" class="big">Try again</button><button id="signout" class="big">Sign out</button></div>`;
    return `<p class="muted">Loading...</p>`;
  }
  const views = { board: boardHtml, feed: feedHtml, friends: friendsListHtml, me: meHtml };
  return friendsTabs() + views[friendsView]() +
    (friendsView === "me" ? "" : `<button id="fr-refresh" class="big" style="margin-top:14px">Refresh</button>`) +
    (fr.error ? `<p class="muted">${esc(fr.error)}</p>` : "");
}

// ---------- Copy a friend's workout as one of my presets ----------
function copyAsPreset(workout) {
  const known = allExercises();
  const clamp = n => Math.min(15, Math.max(6, n)); // every set stays in the 6-15 rep range
  const items = (Array.isArray(workout.exercises) ? workout.exercises : []).slice(0, 30).map(ex => {
    const name = String(ex.name || "Exercise").slice(0, 60);
    const sets = (Array.isArray(ex.sets) ? ex.sets : []).slice(0, 20);
    const reps = sets.map(s => Number(s.reps) || 0).filter(n => n > 0);
    const have = known.find(k => k.name.toLowerCase() === name.toLowerCase());
    const muscle = have ? have.muscle : (MUSCLES.includes(ex.muscle) ? ex.muscle : "Other");
    const equipment = have ? have.equipment : (EQUIPMENT.includes(ex.equipment) ? ex.equipment : "Other");
    if (!have) data.customExercises.push({ name: name, muscle: muscle, equipment: equipment }); // so it appears in your exercise list
    const timed = TIMED.includes(name) || !reps.length;
    return { name: have ? have.name : name, muscle: muscle, equipment: equipment, sets: Math.min(10, Math.max(1, sets.length || 3)),
      minReps: timed ? null : clamp(Math.min(...reps)), maxReps: timed ? null : clamp(Math.max(...reps)), superset: null }; // no weights: you fill those in
  });
  if (!items.length) return toast("That workout has no exercises to copy.");
  newPreset((String(workout.name || "Workout").slice(0, 26) + " (" + (workout.profiles ? workout.profiles.nickname : "friend") + ")").slice(0, 40), items);
  toast("Copied to Workouts > Presets. Add your own weights when you start it.");
}

// ---------- Buttons and typing ----------
function authMessage(text) {
  const box = document.getElementById("auth-msg");
  if (box) box.textContent = text;
}

async function doAuth(isSignUp) {
  const nick = document.getElementById("auth-nick").value.trim();
  const pass = document.getElementById("auth-pass").value;
  authMessage(isSignUp ? "Creating your account..." : "Signing in...");
  try {
    if (isSignUp) await signUp(nick, pass); else await signIn(nick, pass);
    fr.loaded = false; fr.error = "";
    renderHistory();
    toast("Signed in as " + session.nickname);
  } catch (e) {
    authMessage(e.message);
  }
}

screenHistory.addEventListener("click", async e => {
  const t = e.target.closest("button");
  if (!t) return;
  const go = fn => fn().catch(err => toast(err.message));

  if (t.id === "auth-signin") return doAuth(false);
  if (t.id === "auth-signup") return doAuth(true);
  if (t.dataset.frView) { friendsView = t.dataset.frView; return renderHistory(); }
  if (t.dataset.frMetric) { boardMetric = t.dataset.frMetric; return renderHistory(); }
  if (t.dataset.frPeriod) { boardPeriod = t.dataset.frPeriod; return renderHistory(); }
  if (t.id === "fr-refresh" || t.id === "fr-retry") { fr.error = ""; return loadFriends(); }
  if (t.dataset.copyWorkout) {
    const w = fr.feed.find(x => String(x.id) === t.dataset.copyWorkout);
    if (w) copyAsPreset(w);
    return;
  }
  if (t.id === "friend-add") {
    const code = document.getElementById("friend-code").value.trim();
    if (!code) return toast("Type your friend's code first.");
    return go(async () => {
      const result = await rpc("request_friend", { code: code });
      const messages = { sent: "Request sent. They need to accept it.", not_found: "No one has that code. Check it and try again.", self: "That's your own code.",
        exists: "You're already connected, or a request is waiting.", slow_down: "Too many tries. Wait a bit and try again.", no_profile: "Finish making your account first." };
      toast(messages[result] || "Done.");
      await loadFriends();
    });
  }
  if (t.dataset.accept) return go(async () => { await rpc("accept_friend", { request_id: Number(t.dataset.accept) }); toast("You're friends now."); await loadFriends(); });
  if (t.dataset.unfriend) {
    const name = t.dataset.name;
    if (name && !(await askConfirm("Remove " + name + " from your friends? You won't see each other's stuff anymore.", "Remove"))) return;
    return go(async () => { await api("/rest/v1/friendships?id=eq." + encodeURIComponent(t.dataset.unfriend), "DELETE"); await loadFriends(); });
  }
  if (t.dataset.share) {
    const key = t.dataset.share;
    return go(async () => {
      await setSharing({ [key]: !myProfile[key] });
      toast(myProfile[key] ? "Sharing is on." : "Sharing is off.");
      await loadFriends();
    });
  }
  if (t.id === "copy-code") {
    try { await navigator.clipboard.writeText(myProfile.friend_code); toast("Code copied."); } catch (err) { toast("Your code is " + myProfile.friend_code); }
    return;
  }
  if (t.id === "signout") { signOut(); fr = { loaded: false, loading: false, error: "", at: 0, profiles: [], friendships: [], stats: [], feed: [] }; renderHistory(); return; }
  if (t.id === "delete-online") {
    if (!(await askConfirm("Delete your online account? Your nickname, friends, shared workouts and totals are removed from the online service. Your logs on this phone stay.", "Delete"))) return;
    return go(async () => { await deleteMyOnlineAccount(); fr = { loaded: false, loading: false, error: "", at: 0, profiles: [], friendships: [], stats: [], feed: [] }; toast("Online account deleted."); renderHistory(); });
  }
  // "Share" on a past workout in the History list
  if (t.dataset.shareWorkout) {
    if (!signedIn()) return toast("Sign in on the Friends tab first.");
    const w = allWorkouts().find(x => String(x.id) === t.dataset.shareWorkout);
    return go(async () => {
      await shareWorkout(w);
      const me = await getMyProfile();
      toast(me && me.share_workouts ? "Shared with your friends." : "Sent. Friends only see it after you turn on \"Share my workouts\" (Friends > Me).");
    });
  }
});

screenHistory.addEventListener("keydown", e => {
  if (e.key === "Enter" && (e.target.id === "auth-nick" || e.target.id === "auth-pass")) doAuth(false);
});

// Coming back to the app with the Friends tab open: refresh if it has been a while
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && signedIn()) {
    queueOnlineSync();
    if (historyTab === "friends" && !screenHistory.hidden && Date.now() - fr.at > 30000) loadFriends();
  }
});
