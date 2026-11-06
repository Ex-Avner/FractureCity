/* Small, persistent city jobs. One nearby quest actor, no per-frame network traffic. */
(function(){'use strict';
const C=FCDispatchJobs,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data=null,scope='',loading=false,busy=false,error='',panel=null,paused=false,work=null,actor=null,actorKey='',scene=null,last=0,nextLoad=0,notified='',clockAt=0,serverTime=0;
const network=()=>location.pathname.startsWith('/city/')&&new URLSearchParams(location.search).has('online');
const now=()=>network()&&serverTime?serverTime+performance.now()-clockAt:Date.now();
const progress=q=>data?.state.progress[q.id]||{step:0,done:false,started:null};
const active=()=>data?.jobs.find(q=>q.id===data.state.active);
const position=()=>({x:Player.position.x,y:Player.position.y-Player.height,z:Player.position.z});
const available=()=>!!State.chunkMap.size&&!State.ui.inIntro&&!State.ui.inDialogue&&!State.ui.inMiniGame&&!State.ui.inArcade&&!State.ui.inShiftPanel&&!State.ui.inInventory&&!State.ui.construct&&!window.FN?.prologue;
function ingest(out){data=out;serverTime=out.time;clockAt=performance.now();if(out.wallet)window.FCInv?.ingestWallet(out.wallet);}
function saveLocal(){try{localStorage.setItem(scope,JSON.stringify(data.state));return true;}catch{error='Device storage is full. Keep this city open and free some space before continuing.';return false;}}
async function load(){
 if(loading||!scope||network()&&!window.FCCityOnline?.connected)return;
 loading=true;const expected=scope;try{if(network()){const out=await FCCityOnline.read('city-dispatch');if(scope!==expected)return;ingest(out);}else{let state={active:null,progress:{},completed:0};try{state=JSON.parse(localStorage.getItem(scope)||'null')||state;}catch{}const jobs=C.jobs(now());for(const id of Object.keys(state.progress))if(id.includes(':')&&!id.startsWith(C.day(now())+':'))delete state.progress[id];if(!jobs.some(q=>q.id===state.active))state.active=null;data={day:C.day(now()),jobs,state,time:now()};}error='';nextLoad=performance.now()+30000;render();}catch(e){error=e.message;nextLoad=performance.now()+10000;render();}finally{loading=false;}
}
async function send(action,q){
 if(network()){const expected=scope;if(!FCCityOnline.connected)throw Error('Reconnect before continuing this job.');const out=await FCCityOnline.request('city-dispatch',{action,id:q.id,step:progress(q).step});if(scope!==expected)throw Error('City changed. Open your dispatch again.');ingest(out);return;}
 const v=progress(q);if(v.done)throw Error('This job is complete.');
 if(action==='track')data.state.active=q.id;
 else {if(data.state.active!==q.id||!C.near(position(),q.steps[v.step]))throw Error('Walk to the marked resident first.');if(action==='begin')v.started=now();else{if(v.started===null||now()-v.started<q.steps[v.step].seconds*1000)throw Error('The task is still underway.');v.step++;v.started=null;v.done=v.step===q.steps.length;if(v.done){data.state.completed++;data.state.active=null;}}}
 data.state.progress[q.id]=v;if(!saveLocal())throw Error(error);
 if(action==='finish'&&v.done){grantCredits(q.reward);if(Slots.activeId)shCampaignCheckpoint().catch(()=>toast('Save your game before leaving to keep your credits.','warn'));}
}
async function track(id){if(busy)return;const q=data?.jobs.find(q=>q.id===id);if(!q)return;busy=true;try{work=null;await send('track',q);error='';close();directions();}catch(e){error=e.message;}finally{busy=false;render();}}
function directions(){const q=active();if(!q)return;const step=q.steps[progress(q).step];close();FCCommonGroundGuide.cancel();if(!FCCommonGroundGuide.select(C.places[step.place].guide))toast('Head to '+C.places[step.place].name+' in Common Ground.','info');}
async function begin(){const q=active();if(!q||busy||work)return;const step=q.steps[progress(q).step];busy=true;try{close();await send('begin',q);work={id:q.id,step:progress(q).step,until:now()+step.seconds*1000};toast(q.who+': '+step.line,'info');}catch(e){error=e.message;toast(error,'warn');}finally{busy=false;}}
async function finish(){const w=work,q=active();if(!w||!q||busy)return;busy=true;work=null;const step=q.steps[w.step];try{await send('finish',q);error='';toast(progress(q).done?q.title+' complete · +'+q.reward+' credits':step.reply,'success');FCCommonGroundGuide.cancel();if(active())directions();}catch(e){error=e.message;toast(error,'warn');}finally{busy=false;render();}}
function close(){if(!panel)return;panel.remove();panel=null;State.ui.paused=paused;State.keys.clear();document.body.classList.remove('dispatch-reading');document.body.style.cursor=paused?'auto':'none';}
function open(){if(!available()){toast('City Dispatch opens when you are back on the street.','info');return;}if(panel)return;window.Mobile?.showKeys(false);window.FCQuietUI?.close();work=null;paused=State.ui.paused;State.ui.paused=true;State.keys.clear();shTouchReleaseAll();document.exitPointerLock?.();document.body.classList.add('dispatch-reading');panel=document.createElement('section');panel.id='city-dispatch';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','City Dispatch');document.body.append(panel);for(const t of ['pointerdown','mousedown','click','wheel'])panel.addEventListener(t,e=>e.stopPropagation());render();load();}
function render(){if(!panel)return;const scroll=panel.scrollTop,ev=window.FCStreetEvents?.current;
 const card=q=>{const p=progress(q),step=q.steps[p.step];return `<article class="dispatch-job ${data.state.active===q.id?'tracked':''}"><small>${esc(q.who)} · ${q.reward} credits</small><h3>${esc(q.title)}</h3><p>${esc(p.done?q.outro:q.intro)}</p><div class="dispatch-meta"><span>${p.done?'✓ Completed':`${p.step} / ${q.steps.length} objectives`}</span><span>${q.daily?'TODAY ONLY':'NEIGHBORHOOD STORY'}</span></div>${p.done?'':`<p><b>Next:</b> ${esc(step.verb)} · ${esc(C.places[step.place].name)}</p><button data-track="${esc(q.id)}">${data.state.active===q.id?'Continue this job':'Track this job'}</button>`}</article>`};
 panel.innerHTML=`<div class="dispatch-sheet"><header><div><small>FRACTURE CITY / RESIDENT DISPATCH</small><h2>The city needs you.</h2></div><button data-close>Back to city</button></header><p>Small acts. Familiar faces. A place that changes because you showed up.</p>${error?'<p role="alert">'+esc(error)+'</p>':''}${data?`<div class="dispatch-summary"><b>${data.state.completed} ${data.state.completed===1?'job':'jobs'} completed</b><span>Daily reset · 00:00 UTC</span></div><h3>Today’s three jobs</h3><p>Choose a job, follow the route, then help the resident at the marked stop. Each job pays once.</p><div class="dispatch-grid">${data.jobs.filter(q=>q.daily).map(card).join('')}</div><h3>People worth knowing</h3><div class="dispatch-grid">${data.jobs.filter(q=>!q.daily).map(card).join('')}</div>`:'<p role="status">Loading your dispatch…</p>'}<section class="dispatch-event"><small>ON THE STREET</small><h3>${ev?esc(ev.kind==='flashmob'?'A spontaneous dance gathering':ev.kind==='busker'?'A street performance':ev.kind==='market'?'A pop-up market':ev.kind==='parade'?'A neighbourhood procession':ev.kind==='rally'?'A street speaker':'A street dispute'):'Something is about to happen.'}</h3><p>${ev?ev.people+' residents nearby · '+Math.ceil(ev.left)+' seconds remaining.':'Performers, vendors and neighbours gather on nearby open ground. Look around as you explore.'}</p><button data-event>Back to the street</button><button data-stories>More neighborhood stories</button></section><footer>${network()?'Progress and rewards are saved to your account.':'Solo progress stays on this device for this world. Save your game to keep your wallet.'}</footer></div>`;
 panel.querySelector('[data-close]').onclick=close;panel.querySelector('[data-event]').onclick=close;panel.querySelector('[data-stories]').onclick=()=>{close();FCSideQuests.board();};panel.querySelectorAll('[data-track]').forEach(b=>{b.disabled=busy;b.onclick=()=>track(b.dataset.track);});panel.scrollTop=scroll;if(!panel.contains(document.activeElement))panel.querySelector('[data-close]').focus();
}
const hud=document.createElement('button');hud.id='dispatch-goal';hud.hidden=true;hud.onclick=()=>{const q=active();if(q&&C.near(position(),q.steps[progress(q).step]))begin();else open();};document.body.append(hud);for(const t of ['pointerdown','mousedown','click'])hud.addEventListener(t,e=>e.stopPropagation());
function clearActor(){if(actor)FCNpcs.dispose(actor);actor=null;actorKey='';}
function showActor(q,step,t){
 const at=C.places[step.place].at,d=Math.hypot(Player.position.x-at[0],Player.position.z-at[2]);
 if(d>65){clearActor();return;}
 const key=scope+q.id+step.place;
 if(actorKey!==key){clearActor();const spot=shFindOpenSpot(at[0]+1,at[2],.35,1.8,4);if(!spot)return;const story=FCNpcBrain.story('fixer',q.who);story.name=q.who.split(' · ')[0];actor=FCNpcs.body(FCWardrobe.crowdLook(null,new RNG('dispatch:'+q.who),['work','office']),story.name,'wanderer',story,'dispatch:'+q.id);actor.group.position.set(spot.x,spot.y,spot.z);State.scene.add(actor.group);FCNpcs.bubble(actor,step.verb);actorKey=key;}
 actor.char.group.rotation.y=Math.atan2(Player.position.x-actor.group.position.x,Player.position.z-actor.group.position.z);shAnimateCharacter(actor.char,.15,false,t/1000);FCNpcs.pose(actor,work?'work':'idle',t/1000,.15,false);if(actor.bubble)actor.bubble.visible=d<18;
}
function tick(t){requestAnimationFrame(tick);if(t-last<150)return;last=t;
 const target=network()?'online:'+window.FCAccounts?.user?.id:'fc-dispatch-solo:'+State.citySeed;
 if(scope!==target||scene!==State.scene){scope=target;scene=State.scene;data=null;work=null;clearActor();close();nextLoad=0;}
 if(!data&&t>=nextLoad&&available())load();
 if(data&&data.day!==C.day(now())&&!busy){data=null;work=null;clearActor();load();}
 const q=active(),visible=!!q&&available()&&!State.ui.paused&&!FCWorldStudio.openNow;
 hud.hidden=!visible;document.body.classList.toggle('dispatch-tracking',visible);
 if(work&&(!available()||State.ui.paused)){work=null;toast('Task paused. Return to the resident and start again.','info');}
 if(!available()){if(actor)actor.group.visible=false;return;}
 if(!notified&&data&&!State.ui.paused){notified=scope;toast('City Dispatch is open · quests and three daily jobs in Tools or the mobile menu.','info');}
 if(!q){clearActor();return;}
 const step=q.steps[progress(q).step];if(!step)return;
 if(actor)actor.group.visible=!State.ui.paused; if(!State.ui.paused)showActor(q,step,t);
 const near=C.near(position(),step),place=C.places[step.place],distance=Math.round(Math.hypot(Player.position.x-place.at[0],Player.position.z-place.at[2]));
 if(work&&(!near||!visible)){work=null;toast('Task paused. Return to the resident and start again.','info');}
 if(work&&now()>=work.until)finish();
 const route=FCCommonGroundGuide.selection===place.guide?document.querySelector('#cg-walk-guide small')?.textContent:'';
 hud.innerHTML=`<strong>${esc(q.title)} · ${progress(q).step+1}/${q.steps.length}</strong><span>${work?'Helping… '+Math.max(0,Math.ceil((work.until-now())/1000))+'s':near?'Tap to '+esc(step.verb.toLowerCase()):esc(step.verb)+' · '+distance+' m'}</span><small>${esc(near?q.who:route||place.name+' · tap for the job board')}</small>`;
}
const css=document.createElement('style');css.textContent=`
#city-dispatch{position:fixed;inset:0;z-index:130000;overflow:auto;background:#08191bee;color:#edf0df;font:14px/1.6 system-ui;padding:24px;box-sizing:border-box}
#city-dispatch .dispatch-sheet{max-width:1000px;margin:auto;padding:28px;background:#142e30;border:1px solid #6d8c7d;border-radius:20px}#city-dispatch header{display:flex;gap:20px;align-items:center;justify-content:space-between}#city-dispatch h2{font:36px Georgia;margin:8px 0;color:#f3dfb6}#city-dispatch h3{font:23px Georgia;color:#ead5ab;margin:24px 0 12px}#city-dispatch .dispatch-job h3{margin:8px 0 12px}#city-dispatch p,#city-dispatch footer{color:#b7ccc2}#city-dispatch small{color:#d0b77e;font-size:11px;letter-spacing:.07em}#city-dispatch button{min-height:44px;border:1px solid #819e8c;border-radius:9px;padding:10px 14px;font:inherit;background:#294c43;color:#f3eedb;cursor:pointer}#city-dispatch button:focus-visible{outline:3px solid #f3ce7e}#city-dispatch .dispatch-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.dispatch-job{padding:18px;border:1px solid #45675c;border-radius:12px;background:#193737}.dispatch-job.tracked{border-color:#edc779}.dispatch-meta,.dispatch-summary{display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;font-size:11px}.dispatch-summary{padding:18px;background:#294238;border-radius:10px}.dispatch-event{margin:26px 0;padding-top:12px;border-top:1px solid #587367}
#dispatch-goal{position:fixed;top:18px;left:18px;width:320px;max-width:55vw;z-index:96;padding:10px 14px;text-align:left;border:1px solid #c6b780;border-left:3px solid #e4c281;border-radius:9px;background:#123031ee;color:#efe6ca;font:12px/1.5 system-ui;cursor:pointer}#dispatch-goal strong,#dispatch-goal span,#dispatch-goal small{display:block}#dispatch-goal small{color:#b8d1c4}#dispatch-goal[hidden]{display:none}
body.dispatch-tracking #maker-goal,body.dispatch-tracking #fc-story-goal,body.dispatch-tracking #cg-walk-guide,body.dispatch-tracking #campaign-hud{visibility:hidden!important}body.dispatch-reading,body.dispatch-reading *{cursor:auto!important}body.dispatch-reading #touch-layer,body.dispatch-reading #dispatch-goal{visibility:hidden!important}
@media(max-width:700px){#city-dispatch{padding:8px}#city-dispatch .dispatch-sheet{padding:16px}#city-dispatch .dispatch-grid{grid-template-columns:1fr}#city-dispatch h2{font-size:28px}#city-dispatch header{align-items:flex-start}#city-dispatch header button{flex-shrink:0}}
body.touch #dispatch-goal strong,body.touch #dispatch-goal span,body.touch #dispatch-goal small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}body.touch #dispatch-goal{line-height:1.3;top:68px;left:12px;width:calc(100vw - 136px);max-width:400px;font-size:11px;padding:8px;box-sizing:border-box} @media(orientation:landscape){body.touch #dispatch-goal{top:12px;left:190px;width:calc(100vw - 310px);max-width:400px}}
`;document.head.append(css);
window.addEventListener('keydown',e=>{if(!panel)return;if(e.code==='Escape'){e.preventDefault();close();}else if(e.code==='Tab'){const nodes=[...panel.querySelectorAll('button:not(:disabled)')],i=nodes.indexOf(document.activeElement);e.preventDefault();nodes[(i+(e.shiftKey?-1:1)+nodes.length)%nodes.length]?.focus();}e.stopImmediatePropagation();},true);
window.FCCityDispatch={open,close,load,track,begin,directions,get data(){return data},get working(){return !!work},get actor(){return actor}};
requestAnimationFrame(tick);
})();
