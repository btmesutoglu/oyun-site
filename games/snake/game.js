/*!
 * Snake - game.js (ES5)
 * - Arrow keys + WASD
 * - Touch swipe/drag on canvas + on-screen D-pad
 * - Wrap-around world (no wall death)
 * - Self-collision ends game
 * - Bonus food (rarer), blinking + score celebration
 * - Starts slow, speeds up as you eat (Nokia-like)
 */
(function () {
  'use strict';

  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');
  var overlay = document.getElementById('overlay');
  var ovTitle = document.getElementById('ov-title');
  var ovSub = document.getElementById('ov-sub');

  var BEST_KEY = 'snake_best_v3';

  // Grid
  var GRID = 24; // 24x24 (slightly smaller playfield)
  var CELL = Math.floor(canvas.width / GRID);

  // Visual gap between squares (to avoid "merged" look)
  var GAP = 2; // px
  var INSET = Math.max(1, Math.floor(GAP / 2));

  // Colors
  var BG = '#0b1116';
  var GRIDLINE = 'rgba(255,255,255,0.06)';
  var SNAKE = '#d9dde3';     // same for head/body
  var FOOD = '#00ffd1';      // normal food
  var BONUS = '#f5c842';     // bonus gold

  // Game state
  var snake = [];
  var dir = { x: 1, y: 0 };        // current direction
  var dirQueue = [];              // queued directions
  // Slightly larger queue makes turns feel more responsive.
  // (Still prevents "buffering" too many moves.)
  var maxQueue = 4;

  var food = null;
  var bonus = null;               // {x,y,expiresAt}
  var bonusArmed = false;
  var bonusCooldown = 0;
  var foodsEaten = 0;

  var score = 0;
  var best = 0;

  var running = false;
  var tickStart = 190;            // starts comfy
  var tickMin = 115;              // do not go faster than this
  var tickDecay = 0.965;          // exponential easing per food
  var tickMs = tickStart;

  var rafId = null;
  var lastTick = 0;

  // --- Helpers ---
  function loadBest() {
    try {
      var v = window.localStorage.getItem(BEST_KEY);
      best = v ? parseInt(v, 10) || 0 : 0;
    } catch (e) { best = 0; }
    bestEl.textContent = String(best);
  }

  function saveBest() {
    try { window.localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
  }

  function setScore(v) {
    score = v;
    scoreEl.textContent = String(score);
    if (score > best) {
      best = score;
      bestEl.textContent = String(best);
      saveBest();
    }
  }

  function clampWrap(x) {
    // x in [0, GRID-1] using wrap
    if (x < 0) return GRID - 1;
    if (x >= GRID) return 0;
    return x;
  }

  function sameCell(a, b) {
    return a && b && a.x === b.x && a.y === b.y;
  }

  function occupied(x, y) {
    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === x && snake[i].y === y) return true;
    }
    return false;
  }

  function randInt(n) { return Math.floor(Math.random() * n); }

  function spawnFood() {
    var x, y;
    do {
      x = randInt(GRID);
      y = randInt(GRID);
    } while (occupied(x, y) || (bonus && bonus.x === x && bonus.y === y));
    food = { x: x, y: y };
  }

  function spawnBonus() {
    var x, y, tries = 0;
    do {
      x = randInt(GRID);
      y = randInt(GRID);
      tries++;
      if (tries > 200) return; // fail safe
    } while (occupied(x, y) || (food && food.x === x && food.y === y));
    bonus = { x: x, y: y, expiresAt: Date.now() + 6500 };
    // min eaten-food count before another bonus (keeps bonus from feeling "too frequent")
    bonusCooldown = 10;
  }

  function maybeSpawnBonus() {
    if (bonus) return;
    if (bonusCooldown > 0) return;

    // Nokia-like: guaranteed every 12 foods + rare random
    if (foodsEaten > 0 && (foodsEaten % 12 === 0)) {
      spawnBonus();
      return;
    }
    // small random chance (checked only when you eat)
    if (Math.random() < 0.08) {
      spawnBonus();
    }
  }

  function pushDir(nx, ny) {
    // prevent 180° reverse
    if (snake.length > 1) {
      var last = (dirQueue.length ? dirQueue[dirQueue.length - 1] : dir);
      if (last.x === -nx && last.y === -ny) return;
    }
    // no duplicates
    var last2 = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;
    if (last2.x === nx && last2.y === ny) return;

    if (dirQueue.length < maxQueue) dirQueue.push({ x: nx, y: ny });
  }

  function popDir() {
    if (dirQueue.length) {
      dir = dirQueue.shift();
    }
  }

  function showOverlay(titleKey, subKey) {
    // use already-translated text in DOM (site.js set them)
    // titleKey/subKey are literal strings (already translated text passed in)
    ovTitle.textContent = titleKey || '';
    ovSub.textContent = subKey || '';
    // Support both legacy CSS (.on) and newer class (.is-visible)
    overlay.classList.add('on');
    overlay.classList.add('is-visible');
  }

  function hideOverlay() {
    overlay.classList.remove('on');
    overlay.classList.remove('is-visible');
  }

  function getTextFromKey(key, fallback) {
    // Elements with data-i18n already translated, but we keep a fallback.
    // We'll use fallback strings supplied by HTML if needed.
    return fallback || key || '';
  }

  function celebrateBonus() {
    var wrap = document.querySelector('.hud-score');
    scoreEl.classList.remove('score-bonus');
    // force reflow
    scoreEl.offsetWidth;
    scoreEl.classList.add('score-bonus');
    if (wrap) {
      wrap.classList.remove('bonus-flash');
      wrap.offsetWidth;
      wrap.classList.add('bonus-flash');
    }
    try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {}
    setTimeout(function () {
      scoreEl.classList.remove('score-bonus');
      if (wrap) wrap.classList.remove('bonus-flash');
    }, 650);
  }

  function resetGame() {
    foodsEaten = 0;
    bonus = null;
    bonusCooldown = 0;
    dirQueue = [];
    dir = { x: 1, y: 0 };
    tickMs = tickStart;

    snake = [
      { x: 8, y: 12 },
      { x: 7, y: 12 },
      { x: 6, y: 12 }
    ];

    setScore(0);
    spawnFood();
    maybeSpawnBonus();

    running = false;
// Overlay text: use DOM texts (already localized)
    var title = document.querySelector('[data-i18n="snake.title"]');
    var hint = document.querySelector('[data-i18n="snake.hint"]');
    showOverlay(title ? title.textContent : 'Snake', hint ? hint.textContent : '');
  }

  function gameOver() {
    running = false;
var over = (document.querySelector('[data-i18n="snake.gameover"]') || {}).textContent || 'Oyun bitti';
    var restart = (document.querySelector('[data-i18n="snake.restart"]') || {}).textContent || 'Tekrar: Enter';
    showOverlay(over, restart);
  }
  }

  function startIfNeeded() {
    if (!running) {
      running = true;
hideOverlay();
      lastTick = 0;
    }

  function recomputeTick() {
    // Smooth speed-up that never becomes unplayable:
    // tick = tickStart * (tickDecay ^ foodsEaten), clamped to tickMin
    var t = Math.round(tickStart * Math.pow(tickDecay, foodsEaten));
    tickMs = Math.max(tickMin, t);
  }

  }

  function step() {
    popDir();

    var head = snake[0];
    var nx = clampWrap(head.x + dir.x);
    var ny = clampWrap(head.y + dir.y);

    // Determine if we will grow this move
    var willEatFood = (food && food.x === nx && food.y === ny);
    var willEatBonus = (bonus && bonus.x === nx && bonus.y === ny);
    var willGrow = willEatFood || willEatBonus;

    // Self-collision check.
    // If not growing, tail will move away; allow moving into the current tail cell.
    var tail = snake[snake.length - 1];
    for (var i = 0; i < snake.length; i++) {
      var s = snake[i];
      if (s.x === nx && s.y === ny) {
        var isTail = (s.x === tail.x && s.y === tail.y);
        if (!(isTail && !willGrow)) {
          gameOver();
          return;
        }
      }
    }

    // Move: add new head
    snake.unshift({ x: nx, y: ny });

    // Handle eats
    if (willEatFood) {
      foodsEaten++;
      setScore(score + 10);
      spawnFood();

      recomputeTick();
if (bonusCooldown > 0) bonusCooldown--;
      maybeSpawnBonus();
    } else if (willEatBonus) {
      foodsEaten++;
      setScore(score + 50);
      celebrateBonus();
      bonus = null;

      recomputeTick();
if (bonusCooldown > 0) bonusCooldown--;
      spawnFood();
      maybeSpawnBonus();
    } else {
      // normal move: remove tail
      snake.pop();
      // Do not spawn bonus on every tick; it becomes too frequent.
    }

    // Expire bonus
    if (bonus && Date.now() > bonus.expiresAt) {
      bonus = null;
    }
  }

  function drawCell(x, y, color, blink) {
    var px = x * CELL;
    var py = y * CELL;

    var pad = INSET;
    var w = CELL - (pad * 2);
    var h = CELL - (pad * 2);

    if (blink) {
      // blink by toggling alpha
      var on = (Math.floor(Date.now() / 180) % 2) === 0;
      if (!on) return;
    }

    ctx.fillStyle = color;
    ctx.fillRect(px + pad, py + pad, w, h);
  }

  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = GRIDLINE;
    ctx.lineWidth = 1;

    for (var i = 0; i <= GRID; i++) {
      var p = i * CELL + 0.5;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(canvas.width, p);
      ctx.stroke();
    }
  }

  function draw() {
    drawGrid();

    // food
    if (food) drawCell(food.x, food.y, FOOD, false);
    if (bonus) drawCell(bonus.x, bonus.y, BONUS, true);

    // snake (all same color)
    for (var i = 0; i < snake.length; i++) {
      drawCell(snake[i].x, snake[i].y, SNAKE, false);
    }
  }

  function loop(ts) {
    rafId = window.requestAnimationFrame(loop);

    if (!running) {
      draw();
      return;
    }

    if (!lastTick) lastTick = ts;
    var dt = ts - lastTick;

    // If the tab lags, catch up a bit to keep controls consistent.
    var steps = 0;
    while (dt >= tickMs && steps < 3) {
      lastTick += tickMs;
      dt -= tickMs;
      step();
      steps++;
    }

    draw();
  }

  // --- Input wiring ---
  function onKey(e) {
    var key = e.key || e.code || '';
    var k = String(key).toLowerCase();

    if (k === 'arrowup' || k === 'w') { e.preventDefault(); pushDir(0, -1); startIfNeeded(); }
    else if (k === 'arrowdown' || k === 's') { e.preventDefault(); pushDir(0, 1); startIfNeeded(); }
    else if (k === 'arrowleft' || k === 'a') { e.preventDefault(); pushDir(-1, 0); startIfNeeded(); }
    else if (k === 'arrowright' || k === 'd') { e.preventDefault(); pushDir(1, 0); startIfNeeded(); }    else if (k === 'enter') { e.preventDefault(); resetGame(); }
  }

  // Touch swipe/drag on canvas
  var touchActive = false;
  var startX = 0, startY = 0;
  var lastDirAt = 0;

  function getPoint(ev) {
    var rect = canvas.getBoundingClientRect();
    var clientX = 0, clientY = 0;
    if (ev.touches && ev.touches.length) {
      clientX = ev.touches[0].clientX;
      clientY = ev.touches[0].clientY;
    } else {
      clientX = ev.clientX;
      clientY = ev.clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function handleSwipe(ev) {
    if (!touchActive) return;
    var p = getPoint(ev);
    var dx = p.x - startX;
    var dy = p.y - startY;

    var now = Date.now();
    if (now - lastDirAt < 40) return; // debounce a bit

    var absX = Math.abs(dx);
    var absY = Math.abs(dy);
    var threshold = 18;

    if (absX < threshold && absY < threshold) return;

    if (absX > absY) {
      pushDir(dx > 0 ? 1 : -1, 0);
    } else {
      pushDir(0, dy > 0 ? 1 : -1);
    }
    startIfNeeded();
    lastDirAt = now;

    // reset base point to allow continuous drag
    startX = p.x;
    startY = p.y;
  }

  function onPointerDown(ev) {
    touchActive = true;
    var p = getPoint(ev);
    startX = p.x;
    startY = p.y;
    startIfNeeded();
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
  }

  function onPointerMove(ev) {
    if (!touchActive) return;
    ev.preventDefault();
    handleSwipe(ev);
  }

  function onPointerUp() { touchActive = false; }

  function wireTouchButtons() {
    // D-pad
    var dirBtns = document.querySelectorAll('[data-dir]');
    for (var i = 0; i < dirBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          var d = btn.getAttribute('data-dir');
          if (d === 'up') pushDir(0, -1);
          else if (d === 'down') pushDir(0, 1);
          else if (d === 'left') pushDir(-1, 0);
          else if (d === 'right') pushDir(1, 0);
          startIfNeeded();
          try { if (navigator.vibrate) navigator.vibrate(10); } catch (ex) {}
        }, { passive: false });
      })(dirBtns[i]);
    }
  }
  }

  // Init
  loadBest();
  resetGame();

  window.addEventListener('keydown', onKey, { passive: false });

  // Pointer events on canvas
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvas.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });

  wireTouchButtons();

  // Start render loop
  rafId = window.requestAnimationFrame(loop);
})();
