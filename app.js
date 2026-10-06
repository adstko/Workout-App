// app.js — switches between the three screens using the bottom tab bar

const screens = { today: screenToday, cardio: screenCardio, history: screenHistory };
const renderers = { today: renderToday, cardio: renderCardio, history: renderHistory };

function showScreen(name) {
  for (const key in screens) screens[key].hidden = key !== name;
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("active", b.dataset.screen === name));
  renderers[name](); // redraw so the screen always shows fresh data
  window.scrollTo(0, 0);
}

document.querySelector("nav").addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (btn) showScreen(btn.dataset.screen);
});

showScreen("today");
