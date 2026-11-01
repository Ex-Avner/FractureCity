/* Conservatory Garden. Reuses the former studio's art terrace and replaces the
 * Forum with planted ground. Generated before saved edits; no save migration.
 * Native, opaque instancing: no new lights, shadow maps or animation loop. */
(function(){'use strict';
const keys=new Set(['6,0','7,0']);
function refresh(c){const root=c?.group.getObjectByName('common-ground-garden');if(!root)return;for(const b of c.gardenColliders||[]){const a=b.gardenAnchor,ok=c.vGet(a[0]-c.originX,a[1],a[2]-c.originZ)===a[3],i=c.collisionAABBs.indexOf(b);if(ok&&i<0)c.collisionAABBs.push(b);else if(!ok&&i>=0)c.collisionAABBs.splice(i,1)}const pose=new THREE.Object3D();for(const mesh of root.children){const rows=mesh.userData.gardenRows;if(!rows)continue;rows.forEach((r,i)=>{const a=r.anchor,exists=!a||c.vGet(a[0]-c.originX,a[1],a[2]-c.originZ)===a[3];pose.position.fromArray(r.p);pose.rotation.set(...r.r);pose.scale.fromArray(exists?r.s:[0,0,0]);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix)});mesh.instanceMatrix.needsUpdate=true}}
const generate=Chunk.prototype.generate;
Chunk.prototype.generate=function(){
 const result=generate.apply(this,arguments);if(this.landmark!=='makers'||!keys.has(this.key))return result;
 const c=this,root=new THREE.Group();root.name='common-ground-garden';c.group.add(root);
 const local=(x,z)=>chunkCoordOf(x)===c.cx&&chunkCoordOf(z)===c.cz;
 const stamp=(x,y,z,w,h,d,id)=>c.stampBox(x,y,z,x+w,y+h,z+d,id);
 c.gardenColliders=[];
 function solid(x,y,z,w,h,d,anchor){if(local(anchor[0],anchor[2]))c.gardenColliders.push({minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2,gardenAnchor:anchor,cgGarden:true})}
 const batches=new Map(),colors={limestone:0xbfc7b1,gravel:0x8e9988,bronze:0x937b4e,bark:0x69735c,leaf:0x4f8060,sage:0x86a77a,blossom:0xd9b4bb,ivory:0xede0c3,grass:0x6f9764,lavender:0x9f94bd,wood:0x9b805a,water:0x427f79,glow:0xf4d6a0};
 function add(shape,mat,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,anchor=null){if(!local(anchor?anchor[0]:x,anchor?anchor[2]:z))return;const k=shape+':'+mat;if(!batches.has(k))batches.set(k,[]);batches.get(k).push({p:[x,y,z],s:[sx,sy,sz],r:[rx,ry,rz],anchor})}
 const box=(mat,x,y,z,w,h,d,a=null)=>add('box',mat,x,y,z,w,h,d,0,0,0,a);
 // A five-metre central walk is visible all the way through the grove. The
 // raised art terrace retains the original floor and all resident art positions.
 for(let x=144;x<192;x++)for(let z=1;z<23;z++){
  const terrace=x>=148&&x<164&&z>=4&&z<20,y=terrace?1:0;
  const lawn=terrace?(x<150||x>=162||z<6||z>=18):((x<147||x>=185)||(x>=171&&x<180&&z>3&&z<20));
  if(lawn)stamp(x,y,z,1,1,1,B_GRASS);
  if(!local(x+.5,z+.5))continue;
  const id=c.vGet(x-c.originX,y,z-c.originZ);
  box(lawn?'grass':'limestone',x+.5,y+1.012,z+.5,.99,.018,.99,[x,y,z,id]);
 }
 // Retain the terrace's entrance landing; a broad front edge reads as a garden
 // seat wall rather than the base of a demolished building.
 for(const x of [149,151,153,159,161,163])box('limestone',x,1.5,20.015,1.98,1,.07,[Math.floor(x),1,19,134]);
 box('limestone',164.025,1.5,12,.05,.99,16);
 box('limestone',148.025,1.5,12,.05,.99,16);
 // Reflecting rill with a continuous solid floor: walking into it cannot trap
 // a player. The glazed surface is only 2 cm above the existing ground plane.
 for(let x=174;x<179;x++)for(let z=5;z<19;z++){
  stamp(x,0,z,1,1,1,134);box('water',x+.5,1.025,z+.5,1,.025,1,[x,0,z,134]);
 }
 for(const x of [173.8,179.2])box('limestone',x,1.08,12,.25,.16,14.5);
 for(const z of [4.8,19.2])box('limestone',176.5,1.08,z,5.65,.16,.25);
 // A flush limestone crossing unites the two halves; no bridge or raised shell.
 for(let x=164;x<185;x++)for(let z=10;z<13;z++)box('limestone',x+.5,1.055,z+.5,.98,.035,.98);
 for(const z of [7,8.7,15,16.8]){
  add('leaf','leaf',175.2,1.07,z,.45,.025,.32);
  add('bud','ivory',175.3,1.14,z,.13,.08,.13);
 }
 // Branched trees: broad, layered crowns, not a stack of geometric balls.
 function tree(x,z,floor,flower=false,scale=1){
  const anchor=[x,floor-1,z,B_GRASS],cx=x+.5,cz=z+.5;solid(cx,floor+2,cz,.65,4,.65,anchor);
  add('trunk','bark',cx,floor+2,cz,.34,4,.34,0,0,0,anchor);
  for(let j=0;j<8;j++){
   const a=j*2.399,dx=Math.cos(a)*1.3*scale,dz=Math.sin(a)*1.3*scale;
   const direction=new THREE.Vector3(dx,1.9,dz),rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize()));
   add('trunk','bark',cx+dx*.5,floor+3.45,cz+dz*.5,.12,direction.length(),.12,rotation.x,rotation.y,rotation.z,anchor);
   for(let k=0;k<4;k++){
    const t=a+k*1.8,r=(.75+k*.53)*scale;
    add('crown',flower?(k===0?'leaf':k===3?'ivory':'blossom'):(k%2?'sage':'leaf'),cx+Math.cos(t)*r,floor+4.7+(j%3)*.25-k*.22,cz+Math.sin(t)*r,1.03*scale,.67*scale,.91*scale,.12*j,t,.15,anchor);
   }
  }
 }
 for(const [x,z,y,flower,s]of [[148,5,2,true,1.15],[162,5,2,false,1.1],[148,18,2,false,1.1],[162,18,2,true,1.15],[144,8,1,false,1.2],[144,18,1,true,1],[187,4,1,true,1.3],[188,17,1,false,1.3],[171,3,1,false,1],[171,20,1,true,.9]])tree(x,z,y,flower,s);
 // Low drifts of grasses and flowers soften the edges. They stay below waist
 // height and outside every main walk and the editable middle of the terrace.
 let seed=9041;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(const [x0,z0,w,d,y]of [[148,4,16,2,2],[148,18,6,2,2],[159,18,5,2,2],[144,3,2.5,17,1],[185,2,6,7,1],[185,14,6,7,1],[171,5,2,5,1],[171,13,2,6,1]]){
  for(let i=0;i<w*d*2;i++){
   const x=x0+rand()*w,z=z0+rand()*d,h=.22+rand()*.43;
   const ax=Math.floor(x),az=Math.floor(z),anchor=[ax,y-1,az,B_GRASS];
   add('leaf','sage',x,y+h*.4,z,.2,h,.16,0,rand()*6,rand()*.3,anchor);
   if(i%3===0)add('bud',i%2?'lavender':'ivory',x,y+h,z,.13,.18,.13,0,rand()*6,0,anchor);
  }
 }
 // Seats overlook the water and the open art lawn. All solid seat masses have
 // voxel collision; the pale tops and timber slats share instanced materials.
 function seat(x,z,w,floor=1){const anchor=[Math.floor(x),floor-1,z,c.vGet(Math.floor(x)-c.originX,floor-1,z-c.originZ)];solid(x,floor+.25,z+.5,w,.5,1,anchor);box('bronze',x,floor+.22,z+.5,w-.2,.44,.8,anchor);for(let i=0;i<5;i++)box('wood',x,floor+.49,z+.1+i*.2,w,.1,.17,anchor);box('wood',x,floor+.9,z+.94,w,.65,.10,anchor);}

 seat(184,16,2);seat(184,4,2);seat(154,6,4,2);seat(151,18,3,2);
 // Small shielded lanterns provide warm points at night using emissive meshes;
 // the existing hall lighting illuminates the planting without extra lights.
 for(const [x,z]of [[164.5,3.5],[170.5,3.5],[164.5,19.5],[170.5,19.5],[184.5,9],[184.5,14]]){
  box('bronze',x,1.65,z,.10,1.3,.10);box('glow',x,2.22,z,.25,.22,.25);box('bronze',x,2.39,z,.38,.09,.38);
 }
 if(local(167,21)){
  const sign=shSignPlane('CONSERVATORY GARDEN','FLOWERING GROVE / WATER WALK / ART TERRACE','#e5d9b8','#253e35',5.4,.66);
  sign.position.set(173,2.1,21.8);sign.rotation.y=0;root.add(sign);
  box('bronze',173,1.52,21.8,.08,1.1,.08);
 }
 // Each geometry/material combination costs one draw call per streamed chunk.
 for(const [k,rows]of batches){
  const [shape,mat]=k.split(':'),geometry=shape==='box'?new THREE.BoxGeometry(1,1,1):shape==='trunk'?new THREE.CylinderGeometry(.7,1,1,7):new THREE.IcosahedronGeometry(1,shape==='crown'?1:0);
  const material=mat==='glow'?new THREE.MeshBasicMaterial({color:colors[mat]}):new THREE.MeshStandardMaterial({color:colors[mat],roughness:mat==='water'?.22:.88,metalness:mat==='bronze'?.45:0,emissive:colors[mat],emissiveIntensity:mat==='water'?.1:.08});
  const mesh=new THREE.InstancedMesh(geometry,material,rows.length);mesh.name='garden-'+k;mesh.frustumCulled=false;mesh.userData.gardenRows=rows;root.add(mesh);
 }
 refresh(c);return result;
};
const built=shBuildChunk;window.shBuildChunk=function(k){const r=built.apply(this,arguments);refresh(State.chunkMap.get(k));return r};
const dirty=Chunk.prototype.markSectionDirty;Chunk.prototype.markSectionDirty=function(){const r=dirty.apply(this,arguments);refresh(this);return r};
window.FCConservatoryGarden={bounds:{x0:144,x1:192,z0:1,z1:23},terrace:{x0:148,x1:164,z0:4,z1:20,y:2},keys:[...keys]};
})();
