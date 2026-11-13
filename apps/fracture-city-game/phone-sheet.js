/* Phone sheet: the city menu as a sheet, not a wall.

   The menu used to cover the whole screen with forty identical buttons, and in
   landscape its heading took 40% of the height. Now:
     portrait   a bottom sheet; the street stays visible above it
     landscape  a side panel on the right; the street stays visible on the left
     top row    four large tiles for what gets used most
     recent     the last four things opened, remembered on this device
     find       a filter field; type two letters instead of scrolling
     context    rows that cannot do anything right now are left out
     dismiss    tap outside, the Close button, or drag the handle down
   Controls keep their handlers: every tile and chip presses the original button.
   Also: touch feedback on every control, and no keyboard letter on the ability button.
   Loaded after mobile.js and phone-hud.js. Nothing here runs on desktop. */
(function(){'use strict';
if(typeof Touch==='undefined'||!window.Mobile)return;
const KEY='fc-mob-recent',QUICK=[['Map','<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'],['Inventory','<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5a3 3 0 016 0v2M4 12h16"/>'],['Build mode','<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9"/>'],['Online & friends','<circle cx="9" cy="9" r="3.2"/><path d="M3 19c.6-3.4 3-5 6-5s5.400 1.600 6 5"/><circle cx="17" cy="8" r="2.4"/><path d="M16.500 13.200c2.400.200 4 1.700 4.500 4.300"/>']];
const css=document.createElement('style');css.id='phone-sheet-css';css.textContent=`
html body.touch #mob-keys{background:rgba(3,12,14,.46);overflow:hidden;touch-action:none}
html body.touch #mob-keys.on{display:flex}
html body.touch #mob-keys .in{max-width:none;width:100%;height:100%;margin:0;padding:0;display:flex;align-items:flex-end;justify-content:center;min-height:0}
#mob-keys .fc-sheet{box-sizing:border-box;width:min(680px,100%);max-height:84dvh;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;background:#0a2124;border:1px solid #2f4d49;border-bottom:0;border-radius:22px 22px 0 0;padding:0 16px max(22px,env(safe-area-inset-bottom));box-shadow:0 -18px 50px rgba(0,0,0,.6);animation:fc-sheet-up .22s cubic-bezier(.2,.8,.2,1)}
#mob-keys .fc-sheet-head{position:sticky;top:0;z-index:2;background:linear-gradient(#0a2124 88%,rgba(10,33,36,0));padding:8px 0 12px;margin:0 -2px;touch-action:none}
#mob-keys .fc-grab{width:44px;height:5px;border-radius:3px;background:#3d5c57;margin:2px auto 10px}
#mob-keys .fc-sheet-row{display:flex;align-items:center;gap:12px}
html body.touch #mob-keys .mob-menu-title{margin:0;font:22px Georgia,serif;color:#f1e4c7;white-space:nowrap}
html body.touch #mob-keys .mob-menu-hint{display:none}
#mob-keys .fc-find{flex:1;min-width:0;height:40px;border-radius:20px;border:1px solid #37554f;background:#10302f;color:#e8ede2;font:15px system-ui;padding:0 16px;outline:none;-webkit-appearance:none;appearance:none}
#mob-keys .fc-find::placeholder{color:#7f9a92}
#mob-keys .fc-find:focus{border-color:#d7b869}
#mob-keys .fc-quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:2px 0 4px}
#mob-keys .fc-quick button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:76px;border-radius:14px;border:1px solid #4c6b62;background:#173a3b;color:#f1e4c7;font:600 11px/1.15 system-ui;padding:8px 4px;text-align:center}
#mob-keys .fc-quick svg{width:26px;height:26px;fill:none;stroke:#d7b869;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
#mob-keys .fc-recent{display:flex;gap:8px;overflow-x:auto;padding:10px 0 2px;scrollbar-width:none}
#mob-keys .fc-recent:empty{display:none}
#mob-keys .fc-recent::before{content:'RECENT';align-self:center;color:#bba77a;font:600 10px system-ui;letter-spacing:.14em;flex:none}
#mob-keys .fc-recent button{flex:none;min-height:36px;border-radius:18px;border:1px solid #3d5c57;background:transparent;color:#cfe0d6;font:13px system-ui;padding:0 14px;white-space:nowrap}
#mob-keys .fc-none{display:none;color:#a3bab1;font:14px system-ui;padding:22px 2px}
#mob-keys .fc-sheet.empty .fc-none{display:block}
#mob-keys .fc-sheet.finding .fc-quick,#mob-keys .fc-sheet.finding .fc-recent{display:none}
#mob-keys .grid [hidden]{display:none!important}
#mob-keys .fc-sheet button:active,body.touch #tc-top .tc-chip:active,body.touch #tc-acts button:active,body.touch .mob-cb:active,body.touch #mob-back:active{transform:scale(.95);filter:brightness(1.25)}
#mob-keys .fc-sheet button,body.touch #tc-top .tc-chip,body.touch #tc-acts button,body.touch .mob-cb{transition:transform .08s ease-out,filter .08s ease-out;-webkit-tap-highlight-color:transparent}
@keyframes fc-sheet-up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
@keyframes fc-sheet-in{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}
@media (orientation:landscape) and (max-height:540px){
 html body.touch #mob-keys .in{align-items:stretch;justify-content:flex-end}
 #mob-keys .fc-sheet{width:min(430px,56vw);max-height:none;height:100%;border-radius:22px 0 0 22px;border:1px solid #2f4d49;border-right:0;padding:0 max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) 16px;animation-name:fc-sheet-in;box-shadow:-18px 0 50px rgba(0,0,0,.6)}
 #mob-keys .fc-grab{display:none}
 #mob-keys .fc-sheet-head{padding-top:max(12px,env(safe-area-inset-top))}
 html body.touch #mob-keys .grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 #mob-keys .fc-quick button{min-height:62px}
}
@media (prefers-reduced-motion:reduce){#mob-keys .fc-sheet{animation:none}#mob-keys .fc-sheet button,body.touch #tc-top .tc-chip,body.touch #tc-acts button,body.touch .mob-cb{transition:none}}
`;document.head.append(css);

const label=b=>(b.querySelector('span')?.textContent||b.textContent||'').trim();
function mount(){
 const keys=document.getElementById('mob-keys'),inn=keys?.querySelector('.in'),grid=keys?.querySelector('.grid');
 if(!keys||!inn||!grid||inn.querySelector('.fc-sheet'))return !!inn?.querySelector('.fc-sheet');
 const sheet=document.createElement('div');sheet.className='fc-sheet';
 const head=document.createElement('div');head.className='fc-sheet-head';head.innerHTML='<div class="fc-grab" aria-hidden="true"></div><div class="fc-sheet-row"></div>';
 const find=document.createElement('input');find.className='fc-find';find.type='search';find.placeholder='Find';find.setAttribute('aria-label','Find in menu');find.autocomplete='off';find.autocapitalize='off';find.spellcheck=false;
 const title=inn.querySelector('.mob-menu-title');if(title)head.lastChild.append(title);head.lastChild.append(find);
 const quick=document.createElement('div');quick.className='fc-quick';const recent=document.createElement('div');recent.className='fc-recent';
 const none=document.createElement('p');none.className='fc-none';none.textContent='Nothing by that name.';
 sheet.append(head,quick,recent);while(inn.firstChild)sheet.append(inn.firstChild);sheet.append(none);inn.append(sheet);
 const original=name=>[...grid.querySelectorAll('button')].find(b=>label(b)===name);
 const press=name=>{const b=original(name);if(b)b.click()};
 for(const [name,icon] of QUICK){if(!original(name))continue;const b=document.createElement('button');b.type='button';b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${name.replace(' mode','').replace(' & friends','')}</span>`;b.setAttribute('aria-label',name);b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();press(name)});quick.append(b)}
 // Recent: what was actually opened, newest first, this device only.
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]').filter(n=>typeof n==='string').slice(0,4)}catch(e){return[]}};
 grid.addEventListener('click',e=>{const b=e.target.closest?.('button');if(!b)return;const name=label(b);if(QUICK.some(q=>q[0]===name)||name==='Menu')return;try{localStorage.setItem(KEY,JSON.stringify([name,...read().filter(n=>n!==name)].slice(0,4)))}catch(err){}},true);
 function drawRecent(){recent.textContent='';for(const name of read()){const o=original(name);if(!o||o.hidden)continue;const b=document.createElement('button');b.type='button';b.textContent=name;b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();press(name)});recent.append(b)}}
 // Rows that need something which is not on screen are left out until it is.
 const NEEDS={'Ned’s invitation':'#common-invite','Dismiss invitation':'#common-later','Inbox':'#fc-bell','Online & friends':'#city-online details','Tools & radio':'#fc-tools'};
 const present=sel=>{const e=document.querySelector(sel);return !!e&&(sel==='#fc-tools'||sel==='#city-online details'||e.offsetWidth>0)};
 function filter(){const q=find.value.trim().toLowerCase();let shown=0,header=null,any=false;
  for(const el of grid.children){if(el.tagName==='H5'){if(header)header.hidden=!any;header=el;any=false;continue}
   const name=label(el),need=NEEDS[name],ok=(!need||present(need))&&(!q||name.toLowerCase().includes(q));el.hidden=!ok;if(ok){shown++;any=true}}
  if(header)header.hidden=!any;sheet.classList.toggle('finding',!!q);sheet.classList.toggle('empty',!shown)}
 find.addEventListener('input',filter);
 // Typing in the field must not drive the game underneath.
 for(const type of ['keydown','keyup','keypress'])find.addEventListener(type,e=>{e.stopPropagation();if(type==='keydown'&&e.key==='Escape'){find.blur();Mobile.showKeys(false)}if(type==='keydown'&&e.key==='Enter'){const first=[...grid.querySelectorAll('button')].find(b=>!b.hidden);if(first&&find.value.trim()){e.preventDefault();first.click()}}});
 find.addEventListener('pointerdown',e=>e.stopPropagation());
 // Drag the handle down to dismiss.
 let startY=null;head.addEventListener('pointerdown',e=>{if(e.target===find)return;startY=e.clientY;head.setPointerCapture?.(e.pointerId)});
 head.addEventListener('pointermove',e=>{if(startY===null)return;const dy=Math.max(0,e.clientY-startY);sheet.style.transform=dy?`translateY(${dy}px)`:''});
 const end=e=>{if(startY===null)return;const dy=e.clientY-startY;startY=null;sheet.style.transform='';if(dy>70)Mobile.showKeys(false)};head.addEventListener('pointerup',end);head.addEventListener('pointercancel',end);
 // Each time the sheet opens: fresh filter, fresh context, top of the list.
 new MutationObserver(()=>{if(!keys.classList.contains('on')){find.blur();return}find.value='';filter();drawRecent();sheet.scrollTop=0;sheet.style.transform=''}).observe(keys,{attributes:true,attributeFilter:['class']});
 filter();drawRecent();return true;
}
let tries=0;(function wait(){if(mount()||++tries>200)return;setTimeout(wait,150)})();
// A short tick under the thumb where the device supports it.
document.addEventListener('pointerdown',e=>{if(!Touch.on||e.pointerType==='mouse')return;if(e.target.closest?.('.tc-chip,#tc-acts button,.mob-cb,#mob-back,#mob-keys button'))try{navigator.vibrate?.(8)}catch(err){}},true);
window.FCPhoneSheet={mount,version:'0.102.0'};
})();
