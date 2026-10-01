/* Rounded render geometry; voxel ownership, collision and saves stay in the game. */
function cityRoundGeometry(w,h,d,radius,segments=4){
  const r=Math.min(radius,Math.min(w,h,d)*.49);
  const g=new THREE.BoxGeometry(w,h,d,segments,segments,segments);
  const p=g.attributes.position,n=g.attributes.normal;
  const core=new THREE.Vector3(w/2-r,h/2-r,d/2-r),v=new THREE.Vector3(),q=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);q.copy(v).clamp(core.clone().negate(),core);
    v.sub(q).normalize();n.setXYZ(i,v.x,v.y,v.z);
    q.addScaledVector(v,r);p.setXYZ(i,q.x,q.y,q.z);
  }
  g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function cityRoundMesh(w,h,d,mat){
  return new THREE.Mesh(cityRoundGeometry(w,h,d,Math.min(w,h,d)*.24),mat);
}
function cityPole(w,h,d,mat){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1,16),mat);
  m.scale.set(w,h,d);return m;
}
function cityLampArm(sign,mat){
  const path=new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,0,0),new THREE.Vector3(-sign*.12,.35,0),
    new THREE.Vector3(-sign*.55,.42,0),new THREE.Vector3(-sign, .22,0)]);
  return new THREE.Mesh(new THREE.TubeGeometry(path,10,.065,8,false),mat);
}
// Merge smooth parts back into the existing character buckets: no extra crowd draw calls.
function cityBakeRoundedPart(p,pos,nrm,col,idx,base,color){
  let g=p.organic?new THREE.SphereGeometry(.5,12,8):cityRoundGeometry(p.w,p.h,p.d,p.round,2);
  if(p.organic)g.scale(p.w,p.h,p.d);
  g.rotateX(p.rx||0);g.rotateY(p.ry||0);g.rotateZ(p.rz||0);g.translate(p.x,p.y,p.z);
  const a=g.attributes.position,b=g.attributes.normal;
  for(let i=0;i<a.count;i++){
    pos.push(a.getX(i),a.getY(i),a.getZ(i));nrm.push(b.getX(i),b.getY(i),b.getZ(i));
    col.push(color.r,color.g,color.b);
  }
  for(const i of g.index.array)idx.push(base+i);
  const count=a.count;g.dispose();return count;
}
function citySoftenResident(buckets){
  for(const parts of Object.values(buckets))for(const p of parts){
    // Tiny face marks and luminous stitching remain sharply legible.
    if(Math.min(p.w,p.h,p.d)>.035)p.round=Math.min(p.w,p.h,p.d)*.38;
  }
  const head=buckets.headP[0];head.round=.14;
  // Keep facial accessories aligned with the narrower head.
  for(const p of buckets.headP){p.w*=.82;p.x*=.82;p.d*=.92;p.z*=.92;
    if(p.y>.2 && p.w>.3)p.y-=.045;
  }
}
function citySoftPool(chunk,x,y,z,w,d,color){
  const mat=new THREE.ShaderMaterial({
    uniforms:{tint:{value:new THREE.Color(color)},strength:{value:.3}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 vUv;uniform vec3 tint;uniform float strength;void main(){vec2 p=(vUv-.5)*2.;float a=pow(max(0.,1.-dot(p,p)),2.);gl_FragColor=vec4(tint,a*strength);}',
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-1
  });
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);
  m.rotation.x=-Math.PI/2;m.position.set(x,y+.025,z);m.userData.cityPool=true;m.userData._hdTag=1;
  m.onBeforeRender=function(){
    const hour=((State.dayTime||0)/60)%24;
    const daylight=Math.max(0,Math.sin((hour-6)*Math.PI/12));
    const powered=!window.CityPower||window.CityPower.on(chunk.cx,chunk.cz);
    mat.uniforms.strength.value=powered?(.32-daylight*.25):0;
  };
  chunk.group.add(m);return m;
}
