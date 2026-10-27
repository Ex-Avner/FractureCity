'use strict';
// One-time world resets, keyed by WORLD_EPOCH. When the stored epoch is
// older, every room's shared building is cleared: plot structures (walls,
// floors, doors) and city art (furniture, sculptures, signs, murals). Each
// resident gets back what they had placed: furniture pieces and workshop
// blocks return to their inventory, so nothing they paid for is lost.
// Accounts, wallets, the feed, gallery boards and profiles are untouched.
//
// Epoch 2 (0.84): the building yard grew (plots six times larger), so old
// structures no longer fit their plots, and test builds were left behind.
// start.cjs backs the database up before calling this.
const WORLD_EPOCH = 2;
function createWorldReset(db, { economyHelpers, now = Date.now } = {}){
 db.exec('CREATE TABLE IF NOT EXISTS world_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 const get = () => Number(db.prepare("SELECT value FROM world_meta WHERE key='epoch'").get()?.value || 1);
 function pending(){ return get() < WORLD_EPOCH; }
 function run(){
  if (!pending()) return { reset: false, epoch: get() };
  const has = t => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
  const refunds = new Map(), add = (a, sku, n) => { if (!n) return; const m = refunds.get(a) || new Map(); m.set(sku, (m.get(sku) || 0) + n); refunds.set(a, m); };
  const out = { reset: true, epoch: WORLD_EPOCH, structures: 0, art: 0, refunded: 0 };
  db.exec('BEGIN IMMEDIATE');
  try {
   if (has('city_structures')){
    for (const r of db.prepare('SELECT author,cells,doors FROM city_structures').all()){ out.structures++; for (const [sku, n] of economyHelpers.plotBlocks(JSON.parse(r.cells || '[]'), JSON.parse(r.doors || '[]'))) add(r.author, sku, n); }
    db.exec('DELETE FROM city_structures');
    if (has('city_structure_versions')) db.exec('UPDATE city_structure_versions SET revision=revision+1');
   }
   if (has('city_art')){
    for (const r of db.prepare('SELECT author,payload FROM city_art').all()){ out.art++; let objects = []; try { const p = JSON.parse(r.payload); objects = Array.isArray(p) ? p : p.objects || []; } catch (e){} for (const [sku, n] of economyHelpers.furnitureGroups(objects)) add(r.author, sku, n); }
    db.exec('DELETE FROM city_art');
    if (has('city_art_versions')) db.exec('UPDATE city_art_versions SET revision=revision+1');
   }
   if (has('wallet_items')){
    const up = db.prepare('INSERT INTO wallet_items(account_id,sku,count) VALUES(?,?,?) ON CONFLICT(account_id,sku) DO UPDATE SET count=MIN(9999,count+excluded.count)');
    for (const [a, m] of refunds){ if (!db.prepare('SELECT 1 FROM accounts WHERE id=?').get(a)) continue; for (const [sku, n] of m){ up.run(a, sku, n); out.refunded += n; } }
   }
   db.prepare("INSERT INTO world_meta VALUES('epoch',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(WORLD_EPOCH));
   db.prepare("INSERT INTO world_meta VALUES('reset_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(now()));
   db.exec('COMMIT');
  } catch (e){ db.exec('ROLLBACK'); throw e; }
  return out;
 }
 return { pending, run, epoch: get, WORLD_EPOCH };
}
module.exports = { createWorldReset, WORLD_EPOCH };
