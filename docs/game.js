(function (global) {
'use strict';
const ID='derniere-luciole',COUNT=20,DIRS=[[1,0],[0,1],[-1,0],[0,-1]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const integer=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
function seeded(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function traverse(cells,w,start){
 const q=[start],distance=Array(cells.length).fill(-1),parent=Array(cells.length).fill(-1);distance[start]=0;let farthest=start;
 for(let h=0;h<q.length;h++){const p=q[h],x=p%w,y=Math.floor(p/w);for(const[dx,dy]of DIRS){const nx=x+dx,ny=y+dy,n=ny*w+nx;if(nx<0||ny<0||nx>=w||ny>=w||cells[n]||distance[n]!==-1)continue;distance[n]=distance[p]+1;parent[n]=p;q.push(n);if(distance[n]>distance[farthest])farthest=n;}}
 return{farthest,distance,parent};
}
// Every lamp is on a known shortest route; every segment fits one full charge.
function generateLevel(n){
 const level=clamp(Math.floor(n)||1,1,COUNT),width=level<=4?7:9,rng=seeded(17239+level*7919+(level===3?1234:0)),cells=Array(width*width).fill(1),stack=[[1,1]];cells[width+1]=0;
 while(stack.length){const[x,y]=stack[stack.length-1],choices=DIRS.filter(([dx,dy])=>{const nx=x+dx*2,ny=y+dy*2;return nx>0&&ny>0&&nx<width-1&&ny<width-1&&cells[ny*width+nx];});if(!choices.length){stack.pop();continue;}const[dx,dy]=choices[Math.floor(rng()*choices.length)];cells[(y+dy)*width+x+dx]=0;cells[(y+dy*2)*width+x+dx*2]=0;stack.push([x+dx*2,y+dy*2]);}
 const start=traverse(cells,width,width+1).farthest,route=traverse(cells,width,start),exit=route.farthest,solution=[];for(let p=exit;p!==-1;p=route.parent[p])solution.push(p);solution.reverse();
 const capacity=level<=10?7:level<=15?6:5,lanterns=[];let step=0;while(solution.length-1-step>=capacity){step+=capacity-1-(rng()>0.64?1:0);lanterns.push(solution[step]);}
 return{level,width,cells,start,exit,solution,lanterns,capacity,par:solution.length-1};
}
function box(c,x,y,w,h,r,color){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();if(color){c.fillStyle=color;c.fill();}}
function createGame(api){
 api=api||{};const progress=api.progress&&typeof api.progress==='object'?api.progress:(api.progress={});if(!progress.luciole||typeof progress.luciole!=='object'||Array.isArray(progress.luciole))progress.luciole={};const records=progress.luciole;
 records.unlocked=integer(records.unlocked,1,COUNT)?records.unlocked:1;records.level=integer(records.level,1,records.unlocked)?records.level:1;if(!records.best||typeof records.best!=='object'||Array.isArray(records.best))records.best={};for(const k of Object.keys(records.best)){const b=records.best[k];if(!integer(Number(k),1,COUNT)||!b||!integer(b.moves,0,100000)||!integer(b.stars,1,3))delete records.best[k];}
 let layout=generateLevel(records.level),s=null,touch=null,clock=0,bump=0,messageTime=-10,endSent=false;
 const call=(name,...args)=>{if(typeof api[name]==='function')return api[name](...args);};
 const litCount=()=>s.lit.filter(Boolean).length;
 const score=()=>Math.max(100,1000-Math.max(0,s.moves-layout.par)*30)+s.level*50;
 function hud(){call('hud','Lumière',s.energy+'/'+layout.capacity,'Lanternes',litCount()+'/'+layout.lanterns.length,'Pas',s.moves);}
 function toast(text){if(clock-messageTime>=0.7){messageTime=clock;call('toast',text);}}
 function load(number,save){layout=generateLevel(number);s={level:layout.level,x:layout.start%layout.width,y:Math.floor(layout.start/layout.width),energy:layout.capacity,moves:0,lit:layout.lanterns.map(()=>false),status:'playing'};records.level=layout.level;touch=null;bump=0;endSent=false;hud();if(save)call('save');}
 function finish(won){
  if(endSent||s.status!=='playing')return;s.status=won?'won':'lost';endSent=true;
  if(won){const stars=s.moves<=layout.par?3:s.moves<=layout.par+4?2:1,previous=records.best[s.level];if(!previous||s.moves<previous.moves)records.best[s.level]={stars,moves:s.moves};records.unlocked=Math.max(records.unlocked,Math.min(COUNT,s.level+1));call('save');call('end',s.level===COUNT?'La forêt s’illumine !':'Une lumière de plus',stars+'/3 étoiles · '+s.moves+' pas'+(stars===3?' · Parcours parfait !':' · Objectif : '+layout.par+' pas'),score(),true);}
  else{call('save');call('end','Une pause dans la nuit','Ta lumière est épuisée. Chaque lanterne recharge une seule fois : cherche le chemin le plus court.',0,false);}
 }
 function move(dx,dy){
  if(!s||s.status!=='playing')return false;const nx=s.x+dx,ny=s.y+dy;if(nx<0||ny<0||nx>=layout.width||ny>=layout.width||layout.cells[ny*layout.width+nx]){bump=0.18;return false;}
  s.x=nx;s.y=ny;s.moves++;s.energy--;const tile=ny*layout.width+nx,lamp=layout.lanterns.indexOf(tile);if(lamp>=0&&!s.lit[lamp]){s.lit[lamp]=true;s.energy=layout.capacity;toast('Lanterne allumée : lumière rechargée !');}hud();
  if(tile===layout.exit&&litCount()===layout.lanterns.length)finish(true);else if(s.energy<=0)finish(false);else{if(tile===layout.exit)toast('Allume encore '+(layout.lanterns.length-litCount())+' lanterne(s).');call('save');}return true;
 }
 function geometry(){const tile=Math.floor(342/layout.width),side=tile*layout.width;return{tile,side,left:(420-side)/2,top:145+(342-side)/2};}
 function navigate(delta){const n=s.level+delta;if(n<1||n>records.unlocked||n>COUNT){if(n>records.unlocked)toast('Termine ce niveau pour ouvrir le suivant.');return;}load(n,true);}
 function pointer(type,x,y){
  if(type==='down'){touch={x,y};return;}if(type==='cancel'){touch=null;return;}if(type!=='up'||!touch)return;const from=touch;touch=null;const dx=x-from.x,dy=y-from.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))>18){if(s.status==='playing')move(Math.abs(dx)>Math.abs(dy)?Math.sign(dx):0,Math.abs(dy)>=Math.abs(dx)?Math.sign(dy):0);return;}
  if(y>=538&&y<=582){if(x>=25&&x<=69)navigate(-1);else if(x>=351&&x<=395)navigate(1);return;}if(s.status!=='playing')return;
  const g=geometry(),tx=Math.floor((x-g.left)/g.tile),ty=Math.floor((y-g.top)/g.tile),mx=tx-s.x,my=ty-s.y;if(Math.abs(mx)+Math.abs(my)===1)move(mx,my);else if(tx>=0&&tx<layout.width&&ty>=0&&ty<layout.width)toast('Touche une case voisine, ou glisse pour avancer.');
 }
 function key(value,down){if(!down)return;const keys={arrowup:[0,-1],w:[0,-1],z:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],q:[-1,0],arrowright:[1,0],d:[1,0]},dir=keys[String(value).toLowerCase()];if(dir)move(...dir);}
 function update(dt){if(Number.isFinite(dt)){clock+=clamp(dt,0,0.1);bump=Math.max(0,bump-clamp(dt,0,0.1));}}
 function draw(c){
  if(!s)return;c.save();c.clearRect(0,0,420,600);const bg=c.createLinearGradient(0,0,420,600);bg.addColorStop(0,'#101c2d');bg.addColorStop(1,'#07141b');c.fillStyle=bg;c.fillRect(0,0,420,600);
  for(let i=0;i<28;i++){const x=(i*73.7+Math.sin(clock*0.18+i)*7)%420,y=(i*117.3+clock*(1+i%3))%600;c.fillStyle='rgba(171,230,190,'+(0.05+Math.sin(clock+i)*0.025)+')';c.beginPath();c.arc(x,y,1.5,0,7);c.fill();}
  c.font='700 11px system-ui, sans-serif';c.fillStyle='#8fb5ad';c.fillText('LA FORÊT DES LANTERNES',25,27);c.font='700 27px system-ui, sans-serif';c.fillStyle='#f6f4df';c.fillText('Dernière Luciole',24,59);
  box(c,352,34,43,31,10,'#243c43');c.textAlign='center';c.font='700 15px system-ui, sans-serif';c.fillStyle='#d6f4ae';c.fillText(String(s.level).padStart(2,'0'),374,55);c.textAlign='left';
  box(c,24,80,372,44,12,'#172b35');c.font='600 11px system-ui, sans-serif';c.fillStyle='#b8cbc4';c.fillText('LUMIÈRE',38,98);c.fillStyle=s.energy<=2?'#ffb097':'#d7efb1';c.font='700 11px system-ui, sans-serif';c.fillText(s.energy+' / '+layout.capacity,38,114);
  const pip=224/layout.capacity;for(let p=0;p<layout.capacity;p++)box(c,145+p*pip,94,pip-5,17,5,p<s.energy?s.energy<=2?'#f29579':'#d1e995':'#2c4247');
  const g=geometry(),px=g.left+(s.x+0.5)*g.tile,py=g.top+(s.y+0.5)*g.tile;box(c,g.left-7,g.top-7,g.side+14,g.side+14,17,'#0b1922');c.save();c.translate(bump>0?Math.sin(bump*100)*2:0,0);
  for(let y=0;y<layout.width;y++)for(let x=0;x<layout.width;x++){const i=y*layout.width+x,left=g.left+x*g.tile,top=g.top+y*g.tile;if(layout.cells[i]){box(c,left+2,top+2,g.tile-4,g.tile-4,7,'#1a3039');c.fillStyle='#223e45';c.fillRect(left+8,top+5,g.tile-16,2);}else{box(c,left+1,top+1,g.tile-2,g.tile-2,5,'#10232a');c.fillStyle='#1f373b';c.beginPath();c.arc(left+g.tile*0.5,top+g.tile*0.5,1.4,0,7);c.fill();}}
  if(s.level===1&&s.moves<3){c.strokeStyle='rgba(192,232,171,0.28)';c.lineWidth=2;c.setLineDash([3,5]);c.beginPath();layout.solution.slice(0,4).forEach((p,i)=>{const x=g.left+(p%layout.width+0.5)*g.tile,y=g.top+(Math.floor(p/layout.width)+0.5)*g.tile;if(!i)c.moveTo(x,y);else c.lineTo(x,y);});c.stroke();c.setLineDash([]);}
  const ex=g.left+(layout.exit%layout.width+0.5)*g.tile,ey=g.top+(Math.floor(layout.exit/layout.width)+0.5)*g.tile,ready=litCount()===layout.lanterns.length;c.strokeStyle=ready?'#9ee8c2':'#4f7770';c.lineWidth=2;c.beginPath();c.arc(ex,ey,g.tile*0.28,0,Math.PI*2);c.stroke();c.beginPath();c.moveTo(ex-5,ey);c.lineTo(ex+5,ey);c.moveTo(ex+1,ey-4);c.lineTo(ex+5,ey);c.lineTo(ex+1,ey+4);c.stroke();
  layout.lanterns.forEach((p,i)=>{const lx=g.left+(p%layout.width+0.5)*g.tile,ly=g.top+(Math.floor(p/layout.width)+0.5)*g.tile;if(s.lit[i]){const glow=c.createRadialGradient(lx,ly,1,lx,ly,g.tile*0.72);glow.addColorStop(0,'rgba(232,198,91,0.22)');glow.addColorStop(1,'rgba(232,198,91,0)');c.fillStyle=glow;c.fillRect(lx-g.tile,ly-g.tile,g.tile*2,g.tile*2);}c.strokeStyle=s.lit[i]?'#efd17d':'#8ba7a0';c.lineWidth=2;box(c,lx-6,ly-5,12,14,3,s.lit[i]?'#bf9d51':'#304c50');c.stroke();c.beginPath();c.arc(lx,ly-7,3.5,Math.PI,0);c.stroke();if(s.lit[i]){c.fillStyle='#fff0aa';c.beginPath();c.arc(lx,ly+1,2.7,0,7);c.fill();}});
  const aura=c.createRadialGradient(px,py,2,px,py,40+s.energy*3);aura.addColorStop(0,'rgba(236,250,168,0.25)');aura.addColorStop(1,'rgba(236,250,168,0)');c.fillStyle=aura;c.fillRect(px-70,py-70,140,140);const flutter=Math.sin(clock*12)*0.3;c.fillStyle='rgba(193,227,203,0.6)';c.beginPath();c.ellipse(px-7,py-4,8,4.5+flutter,-0.7,0,7);c.fill();c.beginPath();c.ellipse(px+7,py-4,8,4.5+flutter,0.7,0,7);c.fill();c.fillStyle='#f3f2b4';c.beginPath();c.ellipse(px,py+1,5,8,0,0,7);c.fill();c.fillStyle='#203943';c.beginPath();c.arc(px,py-5,4,0,7);c.fill();c.restore();
  c.textAlign='center';c.font='600 12px system-ui, sans-serif';c.fillStyle='#dce8d0';c.fillText(ready?'Toutes les lanternes brillent. Rejoins la sortie !':'Allume chaque lanterne, puis rejoins la sortie.',210,510);c.font='11px system-ui, sans-serif';c.fillStyle='#86a8a8';c.fillText('Glisse ou touche une case voisine · une case = une lumière',210,529);
  box(c,25,542,44,36,10,s.level>1?'#213c43':'#142b34');box(c,351,542,44,36,10,s.level<records.unlocked?'#213c43':'#142b34');c.font='22px system-ui, sans-serif';c.fillStyle=s.level>1?'#c3dbcc':'#4b656c';c.fillText('‹',47,568);c.fillStyle=s.level<records.unlocked?'#c3dbcc':'#4b656c';c.fillText('›',373,568);c.font='700 12px system-ui, sans-serif';c.fillStyle='#d8e5cf';c.fillText('Niveau '+s.level+' / '+COUNT+' · Objectif '+layout.par+' pas',210,553);const best=records.best[s.level];c.font='11px system-ui, sans-serif';c.fillStyle='#8da9a5';c.fillText(best?'Meilleur : '+best.moves+' pas · '+'★'.repeat(best.stars):'Une lanterne se recharge une seule fois.',210,573);c.restore();
 }
 function snapshot(){return s?{game:ID,version:1,level:s.level,x:s.x,y:s.y,energy:s.energy,moves:s.moves,lit:s.lit.slice(),status:s.status,score:s.status==='won'?score():0}:null;}
 function restore(d){
  if(!d||d.game!==ID||d.version!==1||!integer(d.level,1,COUNT))return false;const a=generateLevel(d.level);if(!integer(d.x,0,a.width-1)||!integer(d.y,0,a.width-1)||a.cells[d.y*a.width+d.x])return false;if(!integer(d.energy,0,a.capacity)||!integer(d.moves,0,100000))return false;
  if(!Array.isArray(d.lit)||d.lit.length!==a.lanterns.length||!d.lit.every(v=>typeof v==='boolean')||!['playing','won','lost'].includes(d.status))return false;if(d.status==='playing'&&d.energy===0)return false;if(d.status==='won'&&(d.y*a.width+d.x!==a.exit||!d.lit.every(Boolean)))return false;if(d.status==='lost'&&d.energy!==0)return false;
  layout=a;s={level:d.level,x:d.x,y:d.y,energy:d.energy,moves:d.moves,lit:d.lit.slice(),status:d.status};records.level=d.level;records.unlocked=Math.max(records.unlocked,d.level);endSent=d.status!=='playing';touch=null;hud();return true;
 }
 function next(){if(!s||s.status!=='won')return;if(s.level<COUNT)load(s.level+1,true);else{load(1,true);toast('Les 20 niveaux sont terminés. Vise les 60 étoiles !');}}
 return{reset:()=>load(records.level,true),update,draw,pointer,key,snapshot,restore,next};
}
if(global)global.createGame=createGame;
if(typeof module!=='undefined'&&module.exports)module.exports={createGame,generateLevel,traverse,LEVEL_COUNT:COUNT};
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:this);

