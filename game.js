(()=>{'use strict';
const c=document.querySelector('#game'),x=c.getContext('2d',{alpha:false});let W=480,H=270;const F=Math.PI/3;x.imageSmoothingEnabled=false;
const m=['################','#......#.......#','#.##...#..##...#','#......#.......#','#..............#','#..##......##..#','#..#..........##','#..#..##.......#','#.....##.......#','##............##','#......##......#','#..............#','#..##......##..#','#..............#','#..............#','################'],q=id=>document.getElementById(id),u={start:q('startOverlay'),end:q('endOverlay'),mission:q('missionState'),hp:q('healthFill'),hpt:q('healthText'),ar:q('armorFill'),art:q('armorText'),ammo:q('ammoText'),reserve:q('reserveText'),wave:q('waveText'),left:q('enemyText'),score:q('finalScore'),title:q('endTitle'),copy:q('endCopy'),reload:q('reloadNote'),cross:q('crosshair'),hit:q('hitMarker'),flash:q('damageFlash'),joy:q('joystick'),knob:q('joyKnob')};
let p={x:2.5,y:2.5,a:.15,h:100,ar:50,ammo:24,res:120,score:0,wave:0,bob:0,recoil:0,muzzle:0,reload:0,cd:0},es=[],parts=[],keys={},run=false,started=false,locked=false,fire=false,sound=true,audio,joy={x:0,y:0},origin=null,last=performance.now(),touchX=null,depth=new Float32Array(W);
function resize(){let aspect=innerWidth/Math.max(1,innerHeight);H=clamp(Math.round(480/aspect),240,540);W=Math.round(H*aspect);c.width=W;c.height=H;depth=new Float32Array(W);x.imageSmoothingEnabled=false}
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ang=a=>{while(a>Math.PI)a-=2*Math.PI;while(a< -Math.PI)a+=2*Math.PI;return a},wall=(a,b)=>!m[Math.floor(b)]||m[Math.floor(b)][Math.floor(a)]!==' ';
resize();window.addEventListener('resize',resize);
// The corridor map uses floor dots; every other tile is solid.
function blocked(a,b){return !m[Math.floor(b)]||m[Math.floor(b)][Math.floor(a)]!=='.'}
function beep(f,d=.08,t='square',v=.03){if(!sound)return;try{audio||=new(window.AudioContext||webkitAudioContext)();let o=audio.createOscillator(),g=audio.createGain();o.type=t;o.frequency.setValueAtTime(f,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(45,f*.4),audio.currentTime+d);g.gain.setValueAtTime(v,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+d)}catch(_){}}
function hud(){u.hp.style.width=p.h+'%';u.hpt.textContent=p.h;u.ar.style.width=p.ar*2+'%';u.art.textContent=p.ar;u.ammo.textContent=p.ammo;u.reserve.textContent=p.res;u.wave.textContent=String(p.wave).padStart(2,'0');u.left.textContent=es.filter(e=>!e.dead).length}
function wave(){p.wave++;for(let i=0;i<3+p.wave*2;i++){let a,b,n=0;do{a=rand(3,13);b=rand(2,13);n++}while((blocked(a,b)||Math.hypot(a-p.x,b-p.y)<4||es.some(e=>Math.hypot(e.x-a,e.y-b)<1.4))&&n<150);if(n<150){let heavy=p.wave>=3&&i%4===0;es.push({x:a,y:b,hp:heavy?3:2,max:heavy?3:2,speed:rand(.52,.78)+p.wave*.035,attack:rand(.6,1.4),hit:0,heavy,dead:false})}}hud()}
function start(){if(run)return;started=run=true;Object.assign(p,{x:2.5,y:1.5,a:.15,h:100,ar:50,ammo:24,res:120,score:0,wave:0,reload:0,cd:0});es=[];parts=[];u.start.classList.add('hidden');u.end.classList.add('hidden');u.mission.textContent='TEMİZLE';if(c.requestPointerLock&&innerWidth>700)c.requestPointerLock();wave()}
function end(win){run=false;if(document.pointerLockElement)document.exitPointerLock();u.title.textContent=win?'GÖREV TAMAMLANDI':'SİNYAL KESİLDİ';u.copy.textContent=win?'Sektör temizlendi. Şimdilik.':`Dalga ${String(p.wave).padStart(2,'0')}’de düştün. Makineler hâlâ geliyor.`;u.score.textContent=String(p.score).padStart(4,'0');u.end.classList.remove('hidden');u.mission.textContent=win?'TAMAMLANDI':'BAĞLANTI KOPTU'}
function reload(){if(!run||p.reload||p.ammo>=24||!p.res)return;p.reload=1.2;u.reload.textContent='ŞARJÖR DEĞİŞTİRİLİYOR';u.reload.classList.add('active');beep(240,.08,'triangle')}
function los(a,b,A,B){let d=Math.hypot(A-a,B-b),n=Math.ceil(d*10);for(let i=1;i<n;i++){let t=i/n;if(blocked(a+(A-a)*t,b+(B-b)*t))return false}return true}
function shoot(){if(!run||p.reload||p.cd>0)return;if(!p.ammo){reload();beep(100,.05);return}p.ammo--;p.cd=.19;p.recoil=1;p.muzzle=.085;beep(115,.085,'sawtooth',.045);let target=null,nearest=Infinity;for(let e of es){if(e.dead)continue;let dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy),a=Math.abs(ang(Math.atan2(dy,dx)-p.a));if(a<.13+.018/d&&d<nearest&&los(p.x,p.y,e.x,e.y)){target=e;nearest=d}}if(target){target.hp--;target.hit=.12;p.score+=10;u.cross.classList.add('hit');u.hit.classList.add('show');setTimeout(()=>{u.cross.classList.remove('hit');u.hit.classList.remove('show')},100);for(let i=0;i<7;i++)parts.push({x:target.x,y:target.y,z:rand(.35,1.7),life:rand(.12,.32),color:i%2?'#f5e681':'#ff7664'});if(target.hp<=0){target.dead=true;p.score+=target.heavy?100:75;beep(480,.12,'triangle')}}if(!p.ammo&&p.res)setTimeout(reload,240);hud()}
function damage(n){let soak=Math.min(p.ar,Math.ceil(n*.65));p.ar-=soak;p.h=Math.max(0,p.h-(n-soak));u.flash.classList.add('show');setTimeout(()=>u.flash.classList.remove('show'),130);beep(85,.13,'sawtooth',.04);hud();if(!p.h)end(false)}
function update(dt){p.cd=Math.max(0,p.cd-dt);p.muzzle=Math.max(0,p.muzzle-dt);p.recoil=Math.max(0,p.recoil-dt*5);if(!run)return;if(p.reload>0&&!(p.reload-=dt)){let n=Math.min(24-p.ammo,p.res);p.ammo+=n;p.res-=n;u.reload.textContent='R — ŞARJÖR DEĞİŞTİR';u.reload.classList.remove('active');beep(350,.07,'triangle')}if(fire||keys.Space)shoot();let f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-joy.y,s=(keys.KeyD?1:0)-(keys.KeyA?1:0)+joy.x,turn=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0);p.a+=turn*dt*2.2;let speed=(keys.ShiftLeft?3.8:2.65)*dt,mx=(Math.cos(p.a)*f-Math.sin(p.a)*s)*speed,my=(Math.sin(p.a)*f+Math.cos(p.a)*s)*speed;if(Math.abs(f)+Math.abs(s)>.05)p.bob+=dt*11;if(!blocked(p.x+mx+Math.sign(mx)*.2,p.y))p.x+=mx;if(!blocked(p.x,p.y+my+Math.sign(my)*.2))p.y+=my;for(let e of es){if(e.dead)continue;e.hit=Math.max(0,e.hit-dt);let dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy);if(d>.72){let vx=dx/d*e.speed*dt,vy=dy/d*e.speed*dt;if(!blocked(e.x+vx,e.y))e.x+=vx;if(!blocked(e.x,e.y+vy))e.y+=vy}e.attack-=dt;if(d<1.18&&e.attack<=0){damage(e.heavy?13:9);e.attack=rand(1.05,1.6)}}parts=parts.filter(a=>(a.life-=dt)>0);if(es.length&&es.every(e=>e.dead)){if(p.wave>=5){end(true);return}es=[];p.res=Math.min(240,p.res+18);p.h=Math.min(100,p.h+12);p.ar=Math.min(50,p.ar+8);wave()}hud()}
function ray(a){let rx=Math.cos(a),ry=Math.sin(a),mx=Math.floor(p.x),my=Math.floor(p.y),dx=Math.abs(1/(rx||1e-8)),dy=Math.abs(1/(ry||1e-8)),sx,sy,ax,ay;if(rx<0){sx=-1;ax=(p.x-mx)*dx}else{sx=1;ax=(mx+1-p.x)*dx}if(ry<0){sy=-1;ay=(p.y-my)*dy}else{sy=1;ay=(my+1-p.y)*dy}let side=0,n=0;while(n++<28){if(ax<ay){ax+=dx;mx+=sx;side=0}else{ay+=dy;my+=sy;side=1}if(!m[my]||m[my][mx]!=='.')break}let d=Math.max(.001,side?ay-dy:ax-dx),coord=side?p.x+d*rx:p.y+d*ry,wx=coord-Math.floor(coord);return{d,side,wx,mx,my}}

function rect(col,a,b,w,h){x.fillStyle=col;x.fillRect(Math.round(a),Math.round(b),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)))}
function render(){
  let sky=x.createLinearGradient(0,0,0,H*.53);sky.addColorStop(0,'#101d24');sky.addColorStop(1,'#344b4b');x.fillStyle=sky;x.fillRect(0,0,W,H*.53);
  let floor=x.createLinearGradient(0,H*.48,0,H);floor.addColorStop(0,'#263733');floor.addColorStop(1,'#080e10');x.fillStyle=floor;x.fillRect(0,H*.48,W,H*.52);
  // Distant station lights and floor perspective guides.
  for(let i=0;i<9;i++){let yy=22+i*23;rect(i%2?'#314943':'#3e5b50',0,yy,W,1);}
  for(let i=0;i<12;i++){let yy=H*.53+i*i*1.48;rect('#1a2a27',0,yy,W,1)}
  for(let i=0;i<7;i++){let xx=(i*83+27)%W;rect('#8ab990',xx,47+(i%3)*8,3,2);rect('#75a984',xx+1,49+(i%3)*8,1,7)}
  let horizon=H/2+Math.sin(p.bob)*1.6,step=2;
  for(let sx=0;sx<W;sx+=step){let a=p.a-F/2+(sx/W)*F,r=ray(a),dist=r.d*Math.cos(a-p.a),height=Math.min(H*2,H/Math.max(.08,dist));depth[sx]=dist;if(sx+1<W)depth[sx+1]=dist;let top=horizon-height/2,shade=Math.max(.20,1-dist/12)*(r.side?.78:1),stripe=Math.floor(r.wx*8)%2,base=r.side?'#527568':'#6d9580';x.fillStyle=base;x.fillRect(sx,top,step+1,height);
    if(stripe===0){x.fillStyle=r.side?'#45675d':'#5d8471';x.fillRect(sx,top,step+1,height)}
    let band=(Math.floor(top/28)%3===0);if(band){x.fillStyle='rgba(16,35,32,.48)';x.fillRect(sx,top+height*.18,step+1,Math.max(1,height*.035));x.fillRect(sx,top+height*.78,step+1,Math.max(1,height*.025))}
    let lum=Math.floor((1-shade)*90);if(lum>0){x.fillStyle=`rgba(4,8,10,${Math.min(.72,lum/120)})`;x.fillRect(sx,top,step+1,height)}
    if(r.wx>.43&&r.wx<.58&&height>24){x.fillStyle='rgba(214,255,113,.42)';x.fillRect(sx,top+height*.24,step+1,Math.max(1,height*.025))}
  }
  let visible=es.filter(e=>!e.dead).map(e=>({e,d:Math.hypot(e.x-p.x,e.y-p.y),a:ang(Math.atan2(e.y-p.y,e.x-p.x)-p.a)})).filter(o=>Math.abs(o.a)<F*.72&&o.d<14).sort((a,b)=>b.d-a.d);
  for(let o of visible){let e=o.e,screen=W/2+Math.tan(o.a)/Math.tan(F/2)*W/2,size=Math.min(H*1.15,H/o.d*.72),center=horizon+size*.04,top=center-size*.55,sw=size*.55;if(screen<0||screen>=W)continue;let col=Math.max(0,Math.min(W-1,Math.floor(screen))),blockedByWall=depth[col]<o.d*.94;if(blockedByWall)continue;
    x.save();x.translate(Math.round(screen-sw/2),Math.round(top));let hit=e.hit>0,main=hit?'#f4e3a2':e.heavy?'#be5663':'#d27657',dark=hit?'#fff4c9':'#633f4a',glow=hit?'#fff':'#ffb15c';
    // Chunky robot silhouette, composed from deliberately crisp rectangles.
    rect('#14201f',sw*.28,size*.08,sw*.44,size*.78);rect(dark,sw*.22,size*.15,sw*.56,size*.45);rect(main,sw*.27,size*.10,sw*.46,size*.36);rect(main,sw*.16,size*.29,sw*.18,size*.30);rect(main,sw*.66,size*.29,sw*.18,size*.30);
    rect('#202a28',sw*.31,size*.53,sw*.18,size*.27);rect('#202a28',sw*.52,size*.53,sw*.18,size*.27);rect(dark,sw*.27,size*.78,sw*.26,size*.09);rect(dark,sw*.49,size*.78,sw*.26,size*.09);
    rect('#273333',sw*.34,size*.05,sw*.32,size*.20);rect(glow,sw*.39,size*.12,sw*.08,size*.055);rect(glow,sw*.53,size*.12,sw*.08,size*.055);rect('#1d2b2a',sw*.43,size*.24,sw*.14,size*.035);
    rect('#d9a85d',sw*.12,size*.37,sw*.08,size*.10);rect('#d9a85d',sw*.80,size*.37,sw*.08,size*.10);
    if(e.heavy){rect('#f2bd66',sw*.04,size*.19,sw*.18,size*.12);rect('#f2bd66',sw*.78,size*.19,sw*.18,size*.12)}
    let barw=sw*.7;rect('#252b28',sw*.15,-size*.06,barw,size*.045);rect('#ff665e',sw*.15,-size*.06,barw*(e.hp/e.max),size*.045);x.restore();
  }
  // Short-lived world-space sparks.
  for(let z of parts){let dx=z.x-p.x,dy=z.y-p.y,d=Math.hypot(dx,dy),a=ang(Math.atan2(dy,dx)-p.a);if(Math.abs(a)>F/2||d<.2)continue;let sx=W/2+Math.tan(a)/Math.tan(F/2)*W/2,sy=horizon-H/d*(z.z-.5),r=Math.max(1,4/d);x.fillStyle=z.color;x.fillRect(sx-r,sy-r,r*2,r*2)}
  drawWeapon(horizon);
}
function drawWeapon(h){let kick=p.recoil*8,sx=W/480,sy=H/270;x.save();x.translate(W/2,H-12*sy+Math.sin(p.bob)*1.6*sy+kick*sy);x.scale(sx*.75,sy*.75);
  // Pulse rifle with chunky pixel silhouette.
  rect('#11191a',-57,-73,114,82);rect('#283b39',-50,-70,100,66);rect('#526c62',-37,-83,74,21);rect('#899c79',-22,-88,44,10);rect('#1b2826',-18,-104,36,23);rect('#637967',-13,-101,26,13);rect('#182321',-11,-129,22,28);rect('#435c53',-8,-134,16,7);rect('#99f1ba',-4,-126,8,4);
  rect('#172120',-50,-46,25,34);rect('#415b51',-47,-43,18,24);rect('#172120',25,-46,25,34);rect('#415b51',29,-43,18,24);rect('#101718',-18,-19,36,24);rect('#253936',-13,-18,26,18);rect('#667e67',-6,-14,12,6);
  if(p.muzzle>0){rect('#ffe7a0',-8,-157,16,18);rect('#f2a94f',-16,-148,32,12);rect('#fff4ca',-4,-164,8,8)}x.restore();}
function tick(now){let dt=Math.min(.05,(now-last)/1000);last=now;update(dt);render();requestAnimationFrame(tick)}

q('startButton').addEventListener('click',start);q('restartButton').addEventListener('click',start);
q('soundButton').addEventListener('click',()=>{sound=!sound;q('soundButton').classList.toggle('muted',!sound);q('soundButton').innerHTML=sound?'♫ <span>SES AÇIK</span>':'♫ <span>SESSİZ</span>';if(sound)beep(440,.05,'triangle')});
document.addEventListener('keydown',e=>{keys[e.code]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='KeyR'){e.preventDefault();reload()}if(e.code==='Escape'&&run&&document.pointerLockElement===c)document.exitPointerLock()});
document.addEventListener('keyup',e=>{keys[e.code]=false});
document.addEventListener('mousemove',e=>{if(run&&document.pointerLockElement===c)p.a+=e.movementX*.0024});
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===c});
c.addEventListener('pointerdown',e=>{if(!run)return;if(e.pointerType==='mouse'){if(document.pointerLockElement!==c&&c.requestPointerLock&&innerWidth>700)c.requestPointerLock();fire=true;shoot()}else{touchX=e.clientX}});
document.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')fire=false;else touchX=null});
document.addEventListener('pointercancel',()=>{touchX=null;fire=false});
document.addEventListener('pointermove',e=>{if(e.pointerType==='touch'&&touchX!==null&&run){let dx=e.clientX-touchX;touchX=e.clientX;p.a+=dx*.009}});
const joyEl=u.joy,joyMove=e=>{let r=joyEl.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),len=Math.hypot(dx,dy),max=r.width*.34;if(len>max){dx=dx/len*max;dy=dy/len*max}joy={x:dx/max,y:dy/max};u.knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`};
joyEl.addEventListener('pointerdown',e=>{e.preventDefault();joyEl.setPointerCapture(e.pointerId);joyMove(e)});joyEl.addEventListener('pointermove',e=>{if(joyEl.hasPointerCapture(e.pointerId))joyMove(e)});const joyEnd=()=>{joy={x:0,y:0};u.knob.style.transform='translate(-50%,-50%)'};joyEl.addEventListener('pointerup',joyEnd);joyEl.addEventListener('pointercancel',joyEnd);
const mf=q('mobileFire');mf.addEventListener('pointerdown',e=>{e.preventDefault();mf.setPointerCapture(e.pointerId);fire=true;shoot()});mf.addEventListener('pointerup',()=>fire=false);mf.addEventListener('pointercancel',()=>fire=false);q('mobileReload').addEventListener('pointerdown',e=>{e.preventDefault();reload()});
window.addEventListener('blur',()=>{keys={};fire=false;joyEnd()});
hud();requestAnimationFrame(tick);
})();

