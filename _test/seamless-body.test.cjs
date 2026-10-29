// 0.86: limbs are single closed tubes painted with what covers them, so no
// overlay shell z-fights at hems or joints; surfaces face outward; elbows and
// knees close when bent; kilts swing with the stride; gloves cover fingers.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{serve,LAUNCH_ARGS}=require('./lib/harness'),assert=require('node:assert/strict');
(async()=>{const site=await serve(root),browser=await chromium.launch({channel:'chrome',args:LAUNCH_ARGS}),errors=[];
try{
 const p=await browser.newPage({viewport:{width:1200,height:800}});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(site.origin+'/apps/fracture-city-game/index.html',{waitUntil:'load'});await p.waitForFunction(()=>window.FCWardrobe&&window.shBuildFigure,null,{timeout:240000});
 const out=await p.evaluate(()=>{const W=FCWardrobe,res={};
  const fig=L=>{const c=shBuildFigure({...W.DEFAULT_LOOK,prop:'none',...L});shAnimateCharacter(c,0,false,0);return c};
  const limbMesh=b=>b.children.find(o=>o.isMesh&&o.geometry.attributes.color);
  //  One mesh per limb bone, every limb surface faces outward.
  const c=fig({top:'tee',outfit:'none',bottoms:'shorts',legwear:'socks',tattoos:'bands'});
  let inward=0,total=0;for(const [b,y0,y1] of [[c.leftArm,-.25,-.03],[c.studio.elbows[0],-.22,-.03],[c.leftLeg,-.4,-.04],[c.studio.knees[0],-.18,-.03]]){const m=limbMesh(b),P=m.geometry.attributes.position,N=m.geometry.attributes.normal;for(let i=0;i<P.count;i++){const r=Math.hypot(P.getX(i),P.getZ(i)),y=P.getY(i);if(y<y0||y>y1||r<.035||Math.abs(P.getX(i))>.12||Math.abs(P.getZ(i))>.13)continue;total++;if(P.getX(i)*N.getX(i)+P.getZ(i)*N.getZ(i)<0)inward++}}
  res.outward={inward,total};
  //  The tee sleeve ends on the upper arm with skin below it: both colours on one limb mesh.
  const cols=m=>{const C=m.geometry.attributes.color,s=new Set();for(let i=0;i<C.count;i++)s.add([C.getX(i),C.getY(i),C.getZ(i)].map(v=>Math.round(v*40)).join(','));return s.size};
  res.upperColours=cols(limbMesh(c.leftArm));res.thighColours=cols(limbMesh(c.leftLeg));
  //  Bent elbow: the forearm's rounded cap reaches back past the joint.
  const fm=limbMesh(c.studio.elbows[0]),FP=fm.geometry.attributes.position;let topY=-1;for(let i=0;i<FP.count;i++)topY=Math.max(topY,FP.getY(i));res.foreCapTop=topY;
  //  Kilt: a skirt bone that swings with a forward stride.
  const k=fig({bottoms:'kilt',outfit:'none'});k.leftLeg.rotation.x=-.6;k.rightLeg.rotation.x=.4;W.fitSkirt(k);res.skirt={rot:k.studio.skirt.rotation.x,scale:k.studio.skirt.scale.z,parts:k.studio.skirt.children.length};
  //  Gloves cover the fingers.
  const g=fig({extras:['gloves']});const fing=g.studio.fingers[0].children.find(o=>o.isMesh).geometry.attributes.color;res.fingerDark=fing.getX(0)<.15&&fing.getY(0)<.15;
  //  Triangle budget for the busiest look.
  const all=fig({hairStyle:'liberty',outfit:'studded',extras:W.OPTIONS.extras,makeup:'skull',boots:'platform',piercings:'loaded',tattoos:'sleeve',frame:'curvy',headgear:'crown',legwear:'fishnet',bottoms:'kilt'});let t=0;all.group.traverse(o=>{if(o.isMesh)t+=o.geometry.index.count/3});res.tris=t;
  return res});
 assert.equal(out.outward.inward,0,JSON.stringify(out.outward));assert.ok(out.outward.total>200);
 assert.ok(out.upperColours>=2,'sleeve and skin on one upper arm mesh');assert.ok(out.thighColours>=2,'shorts and skin on one thigh mesh');
 assert.ok(out.foreCapTop>.03,'forearm cap reaches back over the elbow: '+out.foreCapTop);
 console.log('PASS limbs are single outward-facing meshes with hems painted on and rounded joints');
 assert.ok(out.skirt.parts>0&&out.skirt.rot<0&&out.skirt.scale>1.3,JSON.stringify(out.skirt));console.log('PASS the kilt swings with the stride');
 assert.ok(out.fingerDark);console.log('PASS gloves cover the fingers');
 assert.ok(out.tris<16000,'triangles '+out.tris);console.log('PASS busiest look stays under 16,000 triangles: '+out.tris);
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();site.close?.()}})().catch(e=>{console.error(e);process.exitCode=1});
