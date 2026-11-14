/* Street fabric: the ordinary things a real street has.

   Before this pass a street was a carriageway with one metre-wide cream stripe,
   two lamps and, half the time, one car parked across the lane. Now each block has
     road    double yellow centre line, kerbside parking line, zebra crossings,
             stop bars, lane arrows, manholes, drain grates, patches, cracks, stains
     kerb    street trees in grated pits, benches, bins, hydrants, parking meters,
             bike racks, planters, news boxes, bollards, a bus shelter now and then
     corner  traffic signals with mast arms, pedestrian heads and street-name blades
     lane    parked cars along the kerb (sedan, hatch, van, pickup)
     roof    water tanks, condenser rows, antenna masts

   Cost: three meshes per chunk (solid, glow, decal), three shared materials, no
   lights, no textures beyond one 1024 px canvas, no per-frame work. Everything is
   owned by a support voxel: mine the paving or the roof and the object goes with
   it, collider included. Placement uses its own seeded stream, so the voxel world
   and every saved edit generate exactly as before.

   Display: FCStreetFabric.set(false) hides it. Distance culled by graphics tier. */
(function(){'use strict';
if(typeof THREE==='undefined'||typeof Chunk==='undefined'||typeof State==='undefined')return;
const F=window.FCStreetFabric={version:'0.102.0',enabled:true,stats:{chunks:0,items:0,tris:0}};
const HALF=CITY_BLOCK_SIZE/2,EDGE=CHUNK_SIZE/2,ROAD_Y=1,WALK_Y=2;
const DOORS=new Set([19,27,30]);

// ─── Seeded stream, independent of chunk.rng ───────────────────────────────
function stream(cx,cz){let s=(Math.imul(cx,73856093)^Math.imul(cz,19349663)^0x9e3779b9)>>>0;
 return()=>{s=(s+0x6D2B79F5)>>>0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}

// ─── Decal atlas: 4 x 4 tiles of 256 px, drawn once ────────────────────────
const TILE={white:0,yellow:1,manhole:2,grate:3,patch:4,oil:5,crack:6,arrow:7,tactile:8,pit:9,stain:10,leaves:11,puddle:12,cover:13,patchLight:14,bus:15};
const atlas=document.createElement('canvas');atlas.width=atlas.height=1024;
(function paint(){const g=atlas.getContext('2d');let seed=4471;const r=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const tile=(i,fn)=>{g.save();g.translate((i%4)*256,Math.floor(i/4)*256);g.beginPath();g.rect(0,0,256,256);g.clip();fn();g.restore()};
 const wear=(n,a)=>{g.globalCompositeOperation='destination-out';for(let i=0;i<n;i++){g.fillStyle=`rgba(0,0,0,${a*r()})`;g.fillRect(r()*256,r()*256,2+r()*9,1+r()*4)}g.globalCompositeOperation='source-over'};
 tile(TILE.white,()=>{g.fillStyle='#d9d8cf';g.fillRect(0,0,256,256);wear(900,.9)});
 tile(TILE.yellow,()=>{g.fillStyle='#d2a51f';g.fillRect(0,0,256,256);wear(800,.85)});
 tile(TILE.manhole,()=>{g.fillStyle='#22262a';g.beginPath();g.arc(128,128,118,0,7);g.fill();g.strokeStyle='#4a4f52';g.lineWidth=9;g.beginPath();g.arc(128,128,108,0,7);g.stroke();g.lineWidth=4;g.strokeStyle='#3a3f43';for(let a=0;a<12;a++){g.beginPath();g.moveTo(128+Math.cos(a*.5236)*28,128+Math.sin(a*.5236)*28);g.lineTo(128+Math.cos(a*.5236)*96,128+Math.sin(a*.5236)*96);g.stroke()}for(const rr of [28,62,96]){g.beginPath();g.arc(128,128,rr,0,7);g.stroke()}g.fillStyle='#111417';g.fillRect(120,40,16,10);g.fillRect(120,206,16,10)});
 tile(TILE.grate,()=>{g.fillStyle='#2b2f31';g.fillRect(8,40,240,176);g.fillStyle='#07090a';for(let x=24;x<236;x+=26)g.fillRect(x,54,13,148);g.strokeStyle='#555a5c';g.lineWidth=5;g.strokeRect(10,42,236,172)});
 const blob=(col,n,rad)=>{for(let i=0;i<n;i++){const x=128+(r()-.5)*150,y=128+(r()-.5)*150,q=rad*(.4+r());const gr=g.createRadialGradient(x,y,0,x,y,q);gr.addColorStop(0,col);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-q,y-q,q*2,q*2)}};
 tile(TILE.patch,()=>{g.fillStyle='rgba(18,22,25,.72)';g.fillRect(10,10,236,236);g.strokeStyle='rgba(8,10,12,.9)';g.lineWidth=5;g.strokeRect(12,12,232,232);for(let i=0;i<500;i++){g.fillStyle=`rgba(150,150,140,${r()*.25})`;g.fillRect(14+r()*228,14+r()*228,2,2)}});
 tile(TILE.patchLight,()=>{g.fillStyle='rgba(96,102,100,.5)';g.fillRect(10,10,236,236);g.strokeStyle='rgba(20,22,24,.75)';g.lineWidth=4;g.strokeRect(12,12,232,232);for(let i=0;i<500;i++){g.fillStyle=`rgba(20,20,20,${r()*.3})`;g.fillRect(14+r()*228,14+r()*228,2,2)}});
 tile(TILE.oil,()=>blob('rgba(6,7,9,.6)',9,58));
 tile(TILE.stain,()=>{blob('rgba(40,36,30,.34)',10,50);for(let i=0;i<16;i++){g.fillStyle='rgba(22,22,24,.7)';g.beginPath();g.arc(20+r()*216,20+r()*216,2+r()*3,0,7);g.fill()}});
 tile(TILE.crack,()=>{g.strokeStyle='rgba(8,9,11,.55)';for(let n=0;n<2;n++){let x=16+r()*30,y=70+r()*110;g.lineWidth=1+r()*1.4;g.beginPath();g.moveTo(x,y);while(x<240){x+=10+r()*18;y+=(r()-.5)*14;g.lineTo(x,y)}g.stroke()}});
 tile(TILE.arrow,()=>{g.fillStyle='#d9d8cf';g.fillRect(104,96,48,150);g.beginPath();g.moveTo(128,8);g.lineTo(196,112);g.lineTo(60,112);g.fill();wear(500,.9)});
 tile(TILE.tactile,()=>{g.fillStyle='#b58f1c';g.fillRect(0,0,256,256);for(let x=16;x<256;x+=32)for(let y=16;y<256;y+=32){g.fillStyle='#d9b23a';g.beginPath();g.arc(x,y,9,0,7);g.fill();g.fillStyle='rgba(60,45,5,.5)';g.beginPath();g.arc(x+3,y+4,9,0,7);g.fill();g.fillStyle='#e1bd49';g.beginPath();g.arc(x,y,8,0,7);g.fill()}});
 tile(TILE.pit,()=>{g.fillStyle='#2c3032';g.fillRect(6,6,244,244);g.fillStyle='#0c0e0f';for(let a=0;a<16;a++){g.save();g.translate(128,128);g.rotate(a*.3927);g.fillRect(52,-6,62,12);g.restore()}g.fillStyle='#3a2c20';g.beginPath();g.arc(128,128,46,0,7);g.fill();g.strokeStyle='#5d6264';g.lineWidth=6;g.strokeRect(9,9,238,238)});
 tile(TILE.leaves,()=>{for(let i=0;i<90;i++){g.fillStyle=['#7d6a25','#5d6e2c','#8a5320','#3f5a2a'][i%4];g.save();g.translate(128+(r()-.5)*220*r(),128+(r()-.5)*220*r());g.rotate(r()*6.3);g.fillRect(-4,-2,8,4);g.restore()}});
 tile(TILE.puddle,()=>{const gr=g.createRadialGradient(128,128,10,128,128,120);gr.addColorStop(0,'rgba(120,140,155,.5)');gr.addColorStop(.75,'rgba(40,52,62,.5)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.save();g.translate(128,128);g.scale(1,.72);g.translate(-128,-128);g.fillRect(0,0,256,256);g.restore()});
 tile(TILE.cover,()=>{g.fillStyle='#34393b';g.fillRect(14,14,228,228);g.strokeStyle='#585e60';g.lineWidth=6;g.strokeRect(17,17,222,222);g.strokeStyle='#22272a';g.lineWidth=3;for(let i=40;i<230;i+=22){g.beginPath();g.moveTo(i,30);g.lineTo(30,i);g.stroke();g.beginPath();g.moveTo(226,i);g.lineTo(i,226);g.stroke()}});
 tile(TILE.bus,()=>{g.fillStyle='#d2a51f';g.font='900 150px Arial, sans-serif';g.textAlign='center';g.textBaseline='middle';g.save();g.translate(128,128);g.scale(.62,1.6);g.fillText('BUS',0,6);g.restore();wear(500,.9)});
})();
const atlasTex=new THREE.CanvasTexture(atlas);atlasTex.encoding=THREE.sRGBEncoding;atlasTex.anisotropy=8;atlasTex.userData.shared=true;
const MAT={
 body:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:.06}),
 glow:new THREE.MeshBasicMaterial({vertexColors:true}),
 decal:new THREE.MeshStandardMaterial({map:atlasTex,transparent:true,depthWrite:false,roughness:.92,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),
};
// Registered as shared so Chunk.destroy does not dispose them with every unload.
if(typeof M!=='undefined'){M.fabricBody=MAT.body;M.fabricGlow=MAT.glow;M.fabricDecal=MAT.decal}

// ─── Geometry writers ──────────────────────────────────────────────────────
const CUBE=[[[1,0,0],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]]],[[-1,0,0],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]],[[0,1,0],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]],[[0,0,1],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]],[[0,0,-1],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]],[[0,-1,0],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]]];
const tmpC=new THREE.Color();
class Solid{
 constructor(){this.p=[];this.n=[];this.c=[];this.x=this.y=this.z=0;this.cos=1;this.sin=0}
 at(x,y,z,yaw=0){this.x=x;this.y=y;this.z=z;this.cos=Math.cos(yaw);this.sin=Math.sin(yaw);return this}
 v(x,y,z,nx,ny,nz,col){const c=this.cos,s=this.sin;this.p.push(this.x+x*c+z*s,this.y+y,this.z-x*s+z*c);this.n.push(nx*c+nz*s,ny,-nx*s+nz*c);this.c.push(col.r,col.g,col.b)}
 tri(a,b,c,n,col){this.v(a[0],a[1],a[2],n[0],n[1],n[2],col);this.v(b[0],b[1],b[2],n[0],n[1],n[2],col);this.v(c[0],c[1],c[2],n[0],n[1],n[2],col)}
 // Raw hex, like every other material here: the renderer has no sRGB output stage.
 col(hex,m=1){tmpC.setHex(hex);return{r:tmpC.r*m,g:tmpC.g*m,b:tmpC.b*m}}
 // Box centred at (x,y,z). tx/tz taper the top; bottom=false omits the underside.
 box(x,y,z,sx,sy,sz,hex,tx=1,tz=1,bottom=false){const col=this.col(hex);for(const [n,q] of CUBE){if(n[1]<0&&!bottom)continue;const k=q.map(v=>{const t=v[1]>0;return[x+v[0]*sx*.5*(t?tx:1),y+v[1]*sy*.5,z+v[2]*sz*.5*(t?tz:1)]});this.tri(k[0],k[1],k[2],n,col);this.tri(k[0],k[2],k[3],n,col)}return this}
 // Prism along an axis ('x','y','z'), r0 at the start cap and r1 at the end cap.
 prism(x,y,z,r0,r1,len,sides,hex,axis='y'){const col=this.col(hex),map=axis==='y'?(a,b,h)=>[x+a,y+h,z+b]:axis==='x'?(a,b,h)=>[x+h,y+a,z+b]:(a,b,h)=>[x+b,y+a,z+h],nm=axis==='y'?(a,b,h)=>[a,h,b]:axis==='x'?(a,b,h)=>[h,a,b]:(a,b,h)=>[b,a,h];
  for(let i=0;i<sides;i++){const a0=i/sides*6.2832,a1=(i+1)/sides*6.2832,am=(a0+a1)/2,c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1);
   const A=map(c0*r0,s0*r0,-len/2),B=map(c1*r0,s1*r0,-len/2),C=map(c1*r1,s1*r1,len/2),D=map(c0*r1,s0*r1,len/2),n=nm(Math.cos(am),Math.sin(am),0),flip=axis!=='x';
   if(flip){this.tri(A,C,B,n,col);this.tri(A,D,C,n,col)}else{this.tri(A,B,C,n,col);this.tri(A,C,D,n,col)}
   const top=map(0,0,len/2),bot=map(0,0,-len/2),nt=nm(0,0,1),nb=nm(0,0,-1);
   if(flip){this.tri(top,C,D,nt,col);if(axis!=='y')this.tri(bot,A,B,nb,col)}else{this.tri(top,D,C,nt,col);this.tri(bot,B,A,nb,col)}}
  return this}
 // Faceted canopy clump. Each facet takes a slightly different green.
 clump(x,y,z,rx,ry,rz,hex,rnd){const seg=6,rings=4,pts=[];for(let j=0;j<=rings;j++){const row=[],ph=j/rings*Math.PI;for(let i=0;i<seg;i++){const th=i/seg*6.2832+j*.5,k=j===0||j===rings?1:.82+rnd()*.36;row.push([x+Math.sin(ph)*Math.cos(th)*rx*k,y-Math.cos(ph)*ry*(j===0?.7:1),z+Math.sin(ph)*Math.sin(th)*rz*k])}pts.push(row)}
  const face=(a,b,c)=>{const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;this.tri(a,b,c,[nx,ny,nz],this.col(hex,.72+rnd()*.5+ny*.16))};
  for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){const a=pts[j][i],b=pts[j][(i+1)%seg],c=pts[j+1][(i+1)%seg],d=pts[j+1][i];if(j>0)face(a,c,b);if(j<rings-1)face(a,d,c)}
  return this}
 mesh(material){if(!this.p.length)return null;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));g.computeBoundingSphere();return new THREE.Mesh(g,material)}
}
class Decals{
 constructor(){this.p=[];this.u=[];this.n=[]}
 // Flat quad: w along local x, d along local z, rotated by yaw about its centre.
 quad(x,y,z,w,d,yaw,tile){const c=Math.cos(yaw),s=Math.sin(yaw),u0=(tile%4)*.25+.012,v0=1-Math.floor(tile/4)*.25-.012,u1=u0+.226,v1=v0-.226,k=[[-w/2,-d/2,u0,v0],[-w/2,d/2,u0,v1],[w/2,d/2,u1,v1],[w/2,-d/2,u1,v0]];
  for(const i of [0,1,2,0,2,3]){const q=k[i];this.p.push(x+q[0]*c+q[1]*s,y,z-q[0]*s+q[1]*c);this.u.push(q[2],q[3]);this.n.push(0,1,0)}}
 mesh(){if(!this.p.length)return null;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(this.u,2));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));g.computeBoundingSphere();const m=new THREE.Mesh(g,MAT.decal);m.castShadow=false;m.receiveShadow=true;m.userData._hdTag=1;m.renderOrder=1;return m}
}

// ─── The kit. Every draw works in a local frame: +z faces away from the block ─
const CAR_PAINT=[0xd8d9d4,0xb9bdc0,0x8d9296,0x4a4e55,0x1d1f24,0x25344a,0x6d1f1c,0x3f5a4a,0xd9d2bd,0x7b6a55,0x2f4f6a,0xc8a21c];
const LEAF=[0x4d7f40,0x5b8f47,0x44774f,0x6f9240,0x9a8f34,0xa86c2c];
const KIT={
 tree(b,g,o){const r=o.rnd,h=3.1+r()*1.5,leaf=LEAF[Math.floor(r()*(o.autumn?6:4))],lean=(r()-.5)*.25;
  b.box(0,.05,0,.82,.1,.82,0x33291f);b.prism(lean*.5,h/2,0,.13,.085,h,6,0x4b3b2c);
  b.box(lean,h*.62,.0,.07,.07,.9,0x4b3b2c);
  const n=o.lite?2:3+Math.floor(r()*2);for(let i=0;i<n;i++){const a=r()*6.28,d=i?0.5+r()*.5:0;b.clump(lean+Math.cos(a)*d,h+.5+(i?r()*.9-.2:.55),Math.sin(a)*d,1.0+r()*.55,.85+r()*.5,1.0+r()*.55,leaf,r)}},
 bench(b){for(const x of [-.72,.72]){b.box(x,.22,0,.07,.44,.46,0x2a2d30);b.box(x,.62,.2,.07,.42,.07,0x2a2d30)}
  for(const z of [-.14,0,.14])b.box(0,.46,z,1.6,.045,.11,0x7a5a3a);for(const y of [.62,.78])b.box(0,y,.23,1.6,.1,.04,0x7a5a3a)},
 bin(b){b.prism(0,.45,0,.24,.28,.9,8,0x2f4a3f);b.prism(0,.93,0,.3,.24,.08,8,0x1f2a26);b.box(0,.7,.27,.2,.07,.03,0x0d1110)},
 hydrant(b,g,o){const c=o.rnd()<.6?0xb4281d:0xc9a31f;b.prism(0,.3,0,.13,.115,.6,8,c);b.prism(0,.64,0,.12,.03,.14,8,c);b.prism(0,.06,0,.17,.17,.07,8,c);b.prism(0,.4,0,.055,.055,.42,6,0xb8b9b4,'x');b.prism(0,.38,.13,.06,.05,.08,6,0xb8b9b4,'z')},
 meter(b){b.prism(0,.55,0,.035,.035,1.1,6,0x4e5355);b.box(0,1.22,0,.17,.3,.12,0x3b4245);b.box(0,1.27,.065,.11,.1,.01,0x9db3aa)},
 newsbox(b,g,o){const c=[0x2c5a8a,0xa3301f,0xc8a21c,0x2f6b4a][Math.floor(o.rnd()*4)];b.box(0,.12,0,.36,.24,.32,0x26292b);b.box(0,.72,0,.46,.96,.4,c);b.box(0,.86,.205,.34,.44,.01,0x1a2026);b.box(0,.42,.205,.3,.05,.012,0xc9c9c0)},
 bikes(b,g,o){for(const x of [-.45,.45]){b.box(x,.42,0,.045,.84,.045,0x8c9296);}b.box(0,.84,0,.94,.045,.045,0x8c9296);
  if(o.rnd()<.7){const c=[0x2a6f9a,0xa33a2a,0x2b2e31,0x3f7a4c][Math.floor(o.rnd()*4)];for(const z of [-.52,.52]){b.prism(.12,.33,z,.33,.33,.035,10,0x141517,'x');b.prism(.12,.33,z,.26,.26,.04,10,0x3a3d40,'x')}b.box(.12,.55,0,.03,.03,1.0,c);b.box(.12,.72,-.2,.03,.4,.03,c);b.box(.12,.9,-.22,.03,.03,.22,0x151515);b.box(.12,.82,.48,.34,.03,.03,0x1a1a1a)}},
 planter(b,g,o){b.box(0,.26,0,1.1,.52,.6,0x8d8a7e);b.box(0,.5,0,.98,.06,.48,0x2f251b);for(let i=0;i<3;i++)b.clump(-.34+i*.34,.72+o.rnd()*.1,(o.rnd()-.5)*.1,.26,.24,.22,[0x3f6f3a,0x55803c,0x7a3d5a][i%3],o.rnd)},
 bollard(b){for(const x of [-.55,.55]){b.prism(x,.42,0,.075,.075,.84,8,0x2b2f31);b.prism(x,.74,0,.08,.08,.06,8,0xc9a31f)}},
 mailbox(b){b.box(0,.3,0,.1,.6,.1,0x23324a);b.box(0,.86,0,.5,.62,.44,0x254a7a);b.prism(0,1.17,0,.22,.22,.5,8,0x254a7a,'x');b.box(0,.98,.225,.34,.05,.012,0x10192a)},
 shelter(b,g){for(const x of [-1.5,1.5])for(const z of [-.5,.5])b.box(x,1.25,z,.07,2.5,.07,0x33383b);b.box(0,2.52,0,3.3,.07,1.3,0x2c3134);b.box(0,2.47,.0,3.1,.03,1.1,0x9eb0b2);
  b.box(0,1.35,.5,2.95,1.9,.03,0x6f8f98);b.box(-1.5,1.35,0,.03,1.9,.95,0x6f8f98);b.box(0,.45,.22,1.9,.06,.34,0x7a5a3a);for(const x of [-.8,.8])b.box(x,.22,.22,.06,.44,.3,0x33383b);
  b.box(1.95,1.5,.3,.06,3,.06,0x33383b);b.box(1.95,2.75,.3,.5,.5,.04,0x1f4f8a);g.box(1.95,2.75,.325,.3,.3,.01,0xe8e6da);g.box(.0,2.1,.48,1.1,.5,.01,0xdfe6dc)},
 // Signal: mast arm reaches over the half-road it controls, head faces oncoming traffic (local -x).
 signal(b,g,o){b.prism(0,.12,0,.2,.16,.24,8,0x2a2e30);b.prism(0,2.7,0,.095,.07,5.4,8,0x33383a);b.prism(0,5.3,1.9,.055,.045,3.8,6,0x33383a,'z');
  const go=o.rnd()<.5,head=(x,y,z,s=1)=>{b.box(x,y,z,.3*s,.92*s,.3*s,0x15171a);b.box(x-.14*s,y,z,.04,1.06*s,.44*s,0x0c0d0f);[[0xff2a1c,0x3a0b08],[0xffb21c,0x3a2806],[0x2bff8a,0x06301c]].forEach((c,i)=>{const lit=go?i===2:i===0,yy=y+(1-i)*.29*s;(lit?g:b).prism(x+.16*s,yy,z,.085*s,.085*s,.03,8,lit?c[0]:c[1],'x')})};
  head(0,5.0,3.5);head(-.02,3.3,.24,.8);
  b.box(.22,2.5,0,.2,.34,.24,0x15171a);g.box(.325,2.5,0,.012,.2,.14,go?0xff7a1c:0xe6f2ea);
  b.box(0,3.95,.02,1.3,.2,.03,0x1d5a3a);b.box(.02,4.18,0,.03,.2,1.3,0x1d5a3a);b.box(0,3.95,.04,1.0,.05,.012,0xdfe6dc);b.box(.04,4.18,0,.012,.05,1.0,0xdfe6dc);
  b.box(.0,1.15,.14,.14,.2,.09,0xc9a31f)},
 car(b,g,o){const r=o.rnd,type=o.type,paint=CAR_PAINT[Math.floor(r()*CAR_PAINT.length)],glass=0x18222b,van=type===2,pick=type===3,L=van?4.6:type===1?3.9:4.4,W=1.78;
  b.box(0,.55,0,W,.5,L,paint,.96,.985);b.box(0,.32,0,W-.1,.12,L-.1,0x15171a);
  if(van){b.box(0,1.3,-.2,W-.06,1.0,L-.9,paint,.92,.97);b.box(0,1.42,L/2-.75,W-.14,.5,.02,glass);for(const x of [-1,1])b.box(x*(W/2-.02),1.42,L/2-1.35,.02,.42,.9,glass)}
  else if(pick){b.box(0,1.08,.45,W-.1,.58,1.5,glass,.86,.8);b.box(0,1.38,.45,W-.34,.05,1.1,paint);for(const x of [-1,1])b.box(x*(W/2-.05),.92,-1.2,.07,.26,1.9,paint);b.box(0,.92,-L/2+.06,W-.06,.26,.07,paint);b.box(0,.81,-1.2,W-.2,.03,1.85,0x1c1e21)}
  else{const cz=type===1?-.25:-.12,cl=type===1?2.35:2.15;b.box(0,1.08,cz,W-.1,.56,cl,glass,.84,.74);b.box(0,1.375,cz,W-.36,.05,cl*.72,paint);for(const x of [-1,1])b.box(x*(W/2-.1),1.08,cz+.05,.03,.52,.09,paint,.7,1)}
  for(const x of [-1,1])for(const z of [-1,1]){b.prism(x*(W/2-.1),.32,z*(L/2-.82),.32,.32,.22,10,0x121316,'x');b.prism(x*(W/2-.0),.32,z*(L/2-.82),.17,.17,.03,8,0x8f9498,'x')}
  for(const x of [-.58,.58]){b.box(x,.66,L/2,.34,.14,.03,0xe4e8e2);b.box(x,.68,-L/2,.3,.12,.03,0x8a1614)}
  b.box(0,.42,L/2+.02,W-.04,.14,.08,0x1a1c1f);b.box(0,.42,-L/2-.02,W-.04,.14,.08,0x1a1c1f);b.box(0,.5,-L/2-.065,.42,.12,.012,0xe2e0d2);
  for(const x of [-1,1])b.box(x*(W/2+.07),1.0,(van?L/2-1.0:.82),.1,.09,.14,paint)},
 tank(b){for(const x of [-.5,.5])for(const z of [-.5,.5])b.box(x,.6,z,.08,1.2,.08,0x3a3f42);b.box(0,1.2,0,1.3,.06,1.3,0x3a3f42);b.prism(0,2.05,0,.78,.74,1.7,10,0x6e5a44);for(const y of [1.5,2.05,2.6])b.prism(0,y,0,.8,.8,.05,10,0x2c2a28);b.prism(0,3.1,0,.84,.06,.42,10,0x4a4f52)},
 condensers(b,g,o){for(let i=0;i<3;i++){const x=(i-1)*.95;b.box(x,.38,0,.8,.62,.6,0xa9aea8);b.prism(x,.7,0,.24,.24,.03,10,0x25292b);b.box(x,.07,0,.7,.14,.5,0x3a3f42)}b.box(0,.2,-.4,2.8,.07,.07,0x8c7a52)},
 antenna(b,g,o){const h=4+o.rnd()*3;b.prism(0,h/2,0,.05,.025,h,5,0x52585b);for(let i=1;i<4;i++)b.box(0,h*i/4.4+.6,0,.9-i*.18,.03,.03,0x52585b);b.box(0,.12,0,.5,.24,.5,0x3a3f42);g.box(0,h+.04,0,.07,.07,.07,0xff3b2a)},
};

// ─── Planning one chunk ────────────────────────────────────────────────────
const N=[[0,-1],[1,0],[0,1],[-1,0]],T=[[1,0],[0,1],[-1,0],[0,-1]];
function plan(chunk){
 const rnd=stream(chunk.cx,chunk.cz),items=[],wx=chunk.worldX,wz=chunk.worldZ,ox=chunk.originX,oz=chunk.originZ,d=chunk.district||{};
 const get=(x,y,z)=>{const lx=Math.floor(x)-ox,lz=Math.floor(z)-oz;return lx<0||lz<0||lx>=VOX_W||lz>=VOX_W?-1:chunk.vGet(lx,y,lz)};
 const road=(x,z)=>get(x,0,z)===B_ASPHALT&&get(x,1,z)===B_AIR,walk=(x,z)=>get(x,1,z)===B_SIDEWALK&&get(x,2,z)===B_AIR&&get(x,3,z)===B_AIR;
 const taken=[];for(const p of chunk.groundedProps||[])taken.push([p.root.position.x,p.root.position.z,1.3]);for(const t of chunk.terminals||[])taken.push([t.position.x,t.position.z,1.4]);for(const c of chunk.parkedCars||[])taken.push([c.position.x,c.position.z,3.6]);
 if(typeof SH_HOTSPOTS!=='undefined')for(const h of SH_HOTSPOTS)if(Math.abs(h.x-wx)<EDGE+2&&Math.abs(h.z-wz)<EDGE+2)taken.push([h.x,h.z,2.2]);
 const free=(x,z,r)=>!taken.some(t=>Math.hypot(t[0]-x,t[1]-z)<t[2]+r);
 const decal=(x,z,w,dp,yaw,tile,onWalk)=>{if(onWalk?!walk(x,z):!road(x,z))return;items.push({kind:'decal',cell:[Math.floor(x),onWalk?1:0,Math.floor(z),onWalk?B_SIDEWALK:B_ASPHALT],draw:(b,g,dc)=>dc.quad(x,(onWalk?WALK_Y:ROAD_Y)+.012,z,w,dp,yaw,tile)})};
 const solid=(kind,x,y,z,yaw,r,box,opt={})=>{const o=Object.assign({rnd:stream(Math.floor(x*7),Math.floor(z*7)+kind.length)},opt),id=y===ROAD_Y?B_ASPHALT:y===WALK_Y?B_SIDEWALK:B_ROOF;
  items.push({kind,cell:[Math.floor(x),y-1,Math.floor(z),id],collider:box?{minX:x-box[0],maxX:x+box[0],minZ:z-box[1],maxZ:z+box[1],minY:y,maxY:y+box[2]}:null,draw:(b,g)=>{o.rnd=stream(Math.floor(x*7),Math.floor(z*7)+kind.length);KIT[kind](b.at(x,y,z,yaw),g.at(x,y,z,yaw),o)}});taken.push([x,z,r])};
 const autumn=((chunk.cx*7+chunk.cz*13)%5+5)%5===0;
 // Kerbside cars answer only to other cars; trees and meters stand on the pavement beside them.
 const cars=(chunk.parkedCars||[]).map(c=>[c.position.x,c.position.z]);
 let hydrant=false,shelter=false;
 for(let s=0;s<4;s++){
  const n=N[s],t=T[s],P=(u,v)=>[wx+t[0]*u+n[0]*v,wz+t[1]*u+n[1]*v],yaw=Math.atan2(n[0],n[1]),along=Math.atan2(t[0],t[1]),lineYaw=yaw+Math.PI/2;
  // Road markings on this block's half of the carriageway. The neighbour paints the other half,
  // which is what makes the centre line a double yellow.
  const put=(u,v,lenU,lenV,tile,rot=0)=>{const p=P(u,v);decal(p[0],p[1],lenV,lenU,lineYaw+rot,tile,false)};
  for(const u of [-3.6,-1.2,1.2,3.3])put(u,EDGE-.14,u>3?1.9:2.4,.12,TILE.yellow);
  for(const u of [-3.4,-1.0,1.4])put(u,HALF+2.2,2.4,.09,TILE.white);
  for(const e of [-1,1])for(let k=0;k<5;k++)put(e*6.0,EDGE-.48-k*.96,1.9,.48,TILE.white);
  put(4.55,HALF+2.5,.34,4.4,TILE.white);
  if(rnd()<.55){const p=P(1.9,HALF+3.6);decal(p[0],p[1],.75,1.9,along+Math.PI,TILE.arrow,false)}
  put(-4.3,HALF+.3,.6,.5,TILE.grate);
  if(rnd()<.6)put(-4+rnd()*7,HALF+3.4+rnd()*.8,.95,.95,TILE.manhole,rnd()*3);
  if(rnd()<.35)put(-4+rnd()*7,HALF+2.9+rnd(),.7,.7,TILE.cover);
  for(let k=0;k<2;k++)if(rnd()<.6)put(-4+rnd()*7.5,HALF+1+rnd()*3.2,1.4+rnd()*2.2,.9+rnd()*1.3,rnd()<.6?TILE.patch:TILE.patchLight);
  if(rnd()<.7)put(-4+rnd()*7.5,HALF+1+rnd()*3.4,2.6+rnd()*2,1.4+rnd(),TILE.crack,rnd()<.3?1.57:0);
  if(rnd()<.5)put(-3.5+rnd()*6,HALF+1.1,1.2+rnd(),1.0+rnd()*.8,TILE.oil);
  if(rnd()<.3)put(-4.2+rnd()*8,HALF+.75,1.6+rnd()*1.4,1.0+rnd()*.5,TILE.puddle);
  // Tactile paving at both crossing landings, grime along the kerb.
  for(const e of [-1,1]){const p=P(e*6.0,HALF-.38);decal(p[0],p[1],.6,1.7,lineYaw,TILE.tactile,true)}
  for(let k=0;k<2;k++)if(rnd()<.7){const p=P(-4.5+rnd()*9,HALF-.5-rnd()*1.2);decal(p[0],p[1],1.2+rnd(),1+rnd()*.8,rnd()*6,TILE.stain,true)}
  if(rnd()<.3){const p=P(-4+rnd()*8,HALF-1.3);decal(p[0],p[1],.6,.6,lineYaw,TILE.cover,true)}
  // Kerb zone. A slot is used only on paving, clear of doors, props and one another.
  const kerb=HALF-.55,doorNear=u=>{for(let k=1;k<=4;k++){const p=P(u,kerb-k);for(let y=2;y<=3;y++)if(DOORS.has(get(p[0],y,p[1])))return true}return false};
  const slot=(kind,u,r,box,opt,v=kerb)=>{const p=P(u,v);if(!walk(p[0],p[1])||!free(p[0],p[1],r)||(r>.4&&doorNear(u)))return false;const rot=s%2?[box&&box[1],box&&box[0]]:[box&&box[0],box&&box[1]];solid(kind,p[0],WALK_Y,p[1],yaw,r,box?[rot[0],rot[1],box[2]]:null,opt);return p};
  const treeP=Math.min(.9,.28+(d.treeProb||.1)*1.3);
  for(const u of [-3.3,2.9])if(rnd()<treeP){const p=slot('tree',u+(rnd()-.5)*.5,.75,[.16,.16,3],{autumn,lite:false});if(p){decal(p[0],p[1],1.15,1.15,lineYaw,TILE.pit,true);if(autumn||rnd()<.35)decal(p[0]+(rnd()-.5),p[1]+(rnd()-.5),2.2,2.2,rnd()*6,TILE.leaves,true)}}
  if(!shelter&&rnd()<.13){const p=slot('shelter',.2,2.0,[1.6,.1,2.5],{},HALF-.75);if(p){shelter=true;const q=P(.2,HALF+1.25);decal(q[0],q[1],1.5,3.4,along+Math.PI,TILE.bus,false)}}
  if(rnd()<.42){if(slot('bench',-.4,.85,[.8,.26,.8],{},kerb-.05)&&rnd()<.7)slot('bin',-1.75,.3,[.26,.26,.95])}else if(rnd()<.4)slot('bin',-.6,.3,[.26,.26,.95]);
  if(!hydrant&&rnd()<.4)hydrant=!!slot('hydrant',4.5,.3,[.16,.16,.7],{},HALF-.4);
  if(rnd()<.45)for(const u of [-1.9,1.3])slot('meter',u,.2,[.07,.07,1.4],{},HALF-.3);
  const extra=rnd();if(extra<.16)slot('newsbox',.9,.4,[.24,.21,1.2]);else if(extra<.34)slot('bikes',1.0,.75,[.5,.1,.9]);else if(extra<.5)slot('planter',.9,.7,[.56,.31,.55]);else if(extra<.58)slot('mailbox',.9,.4,[.26,.23,1.4]);
  if(rnd()<.3)slot('bollard',-5.0,.5,[.65,.1,.85],{},HALF-.3);
  // Kerbside parking, parallel to the kerb, inside the white line.
  for(const u of [-2.25,2.0])if(rnd()<.36+(d.trashProb||.3)*.3){const uu=u+(rnd()-.5)*.5,p=P(uu,HALF+1.12+rnd()*.1);if(road(p[0],p[1])&&road(P(uu-2,HALF+1.1)[0],P(uu-2,HALF+1.1)[1])&&road(P(uu+2,HALF+1.1)[0],P(uu+2,HALF+1.1)[1])&&!cars.some(c=>Math.hypot(c[0]-p[0],c[1]-p[1])<5.2)){cars.push([p[0],p[1]]);const tr=rnd(),type=tr<.5?0:tr<.72?1:tr<.88?2:3,hx=s%2?.95:2.3,hz=s%2?2.3:.95;solid('car',p[0],ROAD_Y,p[1],along+(rnd()<.85?0:Math.PI),2.3,[hx,hz,type===2?1.85:1.45],{type})}}
 }
 // Signals stand on the two corners the lamp kit leaves empty.
 for(const [sx,sz,yaw] of [[1,-1,Math.PI],[-1,1,0]]){const x=wx+sx*(HALF-.6),z=wz+sz*(HALF-.6);if(walk(x,z)&&free(x,z,.3)&&road(wx+sx*(HALF-.6),wz+sz*(HALF+2)))solid('signal',x,WALK_Y,z,yaw,.4,[.16,.16,5.4])}
 // Roofs: plant sits on flat roofing with roofing around it.
 const roofTop=(lx,lz)=>{for(let y=VOX_H-3;y>=7;y--){const id=chunk.vGet(lx,y,lz);if(id===B_AIR)continue;return id===B_ROOF?y:-1}return -1};
 let roofs=0;for(const [lx,lz] of [[9,9],[14,13],[9,14],[13,9]]){if(roofs>=3)break;const y=roofTop(lx,lz);if(y<0)continue;const flat=[[1,0],[-1,0],[0,1],[0,-1]].every(q=>roofTop(lx+q[0],lz+q[1])===y),k=rnd();
  if(flat&&k<.34&&y<44)solid('tank',ox+lx+.5,y+1,oz+lz+.5,0,1,null);else if(flat&&k<.7)solid('condensers',ox+lx+.5,y+1,oz+lz+.5,rnd()<.5?0:Math.PI/2,1,null);else if(k<.9)solid('antenna',ox+lx+.5,y+1,oz+lz+.5,rnd()*3,.3,null);else continue;roofs++}
 return items;
}

// ─── Build, revalidate, cull ───────────────────────────────────────────────
// District paving passes re-skin the pad after generation, so support means: still solid, still open above.
function valid(chunk,it){const c=it.cell,lx=c[0]-chunk.originX,lz=c[2]-chunk.originZ;return isSolid(chunk.vGet(lx,c[1],lz))&&chunk.vGet(lx,c[1]+1,lz)===B_AIR}
function render(chunk){const fab=chunk.fabric,b=new Solid(),g=new Solid(),dc=new Decals();
 for(const m of [...fab.root.children]){fab.root.remove(m);m.geometry.dispose()}
 for(const it of fab.items)if(it.on)it.draw(b,g,dc);
 const body=b.mesh(MAT.body),glow=g.mesh(MAT.glow),decals=dc.mesh();
 if(body){body.receiveShadow=true;body.castShadow=false;body.userData._hdTag=1;fab.root.add(body)} // no shadow pass: it doubled the draw cost of every blockif(glow){glow.castShadow=false;glow.userData._hdTag=1;fab.root.add(glow)}if(decals)fab.root.add(decals);
 fab.tris=(b.p.length+g.p.length+dc.p.length)/9}
function refresh(chunk,force){const fab=chunk.fabric;let changed=force;
 for(const it of fab.items){const on=valid(chunk,it);if(on!==it.on){changed=true;it.on=on;
  if(it.collider){const i=chunk.collisionAABBs.indexOf(it.collider);if(on&&i<0)chunk.collisionAABBs.push(it.collider);else if(!on&&i>=0)chunk.collisionAABBs.splice(i,1)}}}
 if(changed)render(chunk);chunk.fabricDirty=false}
function build(chunk){if(chunk.fabric||!chunk.vox||!chunk.group)return;let items=[];
 try{items=plan(chunk)}catch(e){console.warn('[street-fabric] plan failed for',chunk.key,e);return}
 const root=new THREE.Group();root.name='street-fabric';root.visible=F.enabled;chunk.group.add(root);
 chunk.fabric={root,items,tris:0};for(const it of items)it.on=undefined;refresh(chunk,true);F.stats.chunks++;F.stats.items+=items.length}
const generate=Chunk.prototype.generate;
Chunk.prototype.generate=function(){
 // The metre-wide block stripe is retired; thin painted lines replace it.
 const stamp=this.stampBox;this.stampBox=function(x0,y0,z0,x1,y1,z1,id){return stamp.call(this,x0,y0,z0,x1,y1,z1,id===B_PAINT&&y0===0&&y1===1?B_ASPHALT:id)};
 let result;try{result=generate.apply(this,arguments)}finally{delete this.stampBox}
 build(this);return result};
const dirty=Chunk.prototype.markSectionDirty;Chunk.prototype.markSectionDirty=function(){this.fabricDirty=true;return dirty.apply(this,arguments)};
let last=0;function tick(t){requestAnimationFrame(tick);if(t-last<250)return;last=t;if(!State.chunkMap||typeof Player==='undefined')return;
 const tier=typeof HD!=='undefined'?HD.tier:'balanced',far=tier==='perf'?52:tier==='balanced'?96:140;
 for(const chunk of State.chunkMap.values()){const fab=chunk.fabric;if(!fab)continue;if(chunk.fabricDirty)refresh(chunk,false);
  fab.root.visible=F.enabled&&Math.hypot(Player.position.x-chunk.worldX,Player.position.z-chunk.worldZ)<far}}
requestAnimationFrame(tick);
Object.assign(F,{build,refresh,plan,KIT,TILE,atlas,materials:MAT,
 set(on){F.enabled=!!on;for(const c of State.chunkMap.values())if(c.fabric)c.fabric.root.visible=F.enabled;return F.enabled},
 count(){const out={};let tris=0;for(const c of State.chunkMap.values())if(c.fabric){tris+=c.fabric.tris;for(const it of c.fabric.items)if(it.on)out[it.kind]=(out[it.kind]||0)+1}out.tris=Math.round(tris);return out}});
})();
