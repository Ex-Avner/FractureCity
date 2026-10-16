/* Backroom is available from the city front door and the in-game tools tray. */
(function(){
'use strict';
const entry={slug:'backroom',title:'BACKROOM',sub:'ART / MUSIC / MAKE A GAME',color:0x86e8c4};
if(!ARCADE_ROSTER.some(a=>a.slug===entry.slug))ARCADE_ROSTER.push(entry);
let returnState=null;
function open(){const menu=document.getElementById('menu-overlay');returnState={menu:!menu.classList.contains('hide'),paused:State.ui.paused};menu.classList.add('hide');State.ui.paused=true;shPlayCabinet('backroom')}
const exit=shExitCabinet;window.shExitCabinet=function(){const result=exit.apply(this,arguments);if(returnState){State.ui.paused=returnState.paused;if(returnState.menu)openMenu();else document.body.style.cursor=State.ui.paused?'auto':'none';returnState=null}return result};
const css=document.createElement('style');css.textContent='body.in-arcade #fc-tools{display:none!important}';document.head.appendChild(css);
const tray=document.querySelector('#fc-tools .tray');if(tray){const b=document.createElement('button');b.textContent='Artist studio · Backroom';b.onclick=e=>{e.stopPropagation();FCQuietUI.menu.open=false;setTimeout(open,0)};tray.appendChild(b)}
window.FCBackroom={open};
})();
