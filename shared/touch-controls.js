/* Shared multi-touch controls for the browser arcade. */
(function(){
'use strict';
const active=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
window.PalmTouch={active};if(!active)return;
const slug=document.currentScript.dataset.game;
const racer=slug==='palm-drive',platform=slug==='coherence-game';
let viewport=document.querySelector('meta[name="viewport"]');if(!viewport){viewport=document.createElement('meta');viewport.name='viewport';document.head.appendChild(viewport)}viewport.content='width=device-width,initial-scale=1,viewport-fit=cover';
document.documentElement.classList.add('palm-touch');
addEventListener('DOMContentLoaded',()=>{
const css=document.createElement('style');css.textContent=`
.palm-touch body{touch-action:manipulation}.palm-touch canvas{touch-action:none}
#pt-pad{position:fixed;inset:0;z-index:90;pointer-events:none;font:12px system-ui;user-select:none;-webkit-user-select:none}
#pt-pad button{pointer-events:auto;touch-action:none;background:#14212cda;color:#eff6f7;border:1px solid #8293a0aa;border-radius:12px;min-width:48px;height:46px;font:600 12px system-ui;padding:6px}
#pt-pad.menu .move,#pt-pad.menu .actions,#pt-pad.menu .note,#pt-pad.menu [data-key="Escape"],#pt-pad.menu [data-key="KeyP"]{display:none}
.palm-touch #title.overlay{overflow-y:auto;justify-content:flex-start;padding:20px;gap:8px}.palm-touch #title.overlay>*{flex-shrink:0}.palm-touch #title.overlay h1{font-size:40px;margin:10px}.palm-touch #title.overlay h2,.palm-touch #title.overlay .lore,.palm-touch #title.overlay #diffSelect{margin-bottom:10px}.palm-touch #title.overlay .controls{display:none}
#pt-pad button.held{background:#a47b35}#pt-pad .move{position:absolute;bottom:max(12px,env(safe-area-inset-bottom));left:max(12px,env(safe-area-inset-left));display:grid;grid-template-columns:repeat(3,48px);gap:5px}
#pt-pad .actions{position:absolute;bottom:max(12px,env(safe-area-inset-bottom));right:max(12px,env(safe-area-inset-right));display:grid;grid-template-columns:repeat(3,minmax(48px,65px));gap:5px}
#pt-pad .top{position:absolute;top:max(8px,env(safe-area-inset-top));left:8px;display:flex;gap:6px}#pt-pad .note{position:absolute;top:12px;left:50%;transform:translateX(-50%);color:#fff;text-shadow:0 1px 4px #000;font-size:11px;pointer-events:none}
@media(orientation:portrait){#pt-pad .note:after{content:' · Landscape recommended'}#pt-pad .actions{grid-template-columns:repeat(3,48px)} }
`;document.head.appendChild(css);
const pad=document.createElement('div');pad.id='pt-pad';const directions=racer?[['',''],['Gas','ArrowUp'],['',''],['Left','ArrowLeft'],['Brake','ArrowDown'],['Right','ArrowRight']]:[['',''],['↑','KeyW'],['',''],['←','KeyA'],['↓','KeyS'],['→','KeyD']];
let actions=racer?[['Drift','Space'],['Nitro','ShiftLeft']]:platform?[['Jump','Space'],['Attack','KeyJ'],['Special','KeyK'],['Dodge','ShiftLeft'],['Potion','KeyQ'],['Use','KeyE']]:[['Fire','mouse'],['Jump','Space'],['Use','KeyE'],['Reload','KeyR'],['Run','ShiftLeft'],['Light','KeyF']];
if(slug==='still-human-wild')actions=[['Act','mouse'],['Jump','Space'],['Use','KeyE'],['Fight','Digit1'],['Build','Digit2'],['Sculpt','Digit3'],['Bag','Tab'],['Map','KeyM'],['Remove','mouse2']];
if(slug==='still-human')actions=actions.map(([label,key])=>[key==='KeyF'?'Save':label,key]);
if(slug==='still-human')actions.push(['Gun 1','Digit1'],['Gun 2','Digit2'],['Gun 3','Digit3']);
function buttons(xs){return xs.map(([label,key])=>key?`<button data-key="${key}" aria-label="${label}">${label}</button>`:'<span></span>').join('')}
pad.innerHTML=`<div class="top"><button data-key="${racer?'KeyP':'Escape'}">Pause / back</button><button id="pt-exit">Arcade</button></div><div class="note">${racer?'Hold gas + steer':platform?'Move + jump':'Drag the world to look'}</div><div class="move">${buttons(directions)}</div><div class="actions">${buttons(actions)}</div>`;document.body.appendChild(pad);
const held=new Map();let fireCanvas=null;
function canvas(){return [...document.querySelectorAll('canvas')].filter(c=>c.getBoundingClientRect().width>150).sort((a,b)=>b.getBoundingClientRect().width*b.getBoundingClientRect().height-a.getBoundingClientRect().width*a.getBoundingClientRect().height)[0]||document;}
function send(code,down){
if(code.startsWith('mouse')){if(down)fireCanvas=canvas();(fireCanvas||canvas()).dispatchEvent(new MouseEvent(down?'mousedown':'mouseup',{bubbles:true,button:code==='mouse2'?2:0}));return;}
const key=code==='Space'?' ':code==='ShiftLeft'?'Shift':code.startsWith('Key')?code.slice(3).toLowerCase():code.startsWith('Digit')?code.slice(5):code;
const keyCode=code==='Space'?32:code==='ShiftLeft'?16:code==='Escape'?27:code==='Tab'?9:code.startsWith('Arrow')?{ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40}[code]:key.toUpperCase().charCodeAt(0);
document.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{key,code,keyCode,which:keyCode,bubbles:true,cancelable:true}));}
function release(id){const b=held.get(id);if(!b)return;held.delete(id);if(![...held.values()].some(x=>x.dataset.key===b.dataset.key))send(b.dataset.key,false);b.classList.remove('held');}
pad.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-key]');if(!b)return;e.preventDefault();e.stopPropagation();b.setPointerCapture(e.pointerId);held.set(e.pointerId,b);b.classList.add('held');send(b.dataset.key,true);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(type,e=>{e.preventDefault();release(e.pointerId)});
function clear(){for(const id of [...held.keys()])release(id)}addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear()});
document.getElementById('pt-exit').onclick=()=>{clear();if(parent!==window)parent.postMessage({type:'shw:exit'},location.origin);else location.href='../../index.html';};
let look=null;document.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||e.target.tagName!=='CANVAS'||racer)return;e.preventDefault();look={id:e.pointerId,x:e.clientX,y:e.clientY,target:e.target};e.target.setPointerCapture(e.pointerId);});
document.addEventListener('pointermove',e=>{if(!look||look.id!==e.pointerId)return;const ev=new MouseEvent('mousemove',{bubbles:true});Object.defineProperties(ev,{movementX:{value:(e.clientX-look.x)*2},movementY:{value:(e.clientY-look.y)*2}});look.target.dispatchEvent(ev);look.x=e.clientX;look.y=e.clientY;e.preventDefault();},{passive:false});
for(const t of ['pointerup','pointercancel'])document.addEventListener(t,e=>{if(look?.id===e.pointerId)look=null});
window.PalmTouch.release=clear;
setInterval(()=>{let playing=true;try{if(racer)playing=G.running&&!G.paused;else if(platform)playing=['playing','weave','intro','prelude'].includes(phase);else if(slug==='sun-fall')playing=game.running&&!game.paused&&!game.outcome;else if(slug==='still-human')playing=Game.running&&!Game.over&&S.locked;else if(slug==='still-human-wild'){const s=SHW_WILD.dev.state;playing=s.phase==='play'&&!s.invOpen&&!s.benchOpen&&!s.mapOpen;}}catch{}pad.classList.toggle('menu',!playing);if(!playing)clear();},150);
});
})();
