/* 0.85 · One HUD layout, loaded last so it wins over the per-feature patches.
 *
 * Touch screens (body.touch), portrait or landscape:
 *   top left    chips · then the online pill · then the current goal
 *   top right   minimap · Tools · the inbox bell, one column
 *   bottom      prompts stack in a single column above (portrait) or between
 *               (landscape) the thumb controls, never on top of each other
 *
 * Every screen: interaction prompts (E prompts, talk, arcade, build, Ned's
 * invite and its Later button) are placed one above the other instead of all
 * sitting at bottom:110px. When there is no room, the least urgent is held back
 * until the one below it goes. */
(function(){
'use strict';
const css=document.createElement('style');css.id='phone-hud-css';css.textContent=`
html body.touch #tc-top{max-width:calc(100vw - 24px - 92px)!important;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
html body.touch #tc-top::-webkit-scrollbar{display:none}
html body.touch #tc-top .tc-chip{flex:none}
html body.touch #minimap{top:10px!important;right:max(10px,env(safe-area-inset-right))!important}
html body.touch #fc-tools,html body.touch.fc-compact #fc-tools,html body.touch:has(#city-online) #fc-tools{top:92px!important;right:max(8px,env(safe-area-inset-right))!important;left:auto!important}
html body.touch #fc-tools .tray{max-height:calc(100dvh - 150px)}
html body.touch #fc-bell{top:134px!important;bottom:auto!important;right:max(8px,env(safe-area-inset-right))!important}
html body.touch #city-online{top:46px!important;left:max(12px,env(safe-area-inset-left))!important;right:auto!important;max-width:calc(100vw - 24px - 92px)!important;padding:6px 10px!important;z-index:130!important}
html body.touch #city-online[open],html body.touch #city-online:has(details[open]){max-width:min(360px,calc(100vw - 24px))!important;max-height:calc(100dvh - 56px);overflow:auto;z-index:100000!important}
html body.touch #maker-goal,html body.touch.fc-compact #maker-goal,html body.touch #fc-story-goal,html body.touch.fc-compact #fc-story-goal{top:46px!important;left:max(12px,env(safe-area-inset-left))!important;right:auto!important;max-width:calc(100vw - 24px - 92px)!important}
html body.touch:has(#city-online) #maker-goal,html body.touch:has(#city-online) #fc-story-goal{top:90px!important}
html body.touch #fn-ability{display:none!important}
html body.touch #toast-stack{top:8px!important;bottom:auto!important;left:auto!important;right:calc(max(10px,env(safe-area-inset-right)) + 92px)!important;transform:none;align-items:flex-end;max-width:min(320px,calc(100vw - 540px));pointer-events:none}
html body.touch #hud-weapons,html body.touch.fc-compact #hud-weapons{left:auto!important;right:max(16px,env(safe-area-inset-right))!important;bottom:calc(max(16px,env(safe-area-inset-bottom)) + 186px)!important;transform:none!important}
@media (orientation:landscape){html body.touch #hud-hp{width:min(300px,calc(100vw - 560px))!important}}
@media (orientation:portrait){
 html body.touch #hud-hp{bottom:calc(max(16px,env(safe-area-inset-bottom)) + 192px)!important;width:min(340px,calc(100vw - 32px))!important}
 html body.touch #mob-ctx{right:max(16px,env(safe-area-inset-right))!important;bottom:calc(max(16px,env(safe-area-inset-bottom)) + 252px)!important}
 html body.touch #hud-weapons,html body.touch.fc-compact #hud-weapons{right:auto!important;left:max(16px,env(safe-area-inset-left))!important;bottom:calc(max(16px,env(safe-area-inset-bottom)) + 252px)!important}
}
@media (orientation:portrait){html body.touch #toast-stack{top:178px!important;right:auto!important;left:50%!important;transform:translateX(-50%);align-items:center;max-width:calc(100vw - 32px)}}
`;document.head.appendChild(css);

//  Touch has no F2: the Tools button just says Tools.
const tools=()=>document.querySelector('#fc-tools summary');
function relabel(){const s=tools();if(s&&document.body.classList.contains('touch')&&s.textContent!=='Tools')s.textContent='Tools'}

//  Bottom prompts, lowest first: the PvP bar, then what you can do right here,
//  then nudges. Ned's invite and Later share one row.
const ORDER=[['.pv-hp'],['#maker-interact'],['#interact-prompt'],['#npc-talk-prompt'],['#casting-prompt'],['#cg-approach'],['#news-approach'],['#rw-approach'],['#seam-approach'],['#chainfire-play'],['#campus-arcade-play'],['#city-art-open'],['#city-build-quick'],['#fc-field'],['#cast-talk'],['#city-build-open'],['#common-invite','#common-later']];
const CONTROLS=['#tc-stick','#tc-acts','#mob-ctx .mob-cb.on','#fc-hotbar','#hud-weapons','#hud-hp','#siege-bar'];
const GAP=8;
//  An element we held back still counts as wanting a place.
function shown(e){if(!e||e.hidden)return false;const s=getComputedStyle(e);if(s.visibility==='hidden'&&!(placed.has(e)&&e.style.visibility==='hidden'))return false;return s.display!=='none'&&+s.opacity!==0&&e.offsetWidth>0}
function rect(e){const r=e.getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,b:r.bottom}}
const hit=(a,b)=>a.l<b.r&&b.l<a.r&&a.t<b.b&&b.t<a.b;
const placed=new Set();
function put(e,left,bottom){e.style.setProperty('left',Math.round(left)+'px','important');e.style.setProperty('bottom',Math.round(bottom)+'px','important');e.style.setProperty('top','auto','important');e.style.setProperty('right','auto','important');e.style.setProperty('transform','none','important');e.style.removeProperty('visibility');placed.add(e)}
function hold(e){e.style.setProperty('visibility','hidden','important');placed.add(e)}
function release(e){for(const p of ['left','bottom','top','right','transform','visibility'])e.style.removeProperty(p);placed.delete(e)}
//  The top of the bottom area: under the top-left and top-right HUD.
function ceiling(){let y=0;for(const s of ['#tc-top','#city-online','#maker-goal','#fc-story-goal','#minimap','#fc-tools','#fc-bell']){const e=document.querySelector(s);if(e&&shown(e)&&!(e.matches('#city-online')&&e.querySelector('details[open]'))){const r=e.getBoundingClientRect();if(r.bottom<innerHeight*.5)y=Math.max(y,r.bottom)}}return y+GAP}
function layout(){
 const W=innerWidth,H=innerHeight,safe=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab'))||0;
 const blocks=[];for(const s of CONTROLS)for(const e of document.querySelectorAll(s))if(shown(e))blocks.push(rect(e));
 const top=ceiling(),seen=new Set();let floor=H-Math.max(16,safe+12);
 //  Desktop keeps prompts where players expect them, above the hotbar.
 if(!document.body.classList.contains('touch'))floor=Math.min(floor,H-96);
 for(const ids of ORDER){
  const els=ids.map(s=>document.querySelector(s)).filter(e=>e&&shown(e));for(const e of els)seen.add(e);if(!els.length)continue;
  //  Measure as laid out by its own CSS width, then place the row centred.
  const ws=els.map(e=>e.offsetWidth),h=Math.max(...els.map(e=>e.offsetHeight)),w=ws.reduce((a,b)=>a+b,0)+GAP*(els.length-1);
  const left=Math.max(8,(W-w)/2);let b=floor,guard=0;
  for(;;){const r={l:left,r:left+w,t:b-h,b};const block=blocks.find(k=>hit(r,k));if(!block||++guard>12)break;b=block.t-GAP}
  if(b-h<top){for(const e of els)hold(e);continue}
  let x=left;els.forEach((e,i)=>{put(e,x,H-b);x+=ws[i]+GAP});
  blocks.push({l:left,r:left+w,t:b-h,b});floor=b-h-GAP;
 }
 for(const e of [...placed])if(!seen.has(e))release(e);
}
let queued=false;function soon(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;try{relabel();layout()}catch(e){}})}
setInterval(soon,250);addEventListener('resize',soon);addEventListener('orientationchange',soon);
window.FCPhoneHUD={layout,ORDER};
})();
