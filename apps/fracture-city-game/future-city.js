/* Surface-owned architectural detail. Four instanced batches per chunk, no extra lights.
   Every detail belongs to a source voxel and disappears when its support changes. */
(function(){'use strict';
const F=window.FCFutureCity={maxCells:180,maxRoofCells:12};
const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle='#abb7bf';ctx.fillRect(0,0,512,512);let seed=913;
for(let i=0;i<16000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%512;seed=(Math.imul(seed,1664525)+1013904223)>>>0;ctx.fillStyle=i%2?'#ffffff12':'#15202d15';ctx.fillRect(x,seed%512,1,1+i%4)}
ctx.strokeStyle='#33434e';ctx.lineWidth=5;ctx.strokeRect(4,4,504,504);ctx.strokeStyle='#e9eef1';ctx.lineWidth=1;ctx.strokeRect(9,9,494,494);for(const x of [24,488])for(const y of [24,488]){ctx.fillStyle='#48545a';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c6d2d5';ctx.fillRect(x-2,y-1,4,1)}
const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;texture.anisotropy=4;texture.userData.shared=true;
// A cooler civic palette leaves brick, rust and player-selected pigments distinct.
BLOCKS[B_ASPHALT].color=0x3b414c;BLOCKS[B_SIDEWALK].color=0x68747d;BLOCKS[B_CONCRETE].color=0x74808b;BLOCKS[B_ROOF].color=0x414f5e;BLOCKS[B_METAL].color=0x889caa;
const windowCanvas=document.createElement('canvas');windowCanvas.width=windowCanvas.height=512;const wg=windowCanvas.getContext('2d'),wash=wg.createLinearGradient(0,0,0,512);wash.addColorStop(0,'#f6f0d7');wash.addColorStop(.65,'#b2b5a2');wash.addColorStop(1,'#5e7880');wg.fillStyle=wash;wg.fillRect(0,0,512,512);
// Recessed ceiling, a side wall, desk silhouette and a small illuminated display.
wg.fillStyle='#526872';wg.fillRect(0,0,512,42);wg.fillRect(0,0,54,512);wg.fillStyle='#e8e9db';wg.fillRect(76,55,340,10);wg.fillStyle='#435963';wg.fillRect(90,375,380,18);wg.fillRect(115,390,14,122);wg.fillRect(438,390,14,122);wg.fillStyle='#648b96';wg.fillRect(292,291,115,72);wg.fillStyle='#b0d5d1';wg.fillRect(302,301,95,48);wg.fillStyle='#455d68';wg.fillRect(342,358,12,18);wg.fillStyle='#91aaa9';wg.fillRect(66,100,8,220);wg.fillRect(472,65,6,282);
const windowTexture=new THREE.CanvasTexture(windowCanvas);windowTexture.encoding=THREE.sRGBEncoding;windowTexture.anisotropy=4;windowTexture.userData.shared=true;
const eligible=id=>[B_CONCRETE,B_BRICK,B_WIN_LIT,B_WIN_DARK].includes(id),windowBlock=id=>id===B_WIN_LIT||id===B_WIN_DARK;
const directions=[[1,0],[-1,0],[0,1],[0,-1]];
function build(chunk){if(!chunk.vox||chunk.futureSkin)return;const cells=[],buckets=[[],[],[],[]],root=new THREE.Group();root.name='future-city-skin';chunk.group.add(root);
 const materials=[new THREE.MeshStandardMaterial({color:0xa6bac5,map:texture,roughness:.5,metalness:.22,emissive:0x263d49,emissiveIntensity:.4}),new THREE.MeshStandardMaterial({color:0x386779,roughness:.22,metalness:.2,emissive:0x1d394b,emissiveIntensity:.65}),new THREE.MeshStandardMaterial({color:0x8abdbb,emissive:0x387c83,emissiveIntensity:.6,roughness:.32,metalness:.35}),new THREE.MeshStandardMaterial({map:windowTexture,emissiveMap:windowTexture,color:0xe6dfc3,emissive:0xb19e70,emissiveIntensity:.6,roughness:.45})];
 function part(cell,kind,u,v,w,h,depth=.045,offset=.025){const [dx,dz]=cell.face,alongX=!!dz,p=[cell.x+.5+dx*(.5+offset),cell.y+.5+v,cell.z+.5+dz*(.5+offset)];p[alongX?0:2]+=u;const s=alongX?[w,h,depth]:[depth,h,w];buckets[kind].push({p,s,cell});}
 // Sample actual finished buildings, including authored districts, without guessing lots.
 for(let y=4;y<Math.min(VOX_H-2,48)&&cells.length<F.maxCells;y++)for(let x=1;x<VOX_W-1&&cells.length<F.maxCells;x++)for(let z=1;z<VOX_W-1&&cells.length<F.maxCells;z++){
  const id=chunk.vGet(x,y,z);if(!eligible(id))continue;const win=windowBlock(id),wx=chunk.originX+x,wz=chunk.originZ+z;
  if(!win&&(y%3!==2||(wx+wz)%3!==0))continue;
  for(const face of directions){const [dx,dz]=face;if(chunk.vGet(x+dx,y,z+dz)!==B_AIR)continue;
   const cell={x:wx,y,z:wz,lx:x,lz:z,id,face,valid:true};cells.push(cell);
   if(win){part(cell,id===B_WIN_LIT?3:1,0,0,.91,.88,.025,.014);for(const u of [-.47,.47])part(cell,0,u,0,.055,1.02,.09,.03);for(const v of [-.47,.47])part(cell,0,0,v,.99,.055,.09,.03);part(cell,0,.13,0,.025,.9,.06,.04);if(id===B_WIN_LIT){part(cell,3,-.18,.30,.45,.055,.025,.065);part(cell,2,.28,-.28,.14,.025,.025,.065)}}
   else{part(cell,0,0,0,.86,.88,.045,.025);part(cell,1,0,-.25,.65,.045,.025,.055);if((wx*3+wz+y)%7===0)part(cell,2,-.3,.1,.035,.47,.025,.06)}
   if(cells.length>=F.maxCells)break;
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
