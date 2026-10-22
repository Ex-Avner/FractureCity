/* A readable route and visible, saved consequences of the resident's broadcast choice. */
(function(){'use strict';
let root,scene,signature='',last=0;
function clear(){if(!root)return;root.removeFromParent();root.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose()}});root=null}
function sign(x,y,z,title,sub,w,h,rotation=0){const m=shSignPlane(title,sub,'#76f5df','#101922',w,h);m.geometry=m.geometry.clone();m.position.set(x,y,z);m.rotation.y=rotation;if(x===162)m.userData.fcSupport={points:[[162,6,19]]};if(x===181)m.userData.fcSupport={points:[[181,5,-19]]};if(x===169)m.userData.fcSupport={points:[[169,0,23]]};root.add(m);return m}
function rebuild(){clear();root=new THREE.Group();root.name='neighborhood-signal';State.scene.add(root);const s=OwnBlock.state;
 sign(162,6.5,20.17,s.signalChoice==='music'?'LISTENING ROOM / ON AIR':s.signalChoice==='art'?'OPEN GALLERY / ON AIR':'STUDIO 01 / OPEN',s.signalChoice?'WEST / FCN NEWS   EAST / COMMON GROUND':'CLAIM YOUR ROOM / CHOOSE YOUR SIGNAL',1.6,.65);

 sign(181,5.9,-17.88,'CITY SIGNAL',s.signalChoice==='music'?'RESIDENT RADIO / YOUR SOUNDTRACK':'NEWS HAS A DESK. SO DO YOU.',4,.5);
 const core=[...State.chunkMap.values()].find(c=>c.landmark==='fcn');if(core){const x=core.worldX+7.18,z=core.worldZ;sign(x,4,z,'RESIDENT SIGNAL',s.signalChoice==='music'?'MAKERS’ MILE / LISTENING ROOM':s.signalChoice==='art'?'MAKERS’ MILE / OPEN GALLERY':'MAKERS’ MILE / STUDIO 01',3,.8,Math.PI/2)}
 scene=State.scene;
}
function tick(now){requestAnimationFrame(tick);if(now-last<500)return;last=now;if(!State.scene||!OwnBlock.ready||!OwnBlock.state.enabled){if(root)root.visible=false;return}const s=OwnBlock.state,key=State.citySeed+'|'+s.signalChoice+'|'+s.owned+'|'+[...State.chunkMap.values()].some(c=>c.landmark==='fcn');if(scene!==State.scene||signature!==key||!root){signature=key;rebuild()}root.visible=true;FCPhysicalSupport.validate({group:root,lights:[]})}
requestAnimationFrame(tick);window.FCNeighborhoodSignal={rebuild,get root(){return root}};
})();
/* The opening's saved decision leaves a legible notice at the news hub. */
(function(){'use strict';let marker,scene,last='',lastAt=0;
const notices={hold:['SAFE WAITING POINT','RESIDENTS HELPED EACH OTHER OFF THE ROAD'],write:['17:58 / ORIGINAL RECORD','THE UNEDITED BULLETIN HAS A WITNESS'],wall:['SHELTER IDENTIFIED','KEEP THE ENTRANCE CLEAR FOR YOUR NEIGHBORS'],run:['COMMUNITY PICKUP POINT','PEOPLE FIRST / PARKING FINES LATER']};
function tick(now){requestAnimationFrame(tick);if(now-lastAt<500)return;lastAt=now;const choice=FN.state.choices?.first,c=[...State.chunkMap.values()].find(c=>c.landmark==='fcn'),text=notices[choice],key=State.citySeed+'|'+choice+'|'+c?.key;if(scene===State.scene&&last===key&&(!marker||marker.parent))return;last=key;scene=State.scene;if(marker){marker.removeFromParent();marker.geometry.dispose();marker.material.map?.dispose();marker.material.dispose();marker=null}if(!c||!text)return;marker=shSignPlane(text[0],text[1],'#76f5df','#101922',3,.7);marker.geometry=marker.geometry.clone();marker.name='opening-choice-notice';marker.position.set(c.worldX+7.19,3.15,c.worldZ+4.9);marker.rotation.y=Math.PI/2;c.group.add(marker)}requestAnimationFrame(tick);
})();
