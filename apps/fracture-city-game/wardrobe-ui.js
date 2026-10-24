/* The wardrobe: where you make your resident.
   Live 3D preview (drag to turn, face or full body), presets, Randomise,
   every slot from wardrobe.json with colours from punk palettes or your own.
   Rare pieces can be tried on; saving them needs owning them (bought once
   with credits; online the server holds what you own). Creative in a solo
   city unlocks everything. Opens wherever "Resident" used to. */
(function(){'use strict';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const online=()=>!!(window.FCCityOnline&&FCCityOnline.ready);
let S=null;fetch('wardrobe.json').then(r=>r.json()).then(j=>{S=j}).catch(()=>{});
const UI={open:false,group:'face',draft:null,preview:null,yaw:.35,face:false};
// ─── Ownership ─────────────────────────────────────────────────────────────
let soloOwned=new Set();(async()=>{try{const d=await window.fracture?.read('fc-wardrobe-owned');if(Array.isArray(d))soloOwned=new Set(d)}catch(e){}})();
const creative=()=>!online()&&!!State.ui.freeBuild;
function price(key,val){const slot=S?.groups.flatMap(g=>g.slots).find(s=>s.key===key);return slot?.premium?.[val]||0}
function owns(key,val){if(!price(key,val)||creative())return true;const sku='w:'+key+':'+val;return online()?(window.FCInv?.server?.items?.[sku]||0)>0:soloOwned.has(sku)}
function locked(look){const out=[];for(const g of S?.groups||[])for(const s of g.slots){if(s.multi){for(const v of look[s.key]||[])if(!owns(s.key,v))out.push([s.key,v])}else if(s.options&&!owns(s.key,look[s.key]))out.push([s.key,look[s.key]])}return out}
async function buy(key,val){const sku='w:'+key+':'+val,cost=price(key,val);
 if(online()){try{const res=await fetch('/api/wallet/buy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sku,qty:1})});const out=await res.json();if(!res.ok)throw Error(out.error||'Could not buy that.');window.FCInv?.ingestWallet?.(out);toast('Yours now: '+val.replace(/-/g,' '),'success')}catch(e){toast(e.message,'warn');return}}
 else{if(State.hud.credits<cost){toast(`Not enough credits: ${cost} needed, ${State.hud.credits} held.`,'warn');return}grantCredits(-cost);soloOwned.add(sku);try{window.fracture?.save('fc-wardrobe-owned',[...soloOwned])}catch(e){}toast('Yours now: '+val.replace(/-/g,' '),'success')}
 draw();
}
// ─── Panel ──────────────────────────────────────────────────────────────────
const el=document.createElement('section');el.id='fc-wardrobe';el.hidden=true;el.setAttribute('role','dialog');el.setAttribute('aria-label','Wardrobe');document.body.append(el);
for(const t of ['pointerdown','mousedown','wheel','keydown'])el.addEventListener(t,e=>{if(t!=='keydown'||e.code!=='Escape')e.stopPropagation()});
let wasPaused=false;
//  open() dresses you; open({look,title,save,onSave}) dresses someone else (the Casting Booth).
function open(opts){if(UI.open)return;UI.open=true;UI.custom=opts&&opts.onSave?opts:null;UI.draft=FCWardrobe.normalize(UI.custom?opts.look||{}:Shift.avatar);wasPaused=State.ui.paused;State.ui.paused=true;State.ui.inShiftPanel=true;document.exitPointerLock?.();document.body.style.cursor='auto';State.keys?.clear?.();el.hidden=false;draw()}
function close(save){
 if(!UI.open)return;
 if(save){const bad=locked(UI.draft);if(bad.length){toast('Buy or take off: '+bad.map(([k,v])=>v.replace(/-/g,' ')).join(', '),'warn');return}
  if(UI.custom){const cb=UI.custom.onSave,look={...UI.draft,extras:[...UI.draft.extras]};UI.custom=null;UI.open=false;el.hidden=true;clearPreview();State.ui.inShiftPanel=false;State.ui.paused=wasPaused;cb(look);return}
  Object.assign(Shift.avatar,UI.draft,{extras:[...UI.draft.extras]});if(typeof shRebuildMirror==='function')shRebuildMirror();if(typeof ShiftNet!=='undefined')ShiftNet.saveProfile(Shift.profile,Shift.avatar).then(where=>toast(where==='city'?'Look saved to the shared city.':'Look saved.','success')).catch(()=>{});if(online())FCCityOnline.sendLook?.()}
 const cancel=!save&&UI.custom?.onCancel;UI.custom=null;UI.open=false;el.hidden=true;clearPreview();State.ui.inShiftPanel=false;State.ui.paused=wasPaused;if(!State.ui.paused)document.body.style.cursor='none';if(cancel)cancel();
}
//  A look with any rare pieces you do not own swapped for the everyday default.
function affordable(look){const out={...look,extras:[...(look.extras||[])]};for(const [k,v] of locked(out)){if(Array.isArray(out[k]))out[k]=out[k].filter(x=>x!==v);else out[k]=FCWardrobe.DEFAULT_LOOK[k]}return out}
window.FCWardrobeUI={open,close,affordable,get draft(){return UI.draft}};
//  Every way into the old resident appearance panel now opens the wardrobe.
const openPanel=window.shOpenPanel;
window.shOpenPanel=function(id){if(id==='avatar')return open();return openPanel.apply(this,arguments)};
window.addEventListener('keydown',e=>{if(UI.open&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(false)}},true);

const label=v=>String(v).replace(/-/g,' ');
function draw(){
 if(!UI.open)return;if(!S){el.innerHTML='<p style="padding:30px">Opening the wardrobe…</p>';setTimeout(draw,300);return}
 const d=UI.draft,g=S.groups.find(x=>x.key===UI.group)||S.groups[0];
 const bal=online()?(window.FCInv?.server?.balance??0):State.hud.credits;
 let body='';
 if(UI.group==='colour'){body=S.colourSlots.map(c=>`<div class="wd-slot"><h4>${esc(c.label)}</h4><div class="wd-swatches">${S.colours[c.palette].map(v=>v==='none'?`<button data-colour="${c.key}" data-val="none" class="wd-none ${d[c.key]==='none'?'on':''}" title="None">∅</button>`:`<button data-colour="${c.key}" data-val="${v}" class="${String(d[c.key]).toLowerCase()===v?'on':''}" style="--c:${v}" title="${v}"></button>`).join('')}<label class="wd-custom" title="Any colour"><input type="color" data-colour-input="${c.key}" value="${/^#/.test(d[c.key])?d[c.key]:'#000000'}">+</label></div></div>`).join('')}
 else body=g.slots.map(s=>{
  if(s.range)return`<div class="wd-slot"><h4>${esc(s.label)}</h4><input type="range" data-range="${s.key}" min="${s.range[0]}" max="${s.range[1]}" step=".01" value="${d[s.key]}"></div>`;
  return`<div class="wd-slot"><h4>${esc(s.label)}${s.multi?' <small>pick any</small>':''}</h4><div class="wd-opts">${s.options.map(v=>{const on=s.multi?(d[s.key]||[]).includes(v):d[s.key]===v,p=s.premium?.[v],own=owns(s.key,v);return`<button data-slot="${s.key}" data-val="${v}" data-multi="${s.multi?1:''}" class="${on?'on':''} ${p&&!own?'rare':''}">${esc(label(v))}${p?(own?'<i>owned</i>':`<i>¢ ${p}</i>`):''}</button>`}).join('')}</div></div>`}).join('');
 const bad=locked(d);
 el.innerHTML=`<div class="wd-stage"><canvas aria-label="Your resident. Drag to turn."></canvas><div class="wd-stage-tools"><button data-view>${UI.face?'Full body':'Face'}</button><button data-random>Randomise</button></div><div class="wd-presets">${S.presets.map((p,i)=>`<button data-preset="${i}">${esc(p.name)}</button>`).join('')}</div></div>
 <div class="wd-side"><header><div><small>FRACTURE CITY / ${UI.custom?'CASTING':'WARDROBE'}</small><h2>${esc(UI.custom?.title||'Make some noise.')}</h2></div><div class="wd-wallet">${creative()?'<b>Creative</b>':`<b>¢ ${bal}</b><small>credits</small>`}</div></header>
 <nav>${S.groups.map(x=>`<button data-group="${x.key}" class="${x.key===UI.group?'on':''}">${esc(x.label)}</button>`).join('')}<button data-group="colour" class="${UI.group==='colour'?'on':''}">Colours</button></nav>
 <div class="wd-body">${body}</div>
 <footer>${bad.length?`<p class="wd-warn">Trying on: ${bad.map(([k,v])=>`<button data-buy="${k}" data-val="${v}">Buy ${esc(label(v))} · ¢ ${price(k,v)}</button>`).join(' ')}</p>`:''}<div class="wd-actions"><button data-cancel>Cancel · Esc</button><button data-save class="wd-save" ${bad.length?'disabled':''}>${esc(UI.custom?.save||'Wear it')}</button></div></footer></div>`;
 mountPreview();
}
el.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;const d=UI.draft;
 if(b.dataset.group){UI.group=b.dataset.group;draw();return}
 if(b.dataset.slot){const k=b.dataset.slot,v=b.dataset.val;if(b.dataset.multi){const set=new Set(d[k]||[]);set.has(v)?set.delete(v):set.add(v);d[k]=[...set]}else d[k]=v;draw();return}
 if(b.dataset.colour){d[b.dataset.colour]=b.dataset.val;draw();return}
 if(b.dataset.preset){Object.assign(d,FCWardrobe.normalize({...d,...S.presets[+b.dataset.preset].look}));draw();return}
 if(b.dataset.random!==undefined){const look=FCWardrobe.crowdLook(null,new RNG('wd'+Math.random()));delete look.scene;Object.assign(d,look);draw();return}
 if(b.dataset.view!==undefined){UI.face=!UI.face;draw();return}
 if(b.dataset.buy){buy(b.dataset.buy,b.dataset.val);return}
 if(b.dataset.cancel!==undefined)return close(false);
 if(b.dataset.save!==undefined)return close(true);
});
el.addEventListener('input',e=>{const t=e.target;if(t.dataset.range){UI.draft[t.dataset.range]=+t.value;rebuild()}if(t.dataset.colourInput){UI.draft[t.dataset.colourInput]=t.value;rebuild()}});
el.addEventListener('change',e=>{if(e.target.dataset.colourInput)draw()});
// ─── Preview ────────────────────────────────────────────────────────────────
function clearPreview(){const p=UI.preview;if(!p)return;cancelAnimationFrame(p.raf);if(p.char){p.scene.remove(p.char.group);FCResident.dispose(p.char)}p.renderer.dispose();p.renderer.forceContextLoss();UI.preview=null}
function rebuild(){const p=UI.preview;if(!p)return;if(p.char){p.scene.remove(p.char.group);FCResident.dispose(p.char)}p.char=shBuildFigure({...UI.draft,prop:'none',auraChance:0},'wardrobe');p.char.plate.visible=false;p.scene.add(p.char.group)}
function mountPreview(){
 const canvas=el.querySelector('canvas');let p=UI.preview;
 if(!p||p.canvas.isConnected===false){clearPreview();
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xf2f0ff,0x3a2f45,1.3));const key=new THREE.DirectionalLight(0xffe2d0,2.3);key.position.set(-2.5,4,4);scene.add(key);const rim=new THREE.DirectionalLight(0xff2e88,1.6);rim.position.set(3,2.5,-3);scene.add(rim);const rim2=new THREE.DirectionalLight(0x00e5ff,1.1);rim2.position.set(-3,2,-3);scene.add(rim2);
  const camera=new THREE.PerspectiveCamera(30,1,.05,20);p=UI.preview={canvas,renderer,scene,camera,char:null,raf:0};
 }else{p.canvas=canvas;p.renderer.dispose();p.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});p.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));p.renderer.toneMapping=THREE.ACESFilmicToneMapping;p.renderer.toneMappingExposure=1.15}
 let drag=null;canvas.onpointerdown=e=>{drag=e.clientX;canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(drag!==null){UI.yaw+=(e.clientX-drag)*.012;drag=e.clientX}};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
 rebuild();cancelAnimationFrame(p.raf);
 const loop=t=>{if(!UI.open||UI.preview!==p)return;p.raf=requestAnimationFrame(loop);const w=canvas.clientWidth||300,h=canvas.clientHeight||500;p.renderer.setSize(w,h,false);p.camera.aspect=w/h;p.camera.updateProjectionMatrix();
  const tall=p.char.studio.height;if(UI.face){p.camera.position.set(0,tall-.1,1.2);p.camera.lookAt(0,tall-.15,0)}else{p.camera.position.set(0,1.0,4.9);p.camera.lookAt(0,tall*.5,0)}
  p.char.group.rotation.y=UI.yaw;shAnimateCharacter(p.char,.016,false,t/1000);p.renderer.render(p.scene,p.camera)};
 p.raf=requestAnimationFrame(loop);
}
const css=document.createElement('style');css.textContent=`
#fc-wardrobe{position:fixed;inset:3vh max(12px,calc(50vw - 640px));z-index:110002;display:grid;grid-template-columns:minmax(260px,.9fr) 1.1fr;background:#0c0a10fa;color:#f2eee8;border:2px solid #ff2e88;border-radius:6px;box-shadow:8px 8px 0 #00e5ff,0 0 0 100vmax #000a;font:13px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden}
#fc-wardrobe[hidden]{display:none}
#fc-wardrobe .wd-stage{position:relative;background:radial-gradient(ellipse at 50% 40%,#3a1f3a,#0c0a10 70%),repeating-linear-gradient(45deg,#0000 0 12px,#ffffff06 12px 13px);border-right:2px solid #ff2e8855;min-height:0}
#fc-wardrobe canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab}
#fc-wardrobe .wd-stage-tools{position:absolute;top:12px;left:12px;display:flex;gap:6px}
#fc-wardrobe .wd-presets{position:absolute;left:10px;right:10px;bottom:10px;display:flex;flex-wrap:wrap;gap:5px;justify-content:center}
#fc-wardrobe button{font:600 12px system-ui;color:#f2eee8;background:#1a1520;border:1px solid #4a3a55;border-radius:3px;padding:7px 10px;cursor:pointer;min-height:32px;text-transform:uppercase;letter-spacing:.04em}
#fc-wardrobe button:hover{border-color:#ff2e88}
#fc-wardrobe button.on{background:#ff2e88;border-color:#ff2e88;color:#0c0a10}
#fc-wardrobe .wd-side{display:flex;flex-direction:column;min-height:0}
#fc-wardrobe header{display:flex;align-items:flex-end;gap:12px;padding:16px 18px 10px;border-bottom:2px dashed #4a3a55}
#fc-wardrobe header>div:first-child{flex:1}
#fc-wardrobe header small{color:#00e5ff;letter-spacing:.14em;font:700 10px system-ui}
#fc-wardrobe h2{margin:2px 0 0;font:900 34px/1 Impact,'Arial Black',system-ui;letter-spacing:.02em;text-transform:uppercase;color:#fff;text-shadow:3px 3px 0 #ff2e88}
#fc-wardrobe .wd-wallet{text-align:right}#fc-wardrobe .wd-wallet b{display:block;font-size:18px;color:#ffe500}#fc-wardrobe .wd-wallet small{color:#9a8fa5}
#fc-wardrobe nav{display:flex;flex-wrap:wrap;gap:5px;padding:10px 18px}
#fc-wardrobe .wd-body{flex:1;overflow:auto;padding:0 18px 14px}
#fc-wardrobe .wd-slot{margin:12px 0}
#fc-wardrobe h4{margin:0 0 7px;font:800 11px system-ui;letter-spacing:.12em;text-transform:uppercase;color:#00e5ff}
#fc-wardrobe h4 small{color:#9a8fa5;font-weight:600;letter-spacing:0;text-transform:none}
#fc-wardrobe .wd-opts{display:flex;flex-wrap:wrap;gap:5px}
#fc-wardrobe .wd-opts button{display:flex;flex-direction:column;align-items:center;gap:1px}
#fc-wardrobe .wd-opts i{font:600 9px system-ui;font-style:normal;color:#ffe500;letter-spacing:0;text-transform:none}
#fc-wardrobe .wd-opts button.on i{color:#0c0a10}
#fc-wardrobe .wd-opts button.rare{border-style:dashed;border-color:#ffe50088}
#fc-wardrobe input[type=range]{width:100%;accent-color:#ff2e88}
#fc-wardrobe .wd-swatches{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
#fc-wardrobe .wd-swatches button{width:30px;height:30px;min-height:30px;padding:0;background:var(--c);border:2px solid #0006;border-radius:50%}
#fc-wardrobe .wd-swatches button.on{outline:3px solid #fff;outline-offset:1px}
#fc-wardrobe .wd-swatches .wd-none{background:#1a1520;color:#9a8fa5}
#fc-wardrobe .wd-custom{position:relative;width:30px;height:30px;border-radius:50%;border:2px dashed #9a8fa5;display:grid;place-items:center;color:#9a8fa5;cursor:pointer;overflow:hidden}
#fc-wardrobe .wd-custom input{position:absolute;inset:0;opacity:0;cursor:pointer}
#fc-wardrobe footer{border-top:2px dashed #4a3a55;padding:10px 18px 14px}
#fc-wardrobe .wd-warn{margin:0 0 8px;color:#ffe500;display:flex;flex-wrap:wrap;gap:5px;align-items:center}
#fc-wardrobe .wd-warn button{border-color:#ffe500;color:#ffe500}
#fc-wardrobe .wd-actions{display:flex;gap:8px;justify-content:flex-end}
#fc-wardrobe .wd-save{background:#39ff14!important;border-color:#39ff14!important;color:#0c0a10!important;font-weight:900!important;padding:9px 22px!important}
#fc-wardrobe .wd-save:disabled{opacity:.35}
#fc-wardrobe .wd-side,#fc-wardrobe .wd-stage{min-width:0}
@media (max-width:760px){#fc-wardrobe{inset:4px;grid-template-columns:minmax(0,1fr);grid-template-rows:38vh minmax(0,1fr);box-shadow:none}#fc-wardrobe .wd-stage{border-right:0;border-bottom:2px solid #ff2e8855}#fc-wardrobe h2{font-size:24px}#fc-wardrobe nav{flex-wrap:nowrap;overflow-x:auto}#fc-wardrobe .wd-presets{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start}}`;
document.head.append(css);
})();
