(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startButton = document.getElementById('startButton');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayCopy = document.getElementById('overlayCopy');
  const overlayEyebrow = document.getElementById('overlayEyebrow');
  const scoreEl = document.getElementById('score');
  const coinsEl = document.getElementById('coins');
  const timerEl = document.getElementById('timer');
  const highEl = document.getElementById('highScore');
  const W = canvas.width, H = canvas.height, TILE = 48;
  const keys = new Set();
  let mode = 'title', last = 0, camera = 0, score = 0, coins = 0, timeLeft = 300, elapsed = 0;
  let audioOn = true, audio;
  const worldWidth = 4200;
  const player = { x: 130, y: 370, w: 30, h: 42, vx: 0, vy: 0, grounded: false, facing: 1, invuln: 0 };
  let platforms = [], blocks = [], coinItems = [], enemies = [], particles = [];
  const clouds = [{x:120,y:75,s:1},{x:510,y:115,s:.8},{x:980,y:66,s:1.1},{x:1510,y:100,s:.9},{x:2110,y:72,s:1},{x:2750,y:111,s:.85},{x:3400,y:70,s:1.1},{x:3890,y:102,s:.9}];
  function buildLevel(){
    platforms=[{x:0,y:450,w:680},{x:760,y:450,w:570},{x:1430,y:450,w:630},{x:2150,y:450,w:660},{x:2910,y:450,w:570},{x:3580,y:450,w:620}];
    blocks=[{x:380,y:300,type:'brick'},{x:428,y:300,type:'question'},{x:476,y:300,type:'brick'},{x:1060,y:330,type:'question'},{x:1108,y:330,type:'brick'},{x:1156,y:330,type:'question'},{x:1690,y:270,type:'brick'},{x:1738,y:270,type:'question'},{x:1786,y:270,type:'brick'},{x:2460,y:305,type:'question'},{x:2508,y:305,type:'brick'},{x:2556,y:305,type:'question'},{x:3160,y:280,type:'brick'},{x:3208,y:280,type:'question'}];
    coinItems=[]; const sets=[[380,160],[840,1050,1280],[1510,1680,1930],[2200,2410,2660],[2990,3150,3380],[3650,3790,3940]];
    for(const set of sets)for(const x of set)coinItems.push({x,y:344-(x%2)*18,taken:false,bob:Math.random()*6});
    enemies=[];[590,930,1240,1580,1990,2330,2700,3050,3420,3710,3990].forEach((x,i)=>enemies.push({x,y:414,w:30,h:32,vx:i%2?-.75:.75,alive:true,turn:Math.random()*6}));
  }
  buildLevel();
  const saved=Number(localStorage.getItem('pixelrun-high')||0); highEl.textContent=fmt(saved);
  function fmt(n){return String(Math.floor(n)).padStart(6,'0')}
  function tone(freq=440,dur=.07,type='square',vol=.025){if(!audioOn)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+dur)}catch{}}
  function start(){if(mode==='play')return;score=0;coins=0;timeLeft=300;elapsed=0;camera=0;Object.assign(player,{x:130,y:370,vx:0,vy:0,grounded:false,invuln:0});buildLevel();mode='play';overlay.classList.add('hidden');tone(660,.12);requestAnimationFrame(loop)}
  startButton.addEventListener('click',start);
  document.getElementById('soundToggle').addEventListener('click',e=>{audioOn=!audioOn;e.currentTarget.querySelector('span').textContent=audioOn?'SOUND ON':'SOUND OFF';tone(520)});
  window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp',' ','ArrowDown'].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if((e.key==='Enter'||e.key===' ')&&mode!=='play')start()});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
  function drawCloud(x,y,s){const q=26*s;rect(x,y,q*2,q,'#ffffff');rect(x+q*.5,y-q*.55,q*1.2,q*1.1,'#ffffff');rect(x+q*1.3,y-q*.25,q,q*1.25,'#ffffff');rect(x+q*.2,y+q*.8,q*1.8,q*.32,'#e7f5ff')}
  function drawHills(){for(let i=0;i<12;i++){let x=i*420-camera*.24;while(x<-250)x+=5040;const y=405-(i%3)*18;ctx.fillStyle=i%2?'#72c779':'#8ad27c';ctx.beginPath();ctx.moveTo(x-110,450);ctx.quadraticCurveTo(x+80,y-120,x+260,450);ctx.fill();ctx.fillStyle='#4eae6b';ctx.beginPath();ctx.ellipse(x+72,y+7,28,48,-.3,0,Math.PI*2);ctx.ellipse(x+116,y+17,22,35,.3,0,Math.PI*2);ctx.fill();rect(x+55,y+15,8,13,'#e3ffbb');rect(x+101,y+13,8,12,'#e3ffbb')}}
  function drawGround(){for(const p of platforms){const x=p.x-camera;if(x+p.w<0||x>W)continue;rect(x,p.y,p.w,H-p.y,'#ba603e');rect(x,p.y,p.w,12,'#55b94d');rect(x,p.y+12,p.w,6,'#348a47');for(let bx=Math.floor(x/48)*48;bx<x+p.w;bx+=48){rect(bx,p.y+20,2,H-p.y,'#98472f');for(let by=p.y+22;by<H;by+=48)rect(bx,by,48,2,'#98472f');rect(bx+10,p.y+29,5,5,'#d78351')}}}
  function drawBlock(b){const x=b.x-camera;if(x<-50||x>W+50)return;if(b.type==='question'){rect(x,b.y,TILE,TILE,'#db8a29');rect(x+3,b.y+3,TILE-6,TILE-6,'#ffcb45');rect(x+9,b.y+9,30,5,'#ffe38a');rect(x+8,b.y+14,5,20,'#ffe38a');rect(x+35,b.y+15,5,21,'#df9d32');rect(x+11,b.y+34,25,5,'#df9d32');rect(x+22,b.y+12,6,16,'#fff1b2');rect(x+22,b.y+33,6,6,'#fff1b2')}else{rect(x,b.y,TILE,TILE,'#bd5b45');rect(x+3,b.y+3,TILE-6,TILE-6,'#dc7752');rect(x+22,b.y+3,4,19,'#a74d3b');rect(x+3,b.y+22,42,4,'#a74d3b');rect(x+9,b.y+26,4,19,'#a74d3b');rect(x+34,b.y+26,4,19,'#a74d3b')}}
  function drawCoin(c){if(c.taken)return;const x=c.x-camera,y=c.y+Math.sin(elapsed*5+c.bob)*5;ctx.fillStyle='#ffdb53';ctx.beginPath();ctx.ellipse(x,y,9,14,0,0,Math.PI*2);ctx.fill();rect(x-2,y-8,3,16,'#fff3a6');rect(x+7,y-5,3,10,'#e39d2c')}
  function drawPlayer(){if(player.invuln>0&&Math.floor(elapsed*14)%2)return;const x=Math.round(player.x-camera),y=Math.round(player.y),flip=player.facing<0;ctx.save();if(flip){ctx.translate(x+player.w,y);ctx.scale(-1,1)}else ctx.translate(x,y);
    // Small original pixel plumber sprite
    rect(5,0,20,6,'#a92f2d');rect(2,6,27,6,'#e9493e');rect(5,12,21,5,'#efc39a');rect(2,17,27,7,'#efc39a');rect(8,18,4,4,'#222746');rect(22,18,4,4,'#222746');rect(18,23,8,3,'#7c352e');rect(4,25,22,9,'#e9453e');rect(7,34,17,7,'#3762bb');rect(3,39,10,3,'#553329');rect(20,39,10,3,'#553329');rect(3,29,6,7,'#ffd15a');rect(21,29,6,7,'#ffd15a');ctx.restore()}
  function drawEnemy(e){if(!e.alive)return;const x=e.x-camera,y=e.y+Math.sin(elapsed*4+e.turn)*1;rect(x+3,y+9,24,19,'#9a5637');rect(x,y+13,30,13,'#ac6841');rect(x+5,y+18,7,8,'#f5e9cb');rect(x+7,y+20,3,4,'#272338');rect(x+19,y+18,7,8,'#f5e9cb');rect(x+21,y+20,3,4,'#272338');rect(x+3,y+28,10,4,'#54352c');rect(x+18,y+28,10,4,'#54352c')}
  function drawFlag(){const x=worldWidth-160-camera;rect(x,178,8,272,'#e8eee5');rect(x+8,186,73,48,'#54d58a');rect(x+8,234,57,7,'#39ab73');rect(x+2,448,45,9,'#c7d8de')}
  function draw(){rect(0,0,W,H,'#77baf1');const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#70b8f4');grad.addColorStop(.68,'#b1e2fa');grad.addColorStop(1,'#e5f7ff');rect(0,0,W,H,'#8acaf3');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);for(const c of clouds){let x=(c.x-camera*.4)%(W+180);if(x< -100)x+=W+180;drawCloud(x,c.y,c.s)}drawHills();drawGround();blocks.forEach(drawBlock);coinItems.forEach(drawCoin);drawFlag();enemies.forEach(drawEnemy);drawPlayer();}
  function collide(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
  function update(dt){elapsed+=dt;timeLeft-=dt;if(timeLeft<=0){timeLeft=0;finish(false);return}const left=keys.has('arrowleft')||keys.has('a'),right=keys.has('arrowright')||keys.has('d'),jump=keys.has(' ')||keys.has('arrowup')||keys.has('w');if(left){player.vx=-220;player.facing=-1}else if(right){player.vx=220;player.facing=1}else player.vx*=Math.pow(.001,dt);if(jump&&player.grounded){player.vy=-510;player.grounded=false;tone(330,.08)}player.vy+=1320*dt;player.x+=player.vx*dt;player.x=Math.max(0,Math.min(worldWidth-player.w,player.x));const oldBottom=player.y+player.h;player.y+=player.vy*dt;player.grounded=false;
    for(const p of platforms){if(player.x+player.w>p.x&&player.x<p.x+p.w&&oldBottom<=p.y+8&&player.y+player.h>=p.y&&player.vy>=0){player.y=p.y-player.h;player.vy=0;player.grounded=true}}
    if(player.y>H+100){finish(false);return}
    for(const b of blocks){if(player.x+player.w>b.x&&player.x<b.x+TILE&&player.y<b.y+TILE&&player.y+player.h>b.y){if(player.vy<0&&player.y>b.y+TILE-10){player.y=b.y+TILE;player.vy=40;if(b.type==='question'&&!b.used){b.used=true;score+=200;coins++;tone(780,.08);coinItems.push({x:b.x+24,y:b.y-18,taken:false,bob:0});setTimeout(()=>{const c=coinItems.find(c=>c.x===b.x+24&&!c.taken);if(c)c.taken=true},250)}else tone(130,.05)}else if(player.vx>0)player.x=b.x-player.w;else if(player.vx<0)player.x=b.x+TILE}}
    for(const c of coinItems)if(!c.taken&&collide(player,{x:c.x-9,y:c.y-14,w:18,h:28})){c.taken=true;coins++;score+=100;tone(880,.09,'square',.03)}
    if(player.invuln>0)player.invuln-=dt;
    for(const e of enemies){if(!e.alive)continue;e.x+=e.vx*60*dt;if(e.x<0||e.x>worldWidth-50)e.vx*=-1;for(const p of platforms){if(e.x+e.w>p.x&&e.x<p.x+p.w&&e.y+e.h>=p.y)e.y=p.y-e.h}if(collide(player,e)){if(player.vy>80&&player.y+player.h<e.y+18){e.alive=false;player.vy=-360;score+=200;tone(210,.1)}else if(player.invuln<=0){player.invuln=1.3;player.vx=player.x<e.x?-210:210;player.vy=-270;score=Math.max(0,score-100);tone(120,.16)}}}
    camera=Math.max(0,Math.min(worldWidth-W,player.x-W*.38));if(player.x>worldWidth-210)finish(true);scoreEl.textContent=fmt(score);coinsEl.textContent=String(coins).padStart(2,'0');timerEl.textContent=String(Math.ceil(timeLeft)).padStart(3,'0');}
  function finish(won){mode=won?'win':'over';overlayTitle.innerHTML=won?'YOU<br><em>WIN!</em>':'GAME<br><em>OVER</em>';overlayEyebrow.textContent=won?'WORLD 1-1 COMPLETE':'ONE MORE TRY?';overlayCopy.innerHTML=won?`Score ${fmt(score)} · ${coins} coins collected<br>You made it to the flag!`:`Score ${fmt(score)} · ${coins} coins collected<br>Jump back in and give it another go.`;startButton.innerHTML='PLAY AGAIN <span>↻</span>';overlay.classList.remove('hidden');const best=Math.max(score,Number(localStorage.getItem('pixelrun-high')||0));localStorage.setItem('pixelrun-high',best);highEl.textContent=fmt(best);tone(won?740:160,.3,'triangle')}
  function loop(ts){if(mode!=='play')return;const dt=Math.min(.032,(ts-last)/1000||0);last=ts;update(dt);draw();if(mode==='play')requestAnimationFrame(loop)}
  draw();
})();
