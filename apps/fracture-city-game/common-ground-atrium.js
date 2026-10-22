/* Common Ground 0.75: an open civic campus, not a roof over a small garden.
   Authored voxels are generated before saved edits. Player artwork and studio
   coordinates stay intact. All additions belong to streamed district chunks. */
(function(){'use strict';
function refreshFloor(chunk){const root=chunk.group?.getObjectByName('common-ground-atrium');if(!root)return;const pose=new THREE.Object3D();for(const mesh of root.children){const rows=mesh.userData?.groundRows;if(!rows)continue;rows.forEach((r,i)=>{const anchor=r.ground;const valid=!anchor||chunk.vGet(anchor.x,0,anchor.z)===anchor.id;pose.position.fromArray(r.p);pose.scale.fromArray(valid?r.s:[0,0,0]);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix)});mesh.instanceMatrix.needsUpdate=true}}
const KEYS=new Set(['6,0','7,0','6,1','7,1','8,1','6,2','7,2']);
const PALETTE={stone:0xc0c4b8,dark:0x233b43,bronze:0x99795a,wood:0x75604d,jade:0x587e74,light:0xffdeb0,glass:0x4d737c,paving:0x899993,pavingAlt:0x81928e,bark:0x737666};
const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle='#dddcd1';ctx.fillRect(0,0,512,512);let seed=72;
for(let i=0;i<24000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%512;seed=(Math.imul(seed,1664525)+1013904223)>>>0;ctx.fillStyle=i%3?'#273e4710':'#ffffff30';ctx.fillRect(x,seed%512,1,1+i%3)}
for(let i=0;i<12;i++){ctx.strokeStyle='#52626b09';ctx.beginPath();ctx.moveTo(0,i*48);ctx.bezierCurveTo(160,i*48-18,320,i*48+32,512,i*48-3);ctx.stroke()}
const stoneMap=new THREE.CanvasTexture(canvas);stoneMap.encoding=THREE.sRGBEncoding;stoneMap.anisotropy=4;stoneMap.userData.shared=true;
const generate=Chunk.prototype.generate;
Chunk.prototype.generate=function(){
 const result=generate.apply(this,arguments);if(this.landmark!=='makers'||!KEYS.has(this.key))return result;
 const chunk=this,root=new THREE.Group();root.name='common-ground-atrium';this.group.add(root);
 // Replace the accumulated trim kit, rather than burying it under another layer.
 const old=this.group.children.find(o=>o.name==='makers-mile-architecture');
 if(old){old.removeFromParent();old.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose()})}
 const local=(x,z)=>chunkCoordOf(x)===chunk.cx&&chunkCoordOf(z)===chunk.cz;
 const stamp=(x,y,z,w,h,d,id)=>chunk.stampBox(x,y,z,x+w,y+h,z+d,id);
 const mats={};for(const [name,color]of Object.entries(PALETTE))mats[name]=name==='light'?new THREE.MeshBasicMaterial({color}):new THREE.MeshStandardMaterial({color,map:['stone','paving','pavingAlt','bark'].includes(name)?stoneMap:null,roughness:name==='bronze'?.38:.72,metalness:name==='bronze'?.55:.08,emissive:color,emissiveIntensity:.12});
 const batches=new Map();
 function box(x,y,z,w,h,d,key='stone'){if(!local(x,z))return;if(!batches.has(key))batches.set(key,[]);batches.get(key).push({p:[x,y,z],s:[w,h,d],ground:y<1.08?{x:Math.floor(x)-chunk.originX,z:Math.floor(z)-chunk.originZ,id:chunk.vGet(Math.floor(x)-chunk.originX,0,Math.floor(z)-chunk.originZ)}:null})}
 function mesh(geo,mat,x,y,z){if(!local(x,z)){geo.dispose();return null}const m=new THREE.Mesh(geo,mats[mat]);m.position.set(x,y,z);root.add(m);return m}
 function sign(x,y,z,title,sub,w=6,h=.8,rot=0){if(!local(x,z))return;const c=document.createElement('canvas');c.width=1536;c.height=Math.round(1536*h/w);const g=c.getContext('2d');g.fillStyle='#233b43';g.fillRect(0,0,c.width,c.height);g.textAlign='center';g.fillStyle='#f0eee0';let size=c.height*.44;g.font='500 '+size+'px sans-serif';while(g.measureText(title).width>c.width*.92){size--;g.font='500 '+size+'px sans-serif'}g.fillText(title,c.width/2,c.height*.49);g.fillStyle='#c4bd9b';g.font=c.height*.18+'px sans-serif';g.fillText(sub,c.width/2,c.height*.80);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t}));m.position.set(x,y,z);m.rotation.y=rot;root.add(m)}
 function tree(x,z,r=2.8){stamp(x,1,z,1,5,1,128);const t=mesh(new THREE.CylinderGeometry(.73,.85,5,12),'bark',x+.5,3.5,z+.5);if(t)t.userData.fcSupport={points:[[x,1,z]]};for(const [dx,dy,dz,scale]of [[0,0,0,1],[-1.5,-.5,.5,.7],[1.3,.5,-.5,.7]]){const c=mesh(new THREE.IcosahedronGeometry(r*scale,2),'jade',x+.5+dx,6.5+dy,z+.5+dz);if(c){c.scale.y=.7;c.userData.fcSupport={points:[[x,1,z]]}}}box(x+.5,1.04,z+.5,3,.08,3,'dark');}
 function bench(x,z,w=4){stamp(x-w/2,1,z,w,1,1,130);z+=.5;box(x,2.03,z,w+.12,.06,1.12,'wood');box(x,1.1,z,w+.12,.2,1.12,'dark');for(let i=0;i<w/.22;i++)box(x-w/2+i*.22,2.07,z,.025,.018,1.05,'bronze');box(x,2.45,z+.46,w,.8,.12,'dark');}
 // Additional city blocks become a level, fully walkable court. No procedural
 // towers or roadside fixtures are generated in these reserved maker chunks.
 for(let x=144;x<216;x++)for(let z=24;z<72;z++){
  if(!local(x,z))continue;
  if(z>=48||x>=192)chunk.vSet(x-chunk.originX,0,z-chunk.originZ,134);
 }
 // Remove the old garden-edge fence posts and overhead gallery bottleneck.
 for(const x of [145,190])for(const z of [30,40])stamp(x,1,z,1,6,1,B_AIR);
 // New broad, quiet paving: shallow mesh courses, no bumps in walking collision.
 for(let x=144;x<216;x+=4)for(let z=24;z<72;z+=4){
  if(z>=30&&z<40&&x<188)continue;
  box(x+2,1.008,z+2,3.96,.012,3.96,((x+z)/4)%3===0?'pavingAlt':'paving');
 }
 // Atelier: keep its editable interior, stair, doorway and roof-run intact.
 // A deeply layered pale frontage replaces the old board-and-trim shopfront.
 for(const [x,w]of [[151,6],[161,6]]){
  box(x,2.45,20.035,w,.9,.10,'dark');
  box(x,6.5,20.035,w,1,.12,'stone');
 }
 for(const x of [148.5,153.5,158.5,163.5]){
  box(x,4.6,20.08,.4,5.2,.25,'stone');
  box(x+.18,4.6,20.24,.035,4.9,.08,'bronze');
 }
 for(const x of [148.02,163.98])box(x,4.5,12,.06,5,16,'stone');
 // Keep the studio open to the sky: the roof is an edge frame, not a solid slab.
 for(const x of [148.2,163.8])box(x,7.35,12,.45,.45,16.8,'stone');
 for(const z of [4.2,19.8])box(156,7.35,z,16.8,.45,.45,'stone');
 // Layered horizontal blades create shade and depth above the exhibition bays.
 for(let i=0;i<5;i++)box(156,7.45+i*.19,20.3-i*.38,17.4-i*.25,.12,1.4,'stone');
 box(156,7.28,21.03,16.8,.05,.08,'light');
 sign(156,6.5,20.2,'ATELIER 01','YOUR STUDIO / OPEN TO POSSIBILITY',7,.8);
 for(const x of [150,151,152,160,161,162])box(x,6.97,20.26,.10,.38,.10,'bronze');
 // A sculptural roof crest rises from the roof-walk structure across the court.
 // The elliptical shell is supported by two masonry piers, leaving the view
 // and the existing stairs clear beneath its span.
 for(const x of [173,187]){stamp(x,6,5,1,2,1,136);box(x+.5,7,5.5,1.03,2,1.03,'dark');}
 if(local(180,10)){
  const shape=new THREE.Shape();shape.absellipse(0,0,7,7,0,Math.PI,false);shape.lineTo(-6.3,0);shape.absellipse(0,0,6.3,6.3,Math.PI,0,true);shape.closePath();
  const arch=mesh(new THREE.ExtrudeGeometry(shape,{depth:1.3,bevelEnabled:true,bevelThickness:.12,bevelSize:.12,bevelSegments:2,steps:1,curveSegments:48}),'stone',180.5,8,5.5);
  if(arch){arch.name='forum-roof-crest';arch.userData.fcSupport={points:[[173,7,5],[187,7,5]]}}
 }
 for(const z of [6,9,12])box(180.5,8,z,16,.22,.28,'bronze');
 // The roof walk remains usable; its edge reads as a balcony rather than a shed.
 for(const x of [173.15,187.85]){box(x,6.65,10,.08,1.3,9,'dark');for(let z=6;z<14;z+=.5)box(x,6.65,z,.12,1.3,.05,'bronze');}
 for(const [x,w]of [[174,2],[182.5,9]])box(x,7.1,15.04,w,1.3,.1,'stone');
 sign(182.5,6.98,15.24,'THE FORUM','ROOF WALK / LISTEN / MEET',7,.7);
 // A shallow barrel-vault portico gives the studio its own silhouette.
 for(const x of [148,163]){stamp(x,7,19,1,2,1,120);box(x+.5,8,19.5,1.04,2,1.04,'stone');}
 if(local(156,19)){
  const profile=new THREE.Shape();profile.absellipse(0,0,8,2.7,0,Math.PI,false);profile.lineTo(-7.7,0);profile.absellipse(0,0,7.7,2.4,Math.PI,0,true);profile.closePath();
  const vault=mesh(new THREE.ExtrudeGeometry(profile,{depth:3.1,steps:1,bevelEnabled:true,bevelThickness:.08,bevelSize:.08,bevelSegments:2,curveSegments:40}),'stone',156,9,18.3);if(vault)vault.userData.fcSupport={points:[[148,8,19],[163,8,19]]};
 }
 // Recessed bronze fins and a continuous stone plinth finish the roof terrace.
 for(const x of [173.5,187.5])for(const z of [5.5,14.5])box(x,3,z,1.04,4,1.04,'stone');
 box(180.5,5.5,15.03,15.1,1.02,.08,'stone');
 for(let x=178.5;x<187;x+=.45)box(x,6.7,15.11,.05,1.2,.08,'bronze');
 // Low plinth hides raw timber end-grain while keeping the doorway landing.
 box(156,1.51,20.015,16,1.02,.045,'stone');
 for(const x of [148.015,163.985])box(x,1.51,12,.045,1.02,16,'stone');
 // Detailed treads and handrails follow the existing playable roof staircase.
 for(let i=0;i<5;i++)box(176.5,2.035+i,19.5-i,3,.07,.95,'stone');
 if(local(176,18))for(const x of [174.9,178.1]){
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,2.9,19.7),new THREE.Vector3(x,4.8,17.5),new THREE.Vector3(x,6.9,15.3)]);
  const rail=new THREE.Mesh(new THREE.TubeGeometry(curve,16,.055,6,false),mats.bronze);rail.userData.fcSupport={points:[[175,1,19],[175,5,15]]};root.add(rail);
 }
 // Long sheltered south gallery, with generous gaps and an open promenade.
 // Posts sit behind the exhibits; the central north-south route stays clear.
 for(const x of [145,159,187]){
  stamp(x,1,68,1,6,1,136);box(x+.5,4,68.5,1.04,6,1.04,'stone');
 }
 for(let x=144;x<192;x+=4){box(x+2,7.1,66.5,4.05,.35,7,'stone');box(x+2,6.88,63.05,3.95,.045,.06,'light');for(const z of [64,65,66,67,68,69])box(x+2,6.85,z,3.8,.14,.10,'wood');}
 for(const x of [148,153,158,163,168,173,178,183]){box(x,1.015,65,5,.025,3,'wood');box(x,6.5,67.8,4,.12,.12,'bronze');}
 sign(168,6,68.1,'THE PEOPLE’S GALLERY','REAL PEOPLE / ORIGINAL WORK / WALK UP TO SHARE',16,1.1,Math.PI);
 // Resting places face the court instead of standing in the circulation lanes.
 for(const x of [151,185])bench(x,60,4);
 for(const [x,z]of [[156,53],[181,53],[146,51],[146,59],[208,29],[208,43]])tree(x,z);
 // East water garden: a broad reflecting channel with flush, walkable banks.
 for(let x=197;x<204;x++)for(let z=31;z<47;z++){
  const rim=x===197||x===203||z===31||z===46;stamp(x,0,z,1,1,1,rim?134:B_WATER);
 }
 // Remove pavement over water; it should be water, not a glowing blue floor.
 for(const list of batches.values())for(let i=list.length-1;i>=0;i--){const r=list[i];if(r.p[1]<1.03&&r.p[0]>196&&r.p[0]<205&&r.p[2]>30&&r.p[2]<52)list.splice(i,1)}
 for(const x of [197,204])box(x,1.025,39,.08,.03,16,'bronze');
 // A public sculpture has a visible base in the water, away from all routes.
 stamp(200,1,39,1,3,1,136);
 if(local(200,39)){const geo=new THREE.TorusKnotGeometry(2.2,.22,96,8,2,3),sculpt=mesh(geo,'bronze',200.5,5,39.5);if(sculpt){sculpt.rotation.x=.35;sculpt.name='common-ground-conversation-knot'}}
 for(const z of [33,36,43,46])box(200.5,1.035,z,4.9,.015,.035,'glass');
 // Two broad routes around the reading garden lead into the new court.
 for(const x of [155,180])for(let z=40;z<60;z+=4)box(x,1.035,z,1,.025,.12,'bronze');
 for(const x of [145,211])for(const z of [27,47,63]){
  stamp(x,1,z,1,4,1,136);box(x+.5,3,z+.5,.35,4,.35,'dark');box(x+.5,5.25,z+.5,1.4,.2,1.4,'light');
 }
 // The north news pavilion keeps its existing interaction and collision wall.
 box(184.5,8.15,23,8,.3,3.5,'stone');box(184.5,7.95,24.65,7.5,.05,.08,'light');
 for(const x of [181.5,187.5])box(x,4.5,25.04,1.06,7,.10,'stone');
 // One architectural label at the arrival, not a forest of wayfinding boards.
 sign(184.5,7.35,23.12,'COMMON GROUND','READ / CREATE / STAY A WHILE',6.5,.65);
 // The new court's west edge has a planted pocket, kept out of the gallery path.
 for(const x of [148,153,158]){stamp(x,0,55,3,1,3,B_GRASS);box(x+1.5,1.03,55,3,.06,.08,'bronze');}
 for(const [key,parts]of batches){if(!parts.length)continue;const m=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mats[key],parts.length),p=new THREE.Object3D();m.name='common-ground-'+key;m.frustumCulled=false;m.userData._hdTag=1;m.userData.groundRows=parts;parts.forEach((r,i)=>{p.position.fromArray(r.p);p.scale.fromArray(r.s);p.updateMatrix();m.setMatrixAt(i,p.matrix)});root.add(m)}
 // Two shadowless pools of warm light mark the studio and gallery at night.
 for(const [x,y,z]of [[156,7,22],[168,6,64]])if(local(x,z)){const lamp=new THREE.PointLight(0xffd6a0,.8,24,2);lamp.position.set(x,y,z);lamp.visible=false;root.add(lamp);chunk.lights.push(lamp)}
 // Discard materials unused by this streamed chunk. Shared texture stays alive.
 const used=new Set();root.traverse(o=>{if(o.material)used.add(o.material)});for(const m of Object.values(mats))if(!used.has(m))m.dispose();
 return result;
};
const built=shBuildChunk;window.shBuildChunk=function(key){const result=built.apply(this,arguments);const chunk=State.chunkMap.get(key);if(chunk)refreshFloor(chunk);return result};
const dirty=Chunk.prototype.markSectionDirty;Chunk.prototype.markSectionDirty=function(){const result=dirty.apply(this,arguments);refreshFloor(this);return result};
window.FCCommonGroundPlan={bounds:{x0:144,x1:216,z0:24,z1:72},excludes:{x0:192,z0:48},area:2880,galleryZ:65,keys:[...KEYS]};
})();
