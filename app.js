// app.js — switches between the screens and handles the bottom tab bar

const screens = {
  today: screenToday, workouts: screenWorkouts, workout: screenWorkout, picker: screenPicker,
  exercise: screenExercise, cardio: screenCardio, history: screenHistory,
};
const renderers = {
  today: renderToday, workouts: renderWorkouts, workout: renderWorkout, picker: renderPicker,
  exercise: renderExercise, cardio: renderCardio, history: renderHistory,
};

function showScreen(name) {
  clearInterval(elapsedId); // the workout clock only runs while its screen is open
  for (const key in screens) screens[key].hidden = key !== name;
  document.querySelectorAll("nav button[data-screen]").forEach(b => b.classList.toggle("active", b.dataset.screen === name));
  document.body.classList.toggle("in-exercise", name === "exercise");
  renderers[name](); // redraw so the screen always shows fresh data
  window.scrollTo(0, 0);
}

// A short message at the bottom of the screen
function toast(text) {
  const box = document.getElementById("toast");
  box.textContent = text;
  box.hidden = false;
  clearTimeout(toast.id);
  toast.id = setTimeout(() => { box.hidden = true; }, 2200);
}

document.querySelector("nav").addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.id === "new-workout") startWorkout(); // the big "+"
  else {
    if (btn.dataset.screen === "today") viewKey = null; // the Today tab always opens on today
    showScreen(btn.dataset.screen);
  }
});

// If the app is left open past midnight, redraw the Today screen on the new day (so the week bar moves on).
// Other screens are left alone so nothing you're typing gets wiped.
let shownDay = todayKey();
function checkNewDay() {
  if (todayKey() === shownDay) return;
  shownDay = todayKey();
  viewKey = null;
  if (!screenToday.hidden) renderToday();
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkNewDay(); });
setInterval(checkNewDay, 60000);

seedPresets(); // add the starter presets on first launch
showScreen("today");
