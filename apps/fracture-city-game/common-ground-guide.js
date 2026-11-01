/* Common Ground directory. Optional walking directions use the live collision
 * field, including player edits. No teleporting, new E handlers or save state. */
(function(){'use strict';
if(typeof State==='undefined'||typeof Player==='undefined')return;
const DESTINATIONS=Object.freeze([
 {id:'read',title:'Reading garden',verb:'Read a classic',detail:'A new passage every day. A whole shelf behind it.',at:[167,1,35.6],hint:'Press E at the Reading Wall.',color:'#e4c181',number:'01'},
 {id:'listen',title:'Listening room',verb:'Find your soundtrack',detail:'Original music, played on your own radio.',at:[179,1,26.9],hint:'Press E to choose a track.',color:'#b5bddb',number:'02'},
 {id:'arcade',title:'The arcade corner',verb:'Play something',detail:'Breaking Ned — one tap, one more try.',at:[149.7,1,27.5],hint:'Press E to play Breaking Ned.',color:'#d9a17e',number:'03'},
 {id:'gallery',title:'People’s Gallery',verb:'Leave something of yours',detail:'Resident stories, photographs and songs.',at:[168,1,62.4],hint:'Approach a display and press E.',color:'#d9a17e',number:'04'},
 {id:'overlook',title:'The overlook',verb:'Take in the hall',detail:'Take the teal-lit stair to a quiet place above the hall.',at:[143,7,52],hint:'You’re here. Look out across Common Ground.',color:'#91c4c3',number:'05'},
 {id:'theory',title:'Theory library',verb:'Follow an idea',detail:'The Collapse of Meaning, chapter by chapter.',at:[155,1,26.9],hint:'Press E to open the theory library.',color:'#e4c181',number:'06'},
 {id:'garden',title:'Conservatory Garden',verb:'Walk among the blossoms',detail:'Flowering groves, a reflecting rill and an open art terrace.',at:[167,1,12],hint:'You’re here. The art terrace is beside the flowering trees.',color:'#c7b59a',number:'07'}
]);
const BOUNDS={x0:140,x1:213,z0:0,z1:68},R=.43;
let panel=null,priorPause=false,oldFocus=null,selected=null,path=[],index=0,status='',arrivalUntil=0,lastCheck=0,lastTick=0,world=null;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const here=()=>[Player.position.x,Player.position.y-Player.height,Player.position.z];
function inHall(){const p=Player.position;return !!window.OwnBlock?.ready&&OwnBlock.state.enabled&&p.x>=137&&p.x<=216&&p.z>=0&&p.z<=73&&!State.ui.inIntro;}
function blocked(){const u=State.ui;return u.paused||u.inDialogue||u.inArcade||u.inIntro||u.inInventory||u.inShiftPanel||u.inMiniGame||u.construct||u.inCar||window.CityArt?.panelOpen||window.CityBuild?.panelOpen||window.FCAccounts?.visible||window.FCNewsHub?.isOpen||window.FCCommonGround?.isOpen||window.FCReadingGarden?.isOpen||window.CitySocial?.writing||window.OwnBlock?.modal||window.NPCVoices?.open||window.FCSeam?.panel;}
function ground(x,z,y=1){
 if(x<BOUNDS.x0||x>BOUNDS.x1||z<BOUNDS.z0||z>BOUNDS.z1)return false;
 if(blockedAt(x,y+.01,z,R,Player.height))return false;
 return [[-R,-R],[-R,R],[R,-R],[R,R],[0,0]].every(([dx,dz])=>isSolid(getBlock(Math.floor(x+dx),y-1,Math.floor(z+dz))));
}
function clear(a,b){
 const y=Math.round(a[1]);if(![1,2].includes(y)||Math.abs(a[1]-y)>.2||Math.abs(b[1]-y)>.2)return false;
 const n=Math.max(1,Math.ceil(dist(a,b)/.3));for(let i=0;i<=n;i++){const t=i/n;if(!ground(a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t,y))return false;}return true;
}
function nearest(p){
 const options=[];for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++){const q=[Math.round(p[0])+dx,p[1],Math.round(p[2])+dz];if(ground(q[0],q[2],q[1])&&clear(p,q))options.push(q)}
 options.sort((a,b)=>dist(p,a)-dist(p,b));return options[0]||null;
}
function groundRoute(from,to){
 from=[from[0],Math.round(from[1]),from[2]];to=[to[0],Math.round(to[1]),to[2]];
 if(clear(from,to))return[from,to];const start=nearest(from),end=nearest(to);if(!start||!end)return null;
 const key=p=>p[0]+','+p[2],sk=key(start),ek=key(end),open=[start],cost=new Map([[sk,0]]),parents=new Map(),closed=new Set(),cache=new Map();
 let found=false;for(let runs=0;open.length&&runs<5000;runs++){
  let best=0;for(let i=1;i<open.length;i++)if(cost.get(key(open[i]))+dist(open[i],end)<cost.get(key(open[best]))+dist(open[best],end))best=i;
  const p=open.splice(best,1)[0],k=key(p);if(closed.has(k))continue;if(k===ek){found=true;break}closed.add(k);
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const q=[p[0]+dx,p[1],p[2]+dz],qk=key(q);if(closed.has(qk))continue;
   if(!cache.has(qk))cache.set(qk,ground(q[0],q[2],q[1]));if(!cache.get(qk)||!clear(p,q))continue;
   const c=cost.get(k)+Math.hypot(dx,dz);if(c<(cost.get(qk)??Infinity)){cost.set(qk,c);parents.set(qk,p);open.push(q)}
  }
 }
 if(!found)return null;const points=[end];let p=end;while(key(p)!==sk){p=parents.get(key(p));if(!p)return null;points.push(p)}points.reverse();points.unshift(from);points.push(to);
 // Remove grid zigzags only when the player's full body can follow the shortcut.
 const smooth=[points[0]];for(let i=0;i<points.length-1;){let j=points.length-1;while(j>i+1&&!clear(points[i],points[j]))j--;smooth.push(points[j]);i=j}return smooth;
}
const STAIR=Object.freeze([[142,1,29],[142,1.5,30.5],[142,2,31.5],[142,2.5,32.5],[142,3,33.5],[142,3.5,34.5],[142,4,35.5],[142,4.5,36.5],[142,5,37.5],[142,5.5,38.5],[142,6,39.5],[142,6.5,40.5],[142,7,41.5],[142,7,43.3],[144.2,7,43.3]]);
function upstairs(p){return p[1]>4.5&&p[0]>139&&p[0]<147&&p[2]>=43&&p[2]<63;}
function onStair(p){return p[0]>140.4&&p[0]<143.6&&p[2]>=29&&p[2]<43&&p[1]>1.2;}
function stairSafe(){return !STAIR.some(p=>blockedAt(p[0],Math.min(7,p[1]+.3),p[2],R,Player.height));}
function upperClear(a,b){
 const n=Math.max(1,Math.ceil(dist(a,b)/.2));for(let i=0;i<=n;i++){const t=i/n,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;if(x<140.6||x>145.4||z<42.6||z>61.4||blockedAt(x,7.01,z,R,Player.height))return false;}return true;
}
function deckRoute(from,to){
 const points=[from,[144.2,7,from[2]],[144.2,7,to[2]],to];
 return points.slice(1).every((p,i)=>upperClear(points[i],p))?points:null;
}
function route(id,from=here()){
 const d=DESTINATIONS.find(d=>d.id===id);if(!d)return null;const up=upstairs(from),stair=onStair(from),targetUp=id==='overlook',landing=STAIR[STAIR.length-1];
 if((up||stair||targetUp)&&!stairSafe())return null;
 if(up&&targetUp)return deckRoute(from,d.at);
 let prefix=[],origin=from;
 if(from[1]>1.8&&from[1]<2.3&&from[0]>=148&&from[0]<=164&&from[2]>=4&&from[2]<=22){const terrace=groundRoute(from,[155,2,21]);if(!terrace||blockedAt(155,1.01,23,R,Player.height))return null;prefix=[...terrace,[155,1,23]];origin=[155,1,23];}
 if(up){const across=deckRoute(from,landing);if(!across)return null;prefix=[...across,...STAIR.slice(0,-1).reverse()];origin=STAIR[0];}
 if(stair){const closest=STAIR.reduce((n,p,i)=>Math.abs(p[2]-from[2])<Math.abs(STAIR[n][2]-from[2])?i:n,0);
  if(targetUp){const across=deckRoute(landing,d.at);return across?[from,...STAIR.slice(closest),...across.slice(1)]:null;}
  prefix=[from,...STAIR.slice(0,closest+1).reverse()];origin=STAIR[0];
 }
 if(targetUp){const groundPath=groundRoute(origin,STAIR[0]),across=deckRoute(landing,d.at);if(!groundPath||!across)return null;return[...prefix,...groundPath,...STAIR.slice(1),...across.slice(1)]}
 const groundPath=groundRoute(origin,d.at);return groundPath?[...prefix,...groundPath]:null;
}
const css=document.createElement('style');css.textContent=`
#cg-directory-launch{position:fixed;right:20px;bottom:20px;z-index:87;border:1px solid #a49365;background:#13292bdd;color:#f0e6cc;border-radius:24px;padding:11px 18px;font:600 12px system-ui;letter-spacing:.04em;cursor:pointer;min-height:44px}
#cg-directory-launch kbd{font:11px system-ui;border:1px solid #8da39a;border-radius:4px;padding:2px 4px;margin-right:8px}
#cg-walk-guide{position:fixed;top:18px;left:18px;z-index:89;display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:10px;max-width:min(440px,calc(100vw - 36px));padding:12px 14px;background:#102426ef;color:#f1e4c7;border-left:2px solid #d4b778;font:13px/1.4 system-ui;box-shadow:0 6px 30px #0003}
#cg-walk-guide small{display:block;color:#afc3b9;font:11px/1.4 system-ui;margin-top:3px}#cg-guide-arrow{font:28px system-ui;display:block;text-align:center}#cg-walk-guide button{border:0;background:none;color:#d8cfb5;font:22px system-ui;min-width:40px;min-height:40px;cursor:pointer}body.cg-guiding #maker-goal{visibility:hidden!important}
#cg-directory{position:fixed;inset:0;z-index:145000;display:grid;place-items:center;background:#061316c9;padding:20px;font:15px/1.5 system-ui;color:#eae4ce;cursor:auto}#cg-directory .cg-directory-card{max-width:780px;width:100%;max-height:90dvh;overflow:auto;background:#11292c;border:1px solid #687970;box-shadow:0 30px 100px #0007;border-radius:18px;padding:28px;box-sizing:border-box}#cg-directory header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}#cg-directory header small{font:10px system-ui;letter-spacing:.18em;color:#bba77a}#cg-directory h2{font:36px/1.1 Georgia,serif;margin:10px 0;color:#f1e4c7}#cg-directory p{color:#aebfb7;margin:8px 0 22px}#cg-directory [data-close]{background:none;color:#c9d2c2;border:1px solid #607970;border-radius:50%;min-width:44px;height:44px;font:22px system-ui;cursor:pointer}#cg-directory .cg-directory-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}#cg-directory [data-destination]{text-align:left;display:grid;grid-template-columns:36px 1fr;gap:10px;min-height:118px;padding:18px;border:1px solid #395553;border-radius:8px;background:#183438;color:#e6dfca;font:14px/1.4 system-ui;cursor:pointer}#cg-directory [data-destination]:hover,#cg-directory [data-destination]:focus-visible{background:#234647;border-color:#bca66d;outline:2px solid #d8bf86;outline-offset:2px}#cg-directory .cg-number{font:23px Georgia,serif;color:var(--district)}#cg-directory strong{font:20px Georgia,serif;display:block;color:var(--district);margin-bottom:5px}#cg-directory .cg-detail{display:block;font-size:12px;color:#b5c8be;margin-top:7px}#cg-directory footer{font:11px/1.5 system-ui;color:#93aaa1;margin-top:20px;display:flex;justify-content:space-between;gap:12px}#cg-directory footer button{border:0;background:none;color:#e4ce9a;text-decoration:underline;cursor:pointer;font:inherit}#cg-directory [role=status]{margin:14px 0 0;color:#f2ce95;font-size:13px}
#cg-directory-launch[hidden],#cg-walk-guide[hidden]{display:none!important}
@media(max-width:650px){#cg-directory{padding:8px}#cg-directory .cg-directory-card{padding:18px;max-height:95dvh}#cg-directory h2{font-size:30px}#cg-directory .cg-directory-grid{grid-template-columns:1fr}#cg-directory [data-destination]{min-height:94px;padding:14px}#cg-directory-launch{right:12px;bottom:184px;padding:10px 14px}#cg-walk-guide{top:98px;left:12px;max-width:calc(100vw - 24px);font-size:12px;padding:8px 10px}#cg-walk-guide small{max-width:240px}#cg-directory footer{flex-direction:column}}
`;document.head.append(css);
const launch=document.createElement('button');launch.id='cg-directory-launch';launch.hidden=true;launch.innerHTML='<kbd>L</kbd> Explore Common Ground';launch.setAttribute('aria-haspopup','dialog');launch.onclick=open;document.body.append(launch);
const hud=document.createElement('aside');hud.id='cg-walk-guide';hud.hidden=true;hud.setAttribute('aria-label','Walking directions');hud.innerHTML='<span id="cg-guide-arrow" aria-hidden="true">↑</span><div><b></b><small></small></div><button aria-label="Stop walking directions">×</button>';document.body.append(hud);hud.querySelector('button').onclick=cancel;
for(const el of [launch,hud])for(const event of ['pointerdown','mousedown','click','wheel'])el.addEventListener(event,e=>e.stopPropagation());
function open(){
 if(panel||!inHall()||blocked())return false;oldFocus=document.activeElement;priorPause=State.ui.paused;State.ui.paused=true;State.keys.clear();shStopMine();document.exitPointerLock?.();document.body.style.cursor='auto';
 // Existing E listeners read their prompt visibility; hide it immediately so
 // a key pressed before their next tick cannot open a second dialog.
 document.querySelectorAll('#cg-approach,#rw-approach,#news-approach,#campus-arcade-play').forEach(el=>{el.hidden=true});
 panel=document.createElement('section');panel.id='cg-directory';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','cg-directory-title');
 panel.innerHTML='<div class="cg-directory-card"><header><div><small>COMMON GROUND / THE LANTERN HALL</small><h2 id="cg-directory-title">Find your place.</h2></div><button data-close aria-label="Close directory">×</button></header><p>Pick a first stop. There’s no required order.</p><nav class="cg-directory-grid" aria-label="Places in Common Ground">'+DESTINATIONS.map(d=>'<button data-destination="'+d.id+'" style="--district:'+d.color+'"><span class="cg-number">'+d.number+'</span><span><strong>'+d.title+'</strong>'+d.verb+'<span class="cg-detail">'+d.detail+'</span></span></button>').join('')+'</nav><div role="status"></div><footer><span>Walking directions follow the paths. E interacts when you arrive.</span><button data-cancel>Explore on my own</button></footer></div>';
 document.body.append(panel);panel.querySelector('[data-close]').onclick=close;panel.querySelector('[data-cancel]').onclick=()=>{cancel();close()};panel.querySelectorAll('[data-destination]').forEach(b=>b.onclick=()=>select(b.dataset.destination));
 for(const event of ['pointerdown','mousedown','click','wheel'])panel.addEventListener(event,e=>e.stopPropagation());panel.querySelector('[data-destination]')?.focus();return true;
}
function close(){if(!panel)return;panel.remove();panel=null;State.ui.paused=priorPause;State.keys.clear();document.body.style.cursor=priorPause?'auto':'none';launch.hidden=!(inHall()&&!blocked());oldFocus?.focus?.();}
function cancel(){selected=null;path=[];index=0;status='';arrivalUntil=0;hud.hidden=true;document.body.classList.remove('cg-guiding');}
function select(id){
 const d=DESTINATIONS.find(d=>d.id===id);if(!d||!inHall()||(!panel&&blocked()))return false;const planned=route(id);
 if(!planned){status='A clear walking route isn’t available from here. Try the main promenade.';if(panel)panel.querySelector('[role=status]').textContent=status;return false;}
 world=State.scene;selected=d;path=planned;index=Math.min(1,path.length-1);status='walking';arrivalUntil=0;lastCheck=performance.now();close();return true;
}
function remaining(){if(!path.length)return 0;let n=dist(here(),path[index]);for(let i=index+1;i<path.length;i++)n+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1],path[i][2]-path[i-1][2]);return n;}
function goal(){return selected&&inHall()&&status==='walking'&&path[index]?{p:[...path[index]],text:selected.title+' · follow the walking route'}:null;}
function update(now=performance.now()){
 if(world!==State.scene){world=State.scene;cancel();if(panel)close();}const active=inHall()&&!blocked();launch.hidden=!active;hud.hidden=!active||!selected;document.body.classList.toggle('cg-guiding',active&&!!selected);
 if(!active||!selected)return;if(status==='arrived'&&now>arrivalUntil){cancel();return;}const p=here();
 if(dist(p,selected.at)<1.35&&Math.abs(p[1]-selected.at[1])<.7){if(status!=='arrived'){status='arrived';arrivalUntil=now+9000;}hud.querySelector('b').textContent=selected.title;hud.querySelector('small').textContent=selected.hint;hud.querySelector('#cg-guide-arrow').textContent='✓';if(now>arrivalUntil)cancel();return;}
 while(index<path.length-1&&dist(p,path[index])<.75&&Math.abs(p[1]-path[index][1])<.85&&((path[index+1][1]===1&&path[index][1]===1)?(Math.abs(p[1]-1)<.2&&clear(p,path[index+1])):(path[index+1][1]===7&&p[1]>6.8&&p[2]>42.6&&path[index+1][2]>42.6)?upperClear(p,path[index+1]):true))index++;
 if(now-lastCheck>2500){lastCheck=now;const target=path[Math.min(index+(dist(p,path[index])<.75?1:0),path.length-1)],obstructed=target&&((Math.abs(p[1]-1)<.2&&target[1]===1&&!clear(p,target))||(upstairs(p)&&target[1]===7&&target[2]>=42.6&&!upperClear(p,target))||(onStair(p)&&!stairSafe()));if(status==='blocked'||obstructed){const next=route(selected.id,p);if(next){path=next;index=Math.min(1,path.length-1);status='walking'}else status='blocked';}}
 const next=path[index];if(!next)return;const dx=next[0]-p[0],dz=next[2]-p[2],angle=Math.atan2(Math.sin(Math.atan2(-dx,-dz)-Player.yaw),Math.cos(Math.atan2(-dx,-dz)-Player.yaw));
 hud.querySelector('b').textContent=selected.title+' · '+Math.round(remaining())+' m';hud.querySelector('small').textContent=status==='blocked'?'The path changed. Open L to choose another stop.':next[1]>p[1]+.5?'Take the teal-lit stair up':next[1]<p[1]-.5?(p[0]>147?'Follow the terrace steps down':'Follow the stair down'):Math.abs(angle)>2.3?'Turn around toward the path':Math.abs(angle)<.35?'Continue along the path':angle>0?'Bear left at the next turn':'Bear right at the next turn';hud.querySelector('#cg-guide-arrow').textContent=status==='blocked'?'!':Math.abs(angle)>2.3?'↓':Math.abs(angle)<.35?'↑':angle>0?'←':'→';
}
window.addEventListener('keydown',e=>{
 if(panel){if(e.code==='Escape'||e.code==='KeyL'&&!e.repeat){e.preventDefault();close()}else if(e.code==='Tab'){const nodes=[...panel.querySelectorAll('button')],i=nodes.indexOf(document.activeElement);e.preventDefault();nodes[(i+(e.shiftKey?-1:1)+nodes.length)%nodes.length]?.focus()}e.stopImmediatePropagation();return;}
 if(e.code==='KeyL'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&!e.target.isContentEditable&&inHall()&&!blocked()){e.preventDefault();e.stopImmediatePropagation();open();}
},true);
function tick(t){requestAnimationFrame(tick);if(t-lastTick<120)return;lastTick=t;update(t)}requestAnimationFrame(tick);
window.FCCommonGroundGuide={destinations:DESTINATIONS,open,close,select,cancel,route,goal,update,ground,clear,stair:STAIR,get isOpen(){return!!panel},get selection(){return selected?.id||null},get path(){return path.map(p=>[...p])},get index(){return index},get status(){return status}};
})();
