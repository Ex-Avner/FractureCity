/* Inspection switches: false hides only the named category, true restores it. */
(function(){
  const categories={rails:true,cables:true,awnings:true,fireEscapes:true,neon:true,shadows:true,bloom:true};
  const debug=window.FCDEBUG={categories,
    set(name,visible){
      if(!(name in categories)) throw new Error('Unknown dressing category: '+name);
      categories[name]=!!visible;
      if(name==='shadows'||name==='bloom'){HD.want[name]=!!visible;HD.apply(true);}
      if(State.scene)State.scene.traverse(o=>{if(o.userData.fcCategory===name){
        if(!visible && o.userData.fcWasVisible===undefined)o.userData.fcWasVisible=o.visible;
        o.visible=visible ? o.userData.fcWasVisible!==false : false;
        if(visible)delete o.userData.fcWasVisible;
      }});
      return this.counts();
    },
    counts(){const c={};for(const k in categories)c[k]=0;if(State.scene)State.scene.traverse(o=>{const k=o.userData.fcCategory;if(k)c[k]++});return c;},
  };
  function tagged(name,category){const orig=window[name];if(!orig)return;window[name]=function(chunk){
    const before=new Set(chunk.group.children);const result=orig.apply(this,arguments);
    for(const child of chunk.group.children)if(!before.has(child)){child.userData.fcCategory=category;if(!categories[category]){child.userData.fcWasVisible=child.visible;child.visible=false;}}
    return result;
  };}
  const lay=FCRails.lay;
  FCRails.lay=function(chunk){const before=new Set(chunk.group.children);const result=lay.apply(this,arguments);
    for(const child of chunk.group.children)if(!before.has(child)){child.userData.fcCategory='rails';child._noMerge=true;child.visible=categories.rails;}
    return result;
  };
  // These legacy passes currently emit no geometry. Counts make that visible.
  tagged('shStreetDetail','cables');
  tagged('shDistMarket','awnings');
  tagged('shDistResidential','fireEscapes');
  const neon=makeNeonMat;
  window.makeNeonMat=function(){const mat=neon.apply(this,arguments);mat.userData.fcNeon=true;return mat;};
  const chunks=shAfterChunks;
  window.shAfterChunks=function(){const r=chunks.apply(this,arguments);for(const c of State.chunkMap.values())if(!c._fcDebugTagged){c._fcDebugTagged=true;c.group.traverse(o=>{if(o.material&&o.material.userData.fcNeon&&!o.userData.fcCategory){o.userData.fcCategory='neon';o.visible=categories.neon;}});}return r;};
})();

// A height sample in a solid wall is not a stair landing. Validate the whole
// street rail at its actual lateral offset, not just the doorway centreline.
(function(){
  let streetPass=0;
  const supported=rail=>{
    const horizontal=Math.hypot(rail.x1-rail.x0,rail.z1-rail.z0);
    if(!horizontal || Math.abs(rail.y1-rail.y0)/horizontal>0.6)return false;
    let previous=null;
    const samples=Math.ceil(horizontal/.35);
    for(let i=0;i<=samples;i++){
      const t=i/samples,x=rail.x0+(rail.x1-rail.x0)*t,z=rail.z0+(rail.z1-rail.z0)*t;
      const foot=rail.y0+(rail.y1-rail.y0)*t-.62;
      const ground=shSurfaceY(x,z,Math.ceil(foot)+1);
      if(ground<1 || Math.abs(ground-foot)>1.05 ||
         shBodyBlocked(x,ground,z,.12,1.85) ||
         (previous!==null && Math.abs(ground-previous)>1.05))return false;
      previous=ground;
    }
    return true;
  };
  FCDEBUG.railSupported=supported;
  const make=FCRails.make;
  FCRails.make=function(){const rail=make.apply(this,arguments);return rail && (!streetPass || supported(rail)) ? rail : null;};
  const lay=FCRails.lay;
  FCRails.lay=function(){streetPass++;try{return lay.apply(this,arguments);}finally{streetPass--;}};
})();

/* All authored colour decisions for the city live here. */
(function(){
  const P=window.FC_PALETTE=Object.freeze({
    ink:0x141e29, shadow:0x263545, concrete:0x687078, metal:0x858d98,
    sodium:0xd4aa78, paper:0xe2ddd1, fcn:0xff5268, bureau:0x9aa2bb, player:0xf4bb3d,
    dusk:[0x89949d,0x596d82,0x344c65,0x21374f],
    night:[0x354553,0x263847,0x192b3d,0x132233],
    day:[0xaabec9,0x87a6ba,0x628ba9,0x456d91],
    districts:{
      DOWNTOWN:{sign:0x91acbd,window:0xb8c6cc,wall:0x656e79,hue:.57},
      RESIDENTIAL:{sign:0xc6a67c,window:0xd5ba92,wall:0x716d67,hue:.105},
      FORGE:{sign:0xca9678,window:0xd5a883,wall:0x72685f,hue:.06},
      FLOOD:{sign:0x85aaa7,window:0xa6c0b7,wall:0x606f73,hue:.48},
      CHINATOWN:{sign:0xc18d7f,window:0xc9ad87,wall:0x756663,hue:.025},
    },
    neonSaturation:.51, // previous holo saturation .85, reduced by forty percent
    neonHueRange:.012,
  });
  const hex=c=>'#'+c.toString(16).padStart(6,'0');
  const districtStyle=d=>P.districts[Object.keys(DISTRICTS).find(k=>DISTRICTS[k]===d)]||P.districts.DOWNTOWN;
  const at=(x,z)=>districtStyle(districtForChunk(Math.floor(x/VOX_W),Math.floor(z/VOX_W)));
  for(const [k,s] of Object.entries(P.districts)){
    const d=DISTRICTS[k];Object.assign(d,{bgColor:s.wall,accentColor:s.sign,windowColors:[s.window,P.paper,P.sodium],neonProb:d.neonProb*.3,graffitiProb:d.graffitiProb*.2});
  }
  NEON_COLORS.splice(0,NEON_COLORS.length,P.sodium,P.districts.DOWNTOWN.sign,P.districts.FLOOD.sign);
  for(const [id,c] of [[B_ASPHALT,P.ink],[B_SIDEWALK,0x525e65],[B_CONCRETE,P.concrete],[B_WIN_LIT,P.sodium],[B_WIN_DARK,P.shadow],[B_ROOF,0x343f4a],[B_METAL,P.metal],[B_NEON,P.bureau],[B_GLASS,0x8198a6],[B_PAINT,0xb5aa8e],[B_BRICK,0x80665e],[B_RUST,0x916b51]])BLOCKS[id].color=c;
  // Preserve block IDs and save compatibility; tint the existing voxel buckets
  // in their chunk context instead of inventing new material IDs.
  const geometry=quadsToGeometry;
  window.quadsToGeometry=function(q,x,y,z,emit){
    const ids=[B_NEON,B_WIN_LIT,B_CONCRETE],old=ids.map(id=>BLOCKS[id].color);
    const style=at(x,z),cx=Math.floor(x/VOX_W),cz=Math.floor(z/VOX_W);
    BLOCKS[B_NEON].color=cx===-1&&cz===-1 ? P.fcn : cx===0&&cz===-1 ? P.bureau : style.sign;
    BLOCKS[B_WIN_LIT].color=style.window;BLOCKS[B_CONCRETE].color=style.wall;
    try{return geometry.apply(this,arguments);}finally{ids.forEach((id,i)=>BLOCKS[id].color=old[i]);}
  };
  const building=Chunk.prototype.makeBuilding;
  Chunk.prototype.makeBuilding=function(b,d){
    const old=NEON_COLORS.slice(),style=districtStyle(d);NEON_COLORS.splice(0,NEON_COLORS.length,style.sign);
    try{return building.apply(this,arguments);}finally{NEON_COLORS.splice(0,NEON_COLORS.length,...old);}
  };
  // The old baked trim and clothing palettes still bypass district materials.
  // Tone their emissive parts before baking, once, not on every rendered frame.
  const bake=shBakeParts;
  window.shBakeParts=function(parts,emit){
    if(emit)parts=parts.map(p=>p.emit?{...p,color:at(p.x,p.z).sign}:p);
    return bake.call(this,parts,emit);
  };
  for(const a of CHAR_ARCHETYPES){
    a.jacket=a.jacket.map(c=>new THREE.Color(c).lerp(new THREE.Color(P.concrete),.48).getHex());
    a.trim=[P.sodium,P.bureau];a.aura=Math.min(a.aura,.03);
  }
  const neon=makeNeonMat;
  window.makeNeonMat=function(color){
    // First-night pickups use separate materials; city decoration has no gold.
    if(color===P.player)color=P.sodium;
    else if(color!==P.fcn && color!==P.bureau){const c=new THREE.Color(color),h={};c.getHSL(h);if(h.s>.65)color=c.setHSL(h.h,h.s*.6,h.l).getHex();}
    return neon.call(this,color);
  };
  window.updateHoloAds=function(dt){
    const t=performance.now()*.001;
    for(const ad of State.holoAds){
      const s=at(ad.mesh.position.x,ad.mesh.position.z);
      const c=new THREE.Color().setHSL(s.hue+Math.sin(t*.22+ad.phase)*P.neonHueRange,P.neonSaturation,.56);
      ad.mesh.material.color.copy(c);if(ad.light)ad.light.color.copy(c);
    }
  };
  // A cool sky with a restrained warm horizon, including matching fog.
  window.shSkyBand=function(hour){
    const day=Math.min(shRamp(hour,5,8),1-shRamp(hour,16,19));
    const dusk=Math.min(shRamp(hour,16,18),1-shRamp(hour,18,21));
    return P.night.map((c,i)=>new THREE.Color(c).lerp(new THREE.Color(P.day[i]),day).lerp(new THREE.Color(P.dusk[i]),dusk));
  };
  // Paint the authored bands directly: the old painter added a magenta city
  // glow and a sunset bloom even while the sun was below the horizon.
  const paint=shSkyPaint;
  window.shSkyPaint=function(sky){
    if(!sky||!sky.geometry)return paint.apply(this,arguments);
    const pos=sky.geometry.attributes.position,col=sky.geometry.attributes.color;
    if(!col)return;
    const hour=(State.dayTime/60)%24,band=shSkyBand(hour),sun=shSkySunDir(hour);
    const c=new THREE.Color(),warm=new THREE.Color(P.sodium);
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),length=Math.hypot(x,y,z)||1;
      const dy=y/length,seg=Math.max(0,Math.min(1,(dy+.25)/1.25))*3,k=Math.min(2,Math.floor(seg));
      c.copy(band[k]).lerp(band[k+1],seg-k);
      if(sun.y>-.05){const facing=Math.max(0,(x*sun.x+y*sun.y+z*sun.z)/length);c.lerp(warm,Math.pow(facing,18)*.2);}
      col.setXYZ(i,c.r,c.g,c.b);
    }
    col.needsUpdate=true;SKY.horizon=band[0].clone();
  };
  const light=shApplyLighting;
  window.shApplyLighting=function(hour){
    const r=light.apply(this,arguments);if(!State.hemi)return r;
    const day=Math.min(shRamp(hour,5,8),1-shRamp(hour,17.5,20));
    State.hemi.color.setHex(0xa0b3c5);State.hemi.groundColor.setHex(P.shadow);
    State.ambient.color.setHex(P.bureau);State.ambient.intensity=(.42+day*.3)*LOOK.exposure;
    State.neonFillA.color.setHex(P.sodium);State.neonFillA.intensity=(1-day)*.22;
    State.neonFillB.color.setHex(P.districts.FLOOD.sign);State.neonFillB.intensity=(1-day)*.12;
    if(State.rimLight)State.rimLight.color.setHex(P.bureau);
    return r;
  };
  const skyFrame=shSkyFrame;
  window.shSkyFrame=function(dt){
    const r=skyFrame.apply(this,arguments),h=(State.dayTime/60)%24;
    for(const cloud of SKY.clouds)cloud.mesh.material.color.setHex(h>=20||h<6 ? P.shadow : P.sodium);
    if(State.renderer){State.renderer.toneMapping=THREE.ACESFilmicToneMapping;State.renderer.toneMappingExposure=1.22*LOOK.exposure;}
    return r;
  };
  const sign=shSignTexture;
  window.shSignTexture=function(title,sub,fg,bg){if(/^FCN/.test(title))fg=hex(P.fcn);return sign.call(this,title,sub,fg,bg);};
  const css=document.createElement('style');css.textContent=`
    :root{--fc-ink:${hex(P.ink)};--fc-paper:${hex(P.paper)};--fc-player:${hex(P.player)};--fc-bureau:${hex(P.bureau)};--fc-signal:${hex(P.fcn)};--sh-amber:${hex(P.player)};--sh-teal:${hex(P.bureau)}}
    #hud-time,#hud-credits,#hud-district,#hud-mode,#hud-controls,#hud-weapons .weapon-slot{color:var(--fc-paper);text-shadow:none;background:rgba(20,30,41,.84);border-color:#647586}
    #hud .label,#hud .value,#hud-time,#hud-district,#hud-controls,#hud-weapons{color:var(--fc-paper);text-shadow:none}
    #hud .hud-panel,#hud-time,#hud-district,#hud-controls{background:rgba(20,30,41,.88);border-color:#647586;box-shadow:none}
    #hud-weapons .active{color:var(--fc-player)!important;border-color:var(--fc-player)!important;background:rgba(20,30,41,.94)!important;box-shadow:none!important}
    #fn-obj,.campaign-objective{border-color:var(--fc-player);color:var(--fc-paper)}
    #hud-weapons .ws-name,#hud-weapons .ws-key,#hud-weapons .ws-ammo{color:var(--fc-paper);text-shadow:none}
    #hud-weapons .weapon-slot.active .ws-name,#hud-weapons .weapon-slot.active .ws-key{color:var(--fc-player);text-shadow:none}
    #hud-weapons .weapon-slot::before{background:#647586}#hud-weapons .weapon-slot.active::before{background:var(--fc-player)}
    #fn-heat{color:var(--fc-bureau)}
    #narr{background:rgba(20,30,41,.96)}#narr-text{color:var(--fc-paper)}
    #fn-card{background:rgba(20,30,41,.98)}#fn-card .fn-opt{border-color:#647586;color:var(--fc-paper)}
    #fn-card .fn-opt:hover,#fn-card .fn-opt:focus-visible{border-color:var(--fc-player)}
  `;document.head.appendChild(css);
})();
