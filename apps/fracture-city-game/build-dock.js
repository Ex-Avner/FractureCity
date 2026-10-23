/* Build dock and cursor build mode.
   One dock for every way of building: Blocks, Room kit, Furniture, Atelier.
   On desktop, build mode frees the cursor. Every tool targets what the mouse
   points at; every dock button is clickable. Right-drag (or middle-drag)
   looks around, WASD still moves. Right-click places, left (held) removes or
   selects. Esc steps back: cancel placing, clear selection, leave build.
   On phones, a tap on the world places at that spot. */
(function(){'use strict';
const canvas=()=>State.renderer?.domElement;
const touch=()=>!!(window.Touch&&Touch.on)||document.body.classList.contains('touch');
const art=()=>window.CityArt,kit=()=>window.CityBuild;
let wasBuilding=false;
const BD=window.FCBuildDock={cursor:false,mouse:null,drag:null,blockHistory:[],blockFuture:[]};

// ─── Mode ───────────────────────────────────────────────────────────────────
function mode(){if(art()?.enabled)return'art';if(kit()?.enabled)return'kit';return'blocks'}
function panelOpen(){return !!(State.ui.paused||art()?.panelOpen||kit()?.panelOpen||document.getElementById('furniture-menu')||State.ui.inInventory||State.ui.inDialogue||State.ui.inArcade||State.ui.inShiftPanel)}
function building(){return !!(State.ui.construct&&Player.mode==='walk')}
function setMode(m){
 const A=art(),K=kit();
 if(m==='blocks'){if(A){A.cancelStamp?.();A.selected?.clear();A.enabled=false}if(K)K.enabled=false}
 if(m==='kit'){if(A){A.cancelStamp?.();A.selected?.clear();A.enabled=false}if(K)K.enabled=true}
 if(m==='art'){if(K)K.enabled=false;if(A)A.enabled=true}
 render(true);
}

// ─── Cursor build mode (desktop) ────────────────────────────────────────────
const NDC=new THREE.Vector2();
function enterCursor(){BD.cursor=true;document.body.classList.add('fc-build-cursor');if(document.pointerLockElement)document.exitPointerLock?.();State.ui.locked=true;document.getElementById('lock-instruction')?.classList.remove('show')}
function leaveCursor(){BD.cursor=false;BD.drag=null;FC_AIM.ndc=null;document.body.classList.remove('fc-build-cursor');State.ui.locked=document.pointerLockElement===canvas();if(!State.ui.locked&&!panelOpen()&&!touch()){try{canvas()?.requestPointerLock?.()}catch(e){}if(!document.pointerLockElement)document.getElementById('lock-instruction')?.classList.add('show')}}
document.addEventListener('pointerlockchange',()=>{if(BD.cursor){State.ui.locked=true;document.getElementById('lock-instruction')?.classList.remove('show')}});
function onCanvas(e){return e.target===canvas()}
window.addEventListener('mousemove',e=>{
 if(!BD.cursor||panelOpen())return;
 BD.mouse={x:e.clientX,y:e.clientY};
 if(BD.drag){const d=BD.drag;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>4)d.moved=true;if(d.moved){Player.yaw-=e.movementX*.0032;Player.pitch=Math.max(-Math.PI/2+.01,Math.min(Math.PI/2-.01,Player.pitch-e.movementY*.0032))}}
 //  The game's own look handler turns the camera whenever "locked"; here the
 //  cursor is free, so only a drag turns the view.
 e.stopImmediatePropagation();
},true);
window.addEventListener('mousedown',e=>{
 if(!BD.cursor||panelOpen()||!onCanvas(e))return;
 if(e.button===2||e.button===1){BD.drag={x:e.clientX,y:e.clientY,button:e.button,moved:false};e.preventDefault();e.stopImmediatePropagation()}
},true);
window.addEventListener('mouseup',e=>{
 if(!BD.drag||e.button!==BD.drag.button)return;
 const d=BD.drag;BD.drag=null;
 if(d.button===2&&!d.moved&&BD.cursor&&!panelOpen()){aimAt(e.clientX,e.clientY);updateBlockTarget();window.placeBlock()}
},true);
window.addEventListener('blur',()=>{BD.drag=null});
function aimAt(x,y){NDC.set(x/innerWidth*2-1,1-y/innerHeight*2);FC_AIM.ndc=NDC}

// ─── Phones: tap the world to place ────────────────────────────────────────
let tap=null;
window.addEventListener('pointerdown',e=>{if(!touch()||!building()||panelOpen()||!onCanvas(e)||e.pointerType==='mouse')return;tap={x:e.clientX,y:e.clientY,t:performance.now(),id:e.pointerId}},true);
window.addEventListener('pointerup',e=>{
 if(!tap||e.pointerId!==tap.id)return;const t=tap;tap=null;
 if(!building()||panelOpen()||Math.hypot(e.clientX-t.x,e.clientY-t.y)>10||performance.now()-t.t>350)return;
 aimAt(e.clientX,e.clientY);updateBlockTarget();
 const A=art();
 if(mode()==='art'&&A&&!A.stamp)window.shBeginMine();else window.placeBlock();
 //  The on-screen PLACE and MINE buttons keep aiming at the centre.
 setTimeout(()=>{if(!BD.cursor)FC_AIM.ndc=null},0);
},true);

// ─── Keys ───────────────────────────────────────────────────────────────────
window.addEventListener('keydown',e=>{
 if(!building()||panelOpen()||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
 if(e.code==='Escape'&&BD.cursor){
  e.preventDefault();e.stopImmediatePropagation();const A=art();
  if(A?.stamp){A.cancelStamp();return}
  if(A?.selected?.size){A.selected.clear();A.draw?.();return}
  toggleConstructMode();return;
 }
 if((e.ctrlKey||e.metaKey)&&(e.code==='KeyZ'||e.code==='KeyY')){e.preventDefault();e.stopImmediatePropagation();undo(e.code==='KeyY'||e.shiftKey);return}
},true);

// ─── One undo for every tool ────────────────────────────────────────────────
let recording=null;
const rawSet=window.setBlock;
window.setBlock=function(x,y,z,id){if(recording)recording.push([x,y,z,getBlock(x,y,z),id]);return rawSet.apply(this,arguments)};
for(const name of ['placeBlock','breakBlock']){const inner=window[name];window[name]=function(){
 if(mode()!=='blocks'||recording)return inner.apply(this,arguments);
 recording=[];try{return inner.apply(this,arguments)}finally{const ops=recording;recording=null;if(ops.length){BD.blockHistory.push({ops,free:!!State.ui.freeBuild});if(BD.blockHistory.length>60)BD.blockHistory.shift();BD.blockFuture=[];render()}}
}}
function blockUndo(redo){
 const from=redo?BD.blockFuture:BD.blockHistory,to=redo?BD.blockHistory:BD.blockFuture,step=from.at(-1);
 if(!step)return false;
 //  With supplies from inventory, undoing would mint or lose materials.
 if(!step.free||!State.ui.freeBuild){toast('Undo for blocks works with unlimited supplies. Turn them on in the dock.','info');return false}
 from.pop();const ops=redo?step.ops:[...step.ops].reverse();
 for(const [x,y,z,before,after] of ops)rawSet(x,y,z,redo?after:before);
 to.push(step);render();return true;
}
function undo(redo=false){
 const m=mode();
 if(m==='kit')return kit()?.quick?.(redo?'redo':'undo');
 if(m==='art'){const A=art();return redo?A?.undo?.(true):A?.undo?.()}
 return blockUndo(redo);
}

// ─── Dock ───────────────────────────────────────────────────────────────────
const dock=document.createElement('section');dock.id='build-dock';dock.hidden=true;dock.setAttribute('aria-label','Build tools');
document.body.append(dock);
for(const t of ['pointerdown','mousedown','click','wheel','contextmenu'])dock.addEventListener(t,e=>e.stopPropagation());
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hex=n=>'#'+Number(n).toString(16).padStart(6,'0');
let signature='',pressing=false;
dock.addEventListener('pointerdown',()=>{pressing=true},true);window.addEventListener('pointerup',()=>{setTimeout(()=>{pressing=false},0)},true);
function hint(m){
 const A=art();
 if(touch())return m==='art'&&!A?.stamp?'Tap a piece to select it · drag to look':'Tap to place · drag to look · MINE removes';
 if(m==='blocks')return'Right-click place · hold left remove · right-drag look · 1–9 pick · Esc leave';
 if(m==='kit')return'Right-click place piece · T turn · hold left remove · right-drag look · Esc leave';
 return A?.stamp?'Right-click place · T turn · right-drag look · Esc cancel':'Left-click a piece to select · right-drag look · Esc deselect';
}
function body(m){
 if(m==='blocks')return '<div class="bd-slots">'+HOTBAR.map((id,i)=>{const n=shInvCount(id),label=shMat4Block(id).label,empty=!State.ui.freeBuild&&!n;return`<button data-slot="${i}" class="bd-slot${i===heldSlot?' on':''}${empty?' empty':''}" title="${esc(label)}"><i style="background:${hex(BLOCKS[id].color)}"></i><b>${i+1}</b><span>${esc(label)}</span><em>${State.ui.freeBuild?'∞':n}</em></button>`}).join('')+'</div>';
 if(m==='kit'){const d=kit()?.describe?.()||{};return`<div class="bd-row"><button data-k="piece-prev" aria-label="Previous piece">‹</button><div class="bd-pick"><small>${esc(d.group||'Piece')}</small><b>${esc(d.piece||'')}</b></div><button data-k="piece-next" aria-label="Next piece">›</button><span class="bd-gap"></span><button data-k="finish-prev" aria-label="Previous finish">‹</button><div class="bd-pick"><small>Finish</small><b><i style="background:${esc(d.color||'#888')}"></i>${esc(d.finish||'')}</b></div><button data-k="finish-next" aria-label="Next finish">›</button><span class="bd-gap"></span><button data-k="rotate">Turn ${d.rotation||0}° · T</button><button data-k="catalogue">All pieces…</button></div>${d.status&&!/^Ready/.test(d.status)?`<p class="bd-status">${esc(d.status)}</p>`:''}`}
 const A=art();
 if(A?.stamp)return`<div class="bd-row"><div class="bd-pick wide"><small>Placing</small><b>${esc(A.stamp.name||'Object')}</b></div><button data-a="place">Place here</button><button data-a="turn">Turn 90° · T</button><button data-a="cancel">Cancel</button><span class="bd-gap"></span><button data-a="browse">Objects…</button></div>`;
 const n=A?.selected?.size||0;
 return`<div class="bd-row"><button data-a="browse" class="bd-primary">Browse objects…</button><span class="bd-note">${n?n+' selected · edit in the bar above':'Click a placed piece to move, turn, paint or delete it'}</span><span class="bd-gap"></span><button data-a="atelier">Atelier…</button>${n?'<button data-a="delete">Delete</button><button data-a="deselect">Deselect</button>':''}</div>`;
}
function render(force){
 const show=building()&&!panelOpen()&&!State.ui.inArcade;
 dock.hidden=!show;document.body.classList.toggle('fc-build',building()&&!State.ui.inArcade);
 if(!show)return;
 const m=mode(),A=art(),K=kit(),d=m==='kit'?K?.describe?.():null;
 const canUndo=m==='kit'?!!d?.canUndo:m==='art'?!!A?.history?.length:BD.blockHistory.length>0;
 const canRedo=m==='kit'?!!d?.canRedo:m==='art'?!!A?.future?.length:BD.blockFuture.length>0;
 const sig=JSON.stringify([m,heldSlot,State.ui.freeBuild,canUndo,canRedo,touch(),A?.stamp?.name,A?.selected?.size,d,m==='blocks'?HOTBAR.map(shInvCount):0]);
 if(!force&&(sig===signature||pressing))return;signature=sig;
 dock.dataset.mode=m;
 dock.innerHTML=`<header><nav>${[['blocks','Blocks'],['kit','Room kit'],['art','Furniture'],['atelier','Atelier']].map(([k,l])=>`<button data-mode="${k}" class="${k===m?'on':''}">${l}</button>`).join('')}</nav><div class="bd-tools"><button data-t="undo" ${canUndo?'':'disabled'} title="Undo · Ctrl+Z">Undo</button><button data-t="redo" ${canRedo?'':'disabled'} title="Redo · Ctrl+Y">Redo</button><button data-t="supplies" class="${State.ui.freeBuild?'on':''}" title="G">${State.ui.freeBuild?'Supplies: unlimited':'Supplies: inventory'}</button><button data-t="done" class="bd-done">Done</button></div></header><div class="bd-body">${body(m)}</div><footer>${esc(hint(m))}</footer>`;
}
dock.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;b.blur();const A=art(),K=kit();
 if(b.dataset.mode){const k=b.dataset.mode;if(k==='atelier'){A?.open?.();render(true);return}setMode(k);if(k==='art'&&!A?.objects?.length)window.FCFurniture?.open?.();return}
 if(b.dataset.slot){heldSlot=Number(b.dataset.slot);shRefreshHotbar();render(true);return}
 if(b.dataset.k){if(b.dataset.k==='catalogue'&&K?.openStructure)K.openStructure();else K?.quick?.(b.dataset.k);render(true);return}
 if(b.dataset.a){const a=b.dataset.a;
  if(a==='browse')window.FCFurniture?.open?.();
  if(a==='atelier')A?.open?.();
  if(a==='turn')A?.turnStamp?.();
  if(a==='cancel')A?.cancelStamp?.();
  if(a==='deselect'){A?.selected?.clear();A?.draw?.()}
  if(a==='delete'&&A)A.commit(A.objects.filter(o=>!A.selected.has(o.id)));
  if(a==='place'){const hit=A?.surfaceTarget?.();try{if(hit)A.placeOnSurface(hit.point,hit.normal);else toast('Point at a floor, wall or ceiling within reach.','info')}catch(err){toast(err.message,'info')}}
  render(true);return}
 if(b.dataset.t){const t=b.dataset.t;if(t==='undo')undo();if(t==='redo')undo(true);if(t==='supplies')shToggleFreeBuild();if(t==='done')toggleConstructMode();render(true)}
});

//  Enter and leave at the toggle itself, inside the key or click that caused
//  it, so the browser lets the view take the mouse back straight away.
const toggleInner=window.toggleConstructMode;
window.toggleConstructMode=function(){const r=toggleInner.apply(this,arguments);const b=building();if(b&&!BD.cursor&&!touch())enterCursor();if(!b&&BD.cursor)leaveCursor();wasBuilding=b;render(true);return r};

// ─── Frame ──────────────────────────────────────────────────────────────────
let last=0;
function frame(t){requestAnimationFrame(frame);
 const b=building();
 if(b&&!wasBuilding&&!touch())enterCursor();
 if(!b&&wasBuilding&&BD.cursor)leaveCursor();
 wasBuilding=b;
 if(BD.cursor){
  if(!panelOpen()){State.ui.locked=true;document.getElementById('lock-instruction')?.classList.remove('show');if(BD.mouse)aimAt(BD.mouse.x,BD.mouse.y)}
  else FC_AIM.ndc=null;
 }
 if(t-last>120){last=t;render(false)}
}
requestAnimationFrame(frame);

// ─── Look ───────────────────────────────────────────────────────────────────
const css=document.createElement('style');css.textContent=`
body.fc-build-cursor{cursor:default!important}
body.fc-build-cursor canvas{cursor:crosshair!important}
body.fc-build-cursor button,body.fc-build-cursor a,body.fc-build-cursor [role=button]{cursor:pointer!important}
body.fc-build-cursor input,body.fc-build-cursor textarea{cursor:text!important}
body.fc-build-cursor #crosshair{display:none!important}
body.fc-build #build-hud,body.fc-build #city-build-quick,body.fc-build #city-build-open,body.fc-build #city-art-open,body.fc-build #furniture-place,body.fc-build #hud-weapons,body.fc-build #common-later,body.fc-build #fn-ability,body.fc-build #common-invite,body.fc-build #chainfire-play,body.fc-build #campus-arcade-play{display:none!important}
body.fc-build #art-direct{bottom:auto!important;top:76px!important}
#build-dock{--bd-bg:#0e1a21fa;--bd-line:#2c4650;--bd-ink:#e8f1ee;--bd-mute:#93aab0;--bd-btn:#172a33;--bd-acc:#7fe0c8;
 position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:120;width:min(860px,calc(100vw - 24px));box-sizing:border-box;
 background:var(--bd-bg);color:var(--bd-ink);border:1px solid var(--bd-line);border-radius:14px;box-shadow:0 10px 40px #0008;
 font:13px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;padding:8px 10px 6px;user-select:none}
#build-dock[hidden]{display:none}
#build-dock[data-mode=kit]{--bd-acc:#ffcf7a}#build-dock[data-mode=art]{--bd-acc:#c9a6ff}
#build-dock button{font:inherit;color:inherit;background:var(--bd-btn);border:1px solid var(--bd-line);border-radius:8px;padding:6px 10px;min-height:32px}
#build-dock button:hover:not(:disabled){border-color:var(--bd-acc)}
#build-dock button:disabled{opacity:.35}
#build-dock header{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
#build-dock nav,#build-dock .bd-tools{display:flex;gap:4px;flex-wrap:wrap}
#build-dock nav button{background:transparent;border-color:transparent;color:var(--bd-mute);font-weight:600}
#build-dock nav button.on{color:#0e1a21;background:var(--bd-acc);border-color:var(--bd-acc)}
#build-dock .bd-tools button.on{border-color:var(--bd-acc);color:var(--bd-acc)}
#build-dock .bd-done{background:#e8f1ee;color:#0e1a21;font-weight:700;border-color:#e8f1ee}
#build-dock .bd-body{margin:8px 0 4px}
#build-dock .bd-slots{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:4px}
#build-dock .bd-slot{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;gap:0 6px;text-align:left;padding:5px 6px;align-items:center}
#build-dock .bd-slot i{grid-row:span 2;width:20px;height:20px;border-radius:5px;box-shadow:inset 0 0 0 1px #fff3}
#build-dock .bd-slot b{font-size:10px;color:var(--bd-mute);font-weight:600}
#build-dock .bd-slot span{grid-column:2;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#build-dock .bd-slot{position:relative}
#build-dock .bd-slot em{position:absolute;right:6px;top:4px;font-style:normal;font-size:10px;color:var(--bd-mute)}
#build-dock .bd-slot.on{border-color:var(--bd-acc);box-shadow:inset 0 0 0 1px var(--bd-acc);background:#1d3640}
#build-dock .bd-slot.empty{opacity:.45}
#build-dock .bd-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
#build-dock .bd-gap{flex:0 0 10px}
#build-dock .bd-pick{display:flex;flex-direction:column;min-width:128px;padding:0 4px}
#build-dock .bd-pick.wide{min-width:180px}
#build-dock .bd-pick small{color:var(--bd-mute);font-size:10px;text-transform:uppercase;letter-spacing:.06em}
#build-dock .bd-pick b{display:flex;align-items:center;gap:6px;font-weight:600}
#build-dock .bd-pick b i{width:14px;height:14px;border-radius:4px;box-shadow:inset 0 0 0 1px #fff3}
#build-dock .bd-primary{border-color:var(--bd-acc)!important}
#build-dock .bd-note,#build-dock .bd-status{color:var(--bd-mute);font-size:12px;margin:0}
#build-dock .bd-status{margin-top:6px}
#build-dock footer{color:var(--bd-mute);font-size:11px;text-align:center;border-top:1px solid var(--bd-line);padding-top:5px}
@media (max-width:760px),(pointer:coarse){
 #build-dock{top:max(8px,env(safe-area-inset-top));bottom:auto;padding:6px;border-radius:12px;width:calc(100vw - 16px)}
 #build-dock header{gap:4px}#build-dock nav{flex-wrap:nowrap;overflow-x:auto}
 #build-dock button{min-height:36px;padding:6px 9px}
 #build-dock .bd-slots{display:flex;overflow-x:auto;scrollbar-width:none}
 #build-dock .bd-slot{flex:0 0 auto;width:92px}
 #build-dock .bd-row{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
 #build-dock .bd-pick{min-width:96px}
 #build-dock footer{font-size:10px}
 body.fc-build #tc-top{display:none!important}
 body.fc-build #maker-goal,body.fc-build #fc-tools{display:none!important}
 body.fc-build #art-direct{top:auto!important;bottom:150px!important}
}`;

//  One skin for every build panel: the room panel, the Atelier, the
//  furniture catalogue and the selection bar share the dock's tokens.
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
