'use strict';
// Residents' looks in the shared city. A look is checked against the same
// wardrobe.json the game uses: known options only, colours as #rrggbb,
// ranges clamped, and rare pieces only if the account owns them (otherwise
// that piece falls back to the default).
const fs=require('node:fs'),path=require('node:path');
const W=JSON.parse(fs.readFileSync(path.join(__dirname,'..','apps','fracture-city-game','wardrobe.json'),'utf8'));
const SLOTS=new Map(),PREMIUM=[];
for(const g of W.groups)for(const s of g.slots){SLOTS.set(s.key,s);for(const [v,price]of Object.entries(s.premium||{}))PREMIUM.push({sku:'w:'+s.key+':'+v,key:s.key,value:v,name:s.label+': '+v.replace(/-/g,' '),price,category:'Wardrobe'})}
const COLOURS=new Set(W.colourSlots.map(c=>c.key));
const hex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
function clean(look,owns){
 if(!look||typeof look!=='object'||Array.isArray(look))return{...W.defaults};
 const out={...W.defaults};
 for(const [k,s]of SLOTS){const v=look[k];if(v===undefined)continue;
  if(s.range){const n=Number(v);if(Number.isFinite(n))out[k]=Math.max(s.range[0],Math.min(s.range[1],n));continue}
  if(s.multi){if(Array.isArray(v))out[k]=[...new Set(v.filter(x=>s.options.includes(x)&&(!s.premium?.[x]||owns('w:'+k+':'+x))))].slice(0,s.options.length);continue}
  if(s.options.includes(v)&&(!s.premium?.[v]||owns('w:'+k+':'+v)))out[k]=v;
 }
 for(const k of COLOURS){const v=look[k];if(k==='lips'?(v==='none'||hex(v)):hex(v))out[k]=v}
 return out;
}
module.exports={clean,PREMIUM,WARDROBE:W};
