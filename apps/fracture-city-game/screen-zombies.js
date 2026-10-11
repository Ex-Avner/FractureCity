/* Phone fixation is a visual layer; pursuit, damage and right-hand attacks remain AI driven. */
(function(){
'use strict';
const infected=new Set(['zombie','stalker','spitter','howler','husk']);
const shell=new THREE.MeshStandardMaterial({color:0x292431,roughness:.55});
const glass=new THREE.MeshBasicMaterial({color:0x81cdc0});
const ink=new THREE.MeshBasicMaterial({color:0x244453});
function part(g,w,h,d,x,y,z,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);g.add(m);return m}
const make=Enemy.prototype.makeMesh;
Enemy.prototype.makeMesh=function(){const result=make.apply(this,arguments),c=this.visualChar;if(!c?.studio||!infected.has(this.type))return result;
 const phone=new THREE.Group();phone.name='doomscroll-phone';
 part(phone,.075,.145,.015,0,.034,.018,shell);part(phone,.064,.119,.002,0,.035,.027,glass);
 for(let i=0;i<4;i++)part(phone,.048-i%2*.016,.008,.003,-i%2*.006,.072-i*.027,.029,ink);
 // Glass faces up toward the bent head; the case sits inside the fingers.
 phone.rotation.x=.35;FCEquipment.handSocket(c,0).add(phone);c.studio.phone=phone;return result;
};
function pose(c,state){
 const t=performance.now()*.001;c.studio.torso.rotation.x=.12;c.head.rotation.x=.36;c.head.rotation.y=.08;c.head.rotation.z=Math.sin(t*.7)*.025;
 c.leftArm.rotation.set(-.72,0,.09);c.studio.elbows[0].rotation.x=-1.2;
 if(state!=='attack'){c.rightArm.rotation.set(-.83,0,-.2);c.studio.elbows[1].rotation.x=-1.05+Math.sin(t*3)*.045}
}
const siegeAnimate=shAnimateZombies;window.shAnimateZombies=function(dt){siegeAnimate(dt);for(const e of Siege.ours)if(e.hp>0&&e.visualChar?.studio?.phone)pose(e.visualChar,e.state)};
const update=Enemy.prototype.update;
Enemy.prototype.update=function(dt){const result=update.apply(this,arguments),c=this.visualChar;if(!c?.studio?.phone||this.state==='dead')return result;
 pose(c,this.state);
 return result;
};
})();
