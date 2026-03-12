const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const coinsEl = document.getElementById("coins");
const livesEl = document.getElementById("lives");
const timerEl = document.getElementById("timer");
const messageEl = document.getElementById("message");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND_Y = 468;
const LEVEL_WIDTH = 4200;
const GRAVITY = 0.62;

const keys = {
  left: false,
  right: false,
  jump: false,
};

const touchButtons = [...document.querySelectorAll("[data-control]")];

let state = {};
let lastFrame = 0;

function createLevel() {
  const platforms = [
    { x: 0, y: GROUND_Y, width: 720, height: HEIGHT - GROUND_Y, type: "ground" },
    { x: 860, y: GROUND_Y, width: 560, height: HEIGHT - GROUND_Y, type: "ground" },
    { x: 1540, y: GROUND_Y, width: 460, height: HEIGHT - GROUND_Y, type: "ground" },
    { x: 2130, y: GROUND_Y, width: 820, height: HEIGHT - GROUND_Y, type: "ground" },
    { x: 3080, y: GROUND_Y, width: 1120, height: HEIGHT - GROUND_Y, type: "ground" },
    { x: 420, y: 360, width: 64, height: 64, type: "brick" },
    { x: 484, y: 360, width: 64, height: 64, type: "question", reward: "coin", used: false },
    { x: 548, y: 360, width: 64, height: 64, type: "brick" },
    { x: 950, y: 330, width: 64, height: 64, type: "question", reward: "coin", used: false },
    { x: 1014, y: 330, width: 64, height: 64, type: "brick" },
    { x: 1078, y: 330, width: 64, height: 64, type: "brick" },
    { x: 1350, y: 280, width: 64, height: 64, type: "pipeTop" },
    { x: 1350, y: 344, width: 64, height: 124, type: "pipeBody" },
    { x: 1760, y: 315, width: 128, height: 32, type: "platform" },
    { x: 1950, y: 255, width: 128, height: 32, type: "platform" },
    { x: 2250, y: 360, width: 64, height: 64, type: "brick" },
    { x: 2314, y: 360, width: 64, height: 64, type: "question", reward: "coin", used: false },
    { x: 2378, y: 360, width: 64, height: 64, type: "brick" },
    { x: 2442, y: 360, width: 64, height: 64, type: "brick" },
    { x: 2750, y: 310, width: 160, height: 32, type: "platform" },
    { x: 3240, y: 390, width: 64, height: 78, type: "pipeTop" },
    { x: 3240, y: 468, width: 64, height: 72, type: "pipeBody" },
    { x: 3420, y: 330, width: 160, height: 32, type: "platform" },
  ];

  const coins = [
    { x: 516, y: 290, r: 14, collected: false },
    { x: 982, y: 265, r: 14, collected: false },
    { x: 1808, y: 260, r: 14, collected: false },
    { x: 1998, y: 200, r: 14, collected: false },
    { x: 2336, y: 300, r: 14, collected: false },
    { x: 2790, y: 255, r: 14, collected: false },
    { x: 2860, y: 255, r: 14, collected: false },
    { x: 3470, y: 275, r: 14, collected: false },
  ];

  const enemies = [
    { x: 760, y: GROUND_Y - 38, width: 36, height: 38, minX: 720, maxX: 950, vx: -1.2, alive: true },
    { x: 1610, y: GROUND_Y - 38, width: 36, height: 38, minX: 1540, maxX: 1820, vx: 1.1, alive: true },
    { x: 2580, y: GROUND_Y - 38, width: 36, height: 38, minX: 2460, maxX: 2920, vx: -1.4, alive: true },
    { x: 3520, y: GROUND_Y - 38, width: 36, height: 38, minX: 3340, maxX: 3800, vx: 1.3, alive: true },
  ];

  const flag = { x: 3900, y: 140, width: 14, height: 328 };

  return { platforms, coins, enemies, flag };
}

function resetGame() {
  const level = createLevel();

  keys.left = false;
  keys.right = false;
  keys.jump = false;

  state = {
    started: false,
    status: "ready",
    score: 0,
    coins: 0,
    lives: 3,
    timer: 400,
    timeAccumulator: 0,
    cameraX: 0,
    level,
    player: {
      x: 120,
      y: GROUND_Y - 54,
      width: 34,
      height: 54,
      vx: 0,
      vy: 0,
      speed: 4.2,
      onGround: false,
      facing: 1,
      invulnerable: 0,
    },
  };

  updateHud();
  messageEl.textContent = "按 Enter 開始，方向鍵移動，空白鍵跳躍。";
}

function updateHud() {
  scoreEl.textContent = String(state.score).padStart(6, "0");
  coinsEl.textContent = `x${String(state.coins).padStart(2, "0")}`;
  livesEl.textContent = String(state.lives);
  timerEl.textContent = String(Math.max(0, Math.ceil(state.timer)));
}

function startGame() {
  if (state.started && state.status === "playing") {
    return;
  }

  if (state.status === "win" || state.status === "gameover") {
    resetGame();
  }

  state.started = true;
  state.status = "playing";
  messageEl.textContent = "衝吧，抵達旗桿就是過關。";
}

function loseLife(reason) {
  if (state.player.invulnerable > 0 || state.status !== "playing") {
    return;
  }

  state.lives -= 1;
  updateHud();

  if (state.lives <= 0) {
    state.status = "gameover";
    messageEl.textContent = `Game Over。${reason}`;
    return;
  }

  state.player.x = Math.max(80, state.player.x - 140);
  state.player.y = GROUND_Y - state.player.height;
  state.player.vx = 0;
  state.player.vy = -8;
  state.player.invulnerable = 120;
  messageEl.textContent = `失去一條命。${reason}`;
}

function addScore(points) {
  state.score += points;
  updateHud();
}

function collectCoin(coin) {
  if (coin.collected) {
    return;
  }

  coin.collected = true;
  state.coins += 1;
  addScore(200);
  if (state.coins % 10 === 0) {
    state.lives += 1;
  }
  updateHud();
}

function intersects(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function hitQuestionBlock(block) {
  if (block.used) {
    return;
  }

  block.used = true;
  state.coins += 1;
  if (state.coins % 10 === 0) {
    state.lives += 1;
  }
  addScore(250);
  updateHud();
}

function resolvePlatformCollisions(previousY) {
  const player = state.player;
  player.onGround = false;

  for (const platform of state.level.platforms) {
    if (!intersects(player, platform)) {
      continue;
    }

    const prevBottom = previousY + player.height;
    const currBottom = player.y + player.height;
    const prevTop = previousY;
    const currTop = player.y;

    if (prevBottom <= platform.y && currBottom >= platform.y) {
      player.y = platform.y - player.height;
      player.vy = 0;
      player.onGround = true;
      continue;
    }

    if (prevTop >= platform.y + platform.height && currTop <= platform.y + platform.height) {
      player.y = platform.y + platform.height;
      player.vy = 1;
      if (platform.type === "question") {
        hitQuestionBlock(platform);
      }
      continue;
    }

    if (player.x + player.width / 2 < platform.x + platform.width / 2) {
      player.x = platform.x - player.width;
    } else {
      player.x = platform.x + platform.width;
    }
    player.vx = 0;
  }
}

function updatePlayer() {
  const player = state.player;
  const previousY = player.y;

  if (keys.left && !keys.right) {
    player.vx = -player.speed;
    player.facing = -1;
  } else if (keys.right && !keys.left) {
    player.vx = player.speed;
    player.facing = 1;
  } else {
    player.vx *= 0.76;
    if (Math.abs(player.vx) < 0.2) {
      player.vx = 0;
    }
  }

  if (keys.jump && player.onGround) {
    player.vy = -19.5;
    player.onGround = false;
  }

  player.x += player.vx;
  player.vy += GRAVITY;
  player.y += player.vy;

  resolvePlatformCollisions(previousY);

  if (player.x < 0) {
    player.x = 0;
  }

  if (player.x + player.width > LEVEL_WIDTH) {
    player.x = LEVEL_WIDTH - player.width;
  }

  if (player.y > HEIGHT + 120) {
    loseLife("你掉進坑裡了。");
  }

  if (player.invulnerable > 0) {
    player.invulnerable -= 1;
  }
}

function updateEnemies() {
  for (const enemy of state.level.enemies) {
    if (!enemy.alive) {
      continue;
    }

    enemy.x += enemy.vx;
    if (enemy.x <= enemy.minX || enemy.x + enemy.width >= enemy.maxX) {
      enemy.vx *= -1;
    }

    const player = state.player;
    const enemyBox = enemy;

    if (!intersects(player, enemyBox)) {
      continue;
    }

    const playerBottom = player.y + player.height;
    const enemyTop = enemy.y + 10;
    const descending = player.vy > 1;

    if (descending && playerBottom < enemyTop + 24) {
      enemy.alive = false;
      player.vy = -9.5;
      addScore(400);
      messageEl.textContent = "踩掉 Goomba。";
    } else {
      loseLife("被 Goomba 撞到了。");
    }
  }
}

function updateCoins() {
  const playerBox = state.player;

  for (const coin of state.level.coins) {
    if (coin.collected) {
      continue;
    }

    const hitbox = {
      x: coin.x - coin.r,
      y: coin.y - coin.r,
      width: coin.r * 2,
      height: coin.r * 2,
    };

    if (intersects(playerBox, hitbox)) {
      collectCoin(coin);
      messageEl.textContent = "拿到金幣。";
    }
  }
}

function updateCamera() {
  const target = state.player.x - WIDTH * 0.35;
  state.cameraX = Math.max(0, Math.min(target, LEVEL_WIDTH - WIDTH));
}

function checkWin() {
  const player = state.player;
  const flag = state.level.flag;

  if (player.x + player.width >= flag.x && player.y + player.height > flag.y) {
    state.status = "win";
    addScore(2000 + Math.ceil(state.timer) * 5);
    messageEl.textContent = "過關。你完成了 World 1-1。按 Restart 再玩一次。";
  }
}

function tick(deltaMs) {
  if (state.status !== "playing") {
    return;
  }

  state.timeAccumulator += deltaMs;
  while (state.timeAccumulator >= 1000) {
    state.timer -= 1;
    state.timeAccumulator -= 1000;
  }

  if (state.timer <= 0) {
    state.timer = 0;
    state.status = "gameover";
    messageEl.textContent = "時間到了。";
  }

  updatePlayer();
  updateEnemies();
  updateCoins();
  updateCamera();
  checkWin();
  updateHud();
}

function drawBackground(cameraX) {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#75d8ff");
  gradient.addColorStop(1, "#d9f6ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  for (let i = 0; i < 7; i += 1) {
    const x = ((i * 270) - cameraX * 0.25) % (WIDTH + 180);
    const baseX = x < -180 ? x + WIDTH + 180 : x;
    const y = 70 + (i % 3) * 48;
    drawCloud(baseX, y, 1 + (i % 2) * 0.15);
  }

  for (let i = 0; i < 10; i += 1) {
    const hillX = ((i * 420) - cameraX * 0.45) % (LEVEL_WIDTH + 300);
    const baseX = hillX < -240 ? hillX + LEVEL_WIDTH + 300 : hillX;
    drawHill(baseX - 100, GROUND_Y + 2, 120 + (i % 2) * 40, 140 + (i % 3) * 20);
  }
}

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(0, 26, 24, 0, Math.PI * 2);
  ctx.arc(28, 18, 28, 0, Math.PI * 2);
  ctx.arc(58, 26, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHill(x, groundY, width, height) {
  ctx.fillStyle = "#78bf4a";
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.quadraticCurveTo(x + width * 0.5, groundY - height, x + width, groundY);
  ctx.closePath();
  ctx.fill();
}

function drawPlatforms(cameraX) {
  for (const platform of state.level.platforms) {
    const x = platform.x - cameraX;
    if (x + platform.width < -80 || x > WIDTH + 80) {
      continue;
    }

    if (platform.type === "ground") {
      ctx.fillStyle = "#c96c35";
      ctx.fillRect(x, platform.y, platform.width, platform.height);
      drawBrickPattern(x, platform.y, platform.width, platform.height, "#8d431a");
      continue;
    }

    if (platform.type === "platform") {
      ctx.fillStyle = "#bf713b";
      ctx.fillRect(x, platform.y, platform.width, platform.height);
      drawBrickPattern(x, platform.y, platform.width, platform.height, "#87411a");
      continue;
    }

    if (platform.type === "pipeTop" || platform.type === "pipeBody") {
      ctx.fillStyle = platform.type === "pipeTop" ? "#32aa51" : "#2f9c4b";
      ctx.fillRect(x, platform.y, platform.width, platform.height);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(x + 8, platform.y, 12, platform.height);
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(x + platform.width - 14, platform.y, 10, platform.height);
      continue;
    }

    if (platform.type === "question") {
      ctx.fillStyle = platform.used ? "#c79c5e" : "#f7c53c";
      ctx.fillRect(x, platform.y, platform.width, platform.height);
      ctx.fillStyle = platform.used ? "#8b693c" : "#8a5200";
      ctx.font = "bold 42px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText(platform.used ? "!" : "?", x + platform.width / 2, platform.y + 47);
      continue;
    }

    ctx.fillStyle = "#ba6b36";
    ctx.fillRect(x, platform.y, platform.width, platform.height);
    drawBrickPattern(x, platform.y, platform.width, platform.height, "#8b4519");
  }
}

function drawBrickPattern(x, y, width, height, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let row = y; row < y + height; row += 22) {
    ctx.beginPath();
    ctx.moveTo(x, row);
    ctx.lineTo(x + width, row);
    ctx.stroke();
  }
  for (let col = x; col < x + width; col += 32) {
    ctx.beginPath();
    ctx.moveTo(col, y);
    ctx.lineTo(col, y + height);
    ctx.stroke();
  }
}

function drawCoins(cameraX) {
  for (const coin of state.level.coins) {
    if (coin.collected) {
      continue;
    }

    const x = coin.x - cameraX;
    if (x < -50 || x > WIDTH + 50) {
      continue;
    }

    ctx.fillStyle = "#ffd447";
    ctx.beginPath();
    ctx.ellipse(x, coin.y, coin.r * 0.8, coin.r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b37700";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(x, coin.y - 8);
    ctx.lineTo(x, coin.y + 8);
    ctx.stroke();
  }
}

function drawEnemy(enemy, cameraX) {
  const x = enemy.x - cameraX;
  const y = enemy.y;

  ctx.fillStyle = "#875331";
  ctx.beginPath();
  ctx.ellipse(x + enemy.width / 2, y + enemy.height / 2 + 4, enemy.width / 2, enemy.height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f8e1b0";
  ctx.fillRect(x + 7, y + 16, 8, 8);
  ctx.fillRect(x + 21, y + 16, 8, 8);
  ctx.fillStyle = "#2c160a";
  ctx.fillRect(x + 9, y + 18, 3, 3);
  ctx.fillRect(x + 23, y + 18, 3, 3);
  ctx.fillStyle = "#5b2f10";
  ctx.fillRect(x + 6, y + 4, enemy.width - 12, 8);
}

function drawFlag(cameraX) {
  const flag = state.level.flag;
  const poleX = flag.x - cameraX;

  ctx.strokeStyle = "#f6f6f6";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(poleX, flag.y);
  ctx.lineTo(poleX, flag.y + flag.height);
  ctx.stroke();

  ctx.fillStyle = "#3aa95a";
  ctx.beginPath();
  ctx.arc(poleX, flag.y, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#3dbd61";
  ctx.beginPath();
  ctx.moveTo(poleX, flag.y + 30);
  ctx.lineTo(poleX + 70, flag.y + 48);
  ctx.lineTo(poleX, flag.y + 66);
  ctx.closePath();
  ctx.fill();
}

function drawPlayer(cameraX) {
  const player = state.player;
  const x = player.x - cameraX;
  const y = player.y;

  if (player.invulnerable > 0 && Math.floor(player.invulnerable / 6) % 2 === 0) {
    return;
  }

  ctx.fillStyle = "#d7422d";
  ctx.fillRect(x + 6, y, 22, 12);
  ctx.fillRect(x + 4, y + 10, 26, 8);
  ctx.fillStyle = "#f3c59f";
  ctx.fillRect(x + 9, y + 12, 16, 14);
  ctx.fillStyle = "#2a4db6";
  ctx.fillRect(x + 7, y + 26, 20, 22);
  ctx.fillRect(x + 4, y + 30, 6, 18);
  ctx.fillRect(x + 24, y + 30, 6, 18);
  ctx.fillStyle = "#8a2b1a";
  ctx.fillRect(x + 2, y + 48, 12, 6);
  ctx.fillRect(x + 20, y + 48, 12, 6);
  ctx.fillStyle = "#3d1e12";
  ctx.fillRect(x + 6, y + 18, 18, 4);
  ctx.fillStyle = "#f3c59f";
  ctx.fillRect(x + 4, y + 27, 4, 12);
  ctx.fillRect(x + 26, y + 27, 4, 12);
}

function drawStatusCard() {
  if (state.status === "playing") {
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(23, 17, 12, 0.56)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#fff6df";
  ctx.fillRect(WIDTH / 2 - 220, HEIGHT / 2 - 90, 440, 180);
  ctx.strokeStyle = "#7d3b15";
  ctx.lineWidth = 5;
  ctx.strokeRect(WIDTH / 2 - 220, HEIGHT / 2 - 90, 440, 180);
  ctx.fillStyle = "#2b1606";
  ctx.textAlign = "center";
  ctx.font = "bold 44px Trebuchet MS";
  const title =
    state.status === "ready" ? "WORLD 1-1" :
    state.status === "win" ? "COURSE CLEAR" :
    "GAME OVER";
  ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 20);
  ctx.font = "24px Trebuchet MS";
  const subtitle =
    state.status === "ready" ? "Press Start or Enter" :
    state.status === "win" ? "Press Restart to play again" :
    "Press Restart to try again";
  ctx.fillText(subtitle, WIDTH / 2, HEIGHT / 2 + 28);
  ctx.restore();
}

function render() {
  drawBackground(state.cameraX);
  drawPlatforms(state.cameraX);
  drawCoins(state.cameraX);
  drawFlag(state.cameraX);

  for (const enemy of state.level.enemies) {
    if (enemy.alive) {
      drawEnemy(enemy, state.cameraX);
    }
  }

  drawPlayer(state.cameraX);
  drawStatusCard();
}

function loop(timestamp) {
  if (!lastFrame) {
    lastFrame = timestamp;
  }

  const deltaMs = Math.min(32, timestamp - lastFrame);
  lastFrame = timestamp;

  tick(deltaMs);
  render();
  requestAnimationFrame(loop);
}

function setKeyState(code, pressed) {
  if (code === "ArrowLeft" || code === "KeyA") {
    keys.left = pressed;
  }
  if (code === "ArrowRight" || code === "KeyD") {
    keys.right = pressed;
  }
  if (code === "ArrowUp" || code === "KeyW" || code === "Space") {
    keys.jump = pressed;
  }
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Enter") {
    startGame();
  }
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  setKeyState(event.code, true);
});

document.addEventListener("keyup", (event) => {
  setKeyState(event.code, false);
});

for (const button of touchButtons) {
  const control = button.dataset.control;
  const press = (event) => {
    event.preventDefault();
    keys[control] = true;
    if (control === "jump" && state.status !== "playing") {
      startGame();
    }
  };
  const release = (event) => {
    event.preventDefault();
    keys[control] = false;
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointerleave", release);
  button.addEventListener("pointercancel", release);
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", resetGame);

resetGame();
requestAnimationFrame(loop);
