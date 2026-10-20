/* Streets connect the story to the maker district without changing saves. */
(function(){'use strict';
// Replace the older, separately scripted first-night detour with the current bulletin.
const oldAct=shFrontAct;
window.shFrontAct=function(action){if(action!=='new-campaign')return oldAct.apply(this,arguments);
return fcLoad('Tuning in to FCN…',async()=>{
 if(State.chunkMap.size&&Slots.activeId)await shSlotSave(Slots.activeId);
 if(FN.prologue)fnEndPrologueWorld();
 Player.classKey=Player.classKey||'witness';State.classChosen=true;
 await shSlotNew('campaign');FN.state.prologueDone=true;FN.state.inPrologue=false;
 shPlayIntro(()=>{shCampaignStart(true);fnSave();shCampaignCheckpointSoon()});
});};
// Keep menus and gameplay at the same readable native device width.
if(matchMedia('(pointer:coarse)').matches){const menu=document.getElementById('menu-overlay'),meta=document.querySelector('meta[name="viewport"]');
 const fit=()=>{const value='width=device-width, initial-scale=1, viewport-fit=cover';if(meta&&meta.content!==value)meta.content=value};
 new MutationObserver(fit).observe(menu,{attributes:true,attributeFilter:['class']});fit();}
const original=shBuildChunk;
window.shBuildChunk=function(key){const result=original.apply(this,arguments),chunk=State.chunkMap.get(key);if(!chunk||chunk._districtWayfinding)return result;
const stops={'0,1':[18,26],'2,1':[65,26],'4,1':[113,26],'6,1':[146,26]};const at=stops[key];if(!at)return result;
const spot=shFindOpenSpot(at[0],at[1],.4,3,4);if(!spot)return result;chunk._districtWayfinding=true;
const sign=shSignPlane('MAKERS’ MILE  →','EAST / STUDIOS · GALLERY · ROOFTOPS','#dbedac','#152b2b',3.6,.8);sign.name='makers-mile-wayfinding';sign.position.set(spot.x,spot.y+2.4,spot.z);chunk.group.add(sign);
const pole=new THREE.Mesh(new THREE.BoxGeometry(.08,2.4,.08),new THREE.MeshStandardMaterial({color:0x5b7571,roughness:.8}));pole.position.set(spot.x,spot.y+1.2,spot.z);chunk.group.add(pole);return result;};
})();
