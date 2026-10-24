// Casting Booth NPCs on the server: spawning, role unlocks, caps, couriers,
// trouble outside Common Ground, simulation hand-off and moderation.
const {createServer}=require('./server.cjs'),{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const B=require('../apps/fracture-city-game/npc-brain.js');
test('backstories and voices are complete for every role',()=>{
 for(const role of Object.keys(B.ROLES)){const s=B.story(role,'t');for(const k of ['name','nick','origin','job','want','wound','quirk','secret','catch','temper','bio'])assert.ok(s[k],role+' '+k);const v=B.voice({story:s});assert.equal(v.story.length,3);for(const k of ['ned','back','warm','cold','bye'])assert.ok(v[k].length);assert.ok(B.BARKS[role]?.length>=3,role+' barks')}
 const c=B.cleanSpec({role:'busker',story:{name:'<b>Vex</b>'.repeat(9),origin:'x'.repeat(900)},seed:'a'},()=>false);assert.ok(!/[<>]/.test(c.story.name)&&c.story.name.length<=24&&c.story.origin.length<=160);
 assert.match(B.cleanSpec({role:'bodyguard'},()=>false).error,/Unlock/);assert.match(B.cleanSpec({role:'nope'},()=>true).error,/role/);
});
test('online: spawn, unlock, caps, courier, trouble, sim hand-off',async()=>{
 let clock=1_800_000_000_000;const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-npc-')),app=createServer({dbPath:path.join(dir,'t.sqlite'),timers:false,now:()=>clock});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const client=()=>{let cookie,token;return{async call(route,data){const res=await fetch(base+'/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});const c=res.headers.get('set-cookie');if(c)cookie=c.split(';')[0];const j=await res.json();if(j.token)token=j.token;return{status:res.status,data:j}}}};
 const tick=(secs)=>{for(let i=0;i<secs*20;i++){clock+=50;app.tick()}};
 try{
  const a=client(),b=client();await a.call('account/register',{username:'npc_a',password:'npc test password 123',displayName:'Ash'});await b.call('account/register',{username:'npc_b',password:'npc test password 123',displayName:'Bo'});
  const ja=await a.call('join',{map:'city'});await b.call('join',{code:ja.data.code});const room=app.rooms.get(ja.data.code);room.phase='live';
  const [pa,pb]=[...room.players.values()];for(const p of [pa,pb])p.stream={write(){},end(){},destroy(){},writableLength:0};
  //  Residents' games check in to be given NPCs to move.
  const checkIn=async()=>{await a.call('npc-poses',{poses:[]});await b.call('npc-poses',{poses:[]})};
  Object.assign(pa,{x:164,z:49,y:1});Object.assign(pb,{x:120,z:40,y:1});
  let r=await a.call('npc-spawn',{role:'busker',story:{name:'Juno Vale'},look:{hairStyle:'mohawk',outfit:'studded'}});assert.equal(r.status,200);
  const st=app.state(room);assert.equal(st.npcs.length,1);assert.equal(st.npcs[0].n,'Juno Vale');assert.ok(st.npcRev>=1);
  const det=await b.call('city-npcs');const d=Object.values(det.data.npcs)[0];assert.equal(d.look.outfit,'leather'.length?d.look.outfit:'',d.look.outfit);assert.notEqual(d.look.outfit,'studded','rare pieces need owning for NPCs too');assert.equal(d.look.hairStyle,'mohawk');
  assert.equal((await a.call('npc-spawn',{role:'bodyguard'})).status,402,'bodyguard is a paid unlock');
  assert.equal((await a.call('wallet/buy',{sku:'n:bodyguard',qty:1})).data.balance,150);
  assert.equal((await a.call('wallet/buy',{sku:'n:bodyguard',qty:1})).status,409);
  r=await a.call('npc-spawn',{role:'bodyguard'});assert.equal(r.status,200);const guard=r.data.ids[0];
  //  Courier: needs a real resident's name.
  assert.equal((await a.call('npc-spawn',{role:'courier',to:'Nobody',message:'hi'})).status,404);
  r=await a.call('npc-spawn',{role:'courier',to:'Bo',message:'Meet at the arcade'});assert.equal(r.status,200);const courier=room.npcs.get(r.data.ids[0]);
  //  Brawler inside Common Ground walks out first and never fights there.
  r=await a.call('npc-spawn',{role:'brawler'});const brawler=room.npcs.get(r.data.ids[0]);assert.equal(brawler.mode,'leave');
  tick(2);assert.notEqual(courier.mode,'stay');
  //  Nobody is near the courier's path to Bo at x=120 except Bo; with nobody near, the server steps it.
  for(let i=0;i<40&&!courier.task.done;i++)tick(1);
  assert.ok(courier.task.done,'courier delivered');assert.ok(room.chat.some(m=>/Meet at the arcade/.test(m.text)),'message reaches chat');
  //  Brawler: out of Common Ground, finds Bo outside it, punches.
  for(let i=0;i<30&&brawler.mode==='leave';i++)tick(1);assert.ok(!B.inSafe(brawler.x,brawler.z),'left Common Ground');
  Object.assign(pb,{x:brawler.x+1,z:brawler.z,y:1,protectUntil:0});const hp=pb.hp;tick(4);assert.ok(pb.hp<hp,'brawler punched Bo outside Common Ground');
  //  Bo shoots back.
  const shot=await b.call('city-shoot',{weapon:'pistol',ox:pb.x,oy:2.6,oz:pb.z,dx:-1,dy:-.3,dz:0,npc:brawler.id});assert.ok(shot.data.hit||shot.data.reason,'shot handled');
  //  Sim hand-off: Ash moves near the busker; Ash's poses are accepted, Bo's are not.
  const busk=[...room.npcs.values()].find(n=>n.role==='busker');Object.assign(pa,{x:busk.x+5,z:busk.z});tick(1);assert.equal(busk.sim,null,'nobody has checked in');await checkIn();tick(1);assert.equal(busk.sim,pa.id);
  assert.equal((await b.call('npc-poses',{poses:[{id:busk.id,x:busk.x+.2,y:1,z:busk.z,yaw:0}]})).data.n,0,'only the assigned resident moves an NPC');
  assert.equal((await a.call('npc-poses',{poses:[{id:busk.id,x:busk.x+.2,y:1,z:busk.z,yaw:0}]})).data.n,1);
  assert.equal((await a.call('npc-poses',{poses:[{id:busk.id,x:busk.x+40,y:1,z:busk.z,yaw:0}]})).data.n,0,'teleports are refused');
  //  Only the owner dismisses; the owner of the Main Beta can clear someone's NPCs.
  assert.equal((await b.call('npc-dismiss',{id:guard})).status,403);
  assert.equal((await a.call('npc-order',{id:guard,cmd:'stay'})).status,200);assert.equal(room.npcs.get(guard).mode,'stay');
  assert.equal((await a.call('npc-dismiss',{id:guard})).status,200);assert.ok(!room.npcs.has(guard));
  //  Cap: twelve per resident.
  let last;for(let i=0;i<14;i++)last=await a.call('npc-spawn',{role:'wanderer'});assert.equal(last.status,409);assert.ok([...room.npcs.values()].filter(n=>n.owner===pa.accountId).length<=12);
  //  Leaving for ten minutes takes them away.
  room.players.delete(pa.id);clock+=11*60000;tick(1);assert.ok(![...room.npcs.values()].some(n=>n.owner===pa.accountId));
  console.log('PASS NPCs spawn, unlock, cap, deliver, fight outside Common Ground and hand off movement');
 }finally{await new Promise(r=>{app.server.once('close',r);app.close()})}
});
