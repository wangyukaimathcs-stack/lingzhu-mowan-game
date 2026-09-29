(() => {
  'use strict';
  const W=1200,H=680,FLOOR=600,GRAVITY=1550,SPEED=285,JUMP=610;
  const canvas=document.getElementById('game'),c=canvas.getContext('2d');
  const menu=document.getElementById('menu'),play=document.getElementById('play'),win=document.getElementById('win');
  const blueImg=new Image(),redImg=new Image(); blueImg.src='blue.jpg'; redImg.src='red.png';
  const data=[
    {name:'双路初遇',desc:'按钮 · 双路线',hint:'踩亮两侧按钮，互相开启前路。',
     starts:[[95,552],[1070,552]],buttons:[{x:245,color:'blue',opens:'redGate'},{x:925,color:'red',opens:'blueGate'}],
     gates:[{x:535,id:'blueGate',color:'blue'},{x:665,id:'redGate',color:'red'}],
     platforms:[{x:345,y:488,w:135},{x:720,y:488,w:135}],
     hazards:[{x:390,w:75,color:'red'},{x:735,w:75,color:'blue'}]},
    {name:'高台接力',desc:'按钮 · 推箱 · 升降台',hint:'推动箱子压住方形按钮；另一侧按钮启动升降台。',
     starts:[[90,552],[1070,552]],buttons:[{x:430,color:'box',opens:'redGate'},{x:960,color:'red',opens:'lift'}],
     gates:[{x:770,id:'redGate',color:'red'},{x:615,id:'wall',color:'stone'}],
     platforms:[{x:665,y:505,w:95}],box:{x:305,y:558,w:42,h:42},lift:{x:515,y:535,w:95,target:430},
     hazards:[{x:860,w:65,color:'blue'}]},
    {name:'同频冲刺',desc:'同步机关 · 移动台 · 限时门',hint:'同时站上两枚圆形按钮启动移动台；门打开后抓紧通过。',
     starts:[[90,552],[1070,552]],sync:[{x:240,color:'blue'},{x:925,color:'red'}],
     timed:[{x:810},{x:985}],gates:[{x:855,id:'timer',color:'gold'}],
     pit:{x:440,w:320},moving:{x:453,y:515,w:132,range:180},hazards:[]}
  ];
  const key='lingzhu-mowan-progress-v1';let cleared=[];try{cleared=JSON.parse(localStorage.getItem(key))||[]}catch{}
  let level=-1,world=null,players=[],keys=new Set(),last=0,raf=0,mode='menu';
  const rect=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const open=id=>id==='wall'?false:id==='timer'?world.timer>0:!!world.flags[id];
  function save(){try{localStorage.setItem(key,JSON.stringify(cleared))}catch{}}
  function makeMenu(){
    document.getElementById('levels').innerHTML=data.map((d,i)=>{let unlocked=i===0||cleared[i-1];return `<button class="level-card" data-level="${i}" ${unlocked?'':'disabled'}><span class="level-number">0${i+1}</span><span class="level-info"><strong>${d.name}</strong><small>${d.desc}</small></span><span class="level-state">${cleared[i]?'已通关':unlocked?'开始游玩':'未解锁'}</span><span class="level-arrow">→</span></button>`}).join('');
    document.querySelectorAll('.level-card:not(:disabled)').forEach(b=>b.onclick=()=>start(+b.dataset.level));
  }
  function showMenu(){mode='menu';cancelAnimationFrame(raf);keys.clear();win.classList.add('hidden');play.classList.add('hidden');menu.classList.remove('hidden');makeMenu()}
  function reset(){
    const d=data[level];world={flags:{},timer:0,clock:0,liftY:d.lift?d.lift.y:0,movingX:d.moving?d.moving.x:0,syncOn:false,box:d.box?{...d.box}:null};
    players=d.starts.map((p,i)=>({x:p[0],y:p[1],w:34,h:48,vx:0,vy:0,grounded:false,color:i?'red':'blue',atExit:false}));
  }
  function start(i){level=i;reset();mode='play';menu.classList.add('hidden');play.classList.remove('hidden');win.classList.add('hidden');document.getElementById('level-title').textContent=`第 ${i+1} 关 · ${data[i].name}`;document.getElementById('hint').textContent=data[i].hint;last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop)}
  function groundAt(x,d){return !(d.pit&&x>d.pit.x&&x<d.pit.x+d.pit.w)}
  function platforms(d){let a=[...(d.platforms||[]).map(p=>({...p}))];if(d.lift)a.push({x:d.lift.x,y:world.liftY,w:d.lift.w,lift:true});if(d.moving&&world.syncOn)a.push({x:world.movingX,y:d.moving.y,w:d.moving.w,moving:true});return a}
  function update(dt){
    const d=data[level];world.clock+=dt;world.timer=Math.max(0,world.timer-dt);
    if(d.lift){let target=world.flags.lift?d.lift.target:d.lift.y;world.liftY+=(target-world.liftY)*Math.min(1,dt*2.4)}
    if(d.moving)world.movingX=d.moving.x+(Math.sin(world.clock*1.55)+1)*.5*d.moving.range;
    // The box stays on the floor and can be pushed by either player.
    for(let i=0;i<players.length;i++){
      let p=players[i],left=keys.has(i?'ArrowLeft':'KeyA'),right=keys.has(i?'ArrowRight':'KeyD'),jump=keys.has(i?'ArrowUp':'KeyW');
      p.vx=(Number(right)-Number(left))*SPEED;
      if(jump&&p.grounded){p.vy=-JUMP;p.grounded=false}
      let oldX=p.x;p.x=Math.max(12,Math.min(W-p.w-12,p.x+p.vx*dt));
      if(world.box&&rect(p,world.box)){
        let dir=p.vx>0?1:-1,newX=world.box.x+dir*Math.abs(p.x-oldX);
        if(newX>=20&&newX+world.box.w<=W-20&&!d.gates.some(g=>!open(g.id)&&rect({x:newX,y:world.box.y,w:world.box.w,h:world.box.h},{x:g.x,y:455,w:26,h:145})))world.box.x=newX;
        p.x=dir>0?world.box.x-p.w:world.box.x+world.box.w;
      }
      for(const g of d.gates){if(open(g.id))continue;let wall={x:g.x,y:435,w:28,h:165};if(rect(p,wall))p.x=p.vx>0?wall.x-p.w:wall.x+wall.w}
      const wasBottom=p.y+p.h;p.vy+=GRAVITY*dt;p.y+=p.vy*dt;p.grounded=false;
      for(const platform of platforms(d)){
        if(p.vy>=0&&wasBottom<=platform.y+8&&p.y+p.h>=platform.y&&p.x+p.w>platform.x+4&&p.x<platform.x+platform.w-4){p.y=platform.y-p.h;p.vy=0;p.grounded=true;if(platform.moving)p.x+=Math.cos(world.clock*1.55)*.5*d.moving.range*1.55*dt;break}
      }
      if(p.vy>=0&&groundAt(p.x+p.w/2,d)&&p.y+p.h>=FLOOR&&wasBottom<=FLOOR+25){p.y=FLOOR-p.h;p.vy=0;p.grounded=true}
      if(p.y>H+50){reset();return}
      for(const h of d.hazards){if(h.color!==p.color&&rect(p,{x:h.x,y:FLOOR-14,w:h.w,h:18})){reset();return}}
    }
    if(d.buttons)for(const b of d.buttons){let active=b.color==='box'?world.box&&Math.abs(world.box.x+world.box.w/2-b.x)<39:players.some(p=>p.color===b.color&&Math.abs(p.x+p.w/2-b.x)<32&&p.y+p.h>FLOOR-17);if(active)world.flags[b.opens]=true}
    if(d.sync&&!world.syncOn){let both=d.sync.every(s=>players.some(p=>p.color===s.color&&Math.abs(p.x+p.w/2-s.x)<36&&p.y+p.h>FLOOR-17));if(both)world.syncOn=true}
    if(d.timed&&world.syncOn&&d.timed.some(b=>players.some(p=>Math.abs(p.x+p.w/2-b.x)<35&&p.y+p.h>FLOOR-17)))world.timer=7;
    const exits=[{x:1090,y:535,w:55,h:65},{x:55,y:535,w:55,h:65}];
    players.forEach((p,i)=>p.atExit=rect(p,exits[i]));
    if(players.every(p=>p.atExit)){cleared[level]=true;save();mode='win';win.classList.remove('hidden');document.getElementById('win-next').style.display=level<2?'':'none'}
  }
  function round(x,y,w,h,r,fill){c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill()}
  function text(t,x,y,size=16,color='#fff',align='left',weight=700){c.font=`${weight} ${size}px system-ui, Microsoft YaHei`;c.fillStyle=color;c.textAlign=align;c.fillText(t,x,y)}
  function draw(){
    const d=data[level];let sky=c.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#172f51');sky.addColorStop(1,'#254766');c.fillStyle=sky;c.fillRect(0,0,W,H);
    c.fillStyle='#ffffff0a';for(let i=0;i<24;i++){let x=(i*167+43)%W,y=(i*101+80)%390;c.beginPath();c.arc(x,y,i%3+1,0,7);c.fill()}
    c.fillStyle='#315b77';c.beginPath();c.moveTo(0,500);for(let x=0;x<=W;x+=80)c.lineTo(x,490+Math.sin(x*.014)*24);c.lineTo(W,680);c.lineTo(0,680);c.fill();
    // Floor and dangerous pit.
    let sections=d.pit?[[0,d.pit.x],[d.pit.x+d.pit.w,W]]:[[0,W]];
    for(const [a,b] of sections){round(a,FLOOR,b-a,80,0,'#263a4d');round(a,FLOOR,b-a,14,0,'#87bd94');for(let x=a+16;x<b;x+=55)round(x,FLOOR+31,26,5,2,'#385163')}
    if(d.pit){round(d.pit.x,FLOOR,d.pit.w,80,0,'#152231');for(let x=d.pit.x+15;x<d.pit.x+d.pit.w;x+=30){c.fillStyle='#ff6e71';c.beginPath();c.moveTo(x,FLOOR+26);c.lineTo(x+15,FLOOR+1);c.lineTo(x+30,FLOOR+26);c.fill()}}
    for(const h of d.hazards){round(h.x,FLOOR-12,h.w,15,5,h.color==='red'?'#ff735f':'#5ed1ff');text(h.color==='red'?'🔥':'❄',h.x+h.w/2,FLOOR-22,23,'#fff','center')}
    for(const p of platforms(d)){round(p.x,p.y,p.w,18,7,p.lift?'#b6a1ee':p.moving?'#f5c56c':'#5a8295');round(p.x,p.y,p.w,6,3,p.lift?'#ded0ff':p.moving?'#ffe6a1':'#99bdc7')}
    if(d.moving&&!world.syncOn)text('同步按钮启动移动台',W/2,465,18,'#adbdcf','center');
    const exits=[{x:1090,color:'#60d8ff',name:'灵珠'},{x:55,color:'#ff876e',name:'魔丸'}];
    exits.forEach((e,i)=>{round(e.x,510,55,90,16,'#112539');c.strokeStyle=e.color;c.lineWidth=4;c.strokeRect(e.x+4,514,47,84);round(e.x+12,532,31,44,15,e.color+'55');text(e.name,e.x+27,493,16,e.color,'center');if(players[i].atExit)text('✓',e.x+27,564,28,'#fff','center')});
    if(d.buttons)for(const b of d.buttons){let on=!!world.flags[b.opens],col=b.color==='blue'?'#65d4ff':b.color==='red'?'#ff8271':'#e8be7a';round(b.x-27,FLOOR-8,54,9,4,on?col:'#6b7686');round(b.x-18,FLOOR-16,36,9,4,on?col:'#9fabb8');text(b.color==='box'?'箱':b.color==='blue'?'蓝':'红',b.x,FLOOR-26,15,col,'center')}
    if(d.sync)for(const b of d.sync){let col=b.color==='blue'?'#67d8ff':'#ff8577';round(b.x-31,FLOOR-9,62,10,5,world.syncOn?col:'#7c8ba0');text(world.syncOn?'✓':'同步',b.x,FLOOR-25,15,col,'center')}
    if(d.timed)for(const b of d.timed){round(b.x-24,FLOOR-9,48,10,5,world.timer?'#ffd477':'#957b50');text('计时',b.x,FLOOR-25,15,'#ffd477','center')}
    for(const g of d.gates){if(open(g.id)){c.fillStyle='#92f6c533';c.fillRect(g.x,435,28,165);continue}let col=g.color==='blue'?'#65cfff':g.color==='red'?'#ff7a6a':g.color==='gold'?'#f5ca69':'#9cb1c1';round(g.x,435,28,165,5,col);for(let y=449;y<590;y+=30)round(g.x+6,y,16,7,3,'#142b4a88')}
    if(world.box){round(world.box.x,world.box.y,world.box.w,world.box.h,5,'#b88253');round(world.box.x+6,world.box.y+6,world.box.w-12,world.box.h-12,3,'#d9a76d');text('✦',world.box.x+21,world.box.y+29,22,'#fff4cd','center')}
    players.forEach((p,i)=>{let col=i?'#ff7768':'#65d5ff',img=i?redImg:blueImg;round(p.x-4,p.y+19,p.w+8,33,10,col);round(p.x+3,p.y+47,9,9,3,col);round(p.x+22,p.y+47,9,9,3,col);c.save();c.beginPath();c.arc(p.x+p.w/2,p.y+12,22,0,Math.PI*2);c.clip();if(img.complete&&img.naturalWidth)c.drawImage(img,p.x-5,p.y-10,44,44);else{c.fillStyle=col;c.fill()}c.restore();c.strokeStyle='#fff';c.lineWidth=3;c.beginPath();c.arc(p.x+p.w/2,p.y+12,23,0,7);c.stroke();text(i?'祥宏':'崇乐',p.x+p.w/2,p.y-19,13,'#fff','center')});
    if(d.sync){text(world.syncOn?'移动台已启动':'双人同时踩按钮',600,49,20,world.syncOn?'#a8f0c5':'#c6ddf5','center');if(world.timer>0)text(`门开启 ${Math.ceil(world.timer)} 秒`,600,80,16,'#ffe4a0','center')}
  }
  function loop(t){if(mode!=='play')return;let dt=Math.min(.032,(t-last)/1000||0);last=t;update(dt);draw();if(mode==='play')raf=requestAnimationFrame(loop)}
  window.addEventListener('keydown',e=>{if(['KeyA','KeyD','KeyW','ArrowLeft','ArrowRight','ArrowUp','KeyR'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='KeyR'&&mode==='play')reset()}});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
  document.getElementById('back').onclick=showMenu;document.getElementById('restart').onclick=()=>reset();document.getElementById('win-menu').onclick=showMenu;document.getElementById('win-next').onclick=()=>start(level+1);makeMenu();
})();

