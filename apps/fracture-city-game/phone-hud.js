/* Phone composition: two navigation buttons, one nearby action, clear thumbs.
 * Feature modules still own their prompts; the phone presents only the nearest
 * useful action. Desktop retains the familiar prompt stack. Layout is scheduled
 * by changes to HUD elements, never a permanent measurement interval. */
(function(){'use strict';
const ORDER=[['.pv-hp'],['#maker-interact'],['#interact-prompt'],['#npc-talk-prompt'],['#casting-prompt'],['#cg-approach'],['#news-approach'],['#rw-approach'],['#seam-approach'],['#chainfire-play'],['#campus-arcade-play'],['#city-art-open'],['#city-build-quick'],['#fc-field'],['#cast-talk'],['#city-build-open'],['#common-invite','#common-later']];
const ACTIONS=ORDER.flat().filter(s=>!['.pv-hp','#city-build-quick','#common-later'].includes(s));
const WATCH=[...ORDER.flat(),'#tc-top','#tc-stick','#tc-acts','#mob-ctx','#hud-hp','#hud-weapons','#fc-hotbar','#siege-bar','#maker-goal','#fc-story-goal','#city-online','#minimap','#fc-tools','#fc-bell'];
const css=document.createElement('style');css.id='phone-hud-css';css.textContent=`
html body.touch #tc-top{display:flex!important;top:max(12px,env(safe-area-inset-top))!important;left:max(12px,env(safe-area-inset-left))!important;right:auto!important;transform:none!important;gap:8px!important;max-width:none!important;flex-wrap:nowrap!important}
html body.touch #tc-top .tc-chip{min-height:44px!important;min-width:56px!important;padding:0 14px!important;font:600 12px system-ui!important;letter-spacing:.02em!important;border-radius:22px;background:#11272de8;color:#e6efea;border:1px solid #688079}
html body.touch #tc-top .mob-keys{color:#efdbac;border-color:#9a8b65}
html body.touch #minimap{top:max(12px,env(safe-area-inset-top))!important;right:max(12px,env(safe-area-inset-right))!important;transform:scale(.65)!important;transform-origin:top right;pointer-events:none}
html body.touch #fc-tools:not([open]),html body.touch #fc-bell,html body.touch #cg-directory-launch,html body.touch #cg-guide-open,html body.touch #fn-ability,html body.touch #hud-district,html body.touch #hud-credits,html body.touch #ob-hud,html body.touch #hud-time,html body.touch #checkpoint{display:none!important}
html body.touch #city-online:not(:has(details[open])){display:none!important}
html body.touch #city-online:has(details[open]),html body.touch #fc-tools[open],html body.touch:has(#city-online) #fc-tools[open]{position:fixed!important;inset:max(66px,calc(env(safe-area-inset-top) + 60px)) max(12px,env(safe-area-inset-right)) auto max(12px,env(safe-area-inset-left))!important;width:auto!important;max-width:440px!important;max-height:calc(100dvh - 82px)!important;margin:auto!important;overflow:auto!important;box-sizing:border-box;z-index:100000!important;background:#10262bf7!important;border-radius:16px;padding:12px!important}
html body.touch #fc-tools .tray{width:auto!important;max-height:none!important;box-shadow:none;border:0;padding:8px!important}
html body.touch #fc-tools button,html body.touch #fc-tools summary,html body.touch #city-online button,html body.touch #city-online summary{min-height:44px;box-sizing:border-box}
html body.touch #fc-tools .row{flex-wrap:wrap}html body.touch #fc-tools .tray>p:last-child{display:none}
html body.touch #maker-goal,html body.touch.fc-compact #maker-goal,html body.touch #fc-story-goal,html body.touch #campaign-hud{top:68px!important;left:max(12px,env(safe-area-inset-left))!important;right:auto!important;max-width:calc(100vw - 120px)!important;width:280px!important;max-height:62px!important;overflow:hidden!important;font:11px/1.4 system-ui!important;padding:8px 10px!important;background:#10262bc9!important;border-radius:8px;pointer-events:none}
html body.touch #maker-goal small,html body.touch #maker-goal br,html body.touch #campaign-hud ul,html body.touch #campaign-hud li{display:none!important}
html body.touch #cg-walk-guide{top:68px!important;left:max(12px,env(safe-area-inset-left))!important;right:auto!important;width:calc(100vw - 136px)!important;max-width:400px!important;box-sizing:border-box;padding:8px!important;font:12px/1.3 system-ui!important;border-radius:8px}
html body.touch #cg-walk-guide small{max-width:none;font-size:10px}html body.touch #cg-walk-guide button{min-width:44px;min-height:44px}
html body.touch #tc-stick{width:124px!important;height:124px!important;left:max(16px,env(safe-area-inset-left))!important;bottom:max(20px,env(safe-area-inset-bottom))!important;background:radial-gradient(circle,#142c333b 0%,#142c3312 70%,transparent 72%);border-color:#becdc52b}
html body.touch #tc-acts{width:148px;height:148px;display:block!important;right:max(16px,env(safe-area-inset-right))!important;bottom:max(20px,env(safe-area-inset-bottom))!important}
html body.touch .tc-btn{position:absolute;width:64px!important;height:64px!important;font:600 11px system-ui!important;letter-spacing:.02em!important;background:#11272db8;border-color:#a8bfb35c;box-shadow:none}
html body.touch .tc-jump{right:0;bottom:0}
html body.touch .tc-use{right:0;bottom:78px;width:76px!important;height:60px!important;border-radius:20px;color:#f4e6be;background:#314538ed;border-color:#c6b784;display:none!important;white-space:normal;line-height:1.2!important;padding:5px}
html body.touch.mob-has-action .tc-use{display:flex!important}
html body.touch .tc-fire{left:0;bottom:0;display:none!important}
html body.touch.tc-build .tc-fire{font-size:0!important}
html body.touch.tc-build .tc-fire::after{font:600 11px system-ui!important}
html body.touch.mob-combat .tc-fire,html body.touch.tc-build .tc-fire{display:flex!important}
html body.touch .tc-alt{left:0;bottom:78px}
html body.touch #mob-ctx{right:94px!important;bottom:max(98px,calc(env(safe-area-inset-bottom) + 78px))!important;left:auto!important;flex-direction:row!important}
html body.touch #mob-ctx .mob-cb{width:60px;height:60px;font:600 10px system-ui;background:#11272db8}
html body.touch #mob-ctx .next{display:none!important}
html body.touch #narr{top:140px!important;left:max(12px,env(safe-area-inset-left))!important;right:12px!important;bottom:auto!important;transform:none!important;width:auto!important;max-width:400px!important;max-height:96px!important;overflow-y:auto;box-sizing:border-box;padding:10px 12px!important;font:12px/1.4 system-ui!important;border-radius:10px;background:#10262be8!important;pointer-events:auto!important}
html body.touch #narr .prompt{display:none!important}
html body.touch .phone-stashed{visibility:hidden!important;pointer-events:none!important}
html body.touch.tc-build #minimap{display:none!important}
html body.touch #fc-hotbar{top:68px!important;bottom:auto!important;left:12px!important;right:12px!important;width:auto!important;max-width:calc(100vw - 24px)!important;transform:none!important;z-index:90!important;align-items:flex-start}
html body.touch #fc-hotbar .hb-slots{overflow-x:auto;overscroll-behavior:contain;touch-action:pan-x;max-width:calc(100vw - 86px);scrollbar-width:none}
html body.touch #fc-hotbar button{min-width:44px!important;width:44px!important;height:44px!important;flex:none}
html body.touch #fc-hotbar .hb-inv{min-width:44px!important;padding:0 6px}
html body.touch #fc-hotbar .hb-name{top:58px!important;max-width:calc(100vw - 40px);overflow:hidden;text-overflow:ellipsis}
html body.touch:not(.mob-combat) #hud-hp,html body.touch:not(.mob-combat) #hud-weapons{display:none!important}
html body.touch #city-build-quick{top:70px!important;bottom:auto!important;left:12px!important;right:12px!important;transform:none!important;width:auto!important;max-width:calc(100vw - 24px)!important;max-height:calc(100dvh - 260px)!important;overflow:auto!important;box-sizing:border-box}
html body.touch #city-build-quick small{font-size:10px}
html body.touch #hud-weapons,html body.touch.fc-compact #hud-weapons{left:50%!important;right:auto!important;bottom:20px!important;transform:translateX(-50%)!important}
html body.touch #hud-hp,html body.touch .pv-hp{top:auto!important;bottom:calc(max(20px,env(safe-area-inset-bottom)) + 158px)!important;left:50%!important;right:auto!important;transform:translateX(-50%)!important;width:min(240px,calc(100vw - 32px))!important}
html body.touch #toast-stack{top:auto!important;bottom:182px!important;left:50%!important;right:auto!important;transform:translateX(-50%)!important;align-items:center;max-width:calc(100vw - 32px);pointer-events:none}
html body.touch #toast-stack>:not(:last-child){display:none!important}
html body.touch #mob-keys{background:#06191bf5;backdrop-filter:none}
html body.touch #mob-keys .in{max-width:680px;padding-top:76px;padding-bottom:max(24px,env(safe-area-inset-bottom))}
html body.touch #mob-keys .mob-menu-title{margin:0 0 8px;font:30px Georgia,serif;color:#f1e4c7}
html body.touch #mob-keys .mob-menu-hint{font:12px/1.5 system-ui;color:#a3bab1;margin:0 0 18px}
html body.touch #mob-keys h5{color:#bba77a;font:600 10px system-ui;letter-spacing:.14em;margin-top:16px}
html body.touch #mob-keys .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
html body.touch #mob-keys .grid button{min-height:48px;padding:12px;font:13px/1.2 system-ui;letter-spacing:0;border-radius:10px;border-color:#46635c;background:#163337;color:#e8ede2}
html body.touch #mob-keys .grid b{display:none}
html body.touch #mob-back{border-radius:22px;min-height:44px;padding:12px 18px;font:600 12px system-ui;background:#173537;border-color:#78978c;color:#dce9df;box-shadow:none;letter-spacing:0}
html body.touch.mob-menu-open #fc-hotbar,html body.touch.mob-menu-open #touch-layer,html body.touch.mob-menu-open #minimap,html body.touch.mob-menu-open #maker-goal,html body.touch.mob-menu-open #fc-story-goal,html body.touch.mob-menu-open #narr{visibility:hidden!important}
@media(orientation:landscape){
 html body.touch #maker-goal,html body.touch #fc-story-goal,html body.touch #campaign-hud{top:12px!important;left:190px!important;max-width:calc(100vw - 310px)!important;max-height:44px!important;padding:5px 10px!important}
 html body.touch #cg-walk-guide{top:12px!important;left:190px!important;width:calc(100vw - 310px)!important;max-height:82px}
 html body.touch #narr{left:190px!important;right:190px!important;top:74px!important;max-width:none!important;max-height:90px!important}
 html body.touch #toast-stack{left:50%!important;bottom:18px!important;max-width:calc(100vw - 340px)!important}
 html body.touch #hud-hp,html body.touch .pv-hp{bottom:72px!important;width:min(240px,calc(100vw - 340px))!important}
 html body.touch #fc-hotbar{top:68px!important;left:160px!important;right:170px!important;max-width:none!important}
 html body.touch #fc-hotbar .hb-slots{max-width:calc(100vw - 390px)}
 html body.touch #city-build-quick{top:68px!important;left:160px!important;right:170px!important;max-width:none!important;max-height:calc(100dvh - 170px)!important}
 html body.touch #mob-keys .grid{grid-template-columns:repeat(3,minmax(0,1fr))}
}
`;document.head.append(css);
let current=null,queued=false,runs=0,lastSignature='';
const placed=new Set(),observed=new WeakSet();
function shown(e){if(!e||e.hidden)return false;const s=getComputedStyle(e);return s.display!=='none'&&s.opacity!=='0'&&(s.visibility!=='hidden'||e.classList.contains('phone-stashed')||placed.has(e))&&e.offsetWidth>0;}
function release(e){for(const p of ['left','bottom','top','right','transform','visibility'])e.style.removeProperty(p);placed.delete(e);}
function label(e){return e.textContent.replace(/\b(press|hold)\s+E\b/ig,'').replace(/\bE\s*[·—:]/g,'').replace(/^\s*[·—:]\s*/,'').trim();}
function layout(){
 runs++;const touch=document.body.classList.contains('touch');
 if(touch){
  for(const e of [...placed])release(e);
  const candidates=ACTIONS.map(s=>document.querySelector(s)).filter(Boolean);
  current=candidates.find(shown)||null;
  for(const e of candidates)if(!e.classList.contains('phone-stashed'))e.classList.add('phone-stashed');
  const later=document.getElementById('common-later');if(later&&!later.classList.contains('phone-stashed'))later.classList.add('phone-stashed');
  window.Mobile?.update();return;
 }
 current=null;document.querySelectorAll('.phone-stashed').forEach(e=>e.classList.remove('phone-stashed'));
 // Desktop keeps its existing collision-aware stack. Read geometry once,
 // compute all rows, then write their positions.
 const rect=e=>{const r=e.getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,b:r.bottom}};
 const hit=(a,b)=>a.l<b.r&&b.l<a.r&&a.t<b.b&&b.t<a.b;
 const blocks=['#fc-hotbar','#hud-weapons','#hud-hp','#siege-bar'].flatMap(s=>[...document.querySelectorAll(s)]).filter(shown).map(rect);
 const heads=['#city-online','#maker-goal','#fc-story-goal','#minimap','#fc-tools','#fc-bell'].map(s=>document.querySelector(s)).filter(shown).map(rect).filter(r=>r.b<innerHeight*.5);
 const top=Math.max(0,...heads.map(r=>r.b))+8;
 const rows=ORDER.map(ids=>ids.map(s=>document.querySelector(s)).filter(shown)).filter(es=>es.length).map(es=>({es,ws:es.map(e=>e.offsetWidth),h:Math.max(...es.map(e=>e.offsetHeight))}));
 let floor=innerHeight-96;const seen=new Set(),writes=[];
 for(const row of rows){
  const w=row.ws.reduce((a,b)=>a+b,0)+8*(row.es.length-1),left=Math.max(8,(innerWidth-w)/2);let bottom=floor,guard=0;
  for(;;){const block=blocks.find(k=>hit({l:left,r:left+w,t:bottom-row.h,b:bottom},k));if(!block||++guard>12)break;bottom=block.t-8;}
  let x=left;for(let i=0;i<row.es.length;i++){const e=row.es[i];seen.add(e);writes.push([e,{left:Math.round(x)+'px',bottom:Math.round(innerHeight-bottom)+'px',top:'auto',right:'auto',transform:'none',visibility:bottom-row.h<top?'hidden':'visible'}]);x+=row.ws[i]+8;}
  if(bottom-row.h>=top){blocks.push({l:left,r:left+w,t:bottom-row.h,b:bottom});floor=bottom-row.h-8;}
 }
 for(const[e,values]of writes){for(const[p,v]of Object.entries(values))if(e.style.getPropertyValue(p)!==v)e.style.setProperty(p,v,'important');placed.add(e);}
 for(const e of [...placed])if(!seen.has(e))release(e);
}
function soon(){if(queued)return;queued=true;setTimeout(()=>{requestAnimationFrame(()=>{
 queued=false;if(document.hidden)return;
 // Feature timers sometimes assign the same label repeatedly. Attribute/text
 // reads are cheap; only changed state needs computed styles or measurements.
 const signature=innerWidth+'x'+innerHeight+'|'+document.body.className+'|'+WATCH.map(s=>[...document.querySelectorAll(s)].map(e=>[e.hidden,e.className,e.style.cssText,e.textContent].join('~')).join('|')).join('||');
 if(signature===lastSignature)return;lastSignature=signature;layout();
});},100);}
const observer=new MutationObserver(soon);
function connect(){for(const s of WATCH)for(const e of document.querySelectorAll(s))if(!observed.has(e)){observed.add(e);observer.observe(e,{attributes:true,attributeFilter:['hidden','class','style'],childList:true,characterData:true,subtree:true});}soon();}
new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length))connect();}).observe(document.body,{childList:true});
new MutationObserver(soon).observe(document.body,{attributes:true,attributeFilter:['class']});
addEventListener('resize',soon);addEventListener('orientationchange',soon);document.addEventListener('visibilitychange',soon);connect();
window.FCPhoneHUD={layout,ORDER,context:()=>current?{element:current,label:label(current)}:null,get runs(){return runs}};
})();
