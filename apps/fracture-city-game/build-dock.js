/* Build mode, Minecraft style.
   B switches your hands to building: the mouse stays captured and the
   crosshair aims, keys 1–8 and the wheel pick from the hotbar (inventory.js),
   right-click places, holding left breaks or picks up. Ctrl+Z / Ctrl+Y undo
   with the tool in hand. On phones, a tap on the world places at that spot.
   Also: one visual skin for the build panels, and the HUD clutter hidden
   while building. */
(function(){'use strict';
const canvas=()=>State.renderer?.domElement;
const touch=()=>!!(window.Touch&&Touch.on)||document.body.classList.contains('touch');
const art=()=>window.CityArt,kit=()=>window.CityBuild;
const online=()=>!!(window.FCCityOnline&&FCCityOnline.ready);
const BD=window.FCBuildDock={blockHistory:[],blockFuture:[]};
function mode(){if(art()?.enabled)return'art';if(kit()?.enabled)return'kit';return'blocks'}
function panelOpen(){return !!(State.ui.paused||art()?.panelOpen||kit()?.panelOpen||document.getElementById('furniture-menu')||State.ui.inInventory||State.ui.inDialogue||State.ui.inArcade||State.ui.inShiftPanel)}
function building(){return !!(State.ui.construct&&Player.mode==='walk')}
const NDC=new THREE.Vector2();
function aimAt(x,y){NDC.set(x/innerWidth*2-1,1-y/innerHeight*2);FC_AIM.ndc=NDC}

// ─── Phones: tap the world to place ────────────────────────────────────────
let tap=null;
window.addEventListener('pointerdown',e=>{if(!touch()||!building()||panelOpen()||e.target!==canvas()||e.pointerType==='mouse')return;tap={x:e.clientX,y:e.clientY,t:performance.now(),id:e.pointerId}},true);
window.addEventListener('pointerup',e=>{
 if(!tap||e.pointerId!==tap.id)return;const t=tap;tap=null;
 if(!building()||panelOpen()||Math.hypot(e.clientX-t.x,e.clientY-t.y)>10||performance.now()-t.t>350)return;
 aimAt(e.clientX,e.clientY);updateBlockTarget();
 window.placeBlock();
 //  The on-screen PLACE and MINE buttons keep aiming at the centre.
 setTimeout(()=>{FC_AIM.ndc=null},0);
},true);

// ─── One undo for every tool ────────────────────────────────────────────────
window.addEventListener('keydown',e=>{
 if(!building()||panelOpen()||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
 if((e.ctrlKey||e.metaKey)&&(e.code==='KeyZ'||e.code==='KeyY')){e.preventDefault();e.stopImmediatePropagation();undo(e.code==='KeyY'||e.shiftKey)}
},true);
let recording=null;
const rawSet=window.setBlock;
window.setBlock=function(x,y,z,id){if(recording)recording.push([x,y,z,getBlock(x,y,z),id]);return rawSet.apply(this,arguments)};
for(const name of ['placeBlock','breakBlock']){const inner=window[name];window[name]=function(){
 if(mode()!=='blocks'||recording)return inner.apply(this,arguments);
 recording=[];try{return inner.apply(this,arguments)}finally{const ops=recording;recording=null;if(ops.length){BD.blockHistory.push({ops,free:!!State.ui.freeBuild});if(BD.blockHistory.length>60)BD.blockHistory.shift();BD.blockFuture=[]}}
}}
function blockUndo(redo){
 const from=redo?BD.blockFuture:BD.blockHistory,to=redo?BD.blockHistory:BD.blockFuture,step=from.at(-1);
 if(!step)return false;
 //  Outside Creative, undoing would make or lose materials.
 if(!step.free||!State.ui.freeBuild){toast('Undo for blocks works in Creative. Break the block to get it back.','info');return false}
 from.pop();const ops=redo?step.ops:[...step.ops].reverse();
 for(const [x,y,z,before,after] of ops)rawSet(x,y,z,redo?after:before);
 to.push(step);return true;
}
//  Room-kit undo in a solo city gives the finish blocks back (and redo takes
//  them again). Online, the server does this from the plot itself.
function kitUndo(redo){
 const K=kit();if(!K)return false;
 if(online()||State.ui.freeBuild||!window.FCInv)return K.quick?.(redo?'redo':'undo');
 const list=redo?K.future:K.history,step=list?.at(-1);if(!step)return false;
 const n=new Map();for(const c of step.changes||[])if(c.id>=120&&c.id<=143&&c.id!==c.old)n.set('b:'+c.id,(n.get('b:'+c.id)||0)+1);
 if(redo&&!FCInv.takeMany(n))return false;
 const before=list.length,ok=K.quick?.(redo?'redo':'undo'),done=(redo?K.future:K.history).length<before;
 if(!redo&&done)for(const [sku,c]of n)FCInv.give(sku,c);
 if(redo&&!done)for(const [sku,c]of n)FCInv.give(sku,c);
 return ok;
}
function undo(redo=false){
 const m=mode();
 if(m==='kit')return kitUndo(redo);
 if(m==='art'){const A=art();return redo?A?.undo?.(true):A?.undo?.()}
 return blockUndo(redo);
}
BD.undo=undo;

// ─── Hide the clutter while building ───────────────────────────────────────
setInterval(()=>document.body.classList.toggle('fc-build',building()&&!State.ui.inArcade),150);
const css=document.createElement('style');css.textContent=`
body.fc-build #build-hud,body.fc-build #city-build-quick,body.fc-build #city-build-open,body.fc-build #city-art-open,body.fc-build #furniture-place,body.fc-build #hud-weapons,body.fc-build #common-later,body.fc-build #fn-ability,body.fc-build #common-invite,body.fc-build #chainfire-play,body.fc-build #campus-arcade-play{display:none!important}
body.fc-build #art-direct{bottom:auto!important;top:76px!important}
@media (max-width:760px),(pointer:coarse){
 body.fc-build #maker-goal,body.fc-build #fc-tools{display:none!important}
 body.fc-build #art-direct{top:auto!important;bottom:150px!important}
}`;
//  One skin for every build panel: the room panel, the Atelier, the
//  furniture catalogue and the selection bar.
css.textContent+=`
body #city-build-menu,body #city-art-menu,body #furniture-menu,body #art-direct{--bd-acc:#7fe0c8;background:#0e1a21fa!important;color:#e8f1ee!important;border:1px solid #2c4650!important;border-radius:16px!important;font-family:system-ui,-apple-system,Segoe UI,sans-serif!important;box-shadow:0 18px 60px #000a,0 0 0 100vmax #0007!important}
body #city-build-menu{--bd-acc:#ffcf7a}body #city-art-menu,body #furniture-menu,body #art-direct{--bd-acc:#c9a6ff}
body #art-direct{box-shadow:0 10px 40px #0008!important;border-radius:12px!important}
body #city-build-menu h2,body #city-art-menu h2,body #furniture-menu h2{font-family:Georgia,serif!important;font-weight:400!important;letter-spacing:-.01em}
body #city-build-menu h3,body #city-art-menu h3{font:600 11px system-ui!important;text-transform:uppercase;letter-spacing:.08em;color:#93aab0!important;margin:18px 0 8px!important}
body #city-build-menu button,body #city-art-menu button,body #city-art-menu .file,body #furniture-menu button,body #furniture-menu select,body #art-direct button{background:#172a33!important;color:#e8f1ee!important;border:1px solid #2c4650!important;border-radius:8px!important;font:13px system-ui!important;min-height:34px}
body #city-build-menu button:hover,body #city-art-menu button:hover,body #furniture-menu button:hover,body #art-direct button:hover{border-color:var(--bd-acc)!important}
body #city-build-menu button.active,body #city-build-menu button[aria-pressed=true],body #city-art-menu button[aria-pressed=true],body #furniture-menu button.active,body #furniture-menu button[aria-pressed=true]{border-color:var(--bd-acc)!important;box-shadow:inset 0 0 0 1px var(--bd-acc)!important;background:#1d3640!important}
body #city-build-menu button[data-action=close],body #city-art-menu button[data-action=close],body #furniture-menu button[data-close]{background:#e8f1ee!important;color:#0e1a21!important;border-color:#e8f1ee!important;font-weight:700!important}
body #furniture-menu .furniture-card{border-radius:12px!important}
body #furniture-menu input[type=search],body #furniture-menu input#furniture-search{background:#0b151b!important;border:1px solid #2c4650!important;border-radius:10px!important;color:#e8f1ee!important}
#city-art-menu nav.art-groups{display:grid!important;grid-template-columns:1fr 1fr;gap:8px 12px!important;margin:12px 0!important}
#city-art-menu nav.art-groups>div{display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:8px;border:1px solid #2c4650;border-radius:10px;background:#0b151b}
#city-art-menu nav.art-groups small{flex:0 0 100%;font:600 10px system-ui;text-transform:uppercase;letter-spacing:.08em;color:#93aab0;margin-bottom:2px}
#city-art-menu nav.art-groups button,#city-art-menu nav.art-groups .file{padding:5px 9px!important;min-height:30px!important}
@media(max-width:600px){#city-art-menu nav.art-groups{grid-template-columns:1fr}}
`;
document.head.append(css);
})();
