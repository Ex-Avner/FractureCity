/* Outer Expanse: seeded voxel biomes, impossible monuments and local fieldwork.
   Terrain and landmarks use ordinary chunks: collision, mining and edits agree. */
(function(){'use strict';
if(!window.Wilds||typeof Chunk==='undefined')return;
const defs=[
 {id:'saltwake',name:'SALTWAKE EXPANSE',landmark:'The Inverted Cathedral',color:0xc8d9d5,ground:180,stone:181,signal:185,
  description:'SALTWAKE EXPANSE · Pale salt, black needles, and a cathedral hanging roof-first over its own grave.',
  clue:'The inscription runs from the dead sea to the sky: TIDE, then BELL, then STAR.',words:['TIDE','BELL','STAR'],order:[0,1,2],
  story:['The tide gauge records a sea level twenty metres above your head. There is no sea.','A bronze bell has been packed with salt. The grains tremble when you touch the rim.','The star chart is carved on the underside of a floor. Every constellation points down.'],
  ending:'The salt in the bell settles into the outline of the city. On the rim, a sentence becomes legible: WE DID NOT RAISE THE CHURCH. WE LOWERED THE WORLD.',title:'Listener beneath the Sea',starter:[2,0]},
 {id:'ossuary',name:'OSSUARY FOREST',landmark:'The Saint That Never Lived',color:0xcab99a,ground:182,stone:181,signal:185,
  description:'OSSUARY FOREST · Black marrow trees surround ribs large enough to shelter a neighborhood.',
  clue:'The growth rings begin below: ROOT wakes HEART; HEART teaches CROWN to remember.',words:['CROWN','ROOT','HEART'],order:[1,2,0],
  story:['The crown is a fossilized nest. Its eggs are small stone houses, each with a different front door.','The root is not a root. It is a spinal nerve, branching into the soil and turning to wood.','The heart is warm glass. Something inside taps twice, waits, then taps once.'],
  ending:'The three traces form a growth diagram: the skeleton grew around an empty space. The forest was trying to build someone a home. No one came.',title:'Keeper of the Empty Heart',starter:[0,-3]},
 {id:'violet-rift',name:'VIOLET RIFT',landmark:'The Observatory of Tomorrow',color:0xbca2e1,ground:183,stone:184,signal:186,
  description:'VIOLET RIFT · Purple mineral scars split the flats beneath a telescope whose floors no longer agree on gravity.',
  clue:'A maintenance note reads: GROUND before LENS. Only then open the SKY.',words:['SKY','LENS','GROUND'],order:[2,1,0],
  story:['The sky plate has tomorrow’s date scratched out. Underneath it says: STILL TOMORROW.','A lens projects the shadow of a tower that has not been built. It is taller than the city.','The grounding strap has been severed and neatly tied into a bow. Someone meant to leave.'],
  ending:'The instruments agree for a moment. The observatory was not looking at the future. It was sending instructions to it. The last instruction is: LEAVE ROOM FOR THE TREES.',title:'Surveyor of the Unbuilt',starter:[-3,0]}
];
const materials=[['salt crust',0xd4cdbb,false],['fossil ivory',0xcbbf9e,false],['marrow loam',0x354b40,false],['violet shale',0x51445e,false],['rift obsidian',0x252a3e,false],['amber echo',0xeacb88,true],['violet echo',0xb59bea,true]];
materials.forEach(([name,color,emit],i)=>{const id=shDefBlock(180+i,{name,solid:true,emit,color,grain:emit?.025:.14});MATERIALS[id]={label:name,cls:emit?'signal':'stone',hardness:emit?2:1.4,drop:id,yield:1,value:emit?8:2,desc:'Recovered from the Outer Expanse.'};});
for(const d of defs)d.district={...Wilds.districts.SCRUB,name:d.name,biome:d.id,bgColor:d.color,accentColor:d.color,description:d.description,expanse:true};
const size=144,seed=()=>String(State.citySeed||''),hash=(tag,x,z)=>hashStr('expanse:'+seed()+':'+tag+':'+x+':'+z)>>>0;
function region(cx,cz){
 const rx=Math.floor(cx/6),rz=Math.floor(cz/6),nearest=n=>n>=0?n*6:-(n*6+5);
 if(Math.max(nearest(rx),nearest(rz))<12)return null;
 let i=defs.findIndex(d=>d.starter[0]===rx&&d.starter[1]===rz);
 if(i<0){i=hash('biome',rx,rz)%4;if(i===3)return null;}
 return {rx,rz,index:i,def:defs[i],x:rx*size+72,z:rz*size+72,key:rx+','+rz};
}
const district=districtForChunk;
window.districtForChunk=function(cx,cz){const r=region(cx,cz);return r?r.def.district:district(cx,cz);};
function height(x,z,r){
 const dx=x+.5-r.x,dz=z+.5-r.z,dist=Math.hypot(dx,dz);
 const noise=Math.sin((x+(hash('height',0,0)%101))*.045)*Math.cos(z*.038)+Math.sin((x+z)*.071)*.55;
 const raw=2+Math.round(noise),blend=Math.min(1,Math.max(0,(dist-36)/18));
 return Math.max(1,2+Math.round((raw-2)*blend));
}
const stations=r=>r.def.words.map((word,i)=>({word,x:r.x+[-15,0,15][i],z:r.z+29,y:2,index:i}));
function monument(r,dx,y,dz){
 const d=r.def,ax=Math.abs(dx),az=Math.abs(dz);
 if(r.index===0){
  // An inverted nave, pierced walls, a roof pointing into the earth, and a halo.
  if(y>=22&&y<=40&&ax<18&&az<12&&(ax>16.4||az>10.4)){
   const window=y>26&&y<36&&((ax>16.4&&Math.abs(dz)%6<2)||(az>10.4&&Math.abs(dx)%7<2));
   if(!window)return y%6===0?184:d.stone;
  }
  if(y>=40&&y<=42&&ax<19&&az<13)return d.stone;
  if(y>=13&&y<23&&Math.abs(ax-(y-13)*1.8)<1.2&&az<13)return 184;
  for(const sx of [-15,15])for(const sz of [-9,9])if(y>=10&&y<23&&Math.abs(dx-sx)<(y-8)*.13&&Math.abs(dz-sz)<(y-8)*.13)return d.stone;
  const ring=Math.hypot(dx,y-29);if(Math.abs(dz)<.8&&Math.abs(ring-27)<.75)return y>47?d.signal:184;
 }else if(r.index===1){
  // A vaulted ribcage: its arch feet really meet the earth on both sides.
  if(y>=2&&y<=30&&az<25&&Math.abs((dz+24)%8)<1.15&&Math.abs(Math.hypot(dx/17,(y-2)/27)-1)<.065)return d.stone;
  if(ax<1.4&&y>=28&&y<=30&&az<27)return d.stone;
  const skull=Math.sqrt((dx/10)**2+((y-11)/10)**2+((dz+31)/9)**2);
  const eye=Math.abs(ax-4)<2.2&&y>11&&y<16&&dz< -34;
  if(skull>.85&&skull<1.05&&!eye&&y>2)return d.stone;
  if(Math.hypot(dx,(y-17)*.8,dz)<4&&Math.hypot(dx,(y-17)*.8,dz)>3)return d.signal;
 }else{
  // Three misaligned drum segments and a broken astronomical armillary.
  const shift=y<15?0:y<29?5:-3,rr=Math.hypot(dx-shift,dz);
  if(y>=2&&y<=39&&!(y>=14&&y<=16)&&!(y>=28&&y<=30)&&rr>7.3&&rr<9.4&&!(dz>0&&Math.abs(dx-shift)<3))return y%7===0?d.signal:184;
  if(y>33&&y<61){
   if(Math.abs(Math.hypot(dx+3,y-47)-14)<.75&&Math.abs(dz)<.8&&dx<9)return d.stone;
   if(Math.abs(Math.hypot(dz,y-47)-14)<.75&&Math.abs(dx+3)<.8)return d.signal;
  }
  // Broken stair slabs are deliberate impossible fragments above the terrain.
  for(let i=0;i<6;i++)if(Math.abs(dx-(-24+i*3))<2&&Math.abs(dz-8)<3&&y===5+i*3)return d.stone;
 }
 return 0;
}
const generate=Chunk.prototype.generate;
Chunk.prototype.generate=function(){
 const r=region(this.cx,this.cz);if(!r)return generate.apply(this,arguments);
 this._wild=r.def.id;this.__cityFitted=1;this._parked=true;this._eased=true;this._wildEased=true;this._wildLooted=true;this._expanse=r.key;
 const d=r.def;
 for(let lx=0;lx<VOX_W;lx++)for(let lz=0;lz<VOX_W;lz++){
  const x=this.originX+lx,z=this.originZ+lz,dx=x+.5-r.x,dz=z+.5-r.z,h=height(x,z,r),distance=Math.hypot(dx,dz);
  for(let y=0;y<h;y++)this.vSet(lx,y,lz,y===h-1?d.ground:B_SOIL);
  // Fine geological bands and fractures, with a flat accessible landmark court.
  if(distance<35&&distance>32)this.vSet(lx,1,lz,d.stone);
  if(r.index===2&&distance>38&&Math.abs(Math.sin(x*.06)+Math.sin(z*.045))<.065)this.vSet(lx,h-1,lz,d.signal);
  if(r.index===0&&distance>38&&(Math.floor(x/5)+Math.floor(z/5))%7===0)this.vSet(lx,h-1,lz,181);
  // Sparse planted/mineral forms are evaluated in world space across chunk edges.
  if(distance>42){
   const gx=Math.floor(x/11),gz=Math.floor(z/11),cx=gx*11+5,cz=gz*11+5,px=x-cx,pz=z-cz,q=hash('growth',gx,gz),base=height(cx,cz,r),tall=5+q%9;
   if(q%4===0)for(let y=base;y<base+tall;y++){
    let yes=false;
    if(r.index===0)yes=Math.abs(px)<(base+tall-y)/8&&Math.abs(pz)<1;
    if(r.index===1)yes=(Math.abs(px)<1&&Math.abs(pz)<1)||(y>base+3&&Math.abs(Math.abs(px)-(y-base-3)*.5)<.65&&Math.abs(pz)<1);
    if(r.index===2)yes=Math.abs(px-(y-base)*.2)<.8&&Math.abs(pz)<(base+tall-y)*.13;
    if(yes)this.vSet(lx,y,lz,r.index===1?64:r.index===2?184:181);
   }
  }
  if(distance<40)for(let y=2;y<62&&y<VOX_H;y++){const id=monument(r,dx,y,dz);if(id)this.vSet(lx,y,lz,id);}
  for(const a of stations(r))if(x===a.x&&z===a.z){this.vSet(lx,2,lz,184);this.vSet(lx,3,lz,d.signal);}
 }
};

// The original sky sphere stayed at world origin. Travel beyond its radius
// exposed its back faces. Follow the camera, as the cloud shells already do.
const skyFrame=shSkyFrame;
window.shSkyFrame=function(){if(State.sky&&State.camera)State.sky.position.copy(State.camera.position);return skyFrame.apply(this,arguments);};

// Personal field records. No shared rewards or authoritative server state here.
let records={},scope='',panel=null,oldPause=false,oldFocus=null,near=null,pinned=null,last=0;
function load(){const next=seed();if(scope===next)return;if(panel)close();scope=next;records={};pinned=null;try{const raw=JSON.parse(localStorage.getItem('fc-expanse-v1:'+scope));if(raw&&typeof raw==='object'&&!Array.isArray(raw))for(const [k,v]of Object.entries(raw).slice(-128))if(/^-?\d+,-?\d+$/.test(k)&&v&&Number.isInteger(v.stage)&&v.stage>=0&&v.stage<=3)records[k]={stage:v.stage,seen:!!v.seen};}catch{}}
function save(){try{const keys=Object.keys(records);while(keys.length>128)delete records[keys.shift()];localStorage.setItem('fc-expanse-v1:'+scope,JSON.stringify(records));return true;}catch{toast('Field record could not be saved on this device.','warn');return false;}}
const record=r=>(records[r.key]||={stage:0,seen:false});
function active(){return !!State.citySeed&&State.chunkMap.size>0&&!FN?.prologue&&!State.ui.inDialogue&&!State.ui.inArcade&&!State.ui.inMinigame&&!window.FCJustice?.active;}
function close(){if(!panel)return;panel.remove();panel=null;State.ui.paused=oldPause;State.keys?.clear?.();oldFocus?.focus?.();}
function shell(title){
 if(panel)return false;oldPause=State.ui.paused;oldFocus=document.activeElement;State.ui.paused=true;State.keys?.clear?.();window.shTouchReleaseAll?.();document.exitPointerLock?.();
 panel=document.createElement('section');panel.id='expanse-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',title);document.body.append(panel);return true;
}
function frame(title,body){panel.innerHTML='<header><small>OUTER EXPANSE / FIELD JOURNAL</small><button data-close aria-label="Close expedition journal">Close ×</button><h2>'+title+'</h2></header>'+body+'<footer>Personal discovery records save on this device, separately for each world. There are no server rewards.</footer>';panel.querySelector('[data-close]').onclick=close;panel.querySelector('[data-close]').focus();}
function history(){
 const entries=Object.entries(records).filter(([,v])=>v.seen).map(([key,v])=>{const [rx,rz]=key.split(',').map(Number),r=region(rx*6,rz*6);if(!r)return '';return '<article><small>FIELD RECORD / X '+r.x+' / Z '+r.z+'</small><h3>'+r.def.landmark+'</h3><p>'+(v.stage===3?r.def.title+' · '+r.def.ending:v.stage+'/3 traces attuned. The inscription awaits another visit.')+'</p></article>';}).filter(Boolean);
 return entries.length?'<h3>Your discoveries</h3>'+entries.join(''):'';
}
function open(){
 if(!active())return;load();if(!shell('Expeditions beyond the city'))return;
 frame('Beyond the city limits','<p>Three leads survived in an old survey ledger. Pin one, leave the city on foot or by flight, and look for its silhouette. The outer wilderness still contains radiation fields and biowaste: watch the existing hazard meter.</p>'+defs.map((d,i)=>{const r=region(...d.starter.map(n=>n*6)),s=records[r.key];return '<article><small>'+d.name+'</small><h3>'+d.landmark+'</h3><p>'+d.description.split(' · ')[1]+'</p><p>Survey location: X '+r.x+' / Z '+r.z+' · '+(s?.stage===3?'Resolved · '+d.title:s?.seen?'Discovered · '+s.stage+'/3 traces':'Unvisited')+'</p><button data-pin="'+i+'">Pin expedition</button></article>';}).join('')+history()+'<button data-unpin>Clear route</button>');
 panel.querySelectorAll('[data-pin]').forEach(b=>b.onclick=()=>{pinned=region(...defs[+b.dataset.pin].starter.map(n=>n*6));close();toast('Expedition pinned: '+pinned.def.landmark);});panel.querySelector('[data-unpin]').onclick=()=>{pinned=null;close();};
}
function examine(){
 if(!near||!active()||State.ui.paused)return;load();const n=near,r=n.r,a=n.a,s=record(r);if(!shell(r.def.landmark))return;
 function paint(message=''){
  frame(r.def.landmark,'<p><b>'+r.def.clue+'</b></p><article><small>TRACE '+(a.index+1)+' / '+a.word+'</small><p>'+r.def.story[a.index]+'</p></article><p role="status">'+message+'</p><p>Sequence: '+s.stage+'/3 · '+(s.stage===3?r.def.title:'Read the clue, then visit each physical trace in order.')+'</p>'+(s.stage===3?'<blockquote>'+r.def.ending+'</blockquote>':'<button data-listen>Attune this trace</button>'));
  const button=panel.querySelector('[data-listen]');if(button)button.onclick=()=>{
   const dist=Math.hypot(Player.position.x-a.x,Player.position.z-a.z),feet=Player.position.y-Player.height;
   if(dist>3.3||Math.abs(feet-2)>2||getBlock(a.x,3,a.z)!==r.def.signal){paint('The trace is no longer within reach, or its stone has been removed.');return;}
   if(r.def.order[s.stage]!==a.index){paint('The stone answers with silence. Re-read the inscription; your existing progress is safe.');return;}
   s.stage++;s.seen=true;const saved=save();paint(s.stage===3?'The three traces agree. '+(saved?'Your discovery is recorded.':'Your record is only kept for this session.'):'A clear note answers. Continue to the next physical trace.');
   if(typeof shTone==='function')shTone({f0:180+s.stage*90,gain:.08,dur:.35});
  };
 }
 paint();
}
const prompt=document.createElement('button');prompt.id='expanse-approach';prompt.hidden=true;prompt.onclick=examine;document.body.append(prompt);
const route=document.createElement('button');route.id='expanse-route';route.hidden=true;route.onclick=open;document.body.append(route);
const css=document.createElement('style');css.textContent=`
#expanse-panel{position:fixed;inset:5vh max(16px,calc((100vw - 760px)/2));z-index:260;overflow:auto;box-sizing:border-box;background:#e3dfd0;color:#263330;border:1px solid #b09b70;border-radius:16px;padding:26px;box-shadow:0 25px 100px #000b;font:15px/1.65 system-ui}
#expanse-panel header{border-bottom:1px solid #b4b3a3;margin-bottom:20px}#expanse-panel h2{font:32px/1.15 Georgia;margin:14px 0 22px}#expanse-panel h3{font:24px Georgia;margin:7px 0}#expanse-panel small{font:11px/1.4 system-ui;letter-spacing:.14em}#expanse-panel article{border-left:3px solid #7b8f80;padding:12px 18px;margin:20px 0;background:#f0ede3}#expanse-panel button{border:1px solid #718172;border-radius:7px;padding:11px 15px;background:#273e37;color:#faf1d9;cursor:pointer;font:inherit;min-height:44px}#expanse-panel [data-close]{float:right}#expanse-panel footer{font-size:12px;border-top:1px solid #b4b3a3;padding-top:18px;margin-top:24px}#expanse-panel blockquote{margin:20px 0;padding:20px;background:#263e37;color:#f4e8cc;font:21px/1.5 Georgia}
#expanse-approach,#expanse-route{position:fixed;z-index:95;background:#142c29ed;color:#f0e5c7;border:1px solid #ad9b72;border-radius:8px;padding:11px 16px;font:12px/1.4 system-ui;cursor:pointer;max-width:85vw}#expanse-approach{bottom:160px;left:50%;transform:translateX(-50%)}#expanse-route{left:16px;top:112px;max-width:240px;text-align:left}#expanse-approach[hidden],#expanse-route[hidden]{display:none}
@media(max-width:600px){#expanse-panel{inset:12px;padding:18px;font-size:14px}#expanse-panel h2{font-size:25px;clear:both;padding-top:14px}#expanse-route{top:90px;left:8px;max-width:180px;font-size:11px}#expanse-approach{bottom:190px}}
`;document.head.append(css);
window.addEventListener('keydown',e=>{
 if(panel){if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}else if(e.key==='Tab'){const buttons=[...panel.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);e.preventDefault();buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();}return;}
 if(e.code==='KeyE'&&!e.repeat&&near&&active()&&!State.ui.paused&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();e.stopImmediatePropagation();examine();}
},true);
function tick(t){requestAnimationFrame(tick);if(t-last<200)return;last=t;load();near=null;const urban=Math.max(Math.abs(Player.position.x),Math.abs(Player.position.z))<288;for(const sky of [State.skyline,State.farSkyline])if(sky)sky.visible=urban;const on=active()&&!State.ui.paused;
 if(on){const r=region(Math.floor(Player.position.x/24),Math.floor(Player.position.z/24));if(r){if(Math.hypot(Player.position.x-r.x,Player.position.z-r.z)<36){const s=record(r);if(!s.seen){s.seen=true;save();toast('DISCOVERED · '+r.def.landmark);}}
 for(const a of stations(r))if(Math.hypot(Player.position.x-a.x,Player.position.z-a.z)<3.3&&Math.abs(Player.position.y-Player.height-2)<2&&getBlock(a.x,3,a.z)===r.def.signal)near={r,a};}}
 prompt.hidden=!near;prompt.textContent=near?'E / Tap · '+near.a.word+' · Examine trace':'';
 route.hidden=!on||!pinned;if(pinned){const dx=pinned.x-Player.position.x,dz=pinned.z-Player.position.z,angle=(Math.atan2(dx,-dz)*180/Math.PI+360)%360,bearing=['N','NE','E','SE','S','SW','W','NW'][Math.round(angle/45)%8];route.textContent=pinned.def.landmark+' · '+Math.round(Math.hypot(dx,dz))+' m '+bearing+' · Journal';}
}
requestAnimationFrame(tick);
window.FCExpanse={showUrbanHorizon:p=>Math.max(Math.abs(p.x),Math.abs(p.z))<288,defs,region,height,stations,monument,open,close,get records(){load();return records;},get panel(){return panel;},get near(){return near;}};
})();
