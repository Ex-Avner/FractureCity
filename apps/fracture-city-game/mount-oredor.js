/* MOUNT OREDOR

   The mountain on the horizon. The feed hangs over the valley; Oredor is the one
   place that rises above it. Its summit holds the first shard of coherence.

   This file is the distant peak only: a single mesh, visible from every street.
   It keeps its true bearing and angular size as you move, but is drawn inside the
   sky dome (380 m), the way a painted backdrop is, by scaling it toward the camera.
   The climbable ascent at its foot comes later and will be ordinary voxels.

   Cost: one draw call, about 24,000 triangles (measured on an M1: 0.1 to 0.2 ms), no lights, no textures, no shadow
   pass. Shading is per pixel but trivial: every expression is clamped and every
   smoothstep runs low edge to high, so no GPU can produce an invalid pixel.

   FCOredor.set(false) hides it. FCOredor.anchor is its position in the world. */
(function(){'use strict';
if(typeof THREE==='undefined'||typeof State==='undefined')return;
const O=window.FCOredor={version:'0.108.0',enabled:true,anchor:new THREE.Vector3(0,-40,1400),height:720,radius:980};
const DRAW=330; // drawn no further than this from the camera; the sky dome is 380 m

// ─── Shape: a dominant peak, two shoulder summits, ridges and gullies ──────
function hash(x,y){const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s)}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
 const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy}
function ridged(x,y){let s=0,amp=.5,f=1,w=1;for(let i=0;i<6;i++){let n=1-Math.abs(noise(x*f,y*f)*2-1);n*=n;n*=w;w=Math.min(1,n*1.8);s+=n*amp;f*=2.13;amp*=.52}return s}
const PEAKS=[[0,0,1,.34],[-.36,-.08,.62,.24],[.33,.05,.55,.22],[.12,.34,.38,.2],[-.2,.3,.34,.22]];
function heightAt(x,z){ // x,z in -1..1 (massif units), returns 0..~1
 // Domain warp bends the ridges so they do not run in straight lines.
 const wx=x+(noise(x*2.3+5,z*2.3)-.5)*.18,wz=z+(noise(x*2.3,z*2.3+9)-.5)*.18;x=wx;z=wz;
 let h=0;for(const [px,pz,ph,pw] of PEAKS){const d=Math.hypot(x-px,(z-pz)*1.15)/pw;h=Math.max(h,ph*Math.exp(-d*d*.9)/(1+d*.35))}
 const r=Math.hypot(x,z),edge=Math.max(0,1-r);h*=Math.min(1,edge*2.2);
 const detail=ridged(x*3.1+11,z*3.1+7),fine=ridged(x*9.7+3,z*9.7+1);
 // Gullies: radial cuts that deepen with height, so the faces fall in buttresses.
 const ang=Math.atan2(z,x),gully=Math.pow(Math.abs(Math.sin(ang*9+noise(x*4,z*4)*5)),6)*h*.16;
 return Math.max(0,h*(.6+.62*detail+.12*fine)-gully+edge*.03*detail)}
const geo=(function(){const A=192,R=64,pos=[],idx=[];pos.push(0,heightAt(0,0),0);
 for(let j=1;j<=R;j++){const r=Math.pow(j/R,1.35);for(let i=0;i<A;i++){const t=i/A*Math.PI*2,x=Math.cos(t)*r,z=Math.sin(t)*r;pos.push(x,heightAt(x,z),z)}}
 for(let i=0;i<A;i++)idx.push(0,1+(i+1)%A,1+i);
 for(let j=1;j<R;j++)for(let i=0;i<A;i++){const a=1+(j-1)*A+i,b=1+(j-1)*A+(i+1)%A,c=1+j*A+i,d=1+j*A+(i+1)%A;idx.push(a,b,c,b,d,c)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();return g})();
let top=0;{const p=geo.attributes.position;for(let i=0;i<p.count;i++)top=Math.max(top,p.getY(i))}

// ─── Shading: rock, snow by height and slope, sun, moonlit snow, haze ──────
const U={uSun:{value:new THREE.Vector3(.3,.8,-.5)},uDay:{value:1},uHaze:{value:new THREE.Color(0x8a96aa)},uTop:{value:top},uMist:{value:.6}};
const mat=new THREE.ShaderMaterial({uniforms:U,fog:false,
 vertexShader:`varying vec3 vN;varying float vH;varying vec2 vXZ;void main(){vN=normalize(mat3(modelMatrix)*normal);vH=position.y;vXZ=position.xz;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform vec3 uSun,uHaze;uniform float uDay,uTop,uMist;varying vec3 vN;varying float vH;varying vec2 vXZ;
 float h2(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
 void main(){
  vec3 n=normalize(vN);float up=clamp(n.y,0.,1.);float h=clamp(vH/max(uTop,.001),0.,1.);
  float grain=h2(floor(vXZ*260.))*.06;
  float snowLine=.46-up*.16+grain;float snow=smoothstep(snowLine,snowLine+.07,h)*smoothstep(.35,.6,up);
  float strata=.5+.5*sin(vH*90.+grain*30.+vXZ.x*6.);
  vec3 rock=mix(vec3(.15,.14,.15),vec3(.31,.29,.28),clamp(h*1.25+grain+strata*.12,0.,1.));
  float cliff=1.-smoothstep(.25,.6,up);rock=mix(rock,vec3(.11,.10,.11),cliff*.55);
  vec3 base=mix(rock,vec3(.88,.91,.96),snow);
  float sun=clamp(dot(n,normalize(uSun)),0.,1.);
  float lit=uDay*(.30+.85*sun)+(1.-uDay)*(.05+.16*snow*(.4+.6*up));
  vec3 col=base*lit+vec3(1.,.82,.6)*sun*snow*uDay*.18*clamp(1.-normalize(uSun).y*2.,0.,1.);
  float haze=clamp(uMist*(1.-h*.85),0.,.96);
  col=mix(col,uHaze,haze);
  gl_FragColor=vec4(clamp(col,0.,1.5),1.);}`});
const mesh=new THREE.Mesh(geo,mat);mesh.name='mount-oredor';mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=false;mesh.userData._hdTag=1;mesh.renderOrder=-900;

// ─── Each frame: keep bearing and angular size, follow the sky ─────────────
const v=new THREE.Vector3();
function frame(){requestAnimationFrame(frame);const cam=State.camera,scene=State.scene;if(!cam||!scene)return;
 if(mesh.parent!==scene)scene.add(mesh);mesh.visible=O.enabled;if(!O.enabled)return;
 v.copy(O.anchor).sub(cam.position);const dist=v.length(),s=Math.min(1,DRAW/Math.max(dist,1));
 mesh.position.copy(cam.position).addScaledVector(v,s);mesh.scale.set(O.radius*s,O.height*s,O.radius*s);
 const hour=(((State.dayTime||0)/60)%24+24)%24,ang=(hour-6)/12*Math.PI;
 U.uSun.value.set(Math.cos(ang)*.8,Math.max(-.2,Math.sin(ang)),-.45);U.uDay.value=Math.min(1,Math.max(0,Math.sin(ang)*2.2+.15));
 if(scene.fog&&scene.fog.color)U.uHaze.value.copy(scene.fog.color);U.uMist.value=.3+.38*(1-U.uDay.value)}
requestAnimationFrame(frame);
Object.assign(O,{mesh,uniforms:U,set(on){O.enabled=!!on;mesh.visible=O.enabled;return O.enabled},bearing(){const c=State.camera;return c?Math.atan2(O.anchor.x-c.position.x,O.anchor.z-c.position.z):0}});
})();
