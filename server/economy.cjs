'use strict';
// Online economy: one wallet and one inventory per account, held by the
// server. Spending is authoritative: purchases are checked here, and building
// in the shared city is charged or refunded from the difference between a
// resident's old and new builds (furniture groups in city art, workshop
// blocks in their plot). Earning from city jobs and zombies is simulated on
// the client, so claims are accepted only within per-claim, rate and daily
// caps; PvP kills are paid by the server directly.
const fs=require('node:fs'),path=require('node:path');
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
const CATALOG=JSON.parse(fs.readFileSync(path.join(__dirname,'..','apps','fracture-city-game','shop-catalog.json'),'utf8'));
//  Rare wardrobe pieces (wardrobe.json) are sold once each.
CATALOG.wardrobe=require('./looks.cjs').PREMIUM;
const SKUS=new Map([...CATALOG.blocks,...CATALOG.furniture,...CATALOG.wardrobe].map(i=>[i.sku,i]));
const HOTBAR=8,MAX_STACK=9999,CLAIM_MAX=250,CLAIM_EVERY=2500,DAILY_CLAIMS=3000;
const day=t=>new Date(t).toISOString().slice(0,10);
//  Furniture placed from inventory carries its catalogue id in the group name.
const furnitureGroups=objects=>{const groups=new Map();for(const o of objects||[]){const m=/^f(\d{1,3})-/.exec(o.group||'');if(m&&SKUS.has('f:'+m[1]))groups.set(o.group,'f:'+m[1])}const n=new Map();for(const sku of groups.values())n.set(sku,(n.get(sku)||0)+1);return n};
//  Workshop blocks in a plot. A doorway counts as its two door blocks whether
//  it is open or closed, so opening a door is never a purchase.
const plotBlocks=(cells,doors)=>{const n=new Map(),doorAt=new Set();for(const d of doors||[])for(let y=0;y<2;y++)doorAt.add([d.x,d.y+y,d.z].join(','));for(const c of cells||[]){if(doorAt.has([c.x,c.y,c.z].join(',')))continue;const k='b:'+c.id;n.set(k,(n.get(k)||0)+1)}for(const d of doors||[]){const k='b:'+d.id;n.set(k,(n.get(k)||0)+2)}return n};
const delta=(before,after)=>{const out=new Map();for(const k of new Set([...before.keys(),...after.keys()])){const d=(after.get(k)||0)-(before.get(k)||0);if(d)out.set(k,d)}return out};

function createEconomy(db,{now=Date.now}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS wallets(account_id TEXT PRIMARY KEY REFERENCES accounts(id),balance INTEGER NOT NULL,claim_day TEXT NOT NULL DEFAULT '',claimed INTEGER NOT NULL DEFAULT 0,claim_at INTEGER NOT NULL DEFAULT 0,hotbar TEXT NOT NULL DEFAULT '[]');
 CREATE TABLE IF NOT EXISTS wallet_items(account_id TEXT NOT NULL REFERENCES accounts(id),sku TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(account_id,sku));`);
 const wallet=a=>{let w=db.prepare('SELECT * FROM wallets WHERE account_id=?').get(a);if(!w){db.prepare('INSERT INTO wallets(account_id,balance) VALUES(?,?)').run(a,CATALOG.startingBalance);w=db.prepare('SELECT * FROM wallets WHERE account_id=?').get(a)}return w};
 const items=a=>Object.fromEntries(db.prepare('SELECT sku,count FROM wallet_items WHERE account_id=? AND count>0').all(a).map(r=>[r.sku,r.count]));
 const count=(a,sku)=>db.prepare('SELECT count FROM wallet_items WHERE account_id=? AND sku=?').get(a,sku)?.count||0;
 const setCount=(a,sku,n)=>db.prepare('INSERT INTO wallet_items VALUES(?,?,?) ON CONFLICT(account_id,sku) DO UPDATE SET count=excluded.count').run(a,sku,Math.min(MAX_STACK,Math.max(0,n)));
 const name=sku=>SKUS.get(sku)?.name||sku;
 function read(a){const w=wallet(a);return{balance:w.balance,items:items(a),hotbar:JSON.parse(w.hotbar),catalog:CATALOG.version}}
 function tx(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}
 function buy(a,sku,qty){
  const item=SKUS.get(sku);if(!item)fail(400,'That item is not in the shop.');
  if(!Number.isSafeInteger(qty)||qty<1||qty>256)fail(400,'Buy between 1 and 256 at a time.');
  if(sku.startsWith('w:')&&qty!==1)fail(400,'Wardrobe pieces are bought once.');
  return tx(()=>{if(sku.startsWith('w:')&&count(a,sku)>0)fail(409,'You already own '+item.name+'.');const w=wallet(a),cost=item.price*qty;if(w.balance<cost)fail(402,'Not enough credits for '+qty+' × '+item.name+' ('+cost+' needed, '+w.balance+' held).');
   db.prepare('UPDATE wallets SET balance=balance-? WHERE account_id=?').run(cost,a);setCount(a,sku,count(a,sku)+qty);return read(a)});
 }
 function claim(a,amount,reason){
  if(!Number.isSafeInteger(amount)||amount<1||amount>CLAIM_MAX)fail(400,'Invalid amount.');
  if(typeof reason!=='string'||!/^[a-z-]{2,24}$/.test(reason))fail(400,'Invalid reason.');
  return tx(()=>{const w=wallet(a),t=now(),d=day(t),claimed=w.claim_day===d?w.claimed:0;
   if(t-w.claim_at<CLAIM_EVERY)return{...read(a),granted:0,note:'Too soon.'};
   const granted=Math.min(amount,Math.max(0,DAILY_CLAIMS-claimed));
   db.prepare('UPDATE wallets SET balance=balance+?,claim_day=?,claimed=?,claim_at=? WHERE account_id=?').run(granted,d,claimed+granted,t,a);
   return{...read(a),granted,note:granted<amount?'Daily earning limit reached.':''}});
 }
 function credit(a,amount){wallet(a);db.prepare('UPDATE wallets SET balance=balance+? WHERE account_id=?').run(amount,a)}
 function setHotbar(a,slots){
  if(!Array.isArray(slots)||slots.length!==HOTBAR)fail(400,'The hotbar has 8 slots.');
  const clean=slots.map(s=>{if(s===null)return null;if(typeof s!=='string'||s.length>40||!/^(b:\d{1,3}|f:\d{1,3}|k:[a-z-]{2,20}:\d{3})$/.test(s))fail(400,'Invalid hotbar item.');return s});
  wallet(a);db.prepare('UPDATE wallets SET hotbar=? WHERE account_id=?').run(JSON.stringify(clean),a);return read(a);
 }
 //  Apply a change in held items inside the caller's transaction: positive
 //  numbers are items used up by building, negative ones come back.
 function apply(a,used){
  wallet(a);
  for(const [sku,n]of used)if(n>0&&count(a,sku)<n)fail(402,'You need '+n+' × '+name(sku)+' and hold '+count(a,sku)+'. Buy more in the shop (I).');
  for(const [sku,n]of used)setCount(a,sku,count(a,sku)-n);
 }
 return{catalog:CATALOG,read,buy,claim,credit,setHotbar,owns:(a,sku)=>count(a,sku)>0,artChange:(a,before,after)=>apply(a,delta(furnitureGroups(before),furnitureGroups(after))),plotChange:(a,before,after)=>apply(a,delta(plotBlocks(before.cells,before.doors),plotBlocks(after.cells,after.doors)))};
}
module.exports={createEconomy,furnitureGroups,plotBlocks,CATALOG};
