(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const speedEl = document.getElementById('speed');
  const speedLabelEl = document.getElementById('speedLabel');
  const speedPillEl = document.getElementById('speedPill');

  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnReset = document.getElementById('btnReset');
  const btnSlow = document.getElementById('btnSlow');
  const btnFast = document.getElementById('btnFast');

  const btnAuto = document.getElementById('btnAuto');
  const speedRow = document.querySelector('.speed');

  const overlayRestart = document.getElementById('overlayRestart');

  // Grid settings
  const GRID = 22;
  let cell = 20;
  const pad = 1;

  // Game state
  let snake, dir, nextDirQueue, food, bigFood;
  let score = 0;
  let normalEaten = 0;
  let best = Number(localStorage.getItem('snake_best_tr') || '0');
  bestEl.textContent = best;

  // Grow system
  let growLeft = 0;

  // timing / loop
  let running = false;
  let paused = false;
  let rafId = null;
  let acc = 0;
  let lastTs = 0;

  // Speed system: base (user), current (effective)
  let baseSpeed = 8;       // user selected (2..16)
  let currentSpeed = 8;    // effective speed (auto-accel changes this)
  let autoAccel = true;    // default ON
  let accelTimer = 0;
  const accelEveryMs = 14000; // every 14s => +1 speed (up to 16)

  let stepMs = speedToStepMs(currentSpeed);

  let gameOverFlag = false;

  function speedToStepMs(s){
    // 2 => ~236ms, 16 => ~68ms
    return Math.round(260 - (s * 12));
  }

  function showRestartOverlay(show){
    overlayRestart.classList.toggle('show', !!show);
  }

  function canEditSpeed(){
    // before first start OR after game over, user can set base speed
    return (!running) || gameOverFlag;
  }

  function applyEffectiveSpeed(){
    stepMs = speedToStepMs(currentSpeed);
    speedLabelEl.textContent = currentSpeed;
    speedPillEl.textContent = currentSpeed;
  }

  function setBaseSpeed(v){
    baseSpeed = Math.max(2, Math.min(16, v|0));
    speedEl.value = String(baseSpeed);

    if (!running || gameOverFlag){
      currentSpeed = baseSpeed;
      applyEffectiveSpeed();
    }
  }

  function setSpeed(v){
    if (!canEditSpeed()){
      speedEl.value = String(baseSpeed);
      return;
    }
    setBaseSpeed(v);
    updateSpeedUI();
  }

  function updateSpeedUI(){
    btnAuto.classList.toggle('on', autoAccel);
    speedRow.classList.toggle('locked', running && !gameOverFlag);
  }

  function updateButtons(){
    // Start: always ▶ ; Pause toggles ⏸ / ▶
    btnStart.textContent = '▶';
    btnPause.textContent = paused ? '▶' : '⏸';
  }

  function requestLoop(){
    if (rafId === null){
      rafId = requestAnimationFrame(loop);
    }
  }

  function ensureRunning(){
    if (!running){
      running = true;
      paused = false;
      lastTs = 0;
      acc = 0;
      requestLoop();
    } else if (paused){
      paused = false;
    }
    updateButtons();
    updateSpeedUI();
    try { canvas.focus(); } catch(_) {}
  }

  function restartAndRun(){
    running = true;
    paused = false;
    resetGame();
    lastTs = 0;
    acc = 0;
    ensureRunning();
  }

  function resetGame(){
    score = 0;
    normalEaten = 0;
    scoreEl.textContent = score;

    const mid = Math.floor(GRID/2);
    snake = [
      {x: mid-1, y: mid},
      {x: mid,   y: mid},
      {x: mid+1, y: mid},
    ];
    dir = {x: 1, y: 0};
    nextDirQueue = [];
    growLeft = 0;

    food = spawnFood();
    bigFood = null;

    // reset speed progression for new run
    accelTimer = 0;
    currentSpeed = baseSpeed;
    applyEffectiveSpeed();

    gameOverFlag = false;
    showRestartOverlay(false);

    updateButtons();
    updateSpeedUI();
    draw();
  }

  function spawnFood(){
    while(true){
      const f = { x: randInt(0, GRID-1), y: randInt(0, GRID-1), kind:'normal' };
      if (!isOnSnake(f.x, f.y)) return f;
    }
  }

  function spawnBigFood(){
    while(true){
      const f = {
        x: randInt(0, GRID-1),
        y: randInt(0, GRID-1),
        value: 8,
        grow: 4,
        kind: 'big',
        ttl: 6000
      };
      if (!isOnSnake(f.x, f.y) && !(food && food.x===f.x && food.y===f.y)) return f;
    }
  }

  function isOnSnake(x,y){
    return snake.some(p => p.x===x && p.y===y);
  }
  function randInt(a,b){ return (Math.random()*(b-a+1)+a)|0; }

  // ===== INPUT (queue) =====
  function enqueueDir(nx, ny){
    // game over sonrası yön tuşu ile de yeniden başlat (kullanıcı hissi iyi)
    if (gameOverFlag){
      restartAndRun();
    } else {
      ensureRunning();
    }

    const last = nextDirQueue.length ? nextDirQueue[nextDirQueue.length-1] : dir;
    if (nx === -last.x && ny === -last.y) return;
    if (nx === last.x && ny === last.y) return;

    if (nextDirQueue.length >= 6) nextDirQueue.shift();
    nextDirQueue.push({x:nx,y:ny});
  }

  function handleKey(e){
    if (e.repeat) return;

    const k = e.key.toLowerCase();
    if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' '].includes(k)){
      e.preventDefault();
    }

    if (k==='arrowup' || k==='w') enqueueDir(0,-1);
    else if (k==='arrowdown' || k==='s') enqueueDir(0, 1);
    else if (k==='arrowleft' || k==='a') enqueueDir(-1,0);
    else if (k==='arrowright' || k==='d') enqueueDir(1,0);
    else if (k===' '){
      togglePause();
    }
  }
  window.addEventListener('keydown', handleKey, {passive:false});

  // On-screen dpad
  document.querySelectorAll('.dpad button[data-dir]').forEach(btn=>{
    btn.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      const d = btn.getAttribute('data-dir');
      if (d==='up') enqueueDir(0,-1);
      if (d==='down') enqueueDir(0, 1);
      if (d==='left') enqueueDir(-1,0);
      if (d==='right') enqueueDir(1,0);
    }, {passive:false});
  });

  // Swipe on canvas (yalnızca oyun alanında)
  let swipe = null;
  const SWIPE_MIN = 22;

  canvas.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    try{ canvas.setPointerCapture(e.pointerId); }catch(_){}
    swipe = {x:e.clientX, y:e.clientY, done:false};
  }, {passive:false});

  canvas.addEventListener('pointermove', (e)=>{
    if (!swipe || swipe.done) return;
    e.preventDefault();
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    if (Math.hypot(dx,dy) < SWIPE_MIN) return;

    swipe.done = true;
    if (Math.abs(dx) > Math.abs(dy)){
      enqueueDir(dx>0 ? 1 : -1, 0);
    }else{
      enqueueDir(0, dy>0 ? 1 : -1);
    }
  }, {passive:false});

  function endSwipe(e){
    if (!swipe) return;
    e.preventDefault();
    swipe = null;
  }
  canvas.addEventListener('pointerup', endSwipe, {passive:false});
  canvas.addEventListener('pointercancel', endSwipe, {passive:false});

  // ===== Controls =====
  btnStart.addEventListener('click', ()=>{
    if (gameOverFlag){
      restartAndRun();
      return;
    }
    ensureRunning();
  });

  function togglePause(){
    if (!running) return;
    paused = !paused;
    updateButtons();
  }

  btnPause.addEventListener('click', ()=>{
    if (!running){
      running = true;
      paused = true;
      lastTs = 0;
      acc = 0;
      requestLoop();
    }else{
      togglePause();
    }
    updateButtons();
    updateSpeedUI();
  });

  btnReset.addEventListener('click', ()=>{
    restartAndRun();
  });

  btnSlow.addEventListener('click', ()=> setSpeed(baseSpeed-1));
  btnFast.addEventListener('click', ()=> setSpeed(baseSpeed+1));
  speedEl.addEventListener('input', ()=> setSpeed(Number(speedEl.value)));

  btnAuto.addEventListener('click', ()=>{
    autoAccel = !autoAccel;
    if (!autoAccel){
      accelTimer = 0;
      // Auto kapanınca efektif hız base'e dönsün (daha anlaşılır)
      currentSpeed = baseSpeed;
      applyEffectiveSpeed();
    } else {
      // Auto açılınca; oyun oynanıyorsa timer sıfırlayalım
      accelTimer = 0;
      if (!running || gameOverFlag){
        currentSpeed = baseSpeed;
        applyEffectiveSpeed();
      }
    }
    updateSpeedUI();
  });

  overlayRestart.addEventListener('click', ()=>{
    restartAndRun();
  });

  // ===== Responsive canvas sizing =====
  function resizeCanvas(){
    // Mobilde: panel altta sabit olduğu için canvas genişliğini
    // hem ekrana hem de kalan yüksekliğe göre ayarla (scroll olmasın).
    const mobile = window.matchMedia('(max-width: 900px)').matches;

    const topbarH = document.querySelector('.topbar')?.getBoundingClientRect().height || 0;
    const panelH = mobile ? (document.querySelector('.panel')?.getBoundingClientRect().height || 0) : 0;

    const sidePad = mobile ? 20 : 0;
    const verticalPad = mobile ? 18 : 0;

    const availH = Math.max(240, window.innerHeight - topbarH - panelH - verticalPad);
    const availW = Math.max(240, window.innerWidth - sidePad);

    // hedef: kare canvas
    const targetCss = mobile
      ? Math.floor(Math.min(availW, availH))
      : Math.floor(Math.min(520, availW, window.innerHeight*0.78));

    canvas.style.width = targetCss + 'px';

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.width * dpr);

    cell = Math.floor(canvas.width / GRID);
    draw();
  }
  window.addEventListener('resize', resizeCanvas);

  // ===== Game tick =====
  function tick(dt){
    if (!running || paused) return;

    // Auto acceleration
    if (autoAccel && !gameOverFlag){
      accelTimer += dt;
      while (accelTimer >= accelEveryMs && currentSpeed < 16){
        accelTimer -= accelEveryMs;
        currentSpeed += 1;
        applyEffectiveSpeed();
      }
    }

    // Big food TTL
    if (bigFood){
      bigFood.ttl -= dt;
      if (bigFood.ttl <= 0) bigFood = null;
    }

    // apply queued direction (at most 1 meaningful turn per tick)
    while (nextDirQueue.length){
      const cand = nextDirQueue.shift();
      if (!(cand.x === -dir.x && cand.y === -dir.y)){
        dir = cand;
        break;
      }
    }

    const head = snake[snake.length-1];
    const nx = head.x + dir.x;
    const ny = head.y + dir.y;

    // wall collision
    if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID){
      gameOver();
      return;
    }

    const willEatNormal = (nx===food.x && ny===food.y);
    const willEatBig = (bigFood && nx===bigFood.x && ny===bigFood.y);
    const willGrowThisTick = willEatNormal || willEatBig || (growLeft > 0);

    // collision: allow moving into tail only if tail will move away this tick
    const tailWillMove = !(willEatNormal || willEatBig || (growLeft > 0));
    let hits = false;
    for (let i=0;i<snake.length;i++){
      const p = snake[i];
      if (p.x===nx && p.y===ny){
        if (i===0 && tailWillMove){
          // OK: moving into current tail position while tail shifts away
        } else {
          hits = true;
        }
        break;
      }
    }
    if (hits){
      gameOver();
      return;
    }

    // move head
    snake.push({x:nx, y:ny});

    // eat / scoring
    if (willEatNormal){
      score += 1;
      growLeft += 1;
      food = spawnFood();

      normalEaten += 1;

      // Nokia tarzı: her 7 normal lokmada bir büyük lokma çıkabilir
      if (!bigFood && (normalEaten % 7 === 0)){
        bigFood = spawnBigFood();
      }
    }

    if (willEatBig){
      score += bigFood.value;
      growLeft += bigFood.grow;
      bigFood = null;
    }

    // tail handling
    if (growLeft > 0){
      growLeft -= 1;
    } else {
      snake.shift();
    }

    // update best / UI
    if (score > best){
      best = score;
      localStorage.setItem('snake_best_tr', String(best));
      bestEl.textContent = best;
    }
    scoreEl.textContent = score;

    draw();
  }

  function gameOver(){
    paused = true;
    gameOverFlag = true;
    showRestartOverlay(true);
    updateButtons();
    updateSpeedUI();
    flash();
  }

  function flash(){
    let n = 0;
    const id = setInterval(()=>{
      n++;
      ctx.globalAlpha = (n%2) ? 0.4 : 1;
      draw();
      ctx.globalAlpha = 1;
      if (n>=6) clearInterval(id);
    }, 80);
  }

  // ===== Render =====
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    ctx.fillStyle = 'rgba(0,0,0,.20)';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = Math.max(1, Math.floor(cell * 0.06));
    for(let i=0;i<=GRID;i++){
      const p = i*cell + 0.5;
      ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,GRID*cell); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,p); ctx.lineTo(GRID*cell,p); ctx.stroke();
    }

    // food
    drawCell(food.x, food.y, 'normal');

    // big food
    if (bigFood) drawCell(bigFood.x, bigFood.y, 'big');

    // snake
    for(let i=0;i<snake.length;i++){
      const p = snake[i];
      const isHead = (i===snake.length-1);
      const alpha = isHead ? 1 : 0.9;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isHead ? 'rgba(51,209,122,0.98)' : 'rgba(51,209,122,0.82)';
      roundRect(p.x*cell + pad, p.y*cell + pad, cell - pad*2, cell - pad*2, Math.max(6, cell*0.22));
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // overlays
    if (!running){
      overlayText('Bir yön tuşuna bas • veya ▶');
    } else if (paused && !gameOverFlag){
      overlayText('Duraklatıldı');
    } else if (paused && gameOverFlag){
      overlayText('Bitti! ↻ ile yeniden');
    }
  }

  function drawCell(x,y,kind){
    if (kind==='normal'){
      ctx.fillStyle = 'rgba(255,77,77,0.95)';
      roundRect(x*cell + pad, y*cell + pad, cell - pad*2, cell - pad*2, Math.max(6, cell*0.22));
      ctx.fill();
    } else {
      // big bite: glowing
      const cx = x*cell + cell/2;
      const cy = y*cell + cell/2;
      const r = cell*0.52;

      ctx.save();
      ctx.shadowColor = 'rgba(255,204,0,.45)';
      ctx.shadowBlur = Math.max(8, cell*0.6);
      ctx.fillStyle = 'rgba(255,204,0,0.95)';
      roundRect(x*cell + pad, y*cell + pad, cell - pad*2, cell - pad*2, Math.max(8, cell*0.28));
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath();
      ctx.arc(cx - r*0.25, cy - r*0.25, r*0.18, 0, Math.PI*2);
      ctx.fill();
    }
  }

  function overlayText(t){
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.font = `700 ${Math.max(16, Math.floor(canvas.width*0.045))}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, canvas.width/2, canvas.height/2);
    ctx.restore();
  }

  function roundRect(x,y,w,h,r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  // ===== RAF LOOP =====
  function loop(ts){
    rafId = null;

    if (!running){
      draw();
      return;
    }

    if (!lastTs) lastTs = ts;
    const dt = ts - lastTs;
    lastTs = ts;

    acc += dt;
    const maxAcc = stepMs * 5;
    if (acc > maxAcc) acc = maxAcc;

    while (acc >= stepMs){
      tick(stepMs);
      acc -= stepMs;
      if (paused) break;
    }

    requestLoop();
  }

  // init
  setBaseSpeed(8);
  resetGame();
  resizeCanvas();

  // start in idle (overlay text visible)
  running = false;
  paused = false;
  gameOverFlag = false;
  showRestartOverlay(false);
  updateButtons();
  updateSpeedUI();
  draw();
})();
