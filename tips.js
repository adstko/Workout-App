// tips.js — a short, friendly tips screen for the recomp goal (build muscle, stay about the same weight)

const screenTips = document.getElementById("screen-tips");

const TIPS = [
  ["Lift challenging weights", "Strength training tells your body to keep and build muscle. Pick weights that feel hard by the last reps but keep your form clean, in the 6-15 rep range. When you hit the top of the range on every set, add a little weight. Never test a max."],
  ["Do cardio 3-4 times a week", "Mostly easy to moderate, where you could still talk, plus your interval day. It's good for your heart and helps you recover between lifting days."],
  ["Sleep 8-9 hours", "Sleep is when your muscles recover and grow. Good sleep makes every workout better."],
  ["Eat enough protein at each meal", "Things like eggs, chicken, fish, beans, yogurt or milk. Regular meals matter too. Your body needs fuel to build muscle, so don't skip meals."],
  ["Be patient", "Changes show up over 2-3 months, not days. Your lifts usually go up before anything else changes, so watch your numbers on the Progress tab."],
];

function renderTips() {
  screenTips.innerHTML = `<div class="topbar"><button id="tips-back" aria-label="Back">‹</button><h1>Recomp tips</h1></div>
    <p class="muted">Recomp means building muscle while your body weight stays about the same.</p>` +
    TIPS.map(([title, text], i) => `<div class="card"><h3>${i + 1}. ${esc(title)}</h3><p class="muted" style="font-size:17px">${esc(text)}</p></div>`).join("") +
    `<div class="card"><p class="muted" style="font-size:17px">Stop if something hurts. If you ever have questions about food, training or how you feel about your body, talk to a parent, a coach or a doctor.</p></div>`;
}

screenTips.addEventListener("click", e => {
  if (e.target.closest("#tips-back")) showScreen("workouts");
});
