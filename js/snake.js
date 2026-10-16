/* =========================================================
   ØLSNAKE — en fyr som blir lengre (og fyllere) for hver øl
   ========================================================= */

const canvas = document.getElementById('snakeCanvas');
const ctx = canvas.getContext('2d');

// Polyfill for roundRect on older browsers
if (!ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

let gridSize = 14;           // number of cells per row/col
let cellSize = canvas.width / gridSize;

let snake = [];
let direction = 'right';
let nextDirection = 'right';
let food = { x: 0, y: 0 };
let score = 0;
let highScore = Store.get('gutta_snake_highscore', 0);
let gameInterval = null;
let baseSpeed = 160; // ms per tick, gets faster as you grow
let running = false;
let paused = false;

document.getElementById('highScoreVal').textContent = highScore;

// ---------- Size picker ----------
document.querySelectorAll('#sizePicker button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#sizePicker button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gridSize = parseInt(btn.dataset.size);
    cellSize = canvas.width / gridSize;
    resetGame();
    drawGame();
  });
});

function resetGame() {
  const mid = Math.floor(gridSize / 2);
  snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid }
  ];
  direction = 'right';
  nextDirection = 'right';
  score = 0;
  baseSpeed = 160;
  document.getElementById('scoreVal').textContent = score;
  placeFood();
  paused = false;
  document.getElementById('pauseBtn').textContent = '⏸️ Pause';
}

function placeFood() {
  let valid = false;
  while (!valid) {
    food = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize)
    };
    valid = !snake.some(s => s.x === food.x && s.y === food.y);
  }
}

// ---------- Drawing ----------
function drawGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // checkerboard floor (bar floor tiles)
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#123617' : '#0e2a12';
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  // draw food (beer mug emoji-style)
  drawBeer(food.x, food.y);

  // draw snake — a guy: head has a face, body is "drunk wobbly" segments getting redder as he grows
  snake.forEach((seg, i) => {
    const isHead = i === 0;
    const px = seg.x * cellSize;
    const py = seg.y * cellSize;
    const drunkFactor = Math.min(snake.length / 20, 1);

    ctx.save();
    ctx.translate(px + cellSize/2, py + cellSize/2);
    const wobble = isHead ? 0 : Math.sin(i * 0.8 + Date.now()/200) * drunkFactor * 4 * (Math.PI/180);
    ctx.rotate(wobble);

    if (isHead) {
      // face color gets redder (more drunk) with score
      const r = 255;
      const g = Math.max(180 - score * 4, 60);
      ctx.fillStyle = `rgb(${r},${g},120)`;
      ctx.beginPath();
      ctx.arc(0, 0, cellSize/2 - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a1f0f';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // eyes
      ctx.fillStyle = '#241206';
      const eyeOffsetX = direction === 'left' ? -3 : direction === 'right' ? 3 : 0;
      const eyeOffsetY = direction === 'up' ? -3 : direction === 'down' ? 3 : 0;
      ctx.beginPath();
      ctx.arc(-cellSize/5 + eyeOffsetX*0.3, -cellSize/8 + eyeOffsetY*0.3, 1.6, 0, Math.PI*2);
      ctx.arc(cellSize/5 + eyeOffsetX*0.3, -cellSize/8 + eyeOffsetY*0.3, 1.6, 0, Math.PI*2);
      ctx.fill();

      // rosy drunk cheeks once tipsy
      if (score > 2) {
        ctx.fillStyle = 'rgba(230,67,47,0.5)';
        ctx.beginPath();
        ctx.arc(-cellSize/3, cellSize/8, 2.4, 0, Math.PI*2);
        ctx.arc(cellSize/3, cellSize/8, 2.4, 0, Math.PI*2);
        ctx.fill();
      }

      // smile
      ctx.strokeStyle = '#241206';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, cellSize/10, cellSize/6, score > 5 ? 0.2 : 0.3, Math.PI - (score > 5 ? 0.2 : 0.3));
      ctx.stroke();
    } else {
      // body — like a shirt, alternating colors, redder/wobblier as drunker
      const hue = 30 - drunkFactor * 10;
      ctx.fillStyle = i % 2 === 0 ? `hsl(${hue}, 70%, 45%)` : `hsl(${hue}, 70%, 38%)`;
      ctx.beginPath();
      ctx.roundRect(-cellSize/2 + 1.5, -cellSize/2 + 1.5, cellSize - 3, cellSize - 3, 6);
      ctx.fill();
    }
    ctx.restore();
  });
}

function drawBeer(gx, gy) {
  const px = gx * cellSize;
  const py = gy * cellSize;
  ctx.save();
  ctx.translate(px + cellSize/2, py + cellSize/2);
  const bob = Math.sin(Date.now()/300) * 1.5;
  ctx.translate(0, bob);

  // mug body
  ctx.fillStyle = '#f4a825';
  ctx.fillRect(-cellSize*0.28, -cellSize*0.3, cellSize*0.5, cellSize*0.55);
  // foam
  ctx.fillStyle = '#fff8e7';
  ctx.beginPath();
  ctx.arc(-cellSize*0.28+cellSize*0.25, -cellSize*0.3, cellSize*0.27, 0, Math.PI*2);
  ctx.fill();
  // handle
  ctx.strokeStyle = '#f4a825';
  ctx.lineWidth = cellSize*0.09;
  ctx.beginPath();
  ctx.arc(cellSize*0.3, 0, cellSize*0.18, -Math.PI*0.6, Math.PI*0.6);
  ctx.stroke();
  ctx.restore();
}

// ---------- Game loop ----------
function tick() {
  if (paused) return;
  direction = nextDirection;

  const head = { ...snake[0] };
  if (direction === 'up') head.y -= 1;
  if (direction === 'down') head.y += 1;
  if (direction === 'left') head.x -= 1;
  if (direction === 'right') head.x += 1;

  // wall collision
  if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
    return gameOver();
  }
  // self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    return gameOver();
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score++;
    document.getElementById('scoreVal').textContent = score;
    placeFood();
    GuttaSFX.beerCrack();
    // speed up slightly as he drinks more (max out so it stays playable)
    baseSpeed = Math.max(70, 160 - score * 4);
    restartInterval();
    if (score % 5 === 0) {
      GuttaSFX.cheer();
      confettiBurst();
    }
  } else {
    snake.pop();
  }

  drawGame();
}

function restartInterval() {
  clearInterval(gameInterval);
  gameInterval = setInterval(tick, baseSpeed);
}

function gameOver() {
  clearInterval(gameInterval);
  running = false;
  GuttaSFX.slur();
  setTimeout(() => GuttaSFX.burp(), 300);
  if (score > highScore) {
    highScore = score;
    Store.set('gutta_snake_highscore', highScore);
    document.getElementById('highScoreVal').textContent = highScore;
  }
  document.getElementById('finalScore').textContent = score;
  const reward = score * 5;
  document.getElementById('snakeReward').textContent = reward > 0 ? `+${formatGK(reward)} i lommeboka 🪙` : 'Ingen øl, ingen GK 😢';
  if (reward > 0) Wallet.add(reward, 'snake');
  Stats.add('snake.games');
  Stats.max('snake.best', score);
  if (score >= 20) Achievements.unlock('snake_20');
  document.getElementById('gameOverModal').classList.add('open');
}

function closeModalAndRestart() {
  document.getElementById('gameOverModal').classList.remove('open');
  resetGame();
  drawGame();
}

// ---------- Controls ----------
function setDir(d) {
  const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
  if (opposite[d] === direction) return; // can't reverse into self
  nextDirection = d;
}

document.addEventListener('keydown', e => {
  const map = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right'
  };
  if (map[e.key]) {
    e.preventDefault();
    setDir(map[e.key]);
  }
  if (e.key === ' ') togglePause();
});

// swipe controls for touch
let touchStartX = 0, touchStartY = 0;
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });
canvas.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy)) {
    setDir(dx > 0 ? 'right' : 'left');
  } else {
    setDir(dy > 0 ? 'down' : 'up');
  }
}, { passive: true });

function startGame() {
  if (running) return;
  running = true;
  resetGame();
  restartInterval();
  drawGame();
  showToast("Skål! Spillet er i gang 🍺");
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  document.getElementById('pauseBtn').textContent = paused ? '▶️ Fortsett' : '⏸️ Pause';
  if (!paused) restartInterval();
}

// initial static render
resetGame();
drawGame();

// idle animation for bobbing beer even before game starts
setInterval(() => { if (!running) drawGame(); }, 150);
