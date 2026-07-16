(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const C = {bg:'#05061b', panel:'#202331', edge:'#73798d', mint:'#27efb8', amber:'#ffc12e', violet:'#8874ff', pink:'#ff23ac', cyan:'#27cfff', white:'#f2f3f7'};
  const lanes = [
    {name:'PULSE', color:C.amber, sound:110, pattern:[1,0,0,0,1,0,0,0,1,0,1,0,0,0,1,0], unlocked:true},
    {name:'WAVE', color:C.mint, sound:165, pattern:[1,0,0,1,0,0,1,0,1,0,0,1,0,1,0,0], unlocked:true},
    {name:'GHOST', color:C.violet, sound:220, pattern:[1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0], unlocked:false},
    {name:'SPARK', color:C.pink, sound:330, pattern:[1,0,1,0,0,0,1,0,0,1,0,0,1,0,0,0], unlocked:false}
  ];
  const cards = [
    [1,0,0,0],
    [1,0,0,1],
    [1,0,1,0],
    [1,0,1,1],
    [1,1,0,1],
    [0,1,0,0]
  ];
  let state, audio, last=0, stars=[], motes=[];
  const towerXs=[185,430,675,900];
  const stage={x:18,y:18,w:1190,h:515};
  const seq={x:340,y:650,w:565,h:126};
  const side={x:1228,y:18,w:194,h:774};

  function reset(){
    state={running:false, paused:false, muted:false, level:1, xp:0, need:30, energy:100, score:0, combo:0, selected:1, step:-1, beat:0, beatLength:60/126, enemies:[], shots:[], drops:[], xpOrbs:[], particles:[], flashes:[], shake:0, spawn:1.2, overdrive:0, enemySeq:0, buffHistory:[], cardCounts:[2,2,1,1,1,1], segmentCursors:[0,0,0,0], replacePulse:0, message:'CLICK A TRACK · CHOOSE A RHYTHM'};
    lanes.forEach((l,i)=>l.unlocked=i<2);
    stars=Array.from({length:80},()=>({x:25+Math.random()*1160,y:25+Math.random()*475,r:Math.random()*2.5,a:.12+Math.random()*.35}));
    motes=Array.from({length:18},()=>({x:Math.random()*1180,y:Math.random()*440,r:5+Math.random()*16,dx:-3+Math.random()*6,dy:-2+Math.random()*3}));
  }
  reset();

  function start(){
    document.querySelector('#intro').classList.add('hidden');
    document.querySelector('#gameover').classList.add('hidden');
    document.querySelector('#buffSelect').classList.add('hidden');
    reset(); state.running=true; initAudio(); last=performance.now(); requestAnimationFrame(loop);
  }
  function initAudio(){
    if(!audio) audio=new (window.AudioContext||window.webkitAudioContext)();
    if(audio.state==='suspended') audio.resume();
  }
  function tone(freq,dur=.08,type='triangle',vol=.07,slide=0){
    if(!audio||state.muted)return;
    const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;
    o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t+dur);
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    o.connect(g).connect(audio.destination);o.start(t);o.stop(t+dur);
  }
  function beat(step){
    lanes.forEach((l,i)=>{
      if(l.unlocked&&l.pattern[step]) fire(i);
    });
    if(step%4===0)tone(48,.09,'sine',.05,-12);
  }
  function fire(i){
    const x=towerXs[i], y=stage.y+stage.h-30, l=lanes[i];
    const target=state.enemies.length?state.enemies.reduce((a,b)=>Math.abs(a.x-x)<Math.abs(b.x-x)?a:b):null;
    let ang=target?Math.atan2(target.y-y,target.x-x):-Math.PI/2+(.5-Math.random())*.34;
    const laser=i===0, speed=(laser?920:480)+(state.overdrive>0?(laser?260:180):0);
    state.shots.push({x,y,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,r:laser?3:5,color:l.color,life:laser?2.6:4,trail:[],kind:laser?'laser':'bolt',pierce:laser?3:1,hitIds:laser?new Set():null});
    state.flashes.push({x,y,r:laser?18:10,color:l.color,life:laser?.28:.2});
    burst(x,y-5,l.color,laser?9:5,laser?140:80); tone(laser?520:l.sound,laser?.11:.07,laser?'sawtooth':'square',laser?.05:.035,laser?420:70);
  }
  function spawnEnemy(){
    const x=70+Math.random()*(stage.w-140), elite=Math.random()<Math.min(.25,state.level*.018);
    state.enemies.push({uid:++state.enemySeq,x,y:45+Math.random()*65,vx:(Math.random()<.5?-1:1)*(22+Math.random()*28),hp:elite?4:1+Math.floor(state.level/5),max:elite?4:1+Math.floor(state.level/5),r:elite?26:19,shot:.6+Math.random()*1.5,elite,phase:Math.random()*6.28});
  }
  function enemyFire(e){
    const tx=towerXs[Math.floor(Math.random()*lanes.filter(l=>l.unlocked).length)],ty=stage.y+stage.h-15;
    const a=Math.atan2(ty-e.y,tx-e.x), sp=145+state.level*4;
    state.drops.push({x:e.x,y:e.y+10,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:e.elite?7:5,color:e.elite?C.pink:C.cyan,life:6});
  }
  function burst(x,y,color,n=10,speed=150){
    for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=Math.random()*speed;state.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:1+Math.random()*4,color,life:.35+Math.random()*.55,max:.9});}
  }
  function dropXP(x,y,amount){
    for(let i=0;i<amount;i++){const a=-Math.PI*.85+Math.random()*Math.PI*.7,s=55+Math.random()*115;state.xpOrbs.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,delay:.22+Math.random()*.38,r:3+Math.random()*2,phase:Math.random()*6.28});}
  }
  function gainXP(n){
    state.xp+=n;if(state.xp>=state.need&&!state.paused)levelUp();
  }
  function levelUp(){
    state.xp-=state.need;state.level++;state.need=Math.round(state.need*1.22);state.energy=Math.min(100,state.energy+18);state.message='LEVEL UP · CHOOSE A BUFF';state.paused=true;tone(440,.3,'sawtooth',.08,440);
    if(state.level===3)lanes[2].unlocked=true;if(state.level===6)lanes[3].unlocked=true;
    for(let i=0;i<state.cardCounts.length;i++)if(Math.random()<.45)state.cardCounts[i]++;
    document.querySelector('#buffLevel').textContent=`LEVEL ${state.level}`;document.querySelector('#buffSelect').classList.remove('hidden');
  }
  function chooseBuff(id){
    state.buffHistory.push({level:state.level,id});document.querySelector('#buffSelect').classList.add('hidden');state.paused=false;tone(660,.16,'triangle',.055,260);if(state.xp>=state.need)levelUp();
  }
  function update(dt){
    state.beat+=dt;
    const raw=Math.floor(state.beat/state.beatLength), step=raw%16;
    if(step!==state.step){state.step=step;beat(step);}
    if(state.overdrive>0)state.overdrive-=dt;
    if(state.replacePulse>0)state.replacePulse-=dt;
    state.spawn-=dt;if(state.spawn<=0){spawnEnemy();state.spawn=Math.max(.48,1.75-state.level*.075)*(Math.random()*.5+.75);}
    motes.forEach(m=>{m.x+=m.dx*dt;m.y+=m.dy*dt;if(m.x<30)m.x=1180;if(m.y<20)m.y=500;if(m.y>510)m.y=25;});
    state.enemies.forEach(e=>{e.phase+=dt*1.8;e.x+=e.vx*dt;if(e.x<45||e.x>stage.w-30)e.vx*=-1;e.y=Math.min(250,e.y+dt*(2+state.level*.28));e.shot-=dt;if(e.shot<0){enemyFire(e);e.shot=Math.max(.55,2.4-state.level*.06)+Math.random();}});
    for(const s of state.shots){s.life-=dt;s.trail.push({x:s.x,y:s.y});const trailLimit=s.kind==='laser'?7:9;if(s.trail.length>trailLimit)s.trail.shift();s.x+=s.vx*dt;s.y+=s.vy*dt;if(s.x<stage.x+8||s.x>stage.x+stage.w-8){s.vx*=-1;s.x=Math.max(stage.x+8,Math.min(stage.x+stage.w-8,s.x));if(s.kind==='laser'){burst(s.x,s.y,s.color,4,70);tone(760,.035,'sine',.018,-120);}}if(s.y<stage.y+8){s.vy=Math.abs(s.vy);s.y=stage.y+8;if(s.kind==='laser'){burst(s.x,s.y,s.color,4,70);tone(760,.035,'sine',.018,-120);}}}
    for(const d of state.drops){d.life-=dt;d.x+=d.vx*dt;d.y+=d.vy*dt;}
    for(let i=state.xpOrbs.length-1;i>=0;i--){const o=state.xpOrbs[i];o.phase+=dt*8;if(o.delay>0){o.delay-=dt;o.vy+=120*dt;o.x+=o.vx*dt;o.y+=o.vy*dt;o.vx*=.985;}else{const tx=190,ty=632,dx=tx-o.x,dy=ty-o.y,dist=Math.hypot(dx,dy)||1,speed=310+Math.min(360,900/dist);o.x+=dx/dist*speed*dt;o.y+=dy/dist*speed*dt;if(dist<22){state.xpOrbs.splice(i,1);gainXP(1);burst(tx,ty,C.cyan,3,55);tone(310,.035,'sine',.018,90);}}}
    for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.97;p.vy*=.97;}
    for(const f of state.flashes){f.life-=dt;f.r+=dt*120;}
    for(let si=state.shots.length-1;si>=0;si--){const s=state.shots[si];let consumed=false;for(let ei=state.enemies.length-1;ei>=0;ei--){const e=state.enemies[ei];if(s.hitIds?.has(e.uid))continue;if((s.x-e.x)**2+(s.y-e.y)**2<(s.r+e.r)**2){e.hp--;burst(s.x,s.y,s.color,s.kind==='laser'?12:7,s.kind==='laser'?190:120);if(s.kind==='laser'){s.hitIds.add(e.uid);s.pierce--;if(s.pierce<=0){state.shots.splice(si,1);consumed=true;}}else{state.shots.splice(si,1);consumed=true;}if(e.hp<=0){const xp=e.elite?8:3;state.score+=xp*10;state.combo++;dropXP(e.x,e.y,xp);burst(e.x,e.y,e.elite?C.pink:C.amber,18,230);state.enemies.splice(ei,1);tone(e.elite?95:140,.12,'sawtooth',.045,-80);}else if(s.kind==='laser')tone(880,.045,'square',.025,-260);if(consumed)break;}}}
    for(let i=state.drops.length-1;i>=0;i--){const d=state.drops[i];if(d.y>stage.y+stage.h-32){state.drops.splice(i,1);state.energy-=d.r>5?9:5;state.combo=0;state.shake=9;burst(d.x,stage.y+stage.h-25,d.color,12,180);tone(70,.18,'sawtooth',.06,-35);}}
    state.shots=state.shots.filter(s=>s.life>0&&s.y<stage.y+stage.h+20);state.drops=state.drops.filter(d=>d.life>0);state.particles=state.particles.filter(p=>p.life>0);state.flashes=state.flashes.filter(f=>f.life>0);state.shake*=.86;
    if(state.energy<=0){state.energy=0;state.running=false;document.querySelector('#finalScore').textContent=`抵达 LEVEL ${state.level} · 得分 ${String(state.score).padStart(6,'0')}`;document.querySelector('#gameover').classList.remove('hidden');}
  }

  function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  function glow(color,blur=18){ctx.shadowColor=color;ctx.shadowBlur=blur;}
  function text(str,x,y,size=24,align='left',color=C.white,weight=700){ctx.shadowBlur=0;ctx.fillStyle=color;ctx.font=`${weight} ${size}px "Barlow Condensed",sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(str,x,y);}
  function mono(str,x,y,size=16,align='left',color='#aeb3c5'){ctx.shadowBlur=0;ctx.fillStyle=color;ctx.font=`${size}px "Share Tech Mono",monospace`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(str,x,y);}
  function draw(){
    ctx.save();ctx.clearRect(0,0,W,H);ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);
    if(state.shake){ctx.translate((Math.random()-.5)*state.shake,(Math.random()-.5)*state.shake);}
    drawStage();drawConsole();drawSide();drawFX();ctx.restore();
  }
  function drawStage(){
    const g=ctx.createLinearGradient(0,0,0,stage.h);g.addColorStop(0,'#03051a');g.addColorStop(1,'#09072b');ctx.fillStyle=g;rr(stage.x,stage.y,stage.w,stage.h,12);ctx.fill();ctx.strokeStyle='#666c84';ctx.lineWidth=3;ctx.stroke();
    ctx.save();rr(stage.x+3,stage.y+3,stage.w-6,stage.h-6,10);ctx.clip();
    stars.forEach(s=>{ctx.globalAlpha=s.a;ctx.fillStyle='#ced3ff';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,7);ctx.fill();});ctx.globalAlpha=1;
    for(let i=0;i<5;i++){const x=110+i*240+Math.sin(i*7)*35;const grad=ctx.createLinearGradient(x,25,x+60,520);grad.addColorStop(0,'#3220a066');grad.addColorStop(1,'#160e5a00');ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(x,20);ctx.lineTo(x+105,520);ctx.lineTo(x-30,520);ctx.fill();}
    motes.forEach(m=>{const gr=ctx.createRadialGradient(m.x,m.y,0,m.x,m.y,m.r);gr.addColorStop(0,'#b9c1e044');gr.addColorStop(1,'#8790c000');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(m.x,m.y,m.r,0,7);ctx.fill();});
    state.enemies.forEach(drawEnemy);state.shots.forEach(drawShot);state.drops.forEach(drawDrop);
    for(let i=0;i<lanes.length;i++)if(lanes[i].unlocked)drawTower(i);
    ctx.fillStyle='#35394a';ctx.fillRect(stage.x,stage.y+stage.h-26,stage.w,26);ctx.fillStyle='#71778b';ctx.fillRect(stage.x,stage.y+stage.h-29,stage.w,4);
    for(let x=32;x<1200;x+=38){ctx.fillStyle='#4e5368';ctx.fillRect(x,stage.y+stage.h-48,4,22);}
    ctx.restore();
  }
  function drawEnemy(e){
    ctx.save();ctx.translate(e.x,e.y+Math.sin(e.phase)*5);glow(e.elite?C.pink:C.violet,22);ctx.fillStyle=e.elite?'#ff54bd':'#a98cfb';ctx.beginPath();ctx.ellipse(0,3,e.r,e.r*.42,0,0,7);ctx.fill();ctx.fillStyle='#d8c7ff';ctx.beginPath();ctx.arc(0,-3,e.r*.43,Math.PI,0);ctx.fill();ctx.strokeStyle='#e7ddff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-e.r,5);ctx.lineTo(e.r,5);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#383053';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-3,e.r*.32,Math.PI,0);ctx.stroke();ctx.restore();
  }
  function drawTower(i){
    const l=lanes[i],x=towerXs[i],y=stage.y+stage.h-30,active=state.selected===i;ctx.save();ctx.translate(x,y);if(active){glow(l.color,28);ctx.fillStyle=l.color+'25';ctx.beginPath();ctx.arc(0,0,54,0,7);ctx.fill();}glow(l.color,16);ctx.fillStyle='#62687c';ctx.beginPath();ctx.moveTo(-17,0);ctx.lineTo(-14,-34);ctx.lineTo(-6,-34);ctx.lineTo(-6,-43);ctx.lineTo(0,-39);ctx.lineTo(6,-43);ctx.lineTo(6,-34);ctx.lineTo(14,-34);ctx.lineTo(17,0);ctx.fill();ctx.fillStyle='#22263a';ctx.fillRect(-10,-27,20,19);ctx.fillStyle=l.color;ctx.fillRect(-5,-22,10,10);ctx.restore();
  }
  function drawShot(s){ctx.save();ctx.lineCap='round';if(s.kind==='laser'){const pts=[...s.trail,{x:s.x,y:s.y}];glow(s.color,22);ctx.globalAlpha=.38;ctx.strokeStyle=s.color;ctx.lineWidth=10;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.globalAlpha=.9;ctx.strokeStyle=s.color;ctx.lineWidth=4;ctx.stroke();ctx.globalAlpha=1;ctx.strokeStyle='#fffbd2';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle='#fffbd2';glow(s.color,28);ctx.beginPath();ctx.arc(s.x,s.y,4.5,0,7);ctx.fill();ctx.restore();return;}for(let i=1;i<s.trail.length;i++){ctx.globalAlpha=i/s.trail.length*.5;ctx.strokeStyle=s.color;ctx.lineWidth=1+i/3;ctx.beginPath();ctx.moveTo(s.trail[i-1].x,s.trail[i-1].y);ctx.lineTo(s.trail[i].x,s.trail[i].y);ctx.stroke();}ctx.globalAlpha=1;glow(s.color,18);ctx.fillStyle=s.color;ctx.beginPath();ctx.moveTo(s.x,s.y-10);ctx.quadraticCurveTo(s.x+8,s.y,s.x,s.y+9);ctx.quadraticCurveTo(s.x-7,s.y,s.x,s.y-10);ctx.fill();ctx.restore();}
  function drawDrop(d){ctx.save();glow(d.color,16);ctx.fillStyle=d.color;ctx.beginPath();ctx.moveTo(d.x,d.y-d.r*1.8);ctx.quadraticCurveTo(d.x+d.r,d.y,d.x,d.y+d.r*1.3);ctx.quadraticCurveTo(d.x-d.r,d.y,d.x,d.y-d.r*1.8);ctx.fill();ctx.restore();}
  function drawConsole(){
    const y=535;ctx.fillStyle=C.panel;ctx.fillRect(0,y,1220,H-y);ctx.strokeStyle='#7b8092';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(410,y);ctx.lineTo(438,584);ctx.lineTo(735,584);ctx.lineTo(763,y);ctx.lineTo(1220,y);ctx.stroke();
    text('EXP.',120,604,31);mono(`${String(state.xp).padStart(3,'0')} / ${state.need}`,196,604,19,'left',C.white);meter(118,630,265,12,state.xp/state.need,C.mint);
    text(`LEVEL ${state.level}`,585,565,46,'center');mono(`SCORE ${String(state.score).padStart(6,'0')}`,585,613,15,'center','#8e94aa');
    ctx.strokeStyle=C.amber;ctx.lineWidth=4;ctx.strokeRect(820,565,45,45);text('ϟ',843,589,37,'center',C.amber);mono(`${Math.ceil(state.energy).toString().padStart(3,'0')} / 100`,883,588,20,'left',C.white);meter(883,615,235,12,state.energy/100,state.energy<25?C.pink:C.amber);
    drawSequencer();
  }
  function meter(x,y,w,h,p,color){ctx.fillStyle='#4b4f61';rr(x,y,w,h,3);ctx.fill();ctx.fillStyle=color;rr(x,y,Math.max(0,w*Math.min(1,p)),h,3);ctx.fill();glow(color,10);ctx.fill();ctx.shadowBlur=0;}
  function drawSequencer(){
    const unlocked=lanes.filter(l=>l.unlocked).length,rowH=Math.min(31,108/unlocked),top=seq.y+(126-rowH*unlocked)/2;
    ctx.fillStyle='#101321';rr(seq.x-15,seq.y-5,seq.w+30,seq.h+4,5);ctx.fill();ctx.strokeStyle='#e8e9ef';ctx.lineWidth=3;ctx.stroke();
    for(let j=0;j<unlocked;j++){const l=lanes[j],y=top+j*rowH+rowH/2;ctx.globalAlpha=state.selected===j?1:.63;
      if(state.selected===j){const segment=state.segmentCursors[j],hx=seq.x+segment*seq.w/4;ctx.fillStyle=l.color+(state.replacePulse>0?'40':'20');ctx.fillRect(hx,y-rowH/2+2,seq.w/4,rowH-4);ctx.strokeStyle=l.color;ctx.lineWidth=1.5;ctx.strokeRect(hx+1,y-rowH/2+3,seq.w/4-2,rowH-6);}
      ctx.strokeStyle=l.color;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(seq.x-25,y);ctx.lineTo(seq.x+seq.w+25,y);ctx.stroke();ctx.fillStyle=l.color;ctx.beginPath();ctx.moveTo(seq.x-25,y);ctx.lineTo(seq.x-5,y-9);ctx.lineTo(seq.x-5,y+9);ctx.fill();ctx.beginPath();ctx.moveTo(seq.x+seq.w+25,y);ctx.lineTo(seq.x+seq.w+5,y-9);ctx.lineTo(seq.x+seq.w+5,y+9);ctx.fill();
      for(let i=0;i<16;i++){const x=seq.x+(i+.5)*seq.w/16,r=l.pattern[i]?(i%4===0?10:7):3;glow(l.color,l.pattern[i]?10:0);ctx.fillStyle=l.pattern[i]?l.color:'#30384a';ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();ctx.strokeStyle=l.color;ctx.lineWidth=2;ctx.stroke();}
      ctx.globalAlpha=1;
    }
    ctx.shadowBlur=0;ctx.strokeStyle='#68708688';ctx.lineWidth=1;for(let i=1;i<4;i++){const x=seq.x+i*seq.w/4;ctx.beginPath();ctx.moveTo(x,seq.y);ctx.lineTo(x,seq.y+seq.h-6);ctx.stroke();}
    const px=seq.x+((state.beat/state.beatLength)%16+.5)*seq.w/16;ctx.shadowBlur=0;ctx.strokeStyle='#f7f8fb';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(px,seq.y-10);ctx.lineTo(px,seq.y+seq.h+4);ctx.stroke();ctx.fillStyle='#f7f8fb';ctx.beginPath();ctx.moveTo(px-11,seq.y-11);ctx.lineTo(px+11,seq.y-11);ctx.lineTo(px,seq.y+1);ctx.fill();
  }
  function drawSide(){
    ctx.fillStyle='#3a3e4e';ctx.fillRect(side.x,0,W-side.x,H);ctx.strokeStyle='#777c8f';ctx.lineWidth=3;ctx.strokeRect(side.x+1,1,W-side.x-3,H-2);
    text('RHYTHM',1324,48,25,'center','#d4d6df');mono('PATTERN BANK',1324,75,12,'center','#858ba1');
    const unlocked=lanes.filter(l=>l.unlocked).length;
    for(let i=0;i<cards.length;i++){const y=104+i*98, col=lanes[i%unlocked].color, count=state.cardCounts[i];ctx.fillStyle=count?'#070910':'#191b26';rr(1250,y,150,70,6);ctx.fill();ctx.strokeStyle=count?col+'aa':'#474b59';ctx.lineWidth=2;ctx.stroke();
      if(count){ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(1270,y+34);ctx.lineTo(1380,y+34);ctx.stroke();for(let k=0;k<4;k++){const x=1280+k*30;ctx.fillStyle=cards[i][k]?col:'#252c3d';glow(col,cards[i][k]?8:0);ctx.beginPath();ctx.arc(x,y+34,cards[i][k]?7:4,0,7);ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();}}
      mono(`x${count}`,1393,y+58,15,'right',count?C.white:'#6b6f7d');
    }
    const l=lanes[state.selected],next=state.segmentCursors[state.selected]*4+1;ctx.fillStyle=l.color+'22';rr(1248,710,154,65,5);ctx.fill();ctx.strokeStyle=l.color;ctx.stroke();text(l.name,1325,731,22,'center',l.color);mono(`NEXT ${String(next).padStart(2,'0')}–${String(next+3).padStart(2,'0')}`,1325,756,11,'center','#d8dbe5');
  }
  function drawFX(){state.xpOrbs.forEach(o=>{ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.phase);glow(C.cyan,16);ctx.fillStyle='#d9ffff';ctx.beginPath();ctx.moveTo(0,-o.r*1.8);ctx.lineTo(o.r,0);ctx.lineTo(0,o.r*1.8);ctx.lineTo(-o.r,0);ctx.closePath();ctx.fill();ctx.restore();});state.particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/p.max);glow(p.color,8);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill();});state.flashes.forEach(f=>{ctx.globalAlpha=f.life/.2;ctx.strokeStyle=f.color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,7);ctx.stroke();});ctx.globalAlpha=1;ctx.shadowBlur=0;if(state.overdrive>0){ctx.strokeStyle=C.amber;ctx.lineWidth=5;ctx.strokeRect(7,7,W-14,H-14);mono('OVERDRIVE',1188,607,15,'right',C.amber);}}

  function hit(x,y){
    const sx=x*W/canvas.getBoundingClientRect().width, sy=y*H/canvas.getBoundingClientRect().height;
    const unlocked=lanes.filter(l=>l.unlocked).length;
    if(sy>=seq.y-10&&sy<=seq.y+seq.h+10&&sx>=seq.x-30&&sx<=seq.x+seq.w+30){const rowH=Math.min(31,108/unlocked),top=seq.y+(126-rowH*unlocked)/2;state.selected=Math.max(0,Math.min(unlocked-1,Math.floor((sy-top)/rowH)));tone(lanes[state.selected].sound,.08,'triangle',.04,30);return;}
    if(sx>=1245&&sx<=1405&&sy>=100&&sy<692){const idx=Math.floor((sy-104)/98);if(idx>=0&&idx<cards.length&&state.cardCounts[idx]>0){const lane=state.selected,segment=state.segmentCursors[lane],start=segment*4;lanes[lane].pattern.splice(start,4,...cards[idx]);state.segmentCursors[lane]=(segment+1)%4;state.replacePulse=.35;state.cardCounts[idx]--;state.message=`${lanes[lane].name} · BEATS ${start+1}–${start+4} LOADED`;tone(260+idx*35,.13,'square',.05,120);burst(towerXs[lane],stage.y+stage.h-50,lanes[lane].color,14,160);}}
    if(sx>800&&sx<1130&&sy>555&&sy<640)overdrive();
  }
  function overdrive(){if(state.energy>=28&&state.overdrive<=0){state.energy-=28;state.overdrive=4;for(let i=0;i<lanes.length;i++)if(lanes[i].unlocked)fire(i);tone(130,.4,'sawtooth',.08,520);}}
  canvas.addEventListener('pointerdown',e=>{if(!state.running)return;const r=canvas.getBoundingClientRect();hit(e.clientX-r.left,e.clientY-r.top);});
  addEventListener('keydown',e=>{if(!state.running)return;if(e.code==='Space'){e.preventDefault();overdrive();}if(/^Digit[1-4]$/.test(e.code)){const i=Number(e.code.at(-1))-1;if(lanes[i]?.unlocked)state.selected=i;}});
  document.querySelector('#start').onclick=start;document.querySelector('#restart').onclick=start;document.querySelector('#mute').onclick=()=>{state.muted=!state.muted;document.querySelector('#mute').textContent=state.muted?'×':'♫';};document.querySelectorAll('[data-buff]').forEach(button=>button.addEventListener('click',()=>chooseBuff(button.dataset.buff)));
  function loop(t){if(!state.running)return;const dt=Math.min(.034,(t-last)/1000||0);last=t;if(!state.paused)update(dt);draw();requestAnimationFrame(loop);}
  draw();
  if(new URLSearchParams(location.search).has('demo')) setTimeout(start,80);
})();
