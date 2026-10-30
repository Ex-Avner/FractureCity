/* Common Ground / The Lantern Hall.
 * Grounded ribs, a rising vault, occupied side galleries and a real stair.
 * Ground features and authored architecture share collision boxes. Player
 * edits still overlay generated voxels; no save data is migrated or removed.
 */
(function(){'use strict';
if(typeof THREE==='undefined'||typeof State==='undefined')return;
const PLAN=Object.freeze({version:2,name:'The Lantern Hall',floor:1,roof:193,
 center:{x:178.5,z:36},atrium:{x0:140,x1:217,z0:-2,z1:72},
 publicLevels:[1,7],overlook:{x0:140,x1:146,z0:42,z1:62,y:7},
 stair:{x0:140,x1:144,z0:30,z1:42,rise:.25,going:.5,steps:24},
 protectedPlots:{x0:192,x1:288,z0:48,z1:120}});
let root=null,scene=null,resources=[],seed=401,lightRig=null,floorAt=-Infinity,blend=0;
const floorPose=new THREE.Object3D();
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
 lettering('THE OVERLOOK','FOLLOW THE BRASS STEPS',142,2.6,29.7,3,.8,Math.PI);
 lettering('A PLACE TO BEGIN','COMMON GROUND / LEVEL 01',139.85,8.8,52,6,1,Math.PI/2);
}
function lantern(){
 // Broken oculus, sized to be seen from the actual arrival, rather than 160m away.
 const g=new THREE.Group();g.name='the-fractured-lantern';g.position.set(167,23,54);g.rotation.y=.15;root.add(g);
 for(let i=0;i<5;i++){
  const a=i*Math.PI*2/5+.06,arc=Math.PI*2/5-.13;
  const geo=new THREE.TorusGeometry(9.5,.72,10,48,arc),m=new THREE.Mesh(geo,mats.bronze);m.rotation.z=a;m.position.z=(i%2)*.6;g.add(m);resources.push(geo);
  const innerGeo=new THREE.TorusGeometry(8.8,.10,6,48,arc),line=new THREE.Mesh(innerGeo,mats.glow);line.rotation.z=a;line.position.z=-.7+(i%2)*.6;g.add(line);resources.push(innerGeo);
 }
 // Dark vertical stone blade pierces the ring; deliberate fracture gaps remain.
 for(let i=0;i<3;i++)box('lantern','concrete',167+(i-1)*.7,17+i*6.8,54,2.8,6,2,[0,0,(i-1)*.045]);
 for(const x of [157.5,176.5]){const anchorY=1+169.2*Math.sqrt(1-Math.pow((x-178.5)/39.5,2));beam('lantern','metal',[x,23,54],[x,anchorY,54],.075);}
 // Soft halo behind the actual object; subtle and bounded, no full-screen fog cards.
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),grad=ctx.createRadialGradient(128,128,30,128,128,128);grad.addColorStop(0,'rgba(255,183,84,.10)');grad.addColorStop(.5,'rgba(255,183,84,.035)');grad.addColorStop(1,'rgba(255,183,84,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,256,256);
 const t=new THREE.CanvasTexture(c),mat=new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});resources.push(t,mat);mesh(new THREE.PlaneGeometry(29,29),mat,'lantern-halo',[167,23,55]);
}
function build(){
 root=new THREE.Group();root.name='common-ground-megastructure';scene.add(root);const concrete=texture('concrete'),stone=texture('stone');
 material('concrete',0xb8b3a3,.88,.02,.10,concrete);material('stone',0x62716c,.68,.08,.10,stone);material('basalt',0x263c3e,.7,.10,.13,stone);
 material('metal',0x1b3034,.6,.5,.12);material('bronze',0xb79960,.46,.65,.18);material('glass',0x1c353b,.35,.2,.18);material('darkglass',0x102b33,.4,.1,.18);material('amber',0xbc9b65,.6,.1,.8);
 material('glow',0xffddb0,.5,0,1.8);material('vault',0x26393b,.9,0,.16,concrete);mats.vault.side=THREE.DoubleSide;
 for(const [z,h]of arches)arch(z,h);vault();districts();court();overlook();lantern();
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
function dispose(){root?.traverse(o=>{if(o.isInstancedMesh)o.dispose?.()});root?.removeFromParent();lightRig?.rig.removeFromParent();for(const r of new Set(resources))r.dispose?.();resources=[];batches.clear();for(const k of Object.keys(mats))delete mats[k];scene=null;root=null;lightRig=null;floorAt=-Infinity;}
function refreshFloor(){
 if(!root)return;for(const m of root.children){const rows=m.userData.hallFloor;if(!rows)continue;
 rows.forEach((r,i)=>{const ok=[[-.5,-.5],[-.5,.5],[.5,-.5],[.5,.5]].every(([dx,dz])=>isSolid(getBlock(Math.floor(r.p[0]+dx),0,Math.floor(r.p[2]+dz))));floorPose.position.fromArray(r.p);floorPose.rotation.set(0,0,0);floorPose.scale.fromArray(ok?r.s:[0,0,0]);floorPose.updateMatrix();m.setMatrixAt(i,floorPose.matrix)});m.instanceMatrix.needsUpdate=true;
 }
}
function update(){
 if(!State.scene)return;if(scene!==State.scene){dispose();scene=State.scene;seed=401;build()}
 if(performance.now()-floorAt>500){refreshFloor();floorAt=performance.now();}
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
