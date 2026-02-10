/**
 * Snake - game.js
 * Goals:
 * - Fast input (Arrow keys + WASD) + prevent scroll
 * - Mobile controls: swipe/drag on the board + on-screen D‑pad + buttons
 * - Wrap-around world (no wall death)
 * - Correct self-collision (tail edge-case handled)
 * - Bonus food (bigger square, timed) in a Nokia 3310-ish spirit
 *
 * i18n: uses window.__t(key) from /assets/site.js when available
 */
(() => {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const bestEl  = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const ovTitle = document.getElementById("ov-title");
  const ovSub   = document.getElementById("ov-sub");

  const BEST_KEY = "snake_best_v2";

  function flashBonus(){
    if (!scoreEl) return;
    scoreEl.classList.add("flash-bonus");
    window.setTimeout(() => scoreEl.classList.remove("flash-bonus"), 260);
  }


  // Game tuning
  const GRID = 28;              // 28x28 cells
  const STEP_MS = 78;           // base speed (lower = faster)
  const MIN_SWIPE = 12;         // px threshold for direction change

  // Bonus tuning
  const BONUS_SCORE = 50;
  const BONUS_TTL_STEPS = 110;  // ~ 8-9 seconds depending on speed
  const BONUS_EVERY = 5;        // guaranteed bonus every 5 normal foods
  const BONUS_RANDOM_CHANCE = 0.15; // plus random chance on any normal food

  let cell = 20; // computed in resize()
  let dpr = 1;

  // State
  /** @type {{x:number,y:number}[]} */
  let snake = [];
  let dir = { x: 1, y: 0 };
  /** @type {{x:number,y:number}[]} */
  let dirQueue = [];
  let food = { x: 0, y: 0 };

  let bonus = /** @type {{active:boolean,x:number,y:number,ttl:number}} */ ({ active:false, x:0, y:0, ttl:0 });

  let score = 0;
  let pendingGrow = 0;
  let running = false;
  let paused = false;
  let started = false;
  let raf = 0;
  let last = 0;
  let acc = 0;

  let normalEaten = 0;

  function t(key){
    return (typeof window.__t === "function") ? window.__t(key) : key;
  }

  function clampWrap(n){
    // wrap 0..GRID-1
    n %= GRID;
    return n < 0 ? n + GRID : n;
  }

  function randCell(){
    return {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID),
    };
  }

  function isOnSnake(p){
    return snake.some(s => s.x === p.x && s.y === p.y);
  }

  function spawnFood(){
    let p = randCell();
    while (isOnSnake(p) || (bonus.active && p.x === bonus.x && p.y === bonus.y)) p = randCell();
    food = p;
  }

  function spawnBonus(){
    if (bonus.active) return;
    let p = randCell();
    while (isOnSnake(p) || (p.x === food.x && p.y === food.y)) p = randCell();
    bonus = { active:true, x:p.x, y:p.y, ttl: BONUS_TTL_STEPS };
  }

  function setBestIfNeeded(){
    const best = Number(localStorage.getItem(BEST_KEY) || "0");
    if (score > best) localStorage.setItem(BEST_KEY, String(score));
  }

  function updateHud(){
    scoreEl.textContent = String(score);
    bestEl.textContent = String(Number(localStorage.getItem(BEST_KEY) || "0"));
  }

  function showOverlay(titleKey, subKey){
    ovTitle.textContent = t(titleKey);
    ovSub.textContent = t(subKey);
    overlay.classList.add("on");
  }
  function hideOverlay(){
    overlay.classList.remove("on");
  }

  function resetGame(){
    // Center-ish start
    snake = [{ x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 }];
    dir = { x: 1, y: 0 };
    dirQueue = [];
    pendingGrow = 0;
    score = 0;
    paused = false;
    running = false;
    started = false;
    normalEaten = 0;
    bonus = { active:false, x:0, y:0, ttl:0 };
    spawnFood();
    updateHud();
    showOverlay("snake.title", "snake.hint");
    draw();
  }

  function startIfNeeded(){
    if (!started){
      started = true;
      hideOverlay();
      running = true;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(loop);
    }
  }

  function togglePause(){
    if (!started) return;
    paused = !paused;
    if (paused){
      showOverlay("snake.pause", "snake.resume");
    } else {
      hideOverlay();
    }
  }

  function restart(){
    cancelAnimationFrame(raf);
    resetGame();
  }

  function gameOver(){
    setBestIfNeeded();
    updateHud();
    running = false;
    paused = false;
    cancelAnimationFrame(raf);
    showOverlay("snake.gameover", "snake.restart");
    draw();
  }

  function enqueueDir(nx, ny){
    // Ignore zero vectors
    if (nx === 0 && ny === 0) return;

    // Determine last intended direction (queue tail or current dir)
    const lastIntended = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;

    // No same direction
    if (lastIntended.x === nx && lastIntended.y === ny) return;

    // No reverse (prevents instant 180 turn)
    if (lastIntended.x === -nx && lastIntended.y === -ny) return;

    // Keep queue short for responsiveness but allow quick double-turn
    if (dirQueue.length >= 2) dirQueue.shift();
    dirQueue.push({ x:nx, y:ny });

    startIfNeeded();
  }

  function step(){
    if (!running || paused) return;

    // Apply queued direction first
    if (dirQueue.length) dir = dirQueue.shift();

    const head = snake[0];
    const nh = {
      x: clampWrap(head.x + dir.x),
      y: clampWrap(head.y + dir.y),
    };

    const ateNormal = (nh.x === food.x && nh.y === food.y);
    const ateBonus  = (bonus.active && nh.x === bonus.x && nh.y === bonus.y);

    // Determine if tail will move away this step (important for correct self-collision)
    const tailWillMove = (pendingGrow === 0 && !ateNormal && !ateBonus);

    // Self collision check:
    // - If tail will move, ignore the last segment because it is vacated this step
    const len = snake.length;
    const checkUntil = tailWillMove ? len - 1 : len;
    for (let i = 0; i < checkUntil; i++){
      const s = snake[i];
      if (s.x === nh.x && s.y === nh.y){
        gameOver();
        return;
      }
    }

    // Move
    snake.unshift(nh);

    if (ateBonus){
      score += BONUS_SCORE;
      pendingGrow += 2; // bonus grows a bit more
      bonus.active = false;
      bonus.ttl = 0;
      flashBonus();
    }

    if (ateNormal){
      score += 10;
      pendingGrow += 1;
      normalEaten++;

      // Always respawn normal food first
      spawnFood();

      // Bonus rule: (C) guaranteed every N foods + also random chance
      if (!bonus.active && (normalEaten % BONUS_EVERY === 0 || Math.random() < BONUS_RANDOM_CHANCE)){
        spawnBonus();
      }
    }

    // Pop tail unless growing
    if (pendingGrow > 0){
      pendingGrow--;
    } else {
      snake.pop();
    }

    // Bonus TTL
    if (bonus.active){
      bonus.ttl--;
      if (bonus.ttl <= 0){
        bonus.active = false;
      }
    }

    updateHud();
  }

  function loop(now){
    if (!running) return;

    const dt = now - last;
    last = now;

    // Cap huge jumps (tab switch)
    acc += Math.min(200, dt);

    while (acc >= STEP_MS){
      step();
      acc -= STEP_MS;
    }

    draw();
    raf = requestAnimationFrame(loop);
  }

  function resize(){
    // Fit canvas to its parent width, keep square
    const parent = canvas.parentElement;
    const w = Math.min(560, parent ? parent.clientWidth : 560);
    const h = w;

    dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);

    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr, dpr);

    cell = w / GRID;
    draw();
  }

  function drawGrid(){
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    const w = canvas.clientWidth || 560;

    for (let i = 0; i <= GRID; i++){
      const p = i * cell;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, w);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(w, p);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRectCell(x,y, inset, radius){
    const px = x * cell + inset;
    const py = y * cell + inset;
    const size = cell - inset*2;
    roundRect(px, py, size, size, radius);
  }

  function roundRect(x,y,w,h,r){
    const rr = Math.max(0, Math.min(r, Math.min(w,h)/2));
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
    ctx.fill();
  }

  function draw(){
    const w = canvas.clientWidth || 560;

    // Background
    ctx.clearRect(0,0,w,w);
    ctx.fillStyle = "rgba(9,12,18,.65)";
    ctx.fillRect(0,0,w,w);

    drawGrid();

    // Food (square, Nokia vibe)
    ctx.save();
    ctx.fillStyle = "#5eead4";
    drawRectCell(food.x, food.y, cell*0.22, 0);
    ctx.restore();

    // Bonus (bigger square, gold blink)
    if (bonus.active){
      const blinkOn = (Math.floor(performance.now() / 180) % 2) === 0;
      ctx.save();
      ctx.globalAlpha = blinkOn ? 1.0 : 0.35;
      ctx.fillStyle = "#fbbf24";
      const inset = cell*0.08; // bigger than normal food
      drawRectCell(bonus.x, bonus.y, inset, 0);
      ctx.restore();
    }

    // Snake
    for (let i = 0; i < snake.length; i++){
      const s = snake[i];
      const isHead = i === 0;
      ctx.save();
      ctx.fillStyle = isHead ? "#e8eef7" : "rgba(232,238,247,.70)";
      const inset = isHead ? cell*0.10 : cell*0.15;
      drawRectCell(s.x, s.y, inset, 0);
      ctx.restore();
    }
  }

  // ---------- Inputs ----------
  function onKeyDown(e){
    const k = (e.key || "").toLowerCase();
    const arrow = ["arrowup","arrowdown","arrowleft","arrowright"];
    const wasd  = ["w","a","s","d"];
    const control = arrow.includes(k) || wasd.includes(k) || k === " " || k === "enter" || k === "p" || k === "r";

    if (control) e.preventDefault();

    if (k === "arrowup" || k === "w") enqueueDir(0, -1);
    else if (k === "arrowdown" || k === "s") enqueueDir(0, 1);
    else if (k === "arrowleft" || k === "a") enqueueDir(-1, 0);
    else if (k === "arrowright" || k === "d") enqueueDir(1, 0);
    else if (k === " " || k === "p") togglePause();
    else if (k === "enter" || k === "r") restart();
  }

  // Touch/Pointer controls on board
  let pDown = false;
  let pStartX = 0;
  let pStartY = 0;

  function pointerPos(ev){
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  function onPointerDown(ev){
    // left mouse / touch
    pDown = true;
    const p = pointerPos(ev);
    pStartX = p.x; pStartY = p.y;
    startIfNeeded();
  }
  function onPointerMove(ev){
    if (!pDown) return;
    const p = pointerPos(ev);
    const dx = p.x - pStartX;
    const dy = p.y - pStartY;

    if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) return;

    if (Math.abs(dx) > Math.abs(dy)){
      enqueueDir(dx > 0 ? 1 : -1, 0);
    } else {
      enqueueDir(0, dy > 0 ? 1 : -1);
    }
    // Reset start to allow continuous control by dragging finger
    pStartX = p.x; pStartY = p.y;
  }
  function onPointerUp(){
    pDown = false;
  }

  function wireTouchButtons(){
    // D-pad buttons
    document.querySelectorAll("[data-dir]").forEach(btn => {
      const dirName = btn.getAttribute("data-dir");
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (navigator.vibrate) navigator.vibrate(10);
        if (dirName === "up") enqueueDir(0,-1);
        if (dirName === "down") enqueueDir(0,1);
        if (dirName === "left") enqueueDir(-1,0);
        if (dirName === "right") enqueueDir(1,0);
      }, { passive:false });
    });

    document.querySelectorAll("[data-action]").forEach(btn => {
      const a = btn.getAttribute("data-action");
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (a === "pause") togglePause();
        if (a === "restart") restart();
      }, { passive:false });
    });
  }

  // Overlay click/tap behavior:
  overlay?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!started) startIfNeeded();
    else if (!running) restart();
    else if (paused) togglePause();
  }, { passive:false });

  // Boot
  window.addEventListener("keydown", onKeyDown, { passive:false });

  canvas.addEventListener("pointerdown", onPointerDown, { passive:true });
  canvas.addEventListener("pointermove", onPointerMove, { passive:true });
  window.addEventListener("pointerup", onPointerUp, { passive:true });
  window.addEventListener("pointercancel", onPointerUp, { passive:true });

  wireTouchButtons();

  window.addEventListener("resize", resize);

  resize();
  resetGame();
})();
