// timer.js — rest timer. Starts when you tick a set as done.

const timerBar = document.getElementById("timer");
const timerText = document.getElementById("timer-text");
let timerEnd = 0;       // the clock time (ms) when rest is over
let timerId = null;
let audioCtx = null;

function startTimer() {
  // Create the audio object here, because browsers only allow sound after a tap
  try { audioCtx = audioCtx || new AudioContext(); audioCtx.resume(); } catch (e) {}
  timerEnd = Date.now() + data.restSeconds * 1000;
  runTimer();
}

function runTimer() {
  timerBar.hidden = false;
  timerBar.classList.remove("finished");
  clearInterval(timerId);
  timerId = setInterval(tickTimer, 250);
  tickTimer();
}

function tickTimer() {
  const left = Math.ceil((timerEnd - Date.now()) / 1000);
  if (left <= 0) {
    clearInterval(timerId);
    timerText.textContent = "Go! 💪";
    timerBar.classList.add("finished");
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    beep();
    return;
  }
  timerText.textContent = "Rest " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
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

document.getElementById("timer-add").addEventListener("click", () => {
  timerEnd = Math.max(timerEnd, Date.now()) + 15000;
  runTimer();
});

document.getElementById("timer-stop").addEventListener("click", () => {
  clearInterval(timerId);
  timerBar.hidden = true;
});
