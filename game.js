(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const shell = document.getElementById('gameShell');
  const $ = (id) => document.getElementById(id);
  const ui = { intro: $('introOverlay'), pause: $('pauseOverlay'), result: $('resultOverlay'), hud: $('hud'), health: $('healthFill'), healthText: $('healthText'), ammo: $('ammoText'), wave: $('waveText'), status: $('waveStatus'), day: $('dayLabel'), toast: $('toast') };
  const rand = (a,b) => a + Math.random()*(b-a);
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  let W=0,H=0,DPR=1, last=0, running=false, paused=false, attract=true, soundOn=false;
  let player, zombies=[], bullets=[], particles=[], pickups=[], obstacles=[], gameTime=0, kills=0, wave=1, waveRemaining=0, spawnClock=0, intermission=0, ammo=12, reserve=48, reloading=false, reloadClock=0, fireClock=0, hitFlash=0;
  const world={w:1900,h:1500};
  const keys=new Set();
  const input={x:0,y:0, joyId:null, fire:false, mouse:false};
  let audio;

  function resize(){
    const rect=canvas.getBoundingClientRect(); DPR=Math.min(2,window.devicePixelRatio||1); W=rect.width; H=rect.height;
    canvas.width=Math.floor(W*DPR); canvas.height=Math.floor(H*DPR); ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener('resize',resize); resize();
  function seedWorld(){
    obstacles=[];
    // Ruined city blocks bordering the playable courtyard.
    const blocks=[[-360,-260,270,180],[-40,-360,250,210],[330,-260,300,190],[710,-370,260,220],[1060,-270,300,200],[-380,100,280,230],[1240,90,300,230],[-260,500,330,210],[180,610,280,230],[575,500,270,190],[1100,570,320,210],[470,-390,240,160],[900,90,180,210]];
    blocks.forEach(([x,y,w,h],i)=>obstacles.push({x,y,w,h,kind:i%4,seed:i}));
  }
  seedWorld();
  function newPlayer(){return {x:world.w/2,y:world.h/2,r:13,hp:100,angle:-Math.PI/2,invuln:0};}
  player=newPlayer();
  function startGame(){
    running=true;paused=false;attract=false;player=newPlayer();zombies=[];bullets=[];particles=[];pickups=[];gameTime=0;kills=0;wave=1;ammo=12;reserve=48;reloading=false;fireClock=0;hitFlash=0;waveRemaining=6;spawnClock=.5;intermission=0;
    ui.intro.classList.add('hidden');ui.pause.classList.add('hidden');ui.result.classList.add('hidden');shell.classList.add('playing');updateHud();toast('DALGA 01 · GELİYORLAR');
  }
  function stopGame(){running=false;paused=false;shell.classList.remove('playing');ui.pause.classList.add('hidden');ui.result.classList.remove('hidden');$('finalWave').textContent=String(wave).padStart(2,'0');$('finalKills').textContent=kills;$('finalTime').textContent=formatTime(gameTime);$('resultEyebrow').textContent=wave>=5?'SİNYAL YENİDEN KURULDU':'SİNYAL KESİLDİ';$('resultTitle').innerHTML=wave>=5?'BU GECE<br><em>ATLATILDI</em>':'BU GECE<br><em>BİZİM DEĞİLDİ</em>';$('resultCopy').textContent=wave>=5?'Sığınak güvende. Ama şehir hâlâ düşmedi.':'Sığınak hâlâ orada. Bir kez daha dene.';}
  function togglePause(){if(!running)return;paused=!paused;ui.pause.classList.toggle('hidden',!paused);input.fire=false;input.x=0;input.y=0;}
  $('startBtn').addEventListener('click',startGame);$('restartBtn').addEventListener('click',startGame);$('resumeBtn').addEventListener('click',togglePause);$('pauseBtn').addEventListener('click',togglePause);
  $('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;$('soundBtn').classList.toggle('muted',!soundOn);$('soundBtn').textContent=soundOn?'♫':'♩';if(soundOn)beep(540,.07,.025)});
  $('reloadBtn').addEventListener('pointerdown',e=>{e.preventDefault();reload()});
  $('fireBtn').addEventListener('pointerdown',e=>{e.preventDefault();input.fire=true;fire()});$('fireBtn').addEventListener('pointerup',()=>input.fire=false);$('fireBtn').addEventListener('pointercancel',()=>input.fire=false);$('fireBtn').addEventListener('pointerleave',()=>input.fire=false);
  function setJoy(e){const rect=$('joystick').getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=32,len=Math.hypot(dx,dy),scale=len>max?max/len:1;input.x=dx*scale/max;input.y=dy*scale/max;$('joyKnob').style.transform=`translate(${dx*scale}px,${dy*scale}px)`;}
  $('joystick').addEventListener('pointerdown',e=>{e.preventDefault();input.joyId=e.pointerId;$('joystick').setPointerCapture(e.pointerId);setJoy(e)});
  $('joystick').addEventListener('pointermove',e=>{if(e.pointerId===input.joyId)setJoy(e)});
  function releaseJoy(e){if(e.pointerId!==input.joyId)return;input.joyId=null;input.x=0;input.y=0;$('joyKnob').style.transform='translate(0,0)'}
  $('joystick').addEventListener('pointerup',releaseJoy);$('joystick').addEventListener('pointercancel',releaseJoy);
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();keys.add(k);if(k==='r')reload();if(k==='escape'||k==='p')togglePause();if(k===' '){input.fire=true;fire()}});
  window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(e.key===' ')input.fire=false});
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&running){input.mouse=true;input.fire=true;fire()}});window.addEventListener('pointerup',e=>{if(e.pointerType==='mouse'){input.mouse=false;input.fire=false}});
  function formatTime(s){const n=Math.floor(s);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
  let toastTimer;function toast(text){ui.toast.textContent=text;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1500)}
  function updateHud(){ui.health.style.width=`${player.hp}%`;ui.health.style.background=player.hp<32?'#f2765f':'#c8ed74';ui.healthText.textContent=`${Math.ceil(player.hp)}%`;ui.wave.textContent=String(wave).padStart(2,'0');ui.ammo.innerHTML=`${ammo} <small>/ ${reserve}</small>`;ui.status.textContent=intermission>0?'SONRAKİ DALGA':waveRemaining>0?'YAKLAŞIYOR':zombies.length>0?'ÇATIŞMA':'TEMİZLENDİ';ui.day.textContent=`KIYAMET GÜNÜ ${String(Math.floor(gameTime/75)+1).padStart(2,'0')}`;}
  function beep(freq,duration=.06,gain=.035){if(!soundOn)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.value=freq;g.gain.value=gain;g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch(_){}}
  function reload(){if(!running||paused||reloading||ammo===12||reserve===0)return;reloading=true;reloadClock=1.05;toast('ŞARJÖR DEĞİŞTİRİLİYOR');beep(220,.11,.025)}
  function nearestZombie(){let target=null,d=Infinity;for(const z of zombies){const dd=(z.x-player.x)**2+(z.y-player.y)**2;if(dd<d){d=dd;target=z}}return target}
  function fire(){if(!running||paused||reloading||fireClock>0)return;if(ammo<=0){if(reserve>0)reload();else toast('MÜHİMMAT BİTTİ');return}const target=nearestZombie();let a=player.angle;if(target)a=Math.atan2(target.y-player.y,target.x-player.x);else if(input.mouse){const rect=canvas.getBoundingClientRect();const cam=camera();a=Math.atan2(eY-player.y,eX-player.x)}player.angle=a;ammo--;fireClock=.22;bullets.push({x:player.x+Math.cos(a)*20,y:player.y+Math.sin(a)*20,vx:Math.cos(a)*690,vy:Math.sin(a)*690,life:.8});for(let i=0;i<3;i++)particles.push({x:player.x+Math.cos(a)*18,y:player.y+Math.sin(a)*18,vx:Math.cos(a+rand(-.6,.6))*rand(30,90),vy:Math.sin(a+rand(-.6,.6))*rand(30,90),life:rand(.08,.2),max:.2,color:'#ffd782',size:rand(1,3)});beep(130,.045,.055);updateHud()}
  let eX=0,eY=0;canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&running){const r=canvas.getBoundingClientRect(),c=camera();eX=e.clientX-r.left+ c.x;eY=e.clientY-r.top+c.y;player.angle=Math.atan2(eY-player.y,eX-player.x)}});
  function camera(){return {x:clamp(player.x-W/2,0,Math.max(0,world.w-W)),y:clamp(player.y-H/2,0,Math.max(0,world.h-H))}}
  function blocked(x,y,r){return obstacles.some(o=>{const qx=clamp(x,o.x,o.x+o.w),qy=clamp(y,o.y,o.y+o.h);return (x-qx)**2+(y-qy)**2<r*r})}
  function moveEntity(entity,dx,dy){const nx=clamp(entity.x+dx,entity.r,world.w-entity.r);if(!blocked(nx,entity.y,entity.r))entity.x=nx;const ny=clamp(entity.y+dy,entity.r,world.h-entity.r);if(!blocked(entity.x,ny,entity.r))entity.y=ny}
  function spawnZombie(){let x=player.x,y=player.y;for(let attempt=0;attempt<24;attempt++){const a=rand(0,Math.PI*2),dist=Math.max(W,H)*.5+rand(18,85);x=clamp(player.x+Math.cos(a)*dist,30,world.w-30);y=clamp(player.y+Math.sin(a)*dist,30,world.h-30);if(!blocked(x,y,15))break}if(blocked(x,y,15)){x=clamp(player.x+Math.max(W,H)*.7,30,world.w-30);y=player.y}zombies.push({x,y,r:rand(11,14),hp:wave>=4?2:1,speed:rand(27,42)+Math.min(wave*2.2,14),attack:0,phase:rand(0,6),skin:['#687760','#777c65','#846c5b','#667467'][Math.floor(rand(0,4))],hit:0})}
  function beginNextWave(){wave++;waveRemaining=5+wave*3;intermission=0;spawnClock=.5;toast(`DALGA ${String(wave).padStart(2,'0')} · YAKLAŞIYOR`);if(wave%2===0)pickups.push({x:player.x+rand(-90,90),y:player.y+rand(-90,90),type:'med',life:14});updateHud()}
  function update(dt){
    if(attract){gameTime+=dt*.15;return}
    if(!running||paused)return;
    gameTime+=dt;fireClock=Math.max(0,fireClock-dt);if(player.invuln>0)player.invuln-=dt;if(hitFlash>0)hitFlash-=dt;
    if(reloading){reloadClock-=dt;if(reloadClock<=0){const n=Math.min(12-ammo,reserve);ammo+=n;reserve-=n;reloading=false;toast('ŞARJÖR HAZIR');updateHud()}}
    let dx=input.x,dy=input.y;if(keys.has('w')||keys.has('arrowup'))dy-=1;if(keys.has('s')||keys.has('arrowdown'))dy+=1;if(keys.has('a')||keys.has('arrowleft'))dx-=1;if(keys.has('d')||keys.has('arrowright'))dx+=1;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l}
    if(l>.08){moveEntity(player,dx*145*dt,dy*145*dt);if(!input.mouse)player.angle=Math.atan2(dy,dx)}
    if(input.fire)fire();
    if(waveRemaining>0){spawnClock-=dt;if(spawnClock<=0){spawnZombie();waveRemaining--;spawnClock=Math.max(.36,1.3-wave*.055)}}else if(zombies.length===0){if(intermission===0){intermission=5;toast('BÖLGE TEMİZ · NEFES AL')}else{intermission-=dt;if(intermission<=0)beginNextWave()}}
    for(const z of zombies){const a=Math.atan2(player.y-z.y,player.x-z.x),d=Math.hypot(player.x-z.x,player.y-z.y);z.phase+=dt*4;z.hit=Math.max(0,z.hit-dt);if(d>player.r+z.r+4){moveEntity(z,Math.cos(a)*z.speed*dt,Math.sin(a)*z.speed*dt)}else{z.attack-=dt;if(z.attack<=0&&player.invuln<=0){player.hp-=9;player.invuln=.55;z.attack=.9;hitFlash=.2;beep(70,.12,.07);if(player.hp<=0){player.hp=0;updateHud();stopGame();return}}}}
    for(const b of bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;for(const z of zombies){if(z.hp>0&&Math.hypot(z.x-b.x,z.y-b.y)<z.r+4){z.hp=0;z.hit=.14;b.life=0;kills++;for(let i=0;i<9;i++)particles.push({x:z.x,y:z.y,vx:rand(-100,100),vy:rand(-100,100),life:rand(.2,.48),max:.48,color:i%2?'#a44738':'#cf7960',size:rand(2,4)});if(Math.random()<.13)pickups.push({x:z.x,y:z.y,type:'ammo',life:10});break}}}
    bullets=bullets.filter(b=>b.life>0);zombies=zombies.filter(z=>z.hp>0);
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.93;p.vy*=.93;p.life-=dt}particles=particles.filter(p=>p.life>0);
    for(const p of pickups){p.life-=dt;if(Math.hypot(p.x-player.x,p.y-player.y)<24){if(p.type==='med'){player.hp=Math.min(100,player.hp+22);toast('+22 CAN')}else{reserve+=12;toast('+12 MÜHİMMAT')}p.life=0;updateHud()}}pickups=pickups.filter(p=>p.life>0);
    if(Math.floor(gameTime*2)!==Math.floor((gameTime-dt)*2))updateHud();
  }

  function drawGround(cam){
    ctx.fillStyle='#374238';ctx.fillRect(cam.x,cam.y,W,H);
    // Faded street markings and fractured concrete tiles.
    const size=64,sx=Math.floor(cam.x/size)*size,sy=Math.floor(cam.y/size)*size;
    for(let x=sx;x<cam.x+W+size;x+=size)for(let y=sy;y<cam.y+H+size;y+=size){const n=Math.abs(Math.sin(x*12.98+y*78.23))*10000;ctx.fillStyle=n%5<1?'rgba(181,176,139,.035)':n%7<1?'rgba(10,18,14,.12)':'rgba(162,164,132,.018)';ctx.fillRect(x,y,size-1,size-1);if(n%13<1){ctx.strokeStyle='rgba(12,18,14,.22)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+12,y+9);ctx.lineTo(x+20,y+28);ctx.lineTo(x+16,y+39);ctx.stroke()}}
    // Lane remnants crossing the ruined courtyard.
    ctx.fillStyle='rgba(25,34,27,.32)';ctx.fillRect(0,world.h*.24,world.w,92);ctx.fillRect(world.w*.19,0,76,world.h);
    ctx.setLineDash([19,20]);ctx.strokeStyle='rgba(190,185,142,.17)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,world.h*.24+46);ctx.lineTo(world.w,world.h*.24+46);ctx.moveTo(world.w*.19+38,0);ctx.lineTo(world.w*.19+38,world.h);ctx.stroke();ctx.setLineDash([]);
    // Rubble blocks with hard shadows, roof details and broken corners.
    for(const o of obstacles){if(o.x+o.w<cam.x-80||o.x>cam.x+W+80||o.y+o.h<cam.y-80||o.y>cam.y+H+80)continue;const colors=['#555c4b','#5b584a','#4d594e','#625b4b'],base=colors[o.kind];ctx.fillStyle='rgba(7,11,8,.35)';ctx.fillRect(o.x+11,o.y+13,o.w,o.h);ctx.fillStyle='#302f27';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.fillStyle=base;ctx.fillRect(o.x+5,o.y+5,o.w-10,o.h-10);ctx.fillStyle='rgba(207,195,147,.11)';ctx.fillRect(o.x+9,o.y+8,o.w-18,8);ctx.fillStyle='rgba(13,20,16,.25)';for(let i=0;i<4;i++){const wx=o.x+24+i*(o.w-48)/3;ctx.fillRect(wx,o.y+25,12,25);ctx.fillRect(wx,o.y+o.h-42,12,24)}ctx.strokeStyle='rgba(15,21,16,.33)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(o.x+o.w*.2,o.y+o.h*.6);ctx.lineTo(o.x+o.w*.36,o.y+o.h*.48);ctx.lineTo(o.x+o.w*.42,o.y+o.h*.75);ctx.stroke();for(let j=0;j<5;j++){ctx.fillStyle=j%2?'#6f6850':'#766b50';ctx.save();ctx.translate(o.x+randSeed(o.seed*8+j)*o.w,o.y+randSeed(o.seed*19+j)*o.h);ctx.rotate(j*1.3);ctx.fillRect(-6,-4,12,8);ctx.restore()}}
    // scattered weeds and debris
    for(let i=0;i<58;i++){const x=((i*173+81)%world.w),y=((i*277+134)%world.h);if(x<cam.x-20||x>cam.x+W+20||y<cam.y-20||y>cam.y+H+20)continue;ctx.strokeStyle='rgba(161,177,104,.3)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-3,y-7);ctx.moveTo(x,y);ctx.lineTo(x+4,y-8);ctx.stroke();if(i%3===0){ctx.fillStyle='rgba(28,32,25,.5)';ctx.fillRect(x+12,y+9,7,3)}}
  }
  function randSeed(n){const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)}
  function drawZombie(z){ctx.save();ctx.translate(z.x,z.y);ctx.rotate(Math.sin(z.phase)*.08);ctx.fillStyle='rgba(7,10,7,.35)';ctx.beginPath();ctx.ellipse(2,8,z.r+4,z.r*.7,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=z.skin;ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-6,1);ctx.lineTo(-z.r-5,7+Math.sin(z.phase)*4);ctx.moveTo(6,1);ctx.lineTo(z.r+6,3-Math.sin(z.phase*1.3)*4);ctx.stroke();ctx.fillStyle=z.hit?'#d18b70':z.skin;ctx.beginPath();ctx.ellipse(0,2,z.r*.72,z.r,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b8aa87';ctx.beginPath();ctx.arc(0,-z.r*.65,z.r*.52,0,Math.PI*2);ctx.fill();ctx.fillStyle='#713d35';ctx.fillRect(-z.r*.42,-z.r*.75,3,2);ctx.fillRect(2,-z.r*.75,3,2);ctx.fillStyle='#e4b66e';ctx.fillRect(-4,-z.r*.75,2,2);ctx.fillRect(3,-z.r*.75,2,2);ctx.fillStyle='#624b40';ctx.beginPath();ctx.arc(0,z.r*.83,4,0,Math.PI);ctx.fill();ctx.restore()}
  function drawPlayer(){ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.angle);if(player.invuln>0&&Math.floor(player.invuln*18)%2===0)ctx.globalAlpha=.5;ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(1,7,17,11,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c9c4a4';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-3,-5);ctx.lineTo(-7,-12);ctx.moveTo(-3,6);ctx.lineTo(-8,12);ctx.stroke();ctx.fillStyle='#d5d0b4';ctx.beginPath();ctx.ellipse(0,0,10,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a5a17e';ctx.beginPath();ctx.arc(3,-1,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#394439';ctx.beginPath();ctx.arc(-2,0,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d5b590';ctx.beginPath();ctx.arc(5,0,4.4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#262b25';ctx.fillRect(5,-2,18,4);ctx.fillStyle='#c8ed74';ctx.fillRect(10,-1,2,2);ctx.restore()}
  function draw(){ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,W,H);const cam=camera();ctx.save();ctx.translate(-cam.x,-cam.y);drawGround(cam);
    for(const p of pickups){const pulse=1+Math.sin(gameTime*5)*.12;ctx.save();ctx.translate(p.x,p.y);ctx.scale(pulse,pulse);ctx.fillStyle=p.type==='med'?'rgba(200,237,116,.15)':'rgba(245,188,102,.14)';ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.fill();ctx.fillStyle=p.type==='med'?'#c8ed74':'#f3c26c';ctx.fillRect(-7,-7,14,14);ctx.fillStyle='#283224';if(p.type==='med'){ctx.fillRect(-1.5,-5,3,10);ctx.fillRect(-5,-1.5,10,3)}else{ctx.fillRect(-4,-4,8,8)}ctx.restore()}
    for(const b of bullets){ctx.strokeStyle='#ffd783';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-b.vx*.025,b.y-b.vy*.025);ctx.stroke();ctx.fillStyle='#fff0c1';ctx.fillRect(b.x-2,b.y-2,4,4)}
    for(const z of zombies)drawZombie(z);drawPlayer();for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;ctx.restore();
    if(hitFlash>0){ctx.fillStyle=`rgba(190,42,30,${hitFlash*.35})`;ctx.fillRect(0,0,W,H)}
    if(attract){ // quiet ambient smoke specks in title screen
      for(let i=0;i<15;i++){let x=(i*173+gameTime*8)%(W+80)-40,y=(i*97+gameTime*14)%(H+60)-30;ctx.fillStyle=`rgba(220,225,199,${.04+(i%3)*.015})`;ctx.beginPath();ctx.arc(x,y,2+(i%3),0,Math.PI*2);ctx.fill()}
    }
  }
  function loop(t){const dt=Math.min(.04,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(loop)}
  requestAnimationFrame(loop);
})();
