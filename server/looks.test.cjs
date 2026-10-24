// Residents' looks online: validation, rare pieces need owning, and the
// room shares looks through a revision counter.
const {createServer}=require('./server.cjs'),looks=require('./looks.cjs'),{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
test('looks are cleaned against wardrobe.json',()=>{
 const none=()=>false,all=()=>true;
 const l=looks.clean({hairStyle:'mohawk',outfit:'studded',hair:'#00e5ff',lips:'none',coat:'red',jaw:9,extras:['chain','neon','bogus'],boots:'rocket'},none);
 assert.equal(l.hairStyle,'mohawk');assert.equal(l.outfit,looks.WARDROBE.defaults.outfit,'rare jacket not owned falls back');
 assert.equal(l.hair,'#00e5ff');assert.equal(l.lips,'none');assert.equal(l.coat,looks.WARDROBE.defaults.coat,'colours must be #rrggbb');
 assert.equal(l.jaw,1.2,'ranges clamp');assert.deepEqual(l.extras,['chain'],'unknown and unowned extras dropped');assert.equal(l.boots,looks.WARDROBE.defaults.boots);
 assert.equal(looks.clean({outfit:'studded',extras:['neon']},all).outfit,'studded');assert.deepEqual(looks.clean({extras:['neon']},all).extras,['neon']);
 assert.deepEqual(looks.clean(null,all),looks.WARDROBE.defaults);
 assert.ok(looks.PREMIUM.length>=10&&looks.PREMIUM.every(p=>/^w:[a-zA-Z]+:[a-z-]+$/.test(p.sku)&&p.price>0));
});
test('online: buy a rare piece once, publish a look, others fetch it',async()=>{
 const clock={t:1_800_000_000_000},dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-looks-')),app=createServer({dbPath:path.join(dir,'t.sqlite'),timers:false,now:()=>clock.t});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const client=()=>{let cookie,token;return{async call(route,data){const res=await fetch(base+'/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});const c=res.headers.get('set-cookie');if(c)cookie=c.split(';')[0];const j=await res.json();if(j.token)token=j.token;return{status:res.status,data:j}}}};
 try{
  const a=client(),b=client();await a.call('account/register',{username:'look_a',password:'looks test password 123'});await b.call('account/register',{username:'look_b',password:'looks test password 123'});
  const ja=await a.call('join',{map:'city'});await b.call('join',{code:ja.data.code});app.rooms.get(ja.data.code).phase='live';
  let r=await a.call('city-look',{look:{hairStyle:'liberty',outfit:'studded',hair:'#ff2e88'}});assert.equal(r.data.look.outfit,looks.WARDROBE.defaults.outfit);assert.equal(r.data.look.hairStyle,looks.WARDROBE.defaults.hairStyle,'liberty spikes are rare');
  assert.equal((await a.call('wallet/buy',{sku:'w:outfit:studded',qty:1})).data.balance,120);
  assert.equal((await a.call('wallet/buy',{sku:'w:outfit:studded',qty:1})).status,409,'bought once');
  assert.equal((await a.call('wallet/buy',{sku:'w:outfit:studded',qty:2})).status,400);
  r=await a.call('city-look',{look:{hairStyle:'mohawk',outfit:'studded',hair:'#ff2e88'}});assert.equal(r.data.look.outfit,'studded');
  const room=app.rooms.get(ja.data.code);assert.ok(app.state(room).lookRev>=2,'the room counts look changes');
  const seen=await b.call('city-looks');const mine=Object.values(seen.data.looks).find(l=>l.hair==='#ff2e88');assert.ok(mine,'the other resident fetches the look');assert.equal(mine.outfit,'studded');assert.equal(mine.hairStyle,'mohawk');
  console.log('PASS rare pieces are bought once and only owned ones show online; looks are shared');
 }finally{await new Promise(r=>{app.server.once('close',r);app.close()})}
});
