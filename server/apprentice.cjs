'use strict';
const M=require('../apps/fracture-city-game/apprentice-model.js');
function createApprentice(db,now=Date.now){
 db.exec('CREATE TABLE IF NOT EXISTS city_apprentice (room TEXT PRIMARY KEY,payload TEXT NOT NULL)');
 const states=new Map();
 function get(room){if(!states.has(room)){let raw;try{raw=JSON.parse(db.prepare('SELECT payload FROM city_apprentice WHERE room=?').get(room)?.payload||'null')}catch{}states.set(room,M.restore(raw))}return states.get(room)}
 function save(room,s){db.prepare('INSERT INTO city_apprentice VALUES(?,?) ON CONFLICT(room) DO UPDATE SET payload=excluded.payload').run(room,JSON.stringify(M.durable(s)))}
 function act(room,p,b){const s=get(room),stamp=s.stamp;M.action(s,p,b,now());if(stamp!==s.stamp)save(room,s);return s}
 function tick(room,dt,players){const s=get(room),stamp=s.stamp;M.step(s,dt,now(),id=>[...players.values()].some(p=>p.accountId===id&&p.hp>0&&now()-p.seen<45000));if(s.stamp!==stamp)save(room,s)}
 return{get,act,tick,release:room=>states.delete(room)};
}
module.exports={createApprentice};
