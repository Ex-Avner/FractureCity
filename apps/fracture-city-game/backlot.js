/* The Backlot (0.92): the Soundstage gets a building.

   The Soundstage shipped in 0.88 as a button at the bottom of the Tools tray
   and an F9 key, so nobody found it. This gives it a place: a film lot on the
   two blocks south of the Church of Omnism (chunks 3..4 × 2), with a stage
   hangar, a lit ON AIR lamp, a camera on its tripod and a director's chair.
   Walk up to the camera and press E (or tap the prompt) to start filming.
   The hangar's empty floor is a set: scenes can be blocked right there.

   The Tools tray entry moves to the top of the tray and says what it does. */
(function(){'use strict';
if (typeof THREE === 'undefined' || typeof State === 'undefined' || typeof Chunk === 'undefined') return;

const KEYS = new Set(['3,2', '4,2']);
const IN = { x0: 77, x1: 115, z0: 53, z1: 67 };      // inside the road ring
const HALL = { x0: 92, x1: 114, z0: 54, z1: 66 };     // the stage hangar
const DOOR = { x0: 98, x1: 108, h: 6 };               // north door, faces the church
const FLOOR = 2, ROOF = 10;
const CAM = { x: 103, z: 58.6 };                      // the camera, just inside the door
const inside = (x, z) => x >= IN.x0 && x < IN.x1 && z >= IN.z0 && z < IN.z1;
const inHall = (x, z) => x >= HALL.x0 && x < HALL.x1 && z >= HALL.z0 && z < HALL.z1;

const B_STAGE = shDefBlock(174, { name: 'stage wall', solid: true, emit: false, color: 0x87978b, grain: 0.05 });
const B_STAGE_FLOOR = shDefBlock(175, { name: 'stage floor', solid: true, emit: false, color: 0x9a958a, grain: 0.04 });
const B_LOT = shDefBlock(176, { name: 'lot concrete', solid: true, emit: false, color: 0x9a9b8c, grain: 0.09 });
if (typeof MATERIALS !== 'undefined'){
 MATERIALS[B_STAGE] = { label: 'Stage Wall', cls: 'metal', hardness: 3, drop: B_STAGE, yield: 1, value: 4, desc: 'Sound-deadened steel from the Backlot hangar.' };
 MATERIALS[B_STAGE_FLOOR] = { label: 'Stage Floor', cls: 'stone', hardness: 2, drop: B_STAGE_FLOOR, yield: 1, value: 3, desc: 'Smooth, painted, covered in old tape marks.' };
 MATERIALS[B_LOT] = { label: 'Lot Concrete', cls: 'stone', hardness: 2, drop: B_LOT, yield: 1, value: 2, desc: 'The Backlot apron.' };
}

const generate = Chunk.prototype.generate;
Chunk.prototype.generate = function(){
 if (!KEYS.has(this.key)) return generate.apply(this, arguments);
 this._maker = true; this.__cityFitted = 1; this.landmark = 'backlot'; this._parked = true;
 const ox = this.originX, oz = this.originZ;
 for (let lx = 0; lx < VOX_W; lx++) for (let lz = 0; lz < VOX_W; lz++){
  const x = ox + lx, z = oz + lz;
  if (!inside(x, z)){ this.vSet(lx, 0, lz, (lz === 1 || lx === 1) ? B_PAINT : B_ASPHALT); continue; }
  this.vSet(lx, 0, lz, B_CONCRETE);
  //  The apron: concrete with painted parking bays west of the hangar.
  if (!inHall(x, z)){ this.vSet(lx, 1, lz, (x < 90 && (x - 77) % 4 === 0 && z > 55 && z < 65) ? B_PAINT : B_LOT); continue; }
  this.vSet(lx, 1, lz, B_STAGE_FLOOR);
  const wall = x === HALL.x0 || x === HALL.x1 - 1 || z === HALL.z0 || z === HALL.z1 - 1;
  const door = z === HALL.z0 && x >= DOOR.x0 && x < DOOR.x1;
  for (let y = FLOOR; y <= ROOF; y++){
   if (y === ROOF) continue;   //  the roof is a mesh: voxels under a voxel roof see no sky and render black
   if (!wall) continue;
   if (door && y < FLOOR + DOOR.h) continue;
   this.vSet(lx, y, lz, y === FLOOR + DOOR.h && door ? B_METAL : B_STAGE);
  }
 }
 if (chunkCoordOf(CAM.x) === this.cx && chunkCoordOf(CAM.z) === this.cz){
  this.collisionAABBs.push({ minX: CAM.x - .45, maxX: CAM.x + .45, minZ: CAM.z - .45, maxZ: CAM.z + .45, minY: FLOOR, maxY: FLOOR + 1.6, backlot: true });
  this.collisionAABBs.push({ minX: CAM.x + 1.2, maxX: CAM.x + 2, minZ: CAM.z - .4, maxZ: CAM.z + .4, minY: FLOOR, maxY: FLOOR + 1.1, backlot: true });
 }
};

// ─── Props ─────────────────────────────────────────────────────────────────
let root = null, scene = null, onAir = null, onAirMat = null;
const res = [];
function canvasTex(w, h, paint){ const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; res.push(t); return t; }
function build(){
 if (root && scene === State.scene){ if (root.parent !== scene) scene.add(root); return; }
 if (root) dispose();
 scene = State.scene; root = new THREE.Group(); root.name = 'backlot'; scene.add(root);
 const M = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: .6, ...o }); res.push(m); return m; };
 const black = M(0x18191c, { metalness: .4, roughness: .45 }), steel = M(0x8a8f96, { metalness: .7, roughness: .35 }), canvas = M(0x7a2d22, { roughness: .9 }), wood = M(0x5a4030, { roughness: .8 });
 const glowW = new THREE.MeshBasicMaterial({ color: 0xfff2dc }); res.push(glowW);
 onAirMat = new THREE.MeshBasicMaterial({ color: 0x3a0d0d }); res.push(onAirMat);
 const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); root.add(o); res.push(g); return o; };
 //  Sign over the door, outside.
 const sign = canvasTex(1024, 200, (g, w, h) => {
  g.fillStyle = '#141518'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9b46a'; g.lineWidth = 5; g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = '#f2e7cf'; g.textAlign = 'center'; g.font = '700 86px Georgia'; g.fillText('SOUNDSTAGE 1', w / 2, 112);
  g.fillStyle = '#c9a868'; g.font = '30px Georgia'; g.fillText('THE BACKLOT  ·  FILM YOUR SCENES HERE', w / 2, 166);
 });
 const sm = new THREE.MeshBasicMaterial({ map: sign }); res.push(sm);
 const sp = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.56), sm); res.push(sp.geometry);
 sp.position.set((DOOR.x0 + DOOR.x1) / 2, FLOOR + DOOR.h + 1.02, HALL.z0 - .06); sp.rotation.y = Math.PI; root.add(sp);
 //  The ON AIR lamp: lit while the Soundstage is open.
 const lampTex = canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 54px system-ui'; g.fillText('ON AIR', w / 2, 68); });
 onAirMat.map = lampTex; onAirMat.needsUpdate = true;
 onAir = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .68), onAirMat); res.push(onAir.geometry);
 onAir.position.set(DOOR.x1 + 1.4, FLOOR + 4.2, HALL.z0 - .06); onAir.rotation.y = Math.PI; root.add(onAir);
 //  Ceiling light panels inside, so the set is lit under the roof.
 for (let x = HALL.x0 + 3; x < HALL.x1 - 2; x += 5) for (let z = HALL.z0 + 3; z < HALL.z1 - 2; z += 4){ const p = add(new THREE.PlaneGeometry(2.4, 1), glowW, x, ROOF - .02, z); p.rotation.x = Math.PI / 2; }
 //  A white cyclorama curving up the back wall.
 const cycMat = M(0xece8e0, { roughness: .95, side: THREE.DoubleSide, emissive: 0xece8e0, emissiveIntensity: .35 });
 const cyc = add(new THREE.CylinderGeometry(3, 3, HALL.x1 - HALL.x0 - 2.2, 16, 1, true, 0, Math.PI / 2), cycMat, (HALL.x0 + HALL.x1) / 2, FLOOR + 3, HALL.z1 - 4.05);
 cyc.rotation.z = Math.PI / 2; cyc.rotation.y = Math.PI;
 add(new THREE.PlaneGeometry(HALL.x1 - HALL.x0 - 2.2, 3.9), cycMat, (HALL.x0 + HALL.x1) / 2, FLOOR + .02, HALL.z1 - 3.1).rotation.x = -Math.PI / 2;
 //  The roof: a steel deck on the walls, with a cornice band.
 const roofMat = M(0x2a2c31, { roughness: .7, metalness: .3, side: THREE.DoubleSide });
 add(new THREE.BoxGeometry(HALL.x1 - HALL.x0 + .4, .3, HALL.z1 - HALL.z0 + .4), roofMat, (HALL.x0 + HALL.x1) / 2, ROOF + .15, (HALL.z0 + HALL.z1) / 2);
 // Industrial civic frontage: grounded limestone piers, bronze joints,
 // clerestory sawtooths and a continuous cornice. Three instanced batches.
 const stone=M(0xc4b99f,{roughness:.82}),bronze=M(0xa38a5f,{metalness:.55}),patina=M(0x385451,{metalness:.3,roughness:.35});
 const bays=new Map(),pose=new THREE.Object3D();
 const bay=(m,x,y,z,w,h,d,rz=0)=>{if(!bays.has(m))bays.set(m,[]);bays.get(m).push([x,y,z,w,h,d,rz]);};
 for(const z of [54,65.95]){
  bay(stone,103,9.8,z,22.4,.5,.36);bay(bronze,103,10.13,z,22.5,.10,.42);
  for(const x of [92.2,96.3,109.7,113.7])bay(stone,x,5.8,z,.42,7.6,.32);
  // The back wall has a quiet rhythmic relief; the working door stays clear.
  if(z>60)for(let x=94;x<113;x+=2){bay(bronze,x,6.2,z,.065,5.8,.16);bay(patina,x,7.5,z+.02,1.1,1.8,.08);}
 }
 for(const x of [92,113.95]){
  bay(stone,x,9.8,60,.36,.5,12.4);
  for(const z of [54.3,58,62,65.7]){bay(stone,x,5.8,z,.32,7.6,.42);bay(bronze,x,6,z+.25,.34,6,.065);}
 }
 for(let i=0;i<6;i++){
  const x=93.85+i*3.6;
  bay(patina,x,10.96,60,3.82,.14,11.8,.35);
  bay(bronze,x+1.75,10.95,60,.12,1.35,11.8);
  for(const z of [54.15,65.85])bay(stone,x,10.96,z,3.82,.16,.16,.35);
 }
 for(const [m,rows]of bays){const g=new THREE.BoxGeometry(1,1,1);res.push(g);const inst=new THREE.InstancedMesh(g,m,rows.length);inst.name='backlot-civic-frontage';rows.forEach(([x,y,z,w,h,d,rz],i)=>{pose.position.set(x,y,z);pose.scale.set(w,h,d);pose.rotation.set(0,0,rz);pose.updateMatrix();inst.setMatrixAt(i,pose.matrix);});inst.instanceMatrix.needsUpdate=true;root.add(inst);}
 //  The camera on its tripod, facing the set.
 const cam = new THREE.Group(); cam.position.set(CAM.x, FLOOR, CAM.z); root.add(cam);
 const part = (g, m, x, y, z, rx = 0, rz = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); cam.add(o); res.push(g); return o; };
 for (const a of [0, 2.1, 4.2]) part(new THREE.CylinderGeometry(.025, .03, 1.35, 6), steel, Math.cos(a) * .22, .62, Math.sin(a) * .22, Math.sin(a) * .3, -Math.cos(a) * .3);
 part(new THREE.BoxGeometry(.32, .3, .62), black, 0, 1.38, 0);
 part(new THREE.CylinderGeometry(.11, .13, .34, 16), black, 0, 1.4, .46, Math.PI / 2);
 part(new THREE.CylinderGeometry(.09, .09, .02, 16), M(0x223344, { metalness: .9, roughness: .1 }), 0, 1.4, .64, Math.PI / 2);
 part(new THREE.TorusGeometry(.16, .025, 6, 20), black, 0, 1.68, -.1, 0, Math.PI / 2);
 //  Director's chair.
 const ch = new THREE.Group(); ch.position.set(CAM.x + 1.6, FLOOR, CAM.z); ch.rotation.y = Math.PI * .1; root.add(ch);
 const cp = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); ch.add(o); res.push(g); return o; };
 for (const x of [-.26, .26]) for (const z of [-.22, .22]) cp(new THREE.BoxGeometry(.05, .9, .05), wood, x, .45, z);
 cp(new THREE.BoxGeometry(.56, .04, .48), canvas, 0, .58, 0); cp(new THREE.BoxGeometry(.56, .28, .03), canvas, 0, 1.02, -.24);
 const back = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#7a2d22'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2e7cf'; g.textAlign = 'center'; g.font = '700 40px Georgia'; g.fillText('DIRECTOR', w / 2, 78); });
 const bm = new THREE.MeshBasicMaterial({ map: back }); res.push(bm); cp(new THREE.PlaneGeometry(.54, .26), bm, 0, 1.02, -.26).rotation.y = Math.PI;
 //  Two light stands aimed at the set.
 for (const x of [HALL.x0 + 4, HALL.x1 - 5]){
  add(new THREE.CylinderGeometry(.03, .04, 2.6, 6), steel, x, FLOOR + 1.3, HALL.z0 + 6);
  const head = add(new THREE.BoxGeometry(.7, .5, .3), black, x, FLOOR + 2.7, HALL.z0 + 6); head.rotation.x = -.35;
  add(new THREE.PlaneGeometry(.6, .4), glowW, x, FLOOR + 2.66, HALL.z0 + 6.17).rotation.x = -.35;
 }
 root.traverse(o => { if (o.isMesh){ o.userData._hdTag = 1; o.castShadow = false; o.receiveShadow = false; } });
 //  Stage lights. The voxel walls are shaded by how much sky they see, so
 //  under a roof they fall to black; two warm work lights fill the set. They
 //  live on the scene and are never hidden, so the light count stays fixed
 //  (a changing count rebuilds every lit shader: the Lantern Hall lesson).
 if (!lights.length) for (const x of [HALL.x0 + 6, HALL.x1 - 6]){ const l = new THREE.PointLight(0xfff0dc, 0, 22, 1.1); l.position.set(x, ROOF - 1.5, (HALL.z0 + HALL.z1) / 2); l.name = 'backlot-light'; lights.push(l); }
 for (const l of lights) if (l.parent !== scene) scene.add(l);
}
const lights = [];
function dispose(){ for (const l of lights) l.removeFromParent(); root?.removeFromParent(); for (const r of new Set(res)) r.dispose?.(); res.length = 0; root = null; scene = null; }

// ─── Inside the hangar ─────────────────────────────────────────────────────
let blend = 0;
const stageAir = new THREE.Color(0x26272b);
if (window.FCRealLight) FCRealLight.zones.push(c => {
 if (!blend) return;
 if (c.fog && 'density' in c.fog){ c.fog.density = THREE.MathUtils.lerp(c.fog.density, .003, blend); c.fog.color.lerp(stageAir, blend * .7); }
 if (c.sun) c.sun.intensity *= 1 - .75 * blend;
});

// ─── The prompt ────────────────────────────────────────────────────────────
const prompt = document.createElement('button'); prompt.id = 'backlot-approach'; prompt.hidden = true; document.body.append(prompt);
const css = document.createElement('style');
css.textContent = `#backlot-approach{position:fixed;bottom:110px;left:50%;transform:translateX(-50%);z-index:125001;background:#0f1820e6;color:#eef2f3;border:1px solid #5d6d78;border-left:3px solid #e0533d;border-radius:22px;padding:13px 22px;font:600 14px/1.3 system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(6px);max-width:calc(100vw - 32px)}#backlot-approach[hidden]{display:none}
#fc-tools [data-act=soundstage]{border-color:#e0533d!important;font-weight:600}`;
document.head.append(css);
let near = false, greeted = false;
try { greeted = localStorage.getItem('fc-backlot-greeted') === '1'; } catch (e){}
const blocked = () => State.ui.paused || State.ui.inArcade || State.ui.inDialogue || State.ui.inIntro || window.FCOmnism?.panel || window.CityArt?.panelOpen || window.CityBuild?.panelOpen;
function openStage(){ if (window.FCSoundstage && !FCSoundstage.state.open) FCSoundstage.open(); }
prompt.onclick = () => near && openStage();
window.addEventListener('keydown', e => { if (e.code === 'KeyE' && !e.repeat && near && !prompt.hidden){ e.preventDefault(); e.stopImmediatePropagation(); openStage(); } }, true);
function tick(){
 requestAnimationFrame(tick);
 try {
  if (!State.scene || typeof Player === 'undefined') return;
  const p = Player.position, far = Math.abs(p.x - 96) > 140 || Math.abs(p.z - 60) > 140;
  if (!far) build();
  if (root) root.visible = !far;
  const open = !!window.FCSoundstage?.state?.open;
  if (onAirMat) onAirMat.color.setHex(open ? 0xff3b2e : 0x3a0d0d);
  for (const l of lights) l.intensity = far ? 0 : 90;
  const feet = p.y - Player.height, inX = Math.min(p.x - HALL.x0, HALL.x1 - p.x), inZ = Math.min(p.z - HALL.z0, HALL.z1 - p.z);
  blend = Math.max(0, Math.min(1, Math.min(inX, inZ) / 2));
  near = !far && !open && Math.hypot(p.x - CAM.x, p.z - (CAM.z - 1.1)) < 1.6 && Math.abs(feet - FLOOR) < 1.4;
  const show = near && !blocked();
  if (show && prompt.textContent !== 'E · Soundstage: film a scene here') prompt.textContent = 'E · Soundstage: film a scene here';
  prompt.hidden = !show;
  //  First time on the lot, say what it is.
  if (!greeted && !far && inside(Math.floor(p.x), Math.floor(p.z)) && !blocked()){
   greeted = true; try { localStorage.setItem('fc-backlot-greeted', '1'); } catch (e){}
   if (typeof toast === 'function') toast('The Backlot. Walk to the camera in Soundstage 1 to direct a scene: cast actors, block moves, key cameras, record. Also in Tools, or F9.', 'info');
  }
 } catch (e){}
}
requestAnimationFrame(tick);

//  The Tools entry goes to the top of the tray and says what it is for.
setInterval(() => {
 const b = document.querySelector('#fc-tools [data-act=soundstage]'), tray = document.querySelector('#fc-tools .tray');
 if (!b || !tray) return;
 if (b.textContent !== 'Soundstage · direct and film a scene (F9)') b.textContent = 'Soundstage · direct and film a scene (F9)';
 const row = b.parentElement;
 if (row && row.parentElement === tray && tray.firstElementChild !== row) tray.prepend(row);
}, 1500);

window.FCBacklot = { get onAir(){ return !!onAirMat && onAirMat.color.r > .5; }, HALL, CAM, DOOR, FLOOR, KEYS, get near(){ return near; }, get root(){ return root; }, get inside(){ return blend; }, open: openStage };
})();
