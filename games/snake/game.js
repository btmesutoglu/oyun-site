/**
 * Snake game.js
 * - Pure game logic + minimal UI binding
 * - Reads translations via window.__t() (from /assets/site.js)
 */

(() => {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const ovTitle = document.getElementById("ov-title");
  const ovSub = document.getElementById("ov-sub");

  const BEST_KEY = "snake_best_v1";

  const GRID = 28;                 // 28x28 cells
  const CELL = canvas.width / GRID;

  let snake, dir, nextDir, food, score, running, paused, raf;
  let last = 0;
  const STEP_MS = 85;

  function randCell() {
    return {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID),
    };
  }

  function resetGame() {
    snake = [{ x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 }];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    food = spawnFood();
    score = 0;
    running = false;
    paused = false;
    updateScore();
    showStart();
    draw();
  }

  function spawnFood() {
    let p = randCell();
    while (snake?.some(s => s.x === p.x && s.y === p.y)) p = randCell();
    return p;
  }

  function updateScore() {
    scoreEl.textContent = String(score);
    const best = Number(localStorage.getItem(BEST_KEY) || "0");
    bestEl.textContent = String(best);
  }

  function setBestIfNeeded() {
    const best = Number(localStorage.getItem(BEST_KEY) || "0");
    if (score > best) {
      localStorage.setItem(BEST_KEY, String(score));
    }
  }

  function t(key) {
    if (typeof window.__t === "function") return window.__t(key);
    return key;
  }

  function showOverlay(titleKey, subKey) {
    ovTitle.textContent = t(titleKey);
    ovSub.textContent = t(subKey);
    overlay.classList.add("on");
  }
  function hideOverlay() {
    overlay.classList.remove("on");
  }

  function showStart() {
    showOverlay("snake.title", "snake.hint");
  }
  function showPause() {
    showOverlay("snake.pause", "snake.resume");
  }
  function showGameOver() {
    showOverlay("snake.gameover", "snake.restart");
  }

  function startIfNeeded() {
    if (!running) {
      running = true;
      hideOverlay();
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    if (paused) {
      showPause();
    } else {
      hideOverlay();
      last = performance.now();
    }
  }

  function setDir(dx, dy) {
    // Prevent reversing into itself
    if (dx === -dir.x && dy === -dir.y) return;
    nextDir = { x: dx, y: dy };
    startIfNeeded();
  }

  function step() {
    dir = nextDir;

    const head = snake[0];
    const nh = { x: head.x + dir.x, y: head.y + dir.y };

    // wall collision
    if (nh.x < 0 || nh.x >= GRID || nh.y < 0 || nh.y >= GRID) {
      gameOver();
      return;
    }
    // self collision
    if (snake.some(s => s.x === nh.x && s.y === nh.y)) {
      gameOver();
      return;
    }

    snake.unshift(nh);

    // eat
    if (nh.x === food.x && nh.y === food.y) {
      score += 10;
      food = spawnFood();
      updateScore();
    } else {
      snake.pop();
    }
  }

  function gameOver() {
    setBestIfNeeded();
    updateScore();
    running = false;
    paused = false;
    cancelAnimationFrame(raf);
    showGameOver();
    draw();
  }

  function drawGrid() {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(canvas.width, i * CELL);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // subtle vignette
    ctx.save();
    const g = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 40,
      canvas.width / 2, canvas.height / 2, canvas.width / 1.1
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    drawGrid();

    // food
    ctx.save();
    ctx.fillStyle = "rgba(94,234,212,.95)";
    ctx.shadowColor = "rgba(94,234,212,.55)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc((food.x + 0.5) * CELL, (food.y + 0.5) * CELL, CELL * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // snake
    for (let i = 0; i < snake.length; i++) {
      const s = snake[i];
      const x = s.x * CELL;
      const y = s.y * CELL;

      ctx.save();
      ctx.fillStyle = i === 0 ? "rgba(232,238,247,.96)" : "rgba(232,238,247,.75)";
      ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      ctx.restore();
    }
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (!running || paused) return;

    const dt = ts - last;
    if (dt >= STEP_MS) {
      last = ts;
      step();
      draw();
    }
  }

  function onKey(e) {
    const k = e.key;
    if (k === "ArrowUp") return setDir(0, -1);
    if (k === "ArrowDown") return setDir(0, 1);
    if (k === "ArrowLeft") return setDir(-1, 0);
    if (k === "ArrowRight") return setDir(1, 0);

    if (k === " " || k === "Spacebar") {
      e.preventDefault();
      togglePause();
      return;
    }
    if (k === "Enter") {
      // restart from gameover/anytime
      cancelAnimationFrame(raf);
      resetGame();
      return;
    }
  }

  // Update overlay when language changes
  window.addEventListener("langchange", () => {
    // if overlay visible, re-render its text based on current state
    if (!overlay.classList.contains("on")) return;
    if (!running) {
      // either start screen or game over
      // Heuristic: if score>0 and not running, it's probably gameover
      if (score > 0) showGameOver(); else showStart();
    } else if (paused) {
      showPause();
    }
  });

  document.addEventListener("keydown", onKey, { passive: false });

  // init
  bestEl.textContent = String(Number(localStorage.getItem(BEST_KEY) || "0"));
  resetGame();
})();
