(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const overlay = document.getElementById('overlay');
  const startButton = document.getElementById('startButton');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayCopy = document.getElementById('overlayCopy');
  const overlayEyebrow = document.getElementById('overlayEyebrow');
  const scoreEl = document.getElementById('score');
  const coinsEl = document.getElementById('coins');
  const timerEl = document.getElementById('timer');
  const highEl = document.getElementById('highScore');
  const W = canvas.width, H = canvas.height, TILE = 32;
  const WORLD_W = 7168, FLOOR = 416;
  const keys = new Set();
  let mode = 'title', last = 0, camera = 0, score = 0, coins = 0;
  let timeLeft = 400, elapsed = 0, audioOn = true, audio;
  const player = { x: 112, y: FLOOR - 44, w: 28, h: 42, vx: 0, vy: 0, grounded: false, facing: 1, invuln: 0, big: false, walk: 0 };
  let ground = [], blocks = [], pipes = [], coinItems = [], enemies = [], powerups = [], particles = [];

  function buildLevel() {
    // The recognizable course 1-1 rhythm: opening question block, block arc,
    // pipe run, hidden-reward gap, long block row, pyramid steps and the flag.
    ground = [{ x: 0, w: 1776 }, { x: 1872, w: 2576 }, { x: 4544, w: 2624 }];
    blocks = [];
    const brick = (x, y, n = 1) => { for (let i = 0; i < n; i++) blocks.push({ x: x + i * TILE, y, type: 'brick', used: false }); };
    const question = (x, y, reward = 'coin') => blocks.push({ x, y, type: 'question', reward, used: false, bump: 0 });
    question(512, 288); // the first ? block
    brick(672, 288); question(704, 288, 'mushroom'); brick(736, 288);
    brick(672, 256); question(704, 256); brick(736, 256);
    brick(704, 224);
    // Three rising pipes and the pipe that hides the bonus room entrance.
    pipes = [
      { x: 1088, h: 64, bonus: false }, { x: 1312, h: 96, bonus: false },
      { x: 1568, h: 128, bonus: true }, { x: 1792, h: 64, bonus: false },
      { x: 4896, h: 96, bonus: false }
    ];
    // The hidden 1-up marker, second ? block, ten-coin brick and star block.
    blocks.push({ x: 1984, y: 288, type: 'hidden', reward: 'life', used: false });
    question(2144, 288, 'coin');
    brick(2208, 352); blocks[blocks.length - 1].reward = 'ten';
    brick(2304, 288); blocks[blocks.length - 1].reward = 'star';
    question(2368, 256, 'mushroom'); brick(2336, 256); brick(2400, 256);
    // A long overhead row with a gap in it.
    brick(2608, 224, 9);
    // Coin-bearing ? blocks and the high central formation.
    question(3008, 288); brick(3040, 288); question(3072, 288);
    brick(3168, 256); question(3200, 256); brick(3232, 256);
    brick(3200, 224);
    // Final block set and two classic stair pyramids.
    brick(4192, 288); brick(4224, 288); question(4256, 288); brick(4288, 288);
    for (let row = 0; row < 4; row++) brick(4496 + row * TILE, FLOOR - TILE * (row + 1), 4 - row);
    for (let row = 0; row < 4; row++) brick(5248 + row * TILE, FLOOR - TILE * (row + 1), 4 - row);
    // End stretch: exit pipe, final coin blocks, staircase, flag.
    pipes.push({ x: 5824, h: 64, bonus: false });
    brick(6016, 288); brick(6048, 288); question(6080, 288); brick(6112, 288);
    for (let row = 0; row < 7; row++) brick(6464 + row * TILE, FLOOR - TILE * (row + 1), 7 - row);

    coinItems = [];
    const addCoins = (xs, y) => xs.forEach((x, i) => coinItems.push({ x, y: y + (i % 2 ? -10 : 0), taken: false, phase: Math.random() * 6 }));
    addCoins([528, 560, 592], 236); addCoins([640, 704, 768], 194);
    addCoins([1120, 1152, 1184], 256); addCoins([1408, 1440, 1472], 272);
    addCoins([1968, 2000, 2032, 2064], 248); addCoins([2704, 2736, 2768, 2800], 186);
    addCoins([3008, 3072, 3136], 230); addCoins([4384, 4416], 246);
    addCoins([6180, 6212, 6244], 240);
    enemies = [];
    [656, 944, 1248, 1672, 2048, 2496, 2880, 3424, 4000, 4688, 5040, 5600, 6180].forEach((x, i) => {
      enemies.push({ x, y: FLOOR - 30, w: 28, h: 28, vx: i % 2 ? -54 : 54, alive: true, turn: Math.random() * 6, walk: 0 });
    });
    powerups = []; particles = [];
  }
  buildLevel();
  const fmt = n => String(Math.floor(n)).padStart(6, '0');
  highEl.textContent = fmt(Number(localStorage.getItem('pixelrun-high') || 0));

  function tone(freq = 440, dur = .07, type = 'square', vol = .025) {
    if (!audioOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + dur);
      o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + dur);
    } catch {}
  }
  function start() {
    if (mode === 'play') return;
    score = 0; coins = 0; timeLeft = 400; elapsed = 0; camera = 0;
    Object.assign(player, { x: 112, y: FLOOR - 44, w: 28, h: 42, vx: 0, vy: 0, grounded: false, invuln: 0, big: false, walk: 0 });
    buildLevel(); mode = 'play'; overlay.classList.add('hidden'); tone(660, .12); requestAnimationFrame(loop);
  }
  startButton.addEventListener('click', start);
  document.getElementById('soundToggle').addEventListener('click', e => {
    audioOn = !audioOn; e.currentTarget.querySelector('span').textContent = audioOn ? 'SOUND ON' : 'SOUND OFF'; tone(520);
  });
  window.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'ArrowDown'].includes(e.key)) e.preventDefault();
    const key = e.key.toLowerCase();
    if (!keys.has(key) && [' ', 'arrowup', 'w'].includes(key)) player.jumpQueued = true;
    keys.add(key);
    if ((e.key === 'Enter' || e.key === ' ') && mode !== 'play') start();
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function drawCloud(x, y, s) {
    const q = 28 * s; rect(x + 8, y + 10, q * 2, q * .7, '#f7ffff');
    rect(x + q * .45, y, q, q, '#fff'); rect(x + q * 1.15, y - 9 * s, q * .9, q * 1.15, '#fff');
    rect(x + q * 1.8, y + 4 * s, q * .8, q * .7, '#fff'); rect(x + 12, y + q * .64, q * 1.8, 5 * s, '#d8f4ff');
  }
  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#61b9ff'); sky.addColorStop(.66, '#a6e4ff'); sky.addColorStop(1, '#e2faff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // Tiny sun glints and distant layered hills give the scene a richer 16-bit depth.
    rect(754, 61, 48, 48, '#fff2a1'); rect(762, 53, 32, 8, '#fff9ce'); rect(746, 69, 8, 32, '#fff9ce');
    for (let i = 0; i < 9; i++) {
      let x = (i * 510 - camera * .2) % 5100; if (x < -350) x += 5100;
      const top = 352 - (i % 3) * 22;
      ctx.fillStyle = i % 2 ? '#9ddf96' : '#84d687'; ctx.beginPath(); ctx.moveTo(x - 160, 430); ctx.quadraticCurveTo(x + 90, top - 170, x + 350, 430); ctx.fill();
      ctx.fillStyle = '#50b975';
      [[x + 65, top - 4, 26, 49], [x + 111, top + 12, 19, 36]].forEach(([a,b,c,d]) => { ctx.beginPath(); ctx.ellipse(a,b,c,d,-.3,0,Math.PI*2); ctx.fill(); });
      rect(x + 67, top + 10, 7, 12, '#d5ffad'); rect(x + 108, top + 16, 6, 11, '#d5ffad');
    }
    for (const cloud of [{x:120,y:86,s:1},{x:470,y:140,s:.75},{x:1060,y:105,s:1.1},{x:1740,y:124,s:.8},{x:2440,y:88,s:1.05},{x:3150,y:138,s:.85},{x:3900,y:91,s:1},{x:4700,y:134,s:.8},{x:5510,y:96,s:1.15},{x:6420,y:120,s:.9}]) {
      let x = cloud.x - camera * .37; while (x < -140) x += WORLD_W + 200; while (x > W + 100) x -= WORLD_W + 200; drawCloud(x, cloud.y, cloud.s);
    }
  }
  function drawGround() {
    for (const segment of ground) {
      const x = segment.x - camera; if (x + segment.w < 0 || x > W) continue;
      rect(x, FLOOR, segment.w, H - FLOOR, '#bd684d'); rect(x, FLOOR, segment.w, 12, '#4fd27b'); rect(x, FLOOR + 12, segment.w, 6, '#32965b');
      for (let bx = Math.floor(segment.x / TILE) * TILE; bx < segment.x + segment.w; bx += TILE) {
        const sx = bx - camera; rect(sx, FLOOR + 18, 2, H - FLOOR, '#984c45');
        if ((bx / TILE) % 2 === 0) rect(sx + 14, FLOOR + 34, 3, 3, '#ed9670');
        if ((bx / TILE) % 2) rect(sx + 27, FLOOR + 58, 3, 3, '#ed9670');
      }
    }
  }
  function drawBlock(b) {
    if (b.type === 'hidden' && !b.used) return;
    const x = b.x - camera, y = b.y - (b.bump > 0 ? Math.sin((1 - b.bump) * Math.PI) * 9 : 0);
    if (x < -TILE || x > W + TILE) return;
    if (b.type === 'question' && !b.used) {
      rect(x, y, TILE, TILE, '#ad5b23'); rect(x + 2, y + 2, 28, 28, '#ffbd45');
      rect(x + 5, y + 5, 22, 3, '#ffe58a'); rect(x + 5, y + 5, 3, 21, '#ffe58a');
      rect(x + 23, y + 8, 3, 13, '#e28b35'); rect(x + 9, y + 23, 14, 3, '#e28b35');
      rect(x + 13, y + 7, 6, 3, '#fff5bd'); rect(x + 19, y + 10, 4, 7, '#fff5bd'); rect(x + 15, y + 18, 5, 3, '#fff5bd'); rect(x + 15, y + 24, 5, 3, '#fff5bd');
    } else if (b.type === 'hidden' && !b.used) {
      rect(x, y, TILE, TILE, '#90a6b9'); rect(x + 2, y + 2, 28, 28, '#aec4d2'); rect(x + 4, y + 4, 24, 3, '#d8edf4');
      rect(x + 6, y + 12, 4, 4, '#829cac'); rect(x + 22, y + 22, 4, 4, '#829cac');
    } else {
      rect(x, y, TILE, TILE, '#ab5147'); rect(x + 2, y + 2, 28, 28, '#dc7656');
      rect(x + 15, y + 2, 3, 13, '#a84d43'); rect(x + 2, y + 14, 28, 3, '#a84d43');
      rect(x + 7, y + 17, 3, 13, '#a84d43'); rect(x + 23, y + 17, 3, 13, '#a84d43');
      rect(x + 3, y + 3, 8, 3, '#f5a071');
    }
    if (b.bump > 0) b.bump = Math.max(0, b.bump - .08);
  }
  function drawPipe(p) {
    const x = p.x - camera, top = FLOOR - p.h; if (x < -100 || x > W + 100) return;
    rect(x, top + 8, 64, p.h - 8, '#128744'); rect(x + 7, top + 9, 9, p.h - 9, '#36d879');
    rect(x - 8, top, 80, 19, '#18a850'); rect(x - 5, top + 3, 74, 5, '#5af08a');
    rect(x + 66, top + 8, 4, p.h - 8, '#086c3b');
  }
  function drawCoin(c) {
    if (c.taken) return; const x = c.x - camera, y = c.y + Math.sin(elapsed * 5 + c.phase) * 4;
    const width = 7 + Math.abs(Math.sin(elapsed * 7 + c.phase)) * 5;
    rect(x - width/2, y - 11, width, 22, '#f59d22'); rect(x - width/2 + 2, y - 10, Math.max(2,width-4), 18, '#ffdc4b');
    rect(x - 2, y - 7, 3, 14, '#fff7ad');
  }
  function drawPlayer() {
    if (player.invuln > 0 && Math.floor(elapsed * 18) % 2) return;
    const x = Math.round(player.x - camera), y = Math.round(player.y), flip = player.facing < 0;
    ctx.save(); if (flip) { ctx.translate(x + player.w, y); ctx.scale(-1,1); } else ctx.translate(x,y);
    const bob = player.grounded && Math.abs(player.vx) > 20 ? Math.round(Math.sin(player.walk) * 2) : 0;
    // Bespoke chunky pixel hero with shaded overalls, gloves and a cap.
    rect(5, 1+bob, 21, 5, '#9d2d4b'); rect(2, 6+bob, 27, 7, '#ee4557'); rect(18, 7+bob, 13, 5, '#ff746c');
    rect(7, 13+bob, 17, 4, '#f4bd89'); rect(3, 17+bob, 24, 9, '#f6c997');
    rect(8, 19+bob, 4, 4, '#20264a'); rect(22, 19+bob, 4, 4, '#20264a'); rect(18, 24+bob, 8, 3, '#9c4841');
    rect(3, 26+bob, 24, 9, '#e94754'); rect(7, 34+bob, 18, 7, '#3769c4');
    rect(4, 29+bob, 6, 7, '#f2bf53'); rect(21, 29+bob, 6, 7, '#f2bf53');
    rect(1, 31+bob, 5, 6, '#fff0ce'); rect(25, 31+bob, 5, 6, '#fff0ce');
    rect(4, 39+bob, 10, 4, '#47354e'); rect(20, 39+bob, 10, 4, '#47354e');
    rect(8, 35+bob, 3, 4, '#7db7f5'); rect(20, 35+bob, 3, 4, '#7db7f5');
    ctx.restore();
  }
  function drawEnemy(e) {
    if (!e.alive) return; const x = e.x - camera, y = e.y + Math.sin(elapsed * 5 + e.turn) * 1.2;
    rect(x + 3, y + 5, 22, 18, '#96533c'); rect(x, y + 11, 28, 13, '#b76a43');
    rect(x + 5, y + 15, 7, 8, '#fff0cf'); rect(x + 7, y + 17, 3, 5, '#252344');
    rect(x + 17, y + 15, 7, 8, '#fff0cf'); rect(x + 19, y + 17, 3, 5, '#252344');
    rect(x + 2, y + 23, 10, 4, '#563642'); rect(x + 17, y + 23, 10, 4, '#563642');
  }
  function drawFlag() {
    const x = 6864 - camera; rect(x, 148, 8, FLOOR - 148, '#f4f3df'); rect(x + 8, 158, 70, 46, '#27c879');
    rect(x + 8, 158, 52, 6, '#7af1ae'); rect(x + 8, 198, 52, 6, '#129457'); rect(x - 7, FLOOR - 6, 38, 11, '#d8c49b');
    rect(x - 1, 139, 21, 16, '#fff2c4');
  }
  function draw() {
    drawSky(); drawGround(); pipes.forEach(drawPipe); blocks.forEach(drawBlock); coinItems.forEach(drawCoin);
    enemies.forEach(drawEnemy); powerups.forEach(p => drawPowerup(p)); drawFlag(); particles.forEach(drawParticle); drawPlayer();
  }
  function drawPowerup(p) {
    if (p.type === 'mushroom') { rect(p.x-camera+3,p.y+4,22,18,'#f5e8c9'); rect(p.x-camera,p.y,28,13,'#f34353'); rect(p.x-camera+5,p.y+2,5,5,'#fff'); rect(p.x-camera+18,p.y+3,5,5,'#fff'); rect(p.x-camera+8,p.y+15,4,5,'#302749'); rect(p.x-camera+17,p.y+15,4,5,'#302749'); }
  }
  function drawParticle(p) { const x = p.x-camera; rect(x,p.y,4,4,p.color); }
  function burst(x,y,color) { for(let i=0;i<7;i++) particles.push({x,y,vx:(Math.random()-.5)*180,vy:-70-Math.random()*130,life:.5,color}); }
  function overlap(a,b) { return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
  function collectCoin(c) { c.taken = true; coins++; score += 200; tone(880,.09,'square',.03); burst(c.x,c.y,'#ffed75'); }
  function bumpBlock(b) {
    b.bump = 1; tone(190,.06);
    if (b.used) return;
    b.used = true;
    if (b.reward === 'mushroom') { powerups.push({x:b.x+2,y:b.y-26,type:'mushroom',vx:45}); }
    else if (b.reward === 'ten') { coins += 10; score += 1000; tone(980,.22,'triangle'); }
    else if (b.reward === 'life') { score += 1000; tone(980,.22,'triangle'); }
    else if (b.reward === 'star') { score += 1000; player.invuln = 6; }
    else { coins++; score += 200; }
    if (b.reward === 'coin' || b.reward === 'ten') { const c={x:b.x+16,y:b.y-14,taken:false,phase:0};coinItems.push(c);setTimeout(()=>c.taken=true,320); }
  }
  function update(dt) {
    elapsed += dt; timeLeft -= dt; if (timeLeft <= 0) { timeLeft=0; finish(false); return; }
    const left=keys.has('arrowleft')||keys.has('a'), right=keys.has('arrowright')||keys.has('d');
    const jump=player.jumpQueued||keys.has(' ')||keys.has('arrowup')||keys.has('w'); player.jumpQueued=false;
    const speed=player.big?246:234;
    if(left){player.vx=-speed;player.facing=-1;}else if(right){player.vx=speed;player.facing=1;}else player.vx*=Math.pow(.002,dt);
    if(Math.abs(player.vx)>20)player.walk+=dt*13;
    if(jump&&player.grounded){player.vy=-520;player.grounded=false;tone(360,.08);}
    player.vy=Math.min(800,player.vy+1450*dt);
    const oldX=player.x, oldY=player.y, oldBottom=oldY+player.h;
    player.x=Math.max(0,Math.min(WORLD_W-player.w,player.x+player.vx*dt));
    player.y+=player.vy*dt; player.grounded=false;
    // Ground segments and pipe tops.
    for(const g of ground)if(player.x+player.w>g.x&&player.x<g.x+g.w&&oldBottom<=FLOOR+8&&player.y+player.h>=FLOOR&&player.vy>=0){player.y=FLOOR-player.h;player.vy=0;player.grounded=true;}
    for(const p of pipes){const py=FLOOR-p.h, box={x:p.x-7,y:py,w:78,h:p.h};if(overlap(player,box)){if(oldY+player.h<=py+8&&player.vy>=0){player.y=py-player.h;player.vy=0;player.grounded=true;}else if(oldX+player.w<=box.x+5)player.x=box.x-player.w;else if(oldX>=box.x+box.w-5)player.x=box.x+box.w;}}
    for(const b of blocks){if(b.used&&b.type==='hidden')continue;const box={x:b.x,y:b.y,w:TILE,h:TILE};if(!overlap(player,box))continue;
      if(oldY>=b.y+TILE-4&&player.vy<0){player.y=b.y+TILE;player.vy=35;bumpBlock(b);}
      else if(oldBottom<=b.y+5&&player.vy>0){player.y=b.y-player.h;player.vy=0;player.grounded=true;}
      else if(oldX+player.w<=b.x+4){player.x=b.x-player.w;player.vx=0;}
      else if(oldX>=b.x+TILE-4){player.x=b.x+TILE;player.vx=0;}
    }
    if(player.y>H+60){finish(false);return;}
    for(const c of coinItems)if(!c.taken&&overlap(player,{x:c.x-8,y:c.y-12,w:16,h:24}))collectCoin(c);
    for(const p of powerups){p.x+=p.vx*dt;p.y+=100*dt;for(const g of ground)if(p.x+28>g.x&&p.x<g.x+g.w&&p.y+24>=FLOOR)p.y=FLOOR-24;if(overlap(player,{x:p.x,y:p.y,w:28,h:24})){p.taken=true;player.big=true;player.h=48;player.y-=6;score+=1000;tone(680,.3,'triangle');}}
    powerups=powerups.filter(p=>!p.taken&&p.x<WORLD_W);
    if(player.invuln>0)player.invuln-=dt;
    for(const e of enemies){if(!e.alive)continue;e.x+=e.vx*dt;e.walk+=dt*9;if(e.x<0||e.x>WORLD_W-40)e.vx*=-1;for(const p of pipes){if(e.x+e.w>p.x-7&&e.x<p.x+71)e.vx*=-1;}if(overlap(player,e)){
        if(player.vy>80&&oldY+player.h<e.y+16){e.alive=false;player.vy=-350;score+=200;tone(220,.1);burst(e.x+14,e.y+12,'#d89864');}
        else if(player.invuln<=0){player.invuln=1.4;player.vx=player.x<e.x?-220:220;player.vy=-270;if(player.big){player.big=false;player.h=42;}else score=Math.max(0,score-100);tone(120,.16);}
      }}
    particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=240*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);
    camera=Math.max(0,Math.min(WORLD_W-W,player.x-W*.37));
    if(player.x>WORLD_W-250)finish(true);
    scoreEl.textContent=fmt(score);coinsEl.textContent=String(coins).padStart(2,'0');timerEl.textContent=String(Math.ceil(timeLeft)).padStart(3,'0');
  }
  function finish(won){
    mode=won?'win':'over';overlayTitle.innerHTML=won?'COURSE<br><em>CLEAR!</em>':'TRY<br><em>AGAIN</em>';
    overlayEyebrow.textContent=won?'WORLD 1-1 COMPLETE':'ADVENTURE PAUSED';
    overlayCopy.innerHTML=won?`Score ${fmt(score)} · ${coins} coins collected<br>You reached the flag!`:`Score ${fmt(score)} · ${coins} coins collected<br>Take another run at World 1-1.`;
    startButton.innerHTML='PLAY AGAIN <span>↻</span>';overlay.classList.remove('hidden');
    const best=Math.max(score,Number(localStorage.getItem('pixelrun-high')||0));localStorage.setItem('pixelrun-high',best);highEl.textContent=fmt(best);tone(won?740:160,.3,'triangle');
  }
  function loop(ts){if(mode!=='play')return;const dt=Math.min(.032,(ts-last)/1000||0);last=ts;update(dt);draw();if(mode==='play')requestAnimationFrame(loop);}
  draw();
})();
