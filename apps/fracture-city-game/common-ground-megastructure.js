/* Common Ground / The Lantern Hall.
 * Grounded ribs, a rising vault, occupied side galleries and a real stair.
 * Ground features and authored architecture share collision boxes. Player
 * edits still overlay generated voxels; no save data is migrated or removed.
 */
(function(){'use strict';
if(typeof THREE==='undefined'||typeof State==='undefined')return;
const PLAN=Object.freeze({version:3,name:'The Lantern Hall',floor:1,roof:193,
 center:{x:178.5,z:36},atrium:{x0:140,x1:217,z0:-2,z1:72},
 publicLevels:[1,7],overlook:{x0:140,x1:146,z0:42,z1:62,y:7},
 stair:{x0:140,x1:144,z0:30,z1:42,rise:.25,going:.5,steps:24},
 protectedPlots:{x0:192,x1:288,z0:48,z1:120}});
let root=null,scene=null,resources=[],seed=401,lightRig=null,floorAt=-Infinity,blend=0,kinetic=[];
const floorPose=new THREE.Object3D(),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const batches=new Map(),mats={},solids=[],fogColor=new THREE.Color(0x24383e);
const arches=[[-2,98],[22,126],[46,158],[72,192]];
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function solid(x,y,z,w,h,d,id){solids.push({minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2,cgHall:true,id});}
// Collision blueprint exists before chunk generation, independent of rendering.
for(const [z]of arches)for(const x of [141.5,215.5])solid(x,6,z,3,10,3,'rib-foot');
for(const x of [146,188])solid(x,5,22,2,8,2,'arrival-pier');
for(let i=0;i<24;i++){const top=1+(i+1)*.25;solid(142,(1+top)/2,30+i*.5+.25,4,top-1,.5,'stair');}
solid(143,6.7,52,6,.6,20,'overlook');
solid(139.5,9,46,.6,16,36,'overlook-wall');
for(const x of [140,146])solid(x,7.7,52,.16,1.4,20,'guard');
solid(143,7.7,62,6,1.4,.16,'guard');
solid(145,7.7,42,2,1.4,.16,'guard');
for(const z of [44,60])solid(141,3.5,z,1.4,5,1.4,'overlook-pier');
for(const x of [140,144])for(let i=0;i<24;i++)solid(x,1+(i+1)*.25+.65,30+i*.5+.25,.12,1.3,.5,'stair-guard');
for(const side of [-1,1])for(let j=0;j<4;j++){if(side===1&&j===3)continue;const h=[38,64,88,116][j];solid(side<0?136:222,1+h/2,4+j*19,6,h,15,'district');}
for(const x of [138,220])for(const z of [5,46,72]){if(x===220&&z>=48)continue;solid(x,5.5,z,4,9,3,'podium');}
for(const x of [147,209]){solid(x,32,72,18,62,2,'rear');solid(x,6,70.7,16,10,.6,'rear-face');}
// Furniture lives out of the walking corridors, with collision matching its base.
for(const x of [160.7,173.3]){solid(x,1.32,28,2.7,.64,.85,'arrival-seat');solid(x,1.97,27.6,2.7,.85,.1,'seat-back');}
for(const z of [49,56]){solid(140.85,7.32,z,.9,.64,2.4,'lounge-seat');solid(140.42,7.9,z,.13,1,2.4,'seat-back');}
solid(140.9,7.38,52.5,.8,.76,1.6,'lounge-table');
const generate=Chunk.prototype.generate;
Chunk.prototype.generate=function(){
 const result=generate.apply(this,arguments),ox=this.originX,oz=this.originZ;
 // An authored west-edge circulation pocket. Saved edits are applied by the
 // engine after generate(), and therefore remain authoritative.
 if(ox<146&&ox+24>138&&oz<64&&oz+24>28){
  this.stampBox(138,1,28,146,64,64,B_AIR);this.stampBox(138,0,28,146,1,64,134);
 }
 for(const b of solids)if(b.maxX>ox&&b.minX<ox+24&&b.maxZ>oz&&b.minZ<oz+24)this.collisionAABBs.push({...b});
 return result;
};
function texture(kind){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
 g.fillStyle=kind==='stone'?'#767e7a':'#c8c2b2';g.fillRect(0,0,512,512);
 for(let i=0;i<18000;i++){const v=100+rand()*100|0;g.fillStyle=`rgba(${v},${v},${v},.12)`;g.fillRect(rand()*512,rand()*512,rand()*3+.5,rand()*3+.5)}
 g.strokeStyle=kind==='stone'?'#9eaaa316':'#4b504a2b';g.lineWidth=.7;
 for(let j=0;j<14;j++){g.beginPath();g.moveTo(rand()*512,0);for(let y=0;y<=512;y+=32)g.lineTo((j*39+Math.sin(y*.014+j)*24)%512,y);g.stroke()}
 if(kind!=='stone')for(let y=0;y<512;y+=128){g.fillStyle='#5a625c29';g.fillRect(0,y,512,2);for(let x=36;x<512;x+=128){g.beginPath();g.arc(x,y+32,1.5,0,7);g.fill()}}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;
 if(THREE.SRGBColorSpace)t.colorSpace=THREE.SRGBColorSpace;else t.encoding=THREE.sRGBEncoding;resources.push(t);return t;
}
function material(name,color,rough=.8,metal=0,emit=0,map=null){
 const m=new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,emissive:color,emissiveIntensity:emit,map});mats[name]=m;resources.push(m);return m;
}
function box(s,m,x,y,z,w,h,d,r=[0,0,0]){const k=s+':'+m;if(!batches.has(k))batches.set(k,[]);batches.get(k).push({p:[x,y,z],s:[w,h,d],r});}
function beam(s,m,a,b,w,d=w){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av),k=s+':'+m;if(!batches.has(k))batches.set(k,[]);batches.get(k).push({p:av.add(bv).multiplyScalar(.5).toArray(),s:[w,v.length(),d],q:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize())});}
function mesh(geometry,material,name,p=[0,0,0]){const m=new THREE.Mesh(geometry,material);m.position.fromArray(p);m.name=name;root.add(m);resources.push(geometry);return m;}
function arch(z,height,width=3){
 const shape=new THREE.Shape(),n=64;
 for(let i=0;i<=n;i++){const t=i/n*Math.PI,x=178.5+38.5*Math.cos(t),y=1+height*Math.sin(t);i?shape.lineTo(x,y):shape.moveTo(x,y)}
 for(let i=n;i>=0;i--){const t=i/n*Math.PI;shape.lineTo(178.5+(38.5-width)*Math.cos(t),1+(height-width)*Math.sin(t))}shape.closePath();
 const geo=new THREE.ExtrudeGeometry(shape,{depth:3,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.16,bevelThickness:.16,curveSegments:48});
 mesh(geo,mats.concrete,'grounded-vault-rib',[0,0,z-1.5]);
 // Warm line follows the inner arris; it is geometry, not hundreds of lights.
 const pts=[];for(let i=0;i<=80;i++){const t=i/80*Math.PI;pts.push(new THREE.Vector3(178.5+(38.5-width-.15)*Math.cos(t),1+(height-width-.15)*Math.sin(t),z-1.75))}
 mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),80,.075,5,false),mats.glow,'rib-light');
}
function vault(){
 const positions=[],indices=[],n=48;
 for(let a=0;a<arches.length;a++)for(let i=0;i<=n;i++){const t=i/n*Math.PI;positions.push(178.5+39.5*Math.cos(t),1+(arches[a][1]+.5)*Math.sin(t),arches[a][0])}
 for(let a=0;a<arches.length-1;a++)for(let i=0;i<n;i++){
  // An uninterrupted slit of sky is left along the ridge.
  if(i>20&&i<27)continue;const k=a*(n+1)+i;indices.push(k,k+1,k+n+2,k,k+n+2,k+n+1);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
 mesh(g,mats.vault,'rising-vault-shell');
 for(let a=0;a<arches.length-1;a++)for(const t of [.27,.7,1.15,1.99,2.44,2.87])beam('vault','bronze',[178.5+39.3*Math.cos(t),1+arches[a][1]*Math.sin(t),arches[a][0]],[178.5+39.3*Math.cos(t),1+arches[a+1][1]*Math.sin(t),arches[a+1][0]],.22,.22);
}
function lettering(title,sub,x,y,z,w,h,ry=0,transparent=false){
 const c=document.createElement('canvas');c.width=1536;c.height=Math.round(1536*h/w);const g=c.getContext('2d');
 if(!transparent){g.fillStyle='#152628';g.fillRect(0,0,c.width,c.height);g.fillStyle='#c5a36b';g.fillRect(30,0,3,c.height)}
 g.fillStyle='#e4d5af';g.textAlign='center';g.font=`500 ${Math.floor(c.height*.37)}px Georgia`;g.fillText(title,768,c.height*.48,1430);
 g.fillStyle='#8fa9a5';g.font=`${Math.floor(c.height*.11)}px sans-serif`;g.fillText(sub,768,c.height*.8,1430);
 const t=new THREE.CanvasTexture(c);if(THREE.SRGBColorSpace)t.colorSpace=THREE.SRGBColorSpace;else t.encoding=THREE.sRGBEncoding;
 const m=new THREE.MeshBasicMaterial({map:t,transparent,depthWrite:!transparent});resources.push(t,m);const sign=mesh(new THREE.PlaneGeometry(w,h),m,'hall-sign-'+title,[x,y,z]);sign.rotation.y=ry;return sign;
}
function districts(){
 // Side galleries are deep rooms, not a repeated wallpaper of windows.
 for(const side of [-1,1]){const x=side<0?136:222,front=x-side*2.4;
  for(let j=0;j<4;j++){const z=4+j*19,h=[38,64,88,116][j];
   if(!(side===1&&j===3))box('district','basalt',x,1+h/2,z,6,h,15);
   for(let tier=(side<0&&j>=1?2:side===1&&j===3?8:0);tier<Math.floor(h/9);tier++){
    const y=6+tier*9,depth=tier%3===0?4:2;
    const vaultHeight=z<22?98+(z+2)*28/24:z<46?126+(z-22)*32/24:158+(z-46)*34/26;
    const front=178.5+side*(38.5*Math.sqrt(Math.max(.1,1-Math.pow((y+3)/vaultHeight,2)))-3.2);
    box('district','stone',front-side*depth/2,y-2.6,z,depth,.65,14);
    box('district','glass',front-side*.08,y+.1,z,.16,4,11);
    box('district','stone',front-side*depth/2,y+2.4,z,depth,.3,14);
    for(const dz of [-6.8,6.8])box('district','stone',front-side*depth/2,y,z+dz,depth,4.6,.24);
    for(let p=-4;p<=4;p+=2)box('district',((tier+j+p)%3===0)?'amber':'darkglass',front-side*.2,y+.1,z+p,.12,3,1.7);
    box('district','bronze',front-side*depth,y-1.6,z,.08,.12,14);
    if(tier%3===1)for(let p=-6;p<=6;p+=.6)box('fins','bronze',front-side*.5,y,z+p,.35,5.8,.065);
   }
   // Tall service bundles connect these inhabited masses to the ground.
   if(!(side===1&&j===3))for(let p=0;p<3;p++)box('district','metal',x-side*3.1,1+h/2,z+6+p*.3,.16,h,.16);
  }
 }
 // Ground arcades close the room at human height and retain real cross routes.
 for(const x of [138,220])for(const z of [5,46,72]){if(x===220&&z>=48)continue;
  box('podium','concrete',x,5.5,z,4,9,3);box('podium','basalt',x,1.6,z,5,1.2,4);
 }
 // North/rear civic wall: big quiet masses with two deep door reveals.
 for(const x of [147,209]){box('rear','basalt',x,32,72,18,62,2);box('rear','concrete',x,6,70.7,16,10,.6);}
 box('rear','basalt',178,50,72,44,74,2);
 for(let x=158;x<=198;x+=2)box('rear','bronze',x,26,70.7,.12,36,.3);
 box('rear','stone',178,11,71,44,2,1.5);
 lettering('THE COMMON GROUND','READ  /  MAKE  /  LISTEN  /  BELONG',178,8,70.6,29,3,Math.PI);
}
function court(){
 // Flush surface courses; water, book approaches, player plots and placed art remain.
 for(let x=144;x<192;x+=2)for(let z=22;z<64;z+=2){
  if((x>=158&&x<164||x>=170&&x<176)&&z>=30&&z<36)continue;
  if(z>=30&&z<40&&(x<158||x>=176))continue;
  box('floor',(x/2+z/2)%9===0?'stone':'basalt',x+1,1.014,z+1,1.975,.018,1.975);
 }
 for(const x of [164.9,169.1]){box('floor','bronze',x,1.028,28,.07,.01,12);box('floor','glow',x,1.032,25,.025,.01,4);}
 for(const z of [42,60])box('floor','bronze',168,1.03,z,46,.012,.055);
 // A compression canopy at arrival: grounded columns, coffered soffit, no sign clutter.
 box('arrival','basalt',167,9.4,22,44,1.2,8);
 for(const x of [146,188]){box('arrival','concrete',x,5,22,2,8,2);box('arrival','bronze',x-.65,5,20.98,.08,7,.08);}
 for(let x=148;x<188;x+=2){box('arrival','metal',x,8.55,22,.12,.4,7);box('arrival','glow',x,8.62,25.7,1.3,.04,.12);}
 lettering('F R A C T U R E   C I T Y','COMMON GROUND  /  YOUR STORY STARTS HERE',167,7.8,25.99,20,1.5,Math.PI);
 // A ceremonial rear portal surrounds the existing gallery rather than replacing its content.
 for(const x of [149,189]){box('gallery','concrete',x,6.5,67,1.6,11,2);box('gallery','bronze',x-.55,6.5,65.98,.08,10,.06);}
 box('gallery','basalt',169,12.2,67,42,1.4,4);
 for(let x=150;x<190;x+=1)box('gallery','bronze',x,11.4,65.2,.07,.5,.7);
 // A single stone-and-bronze reading pavilion replaces the mismatched voxel trim.
 for(const x of [159.5,174.5])box('library','basalt',x,3.05,37.5,1.03,4.1,1.04);
 box('library','basalt',167,4.85,37.49,14,.32,1.06);
 box('library','bronze',167,4.66,36.94,14,.045,.07);
 box('library','basalt',167,1.5,36.96,14,1,.06);
 box('library','bronze',167,1.98,36.89,14,.035,.06);
 // Light pools are opaque radial gradients on existing pavement, not global bloom.
 const cv=document.createElement('canvas');cv.width=cv.height=128;const ctx=cv.getContext('2d'),gr=ctx.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(244,195,114,.17)');gr.addColorStop(1,'rgba(244,195,114,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,128,128);
 const t=new THREE.CanvasTexture(cv),m=new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});resources.push(t,m);
 for(const [x,z]of [[156,24],[180,24],[152,46],[184,60]]){const p=mesh(new THREE.PlaneGeometry(9,9),m,'warm-light-pool',[x,1.05,z]);p.rotation.x=-Math.PI/2;}
}
function overlook(){
 for(const b of solids.filter(b=>['stair','overlook','overlook-pier','overlook-wall'].includes(b.id)))box('overlook',b.id==='overlook-pier'?'concrete':'stone',(b.minX+b.maxX)/2,(b.minY+b.maxY)/2,(b.minZ+b.maxZ)/2,b.maxX-b.minX,b.maxY-b.minY,b.maxZ-b.minZ);
 for(let i=0;i<24;i++)box('overlook','bronze',142,1+(i+1)*.25+.015,30+i*.5+.03,3.95,.03,.06);
 for(const x of [140,144]){beam('rails','bronze',[x,2.35,30],[x,8.35,42],.07);for(let i=0;i<=24;i+=2)box('rails','metal',x,1.65+i*.25,30+i*.5,.06,1.3,.06);}
 for(const x of [140,146]){box('rails','bronze',x,8.4,52,.08,.08,20);for(let z=42;z<=62;z+=1)box('rails','metal',x,7.7,z,.05,1.4,.05);}
 box('rails','bronze',145,8.4,42,2,.08,.08);for(const x of [144,145,146])box('rails','metal',x,7.7,42,.05,1.4,.05);
 box('rails','bronze',143,8.4,62,6,.08,.08);for(let x=140;x<=146;x++)box('rails','metal',x,7.7,62,.05,1.4,.05);
 lettering('OVERLOOK  /  LOUNGE','UP THE TEAL-LIT STAIR',142,2.6,29.7,3,.8,Math.PI);

}
function lantern(){
 const g=new THREE.Group();g.name='the-fractured-lantern';g.position.set(167,17,53);g.rotation.y=.12;root.add(g);
 for(let i=0;i<5;i++){
  const group=new THREE.Group(),a=i*Math.PI*2/5+.06,arc=Math.PI*2/5-.15;g.add(group);
  const geo=new THREE.TorusGeometry(7.2,.55,10,40,arc),m=new THREE.Mesh(geo,mats.bronze);m.rotation.z=a;group.add(m);resources.push(geo);
  const innerGeo=new THREE.TorusGeometry(6.62,.08,6,40,arc),line=new THREE.Mesh(innerGeo,mats.glow);line.rotation.z=a;line.position.z=-.55;group.add(line);resources.push(innerGeo);
  kinetic.push({object:group,axis:'z',base:i%2*.38,amplitude:.13,phase:i*1.3,speed:.22});
 }
 for(let i=0;i<3;i++){
  const stone=mesh(new THREE.BoxGeometry(2.4,4.1,1.8),mats.concrete,'suspended-stone',[167+(i-1)*.72,12.3+i*4.8,53]);stone.rotation.z=(i-1)*.065;
  kinetic.push({object:stone,axis:'y',base:stone.position.y,amplitude:.14,phase:i*1.8,speed:.28});
 }
 for(const x of [159.8,174.2]){const anchorY=1+168*Math.sqrt(1-Math.pow((x-178.5)/39.5,2));beam('lantern','metal',[x,17,53],[x,anchorY,53],.055);}
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),grad=ctx.createRadialGradient(128,128,30,128,128,128);grad.addColorStop(0,'rgba(255,183,84,.13)');grad.addColorStop(.5,'rgba(255,183,84,.045)');grad.addColorStop(1,'rgba(255,183,84,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,256,256);
 const t=new THREE.CanvasTexture(c),mat=new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});resources.push(t,mat);mesh(new THREE.PlaneGeometry(23,23),mat,'lantern-halo',[167,17,54]);
}
// A shared sign atlas keeps every destination readable without a draw call per sign.
function streetLife(){
 const cv=document.createElement('canvas');cv.width=2048;cv.height=1024;const ctx=cv.getContext('2d');
 const labels=[
  ['06','THEORY','LIBRARY • E TO READ', '#dfb36d'],
  ['02','LISTEN','MUSIC & DISCOVERY','#acb9e3'],
  ['03','PLAY','FREE ARCADE GAMES','#e59170'],
  ['04','GALLERY','ART BY REAL PEOPLE','#e59170'],
  ['05','OVERLOOK','STAIRS TO THE LOUNGE','#80cfc0'],
  ['','READING GARDEN','WALK UP TO THE WALL • PRESS E','#dfb36d'],
  ['','FIND YOUR PLACE','L  /  OPEN THE DIRECTORY','#f0dfbc'],
  ['','THE OVERLOOK','REST • WATCH THE CITY','#80cfc0']
 ];
 labels.forEach(([n,title,sub,color],i)=>{const x=i%2*1024,y=Math.floor(i/2)*256;
  ctx.fillStyle='#13272a';ctx.fillRect(x,y,1024,256);ctx.fillStyle=color;ctx.fillRect(x,y,12,256);
  ctx.font='500 42px sans-serif';ctx.textAlign='left';ctx.fillText(n,x+48,y+68);
  ctx.font='600 66px sans-serif';ctx.fillStyle='#fff0d5';ctx.fillText(title,x+48,y+145,940);
  ctx.font='400 25px sans-serif';ctx.fillStyle=color;ctx.fillText(sub,x+48,y+211,940);
 });
 const tex=new THREE.CanvasTexture(cv);tex.encoding=THREE.sRGBEncoding;tex.anisotropy=4;resources.push(tex);
 const sm=new THREE.MeshBasicMaterial({map:tex});resources.push(sm);
 const verts=[],uvs=[],ids=[];
 function sign(i,x,y,z,w,h,ry=Math.PI){
  // Separate outward-facing quads keep the lettering correct from either side.
  for(const angle of [ry,ry+Math.PI]){const k=verts.length/3,c=Math.cos(angle),s=Math.sin(angle),u=i%2/2,v=1-Math.floor(i/2)/4;
   for(const [px,py,tu,tv]of [[-w/2,-h/2,0,-.25],[w/2,-h/2,.5,-.25],[w/2,h/2,.5,0],[-w/2,h/2,0,0]]){verts.push(x+px*c,y+py,z-px*s);uvs.push(u+tu,v+tv)}ids.push(k,k+1,k+2,k,k+2,k+3);
  }
 }
 // Suspended threshold signs distinguish the three immediate choices.
 for(const [i,x,color]of [[0,155,'amber'],[1,179,'lilac']]){
  box('life',color,x,5.6,25.5,7,.12,2.8);
  for(const px of [x-3.4,x+3.4])beam('life','metal',[px,5.6,25.5],[px,8.8,22],.045);
  sign(i,x,4.55,26.7,5.2,1.3);
  for(let n=0;n<7;n++)box('life','wood',x-3+n,5.38,25.5,.45,.1,2.6);
 }
 // Keep the axial view of the landmark open; labels belong at the entrances.
 sign(2,149,4.75,29.1,4,1,Math.PI/2);
 // The gallery already has its own clear, full-width architectural title.
 sign(4,143,4.6,28.6,5.4,1.35);for(const x of [140.4,145.6])beam('life','metal',[x,5.3,28.6],[x,9.4,22],.04);
 sign(7,140.05,9.4,54,5.5,1.375,Math.PI/2);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(ids);geo.computeVertexNormals();mesh(geo,sm,'destination-signs');
 // Seats are at the edge of the arrival and have clear approaches.
 for(const x of [160.7,173.3]){
  box('life','wood',x,1.45,28,2.7,.2,.85);box('life','terracotta',x,1.58,28,2.55,.12,.75);
  box('life','wood',x,1.97,27.6,2.7,.85,.1);for(const xx of [x-1,x+1])box('life','metal',xx,1.23,28,.12,.45,.7);
 }
 // A furnished upper refuge, under a slatted canopy tied back to the wall.
 for(const z of [49,56]){
  box('life','wood',140.85,7.43,z,.9,.24,2.4);box('life','terracotta',140.93,7.58,z,.76,.12,2.25);
  box('life','wood',140.42,7.9,z,.13,1,2.4);
  for(const dz of [-1,1])box('life','metal',140.85,7.2,z+dz,.7,.4,.1);
 }
 box('life','wood',140.9,7.73,52.5,.8,.08,1.6);box('life','metal',140.9,7.38,52.5,.1,.76,1.1);
 // Books and cups, seen close up, make the lounge read as used.
 for(let i=0;i<3;i++)box('life',i%2?'terracotta':'lilac',140.9,7.81+i*.045,52.4,.36,.045,.5,[0,i*.12,0]);
 for(const z of [52,53]){box('life','cream',141.1,7.88,z,.13,.2,.13);box('life','bronze',141.1,7.99,z,.08,.015,.08);}
 box('life','metal',142.5,11.3,53.5,5.8,.2,13);
 for(let z=47.2;z<60;z+=.5)box('life','wood',142.5,11.12,z,5.7,.14,.26);
 for(const z of [49,56]){
  beam('life','bronze',[142.5,11.2,z],[142.5,9.7,z],.04);
  box('life','cream',142.5,9.6,z,.65,.25,.65);box('life','glow',142.5,9.46,z,.5,.025,.5);
 }
 for(let z=44;z<61;z+=2)box('life','teal',145.86,7.035,z,.10,.025,.6);
 box('life','teal',143.1,7.035,43.3,2.2,.025,.08);for(let z=43.5;z<51;z+=1)box('life','teal',144.2,7.035,z,.08,.025,.45);
 for(let i=0;i<24;i++)box('life','teal',143.7,1+(i+1)*.25+.03,30+i*.5+.08,.12,.02,.2);
 // Tall textile drops soften selected galleries; rooms keep all their existing depth.
 for(const [x,z,color]of [[154,46,'terracotta'],[184,46,'lilac']]){
  box('life',color,x,13,z,1.4,7,.06);box('life','bronze',x,16.6,z,1.7,.1,.12);
  for(let n=0;n<7;n++)box('life','bronze',x-.6+n*.2,9.3,z,.03,.4,.04);
 }
 // Hanging plants occupy existing roof edges, not the circulation floor.
 for(const [x,z,y]of [[151,25.3,5.3],[183,25.3,5.3],[140.4,58.5,10.8]]){
  box('life','bronze',x,y,z,.55,.38,.55);
  for(let i=0;i<14;i++){const angle=i*2.399,dy=i*.085;box('life','leaf',x+Math.sin(angle)*.3,y-.2-dy,z+Math.cos(angle)*.3,.22,.12,.26,[0,angle,.25]);}
 }
 // A small kinetic chime over the listening canopy echoes the fractured ring.
 const chime=mesh(new THREE.TorusGeometry(.55,.035,6,24),mats.bronze,'listening-chime',[179,6.8,25.5]);
 kinetic.push({object:chime,axis:'ry',base:0,amplitude:.35,phase:0,speed:.35});
 beam('life','metal',[179,7.4,25.5],[179,8.8,22],.025);
}
function build(){
 root=new THREE.Group();root.name='common-ground-megastructure';scene.add(root);const concrete=texture('concrete'),stone=texture('stone');
 material('concrete',0xb8b3a3,.88,.02,.10,concrete);material('stone',0x62716c,.68,.08,.10,stone);material('basalt',0x263c3e,.7,.10,.13,stone);
 material('metal',0x1b3034,.6,.5,.12);material('bronze',0xb79960,.46,.65,.18);material('glass',0x1c353b,.35,.2,.18);material('darkglass',0x102b33,.4,.1,.18);material('amber',0xbc9b65,.6,.1,.8);
 material('wood',0x9c7250,.78,.04,.08);material('terracotta',0x9d5040,.85,0,.15);material('lilac',0x687aa0,.8,.05,.22);material('teal',0x80cfc0,.65,.05,.65);material('cream',0xe4d4af,.85,0,.28);material('leaf',0x507b5a,.95,0,.1);
 material('glow',0xffddb0,.5,0,1.8);material('vault',0x26393b,.9,0,.16,concrete);mats.vault.side=THREE.DoubleSide;
 for(const [z,h]of arches)arch(z,h);vault();districts();court();overlook();lantern();streetLife();
 // Broad footing collars make the structural load path explicit at eye level.
 for(const [z]of arches)for(const x of [141.5,215.5]){box('feet','basalt',x,1.6,z,3,1.2,3);for(const yy of [2.3,4.1,6])box('feet','bronze',x,yy,z,3,.07,3);}
 const geo=new THREE.BoxGeometry(1,1,1);resources.push(geo);const pose=new THREE.Object3D();let instances=0;
 for(const [key,rows]of batches){const m=new THREE.InstancedMesh(geo,mats[key.split(':')[1]],rows.length);m.name='hall-'+key;
  rows.forEach((p,i)=>{pose.position.fromArray(p.p);pose.scale.fromArray(p.s);pose.rotation.set(0,0,0);if(p.q)pose.quaternion.copy(p.q);else pose.rotation.fromArray(p.r);pose.updateMatrix();m.setMatrixAt(i,pose.matrix)});
  if(key==='floor:basalt'||key==='floor:stone')m.userData.hallFloor=rows;
  m.instanceMatrix.needsUpdate=true;if(m.computeBoundingSphere)m.computeBoundingSphere();else m.frustumCulled=false;root.add(m);instances+=rows.length;
 }batches.clear();
 // The hall's lights live outside root and are never hidden: changing how many
 // lights the scene has makes three rebuild every lit shader (~30 programs, a
 // visible hitch at the hall's edge). They fade to zero intensity instead.
 const rig=new THREE.Group();rig.name='common-ground-megastructure-lights';scene.add(rig);
 const hemi=new THREE.HemisphereLight(0xb9d6dc,0x263337,0);rig.add(hemi);
 const lamps=[];for(const [x,y,z,c,intensity,d]of [[167,20,48,0xffd29a,2.4,65],[167,7,25,0xffdfb4,1.4,28],[144,12,48,0x8ebfc6,1.2,40]]){const l=new THREE.PointLight(c,0,d,1.4);l.position.set(x,y,z);l.castShadow=false;rig.add(l);lamps.push(l)}
 lightRig={hemi,lamps,rig};API.stats={instances,batches:root.children.filter(o=>o.isInstancedMesh).length,lights:4,colliders:solids.length};
}
function dispose(){root?.traverse(o=>{if(o.isInstancedMesh)o.dispose?.()});root?.removeFromParent();lightRig?.rig.removeFromParent();for(const r of new Set(resources))r.dispose?.();resources=[];batches.clear();for(const k of Object.keys(mats))delete mats[k];scene=null;root=null;lightRig=null;floorAt=-Infinity;kinetic=[];}
function refreshFloor(){
 if(!root)return;for(const m of root.children){const rows=m.userData.hallFloor;if(!rows)continue;
 rows.forEach((r,i)=>{const ok=[[-.5,-.5],[-.5,.5],[.5,-.5],[.5,.5]].every(([dx,dz])=>isSolid(getBlock(Math.floor(r.p[0]+dx),0,Math.floor(r.p[2]+dz))));floorPose.position.fromArray(r.p);floorPose.rotation.set(0,0,0);floorPose.scale.fromArray(ok?r.s:[0,0,0]);floorPose.updateMatrix();m.setMatrixAt(i,floorPose.matrix)});m.instanceMatrix.needsUpdate=true;
 }
}
function update(){
 if(!State.scene)return;if(scene!==State.scene){dispose();scene=State.scene;seed=401;build()}
 if(performance.now()-floorAt>500){refreshFloor();floorAt=performance.now();}
 const now=performance.now()*.001,reduced=reducedMotion.matches;
 for(const k of kinetic){const value=k.base+(reduced?0:Math.sin(now*k.speed+k.phase)*k.amplitude);if(k.axis==='ry')k.object.rotation.y=value;else k.object.position[k.axis]=value;}
 const p=Player.position,dx=Math.abs(p.x-179),dz=Math.abs(p.z-36);root.visible=dx<190&&dz<170;
 blend=Math.max(0,Math.min(1,(47-dx)/8,(46-dz)/10));
 // Fog is applied through Real Light's zone hook (below), so the look table,
 // which runs after this, does not erase it.
 if(!window.FCRealLight&&blend)hallAir({fog:State.scene.fog});
 // Light sources fade outside the architectural room; static luminous trim remains.
 if(lightRig){lightRig.hemi.intensity=.38*blend;for(let i=0;i<3;i++)lightRig.lamps[i].intensity=[2.4,1.4,1.2][i]*blend;}
}
// An interior: the hall's own air, and the sun mostly kept out by the vault.
function hallAir(c){
 if(!blend)return;
 if(c.fog&&'density'in c.fog){c.fog.density=THREE.MathUtils.lerp(c.fog.density,.0030,blend);c.fog.color.lerp(fogColor,blend*.92);}
 if(c.sun)c.sun.intensity*=1-.8*blend;
}
if(window.FCRealLight)FCRealLight.zones.push(hallAir);
const API=window.FCCommonGroundMega={plan:PLAN,solids,stats:{},update,dispose,refreshFloor,get root(){return root;},get blend(){return blend;},get lights(){return lightRig;}};
const day=window.updateDayNight;if(typeof day==='function')window.updateDayNight=function(){const r=day.apply(this,arguments);update();return r};
})();
