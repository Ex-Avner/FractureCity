/* THE MIRROR HOUR

   Every night the Fractured Mirror rises over the city: eight shards of an
   octahedron holding a sky that is not this one. An aurora in the three axis
   colours crosses overhead. From the centre of every intersection a thread of
   light climbs to the mirror, with pulses travelling up it. Motes drift.

   Walk through the foot of a thread and it rings: a bell in a pentatonic scale,
   and one line of a sixteen-line poem. The lines are scattered across the city
   and found in any order. Hear all sixteen and the mirror draws together and
   stays that way. It never closes.

   By day the mirror is a ghost in the sky, like a day moon.

   Cost: no lights, five draw calls while the hour is up, none of them textured.
   The aurora is shaded per vertex. If frames run long the piece sheds its own
   layers (aurora first, then motes and half the threads): FCMirrorHour.perf().
   Everything but the ghost is switched off by day. Sound follows the game's own
   sound switch. Progress is kept per browser in localStorage (fc-mirror-hour).

   FCMirrorHour.toggle()  hold the hour now, whatever the clock says, or let it go
   FCMirrorHour.read()    show the poem as far as it has been found */
(function(){'use strict';
if(typeof THREE==='undefined'||typeof State==='undefined')return;
const LINES=[
 'The city was one mirror once. It could not see itself.',
 'So it broke, on purpose, into eight ways of looking.',
 'Every lit window is a shard that decided to stay.',
 'You are held by a thread you did not tie.',
 'It goes up from the place where you last told the truth.',
 'Some threads hum. Some have gone quiet. Listen for those.',
 'What you call missing the mark is the mark, moving.',
 'The past leans in at every crossing and asks to be carried.',
 'The future waits one street over and does not wave.',
 'Alone is a direction. So is everyone.',
 'Certainty is a room with the lights on and the door shut.',
 'Doubt is the same room with the door open.',
 'Nothing here was repaired. It was kept.',
 'Stand where two roads meet and you are already a seam.',
 'A mirror made whole shows one face. Broken, it shows the sky.',
 'Go home by a street you have not read yet.',
];
const KEY='fc-mirror-hour',MAXT=64,GOLD=[1.0,.78,.36],TEAL=[.35,.95,.86],ROSE=[1.0,.42,.62];
const H=window.FCMirrorHour={version:'0.104.0',lines:LINES,amount:0,held:0,heard:new Set(),whole:false,threads:0};
try{const s=JSON.parse(localStorage.getItem(KEY)||'{}');for(const i of s.heard||[])if(i>=0&&i<LINES.length)H.heard.add(i);H.whole=H.heard.size>=LINES.length}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({heard:[...H.heard]}))}catch(e){}};

const NOISE=`
float mhHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float mhNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mhHash(i),mhHash(i+vec2(1,0)),f.x),mix(mhHash(i+vec2(0,1)),mhHash(i+vec2(1,1)),f.x),f.y);}
float mhFbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*mhNoise(p);p=p*2.03+17.1;a*=.5;}return s;}
vec3 mhAxis(float k){vec3 g=vec3(1.,.78,.36),t=vec3(.35,.95,.86),r=vec3(1.,.42,.62);k=fract(k)*3.;return k<1.?mix(g,t,k):k<2.?mix(t,r,k-1.):mix(r,g,k-2.);}
`;
const U={uTime:{value:0},uAmt:{value:0},uTop:{value:new THREE.Vector3()},uWhole:{value:0},uGap:{value:6}};
const root=new THREE.Group();root.name='mirror-hour';
const add=(m,order)=>{m.frustumCulled=false;m.renderOrder=order;m.castShadow=m.receiveShadow=false;m.userData._hdTag=1;root.add(m);return m};

// ─── The mirror: eight shards, each a window onto another sky ──────────────
const RX=44,RY=58;
const mirror=(function(){const p=[],n=[],b=[],id=[];let k=0;
 for(const sx of [1,-1])for(const sy of [1,-1])for(const sz of [1,-1]){const N=new THREE.Vector3(sx/RX,sy/RY,sz/RX).normalize(),V=[[sx*RX,0,0],[0,sy*RY,0],[0,0,sz*RX]];
  V.forEach((v,i)=>{p.push(...v);n.push(N.x,N.y,N.z);b.push(i===0?1:0,i===1?1:0,i===2?1:0);id.push(k)});k++}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('aN',new THREE.Float32BufferAttribute(n,3));g.setAttribute('aB',new THREE.Float32BufferAttribute(b,3));g.setAttribute('aId',new THREE.Float32BufferAttribute(id,1));
 return add(new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false,
 vertexShader:`attribute vec3 aN,aB;attribute float aId;uniform float uTime,uGap;varying vec3 vN,vW,vB;varying float vId;
 void main(){float breathe=uGap*(1.+.25*sin(uTime*.23+aId*1.7));vec3 p=position*(1.-.02*sin(uTime*.31+aId))+aN*breathe;vec4 w=modelMatrix*vec4(p,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*aN);vB=aB;vId=aId;gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`uniform float uTime,uAmt,uWhole;varying vec3 vN,vW,vB;varying float vId;${NOISE}
 void main(){vec3 v=normalize(vW-cameraPosition),n=normalize(vN);if(dot(n,v)>0.)n=-n;vec3 r=reflect(v,n);
  vec2 q=r.xz/(abs(r.y)+.55)*1.6+vId*3.7;float neb=mhFbm(q+uTime*.012),neb2=mhFbm(q*2.3-uTime*.02+9.);
  vec3 col=mix(vec3(.02,.03,.09),mhAxis(vId/8.+neb*.55+uTime*.004),smoothstep(.25,.85,neb))*(.55+neb2);
  vec2 sg=floor(q*46.);float st=step(.992,mhHash(sg))*(.5+.5*sin(uTime*1.7+mhHash(sg+3.)*40.));col+=vec3(st)*1.6;
  float fres=pow(clamp(1.-abs(dot(v,n)),0.,1.),2.5),e=min(vB.x,min(vB.y,vB.z)),edge=1.-smoothstep(0.,.022,e),inner=1.-smoothstep(0.,.16,e);
  vec3 rim=mix(vec3(1.,.86,.55),vec3(1.),uWhole);col=col*(.75+fres*1.2)+rim*(edge*1.25+inner*.12+fres*.2);
  float night=smoothstep(.0,.6,uAmt),a=mix(.075,.9,night)*(.55+.45*edge+.25*fres);
  gl_FragColor=vec4(clamp(col*mix(.75,1.25,night)*(1.+uWhole*.35),0.,4.),clamp(a,0.,1.));}`})),4)})();
// Halo behind it and the light at its heart.
const halo=add(new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,
 vertexShader:`varying vec2 vUv;void main(){vUv=uv*2.-1.;vec4 c=modelViewMatrix*vec4(0.,0.,0.,1.);c.xy+=position.xy*270.;gl_Position=projectionMatrix*c;}`,
 fragmentShader:`uniform float uTime,uAmt,uWhole;varying vec2 vUv;void main(){float r=length(vUv),a=atan(vUv.y,vUv.x);float core=exp(-r*r*140.)*.8,glow=exp(-r*3.6)*.26,rays=pow(.5+.5*sin(a*8.+uTime*.07),6.)*exp(-r*4.)*.35;
  vec3 c=mix(vec3(.55,.8,1.),vec3(1.,.85,.6),uWhole*.7+.15)*(glow+rays)+vec3(1.,.96,.88)*core;gl_FragColor=vec4(clamp(c*(1.-smoothstep(.6,1.,r))*uAmt*(1.+uWhole*.5),0.,4.),1.);}`})),3);

// ─── Aurora: three curtains, one per axis ──────────────────────────────────
const aurora=add(new THREE.Mesh(new THREE.SphereGeometry(1,112,30,0,Math.PI*2,0,Math.PI*.5),new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,fog:false,
 vertexShader:`uniform float uTime,uAmt;varying vec3 vC;${NOISE}
 void main(){vec3 d=normalize(position);float h=max(d.y,0.);vec2 p=d.xz/(h+.32);vec3 col=vec3(0.);
  for(int i=0;i<3;i++){float fi=float(i),w=mhFbm(p*(.7+fi*.25)+vec2(uTime*.018*(fi+1.),fi*7.3));
   float ridge=pow(clamp(1.-abs(sin(p.x*(.9+fi*.35)+p.y*.4*fi+w*4.5+fi*2.1+uTime*.03)),0.,1.),5.);
   col+=mhAxis(fi/3.+w*.18)*ridge*(.5+.5*w);}
  float mask=smoothstep(.03,.3,h)*(1.-smoothstep(.72,1.,h));vC=clamp(col*mask*uAmt*.55,0.,3.);gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);}`,
 fragmentShader:`varying vec3 vC;void main(){gl_FragColor=vec4(vC,1.);}`})),1);

// ─── Threads: a ribbon per intersection, drawn along a curve in the shader ─
const base=new THREE.InstancedBufferAttribute(new Float32Array(MAXT*3),3),info=new THREE.InstancedBufferAttribute(new Float32Array(MAXT*2),2);base.setUsage?.(THREE.DynamicDrawUsage);info.setUsage?.(THREE.DynamicDrawUsage);
const inst=(src)=>{const g=new THREE.InstancedBufferGeometry();g.index=src.index;g.setAttribute('position',src.attributes.position);g.setAttribute('aBase',base);g.setAttribute('aInfo',info);g.instanceCount=0;g.maxInstancedCount=0;return g};
const SEG=28,ribbon=new THREE.BufferGeometry();(function(){const p=[],ix=[];for(let i=0;i<=SEG;i++){p.push(-1,i/SEG,0,1,i/SEG,0);if(i<SEG){const a=i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2)}}ribbon.setAttribute('position',new THREE.Float32BufferAttribute(p,3));ribbon.setIndex(ix)})();
const threadGeo=inst(ribbon),ringSrc=new THREE.PlaneGeometry(2,2),ringGeo=inst(ringSrc);
const threads=add(new THREE.Mesh(threadGeo,new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,fog:false,
 vertexShader:`attribute vec3 aBase;attribute vec2 aInfo;uniform vec3 uTop;uniform float uTime;varying float vS,vT,vSeed,vLit;
 vec3 curve(float t){vec3 c=aBase+vec3(0.,uTop.y*.62,0.)+(uTop-aBase)*vec3(.1,0.,.1);vec3 p=mix(mix(aBase,c,t),mix(c,uTop,t),t);float s=t*(1.-t)*4.;p.x+=sin(uTime*.33+aInfo.x*40.+t*5.)*s*2.2;p.z+=cos(uTime*.27+aInfo.x*23.+t*4.)*s*2.2;return p;}
 void main(){float t=position.y;vec3 p=curve(t),tan=normalize(curve(t+.012)-p),sx=cross(tan,normalize(cameraPosition-p));vec3 side=sx/max(length(sx),1e-4);
  float dist=length(cameraPosition-p),w=max(mix(.07,.5,t),dist*.0016)*(1.+aInfo.y*1.6);p+=side*position.x*w;vS=position.x;vT=t;vSeed=aInfo.x;vLit=aInfo.y;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
 fragmentShader:`uniform float uTime,uAmt;varying float vS,vT,vSeed,vLit;${NOISE}
 void main(){float core=pow(clamp(1.-abs(vS),0.,1.),2.2);float ph=fract(vT*1.6-uTime*.11-vSeed*7.),pulse=1.-smoothstep(0.,.07,abs(ph-.5)),ph2=fract(vT*.9-uTime*.05+vSeed*3.),pulse2=1.-smoothstep(0.,.03,abs(ph2-.5));
  vec3 c=mix(mhAxis(vSeed),vec3(1.,.93,.78),clamp(vLit,0.,1.)*.75+pulse*.5);float glow=.3+1.9*pulse+.9*pulse2+vLit*1.3+.5*exp(-vT*14.);
  gl_FragColor=vec4(clamp(c*core*glow*uAmt*(1.-smoothstep(.8,1.,clamp(vT,0.,1.))),0.,4.),1.);}`})),2);
const rings=add(new THREE.Mesh(ringGeo,new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,
 vertexShader:`attribute vec3 aBase;attribute vec2 aInfo;varying vec2 vUv;varying float vSeed,vLit;void main(){vUv=position.xy;vSeed=aInfo.x;vLit=aInfo.y;float r=2.6+aInfo.y*1.4;vec3 p=aBase+vec3(position.x*r,.04,position.y*r);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
 fragmentShader:`uniform float uTime,uAmt;varying vec2 vUv;varying float vSeed,vLit;${NOISE}
 void main(){float r=length(vUv);float ring=(1.-smoothstep(0.,.035,abs(r-.78-.03*sin(uTime*.8+vSeed*30.))))+.5*(1.-smoothstep(0.,.02,abs(r-.52)));float ripple=(1.-smoothstep(0.,.05,abs(r-fract(uTime*.35+vSeed))))*max(0.,1.-r)*.6;
  vec3 c=mix(mhAxis(vSeed),vec3(1.,.93,.78),clamp(vLit,0.,1.)*.7);gl_FragColor=vec4(c*(ring+ripple+exp(-r*r*9.)*.55*(1.+vLit*2.))*step(r,1.)*uAmt*(.8+max(0.,vLit)),1.);}`})),2);

// ─── Motes: a box of drifting light that travels with the camera ───────────
const motes=(function(){const n=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches?160:320,p=new Float32Array(n*3);let s=77;for(let i=0;i<p.length;i++){s=(Math.imul(s,1664525)+1013904223)>>>0;p[i]=s/4294967296}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));
 return add(new THREE.Points(g,new THREE.ShaderMaterial({uniforms:Object.assign({uPx:{value:300}},U),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,
 vertexShader:`uniform float uTime,uPx;varying float vK;void main(){vec3 box=vec3(70.,36.,70.);vec3 q=position+vec3(sin(uTime*.05+position.y*9.)*.02,uTime*.006*(.4+position.x),cos(uTime*.04+position.x*7.)*.02);
  vec3 p=cameraPosition+(fract(q-cameraPosition/box)-.5)*box;vK=position.z;vec4 mv=viewMatrix*vec4(p,1.);gl_PointSize=clamp((.035+.09*position.z)*uPx/max(1.,-mv.z),1.,9.);gl_Position=projectionMatrix*mv;}`,
 fragmentShader:`uniform float uTime,uAmt;varying float vK;${NOISE}void main(){float r=length(gl_PointCoord-.5)*2.;float tw=.55+.45*sin(uTime*(.6+vK*2.)+vK*50.);gl_FragColor=vec4(mhAxis(vK*1.7)*mix(1.,1.6,vK)*exp(-r*r*5.)*tw*uAmt*.42,1.);}`})),2)})();

// No light of its own: an extra light is paid for by every lit pixel in the city, day and night.

// ─── Words ─────────────────────────────────────────────────────────────────
const css=document.createElement('style');css.textContent=`
#mirror-line{position:fixed;left:50%;bottom:24%;transform:translateX(-50%);width:min(760px,86vw);text-align:center;pointer-events:none;z-index:40;opacity:0;transition:opacity 1.4s ease;font:italic 23px/1.45 Georgia,'Times New Roman',serif;color:#f6ead0;text-shadow:0 0 18px rgba(255,214,140,.55),0 2px 3px rgba(0,0,0,.9)}
#mirror-line.on{opacity:1}#mirror-line small{display:block;margin-top:10px;font:600 10px/1 system-ui,sans-serif;letter-spacing:.32em;color:#d7b869;text-shadow:0 1px 2px #000}
#mirror-poem{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:41;opacity:0;transition:opacity 1.6s ease;background:radial-gradient(ellipse at center,rgba(8,6,18,.72),rgba(8,6,18,0) 70%)}
#mirror-poem.on{opacity:1}#mirror-poem div{max-width:min(720px,88vw);max-height:86vh;text-align:center;font:italic 17px/1.72 Georgia,serif;color:#f6ead0;text-shadow:0 1px 3px #000}
#mirror-poem h3{font:normal 13px/1 Georgia,serif;letter-spacing:.42em;color:#d7b869;margin:0 0 6px}#mirror-poem i.d{display:block;font-style:normal;color:#d7b869;margin:4px 0 12px}#mirror-poem p{margin:0}#mirror-poem p.un{opacity:.28;letter-spacing:.4em}
body.touch #mirror-line{font-size:17px;bottom:34%}body.touch #mirror-poem div{font-size:13px;line-height:1.55}
@media (prefers-reduced-motion:reduce){#mirror-line,#mirror-poem{transition:none}}`;
const lineEl=document.createElement('div');lineEl.id='mirror-line';lineEl.setAttribute('aria-live','polite');const poemEl=document.createElement('div');poemEl.id='mirror-poem';
const ready=()=>{document.head.append(css);document.body.append(lineEl,poemEl)};if(document.body)ready();else addEventListener('DOMContentLoaded',ready);
let lineT=0,poemT=0;
function say(text,sub,ms=7000){lineEl.textContent=text;if(sub){const s=document.createElement('small');s.textContent=sub;lineEl.append(s)}lineEl.classList.add('on');clearTimeout(lineT);lineT=setTimeout(()=>lineEl.classList.remove('on'),ms)}
function read(ms=22000){const d=document.createElement('div');d.innerHTML='<h3>THE MIRROR HOUR</h3><i class="d">◆</i>';LINES.forEach((l,i)=>{const p=document.createElement('p');if(H.heard.has(i))p.textContent=l;else{p.textContent='· · ·';p.className='un'}d.append(p)});
 const f=document.createElement('i');f.className='d';f.textContent=H.whole?'◆  The mirror holds. It does not close.':`◆  ${H.heard.size} of ${LINES.length}`;f.style.marginTop='12px';d.append(f);poemEl.textContent='';poemEl.append(d);poemEl.classList.add('on');clearTimeout(poemT);poemT=setTimeout(()=>poemEl.classList.remove('on'),ms)}

// ─── Sound: a held fifth under the hour, a bell for each thread ────────────
const A={ctx:null,out:null,drone:null};const SCALE=[0,2,4,7,9,12,14,16,19,21,24,26,28,31,33,36];
const soundOn=()=>{try{return typeof Snd==='undefined'||Snd.on!==false}catch(e){return true}};
function audio(){if(A.ctx)return A.ctx;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;try{const c=A.ctx=new AC(),out=A.out=c.createGain();out.gain.value=.5;
  const d1=c.createDelay(1),d2=c.createDelay(1),fb=c.createGain(),lp=c.createBiquadFilter();d1.delayTime.value=.31;d2.delayTime.value=.47;fb.gain.value=.46;lp.frequency.value=2600;
  out.connect(c.destination);out.connect(d1);d1.connect(d2);d2.connect(lp);lp.connect(fb);fb.connect(d1);d2.connect(c.destination);
  const g=A.drone=c.createGain();g.gain.value=0;g.connect(out);for(const [f,v] of [[73.42,.5],[110,.32],[146.83,.2],[220.7,.07]]){const o=c.createOscillator(),og=c.createGain();o.type='sine';o.frequency.value=f;og.gain.value=v;o.connect(og);og.connect(g);o.start()}
 }catch(e){A.ctx=null}return A.ctx}
function bell(i,vol=1){if(!soundOn())return;const c=audio();if(!c||c.state!=='running')return;const t=c.currentTime,f=146.83*Math.pow(2,SCALE[i%SCALE.length]/12);
 for(const [m,v,dur] of [[1,.22,4.5],[2.01,.09,2.6],[3.02,.04,1.4]]){const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f*m;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v*vol,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(A.out);o.start(t);o.stop(t+dur+.1)}}
for(const type of ['pointerdown','keydown','touchend'])addEventListener(type,()=>{if(H.amount>.02||H.held){const c=audio();if(c&&c.state==='suspended')c.resume().catch(()=>{})}},{passive:true});

// ─── Threads on the ground ─────────────────────────────────────────────────
const feet=[];           // {x,z,line,lit,key}
const lineFor=(cx,cz)=>{let n=Math.imul(cx,374761393)^Math.imul(cz,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)%LINES.length};
function gather(){if(!State.chunkMap||typeof Player==='undefined')return;const keep=new Map(feet.map(f=>[f.key,f]));feet.length=0;
 const list=[...State.chunkMap.values()].map(c=>({c,d:Math.hypot(c.originX-Player.position.x,c.originZ-Player.position.z)})).filter(o=>o.d<100).sort((a,b)=>a.d-b.d);
 for(const {c} of list){if(feet.length>=(H.quality>0?26:12))break;const x=c.originX,z=c.originZ;if(typeof getBlock!=='function'||getBlock(x,0,z)!==B_ASPHALT||getBlock(x,1,z)!==B_AIR||getBlock(x-1,0,z-1)!==B_ASPHALT)continue;
  const old=keep.get(c.key),line=lineFor(c.cx,c.cz);feet.push(old||{key:c.key,x,z,line,lit:H.heard.has(line)?.3:0})}
 feet.forEach((f,i)=>{base.setXYZ(i,f.x,1.02,f.z);info.setXY(i,(f.line+.5)/LINES.length,f.lit)});base.needsUpdate=info.needsUpdate=true;
 for(const g of [threadGeo,ringGeo]){g.instanceCount=feet.length;g.maxInstancedCount=feet.length}H.threads=feet.length}
function ring(f){const fresh=!H.heard.has(f.line);H.heard.add(f.line);f.lit=1.6;f.cool=6;for(const o of feet)if(o!==f&&o.line===f.line)o.lit=Math.max(o.lit,.3);bell(f.line,fresh?1:.55);
 if(fresh)save();const all=H.heard.size>=LINES.length;say(LINES[f.line],`◆  ${H.heard.size} OF ${LINES.length}`,fresh?9000:6000);
 if(all&&!H.whole){H.whole=true;setTimeout(()=>{[0,4,7,11,14].forEach((n,k)=>setTimeout(()=>bell(n,.9),k*420));say('The mirror holds. It does not close.','◆  THE MIRROR HOUR',12000);setTimeout(()=>read(30000),9000)},7000)}}

// ─── The clock ─────────────────────────────────────────────────────────────
const isNight=()=>{const h=((State.dayTime||0)/60)%24;return h>=20.5||h<4.5};
let last=0,scan=0,announced=false,ema=.016,slow=0;H.quality=2;
function frame(now){requestAnimationFrame(frame);const raw=(now-last)/1000||0,dt=Math.min(.1,raw);last=now;if(raw<.5)ema=ema*.95+raw*.05;
 if(!State.scene||!State.camera||typeof Player==='undefined')return;
 // A new world means a new scene. Follow it.
 if(root.parent!==State.scene)State.scene.add(root);
 if(State.ui&&State.ui.paused&&!H.held&&H.amount<.001)return;
 const want=(H.held>now||isNight())?1:0;H.amount+=(want-H.amount)*Math.min(1,dt*.35);if(Math.abs(want-H.amount)<.002)H.amount=want;
 const a=H.amount,on=a>.004,cam=State.camera;U.uTime.value=now/1000;U.uAmt.value=a;
 U.uWhole.value+=((H.whole?1:0)-U.uWhole.value)*Math.min(1,dt*.4);U.uGap.value+=((H.whole?1.2:7)-U.uGap.value)*Math.min(1,dt*.3);
 // The mirror keeps its station in the sky the way the moon does, with a slow drift of its own.
 const k=Math.min(cam.far*.6,250)/302; // the sky dome is a depth-writing sphere 380 m out; stay inside it
 mirror.position.set(cam.position.x-150*k,cam.position.y*.25+150*k,cam.position.z-215*k);mirror.scale.setScalar(k);mirror.rotation.y=now*.00003;mirror.rotation.z=Math.sin(now*.00002)*.12;
 halo.position.copy(mirror.position);halo.visible=on;
 aurora.position.copy(cam.position);aurora.scale.setScalar(Math.min(cam.far*.85,350));aurora.visible=on&&H.quality>1;threads.visible=rings.visible=on&&feet.length>0;motes.visible=on&&H.quality>0;
 if(on&&H.governor!==false&&H.quality>0){slow=ema>.026?slow+dt:0;if(slow>3){H.quality--;slow=0;console.info('[mirror-hour] frames at '+(ema*1000).toFixed(1)+' ms; quality now '+H.quality)}}
 U.uTop.value.copy(mirror.position);motes.material.uniforms.uPx.value=(State.renderer?State.renderer.domElement.height:720)*.9;
 if(A.drone&&A.ctx){const v=soundOn()?a*.085:0;A.drone.gain.setTargetAtTime(v,A.ctx.currentTime,.8)}
 if(!on){announced=false;return}
 if(a>.5&&!announced){announced=true;say('The Mirror Hour','◆  WALK THROUGH A THREAD',8000)}
 if(now-scan>400){scan=now;gather()}
 let dirty=false;for(let i=0;i<feet.length;i++){const f=feet[i];if(f.cool>0)f.cool-=dt;const rest=H.heard.has(f.line)?.3:0;if(f.lit>rest){f.lit=Math.max(rest,f.lit-dt*.35);info.setY(i,f.lit);dirty=true}
  if(a>.5&&!(f.cool>0)&&Math.abs(Player.position.y-2.6)<6&&Math.hypot(Player.position.x-f.x,Player.position.z-f.z)<2.3){ring(f);info.setY(i,f.lit);dirty=true}}
 if(dirty)info.needsUpdate=true}
requestAnimationFrame(frame);

Object.assign(H,{perf:()=>({ms:+(ema*1000).toFixed(1),quality:H.quality,threads:feet.length}),read,say,ring:i=>{const f=feet[i];if(f)ring(f);return !!f},feet:()=>feet.map(f=>({x:f.x,z:f.z,line:f.line})),
 summon(seconds=600){H.held=performance.now()+seconds*1000;const c=audio();if(c&&c.state==='suspended')c.resume().catch(()=>{});return true},
 release(){H.held=0;return true},
 toggle(){if(H.held>performance.now()){H.release();say('The hour is let go.','◆',4000)}else{H.summon();read(12000)}return H.held>0},
 reset(){H.heard.clear();H.whole=false;save();for(const f of feet)f.lit=0;return true},root,uniforms:U});
})();
