const {chromium}=require('playwright'),{serve}=require('./lib/harness'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const s=await serve(path.resolve(__dirname,'..')),b=await chromium.launch({channel:'chrome'});try{
const p=await b.newPage({viewport:{width:1100,height:700}}),errors=[];
p.on('console',m=>{if(m.type()==='error'&&/shader|VALIDATE|compile/i.test(m.text()))errors.push(m.text())});
p.on('pageerror',e=>errors.push(e.message));
await p.goto(s.origin+'/apps/fracture-city-game/index.html');
await p.waitForFunction(()=>window.OwnBlock&&window.FCWindowPanes);
await p.evaluate(()=>OwnBlock.start());
await p.waitForFunction(()=>OwnBlock.ready&&FCWindowPanes.patched===2,null,{timeout:90000});
const result=await p.evaluate(()=>{
 State.ui.paused=true;HD.locked=true;HD.setTier('balanced',true);
 const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(1100,700);r.setClearColor(0x18232c);r.domElement.id='depth-test';Object.assign(r.domElement.style,{position:'fixed',inset:'0',zIndex:999999});document.body.append(r.domElement);
 const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(40,1100/700,.1,100);scene.add(new THREE.AmbientLight(0xffffff,1.6));
 const g=new THREE.PlaneGeometry(6,4);g.translate(0,2,0);const n=g.attributes.position.count;
 g.setAttribute('aMat',new THREE.BufferAttribute(new Float32Array(n).fill(4),1));g.setAttribute('aSurfUV',g.attributes.uv.clone());g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*3).fill(1),3));
 scene.add(new THREE.Mesh(g,M.voxOpaque));
 window.depthRender=(x,on)=>{FCWindowPanes.setDepth(on);cam.position.set(x,2.7,6);cam.lookAt(0,2,0);r.render(scene,cam);return {calls:r.info.render.calls,triangles:r.info.render.triangles,pixels:r.domElement.toDataURL()}};
 const flat=depthRender(2,false),deep=depthRender(2,true),side=depthRender(-2,true);
 return {flat,deep,side};
});
console.log('shader errors',errors);assert.deepEqual(errors,[]);
assert.equal(result.flat.calls,result.deep.calls);assert.equal(result.flat.triangles,result.deep.triangles);assert.ok(result.flat.pixels!==result.deep.pixels,'Depth changes pixels');assert.ok(result.deep.pixels!==result.side.pixels,'View changes pixels');
await p.evaluate(()=>depthRender(2,true));await p.screenshot({path:path.join(__dirname,'out/interior-depth.png')});
await p.evaluate(()=>HD.setTier('perf',true));await p.waitForFunction(()=>FCWindowPanes.uniforms.uRoomDepth.value===0);
assert.deepEqual(errors,[]);console.log('PASS actual voxel shader compiles; depth toggle changes rendering; camera views differ; no extra draw calls/triangles; performance tier disables depth.');
}finally{await b.close();s.close()}})().catch(e=>{console.error(e);process.exitCode=1});
