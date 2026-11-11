/* Surface-owned architectural detail. Four instanced batches per chunk, no extra lights.
   Every detail belongs to a source voxel and disappears when its support changes. */
(function(){'use strict';
const F=window.FCFutureCity={maxCells:180,maxRoofCells:12};
const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle='#ded5bd';ctx.fillRect(0,0,512,512);let seed=913;
for(let i=0;i<16000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%512;seed=(Math.imul(seed,1664525)+1013904223)>>>0;ctx.fillStyle=i%2?'#ffffff12':'#15202d15';ctx.fillRect(x,seed%512,1,1+i%4)}
ctx.strokeStyle='#90816a';ctx.lineWidth=2;ctx.strokeRect(4,4,504,504);ctx.strokeStyle='#e9eef1';ctx.lineWidth=1;ctx.strokeRect(9,9,494,494);
const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;texture.anisotropy=4;texture.userData.shared=true;
// Shared street palette: basalt, pale paving, limestone and patinated metal.
BLOCKS[B_ASPHALT].color=0x303c40;BLOCKS[B_SIDEWALK].color=0x9a9b8c;BLOCKS[B_CONCRETE].color=0xb6af9b;BLOCKS[B_ROOF].color=0x3e5550;BLOCKS[B_METAL].color=0x8c998f;
const windowCanvas=document.createElement('canvas');windowCanvas.width=windowCanvas.height=512;const wg=windowCanvas.getContext('2d'),wash=wg.createLinearGradient(0,0,0,512);wash.addColorStop(0,'#f6f0d7');wash.addColorStop(.65,'#b2b5a2');wash.addColorStop(1,'#5e7880');wg.fillStyle=wash;wg.fillRect(0,0,512,512);
// Recessed ceiling, a side wall, desk silhouette and a small illuminated display.
wg.fillStyle='#526872';wg.fillRect(0,0,512,42);wg.fillRect(0,0,54,512);wg.fillStyle='#e8e9db';wg.fillRect(76,55,340,10);wg.fillStyle='#435963';wg.fillRect(90,375,380,18);wg.fillRect(115,390,14,122);wg.fillRect(438,390,14,122);wg.fillStyle='#648b96';wg.fillRect(292,291,115,72);wg.fillStyle='#b0d5d1';wg.fillRect(302,301,95,48);wg.fillStyle='#455d68';wg.fillRect(342,358,12,18);wg.fillStyle='#91aaa9';wg.fillRect(66,100,8,220);wg.fillRect(472,65,6,282);
const windowTexture=new THREE.CanvasTexture(windowCanvas);windowTexture.encoding=THREE.sRGBEncoding;windowTexture.anisotropy=4;windowTexture.userData.shared=true;
const eligible=id=>[B_CONCRETE,B_BRICK,B_WIN_LIT,B_WIN_DARK,80,81,82,84,86].includes(id),windowBlock=id=>[B_WIN_LIT,B_WIN_DARK,80,81].includes(id);
const litBlock=id=>id===B_WIN_LIT||id===81;
const rank=(x,y,z,side)=>{let n=Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791)^Math.imul(side+1,2654435761);n=Math.imul(n^(n>>>16),2246822507);return (n^(n>>>13))>>>0};
const directions=[[1,0],[-1,0],[0,1],[0,-1]];
function build(chunk){if(!chunk.vox||chunk.futureSkin)return;const cells=[],buckets=[[],[],[],[]],root=new THREE.Group();root.name='future-city-skin';chunk.group.add(root);
 const materials=[new THREE.MeshStandardMaterial({color:0xd5c9ac,map:texture,roughness:.82,metalness:.04}),new THREE.MeshStandardMaterial({color:0x35514e,roughness:.3,metalness:.3}),new THREE.MeshStandardMaterial({color:0xb29a6a,roughness:.36,metalness:.55}),new THREE.MeshStandardMaterial({map:windowTexture,emissiveMap:windowTexture,color:0xe6dfc3,emissive:0xb19e70,emissiveIntensity:.6,roughness:.45})];
 function part(cell,kind,u,v,w,h,depth=.045,offset=.025){const [dx,dz]=cell.face,alongX=!!dz,p=[cell.x+.5+dx*(.5+offset),cell.y+.5+v,cell.z+.5+dz*(.5+offset)];p[alongX?0:2]+=u;const s=alongX?[w,h,depth]:[depth,h,w];buckets[kind].push({p,s,cell});}
 // Collect exposed supported faces, then distribute the bounded detail budget
 // across the whole elevation. The old bottom-up loop starved every upper floor.
 const candidates=[];
 for(let y=4;y<VOX_H-2;y++)for(let x=1;x<VOX_W-1;x++)for(let z=1;z<VOX_W-1;z++){
  const id=chunk.vGet(x,y,z);if(!eligible(id))continue;
  const win=windowBlock(id),wx=chunk.originX+x,wz=chunk.originZ+z;
  if(!win&&y%3!==2)continue;
  directions.forEach((face,side)=>{if(chunk.vGet(x+face[0],y,z+face[1])!==B_AIR)return;
   candidates.push({x:wx,y,z:wz,lx:x,lz:z,id,face,valid:true,rank:rank(wx,y,wz,side)});
  });
 }
 candidates.sort((a,b)=>a.rank-b.rank);
 for(const cell of candidates.slice(0,F.maxCells)){
  cells.push(cell);const win=windowBlock(cell.id);
  if(win){
   // A recessed room, paired stone jambs, bronze transom and projecting sill.
   part(cell,litBlock(cell.id)?3:1,0,0,.88,.89,.025,.014);
   for(const u of [-.46,.46])part(cell,0,u,0,.075,1,.18,.065);
   part(cell,0,0,-.46,1,.10,.25,.09);
   part(cell,2,0,.46,.98,.055,.14,.065);
   part(cell,2,.12,0,.035,.88,.08,.06);
   // A small hood shades the glazing, with its extent inside the source tile.
   part(cell,0,0,.40,.96,.08,.32,.13);
  }else{
   // Fluted stone and bronze joints replace the unrelated bolted metal squares.
   for(const u of [-.29,0,.29])part(cell,0,u,0,.15,.96,.13,.055);
   part(cell,2,0,-.46,.96,.035,.07,.05);
  }
 }
 // Compact roof machinery sits on its own support tile, never above an empty lot.
 let roofCount=0;
 for(let x=3;x<VOX_W-3&&roofCount<F.maxRoofCells;x+=4)for(let z=3;z<VOX_W-3&&roofCount<F.maxRoofCells;z+=4){for(let y=VOX_H-3;y>=7;y--){if(chunk.vGet(x,y,z)!==B_ROOF||chunk.vGet(x,y+1,z)!==B_AIR)continue;const cell={x:chunk.originX+x,y,z:chunk.originZ+z,lx:x,lz:z,id:B_ROOF,face:[0,0],roof:true,valid:true};cells.push(cell);roofCount++;const put=(kind,py,w,h,d,dx=0,dz=0)=>buckets[kind].push({p:[cell.x+.5+dx,y+1+py,cell.z+.5+dz],s:[w,h,d],cell});put(0,.12,.82,.24,.82);put(1,.26,.66,.035,.66);for(const dx of [-.22,0,.22])put(0,.3,.045,.055,.6,dx);put(2,.15,.5,.025,.025,0,-.42);break}}
 buckets.forEach((rows,i)=>{if(!rows.length){materials[i].dispose();return}const mesh=new THREE.InstancedMesh(G.unitBox,materials[i],rows.length);mesh.frustumCulled=false;mesh.userData.futureRows=rows;mesh.userData._hdTag=1;root.add(mesh)});
 chunk.futureSkin={root,cells};chunk.futureDirty=true;update(chunk);
}
function update(chunk){const skin=chunk.futureSkin;if(!skin)return;for(const c of skin.cells)c.valid=chunk.vGet(c.lx,c.y,c.lz)===c.id&&chunk.vGet(c.lx+c.face[0],c.y+(c.roof?1:0),c.lz+c.face[1])===B_AIR;
 const pose=new THREE.Object3D();for(const mesh of skin.root.children){mesh.userData.futureRows.forEach((row,i)=>{pose.position.fromArray(row.p);pose.scale.fromArray(row.cell.valid?row.s:[0,0,0]);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix)});mesh.instanceMatrix.needsUpdate=true}chunk.futureDirty=false;
}
const generate=Chunk.prototype.generate;Chunk.prototype.generate=function(){const result=generate.apply(this,arguments);build(this);return result};
const built=shBuildChunk;window.shBuildChunk=function(key){const r=built.apply(this,arguments),chunk=State.chunkMap.get(key);if(chunk?.futureSkin)update(chunk);return r};
const dirty=Chunk.prototype.markSectionDirty;Chunk.prototype.markSectionDirty=function(){this.futureDirty=true;return dirty.apply(this,arguments)};
let last=0;function tick(t){requestAnimationFrame(tick);if(t-last<200)return;last=t;for(const chunk of State.chunkMap.values()){if(!chunk.futureSkin)continue;if(chunk.futureDirty)update(chunk);const distance=Math.hypot(Player.position.x-chunk.worldX,Player.position.z-chunk.worldZ);chunk.futureSkin.root.visible=distance<(HD.tier==='perf'?45:HD.tier==='balanced'?85:125)}}requestAnimationFrame(tick);
Object.assign(F,{build,update,texture});
})();
