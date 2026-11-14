/* Window panes: glazing that reads as windows instead of flat coloured cubes.

   Lit and dark pane blocks were single flat squares, so every tower was a
   checkerboard. This adds, in the existing voxel shader and at no geometry cost:
     frames, a mullion or a sash rail (varies per window)
     lit rooms of unequal brightness, mostly warm, a few cool, some with blinds
     dark panes that carry a sky gradient, a reflection streak, sometimes curtains
   Detail fades out with distance so far towers do not shimmer.
   One uniform, no textures. FCWindowPanes.set(false) restores flat panes. */
(function(){'use strict';
if(typeof THREE==='undefined')return;
const U={uPaneOn:{value:1}};
const P=window.FCWindowPanes={uniforms:U,patched:0,set(on){U.uPaneOn.value=on?1:0;return !!on}};
const HEAD=`
uniform float uPaneOn;
float fcPaneHash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
`;
const BODY=`
{
 float fcPid=floor(vSurfMat+0.5);
 bool fcLit=fcPid==4.0||fcPid==81.0;
 bool fcDark=fcPid==5.0||fcPid==38.0||fcPid==80.0;
 if(uPaneOn>0.5&&abs(vSurfN.y)<0.5&&(fcLit||fcDark)){
  vec3 fcCell=floor(vSurfW-vSurfN*0.5);
  float fcU=abs(vSurfN.x)>0.5?fract(vSurfW.z):fract(vSurfW.x);
  float fcV=fract(vSurfW.y);
  float fcH=fcPaneHash(fcCell),fcH2=fcPaneHash(fcCell+17.3);
  float fcNear=1.0-smoothstep(45.0,110.0,1.0/gl_FragCoord.w);
  float fcEdge=min(min(fcU,1.0-fcU),min(fcV,1.0-fcV));
  float fcFrame=1.0-smoothstep(0.05,0.075,fcEdge);
  float fcMull=(1.0-smoothstep(0.014,0.03,abs(fcU-0.5)))*step(0.4,fcH2);
  float fcRail=(1.0-smoothstep(0.014,0.03,abs(fcV-0.54)))*step(fcH2,0.72);
  float fcBars=max(fcFrame,max(fcMull,fcRail)*fcNear);
  vec3 fcGlass;
  if(fcLit){
   float fcBright=mix(0.4,1.0,fcH);
   vec3 fcTint=mix(vec3(1.0,0.87,0.66),vec3(0.8,0.92,1.0),step(0.8,fcH2));
   float fcRoom=mix(0.7,1.0,smoothstep(0.0,0.55,fcV))*mix(1.0,0.78,smoothstep(0.62,1.0,fcV));
   fcGlass=fcTint*fcBright*mix(1.0,fcRoom,fcNear);
   float fcBlind=step(1.0-fcH2*0.7,fcV)*step(0.5,fcH)*fcNear;
   fcGlass=mix(fcGlass,fcGlass*vec3(1.0,0.94,0.8)*0.7,fcBlind);
   fcGlass*=1.0-fcBlind*0.14*step(0.5,fract(fcV*13.0));
   diffuseColor.rgb=mix(diffuseColor.rgb*fcGlass,vec3(0.06,0.055,0.05),fcBars);
  }else{
   fcGlass=mix(vec3(0.5,0.58,0.68),vec3(1.5,1.75,2.0),fcV*0.55+fcH*0.3);
   float fcCurtain=step(0.62,fcH2)*(step(fcU,0.2+fcH*0.12)+step(0.8-fcH*0.12,fcU))*fcNear;
   fcGlass=mix(fcGlass,vec3(2.3,2.15,1.9),clamp(fcCurtain,0.0,1.0)*0.55);
   fcGlass+=0.35*smoothstep(0.93,1.0,sin((fcU+fcV*0.6+fcH*6.0)*2.6))*fcNear;
   diffuseColor.rgb=mix(diffuseColor.rgb*fcGlass,vec3(0.2,0.2,0.19),fcBars);
  }
 }
}
`;
function patch(mat){
 if(!mat||mat.__panes||!mat.__hdPatched||!mat.onBeforeCompile)return false;
 mat.__panes=true;const inner=mat.onBeforeCompile,innerKey=mat.customProgramCacheKey;
 mat.onBeforeCompile=function(shader,renderer){
  inner.call(this,shader,renderer);
  const fs=shader.fragmentShader;
  if(!/varying float vSurfMat/.test(fs)||fs.indexOf('#include <color_fragment>')<0){console.warn('[window-panes] voxel shader not recognised; panes left flat');return}
  shader.uniforms.uPaneOn=U.uPaneOn;
  shader.fragmentShader=fs.replace('#include <common>','#include <common>\n'+HEAD).replace('#include <color_fragment>','#include <color_fragment>\n'+BODY);
 };
 mat.customProgramCacheKey=function(){return(innerKey?innerKey.call(this):'')+'|panes-2'};
 mat.needsUpdate=true;P.patched++;return true;
}
// The voxel materials are patched for surface detail during start-up; follow them.
let tries=0;const timer=setInterval(()=>{if(typeof M!=='undefined'){patch(M.voxOpaque);patch(M.voxEmit)}if(P.patched>=2||++tries>240)clearInterval(timer)},250);
P.patch=patch;
})();
