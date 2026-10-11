/* Backroom is available from the city front door and the in-game tools tray. */
(function(){
'use strict';
const entry={slug:'backroom',title:'BACKROOM',sub:'ART / MUSIC / MAKE A GAME',color:0x86e8c4};
if(!ARCADE_ROSTER.some(a=>a.slug===entry.slug))ARCADE_ROSTER.push(entry);
let returnState=null;
function open(){const menu=document.getElementById('menu-overlay');returnState={menu:!menu.classList.contains('hide'),paused:State.ui.paused};menu.classList.add('hide');State.ui.paused=true;shPlayCabinet('backroom')}
const exit=shExitCabinet;window.shExitCabinet=function(){const result=exit.apply(this,arguments);if(returnState){State.ui.paused=returnState.paused;if(returnState.menu)openMenu();else document.body.style.cursor=State.ui.paused?'auto':'none';returnState=null}return result};
const css=document.createElement('style');css.textContent='body.in-arcade #fc-tools{display:none!important}';document.head.appendChild(css);
const home=shFrontHome;window.shFrontHome=function(){const r=home.apply(this,arguments),root=document.getElementById('front-root');if(root){const b=document.createElement('button');b.className='fc-action';b.style.marginTop='12px';b.textContent='Backroom · Your artist studio';const s=document.createElement('small');s.textContent='Bring your photos and music. Build a space. Make a playable challenge.';b.appendChild(s);b.onclick=open;root.querySelector('.fc-actions')?.appendChild(b)}return r};
const tray=document.querySelector('#fc-tools .tray');if(tray){const b=document.createElement('button');b.textContent='Artist studio · Backroom';b.onclick=e=>{e.stopPropagation();FCQuietUI.menu.open=false;setTimeout(open,0)};tray.appendChild(b)}
window.FCBackroom={open};
})();
