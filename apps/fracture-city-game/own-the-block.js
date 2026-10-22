/* Own the Block: an authored, playable maker neighborhood and persistent creative career. */
(function(){'use strict';
const copy=x=>JSON.parse(JSON.stringify(x)),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const freshState=()=>({v:1,enabled:true,discovered:false,owned:false,commissions:[],recordings:[],best:null,medal:0,showcase:null,signalChoice:null,guestNotes:[],openHouse:false,guests:[],celebrated:false,rep:0});
const A=window.OwnBlock={state:freshState(),ready:false,race:null,modal:false};
const KEYS=new Set(['6,0','7,0','6,1','7,1','6,-1','7,-1','6,2','7,2','8,1']);
const STUDIO={x0:149,x1:163,z0:5,z1:19};
// Authored civic ground must not inherit a random wilderness hazard biome.
const civicDistrict={...DISTRICTS.RESIDENTIAL,name:'COMMON GROUND',wild:false,biome:null};
const originalDistrictAt=districtAtPosition;window.districtAtPosition=function(x,z){return A.state.enabled&&KEYS.has(chunkCoordOf(x)+','+chunkCoordOf(z))?civicDistrict:originalDistrictAt(x,z)};
const records=[{id:'roof',x:181,y:6,z:8,name:'The weather has a manager',line:'Ned: Rain has been promoted to Regional Moisture. It will no longer touch the ground.'},{id:'canal',x:186,y:1,z:39,name:'A legally distinct ocean',line:'A gull, a bottle, and a public announcement insisting this canal is a premium sea.'},{id:'alley',x:148,y:1,z:-12,name:'Someone practising tomorrow',line:'A drummer misses the beat. The echo plays it correctly. They have stopped speaking.'},{id:'garden',x:152,y:1,z:36,name:'The quiet part',line:'No announcement. Just the transformer humming in the same key as your song.'},{id:'arc',x:169,y:1,z:-9,name:'Station identification',line:'Pirate radio. The host signs off with: If you can hear this, you own the air between us.'}];
const route=[[175,1,22],[176,3,18],[176,6,14],[176,6,9],[170,6,9],[160,6,9],[160,4,17],[155,2,17],[155,1,25],[151,1,35],[178,1,35],[185,1,25],[171,1,25]];
const commissions=[{id:'identity',name:'A room with a voice',brief:'Put a named sign and a mural with at least four colours inside your studio.',reward:80,check:s=>s.signs>0&&s.murals>0},{id:'sculpture',name:'Something the city cannot file',brief:'Make a composition with at least 8 fine-art parts, 3 shape types and 3 colours in your studio.',reward:120,check:s=>s.parts>=8&&s.kinds>=3&&s.colors>=3},{id:'interior',name:'Somewhere worth staying',brief:'Arrange at least 16 parts using 2 finishes and spread them across at least 4 metres of the studio.',reward:160,check:s=>s.parts>=16&&s.finishes>=2&&s.spread>=4}];
let trail=null,pendingStart=false,loadToken=0,loading=Promise.resolve(),writes=Promise.resolve(),actors=[],worldScene,marker,recordMeshes=[],showcaseMesh,modal,priorPause,previous=0,elapsed=0,festivalDwell=0,lastArt='',saving=0;
const nearDistrict=()=>Player.position.x>140&&Player.position.x<218&&Player.position.z>-25&&Player.position.z<74;
const inStudio=o=>o.p[0]>=STUDIO.x0&&o.p[0]<=STUDIO.x1&&o.p[2]>=STUDIO.z0&&o.p[2]<=STUDIO.z1&&o.p[1]>=2&&o.p[1]<9;
function stats(){const rows=CityArt.objects.filter(inStudio),unique=k=>new Set(rows.map(k)).size;return {parts:rows.length,kinds:unique(o=>o.kind),colors:unique(o=>o.color),finishes:unique(o=>o.finish),signs:rows.filter(o=>o.kind==='sign'&&o.text.trim().length>=5).length,murals:rows.filter(o=>o.kind==='mural'&&new Set(o.pixels).size>=4).length,spread:rows.length?Math.max(Math.max(...rows.map(o=>o.p[0]))-Math.min(...rows.map(o=>o.p[0])),Math.max(...rows.map(o=>o.p[2]))-Math.min(...rows.map(o=>o.p[2]))):0}}
function persist(){if(!A.ready)return writes;const seed=State.citySeed,data=copy(A.state);saving++;writes=writes.catch(()=>{}).then(()=>fracture.save('own-block-'+seed,data)).finally(()=>saving--);writes.catch(()=>toast('District progress could not save. Use Save again before leaving.','warn'));return writes}
function dispose(group){if(!group)return;group.removeFromParent();group.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose()})}
function clearActors(){dispose(trail);trail=null;for(const a of actors){a.char.group.removeFromParent();FCResident.dispose(a.char)}actors=[];dispose(marker);marker=null;for(const m of recordMeshes)dispose(m);recordMeshes=[];dispose(showcaseMesh);showcaseMesh=null;lastArt=''}
function build(){for(const k of KEYS)shBuildChunk(k)}
const generate=Chunk.prototype.generate;
Chunk.prototype.generate=function(){if(!KEYS.has(this.key)||!(A.state.enabled||pendingStart))return generate.apply(this,arguments);this._maker=true;this.__cityFitted=1;this.landmark='makers';const b=(x,y,z,w,h,d,id)=>this.stampBox(x,y,z,x+w,y+h,z+d,id);
 b(this.originX,0,this.originZ,24,1,24,133);
 // Continuous promenade, studio, gallery deck and a stair-to-roof-to-studio circuit.
 b(145,0,-22,3,1,69,133);b(188,0,-22,3,1,69,133);b(145,0,23,46,1,5,127);
 b(148,1,4,16,1,16,129);b(148,2,4,1,5,16,120);b(163,2,4,1,5,16,120);b(148,2,4,16,5,1,120);b(148,2,19,6,5,1,120);b(158,2,19,6,5,1,120);b(154,6,19,4,1,1,120);
 // Large glazing openings, an open atrium, accessible mezzanine and a four-step stair.
 b(148,3,8,1,2,7,B_AIR);b(163,3,7,1,2,6,B_AIR);b(150,3,4,10,2,1,141);
 // Open exhibition bays retain solid sills and masonry piers.
 b(149,3,19,4,3,1,B_AIR);b(159,3,19,4,3,1,B_AIR);
 b(158,5,5,5,1,10,128);for(let i=0;i<4;i++)b(160,2,18-i,2,i+1,1,128);
 b(164,5,8,10,1,3,135);b(163,6,8,1,2,3,B_AIR);
 b(173,5,5,15,1,10,133);for(const x of [173,187])for(const z of [5,14])b(x,1,z,1,4,1,136);
 for(let i=0;i<5;i++)b(175,1,19-i,3,i+1,1,133);
 // A sculpture garden and a shallow canal with a safe solid bed.
 b(181,1,22,7,7,1,136);b(148,0,30,39,1,15,133);
 b(182,0,42,5,1,3,125);
 // Keep the gallery approach clear: sculpture and seating live on the garden edge.
 // Rehearsal warehouse and open radio stage give the north end actual places to enter.
 b(149,1,-20,14,1,15,131);b(149,2,-20,1,6,15,131);b(162,2,-20,1,6,15,131);b(149,2,-20,14,6,1,131);b(149,2,-6,5,6,1,131);b(158,2,-6,5,6,1,131);b(149,8,-20,14,1,15,134);b(154,7,-6,4,1,1,131);
 b(149,3,-17,1,3,8,141);b(162,3,-17,1,3,8,141);
 b(173,1,-19,15,1,15,128);b(173,2,-19,15,5,1,121);b(173,2,-19,1,5,15,121);b(187,2,-19,1,5,15,121);
 b(178,2,-17,5,1,4,136);b(178,2,-5,5,1,1,128);
 const root=new THREE.Group();root.name='makers-mile-architecture';this.group.add(root);const batches=new Map();
 const box=(x,y,z,w,h,d,color,glow=false)=>{if(chunkCoordOf(x)!==this.cx||chunkCoordOf(z)!==this.cz)return;const key=color+':'+glow;if(!batches.has(key))batches.set(key,[]);batches.get(key).push([x,y,z,w,h,d])};
 const sign=(x,y,z,title,sub,w=7,h=1.3,rot=0)=>{if(chunkCoordOf(x)!==this.cx||chunkCoordOf(z)!==this.cz)return;const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=Math.max(150,Math.round(1200*h/w));const g=canvas.getContext('2d');g.fillStyle='#162936';g.fillRect(0,0,canvas.width,canvas.height);g.fillStyle='#dcf8f4';g.textAlign='center';let fs=Math.min(canvas.height*.43,100);g.font='600 '+fs+'px system-ui';while(g.measureText(title).width>1120){fs-=2;g.font='600 '+fs+'px system-ui'}g.fillText(title,600,canvas.height*.48);g.fillStyle='#9fb9c6';g.font=Math.min(canvas.height*.18,26)+'px system-ui';g.fillText(sub,600,canvas.height*.79);const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture}));m.name='maker-sign:'+title;m.position.set(x,y,z);m.rotation.y=rot;const anchors={'ATELIER / 01':[[150,6,19],[156,6,19],[162,6,19]],'THE ECHO ROOM':[[153,7,-6],[156,7,-6],[159,7,-6]],'RADIO WITHOUT PERMISSION':[[179,5,-19],[181,5,-19],[183,5,-19]],'OPEN SESSION':[[154,5,-20],[156,5,-20],[158,5,-20]],'COMMON GROUND':[[182,7,22],[186,7,22]]};if(anchors[title])m.userData.fcSupport={type:'facade',points:anchors[title]};root.add(m)};
 sign(156,6.45,20.18,'ATELIER / 01','MAKE SOMETHING THAT COULD ONLY BE YOURS',8,.8);
 sign(183,7.1,15.08,'MAKERS’ MILE','ROOF WALK / RADIO / STUDIO',6,.85);
 b(173,6,14,15,2,1,136);b(175,6,14,3,2,1,B_AIR);
 // The arrival crosswalk stays open; directions are on the building fascia.
 sign(184.5,7.35,23.11,'COMMON GROUND','THE WIRE / PEOPLE / CULTURE',6.5,.65);
 // Canal fragment remains discoverable without a billboard in the garden.
 sign(156,7.48,-4.94,'THE ECHO ROOM','REHEARSALS / OPEN SESSIONS',6,.8);
 sign(181,5,-17.94,'RADIO WITHOUT PERMISSION','THE AIR BETWEEN US',5,1.2);
 for(const x of [148.5,163.5]){box(x,7.1,12,.12,.15,16,0xa6bac3);box(x,6.8,12,.06,.06,16,0x8be5c3,true)}
 box(156,7.1,4.5,16,.15,.15,0xa6bac3);box(156,7.1,19.5,16,.15,.15,0xa6bac3);
 // Slender reveals, tiled shopfronts and warm canopies frame the playable spaces.
 for(const x of [148.5,153.5,158.5,163.5]){box(x,4.4,20.03,.14,4.7,.16,0x365a60);box(x+.08,4.4,20.14,.035,4.6,.035,0xd4ad75)}
 box(156,6.75,20.6,5,.16,1.5,0x23414c);box(156,6.63,21.3,5,.05,.04,0x95f3d2,true);
 for(let x=150;x<163;x+=2){box(x,7.7,-5.86,1.6,.35,.12,0x344b50);box(x,7.4,-5.8,1.5,.045,.035,0xffa6c1,true)}
 for(const x of [175,186]){box(x,2.6,-16,1.1,1.4,.6,0x19262f);box(x,3.5,-16,1.1,.3,.6,0x526465)}
 for(let x=174;x<188;x+=1.5)box(x,6.5,-18.5,.45,.035,.6,0xa4ecdd,true);
 for(const z of [-18,-6,6,18,30,42]){box(146,1.3,z,1.4,.6,1.4,0x65736a);box(146,2,z,.8,.8,.8,0x648b71);box(190,1.3,z,1.4,.6,1.4,0x65736a);box(190,2,z,.8,.8,.8,0x648b71)}

 for(const z of [8,10.9]){box(169,7,z,10,.08,.08,0x7ee2c0,true);for(let x=164;x<174;x+=2)box(x,6.5,z,.07,1,.07,0xbd9b6e)}
 for(const x of [146,190])for(let z=-18;z<44;z+=8){box(x,3,z,.09,4,.09,0x526c70);box(x,5,z,1,.06,.6,0xffd399,true)}
 for(let x=150;x<187;x+=3)box(x,1.025,25,.8,.025,.06,0xe3c390);
 for(const z of [32,41])box(184,1.02,z,5,.025,.08,0x8be5c3,true);
 // Supported public signage, sheltered rehearsal equipment and neighborhood traces.
 // Keep all floor fixtures inside existing walls/stage footprints or on the verge.
 box(156,6.48,20.04,8.4,.95,.18,0x263c46);
 for(const x of [173,185])box(x,6.7,5,.12,4.3,.12,0x526c70);


 // Rehearsal room: mixing bench, amplifier stacks, wall absorbers and cable runs.
 for(const x of [150.6,161.4]){
  b(x-.5,2,-18,1,2,1,136);
  for(const y of [2.5,3.3]){box(x,y,-16.94,.72,.62,.10,0x17232d);box(x,y,-16.87,.52,.40,.02,0x52636b)}
 }
 b(153,2,-18,6,1,1,128);
 box(156,3.08,-17.5,3.1,.15,.72,0x293b47);
 for(let i=0;i<12;i++){box(154.7+i*.23,3.17,-17.5,.055,.015,.42,0xb0986b);box(154.7+i*.23,3.19,-17.4,.12,.025,.07,0x76b6ac)}
 for(const z of [-17,-14,-11])for(const x of [150.03,161.97]){box(x,5.6,z,.06,1.7,1.25,0x354553);for(let i=0;i<5;i++)box(x,5+i*.27,z,.08,.04,1.22,0x65767b)}
 box(156,2.015,-11,7,.018,4,0x684d5a);
 for(let i=0;i<7;i++)box(153+i,2.027,-11,.025,.012,4,0xa37f80);
 sign(156,5.8,-18.94,'OPEN SESSION','BRING A SONG / LEAVE ROOM FOR SOMEONE ELSE',5,.7);
 // Broadcast booth remains reachable across the front of the raised stage.
 box(180.5,3.12,-15.6,3.8,.22,1.2,0x293b47);
 for(const x of [179.4,181.6]){box(x,3.5,-15.8,.75,.5,.08,0x151e28);box(x,3.5,-15.75,.63,.36,.02,0x74b8ab,true)}
 box(180.5,3.65,-15.1,.035,.75,.035,0xb0986b);box(180.5,4.02,-15.1,.18,.06,.06,0x263c46);
 // Grounded garden seating, recycling station, drain grates and building numbers.
 for(const x of [150,155,160]){b(x,1,39,2,1,1,128);box(x+1,2.35,39.8,2,.7,.08,0x415e60)}
 for(let z=-18;z<43;z+=6)for(const x of [147.2,188.8]){box(x,1.015,z,.65,.025,.65,0x26343d);for(let k=0;k<5;k++)box(x-.24+k*.12,1.032,z,.035,.012,.54,0x6b7a7e)}
 sign(162,3,20.07,'01','STUDIO / MAKE YOURSELF AT HOME',1.3,.7);
 sign(161,4,-4.94,'02','THE ECHO ROOM',1.3,.7);
 sign(174.07,4,-8,'03','RADIO / ON AIR',1.3,.7,Math.PI/2);
 // Sun-washed facades and a planted verge replace bare industrial walls.
 box(156,1.018,25.5,24,.025,8,0x465966);
 box(180,1.018,25.5,24,.025,8,0x465966);

 for(let x=149;x<164;x+=.5)box(x,6.8,20.12,.075,.32,.09,0x9ba78d);
 // Rounded tree crowns soften the skyline; trunks have matching collision cells.
 for(const [x,z]of [[146,32],[190,32],[146,44],[190,44]]){
  b(x,1,z,1,3,1,128);
  if(chunkCoordOf(x)!==this.cx||chunkCoordOf(z)!==this.cz)continue;
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,3,8),new THREE.MeshStandardMaterial({color:0x5f6250,roughness:1}));trunk.position.set(x+.5,2.5,z+.5);root.add(trunk);
  const leaves=new THREE.MeshStandardMaterial({color:0x719675,roughness:1,emissive:0x405b3b,emissiveIntensity:.22});
  for(const [dx,y,dz,r]of [[0,4.6,0,1.9],[-1,4.2,.1,1.2],[.8,5,.4,1.15]]){const leaf=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),leaves);leaf.position.set(x+.5+dx,y,z+.5+dz);leaf.scale.y=.8;root.add(leaf)}
 }
 // Common Ground architectural kit: stone, dark bronze, muted jade and warm light.
 // All large masses are voxel-backed; thin facade details share batched materials.
 for(let x=148;x<188;x+=2)for(let z=29;z<45;z+=2){
  if(x<186&&z>=31&&z<39)continue; // Leave the garden soil and pool surfaces visible.
  box(x+.95,1.012,z+.95,1.88,.018,1.88,(Math.round(x+z)%4===0)?0x526775:0x405563);
 }
 // The news wall becomes a sheltered pavilion with a plinth, frame and reading bench.
 box(184.5,4.55,23.045,6.55,4.04,.10,0x102b28);
 box(184.5,4.55,23.01,7.05,6.9,.06,0x244b40);
 for(const x of [181.22,187.78])box(x,4.55,23.14,.10,4.2,.12,0xa6bac3);
 for(const y of [2.48,6.62])box(184.5,y,23.14,6.65,.09,.12,0xa6bac3);
 box(184.5,8.12,23.05,7.8,.22,3.1,0x334a5d);
 box(184.5,7.96,24.5,7.4,.045,.045,0x92e8e1,true);
 b(181,1,24,1,7,1,120);b(187,1,24,1,7,1,120);
 for(const x of [181.5,187.5]){box(x,4.5,25.015,1.02,7.02,.04,0x718c9e);box(x,4.5,23.985,1.02,7.02,.04,0x718c9e);}
 box(184.5,1.2,23.18,6.6,.4,.25,0x273d36);
 // A continuous clerestory gives Atelier a finished silhouette without closing its roof.
 for(const x of [148.45,163.55]){box(x,7.28,12,.24,.48,16.8,0xa6bac3);box(x,2.25,12,.14,.45,15.6,0x173b36);}
 for(const z of [4.45,19.55])box(156,7.28,z,16.8,.48,.24,0xa6bac3);

 // A real entry landing meets the studio floor; no floating decorative step.
 b(154,1,20,4,1,2,133);
 box(156,6.73,21.8,5.1,.08,.08,0xefddb5,true);
 // The plaza's middle is the Reading Garden (reading-garden.js); the gallery stands along its south edge.
 // Gallery fascia and thin roof beams are supported on the outer verge.
 for(const x of [145,190]){b(x,1,30,1,6,1,136);b(x,1,40,1,6,1,136);box(x+.5,7.12,35.5,.4,.25,11,0x173b36);}
 box(168,7.12,40.5,46,.25,.4,0x173b36);
 for(let x=146;x<191;x+=3)box(x,7.24,39.7,.09,.10,2.3,0x8e9d87);
 sign(168,6.3,40.72,'THE PEOPLE’S GALLERY','PHOTOS / STORIES / SONGS — WALK UP TO SHARE',13,1.05);
 // Warm floor guides connect the wire, gallery, studio and listening stage.
 for(let z=27;z<34;z+=1.4)box(177,1.04,z,.06,.025,.65,0xe0c295);
 sign(146.1,2.25,28,'MAKE','ATELIER 01',2,.6);
 sign(176.5,2.25,28,'MEET','GALLERY + SONGS',2.8,.6);
 for(const x of [146.1,176.5]){box(x,1.5,28,.06,1,.06,0xb0b89e);box(x,1.03,28,.6,.06,.4,0x173b36);}
 // Atelier frontage: a floating-edge canopy attached to the existing solid lintel.
 box(156,7.48,20.1,17.3,.26,3.8,0x334a5d);
 box(156,7.29,21.95,16.6,.055,.07,0x92e8e1,true);
 for(const x of [148.5,153.5,158.5,163.5]){
  box(x,4.5,20.12,.25,5,.25,0x334a5d);
  box(x-.10,4.5,20.26,.045,4.8,.035,0xa6bac3);
 }
 for(const x of [151,161]){
  box(x,2.92,20.05,4,.12,.25,0xa6bac3);
  box(x,5.98,20.05,4,.12,.25,0xa6bac3);
 }
 // Thin ceiling baffles frame the open studio without occupying the editable interior.
 for(let z=5;z<20;z+=1.5){box(151,7.18,z,4,.12,.14,0x334a5d);}
 for(const x of [149.2,162.8])box(x,6.85,12,.05,.04,13,0x92e8e1,true);
 // Border inlay and a clear path from the court to the studio landing.
 for(const z of [22.1,27.7])box(167,1.048,z,39,.02,.055,0xa6bac3);
 for(const x of [154.2,157.8])box(x,1.052,24,.05,.02,4,0x92e8e1,true);
 // Echo Room and radio keep their playable interiors, with a shared architectural trim.
 box(156,8.25,-5.3,15,.22,2,0x334a5d);box(156,8.1,-4.32,14.5,.045,.045,0x92e8e1,true);
 for(const x of [149.5,162.5])box(x,5,-5.92,.20,6,.14,0xa6bac3);
 box(180.5,6.8,-18.5,15.5,.25,1.8,0x334a5d);
 for(const x of [173.5,187.5])box(x,4,-18.95,.12,4,.08,0x92e8e1,true);
 // Roof-walk edge rails line the existing slab; the stair mouth and bridge stay open.
 for(const x of [173.1,187.9]){box(x,7,10,.08,.08,9,0xa6bac3);for(const z of [6,10,13])box(x,6.5,z,.07,1,.07,0x334a5d);}
 // Intentionally no new point lights; trim is emissive and detail is batched.
 for(const [key,parts]of batches){const [color,glow]=key.split(':'),mat=glow==='true'?new THREE.MeshBasicMaterial({color:+color}):new THREE.MeshStandardMaterial({color:+color,roughness:.8,metalness:.12,emissive:+color,emissiveIntensity:.04}),mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat,parts.length),obj=new THREE.Object3D();window.FCWorldMaterials?.dress(mat);mesh.frustumCulled=false;parts.forEach((p,i)=>{obj.position.set(...p.slice(0,3));obj.scale.set(...p.slice(3));obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix)});root.add(mesh)}
};
const oldDestroy=Chunk.prototype.destroy;Chunk.prototype.destroy=function(){if(this._maker)this.group.traverse(o=>{const map=o.material?.map;if(map&&!map.userData.shared)map.dispose()});return oldDestroy.apply(this,arguments)};
function claim(){if(!A.ready||!A.state.enabled||A.state.owned)return false;A.state.owned=true;State.ui.freeBuild=true;A.state.rep+=10;persist();toast('Studio 01 is yours. Press B to build with creative supplies. Moss has commissions at the street board.','success');return true}
function submit(id){if(!A.state.owned||A.state.commissions.includes(id))return false;const q=commissions.find(q=>q.id===id);if(!q||!q.check(stats()))return false;A.state.commissions.push(id);A.state.rep+=q.reward;grantCredits(q.reward);persist();toast(q.name+' · +'+q.reward+' credits. Your work is still editable.','success');return true}
function feature(){if(!A.state.owned)return false;const mural=CityArt.getSelection().find(o=>o.kind==='mural')||CityArt.objects.find(o=>inStudio(o)&&o.kind==='mural');if(!mural)return false;A.state.showcase=[...mural.pixels];persist();lastArt='';toast('Your painting is on the neighborhood wall. This is your local city.','success');return true}
function startRace(){if(!A.state.enabled||!A.ready)return false;close();A.race={index:0,time:0,started:false,last:Player.position.clone(),invalid:false};toast('Signal Run · enter the first ring. Time starts when you cross it.','info');return true}
function raceTick(dt){const r=A.race;if(!r)return;const feet=Player.position.y-Player.height;if(r.started){r.time+=dt;if(r.last.distanceTo(Player.position)>Math.max(4,dt*35))r.invalid=true}r.last.copy(Player.position);const p=route[r.index];if(Math.hypot(Player.position.x-p[0],Player.position.z-p[2])<1.6&&Math.abs(feet-p[1])<1.25){r.started=true;r.index++;if(r.index===route.length){const time=+r.time.toFixed(2);A.race=null;if(r.invalid){toast('Run unranked: a teleport or large position jump interrupted the route. Try again.','info');return}const medal=time<19?3:time<30?2:1;A.state.best=A.state.best===null?time:Math.min(A.state.best,time);if(medal>A.state.medal){A.state.rep+=(medal-A.state.medal)*30;A.state.medal=medal}persist();toast('Signal Run · '+time.toFixed(2)+'s · '+['','BRONZE','SILVER','GOLD'][medal],'success')}}}
function collect(id){if(A.state.recordings.includes(id))return false;const q=records.find(q=>q.id===id);if(!q)return false;A.state.recordings.push(id);A.state.rep+=15;persist();toast(q.name+' · '+q.line,'info');return true}
function makeActor(id,x,z,coat,routePoints){const char=shBuildFigure({...Shift.avatar,coat,prop:'none',headgear:'none',handle:id},'maker-'+id),a={id,char,position:new THREE.Vector3(x,1,z),route:routePoints,index:0,arrived:false};char.group.position.copy(a.position);State.scene.add(char.group);actors.push(a);return a}
function ensureActors(){if(!actors.length)makeActor('Moss / caretaker',168,22,'#73938b',[]);if(A.state.openHouse&&!A.state.celebrated&&actors.length===1)for(let i=0;i<3;i++)makeActor(['Inez / neighbor','Leon / neighbor','Mara / neighbor'][i],169+i*2,26,'#'+['a96880','6d7d9a','b18e66'][i],[[155,1,23],[155,2,18],[151+i*3,2,12]])}
function selectSignal(choice){if(!A.state.owned||!['art','music'].includes(choice))return false;A.state.signalChoice=choice;persist();if(choice==='music')PalmMedia.play();toast(choice==='art'?'City Signal: your block is now an open gallery.':'City Signal: your block is now a listening room.','success');return true}
function guestReaction(a){const s=stats(),name=a.id.split(' /')[0];const line=actors.indexOf(a)===1?`You used ${s.colors} colours. This room has its own voice.`:actors.indexOf(a)===2?(A.state.signalChoice==='music'?'A listening room. Leave me a place near the speakers.':`I counted ${s.kinds} kinds of shapes. It feels made by someone.`):A.state.showcase?'Your painting outside made this place easy to find.':'Put a piece outside next. Let the street know you are here.';const note=name+': '+line;A.state.guestNotes.push(note);A.state.guestNotes=A.state.guestNotes.slice(-3);return note}
function openHouse(){if(A.state.commissions.length<3||A.state.celebrated)return false;A.state.openHouse=true;persist();ensureActors();close();toast('Open studio · three neighbors are walking over. Keep the doorway clear.','info');return true}
// Short, bounded walking routes around residents' furniture. Never teleport through it.
function visitorPath(a,target){
 const start=a.position.clone(),queue=[{p:start,parent:-1}],seen=new Set(['0,0']),height=a.char.studio?.height||1.85;
 let best=-1,score=Infinity;const final=a.index===a.route.length-1;
 for(let i=0;i<queue.length&&i<1800;i++){
  const n=queue[i],d=Math.hypot(n.p.x-target[0],n.p.z-target[2])+Math.abs(n.p.y-target[1])*2;
  if((!final||(n.p.x>149&&n.p.x<163&&n.p.z>5&&n.p.z<19))&&d<score){score=d;best=i}
  if(d<.38){best=i;score=d;break}
  for(const [dx,dz]of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){
   const x=n.p.x+dx,z=n.p.z+dz;if(x<Math.min(start.x,target[0])-4||x>Math.max(start.x,target[0])+4||z<Math.min(start.z,target[2])-4||z>Math.max(start.z,target[2])+4)continue;
   const key=Math.round((x-start.x)*2)+','+Math.round((z-start.z)*2);if(seen.has(key))continue;seen.add(key);
   const probe={position:n.p.clone()};if(!shGroundMove(probe,dx,dz,.38,height)||Math.abs(probe.position.x-x)>.01||Math.abs(probe.position.z-z)>.01)continue;
   queue.push({p:probe.position,parent:i});
  }
 }
 if(best<0||score>(final?2.5:.4))return null;
 const path=[];for(let i=best;queue[i].parent>=0;i=queue[i].parent)path.unshift(queue[i].p);return path;
}
function actorsTick(dt){
 ensureActors();for(const a of actors){
  a.char.group.visible=nearDistrict();if(!a.char.group.visible)continue;
  a.supported=FCActors.prepare(a,a.char,{r:.38});
  if(!a.supported){a.char.group.visible=false;continue}a.char.baseY=a.position.y;let moving=false;
  if(a.route.length&&a.index<a.route.length){
   a.navRetry=Math.max(0,(a.navRetry||0)-dt);
   if(a.navArt!==CityArt.objects){a.path=null;a.navRetry=0;a.navArt=CityArt.objects}
   if(!a.path&&!a.navRetry){a.path=visitorPath(a,a.route[a.index]);if(!a.path)a.navRetry=1}
   if(a.path){
    if(a.path.length){const p=a.path[0],dx=p.x-a.position.x,dz=p.z-a.position.z,d=Math.hypot(dx,dz);
     if(d<.11)a.path.shift();else{moving=shGroundMove(a,dx/d*Math.min(d,dt*1.8),dz/d*Math.min(d,dt*1.8),.38,a.char.studio?.height||1.85);a.char.group.rotation.y=Math.atan2(dx,dz);if(!moving){a.path=null;a.navRetry=.5}}
    }else{a.path=null;a.index++;if(a.index===a.route.length){a.arrived=true;if(!A.state.guests.includes(a.id)){A.state.guests.push(a.id);const note=guestReaction(a);persist();toast(note,'info')}}}
   }
  }else a.char.group.rotation.y=Math.atan2(Player.position.x-a.position.x,Player.position.z-a.position.z);
  a.char.baseY=a.position.y;a.char.group.position.copy(a.position);shAnimateCharacter(a.char,dt,moving,elapsed);FCActors.finish(a,a.char,dt,{r:.38});
 }
 if(A.state.openHouse&&!A.state.celebrated&&A.state.guests.length===3){festivalDwell+=dt;if(festivalDwell>8){A.state.celebrated=true;A.state.rep+=200;persist();lastArt='';toast('THE BLOCK IS YOURS · Open studio complete. +200 neighborhood rep. Keep creating; the run and discoveries remain open.','success')}}
}
function available(){return A.state.enabled&&A.ready&&!FN.prologue&&!State.ui.inIntro}
function interact(){if(!available()||State.ui.paused||State.ui.inDialogue||State.ui.inArcade)return false;for(const q of records)if(!A.state.recordings.includes(q.id)&&Math.hypot(Player.position.x-q.x,Player.position.y-Player.height-q.y,Player.position.z-q.z)<2.6)return collect(q.id);if(Math.hypot(Player.position.x-155,Player.position.z-21)<3&&!A.state.owned)return claim();if(Math.hypot(Player.position.x-181,Player.position.z+5)<3){PalmMedia.play();return true}if(Math.hypot(Player.position.x-168,Player.position.z-22)<3){board();return true}if(Math.hypot(Player.position.x-171,Player.position.z-25)<2.4){if(!A.race)startRace();return true}return false}
const interaction=handleInteract;window.handleInteract=function(){if(interact())return true;return interaction.apply(this,arguments)};
function goal(){const socialGoal=window.FCNewsHub?.goal();if(socialGoal)return socialGoal;const tour=window.FCOnlineTour?.goal();if(tour)return tour;if(window.FCStructures?.inYard()){const plot=FCStructures.goal();if(plot)return plot;}if(A.race){const p=route[A.race.index];return {p,text:'Signal Run · '+(A.race.index+1)+'/'+route.length+' · '+A.race.time.toFixed(1)+'s'}}if(!A.state.owned)return{p:[155,1,21],text:'Claim Studio 01 · approach the doorway and press E'};if(A.state.commissions.length<3){const s=stats(),q=commissions.find(q=>!A.state.commissions.includes(q.id));return{p:q.check(s)?[168,1,22]:[155,2,14],text:q.name+' · '+(q.check(s)?'Ready: return to Moss':'Create in your studio · B opens the workshop')}}if(!A.state.celebrated)return{p:[168,1,22],text:A.state.openHouse?'Open studio · '+A.state.guests.length+'/3 neighbors inside':'Talk to Moss to open your studio'};return{p:[171,1,25],text:'Your block · '+A.state.rep+' rep · '+A.state.recordings.length+'/5 fragments · run, explore, create'}}
function drawWorld(){if(!nearDistrict())return;const g=goal();if(!marker){marker=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(1.15,.035,6,36),new THREE.MeshBasicMaterial({color:0xb2ffd2}));ring.rotation.x=Math.PI/2;marker.add(ring);const arrow=new THREE.Mesh(new THREE.OctahedronGeometry(.22),new THREE.MeshBasicMaterial({color:0xffd080}));arrow.position.y=1.5;marker.add(arrow);State.scene.add(marker)}marker.position.set(g.p[0],g.p[1]+.08,g.p[2]);marker.children[1].rotation.y=elapsed;const sig=A.state.recordings.join(',')+'|'+JSON.stringify(A.state.showcase)+'|'+A.state.celebrated;if(sig!==lastArt){lastArt=sig;for(const m of recordMeshes)dispose(m);recordMeshes=[];for(const q of records)if(!A.state.recordings.includes(q.id)){const m=new THREE.Mesh(new THREE.OctahedronGeometry(.2),new THREE.MeshStandardMaterial({color:0xffcc88,emissive:0x9b6024,emissiveIntensity:.5,metalness:.5}));m.position.set(q.x,q.y+.8,q.z);State.scene.add(m);recordMeshes.push(m)}dispose(showcaseMesh);showcaseMesh=null;if(A.state.showcase){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');A.state.showcase.forEach((v,i)=>{ctx.fillStyle=v;ctx.fillRect(i%16*16,Math.floor(i/16)*16,16,16)});const tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;tex.magFilter=THREE.NearestFilter;showcaseMesh=new THREE.Mesh(new THREE.PlaneGeometry(5,5),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));showcaseMesh.position.set(177,3.5,40.3);showcaseMesh.rotation.y=Math.PI;State.scene.add(showcaseMesh)}if(A.state.celebrated){const s=shSignPlane('THIS BLOCK IS YOURS','OPEN STUDIO / RESIDENT MADE','#b2ffd2','#122a28',8,1.4);s.position.set(157,8.8,20);State.scene.add(s);recordMeshes.push(s)}}for(const m of recordMeshes)if(m.geometry?.type==='OctahedronGeometry')m.rotation.y=elapsed}
function close(){if(!modal)return;modal.remove();modal=null;A.modal=false;State.ui.paused=priorPause;State.keys.clear();document.body.style.cursor=priorPause?'auto':'none'}
function board(){if(!available())return;if(window.FCOnlineTour?.meet())return;CityArt.close();CityBuild.close();FCQuietUI.close();if(!modal){priorPause=State.ui.paused;State.ui.paused=true;document.exitPointerLock?.();State.keys.clear();modal=document.createElement('section');modal.id='maker-board';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Own the Block');document.body.appendChild(modal);A.modal=true}const s=stats();modal.innerHTML=`<small>OWN THE BLOCK / MAKERS’ MILE</small><h2>A city becomes yours when you leave something in it.</h2><p>Moss: “The previous tenant was an algorithm. No taste. Thirty-seven identical chairs facing a wall.”</p><p><b>${A.state.rep} neighborhood rep</b> · ${A.state.recordings.length}/5 street fragments · ${A.state.owned?'Studio 01 is yours':'Studio 01 is waiting'}</p><div class="maker-actions"><button data-act="close">Back to street</button><button data-act="studio">Go to your studio</button><button data-act="art">Create in Atelier</button><button data-act="feature">Feature a mural locally</button><button data-act="save">Save city</button><button data-act="civic">Visit Civic Core</button></div><article><h3>Your block, your broadcast</h3><p>Ned: “The Bureau has labelled this block VACANT. You are standing in it. Give us something they cannot edit out.”</p><p>Choose what this neighborhood welcomes. The studio and public bulletin will reflect your choice.</p><button data-act="signal-art" ${!A.state.owned?'disabled':''}>Open gallery${A.state.signalChoice==='art'?' · ON AIR':''}</button><button data-act="signal-music" ${!A.state.owned?'disabled':''}>Listening room${A.state.signalChoice==='music'?' · ON AIR':''}</button></article><h3>Make a place. Give it a voice.</h3>${commissions.map(q=>`<article><h3>${q.name}${A.state.commissions.includes(q.id)?' · COMPLETED':''}</h3><p>${q.brief}</p><button data-commission="${q.id}" ${!A.state.owned||A.state.commissions.includes(q.id)||!q.check(s)?'disabled':''}>Submit · ${q.reward} credits</button></article>`).join('')}<p class="maker-note">Studio now: ${s.parts} parts · ${s.kinds} shape types · ${s.colors} colours · ${s.finishes} finishes. Submissions check the artwork in your actual studio; they do not judge artistic taste.</p><article><h3>Signal Run / street to roof</h3><p>Follow ${route.length} rings in order. Walk, sprint, jump or skate. Gold under 19s; silver under 30s. Best: ${A.state.best===null?'not yet run':A.state.best.toFixed(2)+'s'}.</p><button data-act="race">${A.race?'Restart':'Start'} run</button><button data-act="cancel-race">Cancel run</button></article><article><h3>Open studio</h3><p>Complete the three commissions, then invite three local neighbors to see your room. Keep the doorway and stairs clear.</p><button data-act="open-house" ${A.state.commissions.length<3||A.state.celebrated?'disabled':''}>${A.state.celebrated?'Your first open studio is complete':'Invite the neighbors'}</button></article>${A.state.guestNotes.length?'<article><h3>What your visitors noticed</h3>'+A.state.guestNotes.map(n=>'<p>'+esc(n)+'</p>').join('')+'</article>':''}<article><h3>Street fragments</h3>${records.map(q=>`<p>${A.state.recordings.includes(q.id)?'✓':'◇'} ${q.name}${A.state.recordings.includes(q.id)?' — '+q.line:''}</p>`).join('')}</article><p class="maker-note">Your studio, local showcase, best time and neighborhood progress save with this city. Your story and creative work belong to this same saved city. Online play requires joining an online room.</p>`;modal.querySelectorAll('[data-commission]').forEach(b=>b.onclick=()=>{submit(b.dataset.commission);board()});modal.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{switch(b.dataset.act){case'signal-art':selectSignal('art');board();return;case'signal-music':selectSignal('music');board();return;case'close':return close();case'studio':close();return visitStudio();case'art':close();visitStudio();CityArt.open();return;case'feature':if(!feature())toast('Create a painted mural in the studio first, or select one in Atelier.','info');return;case'race':visitRace();return;case'cancel-race':A.race=null;board();return;case'open-house':openHouse();return;case'civic':close();A.race=null;for(const k of ['0,0','0,-1','-1,0','-1,-1'])shBuildChunk(k);{const p=shFindOpenSpot(0,5,.35,Player.height,8);if(p){Player.position.set(p.x,p.y+Player.height,p.z);Player.velocity.set(0,0,0)}}return;case'save':shSlotSave(Slots.activeId).then(()=>toast('Your city and creative career are saved.','success'));return}});document.body.style.cursor='auto';modal.querySelector('button').focus()}
function visitStudio(){if(!A.state.owned){toast('Claim your key at the studio doorway first.','info');return false}A.race=null;build();const p=shFindOpenSpot(154,15,.35,Player.height,8);if(!p){toast('Clear space in your studio before returning.','info');return false}Player.position.set(p.x,p.y+Player.height,p.z);Player.velocity.set(0,0,0);Player.yaw=0;Player.pitch=0;return true}
function visitRace(){close();build();const p=shFindOpenSpot(171,25,.35,Player.height,4);if(!p)return false;Player.position.set(p.x,p.y+Player.height,p.z);Player.velocity.set(0,0,0);Player.yaw=-Math.PI/2;return startRace()}
async function start(){if(A.starting)return;A.starting=true;try{await fcLoad('Opening Makers’ Mile…',async()=>{if(State.chunkMap.size&&Slots.activeId)await shSlotSave(Slots.activeId);pendingStart=true;Player.classKey='witness';State.classChosen=true;await shSlotNew('freeroam');await loading;A.state.enabled=true;A.ready=true;build();State.ui.freeBuild=true;shSetPeaceful(true);Player.position.set(167,Player.height+1,24);Player.velocity.set(0,0,0);Player.yaw=Math.PI;Player.pitch=0;await persist();await shSlotSave(Slots.activeId,'Own the Block · Studio 01');closeMenu();toast('COMMON GROUND · Read ahead. Music to the left, theories to the right. Your studio is across the promenade.','info')})}finally{pendingStart=false;A.starting=false}}
const save=shSlotSave;window.shSlotSave=async function(){await loading;if(A.ready)await persist();return save.apply(this,arguments)};
const fresh=newGame;window.newGame=function(){if(A.ready)persist();close();clearActors();A.state=freshState();A.state.enabled=true;A.ready=false;A.race=null;festivalDwell=0;const token=++loadToken,r=fresh.apply(this,arguments),seed=State.citySeed;loading=Promise.resolve(fracture.read('own-block-'+seed)).then(data=>{if(token!==loadToken)return;if(data?.v===1){A.state={...freshState(),enabled:true,discovered:data.discovered===true||data.owned===true,owned:data.owned===true,openHouse:data.openHouse===true,celebrated:data.celebrated===true,rep:Number.isFinite(data.rep)?Math.max(0,data.rep):0,best:Number.isFinite(data.best)&&data.best>=0?data.best:null,medal:[0,1,2,3].includes(data.medal)?data.medal:0};A.state.signalChoice=['art','music'].includes(data.signalChoice)?data.signalChoice:null;A.state.guestNotes=Array.isArray(data.guestNotes)?data.guestNotes.filter(n=>typeof n==='string').map(n=>n.slice(0,200)).slice(-3):[];A.state.commissions=[...new Set(Array.isArray(data.commissions)?data.commissions:[])].filter(id=>commissions.some(q=>q.id===id));A.state.recordings=[...new Set(Array.isArray(data.recordings)?data.recordings:[])].filter(id=>records.some(q=>q.id===id));A.state.guests=[...new Set(Array.isArray(data.guests)?data.guests:[])].filter(id=>['Inez / neighbor','Leon / neighbor','Mara / neighbor'].includes(id));if(Array.isArray(data.showcase)&&data.showcase.length===256&&data.showcase.every(c=>/^#[a-f\d]{6}$/i.test(c)))A.state.showcase=[...data.showcase]}A.ready=true;if(A.state.enabled){for(const k of KEYS)if(State.chunkMap.has(k)&&!State.chunkMap.get(k)._maker)shDestroyChunk(k);if(nearDistrict())build()}}).catch(()=>{if(token===loadToken)toast('Neighborhood progress could not load. Reload before continuing.','warn')});return r};
window.addEventListener('keydown',e=>{if(!A.modal)return;e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();close()}else if(e.code==='Tab'){e.preventDefault();const bs=[...modal.querySelectorAll('button:not(:disabled)')],i=bs.indexOf(document.activeElement);bs[(i+(e.shiftKey?-1:1)+bs.length)%bs.length]?.focus()}},true);
const toastBefore=toast;window.toast=function(){const r=toastBefore.apply(this,arguments),stack=document.getElementById('toast-stack');while(stack&&stack.children.length>2){const old=[...stack.children].find(n=>!n.classList.contains('warn'))||stack.firstElementChild;old.remove()}return r};
function nearbyLabel(){const p=Player.position;for(const q of records)if(!A.state.recordings.includes(q.id)&&Math.hypot(p.x-q.x,p.y-Player.height-q.y,p.z-q.z)<2.6)return 'Discover '+q.name+' · E';if(Math.hypot(p.x-155,p.z-21)<3&&!A.state.owned)return 'Claim your studio key · E';if(Math.hypot(p.x-168,p.z-22)<3)return 'Moss · neighborhood board · E';if(Math.hypot(p.x-181,p.z+5)<3)return 'Play your soundtrack at the radio stage · E';if(Math.hypot(p.x-171,p.z-25)<2.4&&!A.race)return 'Start Signal Run · E';return ''}
const prompt=document.createElement('button');prompt.id='maker-interact';prompt.hidden=true;prompt.onclick=interact;document.body.appendChild(prompt);
function updateTrail(){if(!trail){const pts=[];for(let i=1;i<route.length;i++){const a=new THREE.Vector3(...route[i-1]),b=new THREE.Vector3(...route[i]),n=Math.ceil(a.distanceTo(b));for(let j=0;j<n;j++)pts.push(a.clone().lerp(b,j/n).add(new THREE.Vector3(0,.08,0)))}trail=new THREE.InstancedMesh(new THREE.SphereGeometry(.055,6,4),new THREE.MeshBasicMaterial({color:0x96e6c8,transparent:true,opacity:.5}),pts.length);trail.frustumCulled=false;const mat=new THREE.Matrix4();pts.forEach((p,i)=>trail.setMatrixAt(i,mat.makeTranslation(p.x,p.y,p.z)));State.scene.add(trail)}trail.visible=!!A.race&&nearDistrict()}
const hud=document.createElement('button');hud.id='maker-goal';hud.hidden=true;hud.onclick=board;document.body.appendChild(hud);
const tray=document.querySelector('#fc-tools .tray');if(tray){const b=document.createElement('button');b.textContent='Own the Block · neighborhood';b.onclick=()=>{FCQuietUI.close();if(available())board();else toast('Start Own the Block from the main menu to open a separate artist city.','info')};tray.appendChild(b)}
const css=document.createElement('style');css.textContent=`.maker-feature{padding:28px;border:1px solid #b0986b;border-radius:14px;margin-bottom:24px;background:linear-gradient(145deg,#143a39,#172337 65%,#592d44);position:relative;overflow:hidden}.maker-feature small{font:10px monospace;letter-spacing:.2em;color:#bfe7cc}.maker-feature h2{font:900 clamp(44px,7vw,70px)/.86 system-ui;letter-spacing:-.07em;margin:22px 0;color:#e8f0ce}.maker-feature p{font:16px/1.6 system-ui;color:#ccdfdc}.maker-feature button{background:#d5ebad;color:#183232;border:0;border-radius:6px;font:700 17px system-ui;padding:14px 20px;cursor:pointer}.maker-note{font:12px/1.6 system-ui!important;color:#a8bebc!important}#maker-goal{position:fixed;top:18px;left:18px;max-width:min(440px,60vw);z-index:80;text-align:left;background:#101922e8;color:#dcf0d6;border:1px solid #b0986b;border-radius:9px;padding:12px 16px;font:13px/1.5 system-ui;cursor:pointer}#maker-goal[hidden]{display:none}body.maker-mode #hud-controls,body.maker-mode #hud-task,body.maker-mode #sq-target,body.maker-mode #campaign-hud{display:none!important}#maker-board{position:fixed;inset:5vh max(15px,calc((100vw - 850px)/2));z-index:125000;overflow:auto;background:#101922fc;color:#deeee0;padding:28px;border:1px solid #b0986b;border-radius:12px;box-shadow:0 0 0 100vmax #0009;font:15px/1.6 system-ui}#maker-board h2{font:32px/1.15 Georgia}#maker-board small{letter-spacing:.16em;color:#bad19c}#maker-board article{padding:16px 0;border-top:1px solid #547071}#maker-board button{padding:10px 14px;margin:4px;background:#263c46;color:#e7f0d5;border:1px solid #647b80;border-radius:6px;font:inherit;cursor:pointer}#maker-board button:disabled{opacity:.4;cursor:default}.maker-actions{display:flex;flex-wrap:wrap}body.city-art-editing #maker-goal{display:none}#maker-interact{position:fixed;bottom:108px;left:50%;transform:translateX(-50%);z-index:84;background:#101922f0;color:#e1f4ce;border:1px solid #b0986b;border-radius:7px;padding:10px 16px;font:13px system-ui;cursor:pointer}#maker-interact[hidden]{display:none}body.maker-mode #hud-peace{display:none!important}@media(pointer:coarse){#maker-goal{top:8px;font-size:11px;max-width:65vw;padding:8px}#maker-board{inset:6px;padding:18px}}`;document.head.appendChild(css);
function tick(now){requestAnimationFrame(tick);const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;const enabled=available(),local=enabled&&(nearDistrict()||window.FCStructures?.inYard()||!!window.FCOnlineTour?.goal());document.body.classList.toggle('maker-mode',local);if(local&&!A.state.discovered&&!State.ui.paused){A.state.discovered=true;persist();toast('MAKERS’ MILE · A studio key is waiting at the open doorway. Your story continues in this same city.','info')}hud.hidden=!local||State.ui.paused||State.ui.inArcade||State.ui.inDialogue||State.ui.inIntro;prompt.hidden=true;if(!enabled)return;if(worldScene!==State.scene){clearActors();worldScene=State.scene}if(!State.ui.paused&&!State.ui.inArcade&&!State.ui.inDialogue&&!State.ui.inIntro){elapsed+=dt;raceTick(dt);if(nearDistrict())actorsTick(dt)}if(!hud.hidden){const g=goal(),dx=g.p[0]-Player.position.x,dz=g.p[2]-Player.position.z,angle=Math.atan2(Math.sin(Math.atan2(-dx,-dz)-Player.yaw),Math.cos(Math.atan2(-dx,-dz)-Player.yaw));hud.textContent=g.text+' · '+(Math.abs(angle)<.45?'↑':angle>0?'←':'→')+' '+Math.round(Math.hypot(dx,dz))+'m';const label=nearbyLabel();prompt.textContent=label;prompt.hidden=!label||State.ui.construct}updateTrail();for(const a of actors)a.char.group.visible=nearDistrict()&&a.supported!==false;if(marker)marker.visible=nearDistrict();for(const m of recordMeshes)m.visible=nearDistrict();if(showcaseMesh)showcaseMesh.visible=nearDistrict();drawWorld()}
requestAnimationFrame(tick);Object.assign(A,{start,board,close,claim,submit,stats,feature,startRace,raceTick,collect,openHouse,actorsTick,visitStudio,visitRace,build,route,records,commissions,persist,selectSignal,getActors:()=>actors});
})();
