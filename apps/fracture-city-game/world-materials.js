/* World-space material atlas. Four deterministic 512px tiles, one shared texture.
   No mesh overlays, collision changes, external assets, or per-frame painting. */
(function(){'use strict';
const size=512, canvas=document.createElement('canvas');canvas.width=canvas.height=size*2;
const g=canvas.getContext('2d');let seed=6517;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
function rect(x,y,w,h,v,a=1){g.fillStyle=`rgba(${v},${v},${v},${a})`;g.fillRect(x,y,w,h)}
for(let tile=0;tile<4;tile++){
 g.save();g.translate((tile%2)*size,Math.floor(tile/2)*size);g.beginPath();g.rect(0,0,size,size);g.clip();
 rect(0,0,size,size,tile===0?174:tile===2?190:201);
 // Fine mineral grain survives mipmapping without a screen-space noise layer.
 for(let i=0;i<46000;i++){const v=100+Math.floor(rand()*150);rect(rand()*size,rand()*size,1+rand()*2,1+rand()*2,v,tile===0?.4:.17)}
 if(tile===0){
  // Asphalt: irregular repaired fissures and scattered aggregate.
  for(let n=0;n<7;n++){let x=rand()*size,y=rand()*size;g.beginPath();g.moveTo(x,y);for(let i=0;i<12;i++){x+=(rand()-.5)*36;y+=10+rand()*14;g.lineTo(x,y)}g.strokeStyle='rgba(40,37,35,.55)';g.lineWidth=2+rand()*3;g.stroke();g.strokeStyle='rgba(235,229,213,.22)';g.lineWidth=.7;g.stroke()}
  for(let i=0;i<500;i++)rect(rand()*size,rand()*size,1+rand()*3,1+rand()*2,245,.24);
 }else if(tile===1){
  // Concrete: pitting, worn form ties, mineral blooms. Large stains are shader-side.
  for(let i=0;i<1600;i++){const x=rand()*size,y=rand()*size,r=.5+rand()*2;g.fillStyle='rgba(65,62,57,.22)';g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();rect(x,y+r,2,.6,248,.5)}
  for(const x of [48,464])for(const y of [48,464]){g.fillStyle='#777570';g.beginPath();g.arc(x,y,3,0,Math.PI*2);g.fill()}
 }else if(tile===2){
  // Hand-laid masonry: 64cm bricks / 24cm courses in the world shader.
  for(let row=0;row<8;row++)for(let col=-1;col<4;col++){
   const x=col*171+(row%2)*85.5,y=row*64,v=155+Math.floor(rand()*65);
   rect(x,y,169,62,94);rect(x+3,y+3,164,56,v);rect(x+3,y+3,164,2,245,.35);rect(x+3,y+57,164,3,62,.45);
   for(let i=0;i<180;i++)rect(x+4+rand()*160,y+5+rand()*50,rand()*4+1,rand()*2+1,rand()>.5?65:245,.2);
  }
 }else{
  // Galvanised metal with directional scratches and oxidation islands.
  for(let i=0;i<2800;i++)rect(rand()*size,rand()*size,.5+rand(),3+rand()*48,rand()>.5?90:248,.14);
  for(let i=0;i<80;i++){const x=rand()*size,y=rand()*size,r=2+rand()*19;const grad=g.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,'rgba(69,53,38,.6)');grad.addColorStop(1,'rgba(90,74,53,0)');g.fillStyle=grad;g.fillRect(x-r,y-r,r*2,r*2)}
 }
 g.restore();
}
const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.LinearEncoding;
texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
texture.generateMipmaps=true;texture.anisotropy=4;texture.userData.shared=true;
const glsl=`
uniform sampler2D uWorldAtlas;
vec3 fcWeathered(vec3 wp, vec3 n, float mid){
 int id=int(mid+0.5);
 // Glass, light sources and player pigments keep their intended finish.
 if(uSurfMode<0.5 || !(id==1||id==2||id==3||id==6||id==7||id==11||id==12||id==151||id==152||id==153))return vec3(1.0);
 vec2 p=abs(n.y)>.5?wp.xz:(abs(n.x)>.5?vec2(wp.z,wp.y):wp.xy);
 float tile=id==11?2.0:(id==7||id==12?3.0:(id==1||id==153?0.0:1.0));
 vec2 scale=id==11?vec2(1.0/1.92):vec2(.5);
 vec2 f=fract(p*scale);
 // Inset the sample to prevent bleed into the neighbouring material.
 vec2 uv=(vec2(mod(tile,2.0),floor(tile/2.0))+(f*510.0+1.0)/512.0)*.5;
 float relief=texture2D(uWorldAtlas,uv).r;
 float close=1.0-smoothstep(35.0,95.0,distance(cameraPosition,wp));
 float detail=mix(1.0,mix(.62,1.26,relief),close*.85);
 float mineral=hdNoise(p*.32+17.0);
 float stain=hdNoise(vec2(p.x*1.7,p.y*.16)+4.0);
 float wall=1.0-abs(n.y);
 float damp=(1.0-smoothstep(1.0,4.8,wp.y))*wall;
 vec3 tint=mix(vec3(1.02,1.01,.98),vec3(.79,.83,.77),damp*(.2+mineral*.5));
 detail*=mix(.88,1.08,mineral);
 if(uSurfMode>1.5){
  detail*=1.0-wall*smoothstep(.48,.84,stain)*.22;
  if(id==7||id==12)tint*=mix(vec3(1.0),vec3(1.08,.78,.58),smoothstep(.5,.8,mineral)*(id==12?.6:.25));
 }
 return tint*detail;
}
`;
const mode={value:1};
setInterval(()=>{mode.value=window.HD?.surfMode??1},1000);
function dress(mat,id=3){
 if(!mat||mat.isMeshBasicMaterial||mat.userData.fcWeathered)return mat;
 mat.userData.fcWeathered=true;
 mat.onBeforeCompile=shader=>{
  shader.uniforms.uWorldAtlas={value:texture};shader.uniforms.uSurfMode=mode;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 fcW;varying vec3 fcN;').replace('#include <begin_vertex>',`#include <begin_vertex>
 vec4 fcP=vec4(transformed,1.0);
 #ifdef USE_INSTANCING
 fcP=instanceMatrix*fcP;
 #endif
 fcW=(modelMatrix*fcP).xyz;fcN=normal;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 varying vec3 fcW;varying vec3 fcN;uniform float uSurfMode;
 float hdNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(fract(sin(dot(i,vec2(12.9898,78.233)))*43758.5453),fract(sin(dot(i+vec2(1,0),vec2(12.9898,78.233)))*43758.5453),f.x),mix(fract(sin(dot(i+vec2(0,1),vec2(12.9898,78.233)))*43758.5453),fract(sin(dot(i+vec2(1,1),vec2(12.9898,78.233)))*43758.5453),f.x),f.y);}
 `+glsl).replace('#include <color_fragment>',`#include <color_fragment>\ndiffuseColor.rgb*=fcWeathered(fcW,normalize(fcN),${Number(id).toFixed(1)});`);
  if(mat.isMeshStandardMaterial)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 if(uSurfMode>1.5){
  vec2 fcPlane=abs(fcN.y)>.5?fcW.xz:(abs(fcN.x)>.5?fcW.zy:fcW.xy);
  float fcHeight=texture2D(uWorldAtlas,(vec2(1.0,0.0)+(fract(fcPlane*.5)*510.0+1.0)/512.0)*.5).r*.018;
  vec3 fcDx=dFdx(-vViewPosition),fcDy=dFdy(-vViewPosition);
  vec3 fcR1=cross(fcDy,normal),fcR2=cross(normal,fcDx);
  float fcDet=dot(fcDx,fcR1);
  if(abs(fcDet)>.000001)normal=normalize(abs(fcDet)*normal-sign(fcDet)*(dFdx(fcHeight)*fcR1+dFdy(fcHeight)*fcR2));
 }
 `);
 };
 mat.customProgramCacheKey=()=> 'fc-authored-weathered-'+id;mat.needsUpdate=true;return mat;
}
window.FCWorldMaterials={texture,glsl,dress,version:'0.66.0'};
})();
