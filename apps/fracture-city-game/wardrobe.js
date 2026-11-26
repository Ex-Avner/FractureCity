/* Wardrobe: the stylised figure everyone in the city wears.
   One builder for the player, online residents, the crowd and the cast.
   Fashion illustration proportions; faces made of shapes (eyes that blink, a mouth
   that moves, makeup, brows); layered clothes: shirt, jacket, bottoms, under,
   boots; hardware: spikes, studs, chains, collars, pins, patches, neon;
   piercings and ink. Everything bakes into one mesh per bone with vertex
   colours and physically lit shading, plus a glow mesh only for neon parts.
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
// Art-directed identities use existing wardrobe values: old saves and online
// validation remain compatible. These are visual families, not new NPC jobs.
const SIGNATURES={
 courier:{outfit:'leather',coat:'#202e3d',top:'turtleneck',top2:'#101b26',pants:'#19232e',boots2:'#20252c',accent:'#f57742',hair:'#d8e3df',hairTip:'#d8e3df',hairStyle:'undercut',headgear:'none',bottoms:'skinny',boots:'combat',extras:['gloves','chain'],eyeShape:'sharp',makeup:'liner',frame:'slim'},
 salvage:{outfit:'bomber',coat:'#b96935',top:'tee',top2:'#252c30',pants:'#343b3b',boots2:'#252b2d',accent:'#e5cc89',hair:'#24292c',hairTip:'#24292c',hairStyle:'buzz',headgear:'visor',bottoms:'cargo',boots:'steel-toe',extras:['gloves'],eyeShape:'sleepy',makeup:'none',frame:'broad'},
 archive:{outfit:'longcoat',coat:'#303344',top:'turtleneck',top2:'#c2b9a3',pants:'#212431',boots2:'#202431',accent:'#c7a86d',hair:'#ece5cc',hairTip:'#ece5cc',hairStyle:'long',headgear:'none',bottoms:'skinny',boots:'combat',extras:['collar'],eyeShape:'sharp',makeup:'smoky',frame:'slim'},
 prism:{outfit:'studded',coat:'#d0d5cf',top:'tank',top2:'#343043',pants:'#343043',boots2:'#d0d5cf',accent:'#b68cff',hair:'#8b77b6',hairTip:'#ddd4ef',hairStyle:'fauxhawk',headgear:'none',bottoms:'skinny',boots:'platform',extras:['neon','gloves'],eyeShape:'sharp',makeup:'glam',frame:'curvy'},
 botanical:{outfit:'denim-vest',coat:'#3d615a',top:'turtleneck',top2:'#aeb5a0',pants:'#2b3d39',boots2:'#3d443d',accent:'#deae69',hair:'#2d302b',hairTip:'#2d302b',hairStyle:'dreads',headgear:'none',bottoms:'cargo',boots:'combat',extras:['gloves'],eyeShape:'sleepy',makeup:'none',frame:'average'},
 civic:{outfit:'tailored',coat:'#ece3cd',top:'turtleneck',top2:'#27343a',pants:'#27343a',boots2:'#202b32',accent:'#b64c41',hair:'#26313b',hairTip:'#26313b',hairStyle:'crop',headgear:'none',bottoms:'skinny',boots:'creepers',extras:['gloves'],eyeShape:'sharp',makeup:'none',frame:'slim'}
};
const FAMILY_FOR={punk:['courier','prism'],goth:['archive'],skater:['courier','botanical'],raver:['prism'],work:['salvage','botanical'],office:['civic']};
const SCENE_FOR={suit:['office','office','work'],clerk:['office','office','skater'],medic:['work','office'],courier:['skater','work','punk'],runner:['skater','raver'],vendor:['work','skater'],busker:['punk','goth','skater'],drifter:['punk','goth','work'],punk:['punk','punk','goth'],broadcaster:['raver','goth','office'],records:['punk','goth'],bar:['goth','punk','raver'],repair:['work'],laundry:['work','skater'],tea:['goth','office'],print:['punk','office']};
function rngOf(rng){return{pick:a=>a[Math.floor(rng.next()*a.length)],int:(a,b)=>a+Math.floor(rng.next()*(b-a+1)),sample:(a,n)=>{const c=[...a],o=[];while(n-->0&&c.length)o.push(c.splice(Math.floor(rng.next()*c.length),1)[0]);return o},next:()=>rng.next()}}
function crowdLook(arch,rng,scenes){
 const r=rngOf(rng),pool=(Array.isArray(scenes)&&scenes.length&&scenes)||SCENE_FOR[arch?.key]||['punk','goth','skater','raver','work','office','skater','work'],scene=r.pick(pool);
 const base={skin:r.pick(P.skin),eyes:r.pick(['#3b2a1e','#6b4a2b','#4b6b8c','#69776d','#9d8651']),eyeShape:r.pick(OPTIONS.eyeShape),brows:r.pick(['straight','arched','heavy','slashed']),faceWidth:.9+r.next()*.2,faceLength:.92+r.next()*.16,jaw:.85+r.next()*.3,nose:.85+r.next()*.4,frame:r.pick(['slim','average','average','broad','curvy']),heightScale:.92+r.next()*.16,shoulders:.92+r.next()*.2,lips:'none',legwear:'none',headgear:'none',hairTip:'',tattoos:'none',extras:[]};
 const traditional=SCENES[scene](r),family=r.next()<.8?r.pick(FAMILY_FOR[scene]||['courier']):null;
 const signature=family?{...SIGNATURES[family]}:{};
 if(family){
  // Keep a family's silhouette and palette, but avoid identical uniforms.
  signature.coat='#'+new THREE.Color(signature.coat).multiplyScalar(.82+r.next()*.32).getHexString();
  signature.hairStyle=r.pick(({courier:['undercut','crop','mohawk'],salvage:['buzz','bun','crop'],archive:['long','bun','dreads'],prism:['fauxhawk','undercut','pigtails'],botanical:['dreads','long','bun'],civic:['crop','bun','buzz']})[family]);
  signature.accent=r.pick([signature.accent,signature.accent,'#b9c5c4','#bc9870']);
 }
 const l=normalize({...base,...traditional,...signature});if(!l.hairTip||l.hairTip==='')l.hairTip=l.hair;l.scene=scene;return l;
}
// ─── Geometry ───────────────────────────────────────────────────────────────
const sphere=new THREE.SphereGeometry(1,10,7),cube=new THREE.BoxGeometry(1,1,1),cone=new THREE.ConeGeometry(1,1,6),dome=new THREE.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2),ring=new THREE.TorusGeometry(1,.22,4,10);
const TOON=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.68,metalness:.12});
const GLOW=new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false});
function loft(rows,seg=12){const p=[],ix=[];for(const [y,rx,rz,cz=0]of rows)for(let j=0;j<=seg;j++){const a=j/seg*Math.PI*2;p.push(Math.sin(a)*rx,y,Math.cos(a)*rz+cz)}for(let i=0;i<rows.length-1;i++)for(let j=0;j<seg;j++){const a=i*(seg+1)+j,b=a+seg+1;ix.push(a,a+1,b,b,a+1,b+1)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g}
const ball=new THREE.SphereGeometry(1,12,8),pebble=new THREE.SphereGeometry(1,7,5);
function paintedTube(rows,paint,cuts,seg,round={},step=.012){
 rows=[...rows].sort((p,q)=>q[0]-p[0]);const top=rows[0][0],bot=rows.at(-1)[0];
 const radius=y=>{for(let i=0;i<rows.length-1;i++){const [y0,a0,b0]=rows[i],[y1,a1,b1]=rows[i+1];if(y<=y0&&y>=y1){const t=y0===y1?0:(y0-y)/(y0-y1);return[a0+(a1-a0)*t,b0+(b1-b0)*t]}}return y>top?rows[0].slice(1,3):rows.at(-1).slice(1,3)};
 const ys=new Set(rows.map(r=>r[0]));for(let y=top;y>bot;y-=step)ys.add(+y.toFixed(4));const cutSet=new Set(cuts.filter(c=>c<top&&c>bot));for(const c of cutSet)ys.add(c);
 const list=[...ys].sort((p,q)=>q-p),C2=new THREE.Color(),p=[],col=[],ix=[];let rings=0;
 const ring=(y,py,scale=1,yr=y)=>{const [rx,rz]=radius(yr);for(let j=0;j<=seg;j++){const a=j/seg*Math.PI*2,k=paint(py,a);p.push(Math.sin(a)*(rx+(k.out||0))*scale,y,Math.cos(a)*(rz+(k.out||0))*scale);C2.set(k.c);col.push(C2.r,C2.g,C2.b)}rings++};
 //  A rounded end is a half-dome on the last ring, so two limbs that meet at a
 //  joint overlap as one smooth knuckle whatever the bend.
 const dome=(y,dir)=>{const [rx,rz]=radius(y),ry=(rx+rz)/2,steps=3;const order=dir>0?[...Array(steps).keys()].reverse():[...Array(steps).keys()];for(const k of order){const f=(k+1)/steps*Math.PI/2;ring(y+dir*ry*Math.sin(f),y,Math.max(.0001,Math.cos(f)),y)}};
 if(round.top)dome(top,1);
 for(const y of list){if(cutSet.has(y)){ring(y,y+.0005);ring(y,y-.0005)}else ring(y,y)}
 if(round.bottom)dome(bot,-1);
 for(let i=0;i<rings-1;i++)for(let j=0;j<seg;j++){const a=i*(seg+1)+j,b=a+seg+1;ix.push(a,a+1,b,b,a+1,b+1)}
 //  Flat caps on square ends, so a bent joint never shows the inside of a tube.
 for(const [end,yy,up] of [[0,top,true],[rings-1,bot,false]]){if(up?round.top:round.bottom)continue;const c0=p.length/3;const k=paint(yy,0);C2.set(k.c);p.push(0,yy,0);col.push(C2.r,C2.g,C2.b);
  for(let j=0;j<=seg;j++){const v=end*(seg+1)+j;p.push(p[v*3],p[v*3+1],p[v*3+2]);col.push(col[v*3],col[v*3+1],col[v*3+2])}
  for(let j=0;j<seg;j++)up?ix.push(c0,c0+1+j+1,c0+1+j):ix.push(c0,c0+1+j,c0+1+j+1)}
 //  Rings run top to bottom, so wind each triangle the other way to face outward.
 for(let i=0;i<ix.length;i+=3){const t=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=t}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(ix);g.computeVertexNormals();return g}
const C=new THREE.Color();
const hexOf=v=>C.set(v).getHex();
const shade=(v,n)=>C.set(v).multiplyScalar(n).getHex();
const mix=(a,b,t)=>new THREE.Color(a).lerp(new THREE.Color(b),t).getHex();
function bake(bone,parts){
 for(const glow of [false,true]){const list=parts.filter(p=>!!p.glow===glow);if(!list.length)continue;
  const pos=[],norm=[],col=[],idx=[];
  for(const p of list){const g=p.geo.clone();g.scale(...p.s);if(p.rx)g.rotateX(p.rx);if(p.ry)g.rotateY(p.ry);if(p.r)g.rotateZ(p.r);g.translate(...p.p);
   const off=pos.length/3,a=g.attributes.position.array,n=g.attributes.normal.array,c=new THREE.Color(p.c||0),vc=p.vc&&g.attributes.color?g.attributes.color.array:null;
   if(g.index)for(const v of g.index.array)idx.push(v+off);else for(let i=0;i<a.length/3;i++)idx.push(i+off);
   for(let i=0;i<a.length;i+=3){pos.push(a[i],a[i+1],a[i+2]);norm.push(n[i],n[i+1],n[i+2]);if(vc)col.push(vc[i],vc[i+1],vc[i+2]);else col.push(c.r,c.g,c.b)}g.dispose()}
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
 // Shaped tailoring has actual edges and thickness, not painted rectangles.
 const panel=(b,points,z,c,depth=.018)=>{const sh=new THREE.Shape();points.forEach(([x,y],i)=>i?sh.lineTo(x,y):sh.moveTo(x,y));sh.closePath();const g=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:1,steps:1,curveSegments:1});owned.push(g);put(b,g,[0,0,z],[1,1,1],c)};
 //  A limb: rows [y,rx,rz] (any order), paint(y,angle)->{c,out}; cuts are hem heights with a hard edge.
 const limb=(b,rows,paint,cuts=[],round={},fine=false)=>{const g=paintedTube(rows,paint,cuts,typeof fine==='number'?fine:12,round,fine==='coarse'?.04:fine?.025:1);owned.push(g);buckets.get(b).push({geo:g,p:[0,0,0],s:[1,1,1],c:0,vc:true})};
 //  A ball joint, coloured like the limb it closes.
 const joint=(b,x,y,z,r,rz,paint,geo=ball)=>put(b,geo,[x,y,z],[r+(paint.out||0),r+(paint.out||0),rz+(paint.out||0)],paint.c);
 const skin=L.makeup==='skull'?'#e9e5dc':L.skin,glowOn=L.extras.includes('neon');
 const torso=new THREE.Group();torso.position.y=1.43;inner.add(torso);
 const body=bone(torso,0,-1.43,0),head=bone(torso,0,.075,0);head.scale.setScalar(.91);
 const shoulderX=.235*fr.sh*L.shoulders;
 const la=bone(torso,-shoulderX,0,0),ra=bone(torso,shoulderX,0,0);
 const hipX=.105*(fr.hip/.162);
 const ll=bone(inner,-hipX,.9,0),rl=bone(inner,hipX,.9,0);
 const elbows=[],knees=[],fingers=[];
 //  Kilts and long coat tails hang from a skirt bone that swings with the stride (0.86).
 const skirt=bone(inner,0,.95,0),SK=-.95;
 // ── Torso, shirt and jacket ──
 const ch=fr.chest,wa=fr.waist,hp=fr.hip;
 const torsoRows=k=>[[.94,hp+.01+k,.113+k*.7],[1.02,wa+.004+k,.1+k*.7],[1.12,wa+k,.098+k*.7],[1.27,ch+k,.118+k*.7],[1.39,ch+.03+k,.112+k*.7],[1.45,ch-.02+k,.09+k*.7],[1.49,.075,.066]];
 const topCol=L.top==='none'||L.top==='mesh'?skin:L.top2;
 //  A mesh top is painted onto the torso as a net instead of bars floating over it.
 if(L.top==='mesh')limb(body,torsoRows(0).slice(0,6),(y,a)=>({c:Math.abs(Math.sin(a*6))<.16||Math.abs(Math.sin(y*70))<.16?L.top2:skin,out:0}),[],{},36);else shape(body,torsoRows(0),topCol,14);
 if(L.top==='mesh')shape(body,torsoRows(-.002).slice(5),skin,14);
 if(fr.bust)for(const s of[-1,1])ell(body,s*.058,1.3,.078,.06,.05,.05,L.top==='none'?(L.outfit==='none'?L.top2:skin):topCol);
 if(L.top==='none'&&fr.bust&&L.outfit==='none')shape(body,[[1.22,ch+.006,.124],[1.34,ch+.032,.125]],L.top2,14);
 
 if(L.top==='band-tee'){box(body,0,1.3,.128,.14,.11,.008,L.accent);for(let i=0;i<3;i++)box(body,(i-1)*.04,1.3,.133,.026,.05,.004,L.top2);box(body,0,1.36,.134,.1,.012,.004,L.top2)}
 if(L.top==='turtleneck')shape(body,[[1.46,.08,.072],[1.56,.066,.06]],L.top2);
 if(L.top==='tank')for(const s of[-1,1])box(body,s*.09,1.43,.03,.03,.1,.2,L.top2);
 // pelvis in the bottoms colour
 shape(body,[[.82,hp-.004,.11],[.9,hp+.012,.118],[.95,hp-.004,.1]],L.pants,14);
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
  if(L.outfit==='longcoat'){shape(skirt,[[.48+SK,hp+.07,.16],[.7+SK,hp+.045,.145],[.9+SK,hp+.03,.13],[.97+SK,hp+.026,.124]],coat,14);shape(body,[[.92,hp+.03,.128],[1.0,wa+.03,.12]],coat,14);box(skirt,0,.74+SK,.155,.008,.46,.008,shade(coat,.5))}
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
 //  0.86: each limb is one closed tube whose rings carry the colour of what
 //  covers them (sleeve, skin, ink, net), with a hard edge at every hem and a
 //  small lip where fabric ends. Ball joints at shoulders, elbows, hips and
 //  knees keep a bent limb solid. No overlay shells, so nothing z-fights.
 const longSleeve=sleeves||L.top==='turtleneck',shortSleeve=!longSleeve&&['tee','band-tee'].includes(L.top);
 const sleeveCol=sleeves?L.coat:L.top2,HEM=-.16,CUFF=-.22;
 const inkOn=!['none','neck','face'].includes(L.tattoos);
 const ink=(y,a,part)=>{if(!inkOn||Number.isNaN(a))return null;const front=Math.cos(a);
  if(L.tattoos==='sleeve')return Math.sin(a*3+y*55)+Math.sin(a*5-y*31)*.6>-.55?INK:null;
  if(part!=='fore')return null;
  if(L.tattoos==='bands')return BANDS.some(v=>Math.abs(y-v)<.0035)?INK:null;
  if(L.tattoos==='blackwork')return front>.25&&BANDS.some(v=>Math.abs(y-v)<.012)?INK:null;
  if(L.tattoos==='circuit'){const q=((y*38+a*1.4)%1+1)%1;return front>.1&&y<-.03&&y>-.22&&Math.abs(q-.5)<.07?INK:null}
  return null};
 const armPaint=part=>(y,a)=>{
  if(part==='upper'&&(longSleeve||shortSleeve&&y>HEM))return{c:sleeveCol,out:.004};
  if(part==='fore'&&longSleeve)return sleeves&&y<CUFF?{c:shade(L.coat,.7),out:.007}:{c:sleeveCol,out:.004};
  return{c:ink(y,a,part)||skin,out:0}};
 const upperPaint=armPaint('upper'),forePaint=armPaint('fore'),fineArm=['sleeve','circuit'].includes(L.tattoos),BANDS=[-.05,-.085,-.12,-.155,-.19],bandW=L.tattoos==='bands'?.0035:L.tattoos==='blackwork'?.012:0,inkCuts=bandW?BANDS.flatMap(v=>[v+bandW,v-bandW]):[];
 for(const [arm,side] of [[la,-1],[ra,1]]){
  limb(arm,[[.045,.04,.04],[-.02,.074,.07],[-.1,.068,.07],[-.22,.056,.06],[-.285,.049,.052]],upperPaint,shortSleeve?[HEM]:[],{bottom:true},fineArm);
  joint(arm,0,-.03,0,.064,.062,upperPaint(-.03,NaN));
  if(L.extras.includes('spikes'))for(let i=0;i<3;i++)spike(arm,side*.02,.06,-.03+i*.03,.012,.06,METAL,{r:-side*.5});
  const fore=bone(arm,0,-.285,0);elbows.push(fore);
  limb(fore,[[0,.05,.053],[-.1,.054,.056],[-.2,.045,.047],[-.25,.04,.042]],forePaint,sleeves?[CUFF]:longSleeve?[]:inkCuts,{top:true},fineArm);
  if(glowOn&&sleeves)shape(fore,[[-.215,.054,.056],[-.205,.054,.056]],L.accent,12,{glow:true});
  const gloves=L.extras.includes('gloves'),hand=gloves?DARK:skin;
  ell(fore,0,-.29,.006,.038,.05,.026,hand);ell(fore,-side*.04,-.272,.02,.016,.032,.018,hand,{r:-side*.4});
  const digits=bone(fore,0,-.322,.01);fingers.push(digits);
  for(let i=0;i<4;i++)put(digits,pebble,[(i-1.5)*.018,-.022,0],[.01,.03-(Math.abs(i-1.5)*.005),.012],hand);
 }
 // ── Legs and boots ──
 const shorts=L.bottoms==='shorts',kilt=L.bottoms==='kilt',net=L.legwear==='fishnet',SHORTS=-.26,fineLeg=net&&'coarse',RIPS={thigh:[-.32,-.14],shin:[-.1]},PLAID=[-.04,-.14,-.24,-.34],legCuts=part=>L.bottoms==='ripped'?RIPS[part].flatMap(v=>[v+.009,v-.009]):L.bottoms==='plaid'&&part==='thigh'?PLAID.flatMap(v=>[v+.005,v-.005]):[];
 const legW=L.bottoms==='cargo'?1.12:1;
 const netBase=mix(skin,DARK,.3),netLine=mix(skin,DARK,.62);
 const bare=(y,a)=>!net?skin:Number.isNaN(a)?netBase:Math.abs(Math.sin(a*6+y*85))<.2||Math.abs(Math.sin(a*6-y*85))<.2?netLine:netBase;
 const ripAt=(y,a,spots)=>!Number.isNaN(a)&&L.bottoms==='ripped'&&Math.cos(a)>.55&&spots.some(v=>Math.abs(y-v)<.009);
 const pantsAt=(y,a,part)=>{
  if(ripAt(y,a,RIPS[part]))return skin;
  if(L.bottoms==='plaid'&&!Number.isNaN(a)&&(part==='thigh'&&PLAID.some(v=>Math.abs(y-v)<.005)||Math.abs(Math.sin(a*2))<.06))return shade(L.accent,.8);
  return L.pants};
 const thighPaint=(y,a)=>kilt||shorts&&y<SHORTS?{c:bare(y,a),out:0}:{c:pantsAt(y,a,'thigh'),out:shorts?.005:0};
 const shinPaint=(y,a)=>{if(L.legwear==='socks'&&y<-.25)return{c:'#e9e5dc',out:.003};return shorts||kilt?{c:bare(y,a),out:0}:{c:pantsAt(y,a,'shin'),out:0}};
 for(const [leg,side] of [[ll,-1],[rl,1]]){
  limb(leg,[[.05,.072,.082],[-.02,.09*legW,.097*legW],[-.19,.083*legW,.088*legW],[-.34,.07*legW,.076*legW],[-.43,.06*legW,.064*legW]],thighPaint,shorts?[SHORTS]:legCuts('thigh'),{bottom:true},fineLeg);
  joint(leg,0,-.005,0,.076,.084,thighPaint(0,NaN),sphere);
  if(L.bottoms==='cargo')box(leg,side*.093,-.2,0,.02,.1,.07,shade(L.pants,.8));
  if(L.bottoms==='plaid')box(leg,0,-.2,.094,.006,.4,.006,shade(L.pants,.5));
  const shin=bone(leg,0,-.43,0);knees.push(shin);
  limb(shin,[[0,.06*legW,.065*legW],[-.15,.064*legW,.074*legW],[-.27,.056*legW,.066*legW],[-.36,.052*legW,.058*legW]],shinPaint,[...(L.legwear==='socks'?[-.25]:[]),...(shorts||kilt?[]:legCuts('shin'))],{top:true},fineLeg);
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
 if(kilt){shape(skirt,[[.6+SK,hp+.1,.2],[.8+SK,hp+.045,.15],[.97+SK,hp+.01,.118]],L.pants,16);[[.66,.0875,.189],[.76,.06,.164],[.86,.035,.14]].forEach(([y,x,z])=>ell(skirt,0,y+SK,0,hp+x,.004,z,shade(L.accent,.8)))}
 const H=.165;
 // ── Signature tailoring. All pieces share existing animated bone batches. ──
 const coat=L.coat,trim=L.accent;
 // Every jacket gets constructed shoulders, a shaped collar and seam piping.
 if(jacket){
  for(const side of[-1,1]){
   panel(body,[[side*.065,1.45],[side*.12,1.53],[side*.17,1.44],[side*.09,1.29]],.13,shade(coat,1.15));
   box(body,side*.14,1.13,.13,.008,.21,.014,shade(coat,1.32));
  }
 }
 if(L.outfit==='leather'){
  // Diagonal blade lapel and a single long split coat panel.
  panel(body,[[-.19,1.42],[-.08,1.49],[.17,1.13],[.09,1.08]],.15,trim);
  panel(skirt,[[-.18,.04],[-.02,.04],[-.06,-.57],[-.22,-.42]],.06,coat);
  panel(skirt,[[.02,.04],[.18,.04],[.19,-.27],[.08,-.35]],-.12,shade(coat,.8));
  panel(la,[[-.14,.015],[-.04,.06],[.06,-.02],[.05,-.18],[-.10,-.16]],-.08,coat,.16);
  for(let i=0;i<3;i++)box(la,-.115,-.06-i*.035,.035,.01,.012,.13,trim);
  box(body,.12,1.04,.16,.07,.09,.035,DARK);
 }
 if(L.outfit==='bomber'){
  // Heavy folded work jacket, one armored shoulder and a spinal power pack.
  panel(body,[[-.22,1.4],[.22,1.4],[.19,1.17],[-.16,1.08]],.135,shade(coat,.77),.04);
  panel(ra,[[-.09,.015],[.05,.09],[.14,.025],[.13,-.14],[-.06,-.17]],-.1,shade(coat,.76),.20);
  for(let i=0;i<3;i++)box(ra,.02,-.018+i*.03,.127,.16,.012,.012,trim);
  box(body,0,1.25,-.18,.24,.35,.13,DARK);
  for(const side of[-1,1]){box(body,side*.07,1.24,-.255,.04,.23,.025,trim);box(body,side*.105,1.07,.17,.1,.12,.06,coat);}
  box(body,-.1,1.36,.185,.045,.045,.012,trim);
 }
 if(L.outfit==='longcoat'){
  // Cathedral-shaped shoulder mantle, tall collar, split ceremonial tails.
  panel(body,[[-.27,1.4],[-.13,1.56],[.12,1.56],[.28,1.37],[.17,1.24],[-.15,1.29]],-.17,coat,.045);
  for(const side of[-1,1]){
   panel(skirt,[[side*.025,.06],[side*.19,.06],[side*.27,-.66],[side*.09,-.77]],.025,coat);
   panel(skirt,[[side*.07,-.04],[side*.09,-.04],[side*.15,-.67],[side*.13,-.68]],.052,trim,.008);
   panel(body,[[side*.075,1.45],[side*.1,1.62],[side*.15,1.51],[side*.13,1.33]],.04,coat);
  }
  put(head,ring,[0,H+.02,-.14],[.205,.205,.205],trim);
  box(body,0,1.31,.145,.025,.12,.018,trim);
 }
 if(L.outfit==='studded'){
  // Faceted shell, asymmetrical shoulder fins and luminous inset seams.
  for(const [arm,side]of[[la,-1],[ra,1]]){
   panel(arm,[[side*-.06,.02],[side*.08,.15],[side*.16,.12],[side*.13,-.13],[0,-.18]],-.08,coat,.16);
   box(arm,side*.07,-.01,.09,.012,.15,.012,trim,{glow:glowOn});
  }
  panel(body,[[-.16,1.37],[0,1.46],[.17,1.31],[0,1.15]],.143,shade(coat,1.15));
  for(const side of[-1,1])panel(skirt,[[side*.08,.03],[side*.19,.03],[side*.25,-.21],[side*.15,-.33]],0,coat);
  box(head,-.057,H+.02,.134,.065,.017,.014,trim,{glow:glowOn});
 }
 if(L.outfit==='denim-vest'){
  // Woven shoulder shawl and a seed reliquary: a gardener's visible equipment.
  panel(body,[[-.28,1.4],[-.1,1.51],[.15,1.43],[.13,1.25],[-.21,1.1]],.14,coat,.025);
  for(let i=0;i<5;i++)box(body,-.17+i*.055,1.32-i*.025,.174,.012,.16,.009,trim,{r:-.5});
  panel(skirt,[[-.13,.03],[.13,.03],[.17,-.39],[0,-.48],[-.16,-.36]],.12,coat);
  box(body,0,1.22,-.19,.23,.28,.12,DARK);
  for(let i=0;i<3;i++){
   ell(body,(i-1)*.07,1.24,-.27,.027,.10,.027,trim);
   panel(body,[[(i-1)*.07,1.33],[(i-1)*.07-.06,1.48],[(i-1)*.07+.015,1.43]],-.26,shade(coat,1.6),.008);
  }
 }
 if(L.outfit==='tailored'){
  // Ivory architectural suit: long angular waistcoat, contrasting sash.
  for(const side of[-1,1]){
   panel(body,[[side*.06,1.46],[side*.19,1.42],[side*.15,1.06],[side*.04,.96]],.14,coat,.028);
   panel(skirt,[[side*.035,.04],[side*.15,.04],[side*.17,-.27],[side*.07,-.36]],.08,coat);
  }
  panel(body,[[-.16,1.43],[-.11,1.45],[.14,1.08],[.09,1.06]],.18,trim,.01);
  for(let i=0;i<3;i++)box(body,.11,1.32-i*.035,.18,.012,.012,.01,METAL);
 }
 // ── Head ──
 const jaw=L.jaw;
 const headRows=[[-.125,.048,.058],[-.1,.086*jaw,.094],[-.06,.112*Math.min(1.1,jaw),.114],[-.01,.124,.123],[.05,.127,.123],[.1,.114,.111],[.14,.084,.084],[.165,.042,.046],[.176,.005,.006]].map(([y,rx,rz])=>[H+y*fl,rx*fw,rz]);
 shape(head,headRows,skin,14);
 ell(head,0,H-.02*fl,.124,.018*L.nose,.026,.022*L.nose,shade(skin,.94));
 for(const s of[-1,1])ell(head,s*.126*fw,H,-.004,.02,.036,.028,shade(skin,.96));
 if(L.makeup==='skull'){ell(head,0,H-.03*fl,.132,.012,.01,.008,DARK);for(let i=0;i<5;i++)box(head,(i-2)*.012,H-.068*fl,.112,.003,.022,.004,DARK)}
 if(L.tattoos==='face'){box(head,.075*fw,H-.035*fl,.104,.008,.022,.004,INK,{r:.4});ell(head,.072*fw,H-.06*fl,.1,.007,.01,.004,INK)}
 // eyes blink as their own group; brows and makeup stay on the head
 const eyes=bone(head,0,H+.02*fl,0),eyeY=0;
 const ew={round:[.021,.015],sharp:[.025,.011],sleepy:[.024,.009],wide:[.025,.017]}[L.eyeShape]||[.026,.02];
 for(const s of[-1,1]){const x=s*.046*fw;
  if(L.makeup==='smoky'||L.makeup==='skull')ell(head,x,H+.02*fl,.112,.042,L.makeup==='skull'?.04:.032,.01,L.makeup==='skull'?DARK:'#2a1f2e');
  ell(eyes,x,eyeY,.115,ew[0],ew[1],.008,'#bcb9ad',{r:L.eyeShape==='sharp'?-s*.18:0});
  ell(eyes,x,eyeY-.001,.125,.009,Math.min(.009,ew[1]*.75),.005,L.eyes);
  ell(eyes,x,eyeY-.001,.129,.0055,Math.min(.0055,ew[1]*.4),.003,'#0b0b0f');
  ell(eyes,x+s*-.004,eyeY+.004,.131,.0015,.0015,.001,'#d8ded9');
  if(L.eyeShape==='sleepy')box(eyes,x,eyeY+ew[1]*.55,.123,ew[0]*2.1,.008,.01,shade(skin,.88));
  if(L.makeup==='liner'||L.makeup==='glam'||L.makeup==='bolt'){box(head,x,H+.02*fl-ew[1]*.85,.122,ew[0]*1.9,.004,.006,DARK);box(head,x+s*ew[0]*1.05,H+.02*fl+.002,.12,.022,.004,.006,DARK,{r:s*.5})}
  if(L.makeup==='glam')ell(head,x,H+.02*fl+ew[1]+.004,.118,ew[0]*1.1,.008,.006,L.accent);
  // brows
  const by=H+.02*fl+ew[1]+.018,bc='#302a2b';
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
 const cap=(sy=1,sc=1,c=hc,back=true)=>{put(head,dome,[0,H+.085*fl,-.012],[.136*fw*sc,.14*fl*Math.max(.85,sy),.139*sc],c);if(back)ell(head,0,H+.02*fl,-.048,.134*fw*sc,.152*fl,.104*sc,c)};
 const spikeAt=(x,y,z,len,rz,rx,fin)=>{const w=fin?[.012,.05]:[.026,.026];put(head,cone,[x,y,z],[w[0],len,w[1]],hc,{r:rz,rx});if(tip!==hc)put(head,cone,[x+Math.sin(-rz)*len*.4,y+Math.cos(rz)*Math.cos(rx||0)*len*.4,z+Math.sin(rx||0)*len*.4],[w[0]*.45,len*.22,w[1]*.45],tip,{r:rz,rx})};
 if(hs!=='bald'&&!covered){
  if(['buzz','mohawk','liberty'].includes(hs))cap(.8,.97,hs==='buzz'?hc:shade(hc,.45));
  else if(hs==='undercut'){cap(1,1,shade(hc,.4));put(head,dome,[0,H+.1*fl,-.01],[.138*fw,.11*fl,.14],hc)}
  else cap();
  if(hs==='crop'){panel(head,[[-.12,H+.11],[-.04,H+.19],[.12,H+.14],[.09,H+.065],[.03,H+.09],[-.07,H+.06]],.11,hc,.025);}
  if(hs==='mohawk'){ell(head,0,H+.15*fl,-.02,.03,.05,.15,hc);for(let i=0;i<6;i++)spikeAt(0,H+.22*fl-Math.abs(i-2)*.012,.11-i*.048,.2-Math.abs(i-2)*.018,0,-.42+i*.17,true)}
  if(hs==='liberty')for(let i=0;i<11;i++){const a=(i/10-.5)*2.6;spikeAt(Math.sin(a)*.115*fw,H+.2*fl,Math.cos(a)*.06-.03,.26,-Math.sin(a)*.95,-.25)}
  if(hs==='fauxhawk')for(let i=0;i<3;i++)spikeAt(0,H+.16*fl,.07-i*.045,.09,0,.2-i*.1,true);
  if(hs==='spiked')for(let i=0;i<9;i++){const a=i/9*Math.PI*2;spikeAt(Math.sin(a)*.075*fw,H+.2*fl,Math.cos(a)*.065-.01,.13,-Math.sin(a)*.6,Math.cos(a)*.45)}
  if(hs==='undercut'){panel(head,[[-.11,H+.12],[-.04,H+.22],[.11,H+.18],[.14,H+.08],[.09,H+.015],[.065,H+.1],[-.025,H+.07]],.09,hc,.035);panel(head,[[.07,H+.14],[.12,H+.13],[.105,H+.025]],.13,tip,.008);}
  if(hs==='mullet'){ell(head,0,H-.07,-.1,.09,.12,.05,hc);ell(head,0,H-.17,-.1,.06,.04,.035,tip)}
  if(hs==='long')for(const s of[-1,1]){ell(head,s*.105*fw,H-.06,-.03,.04,.16,.08,hc,{r:s*.06});ell(head,s*.1*fw,H-.2,-.04,.032,.04,.06,tip)}
  if(hs==='long'){ell(head,0,H-.07,-.1,.1,.16,.05,hc);for(const side of[-1,1])panel(head,[[side*.04,H+.17],[side*.12,H+.13],[side*.15,H-.1],[side*.1,H-.22],[side*.085,H+.035]],.085,hc,.025);}
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
 return{root,torso,head,eyes,mouth,la,ra,ll,rl,elbows,knees,fingers,skirt,lift:inner.position.y};
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
  studio:{torso:f.torso,skirt:f.skirt,faceOffset:.165,outfit:look.outfit,tattoos:look.tattoos,piercings:look.piercings,elbows:f.elbows,knees:f.knees,fingers:f.fingers,height:(1.84+f.lift)*height,eyes:f.eyes,mouth:f.mouth,blinkAt:1+rng.next()*4}});
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
 fitSkirt(c);
};
//  The skirt follows whichever thigh is furthest out, front or back, so a stride
//  stays inside a kilt or a coat tail. Called after every pose change.
function fitSkirt(c){const k=c.studio?.skirt;if(!k)return;const l=c.leftLeg.rotation.x,r=c.rightLeg.rotation.x,f=Math.max(0,-Math.min(l,r)),b=Math.max(0,Math.max(l,r));k.rotation.x=(b-f)*.45;k.scale.z=1+(f+b)*.55}
//  Later scripts wrap the animator too and set the legs; fit the skirt after all of them.
addEventListener('DOMContentLoaded',()=>{const all=window.shAnimateCharacter;window.shAnimateCharacter=function(c){const r=all.apply(this,arguments);try{fitSkirt(c)}catch(e){}return r}});
//  The person you are talking to moves their mouth until the conversation ends.
const talkers=new Set();
if(typeof shTalkTo==='function'){const talk=shTalkTo;window.shTalkTo=function(person){const r=talk.apply(this,arguments);const c=person?.char;if(c&&State.ui.inDialogue){c.talking=true;talkers.add(c)}return r}}
if(typeof shEndDialogue==='function'){const end=shEndDialogue;window.shEndDialogue=function(){const r=end.apply(this,arguments);for(const c of talkers)c.talking=false;talkers.clear();return r}}
window.FCWardrobe={SIGNATURES,DEFAULT_LOOK,OPTIONS,RANGES,normalize,crowdLook,build,fitSkirt,get current(){return normalize(Shift.avatar)}};
//  New and old saves both work: missing fields take the defaults.
Object.assign(SH_DEFAULT_AVATAR,DEFAULT_LOOK);
for(const k of Object.keys(DEFAULT_LOOK))if(Shift.avatar[k]===undefined)Shift.avatar[k]=Array.isArray(DEFAULT_LOOK[k])?[...DEFAULT_LOOK[k]]:DEFAULT_LOOK[k];
})();
