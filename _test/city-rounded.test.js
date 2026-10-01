const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=require('path').resolve(__dirname,'..');
const THREE=require(root+'/shared/vendor/three.min.js');
const src=fs.readFileSync(root+'/apps/fracture-city-game/index.html','utf8');
const ctx={THREE,window:{},State:{dayTime:0},console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(root+'/apps/fracture-city-game/city-rounded.js','utf8'),ctx);
for(const dims of [[2,.6,4],[.1,.08,.2],[.44,.44,.42]]){
 const g=ctx.cityRoundGeometry(...dims,Math.min(...dims)*.3);
 assert(g.attributes.position.count<200);
 for(let i=0;i<g.attributes.position.count;i++){
  for(let axis=0;axis<3;axis++)assert(Math.abs(g.attributes.position.array[i*3+axis])<=dims[axis]/2+1e-6);
  const n=new THREE.Vector3().fromBufferAttribute(g.attributes.normal,i);assert(Math.abs(n.length()-1)<1e-5);
 }
}
vm.runInContext(src.slice(src.indexOf('const CUBE_FACES ='),src.indexOf('// Bake one bucket')),ctx);
const p={w:1,h:2,d:.4,x:3,y:4,z:5,color:0xff0000,round:.1,rx:.2,ry:.3};
const geo=ctx.shBakeParts([p,{...p,emit:true}],false);
assert(geo.attributes.position.array.every(Number.isFinite));assert.equal(geo.attributes.position.count,54);
assert.equal(ctx.shBakeParts([{...p,emit:true}],false),null);
const chunk={group:new THREE.Group(),cx:0,cz:0};const pool=ctx.citySoftPool(chunk,0,1,0,3,7,0xffcc88);
pool.onBeforeRender();const night=pool.material.uniforms.strength.value;
ctx.State.dayTime=720;pool.onBeforeRender();assert(pool.material.uniforms.strength.value<night);
ctx.window.CityPower={on:()=>false};pool.onBeforeRender();assert.equal(pool.material.uniforms.strength.value,0);
assert(!pool.material.depthWrite);assert(pool.userData._hdTag);
for(const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!m[1].includes('src=')&&!m[1].includes('application/json'))new vm.Script(m[2]);
console.log('PASS rounded geometry bounds and normals; merged character geometry; day/night and outage light response; script syntax.');
ctx.M={};ctx.TAU=Math.PI*2;ctx.shNameplate=()=>new THREE.SpriteMaterial();
vm.runInContext(src.slice(src.indexOf('const SKIN_TONES'),src.indexOf('function shNameplate')),ctx);
vm.runInContext(src.slice(src.indexOf('const CHAR_BODY_MAT ='),src.indexOf('// Unit cube corners')),ctx);
vm.runInContext(src.slice(src.indexOf('function shBakeLimb('),src.indexOf('// Per-frame character animation')),ctx);
vm.runInContext(src.slice(src.indexOf('const CAST_KIT ='),src.indexOf('//  49 · PACE')),ctx);
vm.runInContext(`
var testedResidents=[];
for(const arch of CHAR_ARCHETYPES){
 const rng={pick:a=>a[0],next:()=>.5,bool:()=>false,range:(a,b)=>(a+b)/2};
 testedResidents.push(shBuildCharacter(arch,rng,{handle:'test'}));
}`,ctx);
let maxTriangles=0;
for(const c of ctx.testedResidents){
 let meshes=0,triangles=0;c.group.traverse(m=>{if(!m.isMesh)return;meshes++;assert(m.geometry.attributes.position.array.every(Number.isFinite));triangles+=m.geometry.index.count/3;});
 assert(meshes<=12,'preserve merged crowd draw calls');maxTriangles=Math.max(triangles,maxTriangles);
 for(const k of ['leftArm','rightArm','leftLeg','rightLeg','head'])assert(c[k]);
}
console.log('PASS all',ctx.testedResidents.length,'resident archetypes with real clothing/face detail. Maximum triangles:',maxTriangles);
