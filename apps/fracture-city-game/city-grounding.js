/* A sparse street kit. Every retained prop has a support footprint and collision. */
function cityBuildStreet(chunk){
  chunk.groundedProps=[];
  const add=(root,solid,kind)=>{
    root.userData.streetProp=true;chunk.group.add(root);
    chunk.groundedProps.push({root,solid,kind,ready:false,disabled:false,velocity:0});
  };
  const half=CITY_BLOCK_SIZE/2-.7;
  for(const sign of [-1,1]){
    const g=new THREE.Group();g.position.set(chunk.worldX+sign*half,0,chunk.worldZ+sign*half);
    const pole=cityPole(.18,4.8,.18,M.metal);pole.position.y=2.4;g.add(pole);
    const arm=cityLampArm(sign,M.metal);arm.position.y=4.65;g.add(arm);
    const head=cityRoundMesh(.85,.12,.30,M.headlight);head.position.set(-sign,4.85,0);g.add(head);
    const light=new THREE.PointLight(0xffe3ad,.65,9);light.position.set(-sign,4.65,0);light.visible=false;g.add(light);
    // Slim illuminated collars and a service sleeve share the grounded lamp's lifetime.
    for(const y of [1.1,4.38]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.105,.016,5,16),M.headlight);ring.rotation.x=Math.PI/2;ring.position.y=y;g.add(ring)}
    const sleeve=cityRoundMesh(.22,.38,.22,M.darkMetal);sleeve.position.y=.6;g.add(sleeve);
    chunk.lights.push(light);add(g,pole,'lamp');
  }
  // One bench on alternate blocks, parallel to the facade; no randomly stacked junk.
  if((Math.abs(chunk.cx)+Math.abs(chunk.cz))%2===0){
    const g=new THREE.Group();g.position.set(chunk.worldX,0,chunk.worldZ-half);
    const seat=cityRoundMesh(1.8,.12,.45,M.darkMetal);seat.position.y=.48;g.add(seat);
    const back=cityRoundMesh(1.8,.48,.10,M.darkMetal);back.position.set(0,.76,-.17);g.add(back);
    for(const x of [-.68,.68]){const leg=cityPole(.09,.45,.32,M.metal);leg.position.set(x,.225,0);g.add(leg);}
    for(const z of [-.14,0,.14]){const slat=cityRoundMesh(1.72,.035,.095,M.metal);slat.position.set(0,.56,z);g.add(slat)}
    const edge=cityRoundMesh(1.6,.025,.025,M.headlight);edge.position.set(0,.89,-.11);g.add(edge);
    add(g,g,'bench');
  }
}
function cityPropBox(prop){prop.root.updateWorldMatrix(true,true);return new THREE.Box3().setFromObject(prop.solid);}
function citySupport(box){
  const heights=[];
  for(const x of [box.min.x+.015,box.max.x-.015])for(const z of [box.min.z+.015,box.max.z-.015]){
    let top=null;
    for(let y=4;y>=0;y--)if(isSolid(getBlock(Math.floor(x),y,Math.floor(z)))){top=y+1;break;}
    if(top===null || top>3)return null;heights.push(top);
  }
  return Math.max(...heights)-Math.min(...heights)>.05?null:heights[0];
}
function cityRemoveProp(chunk,p){
  p.disabled=true;p.root.visible=false;
  if(p.collider){const i=chunk.collisionAABBs.indexOf(p.collider);if(i>=0)chunk.collisionAABBs.splice(i,1);p.collider=null;}
  p.root.traverse(o=>{if(o.isLight){const i=chunk.lights.indexOf(o);if(i>=0)chunk.lights.splice(i,1);o.visible=false;}});
}
function cityGroundProps(chunk,dt=0){
  for(const p of chunk.groundedProps||[]){
    if(p.disabled)continue;
    let b=cityPropBox(p),support=citySupport(b);
    if(support===null){cityRemoveProp(chunk,p);continue;}
    if(!p.ready){
      p.root.position.y+=support-b.min.y;b=cityPropBox(p);
      // Reject overlap with a wall, doorway fixture or another solid object.
      let blocked=false;
      for(let x=Math.floor(b.min.x);x<=Math.floor(b.max.x-.001);x++)
      for(let z=Math.floor(b.min.z);z<=Math.floor(b.max.z-.001);z++)
      for(let y=Math.floor(b.min.y+.01);y<=Math.floor(b.max.y-.01);y++)
        if(isSolid(getBlock(x,y,z)))blocked=true;
      const overlaps=a=>b.max.x+.2>a.minX&&b.min.x-.2<a.maxX&&b.max.z+.2>a.minZ&&b.min.z-.2<a.maxZ&&b.min.y<a.maxY&&b.max.y>(a.minY||0);
      const nearDoor=typeof SH_HOTSPOTS!=='undefined' && SH_HOTSPOTS.some(h=>
        h.x>b.min.x-1.8&&h.x<b.max.x+1.8&&h.z>b.min.z-1.8&&h.z<b.max.z+1.8);
      if(blocked||nearDoor||chunk.collisionAABBs.some(overlaps)){cityRemoveProp(chunk,p);continue;}
      p.collider={};chunk.collisionAABBs.push(p.collider);p.ready=true;
    }else if(support<b.min.y-.005){
      p.velocity+=22*dt;
      p.root.position.y-=Math.min(b.min.y-support,p.velocity*dt);b=cityPropBox(p);
    }else if(support>b.min.y+.01){
      // A player built through this decorative fixture; their construction wins.
      cityRemoveProp(chunk,p);continue;
    }else p.velocity=0;
    Object.assign(p.collider,{minX:b.min.x,maxX:b.max.x,minY:b.min.y,maxY:b.max.y,minZ:b.min.z,maxZ:b.max.z});
  }
}
// Props have fractional heights; landing on one must use its top, not a voxel-rounded metre.
function cityLandingTop(x,z,r,from,to){
  let top=null;
  for(const key of nearbyChunkKeys(x,z)){
    const c=State.chunkMap.get(key);if(!c)continue;
    for(const a of c.collisionAABBs){
      if(x+r>a.minX&&x-r<a.maxX&&z+r>a.minZ&&z-r<a.maxZ&&from>=a.maxY-.015&&to<a.maxY)
        top=top===null?a.maxY:Math.max(top,a.maxY);
    }
  }
  return top;
}
