/* Compact HUD keeps safety, story and interaction cues visible. */
(function(){
'use strict';
let compact=true;try{compact=localStorage.getItem('fc-compact-hud')!=='false'}catch{}
const style=document.createElement('style');style.textContent=`
body.fc-compact #hud-controls,body.fc-compact #hud-credits,body.fc-compact #hud-mode,body.fc-compact #hud-district,body.fc-compact #resident-view-toggle,body.fc-compact #campaign-casebook,body.fc-compact #sq-launch{display:none!important}
body.fc-compact #fx-scanlines,body.fc-compact #fx-grain,body.fc-compact #fx-chroma,body.fc-compact #fx-corners{opacity:0!important}
#fc-tools{position:fixed;right:16px;top:16px;z-index:85;font:12px system-ui;color:#e6e8eb;pointer-events:auto}
#fc-tools[hidden]{display:none}#fc-tools summary{cursor:pointer;list-style:none;background:#111b24e8;border:1px solid #60707b;border-radius:20px;padding:9px 16px}
#fc-tools .tray{margin-top:8px;padding:14px;background:#101921f5;border:1px solid #56626c;border-radius:12px;width:245px;box-shadow:0 12px 35px #0008}
#fc-tools button{font:inherit;color:inherit;background:#293641;border:1px solid #60707b;border-radius:6px;padding:9px;cursor:pointer}
#fc-tools .row{display:flex;gap:7px;margin:9px 0}#fc-tools .row button{flex:1}#fc-tools p{line-height:1.6;color:#b9c3cb}#fc-tools .track{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#efc57c}
@media(pointer:coarse){#fc-tools{top:60px;right:8px}#fc-tools summary{padding:7px 10px}#fc-tools .tray{max-height:60vh;overflow:auto}#pm-panel .in{max-height:90dvh;overflow:auto}}
#pm-panel.radio-only section:not(:first-of-type){display:none}#pm-panel.radio-only .in{max-width:680px}
body.fc-compact #hud-time{display:none!important}
body.fc-compact #hud-weapons .weapon-slot:not(.active){display:none!important}
body.fc-compact #hud-weapons{left:auto;right:20px;bottom:18px;transform:none;opacity:.85}
body.fc-compact #hud-weapons .weapon-slot{min-width:100px;padding:8px 12px;transform:none;clip-path:none;background:#0d1b21ba}
body.fc-compact #minimap{width:106px!important;height:106px!important;top:66px;right:18px;opacity:.8;clip-path:none;border-radius:4px}
body.fc-compact #narr{bottom:76px!important}
body.fc-compact #pm-now{display:none!important}
body.fc-compact #hud-task,body.fc-compact #sq-target{display:none!important}
body.fc-compact.maker-mode #fc-story-goal{display:none!important}
body.fc-compact #fc-story-goal{top:18px;max-width:min(330px,55vw);padding:8px 12px;background:#0d1b21c9}
body.fc-compact #maker-goal{max-width:min(340px,55vw);font-size:12px;padding:8px 12px;background:#0d1b21c9;border:0;border-left:2px solid #dbedac;border-radius:0}
body.fc-compact #fc-tools{top:16px;right:16px}
body:has(#city-online) #fc-tools{top:68px}
body:has(#maker-interact:not([hidden])) #interact-prompt{display:none!important}
@media(pointer:coarse){body.fc-compact #fc-story-goal,body.fc-compact #maker-goal{top:10px;max-width:56vw;font-size:10px}body.fc-compact #fc-tools{top:8px;right:8px}}
`;document.head.appendChild(style);
const menu=document.createElement('details');menu.id='fc-tools';menu.hidden=true;menu.innerHTML='<summary>Tools · F2</summary><div class="tray"><strong>Palm Radio</strong><p class="track">Your soundtrack</p><div class="row"><button data-act="prev" aria-label="Previous song">Back</button><button data-act="play">Play</button><button data-act="next" aria-label="Next song">Skip</button></div><div class="row"><button data-act="radio">Tracks & volume</button></div><div class="row"><button data-act="view">Camera · V</button><button data-act="hud">Full HUD</button></div><div class="row"><button data-act="zombies">Zombies · ⇧Z</button><button data-act="peace">Peaceful · P</button></div><div class="row"><button data-act="journal">Journal · J</button><button data-act="quests">Stories · K</button></div><p>WASD move · mouse look · E interact<br>U radio · Y skip · Esc game menu</p></div>';document.body.appendChild(menu);
function paint(){document.body.classList.toggle('fc-compact',compact);menu.querySelector('[data-act="hud"]').textContent=compact?'Full HUD':'Compact HUD';}paint();
let held=false,wasPaused=false;
function hold(){if(held)return;held=true;wasPaused=State.ui.paused;State.ui.paused=true;document.exitPointerLock?.();document.body.style.cursor='auto';}
function release(){if(!held)return;held=false;State.ui.paused=wasPaused;document.body.style.cursor=wasPaused?'auto':'none';}
menu.addEventListener('toggle',()=>menu.open?hold():release());
menu.addEventListener('pointerdown',e=>e.stopPropagation());
menu.addEventListener('click',e=>{e.stopPropagation();const act=e.target.closest('button')?.dataset.act;if(!act)return;
if(['prev','play','next'].includes(act))return window.PalmMedia?.[act]();
if(act==='hud'){compact=!compact;try{localStorage.setItem('fc-compact-hud',String(compact))}catch{}paint();return;}
menu.open=false;release();
if(act==='zombies')return typeof shSiegeToggle==='function'&&shSiegeToggle();
if(act==='peace')return typeof shSetPeaceful==='function'&&shSetPeaceful(!Peace.on);
if(act==='radio')window.PalmMedia?.openRadio();
else document.getElementById({view:'resident-view-toggle',journal:'campaign-casebook',quests:'sq-launch'}[act])?.click();
});
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;if(e.code==='F2'||(e.code==='Escape'&&menu.open)){e.preventDefault();e.stopImmediatePropagation();menu.open=!menu.open;if(menu.open)hold();else release();}},true);
setInterval(()=>{const available=!!State.chunkMap.size&&!State.ui.inArcade&&(!State.ui.paused||held)&&!State.ui.inIntro&&!State.ui.inDialogue&&!State.ui.inMiniGame&&!State.ui.inInventory&&!State.ui.inShiftPanel&&!window.PalmMedia?.panelOpen&&!window.FN?.prologue;menu.hidden=!available;if(!available&&menu.open){menu.open=false;release();}const pm=window.PalmMedia,t=pm?.music[pm.order[pm.pos]];menu.querySelector('.track').textContent=t?.title||'13 tracks · choose Play';menu.querySelector('[data-act="play"]').textContent=pm?.audio&&!pm.audio.paused?'Pause':'Play';},400);
window.FCQuietUI={get compact(){return compact},menu,close(){menu.open=false;release()}};
})();
