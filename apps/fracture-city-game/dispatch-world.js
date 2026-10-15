(function(root){
const maps=[
{id:'civic',name:'Civic Afterhours',accent:0xd69b5c,description:'A protected central plaza opens onto four contested streets.',quests:['last-tram','warm-window'],boxes:[[-32,-32,20,14,16],[32,-32,20,18,16],[-32,32,20,12,16],[32,32,20,22,16],[-10,-38,6,2,4],[12,38,6,2,4],[-42,0,6,3,12],[42,0,6,3,12]]},
{id:'signal',name:'Signal District',accent:0x9eb9cf,description:'Radio yards, narrow cover and a quiet frequency at the center.',quests:['quiet-frequency','carbon-copy'],boxes:[[-30,-28,14,18,18],[30,28,14,16,18],[-30,28,18,4,8],[30,-28,18,4,8],[-42,0,8,3,14],[42,0,8,3,14],[0,-42,14,3,8],[0,42,14,3,8]]},
{id:'nightshift',name:'The Night Shift',accent:0xc76861,description:'Warehouse lanes surround a warm, neutral gathering place.',quests:['spare-wheel','names-on-air'],boxes:[[-34,-30,22,9,14],[34,30,22,9,14],[-34,30,16,14,20],[34,-30,16,14,20],[-22,0,4,2,10],[22,0,4,2,10],[0,-25,10,2,4],[0,25,10,2,4]]}
];
maps.push({id:'city',name:'Fracture City · Makers’ Mile',city:true,seed:'fc-online-makers-v1',description:'The real city, with its studio, streets, rooftop routes and live residents. Social free roam with shared furniture, sculptures, signs and murals. Structural edits and NPCs remain local.',quests:[],boxes:[]});
const limit=56,safeRadius=14,speed=6,sprint=9,radius=.35;
function safe(p){return Math.hypot(p.x,p.z)<safeRadius}
function blocked(map,x,z){return Math.abs(x)>limit-radius||Math.abs(z)>limit-radius||map.boxes.some(b=>Math.abs(x-b[0])<b[2]/2+radius&&Math.abs(z-b[1])<b[4]/2+radius)}
function move(p,i,dt,map){let x=Number(i.x)||0,z=Number(i.z)||0,n=Math.hypot(x,z);if(n>1){x/=n;z/=n}const s=i.sprint?sprint:speed,dx=(x*Math.cos(p.yaw)+z*Math.sin(p.yaw))*s*dt,dz=(-x*Math.sin(p.yaw)+z*Math.cos(p.yaw))*s*dt;if(!blocked(map,p.x+dx,p.z))p.x+=dx;if(!blocked(map,p.x,p.z+dz))p.z+=dz;p.moving=Math.hypot(dx,dz)>.001;p.sprint=!!i.sprint}
function rayBox(o,d,min,max){let lo=0,hi=70;for(const k of ['x','y','z']){if(Math.abs(d[k])<1e-8){if(o[k]<min[k]||o[k]>max[k])return Infinity;continue}let a=(min[k]-o[k])/d[k],b=(max[k]-o[k])/d[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(hi<lo)return Infinity}return lo}
function wallDistance(map,o,d){return Math.min(70,...map.boxes.map(b=>rayBox(o,d,{x:b[0]-b[2]/2,y:0,z:b[1]-b[4]/2},{x:b[0]+b[2]/2,y:b[3],z:b[1]+b[4]/2})))}
const api={maps,limit,safeRadius,safe,blocked,move,rayBox,wallDistance};if(typeof module!=='undefined')module.exports=api;else root.FCDispatchWorld=api;
})(typeof window!=='undefined'?window:globalThis);
