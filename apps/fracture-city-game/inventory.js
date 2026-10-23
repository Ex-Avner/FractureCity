/* Inventory, hotbar and shop.
   Eight hotbar slots hold anything you can build with: blocks, room-kit
   pieces (a shape in a finish) and furniture. In build mode (B) keys 1–8 or
   the mouse wheel pick a slot, right-click places it, left-click breaks a
   block or picks your furniture back up. I (or Tab, or ITEMS on a phone)
   opens the inventory: your items, the shop, the room kit and, in solo
   cities, Creative.
   Solo cities keep the wallet (credits) and items in the save. Online, the
   server holds the wallet and items: it charges for what you build and gives
   it back when you take it down. */
(function(){'use strict';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hex=n=>'#'+Number(n).toString(16).padStart(6,'0');
const online=()=>!!(window.FCCityOnline&&FCCityOnline.ready);
const SLOTS=8;
const I=window.FCInv={catalog:null,slots:Array(SLOTS).fill(null),sel:0,server:null,furn:new Map(),open:false,tab:'bag',picked:null};
let catalogReady=fetch('shop-catalog.json').then(r=>r.json()).then(c=>{I.catalog=c;I.skus=new Map([...c.blocks,...c.furniture].map(i=>[i.sku,i]));return c}).catch(()=>null);

// ─── Items ──────────────────────────────────────────────────────────────────
function parse(sku){if(!sku)return null;const [kind,a,b]=sku.split(':');if(kind==='b')return{kind:'block',id:+a};if(kind==='f')return{kind:'furn',id:+a};if(kind==='k')return{kind:'kit',shape:a,material:+b};return null}
function kitDef(shape){return (window.CityBuild?.defs||[]).find(d=>d[0]===shape)}
function label(sku){const it=parse(sku);if(!it)return'';if(it.kind==='block')return I.skus?.get(sku)?.name||shMat4Block(it.id)?.label||'Block';if(it.kind==='furn')return I.skus?.get(sku)?.name||window.FCFurniture?.items?.[it.id]?.name||'Furniture';const d=kitDef(it.shape);return (d?d[1]:it.shape)+' · '+(I.skus?.get('b:'+it.material)?.name||'')}
function count(sku){const it=parse(sku);if(!it)return 0;if(it.kind==='kit')return count('b:'+it.material);
 if(online()){return Math.max(0,I.server?.items?.[sku]||0)}
 if(it.kind==='block')return shInvCount(it.id);return I.furn.get(it.id)||0}
const creative=()=>!online()&&!!State.ui.freeBuild;
function setCount(sku,n){const it=parse(sku);if(online()){if(!I.server)return;I.server.items[sku]=Math.max(0,n);return}
 if(it.kind==='block'){const have=shInvCount(it.id);if(n>have)shInvAdd(it.id,n-have);else if(n<have)shInvTake(it.id,have-n);return}
 I.furn.set(it.id,Math.max(0,n));saveLocal()}
//  Take items for building; false (with a reason on screen) when you do not
//  hold enough. Creative takes nothing.
I.take=function(sku,n=1){if(creative())return true;const have=count(sku);if(have<n){toast(`You need ${n} × ${label(sku)} and hold ${have}. Open the inventory (I) to buy more.`,'warn');return false}setCount(sku,have-n);render();return true};
I.give=function(sku,n=1){if(creative()&&!online())return;setCount(sku,count(sku)+n);render()};
I.takeMany=function(map){if(creative())return true;for(const [sku,n]of map)if(count(sku)<n){toast(`You need ${n} × ${label(sku)} and hold ${count(sku)}. Open the inventory (I) to buy more.`,'warn');return false}for(const [sku,n]of map)setCount(sku,count(sku)-n);render();return true};
I.ingestWallet=function(w){if(!w||!online())return;I.server=JSON.parse(JSON.stringify(w));render()};
I.count=count;I.label=label;

// ─── Wallet ─────────────────────────────────────────────────────────────────
function balance(){return online()?(I.server?.balance??0):State.hud.credits}
async function api(route,data){const res=await fetch('/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,credentials:'same-origin'});const out=await res.json().catch(()=>({}));if(!res.ok)throw Object.assign(Error(out.error||'The server did not answer.'),{status:res.status});return out}
async function refresh(){if(!online())return;
 //  While a build is still saving, the server has not charged for it yet.
 if(window.FCCityBuild?.dirty||window.FCStructures?.busy)return;
 try{I.server=await api('wallet');if(I.server.hotbar?.length===SLOTS&&!I.hotbarLoaded){I.slots=I.server.hotbar;I.hotbarLoaded=true;apply()}render()}catch(e){}}
async function buy(sku,qty){
 const item=I.skus.get(sku);if(!item)return;
 if(online()){try{I.server=await api('wallet/buy',{sku,qty});toast(`Bought ${qty} × ${item.name}`,'success')}catch(e){toast(e.message,'warn');return}}
 else{const cost=item.price*qty;if(State.hud.credits<cost){toast(`Not enough credits: ${cost} needed, ${State.hud.credits} held.`,'warn');return}grantCredits(-cost);setCount(sku,count(sku)+qty);toast(`Bought ${qty} × ${item.name}`,'success')}
 if(!I.slots.includes(sku)){const k=I.slots.indexOf(null);if(k>=0){I.slots[k]=sku;saveHotbar()}}
 render();paint();
}
//  Money earned in the city goes to the server wallet online, within the
//  server's per-claim and daily limits.
let pending=0,claiming=false;
const grant=window.grantCredits;
window.grantCredits=function(n){const r=grant.apply(this,arguments);if(online()&&n>0){pending+=Math.round(n);flushEarn()}return r};
async function flushEarn(){if(claiming||!pending||!online())return;claiming=true;const amount=Math.min(250,pending);pending-=amount;try{const out=await api('wallet/earn',{amount,reason:'city'});I.server=out;render()}catch(e){}finally{claiming=false;if(pending)setTimeout(flushEarn,2600)}}
setInterval(()=>{if(online()){const el=document.getElementById('hud-credits-val');if(el&&I.server)el.textContent=String(I.server.balance)}},1000);

// ─── Saving (solo) ──────────────────────────────────────────────────────────
function saveLocal(){try{window.fracture?.save('fc-inventory-'+State.citySeed,{furn:[...I.furn],slots:I.slots})}catch(e){}}
function saveHotbar(){if(online())api('wallet/hotbar',{slots:I.slots}).catch(()=>{});else saveLocal()}
async function loadLocal(){try{const d=await window.fracture?.read('fc-inventory-'+State.citySeed);
 //  A new solo city starts with a sofa and two rugs to try placing.
 I.furn=new Map(Array.isArray(d?.furn)?d.furn:[[0,1],[37,2]]);if(Array.isArray(d?.slots)&&d.slots.length===SLOTS)I.slots=d.slots;else I.slots=defaultSlots()}catch(e){I.furn=new Map();I.slots=defaultSlots()}apply();paint()}
function defaultSlots(){return['b:3','b:11','b:5','b:6','k:wall:120','k:floor:128','f:0','f:37'].map(s=>{const it=parse(s);return it.kind!=='block'||BLOCKS[it.id]?s:null})}
let seed=null;setInterval(()=>{if(online())return;if(State.citySeed&&State.citySeed!==seed){seed=State.citySeed;loadLocal()}},1000);
let started=false,tick=0;setInterval(()=>{if(online()&&!started){started=true;I.server=null;refresh();if(State.ui.freeBuild)State.ui.freeBuild=false}if(online()&&++tick%5===0)refresh()},2000);
document.addEventListener('city-art-change',()=>setTimeout(refresh,1500));

// ─── Creative only in solo ──────────────────────────────────────────────────
const toggleFree=window.shToggleFreeBuild;
window.shToggleFreeBuild=function(){if(online()&&!State.ui.freeBuild){toast('Creative is for solo cities. Online you build with what you buy or earn.','info');return}const r=toggleFree.apply(this,arguments);render();paint();return r};
setInterval(()=>{if(online()&&State.ui.freeBuild){State.ui.freeBuild=false;render()}},500);

// ─── Holding ────────────────────────────────────────────────────────────────
I.held=()=>I.slots[I.sel];
function apply(){
 const sku=I.slots[I.sel],it=parse(sku),A=window.CityArt,K=window.CityBuild;
 if(A){A.cancelStamp?.();A.selected?.clear()}
 if(!it){if(K)K.enabled=false;if(A)A.enabled=false;return}
 if(it.kind==='block'){if(K)K.enabled=false;if(A)A.enabled=false;if(BLOCKS[it.id]){HOTBAR[HOTBAR.length-1]=it.id;heldSlot=HOTBAR.length-1}return}
 if(it.kind==='kit'){if(A)A.enabled=false;if(K){K.enabled=true;if(kitDef(it.shape))K.shape=it.shape;K.material=it.material}return}
 if(it.kind==='furn'){if(K)K.enabled=false;const item=window.FCFurniture?.items?.[it.id];if(A&&item){A.enabled=true;A.stageBlueprint({format:'fracture-city-art',v:1,objects:FCFurniture.rows(item)},item.name);A.stamp.sku=sku}}
}
I.select=function(i){I.sel=(i+SLOTS)%SLOTS;if(State.ui.construct)apply();paint(true)};
I.apply=apply;
//  Picking furniture from the old catalogue now means holding it.
const fPlace=window.FCFurniture?.place;
if(window.FCFurniture)FCFurniture.place=function(id){const sku='f:'+id;FCFurniture.close?.();let k=I.slots.indexOf(sku);if(k<0){k=I.slots.indexOf(null);if(k<0)k=I.sel;I.slots[k]=sku;saveHotbar()}if(!State.ui.construct&&Player.mode==='walk')toggleConstructMode();I.select(k);if(!count(sku)&&!creative()){openInv('shop');toast('Buy '+label(sku)+' to place it.','info')}};
//  No item in hand places nothing.
const place=window.placeBlock;
window.placeBlock=function(){if(State.ui.construct&&!I.slots[I.sel]&&!window.CityBuild?.enabled&&!window.CityArt?.enabled)return;return place.apply(this,arguments)};
//  A piece chosen in the room panel goes into the hand you are holding.
let panelWas=false;setInterval(()=>{const K=window.CityBuild,open=!!K?.panelOpen;if(panelWas&&!open&&K?.enabled&&State.ui.construct){I.slots[I.sel]='k:'+K.shape+':'+(/door/.test(K.shape)?(K.shape==='door'?142:143):K.material);saveHotbar();paint(true)}panelWas=open},200);
//  Left-click on your own furniture picks it back up.
const mine=window.shBeginMine;
window.shBeginMine=function(){
 const A=window.CityArt;
 if(State.ui.construct&&A?.pick&&!A.panelOpen){const id=A.pick(),o=id&&A.objects.find(x=>x.id===id),m=o&&/^f(\d{1,3})-/.exec(o.group||'');
  if(m&&!A.online?.foreign?.(o.id)){const sku='f:'+m[1],group=o.group;if(A.commit(A.objects.filter(x=>x.group!==group))){I.give(sku);toast('Picked up '+label(sku),'success')}return}}
 return mine.apply(this,arguments);
};

// ─── Keys and wheel while building ──────────────────────────────────────────
window.addEventListener('keydown',e=>{
 if(I.open){if(/^Digit[1-8]$/.test(e.code)&&I.hover){e.preventDefault();e.stopImmediatePropagation();assign(+e.code.slice(5)-1,I.hover)}return}
 if(!State.ui.construct||State.ui.paused||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
 if(/^Digit[1-9]$/.test(e.code)){e.preventDefault();e.stopImmediatePropagation();const n=+e.code.slice(5);if(n<=SLOTS)I.select(n-1)}
 //  [ ] change the held room-kit piece's shape, , . its finish.
 const K=window.CityBuild,step={BracketRight:1,BracketLeft:-1,Period:1,Comma:-1}[e.code];
 if(step&&K?.enabled&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();e.stopImmediatePropagation();
  if(e.code.startsWith('Bracket')){const defs=K.defs||[],i=defs.findIndex(d=>d[0]===K.shape);K.shape=defs[(i+step+defs.length)%defs.length][0]}
  else{const fin=(K.catalog||[]).filter(m=>m.pattern!=='door'),i=fin.findIndex(m=>m.id===K.material);K.material=fin[(i+step+fin.length)%fin.length].id}
  if(parse(I.slots[I.sel])?.kind==='kit'){I.slots[I.sel]='k:'+K.shape+':'+(/door/.test(K.shape)?(K.shape==='door'?142:143):K.material);saveHotbar()}
  paint(true)}
},true);
window.addEventListener('wheel',e=>{if(!State.ui.construct||State.ui.paused||I.open||!State.ui.locked||e.target!==State.renderer?.domElement)return;e.preventDefault();I.select(I.sel+(e.deltaY>0?1:-1))},{passive:false,capture:true});

// ─── Hotbar ─────────────────────────────────────────────────────────────────
const bar=document.createElement('div');bar.id='fc-hotbar';bar.hidden=true;document.body.append(bar);
for(const t of ['pointerdown','mousedown','click'])bar.addEventListener(t,e=>e.stopPropagation());
bar.addEventListener('click',e=>{const s=e.target.closest('[data-slot]');if(s){I.select(+s.dataset.slot);return}if(e.target.closest('[data-inv]'))openInv()});
const thumbs=new Map();
function icon(sku){const it=parse(sku);if(!it)return'';
 if(it.kind==='block'){const c=BLOCKS[it.id]?hex(BLOCKS[it.id].color):(I.skus?.get(sku)?.color||'#888');return`<i class="ic-block" style="background:${c}"></i>`}
 if(it.kind==='kit'){const c=I.skus?.get('b:'+it.material)?.color||'#888',g=kitDef(it.shape)?.[2]||'';return`<i class="ic-kit" data-g="${esc(g)}" style="--c:${c}"><b>${esc((kitDef(it.shape)?.[1]||it.shape).replace(/^3 × 3 /,'').slice(0,6))}</b></i>`}
 const item=window.FCFurniture?.items?.[it.id];let src=thumbs.get(it.id);if(!src&&item&&FCFurniture.thumbnail){try{src=FCFurniture.thumbnail(item);thumbs.set(it.id,src)}catch(e){}}
 return src?`<img class="ic-furn" src="${src}" alt="">`:'<i class="ic-block"></i>';
}
let flash=0,lastBar='';
function paint(showName){
 const show=!!(State.ui.construct&&Player.mode==='walk'&&!State.ui.paused&&!State.ui.inArcade&&!I.open);
 bar.hidden=!show;if(!show)return;
 const sig=JSON.stringify([I.slots,I.sel,I.slots.map(count),balance(),creative()]);
 if(sig!==lastBar){lastBar=sig;bar.innerHTML=`<div class="hb-slots">${I.slots.map((s,i)=>`<button data-slot="${i}" class="${i===I.sel?'on':''}" title="${esc(label(s))}">${icon(s)}<em>${s?(creative()?'∞':count(s)):''}</em><small>${i+1}</small></button>`).join('')}</div><button data-inv class="hb-inv" title="Inventory · I">☰<span>${creative()?'Creative':'¢ '+balance()}</span></button><div class="hb-name"></div>`}
 if(showName){const n=bar.querySelector('.hb-name');n.textContent=I.slots[I.sel]?label(I.slots[I.sel]):'Empty hand';n.classList.add('on');clearTimeout(flash);flash=setTimeout(()=>n.classList.remove('on'),1400)}
}
setInterval(()=>paint(false),200);
let wasBuild=false;setInterval(()=>{if(State.ui.construct&&!wasBuild){apply();paint(true)}wasBuild=!!State.ui.construct},150);
function render(){if(I.open)drawInv();paint(false)}

// ─── Inventory panel ────────────────────────────────────────────────────────
const inv=document.createElement('section');inv.id='fc-inv';inv.hidden=true;inv.setAttribute('role','dialog');inv.setAttribute('aria-label','Inventory');document.body.append(inv);
for(const t of ['pointerdown','mousedown','wheel','contextmenu'])inv.addEventListener(t,e=>e.stopPropagation());
let prevPaused=false;
function openInv(tab){if(tab)I.tab=tab;if(I.open){drawInv();return}I.open=true;State.ui.inInventory=true;prevPaused=State.ui.paused;document.exitPointerLock?.();document.body.style.cursor='auto';State.keys?.clear?.();inv.hidden=false;refresh();catalogReady.then(drawInv)}
function closeInv(){if(!I.open)return;I.open=false;I.picked=null;I.hover=null;inv.hidden=true;State.ui.inInventory=false;if(!State.ui.paused&&!State.ui.inMiniGame&&!State.ui.inShiftPanel){document.body.style.cursor='none';if(!(window.Touch&&Touch.on))try{State.renderer.domElement.requestPointerLock?.()}catch(e){}}if(State.ui.construct)apply();paint(true)}
window.shOpenInventory=()=>openInv();window.shCloseInventory=closeInv;window.shToggleInventory=()=>I.open?closeInv():openInv();
I.openInv=openInv;I.closeInv=closeInv;
function assign(slot,sku){I.slots[slot]=sku;I.picked=null;saveHotbar();if(slot===I.sel&&State.ui.construct)apply();drawInv();paint(false)}
function tile(sku,extra=''){const n=count(sku),it=parse(sku);return`<button class="iv-tile ${I.picked===sku?'picked':''} ${!n&&!creative()&&it.kind!=='kit'?'none':''}" data-item="${esc(sku)}" title="${esc(label(sku))}">${icon(sku)}<span>${esc(label(sku))}</span><em>${creative()?'∞':n}</em>${extra}</button>`}
function shopTile(item){const stack=item.stack||1;return`<div class="iv-shop">${icon(item.sku)}<div><b>${esc(item.name)}</b><small>${item.category?esc(item.category)+' · ':''}¢ ${item.price}${stack>1?' each':''} · you hold ${count(item.sku)}</small></div><button data-buy="${item.sku}" data-q="1">Buy 1</button>${stack>1?`<button data-buy="${item.sku}" data-q="${stack}">Buy ${stack} · ¢ ${item.price*stack}</button>`:''}</div>`}
function drawInv(){
 if(!I.open)return;const c=I.catalog;if(!c){inv.innerHTML='<p>Loading the shop…</p>';return}
 const tabs=[['bag','Backpack'],['shop','Shop'],['kit','Room kit'],...(creative()?[['creative','Creative']]:[])];if(!tabs.some(t=>t[0]===I.tab))I.tab='bag';
 let body='';
 if(I.tab==='bag'){
  const blocks=[...new Set([...Inventory.keys()].map(Number).filter(id=>BLOCKS[id]&&shInvCount(id)>0).map(id=>'b:'+id).concat(online()?Object.keys(I.server?.items||{}).filter(s=>s.startsWith('b:')&&count(s)>0):[]))];
  const furn=c.furniture.map(i=>i.sku).filter(s=>count(s)>0);
  body=`<h3>Furniture</h3><div class="iv-grid">${furn.map(s=>tile(s)).join('')||'<p class="iv-empty">No furniture yet. Buy some in the Shop.</p>'}</div><h3>Blocks & finishes</h3><div class="iv-grid">${blocks.map(s=>tile(s,!online()&&MATERIALS[parse(s).id]?`<i class="iv-melt" data-melt="${parse(s).id}" title="Sell 1 for ¢ ${shMat4Block(parse(s).id).value}">¢</i>`:'')).join('')||'<p class="iv-empty">No blocks yet. Mine some (hold left-click in build mode) or buy finishes in the Shop.</p>'}</div>`;
 }
 if(I.tab==='shop'){const cats=[...new Set(c.furniture.map(i=>i.category))];body=`<h3>Workshop finishes</h3><div class="iv-shoplist">${c.blocks.map(shopTile).join('')}</div>`+cats.map(k=>`<h3>${esc(k)}</h3><div class="iv-shoplist">${c.furniture.filter(i=>i.category===k).map(shopTile).join('')}</div>`).join('')}
 if(I.tab==='kit'){const owned=c.blocks.filter(b=>b.pattern!=='door'&&(creative()||count(b.sku)>0));I.kitMat=owned.some(b=>b.id===I.kitMat)?I.kitMat:owned[0]?.id;
  body=owned.length?`<h3>Finish</h3><div class="iv-grid">${owned.map(b=>`<button class="iv-tile ${b.id===I.kitMat?'picked':''}" data-kitmat="${b.id}">${icon(b.sku)}<span>${esc(b.name)}</span><em>${creative()?'∞':count(b.sku)}</em></button>`).join('')}</div><h3>Shape</h3><p class="iv-note">Pick a shape, then a hotbar slot. Pieces use the finish blocks they are made of.</p><div class="iv-grid">${(window.CityBuild?.defs||[]).filter(d=>!/door/.test(d[0])).map(d=>tile('k:'+d[0]+':'+I.kitMat)).join('')}</div><h3>Doors</h3><div class="iv-grid">${['b:142','b:143'].map(s=>tile('k:'+(s==='b:142'?'door':'steel-door')+':'+s.slice(2))).join('')}</div>`:`<p class="iv-empty">Room-kit pieces are built from workshop finishes. Buy some in the Shop first.</p>`}
 if(I.tab==='creative'){body=`<h3>Furniture</h3><div class="iv-grid">${c.furniture.map(i=>tile(i.sku)).join('')}</div><h3>Finishes</h3><div class="iv-grid">${c.blocks.map(b=>tile(b.sku)).join('')}</div><h3>City blocks</h3><div class="iv-grid">${Object.keys(MATERIALS).map(Number).filter(id=>BLOCKS[id]&&id<120).map(id=>tile('b:'+id)).join('')}</div>`}
 const hint=I.picked?`Now click a hotbar slot for <b>${esc(label(I.picked))}</b>, or press 1–8.`:'Click an item, then a hotbar slot. Or hover an item and press 1–8.';
 inv.innerHTML=`<header><div><small>${online()?'ONLINE · ITEMS ARE KEPT ON THE SERVER':'SOLO CITY'}</small><h2>Inventory</h2></div><div class="iv-wallet">${creative()?'<b>Creative</b>':`<b>¢ ${balance()}</b><small>credits</small>`}</div>${online()?'':`<button data-creative class="${creative()?'on':''}">Creative ${creative()?'on':'off'} · G</button>`}<button data-close>Close · I</button></header><nav>${tabs.map(([k,l])=>`<button data-tab="${k}" class="${k===I.tab?'on':''}">${l}</button>`).join('')}<span class="iv-gap"></span><button data-atelier>Atelier…</button></nav><div class="iv-body">${body}</div><footer><p>${hint}</p><div class="iv-hotbar">${I.slots.map((s,i)=>`<button data-hslot="${i}" class="${i===I.sel?'on':''}" title="${esc(label(s))}">${icon(s)}<em>${s?(creative()?'∞':count(s)):''}</em><small>${i+1}</small>${s?`<i data-clear="${i}" title="Empty this slot">×</i>`:''}</button>`).join('')}</div></footer>`;
}
inv.addEventListener('mouseover',e=>{const t=e.target.closest('[data-item]');I.hover=t?t.dataset.item:null});
inv.addEventListener('click',e=>{
 const t=e.target;const b=t.closest('button,[data-melt],[data-clear]');if(!b)return;
 if(b.dataset.clear!==undefined){e.stopPropagation();assign(+b.dataset.clear,null);return}
 if(b.dataset.melt){const id=+b.dataset.melt;if(shInvTake(id,1)){grantCredits(shMat4Block(id).value);toast(`Sold 1 ${shMat4Block(id).label} · +${shMat4Block(id).value} credits`,'success')}drawInv();return}
 if(b.dataset.close!==undefined)return closeInv();
 if(b.dataset.creative!==undefined){shToggleFreeBuild();drawInv();return}
 if(b.dataset.atelier!==undefined){closeInv();window.CityArt?.open?.();return}
 if(b.dataset.tab){I.tab=b.dataset.tab;drawInv();return}
 if(b.dataset.buy){buy(b.dataset.buy,+b.dataset.q);return}
 if(b.dataset.kitmat){I.kitMat=+b.dataset.kitmat;drawInv();return}
 if(b.dataset.item){I.picked=I.picked===b.dataset.item?null:b.dataset.item;drawInv();return}
 if(b.dataset.hslot!==undefined){const k=+b.dataset.hslot;if(I.picked)assign(k,I.picked);else{I.sel=k;drawInv()}return}
});
inv.addEventListener('contextmenu',e=>{const h=e.target.closest('[data-hslot]');if(h){e.preventDefault();assign(+h.dataset.hslot,null)}});
window.addEventListener('keydown',e=>{if(!I.open||/INPUT|TEXTAREA/.test(e.target.tagName))return;if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeInv()}},true);

const css=document.createElement('style');css.textContent=`
#fc-hotbar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:120;display:flex;align-items:flex-end;gap:8px;font:12px system-ui,-apple-system,Segoe UI,sans-serif;color:#e8f1ee;pointer-events:none}
#fc-hotbar[hidden]{display:none}
#fc-hotbar .hb-slots{display:flex;gap:3px;padding:4px;background:#0b151bd9;border:1px solid #2c4650;border-radius:10px;pointer-events:auto}
#fc-hotbar button{position:relative;width:56px;height:56px;padding:0;border:2px solid #2c4650;border-radius:7px;background:#14242c;color:inherit;display:grid;place-items:center;cursor:pointer}
#fc-hotbar .hb-slots button.on{border-color:#ffe08a;box-shadow:0 0 0 2px #ffe08a55;background:#1f3540}
#fc-hotbar button em{position:absolute;right:4px;bottom:2px;font:700 11px system-ui;font-style:normal;text-shadow:0 1px 2px #000}
#fc-hotbar button small{position:absolute;left:4px;top:2px;font-size:9px;color:#93aab0}
#fc-hotbar .hb-inv{width:auto;padding:0 12px;gap:2px;font-weight:700;pointer-events:auto;display:flex;flex-direction:column;justify-content:center}
#fc-hotbar .hb-inv span{font-size:11px;font-weight:600;color:#ffe08a}
#fc-hotbar .hb-name{position:absolute;left:50%;bottom:70px;transform:translateX(-50%);white-space:nowrap;padding:4px 10px;border-radius:6px;background:#0b151bd9;font-weight:600;opacity:0;transition:opacity .25s}
#fc-hotbar .hb-name.on{opacity:1}
.ic-block{display:block;width:30px;height:30px;border-radius:4px;box-shadow:inset 0 0 0 1px #fff3,inset -4px -4px 0 #0003,inset 4px 4px 0 #fff2}
.ic-kit{display:grid;place-items:center;width:34px;height:30px;border-radius:4px;background:linear-gradient(135deg,var(--c) 60%,#0003);box-shadow:inset 0 0 0 1px #fff3}
.ic-kit b{font:700 8px system-ui;color:#fff;text-shadow:0 1px 2px #000;text-transform:uppercase}
.ic-furn{width:46px;height:34px;object-fit:contain}
#fc-inv{position:fixed;inset:5vh max(16px,calc(50vw - 520px));z-index:110001;display:flex;flex-direction:column;background:#0e1a21fa;color:#e8f1ee;border:1px solid #2c4650;border-radius:16px;box-shadow:0 18px 60px #000a,0 0 0 100vmax #0007;font:13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden}
#fc-inv[hidden]{display:none}
#fc-inv header{display:flex;align-items:center;gap:12px;padding:16px 20px 8px}
#fc-inv header>div:first-child{flex:1}
#fc-inv header small{color:#93aab0;font-size:10px;letter-spacing:.08em}
#fc-inv h2{margin:2px 0 0;font:400 28px Georgia,serif}
#fc-inv .iv-wallet{text-align:right}#fc-inv .iv-wallet b{display:block;font-size:20px;color:#ffe08a}#fc-inv .iv-wallet small{color:#93aab0}
#fc-inv button{font:inherit;color:inherit;background:#172a33;border:1px solid #2c4650;border-radius:8px;padding:7px 11px;cursor:pointer;min-height:34px}
#fc-inv button:hover{border-color:#7fe0c8}
#fc-inv button.on{border-color:#7fe0c8;box-shadow:inset 0 0 0 1px #7fe0c8}
#fc-inv header [data-close]{background:#e8f1ee;color:#0e1a21;font-weight:700}
#fc-inv nav{display:flex;gap:6px;padding:0 20px 10px;border-bottom:1px solid #2c4650;flex-wrap:wrap}
#fc-inv nav .iv-gap{flex:1}
#fc-inv .iv-body{flex:1;overflow:auto;padding:4px 20px 16px}
#fc-inv h3{font:600 11px system-ui;text-transform:uppercase;letter-spacing:.08em;color:#93aab0;margin:16px 0 8px}
#fc-inv .iv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px}
#fc-inv .iv-tile{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px 8px;min-height:92px}
#fc-inv .iv-tile span{font-size:11px;text-align:center;line-height:1.2}
#fc-inv .iv-tile em{position:absolute;right:6px;top:4px;font-style:normal;font-weight:700;font-size:11px;color:#ffe08a}
#fc-inv .iv-tile.none{opacity:.45}
#fc-inv .iv-tile.picked{border-color:#ffe08a;box-shadow:inset 0 0 0 2px #ffe08a}
#fc-inv .iv-melt{position:absolute;left:5px;top:4px;font-style:normal;font-size:10px;padding:1px 5px;border-radius:4px;background:#2c4650}
#fc-inv .iv-shoplist{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:6px}
#fc-inv .iv-shop{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #2c4650;border-radius:10px;background:#0b151b}
#fc-inv .iv-shop>div{flex:1;min-width:0}#fc-inv .iv-shop b{display:block}#fc-inv .iv-shop small{color:#93aab0}
#fc-inv .iv-empty,#fc-inv .iv-note{color:#93aab0}
#fc-inv footer{border-top:1px solid #2c4650;padding:10px 20px 14px;background:#0b151b}
#fc-inv footer p{margin:0 0 8px;color:#93aab0;text-align:center}
#fc-inv .iv-hotbar{display:flex;gap:4px;justify-content:center}
#fc-inv .iv-hotbar button{position:relative;width:62px;height:58px;padding:0;display:grid;place-items:center}
#fc-inv .iv-hotbar button.on{border-color:#ffe08a}
#fc-inv .iv-hotbar em{position:absolute;right:4px;bottom:2px;font-style:normal;font-weight:700;font-size:11px}
#fc-inv .iv-hotbar small{position:absolute;left:4px;top:2px;font-size:9px;color:#93aab0}
#fc-inv .iv-hotbar i[data-clear]{position:absolute;right:-6px;top:-6px;width:18px;height:18px;border-radius:9px;background:#5a2430;font-style:normal;font-size:12px;line-height:18px;display:none}
#fc-inv .iv-hotbar button:hover i[data-clear]{display:block}
#inv-overlay{display:none!important}
@media (max-width:760px),(pointer:coarse){
 #fc-hotbar{top:max(8px,env(safe-area-inset-top));bottom:auto;z-index:100000;gap:4px}
 #fc-hotbar button{width:34px;height:40px}
 #fc-hotbar .hb-slots{gap:2px;padding:3px}
 #fc-hotbar .hb-inv{width:auto;max-width:64px;font-size:11px}#fc-hotbar .hb-inv span{font-size:9px}
 #fc-hotbar button small{display:none}
 #fc-hotbar .ic-block{width:22px;height:22px}#fc-hotbar .ic-furn{width:34px;height:26px}#fc-hotbar .ic-kit{width:26px;height:22px}
 #fc-hotbar .hb-name{bottom:auto;top:54px}
 #fc-hotbar .hb-inv{padding:0 8px}
 #fc-inv{inset:6px}
 #fc-inv header{flex-wrap:wrap;gap:6px;padding:12px 12px 6px}#fc-inv h2{font-size:22px}#fc-inv .iv-wallet b{font-size:16px}
 #fc-inv nav{padding:0 12px 8px}#fc-inv .iv-body{padding:4px 12px 12px}#fc-inv footer{padding:8px 8px 10px}
 #fc-inv .iv-grid{grid-template-columns:repeat(auto-fill,minmax(96px,1fr))}
 #fc-inv .iv-hotbar button{width:40px;height:44px}
 #fc-inv .iv-hotbar i[data-clear]{display:block}
 #fc-inv .iv-shoplist{grid-template-columns:1fr}
 body.fc-build #tc-top{display:none!important}
}`;
document.head.append(css);
})();
