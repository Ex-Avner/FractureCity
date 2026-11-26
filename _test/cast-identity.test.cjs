const {chromium}=require('playwright'),{serve}=require('./lib/harness'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const s=await serve(path.resolve(__dirname,'..')),b=await chromium.launch({channel:'chrome'});try{
 const p=await b.newPage({viewport:{width:1600,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|compile/i.test(m.text()))errors.push(m.text())});
 await p.goto(s.origin+'/apps/fracture-city-game/index.html');await p.waitForFunction(()=>window.FCWardrobe?.SIGNATURES&&window.FCEquipment);
 const stats=await p.evaluate(()=>{
 const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(1600,900);r.setPixelRatio(1);r.outputEncoding=THREE.sRGBEncoding;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.1;r.setClearColor(0x111a23);
 const stage=document.createElement('div');Object.assign(stage.style,{position:'fixed',inset:0,zIndex:999999,background:'#111a23'});stage.id='cast-art-test';stage.append(r.domElement);document.body.append(stage);
 const label=document.createElement('div');label.innerHTML='<div style="letter-spacing:5px;color:#c3a574;font-size:14px">FRACTURE CITY / RESIDENTS</div><div style="font-size:32px;margin-top:9px">Six silhouettes. One strange city.</div>';Object.assign(label.style,{position:'absolute',left:'65px',top:'35px',color:'#e5e7e4',fontFamily:'sans-serif'});stage.append(label);
 const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(32,1600/900,.1,80);cam.position.set(0,2.45,7.8);cam.lookAt(0,1.05,0);
 scene.add(new THREE.HemisphereLight(0xc7def1,0x4e4541,1.6));const key=new THREE.DirectionalLight(0xffddbb,3);key.position.set(-3,5,4);scene.add(key);const rim=new THREE.DirectionalLight(0x8bc9e9,3);rim.position.set(4,3,-3);scene.add(rim);
 const chars=[],skins=['#8d5a3b','#d29a72','#6b412a','#b97a55','#e8b896','#4a2b1c'];
 for(const [i,[name,look]]of Object.entries(FCWardrobe.SIGNATURES).entries()){
 const c=shBuildFigure({...look,skin:skins[i],piercings:'none',tattoos:'none',auraChance:0,prop:'none',handle:name},'identity-'+name);c.plate.visible=false;c.group.position.set((i-2.5)*1.03,0,0);c.group.rotation.y=-.2;c.baseY=0;shAnimateCharacter(c,0,false,0);scene.add(c.group);chars.push(c);
 const text=document.createElement('div');text.textContent=name.toUpperCase();Object.assign(text.style,{position:'absolute',left:(50+(i-2.5)*14.1)+'%',bottom:'120px',color:'#b8c8ce',font:'12px sans-serif',letterSpacing:'2px',transform:'translateX(-50%)'});stage.append(text);
 }
 window.castPreview={r,scene,cam,chars,render:()=>r.render(scene,cam)};castPreview.render();
 return chars.map(c=>{let meshes=0,triangles=0,finite=true;c.group.traverse(o=>{if(o.isMesh&&o.userData.residentGeometry){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;finite&&=Array.from(o.geometry.attributes.position.array).every(Number.isFinite)}});return{outfit:c.look.outfit,meshes,triangles,finite,bones:[c.studio.elbows.length,c.studio.knees.length,c.studio.fingers.length],height:new THREE.Box3().setFromObject(c.group).max.y}});
 });
 console.log(stats);assert.equal(new Set(stats.map(s=>s.outfit)).size,6);for(const s of stats){assert.ok(s.finite);assert.ok(s.meshes<=24);assert.ok(s.triangles<24000);assert.deepEqual(s.bones,[2,2,2]);}
 await p.screenshot({path:path.join(__dirname,'out/cast-identities.png')});
 await p.evaluate(()=>{for(const c of castPreview.chars){shAnimateCharacter(c,.16,true,3);c.group.rotation.y=.6;}castPreview.render()});await p.screenshot({path:path.join(__dirname,'out/cast-identities-motion.png')});
 await p.evaluate(()=>{document.getElementById('cast-art-test').remove();castPreview.r.dispose();for(const c of castPreview.chars)FCResident.dispose(c);OwnBlock.start()});
 await p.waitForFunction(()=>OwnBlock.ready&&FCArrival.worker,null,{timeout:90000});assert.equal(await p.evaluate(()=>FCArrival.worker.char.look.outfit),'denim-vest');
 const stable=await p.evaluate(()=>{const a=FCWardrobe.crowdLook(null,new RNG('stable')),b=FCWardrobe.crowdLook(null,new RNG('stable'));return JSON.stringify(a)===JSON.stringify(b)});assert.ok(stable);assert.deepEqual(errors,[]);
 console.log('PASS six distinct designs, finite bounded geometry, original articulated rig, deterministic crowd, arrival Mara uses botanical design, no runtime/shader errors.');
}finally{await b.close();s.close()}})().catch(e=>{console.error(e);process.exitCode=1});
