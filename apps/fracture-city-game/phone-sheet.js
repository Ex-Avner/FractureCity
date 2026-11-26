/* Mobile menu: four shortcuts and six clearly labeled categories.
   Original action buttons/handlers are retained. Notes stay in a bounded,
   session-only Journal; optional subtitles are remembered on this device. */
(function(){'use strict';
if(typeof Touch==='undefined'||!window.Mobile)return;
const GROUPS={
 Explore:['Outer Expanse · expeditions','The Mirror Hour','Free College','College seminars','Explore Common Ground','Map','Skateboard'],
 Create:['Build mode','Free build','Studio','World Studio'],
 Gear:['Inventory','Ability','Take weapon','Use / talk','Sit','Weapon 1','Weapon 2','Weapon 3','Siege'],
 Social:['Online & friends','Inbox','Ned’s invitation','Dismiss invitation','Post a thought'],
 Quests:['City Dispatch · quests & dailies','First Signal · records','Casebook','Next line'],
 Settings:['Touch controls','Tools & radio','Camera view','Radio on/off','Next song','Peaceful','Display','Detail','Darker','Brighter','Sound on/off','Menu']
};
const SHORT={'Outer Expanse · expeditions':'Expeditions','The Mirror Hour':'Mirror Hour','College seminars':'Seminars','Explore Common Ground':'Common Ground','City Dispatch · quests & dailies':'Quests & dailies','First Signal · records':'Signal records','Menu':'Main menu','Tools & radio':'More tools'};
const css=document.createElement('style');css.id='phone-sheet-css';css.textContent=`
html body.touch #mob-keys{background:#03101480;overflow:hidden;touch-action:none}
html body.touch #mob-keys.on{display:flex}
html body.touch #mob-keys .in{width:100%;height:100%;max-width:none;min-height:0;margin:0;padding:0;display:flex;align-items:flex-end;justify-content:center}
html body.touch #mob-keys .fc-sheet{box-sizing:border-box;width:min(560px,100%);max-height:80dvh;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;background:#102329;border:1px solid #496361;border-bottom:0;border-radius:24px 24px 0 0;padding:0 16px max(20px,env(safe-area-inset-bottom));box-shadow:0 -12px 40px #0006}
#mob-keys .fc-sheet-head{position:sticky;top:0;z-index:2;background:#102329;padding:10px 0 14px;touch-action:none}
#mob-keys .fc-grab{width:36px;height:4px;background:#6b827c;border-radius:4px;margin:0 auto 10px}
#mob-keys .fc-sheet-row{display:flex;align-items:center;gap:8px}
#mob-keys .fc-sheet-row h2{flex:1;margin:0;font:600 20px system-ui;color:#f1ead8}
#mob-keys .fc-sheet button{min-height:48px;min-width:44px;border:1px solid #46615f;border-radius:13px;background:#193339;color:#eef0e8;font:600 13px system-ui;touch-action:manipulation;padding:10px 12px}
#mob-keys .fc-sheet button:active{background:#31524e}
#mob-keys .fc-sheet button:focus-visible{outline:3px solid #ead19a;outline-offset:2px}
#mob-keys .fc-sheet [hidden]{display:none!important}
#mob-keys .fc-quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:16px}
#mob-keys .fc-quick button{display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;padding:10px 3px;min-height:76px;font-size:12px;background:#243e3e;border-color:#6a8177}
#mob-keys .fc-quick svg{width:24px;height:24px;stroke:#ecd49b;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
#mob-keys .fc-categories{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
#mob-keys .fc-categories button{text-align:left;display:flex;justify-content:space-between;align-items:center}
#mob-keys .fc-categories button::after{content:'›';color:#bdcfc5;font-size:22px}
html body.touch #mob-keys .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0}
html body.touch #mob-keys .grid button{font:13px system-ui;min-height:48px;padding:12px;border-radius:12px;letter-spacing:0}
#mob-keys .grid b,#mob-keys .grid h5{display:none!important}
#mob-keys .fc-notes{color:#d1dfd8;font:14px/1.45 system-ui}
#mob-keys .fc-notes p{padding:12px 0;margin:0;border-bottom:1px solid #344b4b;overflow-wrap:anywhere}
#mob-keys .fc-notes h3{font:600 13px system-ui;color:#e8d2a0;margin:18px 0 4px}
#mob-keys .fc-control-setting{display:grid;grid-template-columns:1fr auto;gap:10px;padding:12px 0;color:#e7ede6}#mob-keys .fc-control-setting input{grid-column:1/-1;width:100%;height:36px;accent-color:#dbc791;touch-action:pan-x}#mob-keys .fc-control-toggle{display:flex;align-items:center;gap:12px;min-height:52px}#mob-keys .fc-control-toggle input{width:22px;height:22px;accent-color:#dbc791}
#mob-keys .fc-subtitles{width:100%;text-align:left;margin-bottom:8px}
@media(orientation:landscape) and (max-height:540px){
 html body.touch #mob-keys .in{align-items:stretch;justify-content:flex-end}
 html body.touch #mob-keys .fc-sheet{width:min(430px,58vw);max-height:100%;height:100%;border-radius:20px 0 0 20px;border-bottom:1px solid #496361;border-right:0;padding-right:max(16px,env(safe-area-inset-right))}
 #mob-keys .fc-grab{display:none}#mob-keys .fc-sheet-head{padding-top:max(10px,env(safe-area-inset-top))}
 #mob-keys .fc-quick{margin-bottom:10px}#mob-keys .fc-quick button{min-height:64px}
}
`;document.head.append(css);
function mount(){
 const keys=document.getElementById('mob-keys'),inn=keys?.querySelector('.in'),grid=keys?.querySelector('.grid');
 if(!keys||!inn||!grid)return false;if(inn.querySelector('.fc-sheet'))return true;
 const controlButton=document.createElement('button');controlButton.type='button';controlButton.innerHTML='<span>Touch controls</span>';grid.append(controlButton);
 const originals=[...grid.querySelectorAll('button')];
 for(const b of originals){const span=b.querySelector('span');b.dataset.menuName=(span?.textContent||b.textContent).trim();if(span&&SHORT[b.dataset.menuName])span.textContent=SHORT[b.dataset.menuName];}
 const original=name=>originals.find(b=>b.dataset.menuName===name);
 const sheet=document.createElement('div');sheet.className='fc-sheet';
 const head=document.createElement('div');head.className='fc-sheet-head';head.innerHTML='<div class="fc-grab" aria-hidden="true"></div><div class="fc-sheet-row"><button type="button" data-sheet-back hidden>Back</button><h2 id="phone-menu-title">Menu</h2><button type="button" data-sheet-close>Close</button></div>';
 const quick=document.createElement('div');quick.className='fc-quick';
 const categories=document.createElement('div');categories.className='fc-categories';
 const notes=document.createElement('div');notes.className='fc-notes';notes.hidden=true;
 sheet.append(head,quick,categories,grid,notes);inn.replaceChildren(sheet);keys.setAttribute('aria-labelledby','phone-menu-title');
 const title=head.querySelector('h2'),back=head.querySelector('[data-sheet-back]');
 const button=(text,run)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',text);b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();run()});return b};
 let section='Menu';
 function show(name){
  section=name;title.textContent=name;back.hidden=name==='Menu';quick.hidden=categories.hidden=name!=='Menu';notes.hidden=!['Journal','Touch controls'].includes(name);grid.hidden=['Menu','Journal','Touch controls'].includes(name);
  for(const b of originals)b.hidden=!(GROUPS[name]||[]).includes(b.dataset.menuName);
  if(name==='Journal')journal();if(name==='Touch controls')controls();sheet.scrollTop=0;
  if(name!=='Menu')(['Journal','Touch controls'].includes(name)?notes.querySelector('input,button'):grid.querySelector('button:not([hidden])'))?.focus({preventScroll:true});
 }
 function journal(){
  notes.replaceChildren();const prefs=window.FCPhoneHUD;
  const toggle=button('Subtitles: '+(prefs?.subtitles?'On':'Off'),()=>{prefs?.setSubtitles(!prefs.subtitles);toggle.textContent='Subtitles: '+(prefs?.subtitles?'On':'Off');toggle.setAttribute('aria-label',toggle.textContent);toggle.setAttribute('aria-pressed',String(!!prefs?.subtitles))});toggle.className='fc-subtitles';toggle.setAttribute('aria-pressed',String(!!prefs?.subtitles));notes.append(toggle);
  const quests=button('Quests & dailies',()=>original('City Dispatch · quests & dailies')?.click());notes.append(quests);
  const heading=document.createElement('h3');heading.textContent='Recent activity';notes.append(heading);
  const entries=prefs?.journal()||[];
  for(const item of entries.length?entries:[{text:'No recent activity.'}]){const p=document.createElement('p');p.textContent=item.text;notes.append(p);}
 }
 controlButton.onclick=()=>show('Touch controls');
 function controls(){
  notes.replaceChildren();
  for(const [key,label,min,max,step]of [['sensitivity','Look sensitivity',.4,1.8,.1],['stickSize','Joystick size',100,148,4],['deadzone','Joystick dead zone',.08,.32,.02]]){
   const row=document.createElement('label');row.className='fc-control-setting';const text=document.createElement('span'),value=document.createElement('output'),input=document.createElement('input');text.textContent=label;input.type='range';input.min=min;input.max=max;input.step=step;input.value=Mobile.preferences[key];input.setAttribute('aria-label',label);
   const update=()=>{value.textContent=key==='stickSize'?Math.round(input.value)+' px':key==='deadzone'?Math.round(input.value*100)+'%':Number(input.value).toFixed(1)+'×'};
   input.oninput=()=>{Mobile.setPreference(key,input.value);update()};update();row.append(text,value,input);notes.append(row);
  }
  for(const [key,label]of [['autoSprint','Sprint at joystick edge'],['haptics','Haptic feedback']]){
   const row=document.createElement('label');row.className='fc-control-toggle';const input=document.createElement('input');input.type='checkbox';input.checked=Mobile.preferences[key];input.onchange=()=>Mobile.setPreference(key,input.checked);row.append(input,document.createTextNode(label));notes.append(row);
  }
  notes.append(button('Reset controls',()=>{Mobile.resetPreferences();controls()}));
 }
 const icons={Map:'<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>',Inventory:'<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V4h6v3M4 12h16"/>',Build:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12L4 7.5M12 12v9"/>',Journal:'<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>'};
 for(const [label,target]of[['Map','Map'],['Inventory','Inventory'],['Build','Build mode'],['Journal',null]]){const b=button(label,()=>target?original(target)?.click():show('Journal'));b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[label]+'</svg><span>'+label+'</span>';quick.append(b);}
 for(const name of Object.keys(GROUPS))categories.append(button(name,()=>show(name)));
 head.querySelector('[data-sheet-close]').onclick=()=>Mobile.showKeys(false);back.onclick=()=>{show('Menu');quick.querySelector('button')?.focus()};
 let start=null;head.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;start=e.clientY;head.setPointerCapture?.(e.pointerId)});head.addEventListener('pointerup',e=>{if(start!==null&&e.clientY-start>70)Mobile.showKeys(false);start=null});head.addEventListener('pointercancel',()=>start=null);
 new MutationObserver(()=>{if(keys.classList.contains('on'))show('Menu')}).observe(keys,{attributes:true,attributeFilter:['class']});
 show('Menu');window.FCPhoneSheet.show=show;return true;
}
window.FCPhoneSheet={mount,version:'0.115.0'};
let tries=0;(function wait(){if(mount()||++tries>200)return;setTimeout(wait,150)})();
})();
