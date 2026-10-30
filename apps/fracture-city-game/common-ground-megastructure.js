/* Common Ground: the inhabited hall.
 * Architectural shell uses world-space instancing, independent of VOX_H.
 * Existing ground-level makers, gallery, plot, respawn and arcade coordinates
 * remain authoritative. Upper tiers are scenery in this first release.
 */
(function(){'use strict';
if(typeof THREE==='undefined'||typeof State==='undefined')return;
const PLAN=Object.freeze({version:1,center:{x:180,z:36},width:192,depth:144,
 atrium:{x0:132,x1:228,z0:0,z1:72},floor:1,roof:193,top:205,
 publicLevels:[1],scenicLevels:[25,49,73,97,121,145,169],
 protectedCampus:{x0:144,x1:216,z0:0,z1:72}});
let scene=null,root=null,owned=[],tex=null,inside=0;
const materials={},batches=new Map(),fogColor=new THREE.Color(0x344b53);let seed=1942;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function texture(){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.fillStyle='#c3c0b7';g.fillRect(0,0,512,512);
 for(let i=0;i<16000;i++){const k=Math.floor(145+rand()*70);g.fillStyle=`rgba(${k},${k},${k},.18)`;g.fillRect(rand()*512,rand()*512,1+rand()*2,rand()*8);}
 g.strokeStyle='#77786d';g.lineWidth=2;for(let y=0;y<512;y+=128){g.beginPath();g.moveTo(0,y);g.lineTo(512,y);g.stroke();}
 for(let x=32;x<512;x+=128)for(let y=32;y<512;y+=128){g.fillStyle='#898c82';g.beginPath();g.arc(x,y,2.2,0,Math.PI*2);g.fill();}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,2);t.anisotropy=2;
 if('colorSpace'in t&&THREE.SRGBColorSpace)t.colorSpace=THREE.SRGBColorSpace;else t.encoding=THREE.sRGBEncoding;
 return t;
}
function mat(name,color,rough=.8,metal=0,emissive=0){
 const m=new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,emissive:color,emissiveIntensity:emissive});
 if(name==='concrete'||name==='warm')m.map=tex;
 materials[name]=m;owned.push(m);return m;
}
function part(sector,material,x,y,z,w,h,d,rotation){
 const key=sector+':'+material;if(!batches.has(key))batches.set(key,[]);
 batches.get(key).push({p:[x,y,z],s:[w,h,d],r:rotation||[0,0,0]});
}
function beam(sector,material,a,b,width,depth){
 const key=sector+':'+material;if(!batches.has(key))batches.set(key,[]);
 const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),dir=vb.clone().sub(va);
 batches.get(key).push({p:va.add(vb).multiplyScalar(.5).toArray(),s:[width,dir.length(),depth||width],q:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize())});
}
function sign(text,sub,x,y,z,w,h,rot=0){
 const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*h/w);const g=c.getContext('2d');
 g.fillStyle='#152b30';g.fillRect(0,0,c.width,c.height);g.fillStyle='#c0935d';g.fillRect(0,0,9,c.height);
 g.fillStyle='#e5dfcd';g.font=`600 ${Math.floor(c.height*.32)}px sans-serif`;g.textAlign='center';g.fillText(text,512,c.height*.45,950);
 g.fillStyle='#aabeb7';g.font=`${Math.floor(c.height*.15)}px sans-serif`;g.fillText(sub,512,c.height*.79,950);
 const t=new THREE.CanvasTexture(c);if('colorSpace'in t&&THREE.SRGBColorSpace)t.colorSpace=THREE.SRGBColorSpace;else t.encoding=THREE.sRGBEncoding;
 const m=new THREE.MeshBasicMaterial({map:t}),geo=new THREE.PlaneGeometry(w,h),mesh=new THREE.Mesh(geo,m);
 mesh.position.set(x,y,z);mesh.rotation.y=rot;mesh.name='cg-wayfinding-'+text.toLowerCase().replace(/\W/g,'-');root.add(mesh);owned.push(t,m,geo);
}
function wall(sector,axis,constant,start,end,facing){
 const along=(u,y,depth,w,h,d,material)=>axis==='x'?part(sector,material,u,y,constant+depth*facing,w,h,d):part(sector,material,constant+depth*facing,y,u,d,h,w);
 // Inhabited wall begins above existing editable studios and public artwork.
 along((start+end)/2,104,-5,end-start,178,4,'dark');
 for(let u=start;u<=end;u+=24){
  along(u,100,-2,3.2,186,5.5,'concrete');
  along(u+1.8,102,.7,.24,180,.24,'copper');
 }
 for(const level of [25,49,73,97,121,145,169,193]){
  along((start+end)/2,level-.7,2,end-start,1.4,8,'concrete');
  along((start+end)/2,level-.18,6,end-start,.22,.18,'light');
  // Service belt gives structural slabs depth without a slab of uniform glow.
  along((start+end)/2,level-2,-.6,end-start,.55,.55,'steel');
 }
 for(let u=start+6;u<end;u+=6)for(let y=19;y<190;y+=6){
  const shift=(Math.floor(y/6)+Math.floor(u/6))%5;
  along(u,y,-2.7,4.9,4.8,.3,'steel');
  along(u,y+.2,-2.45,3.8,3.4,.12,shift===0?'window':shift===1?'cool':'glass');
  along(u,y,-2.27,.12,3.8,.18,'steel');
  if(shift===0){along(u,y-2,.2,5.4,.35,4.8,'warm');along(u,y-1.3,2.4,5.4,.12,.12,'copper');}
  if(shift===2)along(u,y+1.2,-2,4.4,.18,.65,'steel');
 }
 // Huge repeating diagonal transfer braces, kept high and behind the balconies.
 for(let u=start;u<end;u+=24)for(let y=49;y<170;y+=48){
  const a=axis==='x'?[u+2,y,constant-1*facing]:[constant-1*facing,y,u+2];
  const b=axis==='x'?[u+22,y+22,constant-1*facing]:[constant-1*facing,y+22,u+22];beam(sector,'steel',a,b,.6,.8);
 }
}
function build(){
 root=new THREE.Group();root.name='common-ground-megastructure';root.userData.scenic=true;scene.add(root);tex=texture();owned.push(tex);
 mat('concrete',0xb0ada2,.9,0,.12);mat('warm',0x8d8d7e,.87,0,.14);mat('dark',0x283c40,.88,0,.15);
 mat('steel',0x33484b,.58,.48,.1);mat('copper',0xa68150,.5,.55,.18);mat('glass',0x24464e,.35,.1,.25);
 mat('window',0xdbc29a,.65,0,.65);mat('cool',0x729b9d,.65,0,.4);mat('light',0xf2d7a6,.6,0,.8);
 wall('north','x',0,132,228,1);wall('south','x',72,132,228,-1);
 wall('west','z',132,0,72,1);wall('east','z',228,0,72,-1);
 // The full envelope is occupied perimeter mass; the inner walls describe the void.
 for(const z of [-24,96])part('roof','dark',180,104,z,192,178,24);
 for(const x of [102,258])part('roof','dark',x,104,36,36,178,96);
 // Megapiers land outside the protected campus, with no intrusion into its paths.
 // They stop at +15 where legacy street geometry supplies the lower podium.
 for(const x of [132,228])for(const z of [0,24,48,72]){
  part('piers','concrete',x,104,z,4,178,5);part('piers','steel',x,27,z,6,3,7);
 }
 // Roof ring and skylight; a luminous opening is framed by visible trusses.
 part('roof','concrete',180,195,-6,192,4,60);part('roof','concrete',180,195,78,192,4,60);
 for(const x of [120,240])part('roof','concrete',x,195,36,72,4,24);
 part('roof','cool',180,204,36,48,.3,24);
 for(let x=132;x<=228;x+=24){
  beam('roof','steel',[x,193,0],[x,193,72],.7);beam('roof','steel',[x,203,0],[x,203,72],.7);
  for(let z=0;z<72;z+=12){beam('roof','steel',[x,193,z],[x,203,z+12],.45);beam('roof','steel',[x,203,z],[x,193,z+12],.45);}
 }
 // Two heavy bridge silhouettes, with regular bearings and under-deck triangulation.
 for(const z of [12,60]){
  part('bridges','warm',180,48.5,z,96,1,6);
  for(const zz of [z-2.8,z+2.8]){
   part('bridges','steel',180,46.2,zz,96,.35,.35);part('bridges','copper',180,50.3,zz,96,.12,.12);
   for(let x=132;x<228;x+=6){beam('bridges','steel',[x,46,zz],[x+6,48,zz],.18);part('bridges','steel',x,49.65,zz,.12,1.3,.12);}
  }
  for(const x of [134,226])part('bridges','concrete',x,46,z,4,3,8);
 }
 // F1: three deliberately unsupported fragments. All other structures have bearings.
 part('crown','concrete',173,164,33,12,9,18,[.03,0,-.1]);
 part('crown','warm',186,168,36,10,12,18,[0,.04,.12]);
 part('crown','concrete',198,170,38,8,10,15,[.05,-.06,-.06]);
 for(const x of [179.8,191.3])part('crown','light',x,166,35,.25,9,17,[0,0,.1]);
 // F2: a displaced, broken room high on the west wall.
 part('fracture','concrete',141,114,27,8,.5,9,[0,0,.13]);
 part('fracture','warm',138,117,27,.5,6,9,[0,0,.13]);
 part('fracture','light',141,114.4,23,.1,.15,7,[0,0,.13]);
 // Building-scale signage belongs above the existing human-scale campus signs.
 sign('COMMON GROUND','A CITY WITHIN / EVERYONE BELONGS',180,18,68.8,36,4.5,Math.PI);
 sign('01 / ATELIER','MAKE / EXHIBIT / EXCHANGE',156,14,3.8,21,3.2);
 sign('02 / FORUM','MEET / LISTEN / STAY',207,18,3.8,18,3);
 sign('03 / GARDEN','READ / REST / RETURN',224.8,18,39,22,3,-Math.PI/2);
 // Deterministic instance batches: one draw per material per architectural sector.
 const geometry=new THREE.BoxGeometry(1,1,1);owned.push(geometry);const pose=new THREE.Object3D();let count=0;
 for(const [key,items]of batches){
  const mesh=new THREE.InstancedMesh(geometry,materials[key.split(':')[1]],items.length);mesh.name='cg-'+key;mesh.userData.scenic=true;
  items.forEach((p,i)=>{pose.position.fromArray(p.p);pose.scale.fromArray(p.s);pose.rotation.set(0,0,0);if(p.q)pose.quaternion.copy(p.q);else pose.rotation.fromArray(p.r);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix)});
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.computeBoundingSphere)mesh.computeBoundingSphere();else mesh.frustumCulled=false;
  mesh.castShadow=false;mesh.receiveShadow=false;root.add(mesh);count+=items.length;
 }
 batches.clear();
 const hemi=new THREE.HemisphereLight(0xe2e7dc,0x53676a,.55);root.add(hemi);
 const lamp=new THREE.PointLight(0xffd9a3,.8,95,1.3);lamp.position.set(180,38,36);root.add(lamp);
 API.stats={instances:count,batches:root.children.filter(o=>o.isInstancedMesh).length,lights:2,scenic:true};
}
function dispose(){
 root?.traverse(o=>{if(o.isInstancedMesh)o.dispose?.()});root?.removeFromParent();for(const resource of new Set(owned))resource.dispose?.();owned=[];batches.clear();for(const k of Object.keys(materials))delete materials[k];root=null;tex=null;scene=null;inside=0;
}
function update(){
 if(!State.scene)return;if(scene!==State.scene){dispose();scene=State.scene;seed=1942;build();}
 const p=typeof Player!=='undefined'?Player.position:null;if(!p){root.visible=false;return;}
 const dx=Math.abs(p.x-180),dz=Math.abs(p.z-36);root.visible=dx<240&&dz<216;
 inside=Math.max(0,Math.min(1,(66-dx)/14,(54-dz)/14));
 // Day/night first computes the ordinary city fog; only the local hall reduces it.
 // No permanent edits to the shared sky palette or the user's display settings.
 if(inside&&State.scene.fog&&'density'in State.scene.fog){State.scene.fog.density*=1-inside*.72;State.scene.fog.color.lerp(fogColor,inside*.75);}
}
const API=window.FCCommonGroundMega={plan:PLAN,stats:{},update,dispose,get root(){return root;}};
const day=window.updateDayNight;if(typeof day==='function')window.updateDayNight=function(){const value=day.apply(this,arguments);update();return value;};
// Initial install is also explicit for tests and paused photo views.
})();
