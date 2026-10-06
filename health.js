// health.js — send a finished workout to Apple Health through an iOS Shortcut.
// The button opens the Shortcut (shortcuts://run-shortcut) and hands it a little JSON text:
//   { "type": "Walking", "minutes": 25, "start": "2026-10-06T18:00:00.000Z", "name": "Incline walk" }
// The Shortcut's "Log Workout" action then writes it into Health. This only works on an iPhone.

// Open a link. (The tests replace this so they can see the link instead of leaving the page.)
function openUrl(url) {
  window.location.href = url;
}

function openShortcut(payload) {
  const url = "shortcuts://run-shortcut?name=" + encodeURIComponent(data.shortcutName || "Log Workout to Health") +
    "&input=text&text=" + encodeURIComponent(JSON.stringify(payload));
  toast("Opening Shortcuts...");
  openUrl(url);
}

// When did a workout start? Today: "minutes ago". An earlier day: noon that day.
function guessStart(dateKeyText, minutes) {
  if (dateKeyText === todayKey()) return new Date(Date.now() - minutes * 60000);
  return new Date(dateKeyText + "T12:00:00");
}

// A lifting workout (from History)
async function sendWorkoutToHealth(id) {
  const w = allWorkouts().find(x => x.id === id);
  let minutes = w.minutes;
  if (!minutes) { // workouts from the Push/Pull/Legs screen don't track how long they took
    const answer = await askText("How many minutes was this workout?", "45", "Send");
    if (answer === null) return;
    minutes = Math.round(Number(answer));
    if (!(minutes > 0)) return toast("Type a number of minutes.");
  }
  const start = w.startedAt ? new Date(w.startedAt) : guessStart(w.date, minutes);
  openShortcut({ type: WEIGHTS_HEALTH_TYPE, minutes: minutes, start: start.toISOString(), name: w.name });
}

// A cardio entry (from the Cardio screen): the Health type follows the cardio type you picked
function sendCardioToHealth(id) {
  const c = data.cardio.find(x => x.id === id);
  if (!healthTypeFor(c.type)) return; // golf is already logged by 18Birdies
  const start = guessStart(c.date, c.minutes);
  openShortcut({ type: healthTypeFor(c.type), minutes: c.minutes, start: start.toISOString(), name: c.type });
}
