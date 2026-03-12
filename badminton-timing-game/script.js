const marker = document.getElementById("marker");
const scoreEl = document.getElementById("score");
const roundEl = document.getElementById("round");
const messageEl = document.getElementById("message");
const startBtn = document.getElementById("startBtn");
const hitBtn = document.getElementById("hitBtn");
const restartBtn = document.getElementById("restartBtn");
const timingBar = document.getElementById("timingBar");

let score = 0;
let round = 0;
let maxRounds = 10;

let markerPosition = 0;
let direction = 1;
let speed = 4;
let animationId = null;
let playing = false;
let roundActive = false;

function updateUI() {
  scoreEl.textContent = score;
  roundEl.textContent = round;
}

function moveMarker() {
  const barWidth = timingBar.clientWidth;
  const markerWidth = marker.clientWidth;

  markerPosition += speed * direction;

  if (markerPosition <= 0) {
    markerPosition = 0;
    direction = 1;
  } else if (markerPosition >= barWidth - markerWidth) {
    markerPosition = barWidth - markerWidth;
    direction = -1;
  }

  marker.style.left = `${markerPosition}px`;
  animationId = requestAnimationFrame(moveMarker);
}

function startRound() {
  if (round >= maxRounds) {
    endGame();
    return;
  }

  round++;
  roundActive = true;
  markerPosition = 0;
  direction = 1;
  messageEl.textContent = "Get ready... Hit at the right moment!";
  updateUI();

  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(moveMarker);
}

function evaluateHit() {
  if (!playing || !roundActive) return;

  roundActive = false;
  cancelAnimationFrame(animationId);

  const barWidth = timingBar.clientWidth;
  const markerCenter = markerPosition + marker.clientWidth / 2;
  const percent = (markerCenter / barWidth) * 100;

  if (percent >= 45 && percent <= 55) {
    score += 10;
    messageEl.textContent = "Perfect! Smash!";
  } else if ((percent >= 35 && percent < 45) || (percent > 55 && percent <= 65)) {
    score += 5;
    messageEl.textContent = "Good shot!";
  } else {
    messageEl.textContent = "Miss!";
  }

  updateUI();

  setTimeout(() => {
    startRound();
  }, 900);
}

function startGame() {
  if (playing) return;

  playing = true;
  score = 0;
  round = 0;
  updateUI();
  messageEl.textContent = "Game started!";
  startRound();
}

function endGame() {
  playing = false;
  roundActive = false;
  cancelAnimationFrame(animationId);

  let result = "";
  if (score >= 80) {
    result = "Excellent timing!";
  } else if (score >= 50) {
    result = "Nice job!";
  } else {
    result = "Keep practicing!";
  }

  messageEl.textContent = `Game Over! Final Score: ${score}. ${result}`;
}

function restartGame() {
  cancelAnimationFrame(animationId);
  playing = false;
  roundActive = false;
  score = 0;
  round = 0;
  markerPosition = 0;
  direction = 1;
  marker.style.left = "0px";
  messageEl.textContent = "Press Start to begin";
  updateUI();
}

startBtn.addEventListener("click", startGame);
hitBtn.addEventListener("click", evaluateHit);
restartBtn.addEventListener("click", restartGame);

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    evaluateHit();
  }
});

updateUI();