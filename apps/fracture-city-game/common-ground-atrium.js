/* Common Ground: a single architectural canopy ties reading, music and making together.
   Generated with the district, before saved voxel edits are applied. No extra render loop. */
(function(){'use strict';
const generate=Chunk.prototype.generate;
Chunk.prototype.generate=function(){
 const result=generate.apply(this,arguments);
 if(this.landmark!=='makers'||!['6,1','7,1'].includes(this.key))return result;
 const root=new THREE.Group();root.name='common-ground-atrium';this.group.add(root);
 const metal=new THREE.MeshStandardMaterial({color:0x334a5d,roughness:.42,metalness:.6});
 const pale=new THREE.MeshStandardMaterial({color:0xa6bac3,roughness:.6,metalness:.2});
 const light=new THREE.MeshBasicMaterial({color:0x92e8e1});
 const box=(x,y,z,w,h,d,mat=metal)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);root.add(mesh);return mesh};
 // Four supports sit outside the central approach, with matching solid collision.
 for(const [x,z]of [[153,28],[181,28],[153,39],[181,39]]){
  if(chunkCoordOf(x)!==this.cx||chunkCoordOf(z)!==this.cz)continue;
  this.stampBox(x,1,z,x+1,10,z+1,136);
  box(x+.5,5.5,z+.5,1.04,9,1.04,metal);
  box(x+.5,5.5,z-.025,.08,8.3,.035,light);
  box(x+.5,1.15,z+.5,1.3,.3,1.3,pale);
  // Short cantilever joins each post to the overhead ellipse.
  box(x+.5,9.7,z+.5,2,.35,3,pale);
 }
 for(const x of [150,183]){if(chunkCoordOf(x)!==this.cx)continue;
  this.stampBox(x,1,35,x+2,2,36,130);
  box(x+1,2.03,35.5,2,.08,1,pale);box(x+1,2.45,35.94,2,.8,.1,metal);
 }
 if(this.key==='6,1'){
  // Open sky at the centre: broad, thin elliptical roof with illuminated inner rim.
  const canopy=new THREE.Mesh(new THREE.RingGeometry(16.8,19.2,96),pale);
  canopy.rotation.x=-Math.PI/2;canopy.scale.y=.5;canopy.position.set(167,10,34);canopy.material=pale.clone();canopy.material.side=THREE.DoubleSide;root.add(canopy);
  for(const [radius,y,mat]of [[16.8,9.93,light],[19.2,10,metal]]){
   const edge=new THREE.Mesh(new THREE.TorusGeometry(radius,.085,6,96),mat);edge.rotation.x=-Math.PI/2;edge.scale.y=.5;edge.position.set(167,y,34);root.add(edge);
  }
  // Radial metal ribs give the canopy depth without filling the view with signs.
  const ribs=new THREE.InstancedMesh(new THREE.BoxGeometry(2.4,.15,.09),metal,48),pose=new THREE.Object3D();ribs.frustumCulled=false;
  for(let i=0;i<48;i++){
   const angle=i*Math.PI/24;pose.position.set(167+Math.cos(angle)*18,10.08,34+Math.sin(angle)*9);
   pose.rotation.y=-Math.atan2(Math.sin(angle)*.5,Math.cos(angle));pose.updateMatrix();ribs.setMatrixAt(i,pose.matrix);
  }root.add(ribs);
  const sign=shSignPlane('COMMON GROUND','A PLACE TO THINK TOGETHER', '#dcf8f4','#162936',10,1.35);
  sign.position.set(167,8.75,25.1);sign.rotation.y=Math.PI;sign.name='common-ground-arrival';root.add(sign);
  for(const x of [163,171])box(x,9.55,25.2,.06,.9,.06,metal);
  // Floor inlays lead through the open centre. Water and planted beds remain exposed.
  for(const x of [165.12,168.88])box(x,1.045,31,.045,.018,10,light);
  for(const z of [26,28,30,32,34])box(167,1.04,z,.5,.015,.05,pale);

 }
 return result;
};
})();
