/* Resident studio: a shared articulated cast, live fitting room, and shoulder camera. */
(function(){
'use strict';
const defaults={jaw:.95,nose:1,shoulders:1,faceWidth:1,faceLength:1,eyes:'#69776d',outfit:'bomber'};
Object.assign(SH_DEFAULT_AVATAR,defaults);
Object.keys(defaults).forEach(k=>{if(Shift.avatar[k]===undefined)Shift.avatar[k]=defaults[k]});
const cloth=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:.02});
const sphere=new THREE.SphereGeometry(1,12,8), cube=new THREE.BoxGeometry(1,1,1);
const dark=0x171d25;
let figureConfig=null;
function loft(rows,segments=24,face=false){
 const p=[],ix=[];
 for(const [y,rx,rz,cz=0] of rows)for(let j=0;j<=segments;j++){
  const a=j/segments*Math.PI*2,x=Math.sin(a)*rx;let z=Math.cos(a)*rz+cz;
  if(face&&Math.cos(a)>0){
   const g=(cx,cy,sx,sy)=>Math.exp(-Math.pow((x-cx)/sx,2)-Math.pow((y-cy)/sy,2));
   z+=Math.pow(Math.cos(a),6)*(.025*g(0,.024,.019,.044)+.010*g(0,.002,.025,.015)+.005*g(0,-.042,.034,.019));
  }
  p.push(x,y,z);
 }
 for(let i=0;i<rows.length-1;i++)for(let j=0;j<segments;j++){let a=i*(segments+1)+j,b=a+segments+1;ix.push(a,a+1,b,b,a+1,b+1)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();
 const n=g.attributes.normal;for(let i=0;i<rows.length;i++){const a=i*(segments+1),b=a+segments;const x=(n.getX(a)+n.getX(b))*.5,y=(n.getY(a)+n.getY(b))*.5,z=(n.getZ(a)+n.getZ(b))*.5;n.setXYZ(a,x,y,z);n.setXYZ(b,x,y,z)}return g;
}
function shade(c,n){return new THREE.Color(c).multiplyScalar(n).getHex()}
// Each bone is one baked mesh, keeping a detailed crowd affordable.
function bake(bone,parts){
 const pos=[],norm=[],col=[],indices=[];
 for(const p of parts){
  const geo=p.geo.clone();const offset=pos.length/3;geo.scale(...p.s);geo.rotateZ(p.r||0);geo.translate(...p.p);
  const a=geo.attributes.position.array,n=geo.attributes.normal.array,c=new THREE.Color(p.c);
  const index=geo.index;if(index){for(const v of index.array)indices.push(v+offset)}else{for(let i=0;i<a.length/3;i++)indices.push(i+offset)}
  for(let i=0;i<a.length;i+=3){pos.push(a[i],a[i+1],a[i+2]);norm.push(n[i],n[i+1],n[i+2]);const lip=p.face&&Math.abs(a[i])<.027&&a[i+1]>-.029&&a[i+1]<-.01&&a[i+2]>.102;
   col.push(c.r*(lip?.84:1),c.g*(lip?.69:1),c.b*(lip?.72:1))}geo.dispose();
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 g.setIndex(indices);const m=new THREE.Mesh(g,cloth);m.castShadow=true;m.receiveShadow=true;m.userData.residentGeometry=true;bone.add(m);
}
function dispose(c){if(c)c.group.traverse(o=>{if(o.isMesh&&o.geometry)o.geometry.dispose()})}
const build=shBuildCharacter;
window.shBuildCharacter=function(arch,rng,cfg){
 const c=build.apply(this,arguments),f=Object.assign({},defaults,cfg,figureConfig||{});
 const skin=c.skinHex,hair=c.hairHex,coat=figureConfig?c.coatHex:new THREE.Color(c.coatHex).lerp(new THREE.Color(0x626973),.32).getHex(),pants=c.pantsHex,trim=c.accent;
 // Preserve archetype, nameplate, role metadata and carried-object identity.
 const old=c.group;old.remove(c.plate);if(c.aura)old.remove(c.aura);dispose(c);
 const root=new THREE.Group();root.add(c.plate);if(c.aura)root.add(c.aura);
 const width=Math.max(.72,Math.min(1.4,(f.widthScale||1)*(f.build==='solid'?1.12:f.build==='lean'?.93:figureConfig?1:(arch.build||1))));
 const height=Math.max(.8,Math.min(1.25,(f.heightScale||1)*(f.build==='tall'?1.06:figureConfig?1:(arch.height||1))));
 root.scale.set(width,height,1);c.plate.position.y=2.05;
 const buckets=new Map();
 function bone(parent,x,y,z){const b=new THREE.Group();b.position.set(x,y,z);parent.add(b);buckets.set(b,[]);return b}
 function ell(b,x,y,z,sx,sy,sz,color,r){buckets.get(b).push({geo:sphere,p:[x,y,z],s:[sx,sy,sz],c:color,r})}
 function shape(b,rows,color,face=false){const geo=loft(rows,24,face);buckets.get(b).push({geo,p:[0,0,0],s:[1,1,1],c:color,owned:true})}
 function box(b,x,y,z,sx,sy,sz,color,r){buckets.get(b).push({geo:cube,p:[x,y,z],s:[sx,sy,sz],c:color,r})}
 const body=bone(root,0,0,0),head=bone(root,0,1.61,0);
 const shoulder=.235*Math.max(.85,Math.min(1.18,f.shoulders||1));
 const la=bone(root,-shoulder,1.43,0),ra=bone(root,shoulder,1.43,0);
 const ll=bone(root,-.105,.89,0),rl=bone(root,.105,.89,0);
 const elbows=[],knees=[];
 // Chest, rib cage, waist and pelvis are distinct volumes with fitted clothing.
 shape(body,[[.965,.155,.104],[.99,.172,.115],[1.12,.17,.112],[1.29,.202,.126],[1.41,.219,.109],[1.465,.175,.087],[1.49,.075,.066]],coat);
 shape(body,[[.84,.155,.105],[.90,.177,.118],[.965,.158,.105]],pants);
 const outfit=f.outfit||'bomber';
 if(outfit==='longcoat'){shape(body,[[.72,.218,.143],[.85,.211,.14],[.99,.174,.118],[1.08,.172,.114]],coat);box(body,0,.91,.123,.008,.34,.008,shade(coat,.5))}
 shape(body,[[1.47,.064,.058],[1.57,.057,.055],[1.62,.055,.05]],skin);
 box(body,0,1.305,.122,.009,.34,.006,shade(coat,.6));
 // Fine zip, collar, cuffs and lapels replace the old luminous body stripes.
 box(body,0,1.27,.132,.006,.38,.005,shade(trim,.7));
 box(body,-.062,1.462,.065,.044,.065,.016,shade(coat,.8),-.4);box(body,.062,1.462,.065,.044,.065,.016,shade(coat,.8),.4);
 if(outfit==='tailored'){box(body,-.081,1.355,.127,.06,.22,.013,shade(coat,1.2),-.26);box(body,.081,1.355,.127,.06,.22,.013,shade(coat,1.2),.26)}
 if(outfit==='utility'){for(const side of [-1,1]){box(body,side*.115,1.29,.123,.09,.10,.024,shade(coat,.8));box(body,side*.115,1.335,.139,.09,.016,.009,shade(coat,1.15))}}
 box(body,0,.972,.106,.31,.025,.018,dark);box(body,0,.972,.12,.035,.027,.01,shade(trim,.7));
 for(const [arm,side] of [[la,-1],[ra,1]]){
  shape(arm,[[-.30,.052,.055],[-.23,.060,.063],[-.12,.073,.074],[-.025,.077,.071],[.04,.032,.036]],coat);const fore=bone(arm,0,-.285,0);elbows.push(fore);
  shape(fore,[[-.248,.043,.044],[-.21,.047,.048],[-.11,.058,.060],[0,.054,.056]],coat);shape(fore,[[-.26,.044,.045],[-.238,.044,.045]],shade(coat,.65));
  ell(fore,0,-.296,.008,.042,.065,.028,skin);ell(fore,-side*.04,-.278,.021,.016,.037,.019,skin,-side*.4);
  for(let i=0;i<4;i++)ell(fore,(i-1.5)*.018,-.352,.012,.010,.033-(Math.abs(i-1.5)*.006),.012,skin);
 }
 for(const leg of [ll,rl]){
  shape(leg,[[-.43,.063,.067],[-.34,.073,.079],[-.19,.086,.091],[-.025,.092,.10],[.04,.074,.085]],pants);const shin=bone(leg,0,-.415,0);knees.push(shin);
  shape(shin,[[-.36,.055,.061],[-.27,.059,.07],[-.15,.067,.077],[0,.064,.068]],pants);shape(shin,[[-.40,.063,.08,.025],[-.31,.06,.065],[ -.26,.058,.06]],dark);
  ell(shin,0,-.403,.058,.076,.061,.143,dark);box(shin,0,-.435,.055,.145,.025,.265,shade(dark,1.8));
  for(let i=0;i<3;i++)box(shin,0,-.372,.07+i*.021,.071,.006,.007,0x697078);
 }
 // Adult head proportions; sculpted cheek, jaw, sockets, nose and ears.
 const jaw=Math.max(.8,Math.min(1.2,f.jaw||1));
 const faceGeo=new THREE.BufferGeometry();const verts=FCResidentHead.position.slice();
 for(let i=0;i<verts.length;i+=3){
  const y=verts[i+1],x=verts[i],z=verts[i+2];
  verts[i]*=(f.faceWidth||1)*(1+(jaw-1)*Math.exp(-Math.pow((y+.046)/.065,2)));
  verts[i+1]*=(f.faceLength||1);
  if(z>.08)verts[i+2]+=(f.nose-1)*.06*Math.exp(-Math.pow(x/.025,2)-Math.pow((y-.012)/.033,2));
 }
 faceGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));faceGeo.setIndex(FCResidentHead.index);faceGeo.computeVertexNormals();
 buckets.get(head).push({geo:faceGeo,p:[0,0,0],s:[1,1,1],c:skin,owned:true,face:true});
 for(const side of [-1,1]){
  ell(head,side*.031*(f.faceWidth||1),.053*(f.faceLength||1),.085,.0135,.0135,.0135,0xb9b4a9);
  ell(head,side*.031*(f.faceWidth||1),.053*(f.faceLength||1),.098,.0065,.0065,.0015,new THREE.Color(f.eyes).getHex());
  ell(head,side*.031*(f.faceWidth||1),.053*(f.faceLength||1),.100,.0028,.0033,.001,0x161c20);
  ell(head,side*.033*(f.faceWidth||1),.080*(f.faceLength||1),.103,.020,.0033,.0025,shade(hair,.8),side*.06);
 }
 const hs=c.hairStyle;
 if(hs!=='bald'){
  const hp=verts.slice(),hi=[];
  const covered=i=>hp[i*3+1]>(hp[i*3+2]>.056?.125:.065);
  for(let i=0;i<FCResidentHead.index.length;i+=3){const ids=FCResidentHead.index.slice(i,i+3);if(ids.every(covered))hi.push(...ids)}
  for(let i=0;i<hp.length;i+=3){hp[i]*=1.035;hp[i+1]+=.004;hp[i+2]=hp[i+2]*1.035-.002}
  const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(hp,3));cap.setIndex(hi);cap.computeVertexNormals();buckets.get(head).push({geo:cap,p:[0,0,0],s:[1,1,1],c:hair,owned:true});
  if(hs==='wave'||hs==='spiked')for(let i=0;i<7;i++){const x=(i-3)*.016;ell(head,x,.166-Math.abs(x)*.25,.061,.020,hs==='spiked'?.040:.023,.040,hair,-.35)}
  if(hs==='long')for(const side of [-1,1])ell(head,side*.076,.015,-.025,.022,.14,.069,hair,side*.06);
  if(hs==='bun')ell(head,0,.133,-.073,.047,.046,.033,hair);
  if(hs==='mohawk')ell(head,0,.185,.012,.018,.042,.072,hair);
 }
 if(c.headgear==='cap'||c.headgear==='hat'){ell(head,0,.17,-.008,.113,.05,.105,dark);ell(head,0,.151,.091,c.headgear==='hat'?.15:.105,.009,.087,dark)}
 if(c.headgear==='hood'){ell(body,0,1.48,-.066,.142,.118,.094,coat)}
 if(c.headgear==='helmet'){ell(head,0,.143,-.016,.119,.086,.115,0x454c59)}
 if(c.headgear==='mask')ell(head,0,-.007,.10,.074,.042,.026,dark);
 if(c.headgear==='visor')box(head,0,.054,.112,.174,.027,.009,0x657785);
 if(c.prop==='satchel'||c.prop==='case'||c.prop==='guitar'){
  box(body,-.13,1.23,.137,.025,.46,.019,dark,-.4);ell(body,.21,.99,-.025,.075,.14,.12,shade(coat,.55));
 }
 if(c.prop==='phone')box(elbows[1],0,-.285,.042,.049,.086,.012,dark);
 if(c.prop==='umbrella'){box(ra,0,-.19,.05,.014,.92,.014,dark);ell(ra,0,.33,.05,.37,.095,.37,shade(coat,.6))}
 if(c.prop==='box'||c.prop==='crate')box(body,0,1.01,.24,.34,.25,.25,0x897661);
 for(const [b,p] of buckets)if(p.length){bake(b,p);p.forEach(part=>{if(part.owned)part.geo.dispose()})}
 Object.assign(c,{group:root,head,leftArm:la,rightArm:ra,leftLeg:ll,rightLeg:rl,studio:{elbows,knees,height:1.82*height}});
 c.gait.bob=.008;c.headTilt=0;return c;
};
const figure=shBuildFigure;
window.shBuildFigure=function(cfg){const prev=figureConfig;figureConfig=cfg;try{return figure.apply(this,arguments)}finally{figureConfig=prev}};
const animate=shAnimateCharacter;
window.shAnimateCharacter=function(c,dt,moving,t){animate.apply(this,arguments);if(!c.studio)return;
 c.leftArm.rotation.z=.065;c.rightArm.rotation.z=-.065;
 c.studio.elbows.forEach(e=>e.rotation.x=-.10);
 c.studio.knees.forEach((k,i)=>k.rotation.x=moving?Math.max(0,Math.sin(c.gait.phase+i*Math.PI))*.48:0);
};
const mirror=shRebuildMirror;
window.shRebuildMirror=function(){const old=SHIFT_WORLD.mirror;const result=mirror.apply(this,arguments);if(old&&old!==SHIFT_WORLD.mirror)dispose(old);return result};
const panel=shPanelResident;
window.shPanelResident=function(mode){
 let html=panel.apply(this,arguments);if(mode!=='avatar')return html;
 const options=(key,items)=>`<fieldset class="sh-swatches"><legend>${key==='outfit'?'Jacket cut':'Eye colour'}</legend><div class="sh-pills">${items.map(v=>`<button data-act="style" data-key="${key}" data-val="${v}" class="${Shift.avatar[key]===v?'sel':''}">${key==='eyes'?({'#69776d':'Sage','#5c738c':'Blue','#503c2c':'Brown','#9d8651':'Hazel'}[v]):v}</button>`).join('')}</div></fieldset>`;
 const ranges=[['Face width','faceWidth',.88,1.12],['Face length','faceLength',.9,1.1],['Jaw','jaw',.8,1.2],['Nose','nose',.8,1.25],['Shoulders','shoulders',.85,1.18]].map(([label,key,min,max])=>`<label class="sh-range">${label}<input aria-label="${label}" type="range" data-range="${key}" min="${min}" max="${max}" step=".01" value="${Shift.avatar[key]||defaults[key]}"><small>${Math.round((Shift.avatar[key]||defaults[key])*100)}%</small></label>`).join('');
 html=html.replace(shFigureHtml(),'<div id="resident-preview"><canvas aria-label="Live character preview. Drag to rotate."></canvas><button type="button" id="resident-portrait">Face / full body</button><p>Drag to turn • Changes preview live</p></div>');
 html=html.replace('grid-template-columns:200px 1fr','grid-template-columns:minmax(260px, .85fr) 1.15fr');
 html=html.replace('Resident configuration','Make your mark');
 html=html.replace('the figure in your doorway updates live','your look, in every street');
 html=html.replace('<div style="display:grid;gap:12px">',`<div style="display:grid;gap:12px"><div class="resident-extra"><fieldset class="sh-swatches"><legend>Wardrobe palettes</legend><div class="sh-pills">${['Midnight','Rust','Slate','Ivory'].map(name=>`<button type="button" data-resident-preset="${name}">${name}</button>`).join('')}</div></fieldset>${options('outfit',['bomber','tailored','utility','longcoat'])}${options('eyes',['#69776d','#5c738c','#503c2c','#9d8651'])}${ranges}</div>`);
 return html;
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-resident-preset]');if(!b)return;const palettes={Midnight:['#24313d','#171d25','#c6ab72'],Rust:['#75473b','#252d35','#c5b296'],Slate:['#64717b','#253039','#a8bec4'],Ivory:['#cbc4b2','#3b4148','#837354']};const [coat,pants,accent]=palettes[b.dataset.residentPreset];Object.assign(Shift.avatar,{coat,pants,accent});shRebuildMirror();shRenderPanel()});
const css=document.createElement('style');css.textContent=`#resident-preview{position:sticky;top:0;background:radial-gradient(ellipse at 50% 35%,#394455,#141c28 75%);border:1px solid #526071;border-radius:16px;overflow:hidden}#resident-preview canvas{width:100%;height:560px;display:block;touch-action:none;cursor:grab}#resident-preview p{font:10px/1.5 sans-serif;text-align:center;color:#c3ccd7;padding:8px}#resident-portrait{display:block;margin:auto;background:#293646;color:#fff;border:1px solid #647384;border-radius:20px;padding:8px 12px}.resident-extra{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px}.resident-extra fieldset{grid-column:span 3}.resident-extra input{width:100%}#resident-view-toggle{position:fixed;right:18px;bottom:108px;z-index:35;border:1px solid #667484;border-radius:18px;background:#182332df;color:#ecedef;padding:9px 13px;font:11px sans-serif}@media(max-width:600px){#resident-preview canvas{height:270px}.resident-extra{grid-template-columns:1fr}.resident-extra fieldset{grid-column:1}}`;document.head.appendChild(css);
let preview=null,body=null,bodySignature='',lastTime=performance.now();
function clearPreview(){if(!preview)return;dispose(preview.char);preview.renderer.dispose();preview.renderer.forceContextLoss();preview=null}
function updatePreview(){
 const canvas=document.querySelector('#resident-preview canvas');
 if(!canvas){clearPreview();return}
 if(!preview||preview.canvas!==canvas){clearPreview();const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,1,.05,20);scene.add(new THREE.HemisphereLight(0xe8efff,0x49505b,1.2));
 const key=new THREE.DirectionalLight(0xffe6d0,2.1);key.position.set(-3,5,4);scene.add(key);const fill=new THREE.DirectionalLight(0xa9c9ff,1.4);fill.position.set(3,3,-2);scene.add(fill);
 preview={canvas,renderer,scene,camera,yaw:.2,portrait:false,signature:''};let drag=null;
 canvas.onpointerdown=e=>{drag=e.clientX;canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(drag!==null){preview.yaw+=(e.clientX-drag)*.015;drag=e.clientX}};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
 document.getElementById('resident-portrait').onclick=()=>preview.portrait=!preview.portrait;
 }
 const p=preview,sig=JSON.stringify(Shift.avatar);if(p.signature!==sig){if(p.char){p.scene.remove(p.char.group);dispose(p.char)}p.char=shBuildFigure({...Shift.avatar,auraChance:0},'studio');p.char.plate.visible=false;p.scene.add(p.char.group);p.signature=sig;shAnimateCharacter(p.char,0,false,0)}
 const w=canvas.clientWidth||200,h=canvas.clientHeight||390;p.renderer.setSize(w,h,false);p.camera.aspect=w/h;p.camera.updateProjectionMatrix();
 const tall=p.char.studio.height;p.camera.position.set(0,p.portrait?tall-.12:1.05,p.portrait?1.02:3.8);p.camera.lookAt(0,p.portrait?tall-.14:tall*.51,0);p.char.group.rotation.y=p.yaw;p.renderer.render(p.scene,p.camera);
}
let third=false;try{third=localStorage.getItem('fc-third-person')==='true'}catch(e){}
function setView(value){third=!!value;try{localStorage.setItem('fc-third-person',String(third))}catch(e){}if(button)button.textContent=third?'V · Third person':'V · First person'}
let button;
function cameraFrame(){
 if(!State.scene||!State.camera||!Player.position)return;
 if(button)button.hidden=!!(State.ui.inIntro||State.ui.inShiftPanel||State.ui.inDialogue||State.ui.paused);
 if(!third||Player.mode==='drive'||State.ui.inIntro||(typeof Trans!=='undefined'&&Trans.active)){if(body)body.group.visible=false;return}
 const sig=JSON.stringify(Shift.avatar);
 if(!body||bodySignature!==sig||body.group.parent!==State.scene){if(body){body.group.removeFromParent?body.group.removeFromParent():body.group.parent&&body.group.parent.remove(body.group);dispose(body)}body=shBuildFigure({...Shift.avatar,prop:'none',auraChance:0},'resident');body.plate.visible=false;bodySignature=sig;State.scene.add(body.group)}
 const now=performance.now(),dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;
 body.group.position.copy(Player.position);body.baseY=Player.position.y-Player.height;body.group.position.y=body.baseY;body.group.rotation.y=Player.yaw+Math.PI;
 if(!State.ui.paused&&!State.ui.inDialogue&&!State.ui.inShiftPanel)shAnimateCharacter(body,dt,['w','a','s','d'].some(k=>State.keys.has(k)),now/1000);
 const cam=State.camera,origin=Player.position.clone(),dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(Player.pitch,Player.yaw,0,'YXZ'));
 // Collinear camera keeps the reticle and existing eye-origin combat rays aligned.
 const desired=origin.clone().addScaledVector(dir,-3.4),delta=desired.clone().sub(origin);let fraction=1;
 for(let t=.06;t<=1;t+=.025){const p=origin.clone().addScaledVector(delta,t);let hit=false;for(const x of [-.16,.16])for(const y of [-.16,.16])for(const z of [-.16,.16])if(isSolid(getBlock(Math.floor(p.x+x),Math.floor(p.y+y),Math.floor(p.z+z))))hit=true;if(hit){fraction=Math.max(0,t-.06);break}}
 cam.position.copy(origin).addScaledVector(delta,fraction);cam.rotation.set(Player.pitch,Player.yaw,0,'YXZ');body.group.visible=fraction*3.4>.8;
}
// Hook at render time, after all first-person movement and camera effects.
function installRender(){
 const renderer=State.renderer;if(!renderer||renderer.residentCamera)return;renderer.residentCamera=true;
 const render=renderer.render.bind(renderer);
 renderer.render=function(scene,camera){if(scene!==State.scene||camera!==State.camera)return render.apply(null,arguments);
 const position=camera.position.clone(),rotation=camera.rotation.clone();cameraFrame();
 try{return render.apply(null,arguments)}finally{camera.position.copy(position);camera.rotation.copy(rotation)}
 };
}
window.FCResident={setView,get thirdPerson(){return third},get body(){return body},cameraFrame,dispose};
document.addEventListener('keydown',e=>{if(e.code!=='KeyV'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||State.ui.paused||State.ui.inDialogue||State.ui.inShiftPanel||State.ui.inIntro)return;e.preventDefault();setView(!third)},true);
document.addEventListener('DOMContentLoaded',()=>{installRender();button=document.createElement('button');button.id='resident-view-toggle';button.onpointerdown=e=>e.stopPropagation();button.onclick=e=>{e.stopPropagation();setView(!third)};document.body.appendChild(button);setView(third);function frame(){updatePreview();requestAnimationFrame(frame)}requestAnimationFrame(frame)});
})();
