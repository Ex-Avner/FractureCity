/* Skate lines: clear roads, readable parks and skill-based board chains. */
(function(){'use strict';
const S=window.FCSkate={manual:false,balance:0,manualTime:0,manualDistance:0,touchManual:false,animation:null,shuvs:0,repeats:{},spot:null,challenge:{flip:false,manual:false,grind:false},best:0};
const names=['DEAD CHANNEL','THE NIGHT SHIFT','CONCRETE COMMONS'];
const active=()=>Board.on&&!Board.bail&&!State.ui.paused&&!State.ui.inDialogue&&!State.ui.inMiniGame&&!State.ui.inArcade&&!State.ui.construct;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// All riding surfaces fit within the 14m park pad, with a clear central approach.
window.shSkatepark=function(chunk,rng,parts){
 const x=chunk.originX+12,z=chunk.originZ+12,top=PARK_TOP;
 const variant=Math.abs(hashStr(chunk.key))%3,name=names[variant];
 chunk.stampBox(x-7,top,z-7,x+7,top+16,z+7,B_AIR);
 chunk.stampBox(x-7,top-2,z-7,x+7,top,z+7,B_CONCRETE);
 chunk.stampBox(x-2,top-1,z-7,x+2,top,z-4,B_AIR);
 const ramp=(rx,rz,a,len,w,h,kind,base=top)=>{const q=shMakeRamp(rx,rz,base,a,len,w,h,kind);chunk.ramps.push(q);shBakeRamp(parts,q,0x424d53,variant===1?0xe59d66:0x78b7ae);return q};
 const rail=(x0,z0,x1,z1,h=.65)=>{const q=shMakeRail(x0,top+h,z0,x1,top+h,z1);if(q){chunk.rails.push(q);shBakeRail(parts,q,0xb9b7a1)}};
 ramp(x,z-6.95,Math.PI/2,2.95,1.8,1,'bank',top-1);
 if(variant!==2){
  ramp(x+3,z,0,3,2.2,variant===0?1.2:2.6,variant===0?'bank':'quarter');
  ramp(x-3,z,Math.PI,3,2.2,variant===0?1.2:2.6,variant===0?'bank':'quarter');
  rail(x-4,z+4,x+4,z+4);
 }else{
  ramp(x+1,z-3,0,4,1.2,1.5,'kick');
  ramp(x+1,z+3,0,4,1.2,1.5,'kick');
  rail(x-4,z-3,x-4,z+3,.5);
 }
 // Manual pad stripe: flush with the existing ground, no collider in the run-up.
 for(const dx of [-1.4,1.4])parts.push({w:.07,h:.015,d:5,x:x+dx,y:top+.018,z,color:0xd4b777});
 for(const dx of [-3.2,3.2])parts.push({w:.12,h:3.2,d:.12,x:x+dx,y:top+1.6,z:z+6.2,color:0x465657});
 for(const dx of [-5.8,5.8]){parts.push({w:.15,h:4.2,d:.15,x:x+dx,y:top+2.1,z:z+5.6,color:0x465657});parts.push({w:.6,h:.1,d:.45,x:x+dx,y:top+4.2,z:z+5.6,color:0xf5d5a0,emit:true})}
 const sign=shSignPlane(name,variant===0?'BANK / MANUAL / RAIL':variant===1?'TRANSITION / FAKIE / RAIL':'KICKER / SHOVE-IT / LOW RAIL','#eee5cf','#243b39',6,1.05);
 sign.position.set(x,top+2.9,z+6.2);sign.rotation.y=Math.PI;chunk.group.add(sign);
 chunk._skatepark=true;chunk.skateSpot={name,variant,x,z};
};
// A dependable spot between Common Ground and the Seam, outside the building plots.
// Like other authored districts, player voxel edits are applied by Chunk afterwards.
const generate=Chunk.prototype.generate;
Chunk.prototype.generate=function(){
 if(this.key!=='8,0')return generate.apply(this,arguments);
 this._maker=true;this.__cityFitted=1;this.landmark='skateyard';this._skateDone=true;this._parked=true;
 this.ramps=[];this.rails=[];
 for(let x=0;x<24;x++)for(let z=0;z<24;z++)this.vSet(x,0,z,(x===1||z===1)?B_PAINT:B_ASPHALT);
 const parts=[];shSkatepark(this,new RNG('skate:'+this.key),parts);
 for(const emit of [false,true]){const geo=shBakeParts(parts,emit);if(geo)this.group.add(new THREE.Mesh(geo,emit?CHAR_EMIT_MAT():CHAR_BODY_MAT()))}
};
function stopManual(score=true){
 if(S.manual&&score&&S.manualTime>.65){shBoardTrick('MANUAL',Math.round(Math.min(350,S.manualDistance*12)),true);if(S.manualTime>=2)S.challenge.manual=true}
 S.manual=false;S.manualTime=0;S.manualDistance=0;S.balance=0;
}
function trick(kind){
 if(!active()||!Board.air||Board.grind||Board.airT<.08||S.animation)return false;
 stopManual();S.animation={kind,t:0,duration:kind==='shuv'?.42:.52};shSfxBoardFlip();return true;
}
S.trick=trick;
for(const type of ['keydown','keyup'])addEventListener(type,e=>{
 if(!active()||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)||!['KeyX','KeyZ','KeyC'].includes(e.code))return;
 e.preventDefault();e.stopImmediatePropagation();
 const down=type==='keydown';if(e.code==='KeyC'){if(down)State.keys.add('c');else State.keys.delete('c')}
 else if(down&&!e.repeat)trick(e.code==='KeyX'?'flip':'shuv');
},true);
addEventListener('blur',()=>{State.keys.delete('c');S.touchManual=false;stopManual(false)});
const originalInput=shBoardInput;
window.shBoardInput=function(dt){
 const a=State.keys.has('a'),d=State.keys.has('d');
 // While balancing, A/D shifts weight rather than also carving the board.
 if(S.manual){State.keys.delete('a');State.keys.delete('d')}
 try{return originalInput.apply(this,arguments)}finally{if(a)State.keys.add('a');if(d)State.keys.add('d')}
};
const originalStep=shBoardStep;
window.shBoardStep=function(dt){
 if(!active())return originalStep.apply(this,arguments);
 dt=clamp(dt,0,.05);
 if(S.animation){S.animation.t+=dt;if(S.animation.t>=S.animation.duration){if(S.animation.kind==='flip')Board.flip++;else S.shuvs++;S.animation=null}}
 const wants=State.keys.has('c')||S.touchManual,ground=!Board.air&&!Board.grind&&shBoardSpeed()>3;
 if(wants&&ground&&!Board.charging){
  if(!S.manual){S.manual=true;S.balance=.08;S.manualTime=0;S.manualDistance=0}
  S.manualTime+=dt;S.manualDistance+=shBoardSpeed()*dt;
  S.balance+=(Math.sin(S.manualTime*2.3)*.3+S.balance*.9+(State.keys.has('d')?1.35:0)-(State.keys.has('a')?1.35:0))*dt;
  if(Math.abs(S.balance)>=1){stopManual(false);S.touchManual=false;State.keys.delete('c');shBoardBail();shBoardSay('Manual tipped · shorter holds, small A/D corrections')}
 }else stopManual();
 const result=originalStep.call(this,dt);
 if(Board.bail){stopManual(false);S.animation=null;S.shuvs=0}
 if(S.manual&&Board.combo)Board.combo.life=Math.max(Board.combo.life,.3);
 return result;
};
const originalLand=shBoardLand;
window.shBoardLand=function(fall){
 let shuv=S.shuvs,hadFlip=Board.flip>0;
 if(S.animation&&S.animation.t/S.animation.duration<.82){S.animation=null;S.shuvs=0;shBoardBail();Board.airT=0;Board.flip=0;Board.spun=0;return}
 if(S.animation){if(S.animation.kind==='flip'){Board.flip++;hadFlip=true}else shuv++;}
 S.animation=null;S.shuvs=0;
 originalLand.apply(this,arguments);
 if(!Board.bail){if(shuv)shBoardTrick(shuv>1?'DOUBLE SHOVE-IT':'SHOVE-IT',shuv*220,false);if(hadFlip||shuv)S.challenge.flip=true}
};
const originalTrick=shBoardTrick;
window.shBoardTrick=function(label,points,sticky){
 if(!Board.combo)S.repeats={};
 const family=label.includes('FLIP')?'FLIP':label.includes('SHOVE')?'SHOVE':label;
 const count=S.repeats[family]||0;S.repeats[family]=count+1;
 if(label==='GRIND')S.challenge.grind=true;
 return originalTrick.call(this,label,Math.round(points*Math.max(.2,1-count*.25)),sticky);
};
const originalFrame=shBoardFrame;
window.shBoardFrame=function(dt){const r=originalFrame.apply(this,arguments);if(Board.on&&Board.mesh){
 Board.mesh.rotation.x=Board.air?-.08:S.manual?-.22:0;
 if(S.manual)Board.mesh.rotation.z+=S.balance*.12;
 if(S.animation){const t=clamp(S.animation.t/S.animation.duration,0,1);if(S.animation.kind==='flip')Board.mesh.rotation.z+=t*Math.PI*2;else Board.mesh.rotation.y+=t*Math.PI*2}
 else if(!Board.air)Board.mesh.rotation.x=S.manual?-.22:Board.mesh.rotation.x;
 }return r;};
const mount=shBoardMount,dismount=shBoardDismount;
window.shBoardMount=function(){const r=mount.apply(this,arguments);S.animation=null;S.shuvs=0;stopManual(false);shBoardSay('X kickflip · Z shove-it · hold C manual, A/D balance · release Space to ollie');return r};
window.shBoardDismount=function(){stopManual();S.touchManual=false;State.keys.delete('c');S.animation=null;S.shuvs=0;return dismount.apply(this,arguments)};
function recordKey(){return 'fc-skate-line:'+ (window.FCAccounts?.user?.username||'local')+':'+State.citySeed+':'+S.spot?.name+':'+S.spot?.x+':'+S.spot?.z}
const bank=shBoardEndCombo;
window.shBoardEndCombo=function(landed){const total=Board.combo?Math.round(Board.combo.score*Board.combo.mult):0;const r=bank.apply(this,arguments);S.repeats={};if(landed&&S.spot&&!S.cleared&&Object.values(S.challenge).every(Boolean)){S.cleared=true;shBoardSay(S.spot.name+' · LINE COMPLETE · '+total+' points banked')}if(landed&&S.spot&&total>S.best){S.best=total;try{localStorage.setItem(recordKey(),String(total))}catch{}}return r};
const css=document.createElement('style');css.textContent='#skate-line{font:11px/1.5 system-ui;color:#eee5cf;background:#152527e8;padding:7px;border-radius:7px}#skate-balance{height:5px;background:linear-gradient(90deg,#c87060,#99d4b3 40%,#99d4b3 60%,#c87060);margin:6px 30px;position:relative}#skate-balance i{position:absolute;width:3px;height:11px;top:-3px;background:#fff}#skate-touch{display:none;pointer-events:auto}body.touch #skate-touch{display:flex;justify-content:center;gap:8px}#skate-touch button{font:inherit;min-height:44px;padding:8px 14px;background:#263b3a;color:#fff;border:1px solid #829c94;border-radius:7px}';document.head.append(css);
setInterval(()=>{
 if(!Board.on){S.touchManual=false;return}if(!active()){S.touchManual=false;State.keys.delete('c');stopManual(false)}
 let el=document.getElementById('skate-line');if(!el&&Board.hud){el=document.createElement('div');el.id='skate-line';el.innerHTML='<div data-line></div><div id="skate-balance" hidden><i></i></div><div id="skate-touch"><button data-trick="flip">Flip</button><button data-trick="shuv">Shove</button><button data-manual>Manual</button><button data-balance="-1">◀</button><button data-balance="1">▶</button></div>';Board.hud.append(el);el.querySelectorAll('[data-trick]').forEach(b=>b.onclick=()=>trick(b.dataset.trick));el.querySelector('[data-manual]').onclick=()=>{S.touchManual=!S.touchManual};el.querySelectorAll('[data-balance]').forEach(b=>b.onclick=()=>{if(S.manual)S.balance=clamp(S.balance+Number(b.dataset.balance)*.25,-1,1)});el.addEventListener('pointerdown',e=>e.stopPropagation())}
 if(!el)return;
 const parks=[...State.chunkMap.values()].filter(c=>c.skateSpot).map(c=>({...c.skateSpot,d:Math.hypot(c.skateSpot.x-Player.position.x,c.skateSpot.z-Player.position.z)})).sort((a,b)=>a.d-b.d);
 const spot=parks[0]?.d<12?parks[0]:null;
 if(spot?.x!==S.spot?.x||spot?.z!==S.spot?.z){S.spot=spot;S.cleared=false;S.challenge={flip:false,manual:false,grind:false};try{S.best=Number(localStorage.getItem(recordKey()))||0}catch{S.best=0}}
 const c=S.challenge;
 el.querySelector('[data-line]').textContent=spot?spot.name+(S.cleared?' · LINE COMPLETE · ':' · ')+(c.flip?'✓':'○')+' flip · '+(c.manual?'✓':'○')+' 2s manual · '+(c.grind?'✓':'○')+' grind · best '+S.best:parks[0]?'SKATE SPOT '+Math.round(parks[0].d)+'m · '+parks[0].name:'X flip · Z shove-it · hold C manual / A-D balance';
 const meter=el.querySelector('#skate-balance');meter.hidden=!S.manual;meter.firstChild.style.left=(50+S.balance*48)+'%';
},100);
})();
