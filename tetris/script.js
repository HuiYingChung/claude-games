const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const PREVIEW_BLOCK = 24;
const LINE_POINTS = [0, 100, 300, 500, 800];

const SHAPES = {
  I: {
    color: "#40e0ff",
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  O: {
    color: "#ffd84d",
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  T: {
    color: "#b06cff",
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  S: {
    color: "#64f27d",
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  Z: {
    color: "#ff5f7c",
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
  J: {
    color: "#4d7dff",
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  L: {
    color: "#ffb14d",
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
};

const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlayTitle");
const overlayMessageEl = document.getElementById("overlayMessage");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const touchButtons = [...document.querySelectorAll("[data-action]")];

let game;
let lastTime = 0;

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function randomPiece() {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random() * types.length)];
  const piece = SHAPES[type];
  return {
    type,
    color: piece.color,
    matrix: cloneMatrix(piece.matrix),
    x: 0,
    y: 0,
  };
}

function resetGame() {
  game = {
    board: createEmptyBoard(),
    active: null,
    next: randomPiece(),
    score: 0,
    lines: 0,
    level: 1,
    dropCounter: 0,
    dropInterval: 1000,
    playing: false,
    paused: false,
    over: false,
  };

  spawnPiece();
  updateHud();
  showOverlay("準備開始", "按 Enter 或開始按鈕開始遊戲。");
}

function startGame() {
  if (game.over) {
    resetGame();
  }

  game.playing = true;
  game.paused = false;
  hideOverlay();
}

function togglePause() {
  if (!game.playing || game.over) {
    return;
  }

  game.paused = !game.paused;
  if (game.paused) {
    showOverlay("已暫停", "按 P 或暫停按鈕繼續。");
  } else {
    hideOverlay();
  }
}

function showOverlay(title, message) {
  overlayTitleEl.textContent = title;
  overlayMessageEl.textContent = message;
  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function updateHud() {
  scoreEl.textContent = String(game.score);
  linesEl.textContent = String(game.lines);
  levelEl.textContent = String(game.level);
}

function spawnPiece() {
  game.active = game.next;
  game.next = randomPiece();
  game.active.x = Math.floor((COLS - game.active.matrix[0].length) / 2);
  game.active.y = 0;

  if (collides(game.board, game.active)) {
    game.over = true;
    game.playing = false;
    showOverlay("遊戲結束", "按重新開始再玩一局。");
  }
}

function collides(board, piece) {
  return piece.matrix.some((row, y) =>
    row.some((value, x) => {
      if (!value) {
        return false;
      }

      const boardX = piece.x + x;
      const boardY = piece.y + y;

      return (
        boardX < 0 ||
        boardX >= COLS ||
        boardY >= ROWS ||
        (boardY >= 0 && board[boardY][boardX])
      );
    })
  );
}

function mergePiece() {
  game.active.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return;
      }

      const boardY = game.active.y + y;
      if (boardY >= 0) {
        game.board[boardY][game.active.x + x] = game.active.color;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (game.board[y].every(Boolean)) {
      game.board.splice(y, 1);
      game.board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  if (!cleared) {
    return;
  }

  game.lines += cleared;
  game.score += LINE_POINTS[cleared] * game.level;
  game.level = Math.floor(game.lines / 10) + 1;
  game.dropInterval = Math.max(120, 1000 - (game.level - 1) * 85);
  updateHud();
}

function lockPiece() {
  mergePiece();
  clearLines();
  spawnPiece();
  drawNext();
}

function movePiece(offset) {
  if (!canControl()) {
    return;
  }

  game.active.x += offset;
  if (collides(game.board, game.active)) {
    game.active.x -= offset;
  }
}

function dropPiece() {
  if (!canControl()) {
    return;
  }

  game.active.y += 1;
  if (collides(game.board, game.active)) {
    game.active.y -= 1;
    lockPiece();
  }
  game.dropCounter = 0;
}

function hardDrop() {
  if (!canControl()) {
    return;
  }

  while (!collides(game.board, game.active)) {
    game.active.y += 1;
  }
  game.active.y -= 1;
  lockPiece();
  game.score += 15;
  updateHud();
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function rotatePiece() {
  if (!canControl()) {
    return;
  }

  const original = game.active.matrix;
  const rotated = rotateMatrix(original);
  const originalX = game.active.x;

  game.active.matrix = rotated;

  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    game.active.x = originalX + kick;
    if (!collides(game.board, game.active)) {
      return;
    }
  }

  game.active.matrix = original;
  game.active.x = originalX;
}

function canControl() {
  return game.playing && !game.paused && !game.over;
}

function drawCell(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.fillRect(x + 2, y + 2, size - 4, 6);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
}

function drawBoard() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardCtx.fillStyle = "#050b16";
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  boardCtx.strokeStyle = "rgba(120, 200, 255, 0.08)";
  for (let x = 0; x <= COLS; x += 1) {
    boardCtx.beginPath();
    boardCtx.moveTo(x * BLOCK + 0.5, 0);
    boardCtx.lineTo(x * BLOCK + 0.5, boardCanvas.height);
    boardCtx.stroke();
  }
  for (let y = 0; y <= ROWS; y += 1) {
    boardCtx.beginPath();
    boardCtx.moveTo(0, y * BLOCK + 0.5);
    boardCtx.lineTo(boardCanvas.width, y * BLOCK + 0.5);
    boardCtx.stroke();
  }

  game.board.forEach((row, y) => {
    row.forEach((color, x) => {
      if (color) {
        drawCell(boardCtx, x * BLOCK, y * BLOCK, BLOCK, color);
      }
    });
  });

  game.active.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(boardCtx, (game.active.x + x) * BLOCK, (game.active.y + y) * BLOCK, BLOCK, game.active.color);
      }
    });
  });
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const matrix = game.next.matrix;
  const offsetX = (nextCanvas.width - matrix[0].length * PREVIEW_BLOCK) / 2;
  const offsetY = (nextCanvas.height - matrix.length * PREVIEW_BLOCK) / 2;

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(nextCtx, offsetX + x * PREVIEW_BLOCK, offsetY + y * PREVIEW_BLOCK, PREVIEW_BLOCK, game.next.color);
      }
    });
  });
}

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;

  if (game.playing && !game.paused && !game.over) {
    game.dropCounter += delta;
    if (game.dropCounter >= game.dropInterval) {
      dropPiece();
    }
  }

  drawBoard();
  requestAnimationFrame(update);
}

function handleAction(action) {
  if (action === "left") {
    movePiece(-1);
  } else if (action === "right") {
    movePiece(1);
  } else if (action === "down") {
    dropPiece();
    game.score += canControl() ? 1 : 0;
    updateHud();
  } else if (action === "rotate") {
    rotatePiece();
  } else if (action === "drop") {
    hardDrop();
  }
}

document.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "Enter") {
    startGame();
    return;
  }

  if (event.code === "KeyP") {
    togglePause();
    return;
  }

  const actions = {
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    ArrowDown: "down",
    KeyS: "down",
    ArrowUp: "rotate",
    KeyW: "rotate",
    KeyX: "rotate",
    Space: "drop",
  };

  const action = actions[event.code];
  if (action) {
    handleAction(action);
  }
});

startBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", resetGame);

touchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!game.playing && !game.over) {
      startGame();
    }
    handleAction(button.dataset.action);
  });
});

resetGame();
drawNext();
requestAnimationFrame(update);
