// 0.89 Real light: height haze in every material's fog, one skyline that
// belongs to the city, a grade in the composite instead of a CSS film,
// directional daylight, faceted tree canopies, and a clean switch back.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{serve,LAUNCH_ARGS}=require('./lib/harness'),assert=require('node:assert/strict');
const T={timeout:240000};
(async()=>{const site=await serve(root),browser=await chromium.launch({channel:'chrome',args:LAUNCH_ARGS}),errors=[];
try{
 const p=await browser.newPage({viewport:{width:1280,height:720}});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(site.origin+'/apps/fracture-city-game/index.html',{waitUntil:'load'});await p.waitForFunction(()=>window.FCRealLight&&window.OwnBlock,null,T);
 await p.evaluate(async()=>{HD.locked=true;HD.setTier('high',true);await OwnBlock.start();State.ui.paused=false;Player.position.set(170,1+Player.height,40);Player.yaw=0});
 await p.waitForFunction(()=>OwnBlock.ready&&FCRealLight.skyline,null,T);await p.waitForTimeout(3000);
 const r=await p.evaluate(()=>{const RL=FCRealLight,out={};
  out.fog=RL.fogPatched&&THREE.ShaderChunk.fog_fragment.includes('vFogRay')&&THREE.ShaderChunk.fog_vertex.includes('vFogRay');
  out.towers=RL.towers;out.inScene=RL.skyline.parent===State.scene&&RL.skyline.visible;
  out.oldHidden=[State.skyline,State.farSkyline].every(g=>g.children.every(c=>!c.visible));
  State.camera.position.set(640,3,-210);RL.frame();out.follows=RL.skyline.position.x===640&&RL.skyline.position.z===-210;
  //  Windows light up at night and mostly go dark by day.
  State.dayTime=23*60;updateDayNight(0);out.nightGlow=RL.skyMat.emissiveIntensity;State.dayTime=12.5*60;updateDayNight(0);out.dayGlow=RL.skyMat.emissiveIntensity;
  //  Daylight leans on the sun: more key, less flat fill than the rig alone gives.
  out.sun=State.sunLight.intensity;out.amb=State.ambient.intensity;
  out.grade=!!(HD.Bloom.comp&&HD.Bloom.comp.uniforms.uGrain&&HD.Bloom.comp.fragmentShader.includes('uShadowTint'));
  out.film=getComputedStyle(document.getElementById('grit-grade')).opacity;
  {let n=0,m=0;State.scene.traverse(o=>{if(!o.userData.rlTree)return;n++;if(o.material.flatShading&&o.geometry.attributes.color)m++});out.trees=n;out.canopy=m}
  //  Switching off returns the old horizon and the old crowns.
  RL.set(false);out.offOld=[State.skyline,State.farSkyline].every(g=>g.children.every(c=>c.visible))&&!RL.skyline.visible;
  out.offTrees=(()=>{let n=0;State.scene.traverse(o=>{if(o.userData.rlTree)n++});return n})();out.offGrade=HD.Bloom.comp.uniforms.uGrade.value;
  RL.set(true);out.backOn=RL.skyline.visible&&RL.trees>0;
  return out});
 assert.ok(r.fog,'height haze is in three\'s fog chunks');console.log('PASS fog thickens toward the ground in every material');
 assert.ok(r.towers>200&&r.inScene&&r.oldHidden,'one skyline replaces the two old rings: '+JSON.stringify(r));assert.ok(r.follows,'skyline follows the camera');console.log('PASS one camera-following skyline replaces the two old rings');
 assert.ok(r.nightGlow>0.9&&r.dayGlow<0.2,'windows light at night: '+r.nightGlow+' '+r.dayGlow);console.log('PASS skyline windows light up at night');
 assert.ok(r.sun>r.amb*1.5,'daylight is directional: '+r.sun+' '+r.amb);console.log('PASS daylight leans on the sun');
 assert.ok(r.grade&&r.film==='0','grade in the composite, CSS film off: '+r.film);console.log('PASS the grade lives in the composite, not a CSS film');
 assert.ok(r.trees>=10&&r.canopy===r.trees,'crowns become faceted canopies: '+r.trees+' '+r.canopy);console.log('PASS tree crowns become faceted canopies');
 assert.ok(r.offOld&&r.offTrees===0&&r.offGrade===0&&r.backOn,'switching off restores the old look: '+JSON.stringify(r));console.log('PASS Real Light switches off cleanly and back on');
 await p.screenshot({path:root+'/_test/out/real-light.png'});
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();site.close?.()}})().catch(e=>{console.error(e);process.exitCode=1});
