/* Hand-sized phones and individual, articulated infected silhouettes. */
(function(){'use strict';
const infected=new Set(['zombie','stalker','spitter','howler','husk']);
const shell=new THREE.MeshStandardMaterial({color:0x302638,roughness:.6,metalness:.3});
const glass=new THREE.MeshBasicMaterial({color:0x8cddc7});
const ink=new THREE.MeshBasicMaterial({color:0x293846});
const display=document.createElement('canvas');display.width=256;display.height=512;const dc=display.getContext('2d');dc.fillStyle='#132d35';dc.fillRect(0,0,256,512);dc.fillStyle='#a6e7d4';dc.font='bold 26px monospace';dc.fillText('FOR YOU',22,46);dc.font='17px monospace';dc.fillText('17:58   NO SIGNAL',20,78);for(let i=0;i<3;i++){dc.fillStyle=['#a87781','#679e98','#aa9b6b'][i];dc.fillRect(20,102+i*115,62,67);dc.fillStyle='#c3d6ce';dc.fillRect(96,111+i*115,134,9);dc.fillRect(96,133+i*115,107,7);dc.fillStyle='#587b80';dc.fillRect(96,154+i*115,80,7)}dc.strokeStyle='#e1f7eb';dc.lineWidth=2;dc.beginPath();dc.moveTo(205,5);dc.lineTo(121,168);dc.lineTo(178,220);dc.lineTo(83,344);dc.moveTo(121,168);dc.lineTo(24,200);dc.stroke();dc.fillStyle='#94c7b9';dc.fillRect(88,485,80,5);const screenMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(display)});
const badge=document.createElement('canvas');badge.width=256;badge.height=128;const bc=badge.getContext('2d');bc.fillStyle='#262a2e';bc.fillRect(0,0,256,128);bc.strokeStyle='#d4c6a7';bc.setLineDash([5,5]);bc.strokeRect(6,6,244,116);bc.fillStyle='#d9c6a7';bc.textAlign='center';bc.font='bold 34px monospace';bc.fillText('NO SIGNAL',128,58);bc.font='20px monospace';bc.fillText('STILL SCROLLING',128,91);const badgeMat=new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(badge),roughness:.93});
function part(g,w,h,d,x,y,z,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);g.add(m);return m}
const make=Enemy.prototype.makeMesh;
Enemy.prototype.makeMesh=function(rng){const result=make.apply(this,arguments),c=this.visualChar;if(!c?.studio||!infected.has(this.type))return result;
 const phone=new THREE.Group();phone.name='doomscroll-phone';
 // The screen faces the palm's owner, not away from their face.
 const body=new THREE.Mesh(cityRoundGeometry(.071,.139,.014,.006),shell.clone());body.position.set(0,-.008,.025);phone.add(body);
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(.060,.117),screenMat);screen.position.set(0,-.007,.033);phone.add(screen);
 phone.rotation.set(-.25,Math.PI,0);FCEquipment.handSocket(c,0).add(phone);c.studio.phone=phone;
 c.studio.infectedPhase=rng.range(0,TAU);c.studio.infectedLean=rng.range(.07,.17);
 c.studio.infectedStride=rng.range(.85,1.16);
 const cloth=new THREE.MeshStandardMaterial({color:rng.pick([0x7b405e,0x466c66,0xa18858]),roughness:.94});
 // Torn hems hang from the torso so they follow breathing and attack motion.
 for(let i=0;i<5;i++){const patch=part(c.studio.torso,.047,.10+rng.range(0,.08),.019,-.12+i*.06,-.48,.126,cloth);patch.rotation.z=rng.range(-.22,.22)}
 const label=new THREE.Mesh(new THREE.PlaneGeometry(.17,.085),badgeMat);label.position.set(.085,-.18,.164);label.rotation.z=-.09;c.studio.torso.add(label);
 const metal=new THREE.MeshStandardMaterial({color:0xa7aba6,metalness:.8,roughness:.35});
 for(let i=0;i<3;i++)part(c.studio.torso,.018,.019,.023,-.12+i*.06,-.13,.16,metal);
 return result;
};
function pose(e,dt){const c=e.visualChar;if(!c?.studio?.phone)return;const s=c.studio,v=s.motionSpeed||0,blend=Math.min(1,v/2.7),t=s.infectedPhase=(s.infectedPhase||0)+dt*(2+v*1.8)*s.infectedStride;
 for(const [i,leg]of[c.leftLeg,c.rightLeg].entries()){const p=t+i*Math.PI;leg.rotation.x=Math.sin(p)*.66*blend;s.knees[i].rotation.x=.10+Math.max(0,-Math.sin(p))*.95*blend;leg.rotation.z=(i?1:-1)*.025;}
 s.torso.rotation.set(s.infectedLean+blend*.04,Math.sin(t)*.045*blend,Math.sin(t*.5)*.027);
 // Head stays attached; small glances alternate with looking down at the feed.
 c.head.rotation.set(.23+Math.sin(t*.33)*.08,Math.sin(t*.23)*.12,Math.sin(t*.5)*.025);
 c.leftArm.rotation.set(-.42-Math.sin(t)*.06*blend,0,.08);s.elbows[0].rotation.x=-1.55+Math.sin(t*.5)*.04;
 s.fingers[0].rotation.x=1.05;
 c.rightArm.rotation.set(-.30+Math.sin(t)*.44*blend,0,-.10);s.elbows[1].rotation.x=-.25-Math.max(0,Math.sin(t))*.25*blend;
 s.fingers[1].rotation.x=.3;
 if(e._fcWind){const k=1-e._fcWind.left/e._fcWind.total;c.rightArm.rotation.x=-1.9+k*.65;s.elbows[1].rotation.x=-.7+k*.45;c.head.rotation.x=.02;s.torso.rotation.y=-.20+k*.32;}
 if(e._zcRecovery>0){c.rightArm.rotation.x=-.95;s.torso.rotation.x+=.09;}
 if(e._fcStun>0){s.torso.rotation.z=.12*Math.sin(t*4);c.head.rotation.x=-.12;}
 c.group.rotation.z=0;c.group.updateMatrixWorld(true);s.phone.lookAt(c.head.getWorldPosition(new THREE.Vector3()));
}
// Siege used to run a second incompatible pose and ground snap after Enemy.update.
window.shAnimateZombies=function(){};
window.FCInfectedArt={infected,pose};
})();
