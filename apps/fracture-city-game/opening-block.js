/* Authored Civic Core frontage. Voxel sidewalks respect subsequent save edits. */
(function(){
'use strict';
const A=window.FCOpeningBlock={version:'0.43.0',built:0};
// Legacy social echoes were display avatars in the carriageway. Story actors
// belong to the prologue and repair systems and are not in this collection.
window.shSpawnEchoes=function(){for(const e of SHIFT_WORLD.echoes)e.char.group.removeFromParent();SHIFT_WORLD.echoes=[]};
for(let i=SH_HOTSPOTS.length-1;i>=0;i--)if(['echo-mara','echo-rook','echo-inez'].includes(SH_HOTSPOTS[i].id))SH_HOTSPOTS.splice(i,1);
const core=new Set(['fcn','bureau','club','apartment']);
const generate=Chunk.prototype.generateLandmark;
Chunk.prototype.generateLandmark=function(spec){
 const result=generate.apply(this,arguments);if(!core.has(spec.id))return result;
 const x=this.worldX,z=this.worldZ,sx=x<0?1:-1,sz=z<0?1:-1;
 // A two-metre extension toward the intersection; a six-metre clear street remains.
 // Replace metre-wide paint bands with narrow surface markings below.
 for(let lx=0;lx<VOX_W;lx++)for(let lz=0;lz<VOX_W;lz++)if(this.vGet(lx,0,lz)===B_PAINT)this.vSet(lx,0,lz,B_ASPHALT);
 const edgeX=x+sx*7,edgeZ=z+sz*7;
 // The Bureau's old eleven-metre neon monoliths stood in the carriageway.
 // Remove generated pylons before applyEdits, preserving players' saved changes.
 if(spec.id==='bureau'){
  for(const zz of [z-7,z+6])this.stampBox(x-11,2,zz,x-10,13,zz+1,B_AIR);
  // Replace the portico's two-block ledge and roadside columns with a walkable
  // forecourt. A shallow stair at the recessed doorway retains access inside.
  this.stampBox(x-10,2,z-6,x-7,12,z+6,B_AIR);
  this.stampBox(x-8,2,z-2,x-7,3,z+2,B_CONCRETE);
  for(const child of [...this.group.children])if(Math.abs(child.position.x-(x-10.1))<.02&&Math.abs(child.position.y-13.6)<.02){this.group.remove(child);child.material?.map?.dispose();child.material?.dispose();}
 }
 this.stampBox(Math.min(edgeX,edgeX+sx*2),1,z-7,Math.max(edgeX,edgeX+sx*2),2,z+7,B_SIDEWALK);
 this.stampBox(x-7,1,Math.min(edgeZ,edgeZ+sz*2),x+7,2,Math.max(edgeZ,edgeZ+sz*2),B_SIDEWALK);
 return result;
};
function install(chunk){
 if(chunk._openingStyle||!core.has(chunk.landmark))return;chunk._openingStyle=true;A.built++;
 const root=new THREE.Group();root.name='civic-authored-frontage';chunk.group.add(root);
 const materials=new Map(),batches=new Map();
 function material(hex,glow=false){const key=hex+':'+glow;if(!materials.has(key))materials.set(key,glow?new THREE.MeshBasicMaterial({color:hex}):new THREE.MeshStandardMaterial({color:hex,roughness:.55,metalness:.3}));return materials.get(key)}
 function box(x,y,z,w,h,d,color,glow=false){const key=color+':'+glow;if(!batches.has(key))batches.set(key,[]);batches.get(key).push([x,y,z,w,h,d]);material(color,glow)}
 const x=chunk.worldX,z=chunk.worldZ,sx=x<0?1:-1,sz=z<0?1:-1;
 const style={fcn:{name:'FCN',sub:'CITY SIGNAL / BROADCAST DESK',accent:0x65f1e0,ink:'#76f5df'},bureau:{name:'BUREAU',sub:'NARRATIVE MITIGATION / WINDOW THREE',accent:0xf3bf78,ink:'#f3bf78'},club:{name:'THE RESIDUE ROOM',sub:'LATE SETS / EARLY REGRETS',accent:0xff5b9e,ink:'#ff79ac'},apartment:{name:'ECHO HEIGHTS',sub:'RESIDENCE 14 / YOU ARE HOME',accent:0xa2b7ff,ink:'#b2caff'}}[chunk.landmark];
 // Local frontage coordinates: u travels along a wall, v projects into the pavement.
 function face(axis){
  const side=axis==='x'?sx:sz;
  const at=(u,y,v)=>axis==='x'?[x+side*(7+v),y,z+u]:[x+u,y,z+side*(7+v)];
  const part=(u,y,v,w,h,d,color,glow=false)=>{const p=at(u,y,v);box(...p,...(axis==='x'?[d,h,w]:[w,h,d]),color,glow)};
  function sign(title,sub,u,y,v,w,h,fg=style.ink){const p=at(u,y,v),s=shSignPlane(title,sub,fg,'#101922',w,h);s.position.set(...p);s.rotation.y=axis==='x'?side*Math.PI/2:side===1?0:Math.PI;root.add(s);}
  // Brass reveals, dark ceramic pilasters, cornices and slender light channels.
  for(const u of [-6.6,-4.5,4.5,6.6]){
   part(u,5.35,.10,.22,6.7,.18,0x263c46);part(u,5.35,.21,.055,6.5,.035,0xb0986b);
   part(u,8.65,.13,.48,.2,.27,0xb0986b);
  }
  for(const y of [2.12,6.2,8.8,11.85])part(0,y,.12,13.5,.15,.24,0x40535b);
  part(0,6.37,.25,13.2,.055,.06,style.accent,true);
  // Recessed display windows flank the existing entrance; never close a doorway.
  for(const u of [-5.45,5.45]){
   part(u,3.95,.045,1.55,2.9,.035,0x142731);
   for(const a of [-.8,.8])part(u+a,3.95,.09,.06,3,.08,0xb0986b);
   for(const y of [2.48,5.42])part(u,y,.09,1.65,.06,.08,0xb0986b);
   part(u,4.65,.10,1.5,.045,.08,style.accent,true);
   for(let k=0;k<3;k++)part(u-.45+k*.45,3.05,.1,.24,.35+k*.12,.12,0x896c50);
   sign(chunk.landmark==='club'?'TONIGHT':chunk.landmark==='fcn'?(u<0?'01 / BROADCAST':'02 / RESIDENTS'):'OPEN',chunk.landmark==='fcn'?(u<0?'NED / CITY NEWS':'COMMON GROUND / MAKERS MILE'):'CIVIC CORE',u,4.02,.12,1.3,.66);
  }
  // High canopy, leaving the whole walking surface and interaction radii clear.
  part(0,6.02,.58,7.9,.18,1.15,0x172b36);part(0,5.93,1.14,7.9,.055,.06,style.accent,true);
  for(const u of [-3,-1,1,3])part(u,5.91,.58,.4,.025,.65,0xffd8a0,true);
  if(!(chunk.landmark==='fcn'&&axis==='x'))sign(style.name,style.sub,0,7.43,.18,7.8,1.75);
  // Facade rhythm above street level; no extra point lights or shadow maps.
  const max=chunk.landmark==='apartment'?24:chunk.landmark==='bureau'?13:11;
  for(let y=10;y<max;y+=3)for(const u of [-5.4,-3.4,3.4,5.4]){
   part(u,y,.07,1.3,1.8,.06,0x263c48);part(u,y-.85,.15,1.48,.08,.24,0x8c846c);
   part(u,y,.12,.055,1.7,.05,0x786e56);
  }
  // Flush sidewalk inlays and drainage strips. These cannot trap a skateboard.
  part(0,2.012,1.72,13.7,.012,.12,0x444d50);
  for(let u=-6.5;u<7;u+=.7)part(u,2.018,1.3,.025,.01,1.1,0x535b5c);
  sign(axis==='x'?'SURFACE AVENUE':'CIVIC CROSSING','BROADCAST / GALLERY / NIGHT MARKET',-5.1,6.7,.2,2.5,.45,'#e3e1cf');
 }
 face('x');face('z');
 // Flush zebra crossings and broken lane marks leave the whole road passable.
 const roadX=x+sx*11.7,roadZ=z+sz*11.7;
 for(let j=0;j<4;j++){
  box(roadX,1.012,z-5+j*3,.09,.018,1.25,0xc0bca7);
  box(x-5+j*3,1.012,roadZ,1.25,.018,.09,0xc0bca7);
 }
 for(let j=0;j<3;j++){
  box(x+sx*(9+j*.85),1.014,z+sz*7,.42,.018,1.7,0xd3d0ba);
  box(x+sx*7,1.014,z+sz*(9+j*.85),1.7,.018,.42,0xd3d0ba);
 }
 // Art-deco crown around the existing FCN screen and mast.
 if(chunk.landmark==='fcn'){
  for(const u of [-5.7,5.7])box(x+7.15,9.5,z+u,.2,4,.14,0xb0986b);
  for(const y of [7.58,11.42])box(x+7.15,y,z,.2,.12,11.5,style.accent,true);
  for(const dx of [-2.3,2.3]){box(x+dx,23,z,.16,20,.16,0x314652);box(x+dx,23,z+.11,.04,19,.04,style.accent,true)}
  const s=shSignPlane('FCN','CITY SIGNAL / NEWS + RESIDENT VOICES','#76f5df','#0b1720',5,1.6);s.position.set(x+2.15,16,z);s.rotation.y=Math.PI/2;root.add(s);
 }
 // Batched architectural detail keeps hundreds of trim pieces to a few draws.
 const matrix=new THREE.Matrix4(),q=new THREE.Quaternion();
 for(const [key,items] of batches){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),materials.get(key),items.length);items.forEach((p,i)=>{matrix.compose(new THREE.Vector3(...p.slice(0,3)),q,new THREE.Vector3(...p.slice(3)));mesh.setMatrixAt(i,matrix)});mesh.receiveShadow=true;mesh.castShadow=false;root.add(mesh)}
 chunk._openingRoot=root;
}
const detail=shRunPendingDetail;window.shRunPendingDetail=function(chunk){const result=detail.apply(this,arguments);install(chunk);return result};
// Also runs before the prologue pauses, when deferred details are not ticking.
const build=shBuildChunk;window.shBuildChunk=function(){const result=build.apply(this,arguments);const chunk=State.chunkMap.get(arguments[0]);if(chunk)install(chunk);return result};
// Ambient pedestrians stay out of the opening tableau. Authored witnesses,
// keeper, Wardens and quest actors are managed separately and remain present.
const npcUpdate=NPC.prototype.update;NPC.prototype.update=function(){const r=npcUpdate.apply(this,arguments);if(this.char&&FN.prologue&&Math.abs(this.position.x)<23&&Math.abs(this.position.z)<23){if(this._openingHidden===undefined)this._openingHidden=this.char.group.visible;this.char.group.visible=false}else if(this._openingHidden!==undefined&&this.char){this.char.group.visible=this._openingHidden;delete this._openingHidden}return r};
A.install=install;
})();
