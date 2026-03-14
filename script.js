// ══════════════════════════════════════════
// CONFIG — меняй здесь 
// ══════════════════════════════════════════
const CFG = {
  particleCount  : 250,
  particleSpeed  : 6,
  connectDist    : 200,
  bubbleRatio    : 22,
  repelR         : 130,
  repelF         : 25,
  explodeForce   : 14,
  explodeR       : 180,
  lineAlpha      : 55,
  cursorRing     : true,
  sound          : true,
  typeSpeed      : 1000,

  widgetPipeline : false,
  widgetSnake    : true,
  widgetMines    : true,
  hackerMode     : false,

  linkGithub     : false,
  linkSteam      : true,
  linkContact    : true,
};

// ══════════════════════════════════════════
// LANG
// ══════════════════════════════════════════
let currentLang = 'en'; // 'en' | 'ru'

const INFO_LINES = {
  en: [
    '> whoami',
    '  Hello, im Decanon.', '',
    '> _',
  ],
  ru: [
    '> whoami',
    '  Привет, я Decanon.', '',
    '> _',
  ],
};

const SNAKE_STATUS = {
  start : { en:'PRESS SPACE / TAP TO START', ru:'ПРОБЕЛ / ТАП — СТАРТ' },
  over  : { en:'GAME OVER — SPACE / TAP TO RESTART', ru:'ИГРА ОКОНЧЕНА — ПРОБЕЛ / ТАП' },
};

const MINE_STATUS = {
  boom  : { en:'💥 BOOM',     ru:'💥 ВЗРЫВ' },
  clear : { en:'✓ CLEARED',  ru:'✓ ОЧИЩЕНО' },
};

function t(key){ return SNAKE_STATUS[key]?.[currentLang] ?? key; }
function applyLang(){
  document.querySelectorAll('.t[data-en]').forEach(el=>{
    el.textContent = el.dataset[currentLang] ?? el.dataset.en;
  });
  // Кнопка языка
  const btn = document.getElementById('btn-lang');
  if(btn){
    btn.innerHTML = currentLang==='en'
      ? '<span class="lang-active">EN</span> / RU'
      : 'EN / <span class="lang-active">RU</span>';
  }
  // Сбросить текст статуса змейки
  if(!snakeRunning){
    document.getElementById('snake-status').textContent = SNAKE_STATUS.start[currentLang];
  }
}

// ══════════════════════════════════════════
// 1. ЗВУКИ
// ══════════════════════════════════════════
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function getAudio(){ if(!audioCtx) audioCtx = new AudioCtx(); return audioCtx; }

function makeWallChain(ac, gainVal){
  const g=ac.createGain(), lpf=ac.createBiquadFilter(), lpf2=ac.createBiquadFilter();
  lpf.type='lowpass';  lpf.frequency.value=380;  lpf.Q.value=0.7;
  lpf2.type='lowpass'; lpf2.frequency.value=280; lpf2.Q.value=0.5;
  g.gain.value=gainVal;
  lpf.connect(lpf2); lpf2.connect(g); g.connect(ac.destination);
  return lpf;
}

const snd = {
  tick(){ if(!CFG.sound) return; try{
    const ac=getAudio(),osc=ac.createOscillator();
    osc.connect(makeWallChain(ac,.055)); osc.type='sine';
    osc.frequency.setValueAtTime(200+Math.random()*150,ac.currentTime);
    osc.start(); osc.stop(ac.currentTime+.055);
  }catch(e){} },

  click(){ if(!CFG.sound) return; try{
    const ac=getAudio(),osc=ac.createOscillator();
    osc.connect(makeWallChain(ac,.09)); osc.type='sine';
    osc.frequency.setValueAtTime(90,ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40,ac.currentTime+.15);
    osc.start(); osc.stop(ac.currentTime+.15);
  }catch(e){} },

  hackerOn(){ if(!CFG.sound) return; try{
    const ac=getAudio();
    [440,380,320,260,200].forEach((f,i)=>{
      const osc=ac.createOscillator();
      osc.connect(makeWallChain(ac,.06)); osc.type='sawtooth';
      osc.frequency.value=f;
      osc.start(ac.currentTime+i*.04);
      osc.stop(ac.currentTime+i*.04+.06);
    });
    setTimeout(()=>{
      try{
        const buf=ac.createBuffer(1,ac.sampleRate*.2,ac.sampleRate);
        const d=buf.getChannelData(0);
        for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length)*.4;
        const src=ac.createBufferSource(); src.buffer=buf;
        src.connect(makeWallChain(ac,.12)); src.start(); src.stop(ac.currentTime+.2);
      }catch(e){}
    },220);
  }catch(e){} },

  hackerTick(){ if(!CFG.sound) return; try{
    const ac=getAudio(),osc=ac.createOscillator();
    osc.connect(makeWallChain(ac,.025)); osc.type='square';
    osc.frequency.setValueAtTime(80+Math.random()*40,ac.currentTime);
    osc.start(); osc.stop(ac.currentTime+.03);
  }catch(e){} },

  explosion(){ if(!CFG.sound) return; try{
    const ac=getAudio();
    const buf=ac.createBuffer(1,ac.sampleRate*.35,ac.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
    const src=ac.createBufferSource(); src.buffer=buf;
    src.connect(makeWallChain(ac,.18)); src.start(); src.stop(ac.currentTime+.35);
  }catch(e){} },

  snakeEat(){ if(!CFG.sound) return; try{
    const ac=getAudio(),osc=ac.createOscillator();
    osc.connect(makeWallChain(ac,.07)); osc.type='sine';
    osc.frequency.setValueAtTime(110,ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180,ac.currentTime+.09);
    osc.start(); osc.stop(ac.currentTime+.09);
  }catch(e){} },

  snakeDie(){ if(!CFG.sound) return; try{
    const ac=getAudio(),osc=ac.createOscillator();
    osc.connect(makeWallChain(ac,.13)); osc.type='sine';
    osc.frequency.setValueAtTime(120,ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(28,ac.currentTime+.5);
    osc.start(); osc.stop(ac.currentTime+.5);
  }catch(e){} },

  mineFlag(){ if(!CFG.sound) return; try{
    const ac=getAudio(),osc=ac.createOscillator();
    osc.connect(makeWallChain(ac,.06)); osc.type='square';
    osc.frequency.setValueAtTime(200,ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140,ac.currentTime+.07);
    osc.start(); osc.stop(ac.currentTime+.07);
  }catch(e){} },

  mineReveal(){ if(!CFG.sound) return; try{
    const ac=getAudio(),osc=ac.createOscillator();
    osc.connect(makeWallChain(ac,.04)); osc.type='sine';
    osc.frequency.setValueAtTime(160,ac.currentTime);
    osc.start(); osc.stop(ac.currentTime+.03);
  }catch(e){} },

  mineBoom(){ if(!CFG.sound) return; try{
    const ac=getAudio();
    const buf=ac.createBuffer(1,ac.sampleRate*.45,ac.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.5);
    const src=ac.createBufferSource(); src.buffer=buf;
    src.connect(makeWallChain(ac,.25)); src.start(); src.stop(ac.currentTime+.45);
  }catch(e){} },

  mineWin(){ if(!CFG.sound) return; try{
    const ac=getAudio();
    [220,330,440,550].forEach((freq,i)=>{
      const osc=ac.createOscillator();
      osc.connect(makeWallChain(ac,.07)); osc.type='sine';
      osc.frequency.value=freq;
      osc.start(ac.currentTime+i*.09); osc.stop(ac.currentTime+i*.09+.12);
    });
  }catch(e){} },
};

// ══════════════════════════════════════════
// 2. КАСТОМНЫЙ КУРСОР
// ══════════════════════════════════════════
const curDot=document.getElementById('cursor-dot');
const curRing=document.getElementById('cursor-ring');
let curX=0,curY=0,ringX=0,ringY=0;
document.addEventListener('mousemove',e=>{ curX=e.clientX; curY=e.clientY; });
(function animateCursor(){
  curDot.style.left=curX+'px'; curDot.style.top=curY+'px';
  ringX+=(curX-ringX)*.12; ringY+=(curY-ringY)*.12;
  curRing.style.left=ringX+'px'; curRing.style.top=ringY+'px';
  requestAnimationFrame(animateCursor);
})();

function addHover(el){
  el.addEventListener('mouseenter',()=>document.body.classList.add('cursor-hover'));
  el.addEventListener('mouseleave',()=>document.body.classList.remove('cursor-hover'));
}
document.querySelectorAll('button,a').forEach(addHover);
document.addEventListener('mousedown',()=>{
  document.body.classList.add('cursor-click');
  setTimeout(()=>document.body.classList.remove('cursor-click'),150);
});
if(!CFG.cursorRing) document.body.classList.add('no-ring');

// ══════════════════════════════════════════
// 3. ФОНОВЫЙ CANVAS
// ══════════════════════════════════════════
const canvas=document.getElementById('bg-canvas');
const ctx=canvas.getContext('2d');
let W,H;
function resize(){ W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; }
resize();
window.addEventListener('resize',()=>{ resize(); rebuildParticles(); matrixResize(); });

const mouse={x:-9999,y:-9999};
window.addEventListener('mousemove',e=>{ mouse.x=e.clientX; mouse.y=e.clientY; });
window.addEventListener('mouseleave',()=>{ mouse.x=-9999; mouse.y=-9999; });

const explosions=[];
window.addEventListener('click',e=>{
  if(e.target!==canvas && e.target!==matrixCanvas) return;
  explosions.push({x:e.clientX,y:e.clientY,t:0});
  explodeParticles(e.clientX,e.clientY);
  snd.explosion();
});

class Particle{
  constructor(initial=false){ this.init(initial); }
  init(initial=false){
    if(initial){ this.x=Math.random()*W; this.y=Math.random()*H; }
    else{
      const edge=Math.floor(Math.random()*4);
      if(edge===0){this.x=Math.random()*W;this.y=0;}
      else if(edge===1){this.x=W;this.y=Math.random()*H;}
      else if(edge===2){this.x=Math.random()*W;this.y=H;}
      else{this.x=0;this.y=Math.random()*H;}
    }
    const spd=(CFG.particleSpeed*0.1)*(0.4+Math.random()*0.8);
    const angle=Math.random()*Math.PI*2;
    this.vx=Math.cos(angle)*spd; this.vy=Math.sin(angle)*spd;
    this.bubble=Math.random()*100 < CFG.bubbleRatio;
    this.r=this.bubble?4.5+Math.random()*3.5:1.8+Math.random()*1.8;
    this.alpha=this.bubble?0.25+Math.random()*.30:0.35+Math.random()*.45;
    this.pulseSpeed=0.018+Math.random()*.022;
    this.pulseOffset=Math.random()*Math.PI*2;
  }
  update(){
    const spd0=CFG.particleSpeed*0.1;
    const mdx=this.x-mouse.x,mdy=this.y-mouse.y,md2=mdx*mdx+mdy*mdy;
    const rR=CFG.repelR;
    if(md2<rR*rR&&md2>.01){
      const md=Math.sqrt(md2),f=(1-md/rR)*(CFG.repelF*0.1);
      this.vx+=(mdx/md)*f*.08; this.vy+=(mdy/md)*f*.08;
    }
    const spd=Math.sqrt(this.vx*this.vx+this.vy*this.vy);
    if(spd>spd0*3.5){ this.vx=(this.vx/spd)*spd0*3.5; this.vy=(this.vy/spd)*spd0*3.5; }
    if(spd<spd0*.2){ const a=Math.random()*Math.PI*2; this.vx+=Math.cos(a)*.05; this.vy+=Math.sin(a)*.05; }
    this.x+=this.vx; this.y+=this.vy;
  }
  draw(t){
    const hk=CFG.hackerMode;
    const bc=hk?'0,255,102':'255,255,255';
    ctx.save();
    if(this.bubble){
      const pulse=1+.18*Math.sin(t*this.pulseSpeed+this.pulseOffset),r=this.r*pulse;
      const grd=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,r*2.8);
      grd.addColorStop(0,`rgba(${bc},${this.alpha})`);
      grd.addColorStop(.45,`rgba(${bc},${this.alpha*.35})`);
      grd.addColorStop(1,`rgba(${bc},0)`);
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(this.x,this.y,r*2.8,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=this.alpha*.9; ctx.fillStyle=hk?'#00ff66':'#fff';
      ctx.beginPath(); ctx.arc(this.x,this.y,r,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=this.alpha*.3; ctx.strokeStyle=hk?'#00ff66':'#fff'; ctx.lineWidth=.5;
      ctx.beginPath(); ctx.arc(this.x,this.y,r*1.6,0,Math.PI*2); ctx.stroke();
    } else {
      ctx.globalAlpha=this.alpha; ctx.fillStyle=hk?'#00ff66':'#fff';
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=this.alpha*.15;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r*2.5,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

function explodeParticles(cx,cy){
  particles.forEach(p=>{
    const dx=p.x-cx,dy=p.y-cy,dist=Math.sqrt(dx*dx+dy*dy);
    if(dist<CFG.explodeR&&dist>.01){
      const f=(1-dist/CFG.explodeR)*CFG.explodeForce;
      p.vx+=(dx/dist)*f; p.vy+=(dy/dist)*f;
    }
  });
}

function drawConnections(){
  const D=CFG.connectDist, D2=D*D, maxA=CFG.lineAlpha/100;
  const hk=CFG.hackerMode;
  for(let i=0;i<particles.length;i++){
    const a=particles[i];
    for(let j=i+1;j<particles.length;j++){
      const b=particles[j],dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy;
      if(d2<D2){
        const tt=1-d2/D2;
        ctx.save(); ctx.globalAlpha=tt*tt*maxA;
        ctx.strokeStyle=hk?'#00ff66':'#fff'; ctx.lineWidth=tt*1.1;
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        ctx.restore();
      }
    }
  }
}

let particles=[];
function initParticles(){ particles=Array.from({length:CFG.particleCount},()=>new Particle(true)); }
function rebuildParticles(){
  const prev=particles.length;
  if(CFG.particleCount>prev) for(let i=prev;i<CFG.particleCount;i++) particles.push(new Particle(true));
  else particles.length=CFG.particleCount;
}
initParticles();

let tick=0;
(function bgLoop(){
  ctx.clearRect(0,0,W,H); tick++;
  drawConnections();
  const hk=CFG.hackerMode;
  for(let i=explosions.length-1;i>=0;i--){
    const ex=explosions[i]; ex.t++;
    const progress=ex.t/28;
    if(progress>=1){explosions.splice(i,1);continue;}
    const eo=1-Math.pow(1-progress,3);
    if(progress<.35){
      const fa=(1-progress/.35)*.45,fr=eo*90;
      const grd=ctx.createRadialGradient(ex.x,ex.y,0,ex.x,ex.y,fr);
      grd.addColorStop(0,hk?`rgba(0,255,102,${fa})`:`rgba(255,255,255,${fa})`);
      grd.addColorStop(.5,hk?`rgba(0,200,80,${fa*.4})`:`rgba(200,200,200,${fa*.4})`);
      grd.addColorStop(1,'rgba(0,0,0,0)');
      ctx.save(); ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(ex.x,ex.y,fr,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    const rR=eo*CFG.explodeR*1.1,rA=(1-progress)*.7;
    ctx.save(); ctx.globalAlpha=rA; ctx.strokeStyle=hk?'#00ff66':'#fff'; ctx.lineWidth=(1-progress)*2.5;
    ctx.beginPath(); ctx.arc(ex.x,ex.y,rR,0,Math.PI*2); ctx.stroke(); ctx.restore();
    if(progress>.12){
      const r2=eo*CFG.explodeR*.6;
      ctx.save(); ctx.globalAlpha=(1-progress)*.35; ctx.strokeStyle=hk?'#00aa44':'#aaa'; ctx.lineWidth=(1-progress)*1.2;
      ctx.beginPath(); ctx.arc(ex.x,ex.y,r2,0,Math.PI*2); ctx.stroke(); ctx.restore();
    }
  }
  const margin=80;
  particles.forEach(p=>{ p.update(); if(p.x<-margin||p.x>W+margin||p.y<-margin||p.y>H+margin) p.init(false); p.draw(tick); });
  requestAnimationFrame(bgLoop);
})();

// ══════════════════════════════════════════
// 4. MATRIX RAIN
// ══════════════════════════════════════════
const matrixCanvas=document.getElementById('matrix-canvas');
const mCtx=matrixCanvas.getContext('2d');
const MATRIX_CHARS='アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン01234567890ABCDEF!@#$%^&*<>?/\\|{}[]~';
let mCols=[], mFontSize=14, mRunning=false;

function matrixResize(){
  matrixCanvas.width=window.innerWidth;
  matrixCanvas.height=window.innerHeight;
  const cols=Math.floor(matrixCanvas.width/mFontSize);
  mCols=Array.from({length:cols},()=>Math.random()*-100);
}
matrixResize();

function matrixStep(){
  if(!CFG.hackerMode){ mRunning=false; return; }
  mRunning=true;
  mCtx.fillStyle='rgba(0,8,0,0.07)';
  mCtx.fillRect(0,0,matrixCanvas.width,matrixCanvas.height);
  mCtx.font=`${mFontSize}px 'Courier New', monospace`;
  for(let i=0;i<mCols.length;i++){
    const ch=MATRIX_CHARS[Math.floor(Math.random()*MATRIX_CHARS.length)];
    const y=mCols[i]*mFontSize;
    const bright=Math.random()>.85;
    mCtx.fillStyle=bright?'#ccffdd':`rgba(0,${Math.floor(180+Math.random()*75)},${Math.floor(40+Math.random()*40)},${0.6+Math.random()*.4})`;
    mCtx.fillText(ch,i*mFontSize,y);
    if(y>matrixCanvas.height&&Math.random()>.975) mCols[i]=0;
    else mCols[i]+=.5+Math.random()*.5;
    if(Math.random()>.998) snd.hackerTick();
  }
  requestAnimationFrame(matrixStep);
}

// ══════════════════════════════════════════
// 5. HUD
// ══════════════════════════════════════════
const hkTime=document.getElementById('hk-time');
const hkMem=document.getElementById('hk-mem');
const hkStatus=document.getElementById('hk-status');
const HK_STATUSES=['IDLE','SCANNING...','ENCRYPTING','CONNECTED','BYPASSING...','INJECTING','TRACING...','EXECUTING'];
let hkStatusIdx=0;

setInterval(()=>{
  if(!CFG.hackerMode) return;
  const now=new Date();
  const p=n=>String(n).padStart(2,'0');
  hkTime.textContent=`${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
  hkMem.textContent=Math.floor(200+Math.random()*600);
  if(Math.random()>.7){ hkStatusIdx=(hkStatusIdx+1)%HK_STATUSES.length; hkStatus.textContent=HK_STATUSES[hkStatusIdx]; }
},1000);

// ══════════════════════════════════════════
// 6. HACKER MODE
// ══════════════════════════════════════════
function applyHackerMode(on){
  CFG.hackerMode=on;
  document.body.classList.toggle('hacker',on);
  const btn=document.getElementById('btn-hacker');
  if(btn) btn.classList.toggle('hacker-on',on);
  if(on){
    if(!mRunning) matrixStep();
    snd.hackerOn();
  } else {
    mCtx.clearRect(0,0,matrixCanvas.width,matrixCanvas.height);
  }
}

// ══════════════════════════════════════════
// 7. TYPING
// ══════════════════════════════════════════
function typeLines(lines,outputEl,onDone){
  const fullText=lines.join('\n');
  const msPerChar=CFG.typeSpeed/fullText.length;
  let i=0;
  const cursor=document.createElement('span');
  cursor.className='cursor';
  outputEl.innerHTML=''; outputEl.appendChild(cursor);
  function next(){
    if(i>=fullText.length){if(onDone)onDone();return;}
    snd.tick();
    outputEl.insertBefore(document.createTextNode(fullText[i]),cursor);
    i++;
    setTimeout(next,msPerChar+Math.random()*msPerChar*.2);
  }
  next();
}

// ══════════════════════════════════════════
// 8. PIPELINE
// ══════════════════════════════════════════
const pipelineOutput=document.getElementById('pipeline-output');
const pipelineRunBtn=document.getElementById('pipeline-run-btn');

const SOURCES=['PostgreSQL','Kafka topic','S3 bucket','REST API','MySQL replica','BigQuery','Redis stream','MongoDB','Snowflake','DynamoDB'];
const TARGETS=['Data Warehouse','ClickHouse','Parquet lake','Elasticsearch','Redshift','BigQuery','Delta Lake'];
const WARN_COLS=['revenue','user_id','created_at','session_duration','event_type','price_usd','latitude','api_response_ms'];
const STRATEGIES=['fill_mean','fill_median','drop_rows','fill_zero','forward_fill','interpolate'];
const TRANSFORMS=['normalize → deduplicate → cast','hash_pii → type_cast → sort','flatten_json → coalesce → reorder','parse_dates → trim → validate_schema','explode_arrays → dedup → aggregate','window_fn → rank → pivot'];
const VERSIONS=['1.4.2','2.0.1','2.1.0','3.0.0-rc','1.9.7','2.3.4'];
const COLUMNS=[18,24,31,42,56,67,88,104];

function rnd(a){ return a[Math.floor(Math.random()*a.length)]; }
function rndInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function fmtN(n){ return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g,','); }

function buildPipelineScript(){
  const source=rnd(SOURCES),target=rnd(TARGETS),cols=rnd(COLUMNS);
  const warnCol=rnd(WARN_COLS),nullPct=(1+Math.random()*8).toFixed(1);
  const strategy=rnd(STRATEGIES),transform=rnd(TRANSFORMS);
  const shard=rndInt(3,14),version=rnd(VERSIONS);
  const rowBase=rndInt(64,512)*1024,row2=rowBase*rndInt(3,6),rowFinal=row2*rndInt(2,4);
  const duration=(3.5+Math.random()*4).toFixed(2);
  const warnings=rndInt(1,4),hasRetry=Math.random()>.35;
  const retryShrd=`shard-0${shard}`;

  let t=0; const sc=[];
  const push=(cls,text,gap=150)=>{ sc.push({delay:t,cls,text}); t+=gap; };

  push('log-muted','──────────────────────────────────────',80);
  push('log-white',`[DECANON PIPELINE v${version}]`,80);
  push('log-muted',`source : ${source}`,60);
  push('log-muted',`target : ${target}`,80);
  push('log-muted','──────────────────────────────────────',200);
  push('log-info','[INFO]  Initializing context...',400);
  push('log-info',`[INFO]  Connecting to ${source}  ████████░░  80%`,380);
  push('log-info',`[INFO]  Connecting to ${source}  ██████████ 100% ✓`,250);
  push('log-info','[INFO]  Extracting schema...',450);
  if(Math.random()>.4) push('log-warn',`[WARN]  Deprecated column: ${warnCol}_old`,200);
  push('log-info',`[INFO]  Schema validated (${cols} columns)`,300);
  push('log-info','[INFO]  Starting extraction...',400);
  push('log-info',`[INFO]  Rows read: ${fmtN(rowBase)}`,280);
  push('log-info',`[INFO]  Rows read: ${fmtN(row2)}`,280);
  push('log-info',`[INFO]  Rows read: ${fmtN(rowFinal)}`,300);
  push('log-warn', `[WARN]  NULL values in col: ${warnCol} (${nullPct}%)`,200);
  push('log-info', `[INFO]  Applying NULL strategy: ${strategy}`,300);
  push('log-info', `[INFO]  Transforming: ${transform}`,350);
  if(hasRetry){
    push('log-error',`[ERROR] Connection timeout on ${retryShrd}`,250);
    push('log-warn', `[RETRY] Attempt 1/3... reconnecting`,420);
    if(Math.random()>.5) push('log-warn',`[RETRY] Attempt 2/3... reconnecting`,400);
    push('log-info', `[INFO]  ${retryShrd} recovered ✓`,300);
  }
  push('log-info',`[INFO]  Loading to ${target}...`,350);
  push('log-info','[INFO]  ████████████████░░░░░░  65%',320);
  push('log-info','[INFO]  ██████████████████████ 100% ✓',280);
  push('log-muted','──────────────────────────────────────',100);
  push('log-white','[SUCCESS] Pipeline complete',60);
  push('log-muted',`         Rows loaded : ${fmtN(rowFinal)}`,50);
  push('log-muted',`         Duration    : ${duration}s`,50);
  push('log-muted',`         Warnings    : ${warnings}`,50);
  push('log-muted','──────────────────────────────────────',50);
  return sc;
}

let pipelineRunning=false;
function runPipeline(){
  if(pipelineRunning) return;
  pipelineRunning=true; pipelineRunBtn.disabled=true;
  pipelineOutput.innerHTML='';
  const script=buildPipelineScript();
  script.forEach(({delay,cls,text})=>{
    setTimeout(()=>{
      const line=document.createElement('div');
      line.className=cls; line.textContent=text;
      pipelineOutput.appendChild(line);
      pipelineOutput.scrollTop=pipelineOutput.scrollHeight;
      snd.tick();
    },delay);
  });
  setTimeout(()=>{ pipelineRunning=false; pipelineRunBtn.disabled=false; },
    script[script.length-1].delay+600);
}
pipelineRunBtn.addEventListener('click',()=>{ snd.click(); runPipeline(); });

// ══════════════════════════════════════════
// 9. SNAKE
// ══════════════════════════════════════════
const snakeCanvas=document.getElementById('snake-canvas');
const sCtx=snakeCanvas.getContext('2d');
const snakeScoreEl=document.getElementById('snake-score');
const snakeStatusEl=document.getElementById('snake-status');
const CELL=16,SCOLS=24,SROWS=18;
snakeCanvas.width=SCOLS*CELL; snakeCanvas.height=SROWS*CELL;
let snake,dir,nextDir,food,snakeRunning=false,snakeInterval;

function snakeInit(){
  snake=[{x:12,y:9},{x:11,y:9},{x:10,y:9}];
  dir={x:1,y:0}; nextDir={x:1,y:0}; snakeRunning=false;
  snakeScoreEl.textContent='SCORE: 0';
  snakeStatusEl.textContent=SNAKE_STATUS.start[currentLang];
  placeFood(); snakeDraw();
}
function placeFood(){
  do{ food={x:Math.floor(Math.random()*SCOLS),y:Math.floor(Math.random()*SROWS)}; }
  while(snake.some(s=>s.x===food.x&&s.y===food.y));
}
function snakeStep(){
  dir={...nextDir};
  const hx=(snake[0].x+dir.x+SCOLS)%SCOLS;
  const hy=(snake[0].y+dir.y+SROWS)%SROWS;
  const h={x:hx,y:hy};
  if(snake.some(s=>s.x===h.x&&s.y===h.y)){snakeDie();return;}
  snake.unshift(h);
  if(h.x===food.x&&h.y===food.y){
    snakeScoreEl.textContent='SCORE: '+(snake.length-3);
    snd.snakeEat(); placeFood();
  } else { snake.pop(); }
  snakeDraw();
}
function snakeDie(){
  clearInterval(snakeInterval); snakeRunning=false; snd.snakeDie();
  snakeStatusEl.textContent=SNAKE_STATUS.over[currentLang];
  let b=0; const bi=setInterval(()=>{snakeDraw(b%2===0);b++;if(b>6)clearInterval(bi);},120);
}
function snakeDraw(dim=false){
  const hk=CFG.hackerMode;
  sCtx.clearRect(0,0,snakeCanvas.width,snakeCanvas.height);
  sCtx.fillStyle=hk?'#000800':'#0a0a0a';
  sCtx.fillRect(0,0,snakeCanvas.width,snakeCanvas.height);

  sCtx.fillStyle=hk?'rgba(0,255,102,0.06)':'rgba(255,255,255,0.04)';
  for(let x=0;x<SCOLS;x++) for(let y=0;y<SROWS;y++)
    sCtx.fillRect(x*CELL+CELL/2-0.5,y*CELL+CELL/2-0.5,1,1);

  sCtx.save();
  sCtx.strokeStyle=hk?`rgba(0,255,102,${dim?.2:.9})`:`rgba(255,255,255,${dim?.2:.9})`;
  sCtx.lineWidth=1;
  sCtx.shadowColor=hk?'#00ff66':'#ffffff';
  sCtx.shadowBlur=dim?0:14;
  sCtx.strokeRect(food.x*CELL+2,food.y*CELL+2,CELL-4,CELL-4);
  sCtx.restore();

  snake.forEach((s,i)=>{
    const tt=(snake.length-i)/snake.length;
    const alpha=dim?0.12:(i===0?0.95:0.2+tt*0.6);
    sCtx.save();
    sCtx.fillStyle=hk?`rgba(0,255,102,${alpha})`:`rgba(255,255,255,${alpha})`;
    if(i===0){ sCtx.shadowColor=hk?'#00ff66':'#ffffff'; sCtx.shadowBlur=10; }
    const pad=i===0?0:1;
    sCtx.fillRect(s.x*CELL+pad,s.y*CELL+pad,CELL-pad*2,CELL-pad*2);
    sCtx.restore();
  });
}
function snakeStart(){
  if(snakeRunning) return;
  snakeInit(); snakeRunning=true;
  snakeStatusEl.textContent='';
  snakeInterval=setInterval(snakeStep,110);
}

// ══════════════════════════════════════════
// 10. MINESWEEPER
// ══════════════════════════════════════════
const MINE_COLS=16,MINE_ROWS=12,MINE_COUNT=24;
const minesBoard=document.getElementById('mines-board');
const minesLeftEl=document.getElementById('mines-left');
const minesStatusEl=document.getElementById('mines-status');
const minesRestartBtn=document.getElementById('mines-restart-btn');
minesBoard.style.gridTemplateColumns=`repeat(${MINE_COLS},24px)`;

let mineGrid,mineRevealed,mineFlagged,mineGameOver,mineFirstClick,mineFlags;

function mineInit(){
  mineGrid=Array.from({length:MINE_ROWS},()=>Array(MINE_COLS).fill(0));
  mineRevealed=Array.from({length:MINE_ROWS},()=>Array(MINE_COLS).fill(false));
  mineFlagged=Array.from({length:MINE_ROWS},()=>Array(MINE_COLS).fill(false));
  mineGameOver=false; mineFirstClick=true; mineFlags=MINE_COUNT;
  minesLeftEl.textContent=MINE_COUNT; minesStatusEl.textContent='';
  mineRender();
}
function minePlaceMines(sx,sy){
  let p=0;
  while(p<MINE_COUNT){
    const x=Math.floor(Math.random()*MINE_COLS),y=Math.floor(Math.random()*MINE_ROWS);
    if(mineGrid[y][x]===-1) continue;
    if(Math.abs(x-sx)<=1&&Math.abs(y-sy)<=1) continue;
    mineGrid[y][x]=-1; p++;
  }
  for(let y=0;y<MINE_ROWS;y++) for(let x=0;x<MINE_COLS;x++){
    if(mineGrid[y][x]===-1) continue;
    let c=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      const ny=y+dy,nx=x+dx;
      if(ny>=0&&ny<MINE_ROWS&&nx>=0&&nx<MINE_COLS&&mineGrid[ny][nx]===-1) c++;
    }
    mineGrid[y][x]=c;
  }
}
function mineReveal(x,y){
  if(x<0||x>=MINE_COLS||y<0||y>=MINE_ROWS) return;
  if(mineRevealed[y][x]||mineFlagged[y][x]) return;
  mineRevealed[y][x]=true;
  if(mineGrid[y][x]===0)
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) mineReveal(x+dx,y+dy);
}
function mineCheckWin(){
  for(let y=0;y<MINE_ROWS;y++) for(let x=0;x<MINE_COLS;x++)
    if(mineGrid[y][x]!==-1&&!mineRevealed[y][x]) return false;
  return true;
}
function mineRender(){
  minesBoard.innerHTML='';
  for(let y=0;y<MINE_ROWS;y++) for(let x=0;x<MINE_COLS;x++){
    const cell=document.createElement('div');
    cell.className='mine-cell';
    const revealed=mineRevealed[y][x],flagged=mineFlagged[y][x],val=mineGrid[y][x];
    if(!revealed){
      cell.classList.add(flagged?'flagged':'covered');
      cell.textContent=flagged?'⚑':'';
    } else {
      cell.classList.add('revealed');
      if(val===-1){ cell.classList.add('mine-hit'); cell.textContent='✸'; }
      else if(val>0){ cell.classList.add(`n${val}`); cell.textContent=val; }
    }
    cell.addEventListener('click',e=>{
      e.stopPropagation();
      if(mineGameOver||revealed||flagged) return;
      if(mineFirstClick){ minePlaceMines(x,y); mineFirstClick=false; }
      if(mineGrid[y][x]===-1){
        mineGameOver=true; snd.mineBoom();
        for(let ry=0;ry<MINE_ROWS;ry++) for(let rx=0;rx<MINE_COLS;rx++)
          if(mineGrid[ry][rx]===-1) mineRevealed[ry][rx]=true;
        minesStatusEl.textContent=MINE_STATUS.boom[currentLang]; mineRender(); return;
      }
      snd.mineReveal(); mineReveal(x,y);
      if(mineCheckWin()){ mineGameOver=true; snd.mineWin(); minesStatusEl.textContent=MINE_STATUS.clear[currentLang]; }
      mineRender();
    });
    cell.addEventListener('contextmenu',e=>{
      e.preventDefault();
      if(mineGameOver||revealed) return;
      if(!flagged&&mineFlags===0) return;
      mineFlagged[y][x]=!flagged;
      mineFlags+=flagged?1:-1;
      minesLeftEl.textContent=mineFlags;
      snd.mineFlag(); mineRender();
    });
    cell.addEventListener('dblclick',e=>{
      if(!revealed||val<=0||mineGameOver) return;
      let flags=0;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
        const ny=y+dy,nx=x+dx;
        if(ny>=0&&ny<MINE_ROWS&&nx>=0&&nx<MINE_COLS&&mineFlagged[ny][nx]) flags++;
      }
      if(flags===val){
        for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
          const ny=y+dy,nx=x+dx;
          if(ny>=0&&ny<MINE_ROWS&&nx>=0&&nx<MINE_COLS&&!mineFlagged[ny][nx]&&!mineRevealed[ny][nx]){
            if(mineGrid[ny][nx]===-1){
              mineGameOver=true; snd.mineBoom();
              for(let ry=0;ry<MINE_ROWS;ry++) for(let rx=0;rx<MINE_COLS;rx++)
                if(mineGrid[ry][rx]===-1) mineRevealed[ry][rx]=true;
              minesStatusEl.textContent=MINE_STATUS.boom[currentLang]; mineRender(); return;
            }
            mineReveal(nx,ny);
          }
        }
        snd.mineReveal();
        if(mineCheckWin()){ mineGameOver=true; snd.mineWin(); minesStatusEl.textContent=MINE_STATUS.clear[currentLang]; }
        mineRender();
      }
    });
    addHover(cell);
    minesBoard.appendChild(cell);
  }
}
minesRestartBtn.addEventListener('click',()=>{ snd.click(); mineInit(); });

// ══════════════════════════════════════════
// 11. UI НАВИГАЦИЯ
// ══════════════════════════════════════════
const enterBtn   =document.getElementById('enter-btn');
const mainScreen =document.getElementById('main-screen');
const infoScreen =document.getElementById('info-screen');
const typedOut   =document.getElementById('typed-output');
const infoLinks  =document.getElementById('info-links');
const closeBtn   =document.getElementById('close-btn');

const layerEls={
  info:     document.getElementById('layer-info'),
  pipeline: document.getElementById('layer-pipeline'),
  snake:    document.getElementById('layer-snake'),
  mines:    document.getElementById('layer-mines'),
};
const tabBtns={
  info:     document.getElementById('btn-info'),
  pipeline: document.getElementById('btn-pipeline'),
  snake:    document.getElementById('btn-snake'),
  mines:    document.getElementById('btn-mines'),
};

let currentLayer='info';
let typingDone=false;

function isWidgetEnabled(name){
  if(name==='info') return true;
  if(name==='pipeline') return !!CFG.widgetPipeline;
  if(name==='snake')    return !!CFG.widgetSnake;
  if(name==='mines')    return !!CFG.widgetMines;
  return true;
}
function firstEnabledLayer(){
  return ['info','snake','mines','pipeline'].find(isWidgetEnabled)||'info';
}

function showLayer(name){
  if(!isWidgetEnabled(name)) name=firstEnabledLayer();
  Object.values(layerEls).forEach(el=>el.classList.remove('active'));
  Object.values(tabBtns).forEach(b=>b.classList.remove('active-tab'));
  layerEls[name].classList.add('active');
  tabBtns[name].classList.add('active-tab');
  currentLayer=name;
  if(name==='snake')    snakeInit();
  if(name==='pipeline') runPipeline();
  if(name==='mines')    mineInit();
  if(name==='info'&&!typingDone){
    infoLinks.classList.add('hidden');
    typeLines(INFO_LINES[currentLang],typedOut,()=>{
      typingDone=true;
      infoLinks.classList.remove('hidden');
    });
  } else if(name==='info'&&typingDone){
    infoLinks.classList.remove('hidden');
  }
}

Object.entries(tabBtns).forEach(([name,btn])=>{
  btn.addEventListener('click',()=>{ snd.click(); showLayer(name); });
});

// Hacker btn
const btnHacker=document.getElementById('btn-hacker');
btnHacker.addEventListener('click',()=>{
  snd.click();
  applyHackerMode(!CFG.hackerMode);
});

// Lang btn
const btnLang=document.getElementById('btn-lang');
btnLang.addEventListener('click',()=>{
  snd.click();
  currentLang=currentLang==='en'?'ru':'en';
  applyLang();
  // Если INFO открыт и уже напечатан — перепечатать на новом языке
  if(currentLayer==='info'){
    typingDone=false;
    infoLinks.classList.add('hidden');
    typeLines(INFO_LINES[currentLang],typedOut,()=>{
      typingDone=true;
      infoLinks.classList.remove('hidden');
    });
  }
});

function setVisible(el,visible){
  if(!el) return;
  el.style.display=visible?'':'none';
}
function applyVisibility(){
  setVisible(tabBtns.pipeline,CFG.widgetPipeline);
  setVisible(layerEls.pipeline,CFG.widgetPipeline);
  setVisible(tabBtns.snake,CFG.widgetSnake);
  setVisible(layerEls.snake,CFG.widgetSnake);
  setVisible(tabBtns.mines,CFG.widgetMines);
  setVisible(layerEls.mines,CFG.widgetMines);
  setVisible(document.getElementById('link-github'),CFG.linkGithub);
  setVisible(document.getElementById('link-steam'),CFG.linkSteam);
  setVisible(document.getElementById('link-contact'),CFG.linkContact);
  if(!isWidgetEnabled(currentLayer)) showLayer(firstEnabledLayer());
}

function openInfo(){
  enterBtn.querySelector('.btn-text').textContent='OPEN';
  enterBtn.classList.add('clicked'); snd.click();
  setTimeout(()=>{
    canvas.classList.add('dimmed');
    mainScreen.classList.add('hidden');
    infoScreen.classList.add('visible');
    Object.values(layerEls).forEach(el=>el.classList.remove('active'));
    Object.values(tabBtns).forEach(b=>b.classList.remove('active-tab'));
    showLayer('info');
  },380);
}

function closeInfo(){
  infoScreen.classList.remove('visible');
  canvas.classList.remove('dimmed');
  mainScreen.classList.remove('hidden');
  enterBtn.classList.remove('clicked');
  if(snakeRunning){ clearInterval(snakeInterval); snakeRunning=false; }
}

enterBtn.addEventListener('click',openInfo);
closeBtn.addEventListener('click',()=>{ snd.click(); closeInfo(); });

document.addEventListener('keydown',e=>{
  if(currentLayer==='snake'){
    if(e.code==='Space'){e.preventDefault();snakeStart();return;}
    if(e.key==='ArrowUp'   &&dir.y!==1)  nextDir={x:0,y:-1};
    if(e.key==='ArrowDown' &&dir.y!==-1) nextDir={x:0,y:1};
    if(e.key==='ArrowLeft' &&dir.x!==1)  nextDir={x:-1,y:0};
    if(e.key==='ArrowRight'&&dir.x!==-1) nextDir={x:1,y:0};
  }
  if(e.key==='Escape'&&infoScreen.classList.contains('visible')) closeInfo();
});

let tStartX=0,tStartY=0;
snakeCanvas.addEventListener('touchstart',e=>{
  tStartX=e.touches[0].clientX; tStartY=e.touches[0].clientY;
  if(!snakeRunning) snakeStart(); e.preventDefault();
},{passive:false});
snakeCanvas.addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-tStartX,dy=e.changedTouches[0].clientY-tStartY;
  if(Math.abs(dx)>Math.abs(dy)){
    if(dx>20&&dir.x!==-1) nextDir={x:1,y:0};
    else if(dx<-20&&dir.x!==1) nextDir={x:-1,y:0};
  } else {
    if(dy>20&&dir.y!==-1) nextDir={x:0,y:1};
    else if(dy<-20&&dir.y!==1) nextDir={x:0,y:-1};
  }
  e.preventDefault();
},{passive:false});

// Инициализация
applyVisibility();
applyLang();



