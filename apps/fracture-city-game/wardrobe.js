/* Wardrobe: the stylised figure everyone in the city wears.
   One builder for the player, online residents, the crowd and the cast.
   Chunky toon proportions; faces made of shapes (eyes that blink, a mouth
   that moves, makeup, brows); layered clothes: shirt, jacket, bottoms, under,
   boots; hardware: spikes, studs, chains, collars, pins, patches, neon;
   piercings and ink. Everything bakes into one mesh per bone with vertex
   colours and toon shading, plus a glow mesh only for neon parts.
   The bones and studio fields are the ones the rest of the game uses:
   torso, head, arms (elbows -> hand grip at -0.30), legs (knees), fingers. */
(function(){'use strict';
// ─── Looks ──────────────────────────────────────────────────────────────────
const DEFAULT_LOOK={skin:'#d29a72',eyes:'#4b6b8c',lips:'none',hair:'#ff2e88',hairTip:'#0e0d12',top2:'#0b0b0f',coat:'#1d1f26',pants:'#0b0b0f',boots2:'#0b0b0f',accent:'#e2c044',
 eyeShape:'sharp',brows:'straight',makeup:'liner',faceWidth:1,faceLength:1,jaw:1,nose:1,hairStyle:'mohawk',headgear:'none',top:'band-tee',outfit:'leather',bottoms:'ripped',legwear:'none',boots:'combat',
 extras:['studded-belt','chain'],piercings:'rings',tattoos:'bands',frame:'average',heightScale:1,shoulders:1};
const OPTIONS={eyeShape:['round','sharp','sleepy','wide'],brows:['straight','arched','slashed','heavy','none'],makeup:['none','liner','smoky','tears','bolt','glam','skull'],
 hairStyle:['buzz','crop','mohawk','liberty','fauxhawk','spiked','undercut','mullet','long','pigtails','bun','dreads','bald','wave'],headgear:['none','beanie','cap','bandana','hood','hat','helmet','visor','mask','crown'],
 top:['tee','band-tee','tank','mesh','turtleneck','none'],outfit:['none','leather','studded','denim-vest','bomber','hoodie','plaid','longcoat','tailored','biker','battle-vest','utility','patchwork'],
 bottoms:['skinny','ripped','plaid','cargo','kilt','shorts'],legwear:['none','fishnet','socks'],boots:['combat','creepers','high-tops','steel-toe','platform'],
 extras:['spikes','studded-belt','chain','collar','gloves','patches','pins','shades','neon'],piercings:['none','rings','studs','septum','lip','eyebrow','loaded'],tattoos:['none','bands','circuit','blackwork','sleeve','neck','face'],frame:['slim','average','broad','curvy']};
const RANGES={faceWidth:[.88,1.14],faceLength:[.9,1.1],jaw:[.8,1.2],nose:[.8,1.3],heightScale:[.85,1.15],shoulders:[.85,1.18],widthScale:[.85,1.2]};
const isColour=v=>typeof v==='number'||(typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v));
//  Old saves used outfit names that now mean something close.
const LEGACY={biker:'leather','battle-vest':'denim-vest',utility:'bomber',patchwork:'denim-vest',mesh:'none'};
function normalize(src){
 const l={...DEFAULT_LOOK};src=src||{};
 for(const k of Object.keys(DEFAULT_LOOK)){const v=src[k];if(v===undefined||v===null)continue;
  if(OPTIONS[k]){if(k==='extras'){if(Array.isArray(v))l.extras=[...new Set(v.filter(x=>OPTIONS.extras.includes(x)))].slice(0,9)}else if(OPTIONS[k].includes(v))l[k]=v}
  else if(RANGES[k]){const n=+v;if(Number.isFinite(n))l[k]=Math.max(RANGES[k][0],Math.min(RANGES[k][1],n))}
  else if(k==='lips'?(v==='none'||isColour(v)):isColour(v))l[k]=v}
 if(src.outfit==='mesh'&&!src.top)l.top='mesh';
 if(LEGACY[l.outfit])l.outfit=LEGACY[l.outfit];
 if(l.hairStyle==='wave')l.hairStyle='crop';
 if(src.build==='solid'&&!src.frame)l.frame='broad';if(src.build==='lean'&&!src.frame)l.frame='slim';
 if(Number.isFinite(+src.widthScale))l.widthScale=Math.max(.85,Math.min(1.2,+src.widthScale));
 return l;
}
// ─── The crowd: a city of scenes, not one uniform ───────────────────────────
const P={blacks:['#0b0b0f','#1d1f26','#141018'],neon:['#ff2e88','#39ff14','#00e5ff','#ffe500','#ff6a00','#b388ff'],earth:['#7a4b2a','#2e5e3a','#5b4a3a','#3a3d45','#6b1d1d'],office:['#3a3d45','#1d1f26','#7b7f88','#e9e5dc','#1d3b6b'],skin:['#f3d3bd','#e8b896','#d29a72','#b97a55','#8d5a3b','#6b412a','#4a2b1c','#2f1c13'],hairNat:['#0e0d12','#2a1d19','#5b3a24','#a8743a','#e9d7a6','#9a9a9a']};
const SCENES={
 punk:r=>({hairStyle:r.pick(['mohawk','liberty','spiked','fauxhawk','buzz','undercut']),hair:r.pick([...P.neon,'#0e0d12']),hairTip:r.pick(['#0e0d12',...P.neon]),outfit:r.pick(['leather','studded','denim-vest','denim-vest']),coat:r.pick(['#0b0b0f','#1d3b6b','#1d1f26']),top:r.pick(['band-tee','tank','tee']),top2:r.pick(P.blacks.concat(['#e9e5dc','#b3122e'])),bottoms:r.pick(['ripped','plaid','skinny','kilt']),pants:r.pick(['#0b0b0f','#b3122e','#1d1f26']),boots:r.pick(['combat','combat','creepers','steel-toe']),extras:r.sample(['spikes','studded-belt','chain','collar','patches','pins'],r.int(1,4)),piercings:r.pick(['rings','studs','septum','lip','loaded']),tattoos:r.pick(['bands','sleeve','blackwork','neck','circuit']),makeup:r.pick(['none','liner','none','tears']),accent:r.pick(['#e9e5dc','#e2c044','#c5cbd0'])}),
 goth:r=>({hairStyle:r.pick(['long','undercut','bun','spiked','crop']),hair:r.pick(['#0e0d12','#0e0d12','#4a2c6b','#f2f2f2']),hairTip:r.pick(['#0e0d12','#4a2c6b','#b3122e']),outfit:r.pick(['longcoat','leather','none']),coat:'#0b0b0f',top:r.pick(['turtleneck','mesh','tank']),top2:r.pick(['#0b0b0f','#4a2c6b','#6b1d1d']),bottoms:r.pick(['skinny','kilt','skinny']),pants:'#0b0b0f',legwear:r.pick(['none','fishnet']),boots:r.pick(['creepers','platform','combat']),extras:r.sample(['collar','gloves','chain','pins'],r.int(0,2)),makeup:r.pick(['smoky','liner','skull','smoky']),lips:r.pick(['#0b0b0f','#4a2c6b','#6b1d1d']),skin:r.pick(['#f3d3bd','#e8b896','#d29a72','#8d5a3b']),piercings:r.pick(['septum','eyebrow','rings','none']),accent:r.pick(['#7b7f88','#c5cbd0'])}),
 skater:r=>({hairStyle:r.pick(['mullet','crop','long','buzz','undercut']),hair:r.pick(P.hairNat),headgear:r.pick(['beanie','cap','none','none']),outfit:r.pick(['hoodie','plaid','bomber','none']),coat:r.pick(P.earth.concat(['#1d3b6b','#ff6a00'])),top:'tee',top2:r.pick(['#e9e5dc','#0b0b0f','#e2c044']),bottoms:r.pick(['cargo','shorts','skinny']),pants:r.pick(['#3a3d45','#7a4b2a','#1d3b6b']),legwear:r.pick(['socks','none']),boots:'high-tops',boots2:r.pick(['#e9e5dc','#0b0b0f','#b3122e']),extras:r.sample(['chain','pins'],r.int(0,1)),piercings:r.pick(['none','studs','rings']),tattoos:r.pick(['none','bands']),makeup:'none',accent:r.pick(P.neon)}),
 raver:r=>({hairStyle:r.pick(['spiked','pigtails','buzz','fauxhawk']),hair:r.pick(P.neon),hairTip:r.pick(P.neon),outfit:r.pick(['none','bomber']),coat:r.pick(P.neon),top:r.pick(['mesh','tank']),top2:r.pick(P.neon),bottoms:r.pick(['cargo','shorts']),pants:r.pick(['#4a2c6b','#0b0b0f','#1d3b6b']),legwear:r.pick(['fishnet','none','socks']),boots:r.pick(['platform','high-tops']),boots2:r.pick(P.neon.concat(['#0b0b0f'])),extras:['neon',...r.sample(['shades','gloves','pins'],r.int(0,2))],makeup:r.pick(['glam','bolt','glam']),piercings:r.pick(['eyebrow','studs','rings']),accent:r.pick(P.neon)}),
 work:r=>({hairStyle:r.pick(['buzz','crop','bun','long']),hair:r.pick(P.hairNat),headgear:r.pick(['cap','none','none','helmet','bandana']),outfit:r.pick(['bomber','hoodie','none']),coat:r.pick(['#ff6a00','#e2c044','#2e5e3a','#3a3d45','#1d3b6b']),top:r.pick(['tee','tank']),top2:r.pick(['#e9e5dc','#3a3d45','#7b7f88']),bottoms:'cargo',pants:r.pick(['#3a3d45','#5b4a3a','#1d3b6b']),boots:'steel-toe',boots2:r.pick(['#5b4a3a','#0b0b0f']),extras:r.sample(['gloves','chain'],r.int(0,1)),piercings:r.pick(['none','none','studs']),tattoos:r.pick(['none','bands','sleeve']),makeup:'none',accent:r.pick(['#e2c044','#ff6a00'])}),
 office:r=>({hairStyle:r.pick(['crop','bun','buzz','long']),hair:r.pick(P.hairNat),outfit:'tailored',coat:r.pick(['#3a3d45','#1d1f26','#7b7f88','#1d3b6b']),top:r.pick(['turtleneck','tee']),top2:r.pick(['#e9e5dc','#7b7f88']),bottoms:'skinny',pants:r.pick(['#1d1f26','#3a3d45']),boots:'steel-toe',boots2:'#1d1f26',extras:r.sample(['shades'],r.int(0,1)),piercings:'none',tattoos:'none',makeup:'none',brows:'straight',eyeShape:r.pick(['sleepy','round']),accent:r.pick(['#b3122e','#7b7f88','#1d3b6b'])}),
};
const SCENE_FOR={suit:['office','office','work'],clerk:['office','office','skater'],medic:['work','office'],courier:['skater','work','punk'],runner:['skater','raver'],vendor:['work','skater'],busker:['punk','goth','skater'],drifter:['punk','goth','work'],punk:['punk','punk','goth'],broadcaster:['raver','goth','office'],records:['punk','goth'],bar:['goth','punk','raver'],repair:['work'],laundry:['work','skater'],tea:['goth','office'],print:['punk','office']};
function rngOf(rng){return{pick:a=>a[Math.floor(rng.next()*a.length)],int:(a,b)=>a+Math.floor(rng.next()*(b-a+1)),sample:(a,n)=>{const c=[...a],o=[];while(n-->0&&c.length)o.push(c.splice(Math.floor(rng.next()*c.length),1)[0]);return o},next:()=>rng.next()}}
function crowdLook(arch,rng){
 const r=rngOf(rng),pool=SCENE_FOR[arch?.key]||['punk','goth','skater','raver','work','office','skater','work'],scene=r.pick(pool);
 const base={skin:r.pick(P.skin),eyes:r.pick(['#3b2a1e','#6b4a2b','#4b6b8c','#69776d','#9d8651']),eyeShape:r.pick(OPTIONS.eyeShape),brows:r.pick(['straight','arched','heavy','slashed']),faceWidth:.9+r.next()*.2,faceLength:.92+r.next()*.16,jaw:.85+r.next()*.3,nose:.85+r.next()*.4,frame:r.pick(['slim','average','average','broad','curvy']),heightScale:.92+r.next()*.16,shoulders:.92+r.next()*.2,lips:'none',legwear:'none',headgear:'none',hairTip:'',tattoos:'none',extras:[]};
 const l=normalize({...base,...SCENES[scene](r)});if(!l.hairTip||l.hairTip==='')l.hairTip=l.hair;l.scene=scene;return l;
}
// ─── Geometry ───────────────────────────────────────────────────────────────
const sphere=new THREE.SphereGeometry(1,10,7),cube=new THREE.BoxGeometry(1,1,1),cone=new THREE.ConeGeometry(1,1,6),dome=new THREE.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2),ring=new THREE.TorusGeometry(1,.22,4,10);
const ramp=(()=>{const d=new Uint8Array([70,70,70,255,150,150,150,255,215,215,215,255,255,255,255,255]);const t=new THREE.DataTexture(d,4,1,THREE.RGBAFormat);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t})();
const TOON=new THREE.MeshToonMaterial({vertexColors:true,gradientMap:ramp});
const GLOW=new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false});
function loft(rows,seg=12){const p=[],ix=[];for(const [y,rx,rz,cz=0]of rows)for(let j=0;j<=seg;j++){const a=j/seg*Math.PI*2;p.push(Math.sin(a)*rx,y,Math.cos(a)*rz+cz)}for(let i=0;i<rows.length-1;i++)for(let j=0;j<seg;j++){const a=i*(seg+1)+j,b=a+seg+1;ix.push(a,a+1,b,b,a+1,b+1)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g}
const C=new THREE.Color();
const hexOf=v=>C.set(v).getHex();
const shade=(v,n)=>C.set(v).multiplyScalar(n).getHex();
const mix=(a,b,t)=>new THREE.Color(a).lerp(new THREE.Color(b),t).getHex();
function bake(bone,parts){
 for(const glow of [false,true]){const list=parts.filter(p=>!!p.glow===glow);if(!list.length)continue;
  const pos=[],norm=[],col=[],idx=[];
  for(const p of list){const g=p.geo.clone();g.scale(...p.s);if(p.rx)g.rotateX(p.rx);if(p.ry)g.rotateY(p.ry);if(p.r)g.rotateZ(p.r);g.translate(...p.p);
   const off=pos.length/3,a=g.attributes.position.array,n=g.attributes.normal.array,c=new THREE.Color(p.c);
   if(g.index)for(const v of g.index.array)idx.push(v+off);else for(let i=0;i<a.length/3;i++)idx.push(i+off);
   for(let i=0;i<a.length;i+=3){pos.push(a[i],a[i+1],a[i+2]);norm.push(n[i],n[i+1],n[i+2]);col.push(c.r,c.g,c.b)}g.dispose()}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);
  const m=new THREE.Mesh(g,glow?GLOW:TOON);m.castShadow=!glow;m.receiveShadow=!glow;m.userData.residentGeometry=true;bone.add(m)}
}
const FRAMES={slim:{sh:.92,chest:.158,waist:.136,hip:.15,bust:0},average:{sh:1,chest:.172,waist:.15,hip:.162,bust:0},broad:{sh:1.12,chest:.198,waist:.176,hip:.176,bust:0},curvy:{sh:.95,chest:.17,waist:.142,hip:.192,bust:1}};
const METAL=0xc5cbd0,INK=0x1b1e2a,DARK=0x121318;
function build(L,meta){
 const root=new THREE.Group(),buckets=new Map(),owned=[];
 const fr=FRAMES[L.frame]||FRAMES.average,fw=L.faceWidth,fl=L.faceLength,lift=L.boots==='platform'?.07:0;
 const inner=new THREE.Group();inner.position.y=lift;root.add(inner);
 const bone=(parent,x,y,z)=>{const b=new THREE.Group();b.position.set(x,y,z);parent.add(b);buckets.set(b,[]);return b};
 const put=(b,geo,p,s,c,o={})=>buckets.get(b).push({geo,p,s,c:hexOf(c),...o});
 const ell=(b,x,y,z,sx,sy,sz,c,o)=>put(b,sphere,[x,y,z],[sx,sy,sz],c,o);
 const box=(b,x,y,z,sx,sy,sz,c,o)=>put(b,cube,[x,y,z],[sx,sy,sz],c,o);
 const spike=(b,x,y,z,r,h,c,o)=>put(b,cone,[x,y,z],[r,h,r],c,o);
 const shape=(b,rows,c,seg=12,o)=>{const g=loft(rows,seg);owned.push(g);put(b,g,[0,0,0],[1,1,1],c,o)};
 const skin=L.makeup==='skull'?'#e9e5dc':L.skin,glowOn=L.extras.includes('neon');
 const torso=new THREE.Group();torso.position.y=1.43;inner.add(torso);
 const body=bone(torso,0,-1.43,0),head=bone(torso,0,.075,0);head.scale.setScalar(1.12);
 const shoulderX=.235*fr.sh*L.shoulders;
 const la=bone(torso,-shoulderX,0,0),ra=bone(torso,shoulderX,0,0);
 const hipX=.105*(fr.hip/.162);
 const ll=bone(inner,-hipX,.9,0),rl=bone(inner,hipX,.9,0);
 const elbows=[],knees=[],fingers=[];
 // ── Torso, shirt and jacket ──
 const ch=fr.chest,wa=fr.waist,hp=fr.hip;
 const torsoRows=k=>[[.95,hp+k,.105+k*.7],[1.02,wa+.004+k,.1+k*.7],[1.12,wa+k,.098+k*.7],[1.27,ch+k,.118+k*.7],[1.39,ch+.03+k,.112+k*.7],[1.45,ch-.02+k,.09+k*.7],[1.49,.075,.066]];
 const topCol=L.top==='none'||L.top==='mesh'?skin:L.top2;
 shape(body,torsoRows(0),topCol,14);
 if(fr.bust)for(const s of[-1,1])ell(body,s*.058,1.3,.078,.06,.05,.05,L.top==='none'?(L.outfit==='none'?L.top2:skin):topCol);
 if(L.top==='none'&&fr.bust&&L.outfit==='none')shape(body,[[1.22,ch+.006,.124],[1.34,ch+.032,.125]],L.top2,14);
 if(L.top==='mesh'){for(let i=0;i<9;i++)box(body,(i-4)*.04,1.22,.12+Math.cos((i-4)*.18)*.0,.006,.48,.006,L.top2);for(let j=0;j<6;j++)ell(body,0,1.02+j*.08,0,ch+.004,.004,.118,L.top2)}
 if(L.top==='band-tee'){box(body,0,1.3,.128,.14,.11,.008,L.accent);for(let i=0;i<3;i++)box(body,(i-1)*.04,1.3,.133,.026,.05,.004,L.top2);box(body,0,1.36,.134,.1,.012,.004,L.top2)}
 if(L.top==='turtleneck')shape(body,[[1.46,.08,.072],[1.56,.066,.06]],L.top2);
 if(L.top==='tank')for(const s of[-1,1])box(body,s*.09,1.43,.03,.03,.1,.2,L.top2);
 // pelvis in the bottoms colour
 shape(body,[[.82,hp-.004,.11],[.9,hp+.012,.118],[.96,hp+.004,.108]],L.pants,14);
 const sleeves=!['none','denim-vest'].includes(L.outfit),jacket=L.outfit!=='none';
 if(jacket){
  const coat=L.coat;shape(body,torsoRows(.014).slice(0,6),coat,14);
  const open=['leather','studded','plaid','longcoat','tailored','denim-vest'].includes(L.outfit);
  if(open){box(body,0,1.2,.124+(ch-.15)*.6,.062,.42,.01,topCol);if(L.top==='band-tee')box(body,0,1.3,.135+(ch-.15)*.6,.05,.1,.006,L.accent)}
  if(['leather','studded','tailored'].includes(L.outfit))for(const s of[-1,1])box(body,s*.07,1.37,.13+(ch-.15)*.6,.06,.17,.012,shade(coat,1.25),{r:s*.38});
  if(L.outfit==='leather'||L.outfit==='studded'){box(body,.038,1.2,.13+(ch-.15)*.6,.006,.36,.006,METAL);box(body,0,1.0,.118,.34,.03,.012,shade(coat,.8))}
  if(L.outfit==='studded')for(const s of[-1,1]){for(let i=0;i<5;i++)ell(body,s*(.05+i*.032),1.44-i*.006,.07-i*.004,.009,.009,.009,METAL);for(let i=0;i<4;i++)ell(body,s*.09,1.36-i*.05,.142,.008,.008,.008,METAL)}
  if(L.outfit==='denim-vest'){for(const s of[-1,1])box(body,s*.09,1.33,.13,.07,.22,.01,shade(coat,1.15),{r:s*.2});box(body,0,1.25,-.125,.2,.18,.01,shade(coat,1.2))}
  if(L.outfit==='bomber'){shape(body,[[.98,wa+.022,.12],[1.03,wa+.02,.118]],shade(coat,.75));shape(body,[[1.44,.09,.08],[1.5,.08,.074]],shade(coat,.75));box(body,0,1.22,.135,.006,.4,.006,METAL)}
  if(L.outfit==='hoodie'){ell(body,0,1.5,-.085,.13,.1,.08,coat);box(body,0,1.1,.133,.16,.09,.012,shade(coat,.85));for(const s of[-1,1])box(body,s*.03,1.36,.136,.005,.09,.005,L.accent)}
  if(L.outfit==='plaid'){const rr=y=>y<1.2?wa+.018+(y-1.02)*(ch-wa)/.25:ch+.02;for(let i=0;i<5;i++){const y=1.06+i*.085;ell(body,0,y,0,rr(y),.005,.124+(rr(y)-.15)*.6,shade(coat,.45))}for(const z of[-1,1])for(let i=0;i<5;i++)box(body,(i-2)*.055,1.22,z*(.122+(ch-.15)*.6),.008,.42,.006,shade(coat,.45))}
  if(L.outfit==='longcoat'){shape(body,[[.48,hp+.06,.15],[.7,hp+.04,.14],[.9,hp+.03,.13],[1.0,wa+.03,.12]],coat,14);box(body,0,.74,.15,.008,.5,.008,shade(coat,.5))}
  if(L.outfit==='tailored'){box(body,0,1.24,.134+(ch-.15)*.6,.022,.24,.006,L.accent);for(let i=0;i<2;i++)ell(body,.05,1.1+i*.07,.13,.007,.007,.005,DARK)}
  if(glowOn){for(const s of[-1,1])box(body,s*.035,1.2,.136+(ch-.15)*.6,.006,.44,.006,L.accent,{glow:true});box(body,0,1.0,.125,.34,.008,.006,L.accent,{glow:true})}
 }
 if(L.extras.includes('studded-belt')||L.extras.includes('chain')){box(body,0,.965,.11,(hp+.012)*2.05,.03,.02,DARK);box(body,0,.965,.124,.04,.03,.008,METAL);if(L.extras.includes('studded-belt'))for(let i=0;i<9;i++)ell(body,(i-4)*.034,.965,.121,.006,.006,.006,METAL)}
 if(L.extras.includes('chain'))for(let i=0;i<9;i++){const t=i/8;ell(body,.06+t*.08,.95-Math.sin(t*Math.PI)*.12,.12-t*.16,.007,.007,.007,METAL)}
 if(L.extras.includes('patches')&&jacket){const cols=['#b3122e','#e2c044','#e9e5dc','#39ff14','#1d3b6b'];[[.1,1.33,.13],[-.11,1.12,.125],[0,1.3,-.128],[.06,1.08,-.122]].forEach(([x,y,z],i)=>box(body,x,y,z,.06,.05,.008,cols[(i+(meta.seed||0))%cols.length]))}
 if(L.extras.includes('pins'))['#e2c044','#ff2e88','#e9e5dc','#00e5ff'].forEach((c,i)=>ell(body,-.06-(i%2)*.035,1.36-Math.floor(i/2)*.04,.142,.012,.012,.004,c));
 if(L.extras.includes('collar')){ell(body,0,1.495,0,.08,.016,.073,DARK);for(let i=0;i<7;i++){const a=(i-3)*.32;spike(body,Math.sin(a)*.082,1.495,Math.cos(a)*.075,.007,.025,METAL)}}
 // neck
 shape(body,[[1.46,.062,.056],[1.57,.054,.05]],skin);
 if(L.tattoos==='neck')for(const s of[-1,1])box(body,s*.045,1.52,.03,.012,.06,.04,INK,{r:s*.3});
 // ── Arms ──
 const upperCol=sleeves?L.coat:(['tee','band-tee','turtleneck'].includes(L.top)?L.top2:skin),foreCol=sleeves?L.coat:(L.top==='turtleneck'?L.top2:skin);
 for(const [arm,side] of [[la,-1],[ra,1]]){
  shape(arm,[[-.30,.048,.052],[-.22,.056,.06],[-.1,.068,.07],[-.02,.074,.07],[.045,.04,.04]],upperCol);
  if(!sleeves&&['tee','band-tee'].includes(L.top))shape(arm,[[-.3,.048,.052],[-.16,.062,.066]],skin);
  if(L.extras.includes('spikes'))for(let i=0;i<3;i++)spike(arm,side*.02,.06,-.03+i*.03,.012,.06,METAL,{r:-side*.5});
  const fore=bone(arm,0,-.285,0);elbows.push(fore);
  shape(fore,[[-.25,.04,.042],[-.2,.045,.047],[-.1,.054,.056],[0,.052,.054]],foreCol);
  if(sleeves)shape(fore,[[-.25,.047,.049],[-.22,.047,.049]],shade(L.coat,.7));
  if(foreCol===skin&&L.tattoos!=='none'&&L.tattoos!=='neck'&&L.tattoos!=='face'){
   if(L.tattoos==='sleeve')for(let i=0;i<7;i++)ell(fore,0,-.03-i*.03,0,.056-i*.0015,.009,.058-i*.0015,i%2?INK:shade(INK,1.6));
   else for(let i=0;i<5;i++){const y=-.05-i*.035;if(L.tattoos==='bands')ell(fore,0,y,0,.056,.006,.058,INK);else box(fore,0,y,.054,.06,L.tattoos==='blackwork'?.024:.008,.006,INK,{r:L.tattoos==='circuit'?(i%2?.45:-.45):0})}
  }
  if(glowOn&&sleeves)shape(fore,[[-.215,.049,.051],[-.205,.049,.051]],L.accent,12,{glow:true});
  const gloves=L.extras.includes('gloves');
  ell(fore,0,-.29,.006,.038,.05,.026,gloves?DARK:skin);ell(fore,-side*.04,-.272,.02,.016,.032,.018,gloves?DARK:skin,{r:-side*.4});
  const digits=bone(fore,0,-.322,.01);fingers.push(digits);
  for(let i=0;i<4;i++)ell(digits,(i-1.5)*.018,-.022,0,.01,.03-(Math.abs(i-1.5)*.005),.012,skin);
 }
 // ── Legs and boots ──
 const shorts=L.bottoms==='shorts',kilt=L.bottoms==='kilt',bareLeg=L.legwear==='fishnet'?mix(skin,DARK,.35):skin;
 const legW=L.bottoms==='cargo'?1.12:1;
 for(const [leg,side] of [[ll,-1],[rl,1]]){
  shape(leg,[[-.43,.06*legW,.064*legW],[-.34,.07*legW,.076*legW],[-.19,.083*legW,.088*legW],[-.02,.09*legW,.097*legW],[.05,.072,.082]],kilt?bareLeg:L.pants);
  if(shorts)shape(leg,[[-.43,.058,.062],[-.26,.074,.08]],bareLeg);
  if(L.bottoms==='ripped')for(const [y,z,w]of[[-.32,.07,.05],[-.14,.086,.035]])box(leg,side*.01,y,z,w,.016,.012,skin);
  if(L.bottoms==='cargo')box(leg,side*.088,-.2,0,.02,.1,.07,shade(L.pants,.8));
  if(L.bottoms==='plaid'){for(let i=0;i<4;i++)ell(leg,0,-.04-i*.1,0,.092-i*.006,.005,.1-i*.006,shade(L.accent,.8));box(leg,0,-.2,.094,.006,.4,.006,shade(L.pants,.5))}
  const shin=bone(leg,0,-.43,0);knees.push(shin);
  const shinCol=(shorts||kilt)?bareLeg:L.pants;
  shape(shin,[[-.36,.052*legW,.058*legW],[-.27,.056*legW,.066*legW],[-.15,.064*legW,.074*legW],[0,.062*legW,.068*legW]],shinCol);
  if(L.legwear==='fishnet'&&(shorts||kilt))for(let i=0;i<6;i++)ell(shin,0,-.04-i*.055,0,.064,.004,.07,DARK);
  if(L.legwear==='socks')shape(shin,[[-.36,.055,.06],[-.25,.058,.064]],'#e9e5dc');
  if(L.bottoms==='ripped')box(shin,side*.005,-.1,.068,.045,.014,.01,skin);
  // boots
  const bc=L.boots2,sole=L.boots==='creepers'?'#c9a46b':L.boots==='high-tops'?'#e9e5dc':DARK,soleH={creepers:.05,platform:.12,'high-tops':.03}[L.boots]||.035;
  const bootTop=L.boots==='high-tops'?-.3:L.boots==='creepers'?-.37:L.boots==='platform'?-.12:-.22;
  shape(shin,[[-.405,.062,.072,.02],[-.36,.06,.068],[bootTop,.062,.07]],bc);
  ell(shin,0,-.4,.065,.066,.052,.13,bc);
  box(shin,0,-.44-soleH/2+.01,.055,.14,soleH,.27,sole);
  if(L.boots==='combat'||L.boots==='steel-toe'||L.boots==='platform')for(let i=0;i<4;i++)box(shin,0,-.37+i*.04,.07,.06,.006,.008,shade(bc,1.9));
  if(L.boots==='steel-toe')ell(shin,0,-.405,.145,.06,.04,.05,0x8a9098);
  if(L.boots==='high-tops')ell(shin,0,-.41,.15,.058,.035,.045,'#e9e5dc');
  if(glowOn)box(shin,0,-.44+.01,.055,.142,.008,.272,L.accent,{glow:true});
 }
 if(kilt){shape(body,[[.62,hp+.06,.16],[.8,hp+.03,.13],[.96,hp+.005,.11]],L.pants,14);for(let i=0;i<3;i++)ell(body,0,.66+i*.1,0,hp+.058-i*.01,.004,.158-i*.01,shade(L.accent,.8))}
 // ── Head ──
 const H=.165,jaw=L.jaw;
 const headRows=[[-.125,.048,.058],[-.1,.086*jaw,.094],[-.06,.112*Math.min(1.1,jaw),.114],[-.01,.124,.123],[.05,.127,.123],[.1,.114,.111],[.14,.084,.084],[.165,.042,.046],[.176,.005,.006]].map(([y,rx,rz])=>[H+y*fl,rx*fw,rz]);
 shape(head,headRows,skin,14);
 ell(head,0,H-.02*fl,.124,.018*L.nose,.026,.022*L.nose,shade(skin,.94));
 for(const s of[-1,1])ell(head,s*.126*fw,H,-.004,.02,.036,.028,shade(skin,.96));
 if(L.makeup==='skull'){ell(head,0,H-.03*fl,.132,.012,.01,.008,DARK);for(let i=0;i<5;i++)box(head,(i-2)*.012,H-.068*fl,.112,.003,.022,.004,DARK)}
 if(L.tattoos==='face'){box(head,.075*fw,H-.035*fl,.104,.008,.022,.004,INK,{r:.4});ell(head,.072*fw,H-.06*fl,.1,.007,.01,.004,INK)}
 // eyes blink as their own group; brows and makeup stay on the head
 const eyes=bone(head,0,H+.02*fl,0),eyeY=0;
 const ew={round:[.024,.024],sharp:[.028,.016],sleepy:[.027,.013],wide:[.031,.028]}[L.eyeShape]||[.026,.02];
 for(const s of[-1,1]){const x=s*.046*fw;
  if(L.makeup==='smoky'||L.makeup==='skull')ell(head,x,H+.02*fl,.112,.042,L.makeup==='skull'?.04:.032,.01,L.makeup==='skull'?DARK:'#2a1f2e');
  ell(eyes,x,eyeY,.115,ew[0],ew[1],.012,'#f4f1ea',{r:L.eyeShape==='sharp'?-s*.18:0});
  ell(eyes,x,eyeY-.001,.125,.012,Math.min(.012,ew[1]*.75),.005,L.eyes);
  ell(eyes,x,eyeY-.001,.129,.0055,Math.min(.0055,ew[1]*.4),.003,'#0b0b0f');
  ell(eyes,x+s*-.004,eyeY+.004,.131,.0026,.0026,.002,'#ffffff');
  if(L.eyeShape==='sleepy')box(eyes,x,eyeY+ew[1]*.55,.123,ew[0]*2.1,.008,.01,shade(skin,.88));
  if(L.makeup==='liner'||L.makeup==='glam'||L.makeup==='bolt'){box(head,x,H+.02*fl-ew[1]*.85,.122,ew[0]*1.9,.004,.006,DARK);box(head,x+s*ew[0]*1.05,H+.02*fl+.002,.12,.022,.004,.006,DARK,{r:s*.5})}
  if(L.makeup==='glam')ell(head,x,H+.02*fl+ew[1]+.004,.118,ew[0]*1.1,.008,.006,L.accent);
  // brows
  const by=H+.02*fl+ew[1]+.018,bc=L.hairStyle==='bald'||L.hairStyle==='buzz'?'#2a1d19':L.hair;
  if(L.brows==='straight')box(head,x,by,.122,.044,.008,.01,bc);
  if(L.brows==='heavy')box(head,x,by,.122,.048,.014,.012,bc,{r:s*.08});
  if(L.brows==='arched'){box(head,x-s*.012,by,.122,.026,.007,.01,bc,{r:s*.25});box(head,x+s*.014,by+.002,.12,.02,.007,.01,bc,{r:-s*.35})}
  if(L.brows==='slashed'){box(head,x-s*.016,by,.122,.018,.008,.01,bc);box(head,x+s*.017,by,.122,.012,.008,.01,bc)}
 }
 if(L.makeup==='tears')for(let i=0;i<2;i++)ell(head,.046*fw,H-.012*fl-i*.018,.121,.004,.007,.004,DARK);
 if(L.makeup==='bolt'){[[0,0,.6],[.012,-.02,-.4],[.002,-.04,.6]].forEach(([dx,dy,r])=>box(head,-.05*fw+dx,H+.045*fl+dy,.124,.007,.03,.006,L.accent,{r}))}
 if(L.makeup==='glam')for(let i=0;i<4;i++)ell(head,(i%2?1:-1)*(.07+i*.004)*fw,H-.012*fl-i*.006,.118,.003,.003,.003,L.accent,{glow:true});
 // mouth moves when talking
 const mouth=bone(head,0,H-.062*fl,0);
 const lipCol=L.lips&&L.lips!=='none'?L.lips:shade(skin,.72);
 box(mouth,0,0,.111,.04,L.lips&&L.lips!=='none'?.012:.006,.01,lipCol);
 if(L.lips&&L.lips!=='none')box(mouth,0,-.008,.109,.032,.008,.01,shade(lipCol,.85));
 // piercings
 const pier=L.piercings,metal=METAL;
 if(['rings','loaded'].includes(pier))for(const s of[-1,1])for(let i=0;i<(pier==='loaded'?3:1);i++)put(head,ring,[s*.13*fw,H-.025-i*.012,.004],[.008,.008,.008],metal,{ry:Math.PI/2});
 if(['studs','loaded'].includes(pier))for(const s of[-1,1])ell(head,s*.13*fw,H-.012,.016,.005,.005,.005,metal);
 if(['septum','loaded'].includes(pier))put(head,ring,[0,H-.044*fl,.133],[.008,.008,.008],metal);
 if(['lip','loaded'].includes(pier))put(head,ring,[.016,H-.07*fl,.114],[.007,.007,.007],metal);
 if(['eyebrow','loaded'].includes(pier))for(let i=0;i<2;i++)ell(head,.06*fw,H+.058*fl-i*.012,.118,.004,.004,.004,metal);
 // hair
 const hs=L.hairStyle,hc=L.hair,tip=L.hairTip||hc,hg=L.headgear,covered=['beanie','helmet','hood','hat'].includes(hg);
 const cap=(sy=1,sc=1,c=hc,back=true)=>{put(head,dome,[0,H+.068*fl,-.006],[.142*fw*sc,.125*fl*sy,.146*sc],c);if(back)ell(head,0,H+.02*fl,-.048,.134*fw*sc,.152*fl,.104*sc,c)};
 const spikeAt=(x,y,z,len,rz,rx,fin)=>{const w=fin?[.012,.05]:[.026,.026];put(head,cone,[x,y,z],[w[0],len,w[1]],hc,{r:rz,rx});if(tip!==hc)put(head,cone,[x+Math.sin(-rz)*len*.4,y+Math.cos(rz)*Math.cos(rx||0)*len*.4,z+Math.sin(rx||0)*len*.4],[w[0]*.45,len*.22,w[1]*.45],tip,{r:rz,rx})};
 if(hs!=='bald'&&!covered){
  if(['buzz','mohawk','liberty'].includes(hs))cap(.8,.97,hs==='buzz'?hc:shade(hc,.45));
  else if(hs==='undercut'){cap(1,1,shade(hc,.4));put(head,dome,[0,H+.1*fl,-.01],[.138*fw,.11*fl,.14],hc)}
  else cap();
  if(hs==='crop')box(head,0,H+.105*fl,.1,.15*fw,.03,.04,hc,{rx:.3});
  if(hs==='mohawk'){ell(head,0,H+.15*fl,-.02,.03,.05,.15,hc);for(let i=0;i<6;i++)spikeAt(0,H+.22*fl-Math.abs(i-2)*.012,.11-i*.048,.2-Math.abs(i-2)*.018,0,-.42+i*.17,true)}
  if(hs==='liberty')for(let i=0;i<11;i++){const a=(i/10-.5)*2.6;spikeAt(Math.sin(a)*.115*fw,H+.2*fl,Math.cos(a)*.06-.03,.26,-Math.sin(a)*.95,-.25)}
  if(hs==='fauxhawk')for(let i=0;i<3;i++)spikeAt(0,H+.16*fl,.07-i*.045,.09,0,.2-i*.1,true);
  if(hs==='spiked')for(let i=0;i<9;i++){const a=i/9*Math.PI*2;spikeAt(Math.sin(a)*.075*fw,H+.2*fl,Math.cos(a)*.065-.01,.13,-Math.sin(a)*.6,Math.cos(a)*.45)}
  if(hs==='undercut'){ell(head,.05*fw,H+.12*fl,.06,.1,.035,.08,hc,{r:-.3});ell(head,.09*fw,H+.07*fl,.09,.04,.06,.03,tip)}
  if(hs==='mullet'){ell(head,0,H-.07,-.1,.09,.12,.05,hc);ell(head,0,H-.17,-.1,.06,.04,.035,tip)}
  if(hs==='long')for(const s of[-1,1]){ell(head,s*.105*fw,H-.06,-.03,.04,.16,.08,hc,{r:s*.06});ell(head,s*.1*fw,H-.2,-.04,.032,.04,.06,tip)}
  if(hs==='long')ell(head,0,H-.07,-.1,.1,.16,.05,hc);
  if(hs==='pigtails')for(const s of[-1,1]){ell(head,s*.15*fw,H+.03,-.04,.045,.085,.045,hc,{r:s*.5});ell(head,s*.19*fw,H-.04,-.05,.025,.035,.025,tip);ell(head,s*.125*fw,H+.07,-.03,.016,.016,.016,L.accent)}
  if(hs==='bun')ell(head,0,H+.15*fl,-.09,.06,.055,.055,hc);
  if(hs==='dreads')for(let i=0;i<12;i++){const a=(i/11-.5)*3.6;ell(head,Math.sin(a)*.115*fw,H-.08,Math.cos(a)*.09-.03,.016,.15,.016,i%3?hc:tip)}
 }
 if(covered&&['long','dreads','pigtails','mullet'].includes(hs)){for(const s of[-1,1])ell(head,s*.105*fw,H-.08,-.04,.036,.12,.07,hc);}
 if(hg==='beanie'){put(head,dome,[0,H+.048*fl,-.01],[.142*fw,.19*fl,.144],L.coat==='#0b0b0f'?L.accent:L.coat);shape(head,[[H+.05,.143*fw,.145],[H+.085,.144*fw,.146]],shade(L.coat==='#0b0b0f'?L.accent:L.coat,.75),14)}
 if(hg==='cap'){put(head,dome,[0,H+.04,-.01],[.138*fw,.16*fl,.14],L.accent);box(head,0,H+.05,.15,.15,.012,.1,shade(L.accent,.8))}
 if(hg==='bandana'){shape(head,[[H+.07,.13*fw,.129],[H+.1,.128*fw,.126]],L.accent,14);ell(head,0,H+.08,-.13,.03,.03,.02,L.accent)}
 if(hg==='hood')ell(head,0,H+.02,-.035,.165*fw,.19*fl,.165,L.coat);
 if(hg==='hat'){shape(head,[[H+.07,.14*fw,.14],[H+.2,.13*fw,.13],[H+.21,.0,.0]],DARK,14);ell(head,0,H+.08,0,.24*fw,.012,.24,DARK)}
 if(hg==='helmet'){put(head,dome,[0,H+.055*fl,-.01],[.15*fw,.15*fl,.155],'#454c59');ell(head,0,H+.02,-.06,.14*fw,.12,.1,'#454c59')}
 if(hg==='visor')box(head,0,H+.02*fl,.125,.24*fw,.034,.02,L.accent,{glow:true});
 if(hg==='mask')ell(head,0,H-.055*fl,.08,.1*fw,.06,.06,DARK);
 if(hg==='crown'){shape(head,[[H+.11,.095*fw,.095],[H+.15,.098*fw,.098]],'#e2c044',14);for(let i=0;i<5;i++){const a=(i-2)*.5;spike(head,Math.sin(a)*.095*fw,H+.18,Math.cos(a)*.095,.014,.05,'#e2c044')}}
 if(L.extras.includes('shades'))box(head,0,H+.02*fl,.13,.13*fw,.028,.012,DARK);
 // bake
 for(const [b,p]of buckets)if(p.length)bake(b,p);
 //  A bone's own mesh comes first, before child bones (eyes, mouth, forearm).
 for(const b of buckets.keys())b.children.sort((x,y)=>(y.isMesh?1:0)-(x.isMesh?1:0));
 owned.forEach(g=>g.dispose());
 //  Stand exactly on the ground whatever the soles: lowest point 2 mm up.
 inner.position.y=0;inner.updateMatrixWorld(true);//  physical-support.js treats 0.46 m below the knee as the sole; honour both.
 //  Like the old figure, keep that point 1.5 cm up so idle sway never dips it.
 const low=new THREE.Box3().setFromObject(inner).min.y;inner.position.y=Math.max(.002-low,.015-(.9-.43-.46));
 return{root,torso,head,eyes,mouth,la,ra,ll,rl,elbows,knees,fingers,lift:inner.position.y};
}
// ─── Hooking into the game ──────────────────────────────────────────────────
let figureConfig=null;
//  Callers such as enemies pass colours and a few pieces directly (an
//  infected zombie's grey skin and torn coat); those win over the crowd look.
const hexStr=v=>typeof v==='number'?'#'+v.toString(16).padStart(6,'0'):v;
function overlay(look,cfg){
 if(!cfg)return look;const out={...look};
 for(const k of ['skin','hair','coat','pants','accent'])if(cfg[k]!==undefined&&cfg[k]!==null)out[k]=hexStr(cfg[k]);
 for(const k of ['hairStyle','headgear','outfit'])if(cfg[k])out[k]=cfg[k];
 const n=normalize(out);n.scene=look.scene;return n;
}
const base=shBuildCharacter;
window.shBuildCharacter=function(arch,rng,cfg){
 const explicit=figureConfig||null;
 const look=explicit?normalize(explicit):cfg?.look?normalize(cfg.look):overlay(crowdLook(arch,rng),cfg);
 const pass=Object.assign({},cfg||{},{skin:hexOf(look.skin),hair:hexOf(look.hair),coat:hexOf(look.coat),accent:hexOf(look.accent),pants:hexOf(look.pants),hairStyle:look.hairStyle,headgear:look.headgear});
 window.FC_FIGURE_LITE=true;let c;try{c=base.call(this,arch,rng,pass)}finally{window.FC_FIGURE_LITE=false}
 //  Keep the base's nameplate, light and metadata; replace its body.
 const old=c.group;old.remove(c.plate);if(c.aura)old.remove(c.aura);old.traverse(o=>{if(o.isMesh)o.geometry?.dispose()});
 const f=build(look,{seed:Math.floor(rng.next()*1e6)});
 const width=Math.max(.8,Math.min(1.25,(look.widthScale||(explicit?.widthScale)||1)*(arch?.build&&!explicit?Math.max(.92,Math.min(1.08,arch.build)):1)));
 const height=Math.max(.85,Math.min(1.15,look.heightScale*(arch?.height&&!explicit?Math.max(.95,Math.min(1.05,arch.height)):1)));
 f.root.scale.set(width,height,1);f.root.add(c.plate);if(c.aura)f.root.add(c.aura);c.plate.position.y=2.12;
 Object.assign(c,{group:f.root,head:f.head,leftArm:f.la,rightArm:f.ra,leftLeg:f.ll,rightLeg:f.rl,look,
  studio:{torso:f.torso,faceOffset:.165,outfit:look.outfit,tattoos:look.tattoos,piercings:look.piercings,elbows:f.elbows,knees:f.knees,fingers:f.fingers,height:(1.84+f.lift)*height,eyes:f.eyes,mouth:f.mouth,blinkAt:1+rng.next()*4}});
 c.gait.bob=.012;c.headTilt=c.headTilt||0;return c;
};
const figure=shBuildFigure;
window.shBuildFigure=function(cfg){const prev=figureConfig;figureConfig=cfg||{};try{return figure.apply(this,arguments)}finally{figureConfig=prev}};
const animate=shAnimateCharacter;
window.shAnimateCharacter=function(c,dt,moving,t){animate.apply(this,arguments);const s=c.studio;if(!s||!s.eyes)return;
 c.leftArm.rotation.z=.07;c.rightArm.rotation.z=-.07;
 s.elbows.forEach(e=>e.rotation.x=-.12);
 s.knees.forEach((k,i)=>k.rotation.x=moving?Math.max(0,Math.sin(c.gait.phase+i*Math.PI))*.5:0);
 //  Blinks, and a mouth that moves while this person is talking.
 const now=t||performance.now()/1000;
 if(now>s.blinkAt){const k=(now-s.blinkAt)/.13;s.eyes.scale.y=k<1?Math.max(.1,Math.abs(1-2*k)):1;if(k>=1)s.blinkAt=now+2+Math.random()*4.5}
 s.mouth.scale.y=c.talking?1+Math.abs(Math.sin(now*14))*1.8:1;
 if(!moving)s.torso.rotation.z=Math.sin(now*.9+c.gait.phase)*.018;
};
//  The person you are talking to moves their mouth until the conversation ends.
const talkers=new Set();
if(typeof shTalkTo==='function'){const talk=shTalkTo;window.shTalkTo=function(person){const r=talk.apply(this,arguments);const c=person?.char;if(c&&State.ui.inDialogue){c.talking=true;talkers.add(c)}return r}}
if(typeof shEndDialogue==='function'){const end=shEndDialogue;window.shEndDialogue=function(){const r=end.apply(this,arguments);for(const c of talkers)c.talking=false;talkers.clear();return r}}
window.FCWardrobe={DEFAULT_LOOK,OPTIONS,RANGES,normalize,crowdLook,build,get current(){return normalize(Shift.avatar)}};
//  New and old saves both work: missing fields take the defaults.
Object.assign(SH_DEFAULT_AVATAR,DEFAULT_LOOK);
for(const k of Object.keys(DEFAULT_LOOK))if(Shift.avatar[k]===undefined)Shift.avatar[k]=Array.isArray(DEFAULT_LOOK[k])?[...DEFAULT_LOOK[k]]:DEFAULT_LOOK[k];
})();
