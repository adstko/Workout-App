// timer.js — rest timer. Starts when you tick a set as done.
// Used by the Push/Pull/Legs screen (bar at the bottom) and by the exercise screen
// of the "+" flow (big clock at the top, element #rest-top inside #rest-card).

const timerBar = document.getElementById("timer");
const timerText = document.getElementById("timer-text");
let timerEnd = 0;       // the clock time (ms) when rest is over
let timerId = null;
let timerOn = false;    // true while counting down
let audioCtx = null;

function startTimer(seconds) {
  // Create the audio object here, because browsers only allow sound after a tap
  try { audioCtx = audioCtx || new AudioContext(); audioCtx.resume(); } catch (e) {}
  timerEnd = Date.now() + (seconds || data.restSeconds) * 1000;
  runTimer();
}

function runTimer() {
  timerOn = true;
  timerBar.hidden = false;
  timerBar.classList.remove("finished");
  clearInterval(timerId);
  timerId = setInterval(tickTimer, 250);
  tickTimer();
}

function tickTimer() {
  const left = Math.ceil((timerEnd - Date.now()) / 1000);
  const top = document.getElementById("rest-top");
  const card = document.getElementById("rest-card");
  if (left <= 0) {
    clearInterval(timerId);
    timerOn = false;
    timerText.textContent = "Go! 💪";
    timerBar.classList.add("finished");
    if (top) { top.textContent = "00:00"; card.classList.add("finished"); }
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    beep();
    return;
  }
  timerText.textContent = "Rest " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
  if (top) { top.textContent = fmtClock(left); card.classList.remove("finished"); }
}

function beep() {
  try {
    const osc = audioCtx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (e) {}
}

// Add or remove seconds while the timer is running
function adjustTimer(seconds) {
  if (!timerOn) return;
  timerEnd += seconds * 1000;
  tickTimer();
}

function stopTimer() {
  clearInterval(timerId);
  timerOn = false;
  timerBar.hidden = true;
  const top = document.getElementById("rest-top");
  if (top) {
    top.textContent = fmtClock(data.customRest); // back to the default length
    document.getElementById("rest-card").classList.remove("finished");
  }
}

document.getElementById("timer-add").addEventListener("click", () => {
  timerEnd = Math.max(timerEnd, Date.now()) + 15000;
  runTimer();
});

document.getElementById("timer-stop").addEventListener("click", stopTimer);
