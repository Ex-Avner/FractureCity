'use strict';
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
const materials=new Set([0,1,2,3,4,5,6,7,8,9,10,11,12,...Array.from({length:22},(_,i)=>120+i)]);
const key=c=>`${c.x},${c.y},${c.z}`;
function createWorldEdits(db){
 db.exec(`CREATE TABLE IF NOT EXISTS city_world_edits(room TEXT PRIMARY KEY REFERENCES districts(code),revision INTEGER NOT NULL,cells TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS city_owner_actions(id INTEGER PRIMARY KEY,room TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,at INTEGER NOT NULL);`);
 const cached=new Map();
 function snapshot(room){if(!cached.has(room)){const row=db.prepare('SELECT * FROM city_world_edits WHERE room=?').get(room);cached.set(room,{revision:row?.revision||0,cells:row?JSON.parse(row.cells):[],doors:[]});}if(cached.size>32)cached.delete(cached.keys().next().value);return cached.get(room)}
 function audit(room,actor,action,detail){db.prepare('INSERT INTO city_owner_actions(room,actor,action,detail,at) VALUES(?,?,?,?,?)').run(room,actor,action,detail,Date.now())}
 function save(room,actor,b,players){
  const before=snapshot(room);if(!Number.isSafeInteger(b.revision)||b.revision!==before.revision)fail(409,'World changed in another session. Refresh before saving.');
  if(!Array.isArray(b.cells)||b.cells.length>20000||!Array.isArray(b.doors)||b.doors.length)fail(400,'World editing supports 20,000 terrain overrides.');
  const seen=new Set(),old=new Map(before.cells.map(c=>[key(c),c.id]));
  const cells=b.cells.map(c=>{
   if(!c||![c.x,c.y,c.z,c.id].every(Number.isInteger)||Math.abs(c.x)>2048||Math.abs(c.z)>2048||c.y<0||c.y>=64||!materials.has(c.id)||seen.has(key(c)))fail(400,'Invalid world cell.');
   // Plots have their own revision, ownership and door state. Never put a
   // second terrain authority over them; their existing editor remains available.
   if(c.x>=192&&c.x<288&&c.z>=48&&c.z<120)fail(400,'Use plot building tools inside the building yard.');
   seen.add(key(c));if(c.id&&old.get(key(c))!==c.id&&players.some(p=>p.hp>0&&p.x+.38>c.x&&p.x-.38<c.x+1&&p.z+.38>c.z&&p.z-.38<c.z+1&&(p.y??1)<c.y+1&&(p.y??1)+1.8>c.y))fail(409,'A resident is standing in that space.');
   return{x:c.x,y:c.y,z:c.z,id:c.id};
  });
  const next={revision:before.revision+1,cells,doors:[]};db.exec('BEGIN IMMEDIATE');try{
   db.prepare('INSERT INTO city_world_edits VALUES(?,?,?) ON CONFLICT(room) DO UPDATE SET revision=excluded.revision,cells=excluded.cells').run(room,next.revision,JSON.stringify(cells));audit(room,actor,'world-edit',`${cells.length} cells; revision ${next.revision}`);db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e}cached.set(room,next);return next;
 }
 return{snapshot,save,audit};
}
module.exports={createWorldEdits};
