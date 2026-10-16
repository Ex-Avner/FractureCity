/* The correction: a clear bulletin, a quiet street, five civic disasters. */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S=window.FCStory={version:'0.42.0',log:[],boss:null};
const episodes=[
 {title:'PARKING ENFORCEMENT HAS LEGS',cause:'The Bureau’s privatized broadcast has declared residents vehicles. The Meter Maid is collecting them. Cut the traffic relay before the next repossession bulletin.',goal:'Restore Rook’s breakers, defend the relay, defeat the Meter Maid.',result:'Traffic clocks are running. The test is still spreading through the South Signal mast.',boss:'THE METER MAID',quote:'Your feet have exceeded the maximum stay.',color:0xffca66,pattern:'disk',radius:3.5,wind:1.7,interval:7,damage:16,hp:210},
 {title:'A WORD FROM OUR HOSTAGE',cause:'The signal mast is repeating advertisements as emergency instructions. Inez can isolate the clean carrier. The sponsor would prefer you remained captive.',goal:'Tune 89.7, protect Inez, cancel the Sponsored Forecast.',result:'The adverts are off the emergency band. Leon has found a recording of the original test.',boss:'THE SPONSORED FORECAST',quote:'This severe weather event contains paid promotion.',color:0x77deff,pattern:'disk',radius:4.5,wind:2,interval:6,damage:19,hp:240},
 {title:'YOUR MEMORY IS IN ANOTHER QUEUE',cause:'The archive has no power. Without its recording, the Bureau can blame the residents. Leon has a battery; the collections department has objections.',goal:'Deliver Leon’s battery, defend the archive, stop the Debt Collector.',result:'The recording proves the Bureau uploaded the test at 17:58. Take that evidence to Daniel.',boss:'THE DEBT COLLECTOR',quote:'Your outstanding balance is now physically outstanding.',color:0xff9393,pattern:'ring',radius:5,wind:1.8,interval:7,damage:21,hp:270},
 {title:'THE FORM THAT BITES BACK',cause:'Daniel can authorize a correction if you recover the signed broadcast order. The Bureau has sent a supervisor to ensure the truth remains unfiled.',goal:'Recover the order, file the real cause, defeat the Acting Deputy Deputy.',result:'Daniel has authorized the correction. Reach the transmitter and put the original recording on air.',boss:'ACTING DEPUTY DEPUTY',quote:'To appeal this attack, please survive it in triplicate.',color:0xd6b0ff,pattern:'cross',radius:6,wind:2,interval:6,damage:22,hp:300},
 {title:'AND NOW, THE CORRECTION',cause:'Ned can broadcast the evidence, but three transmitter feeds are failing. The Bureau’s final response is a walking emergency statement.',goal:'Reroute all three feeds, defend the broadcast, defeat the Official Denial.',result:'The evidence is on air. The Bureau’s test is stopped. The city can finally argue about what actually happened.',boss:'THE OFFICIAL DENIAL',quote:'There is no giant problem. Please ignore my giant problem shoes.',color:0xff638c,pattern:'ring',radius:6,wind:1.6,interval:5,damage:24,hp:340}
];
S.episodes=episodes;
for(let i=0;i<Outbreak.chapters.length;i++){
 const ch=Outbreak.chapters[i],ep=episodes[i];ch.title=ep.title;ch.open=ep.cause;ch.close=ep.result;
 ch.intro=[{who:'ned',text:ep.cause},{who:ch.station.who,text:ep.goal}];
 ch.outro=[{who:'ned',text:ep.result}];
 const reach=ch.objectives.find(o=>o.kind==='reach'),fix=ch.objectives.find(o=>o.kind==='station'),kill=ch.objectives.find(o=>o.kind==='kill');
 kill.text='Clear the Turned and defeat '+ep.boss;
 ch.beats={[reach.id]:[{who:ch.station.who,text:FCPolish.jobs[i].text+'. Follow the gold marker; I will handle the network.'}],[fix.id]:[{who:'ned',text:'System restored. Clear any remaining threats before we move on.'}]};
 ch.quips=[ep.quote];
}
const last=Outbreak.chapters.at(-1);last.ending={title:'THE CORRECTION',body:'Ned broadcasts the original order: the Bureau’s “harmless” test caused the outbreak. Five systems are back online. The residents have their city back, and Daniel has a very large complaint to file. Stay out, visit the arcade, or help the neighbors finish their night.'};
window.shCampaignIntro=ch=>ch.intro||[];
window.shTransScript=()=>[
 {who:'sys',text:'FCN LIVE · THE SIX O’CLOCK INCIDENT'},
 {who:'ned',text:'City Hall has sold the emergency broadcast system to a parking company. The mayor says this will improve emergencies.'},
 {who:'ned',text:'Unpaid residents are now vehicles. Begin collection. Wait. That was an instruction?'},
 {who:'sys',text:'BUREAU TEST · 17:58 · CITY NETWORK OVERRIDE',flash:true},
 {who:'ned',text:'The test is spreading. Find Rook at the relay. Stop this signal before the next bulletin.',direct:true}
];
// Routine speech never queues behind gameplay. Briefings keep one short card;
// completion callbacks settle immediately so objectives cannot wait for reading.
function remember(lines){for(const l of lines){const row={who:l.speaker?.name||SPEAKERS[l.who]?.name||'NED',text:String(l.text||'')};if(!row.text||S.log.at(-1)?.text===row.text)continue;S.log.push(row)}if(S.log.length>60)S.log.splice(0,S.log.length-60)}
const narrate=shNarrate;
window.shNarrate=function(lines,done){
 if(FN.prologue)return;
 const list=(Array.isArray(lines)?lines:[lines]).map(l=>typeof l==='string'?{who:'ned',text:l}:l).filter(Boolean);
 remember(list);
 if(typeof done==='function'){
  // Replacing a caption never leaves an old callback waiting in Narr.
  Narr.active=false;Narr.queue=[];Narr.pending=[];Narr.done=null;
  if(list.length)narrate([list.at(-1)]);
  if(Narr.line){Narr.chars=Narr.line.text.length;Narr.el.querySelector('#narr-text').textContent=Narr.line.text;Narr.hold=7;Narr.el.querySelector('#narr-more').textContent='Dismiss · N';}
  done();
 }
};
let requestedTalkAt=-Infinity;
document.addEventListener('keydown',e=>{if(e.code==='KeyE'&&!e.repeat&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))requestedTalkAt=performance.now()},true);
window.shSay=function(lines,done){if(FN.prologue)return;const explicit=performance.now()-requestedTalkAt<600;return shNarrate(lines,done||(explicit?()=>{}:undefined))};
const tickNarr=shNarrTick;
window.shNarrTick=function(dt){tickNarr.apply(this,arguments);if(Narr.active&&!State.ui.paused&&!State.ui.inDialogue){Narr.hold=(Number.isFinite(Narr.hold)?Narr.hold:7)-Math.min(.1,dt||0);if(Narr.hold<=0)shNarrNext()}};
const casebook=shCampaignCasebook;
window.shCampaignCasebook=function(){return casebook.apply(this,arguments)+'<details class="fc-transcript"><summary>Recent radio messages ('+S.log.length+')</summary>'+S.log.map(l=>'<p><strong>'+esc(l.who)+'</strong> '+esc(l.text)+'</p>').join('')+'</details>'};
// Clear the session transcript when switching cities, never copy another save's dialogue.
const fresh=newGame;window.newGame=function(){S.log=[];clearBoss();return fresh.apply(this,arguments)};
const restore=shSlotRestore;window.shSlotRestore=async function(){S.log=[];clearBoss();return restore.apply(this,arguments)};
// The last member of each existing wave is the boss. It counts toward the same
// saved kill goal, so restoring a finished chapter never adds another fight.
function clearBoss(){if(S.boss?.ring){S.boss.ring.removeFromParent();S.boss.ring.geometry.dispose();S.boss.ring.material.dispose()}S.boss=null;}
S.makeBoss=function(e,st){
 clearBoss();const ep=episodes[Outbreak.chapters.indexOf(st.ch)];if(!ep)return;
 e.hp=e.maxHp=ep.hp;e.def={...e.def,name:ep.boss,speed:Math.min(e.def.speed||2,2.4),dmg:12};
 e.group.scale.multiplyScalar(1.25);e.fcBoss={ep,cool:3,wind:0,vulnerable:0,target:null};
 // Recognizable oversized civic props, rather than another unmarked zombie.
 const prop=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:ep.color,metalness:.45,roughness:.45});
 const sign=new THREE.Mesh(new THREE.BoxGeometry(1.05,.7,.16),mat);sign.position.y=2.15;prop.add(sign);
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#111827';c.fillRect(0,0,256,128);c.fillStyle='#fff';c.font='bold 38px sans-serif';c.textAlign='center';c.fillText(['PAY UP','AD BREAK','PAST DUE','DENIED','NO ISSUE'][Campaign.chapter],128,80);const tex=new THREE.CanvasTexture(canvas),label=new THREE.Mesh(new THREE.PlaneGeometry(.97,.48),new THREE.MeshBasicMaterial({map:tex}));label.position.set(0,2.15,.09);prop.add(label);e.group.add(prop);
 let zone=new THREE.RingGeometry(ep.pattern==='ring'?2:0.15,ep.radius,48);
 if(ep.pattern==='cross'){const r=ep.radius,shape=new THREE.Shape();[[-1,-r],[1,-r],[1,-1],[r,-1],[r,1],[1,1],[1,r],[-1,r],[-1,1],[-r,1],[-r,-1],[-1,-1]].forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();zone.dispose();zone=new THREE.ShapeGeometry(shape);}
 const ring=new THREE.Mesh(zone,new THREE.MeshBasicMaterial({color:ep.color,transparent:true,opacity:.32,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.visible=false;State.scene.add(ring);S.boss={enemy:e,ring,st,prop};
 remember([{who:'ned',text:ep.boss+': '+ep.quote}]);
};
S.inZone=function(ep,dx,dz){const d=Math.hypot(dx,dz);return ep.pattern==='ring'?d>=2&&d<ep.radius:ep.pattern==='cross'?Math.abs(dx)<ep.radius&&Math.abs(dz)<ep.radius&&(Math.abs(dx)<1||Math.abs(dz)<1):d<ep.radius};
const updateEnemy=Enemy.prototype.update;
S.tickBoss=function(dt){
 const b=this.fcBoss;if(!b||this.hp<=0||this.state==='dead'||State.ui.paused||State.ui.inDialogue)return;
 const step=Math.min(.1,dt||0),ep=b.ep;b.vulnerable=Math.max(0,b.vulnerable-step);
 if(b.wind>0){b.wind-=step;if(b.wind<=0){const dx=Player.position.x-b.target.x,dz=Player.position.z-b.target.z;
  if(S.inZone(ep,dx,dz)&&shLineOfSight(this.position.x,this.position.y+1.3,this.position.z,Player.position.x,Player.position.y-.2,Player.position.z))damagePlayer(ep.damage);
  if(S.boss?.enemy===this)S.boss.ring.visible=false;b.vulnerable=2.5;b.cool=ep.interval;
 }}else if((b.cool-=step)<=0&&this.position.distanceTo(Player.position)<22){
  b.target=ep.pattern==='disk'?{x:Player.position.x,z:Player.position.z}:{x:this.position.x,z:this.position.z};b.wind=ep.wind;
  if(S.boss?.enemy===this){const ring=S.boss.ring;ring.position.set(b.target.x,shSurfaceY(b.target.x,b.target.z)+.08,b.target.z);ring.visible=true;

  }
 }
 return;
};
Enemy.prototype.update=function(dt){const r=updateEnemy.apply(this,arguments);S.tickBoss.call(this,dt);return r};
const take=Enemy.prototype.takeDamage;
Enemy.prototype.takeDamage=function(amount,head){return take.call(this,this.fcBoss?.vulnerable>0?amount*1.65:amount,head)};
const die=Enemy.prototype.die;
Enemy.prototype.die=function(){const b=this.fcBoss,r=die.apply(this,arguments);if(b){remember([{who:'ned',text:b.ep.boss+' defeated. '+b.ep.result}]);if(S.boss?.enemy===this)clearBoss()}return r};
// Four optional absurd errands use the existing saved quest/choice/reward flow.
const extras=[
 ['shoe-tax','The Pedestrian Subscription','Mara',90,[8,20],[-24,12],'A meter charged me for standing still. It offers a premium tier for moving.','Collect the meter’s cancellation code','The receipt says WALKING: FREE. It has been stamped CONFIDENTIAL.','Cancel everyone’s subscription.','Refund the shelter queue first.','The meter issues an apology. It tries to charge for the envelope.'],
 ['rain-check','Rain, Now With Ads','Inez',100,[20,-12],[36,-16],'The rain advert is louder than the rain. The sponsor sells umbrellas with holes for brand visibility.','Disconnect the rooftop advert relay','The relay is labelled: WEATHER MAY CONTAIN WEATHER.','Give the channel to emergency calls.','Play a minute of beautiful silence.','The next forecast is just weather. The city applauds quietly.'],
 ['soup-status','Soup Pending Approval','Clara',95,[-20,12],[-32,24],'The Bureau classified my soup as a public swimming pool. They want a lifeguard.','Recover the kitchen inspection stamp','The stamp says NOT DEEP ENOUGH TO DROWN IN. It is sticky.','Declare it dinner.','Appoint the ladle lifeguard.','The soup is served. The ladle receives a tiny pension.'],
 ['mayoral-bin','His Worship, the Bin','Daniel',110,[-16,-20],[24,24],'A ballot scanner elected a litter bin. Its approval rating is inconveniently high.','Find the original ballot receipt','The winning platform: a lid that closes, and no speeches.','Demand a human recount.','Let the bin finish its night shift.','The bin declines an interview. Its silence is widely praised.']
];
for(const [id,title,who,reward,a,b,intro,verb,evidence,c1,c2,end] of extras)FCDispatchContent.quests.push({id,title,who,reward,intro:[intro],steps:[{at:a,verb:'Talk to '+who,lines:[intro],choices:['I will look into it.','How did this become my evening?'],reply:['Start at the gold marker. Bring back the record.','You made eye contact. That counts as volunteering here.']},{at:b,verb,lines:[evidence]},{at:a,verb:'Return to '+who,lines:[who+': What goes in the correction?'],choices:[c1,c2],reply:[end,end+' Your decision is entered in the record.']}]});
const css=document.createElement('style');css.textContent=`
#narr{left:50%!important;right:auto!important;bottom:28px!important;transform:translateX(-50%);width:min(520px,calc(100vw - 32px))!important;max-width:none!important;padding:10px 14px!important;grid-template-columns:1fr auto!important;background:#09131ee8!important;border-radius:8px;pointer-events:none!important}
#narr-portrait,#narr-who i{display:none!important}#narr-text{font:13px/1.5 system-ui!important}#narr-more{pointer-events:auto}#narr-who{margin-bottom:3px!important}
#ob-ned{display:none!important}body.fc-compact #campaign-hud,body.fc-compact #ob-hud,body.fc-compact #fc-field:not(:has(progress)){display:none!important}
#fc-story-goal{position:fixed;top:74px;left:18px;max-width:min(330px,calc(100vw - 36px));z-index:58;background:#0a1520dc;border-left:2px solid #6de4d0;padding:9px 12px;color:#e8eef1;font:12px/1.5 system-ui;pointer-events:none}#fc-story-goal small{display:block;color:#71d9ca;font:10px/1.5 monospace;letter-spacing:1px}#fc-story-goal:empty{display:none}
#fc-boss{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:60;width:min(380px,65vw);text-align:center;color:#ffe0be;background:#10141ded;padding:8px 12px;font:12px/1.5 system-ui;pointer-events:none}#fc-boss:empty{display:none}#fc-boss progress{display:block;width:100%;height:6px;accent-color:#ff7892}#fc-boss small{display:block;color:#bceadf}
body.fn-prologue #fc-story-goal,body.fn-prologue #fc-boss{display:none}#fn-scene .scene-box{margin-bottom:4vh!important;padding:16px 20px!important}#fn-scene .line{font:18px/1.5 system-ui!important}#fn-scene .next{display:none}#fn-scene button{animation:none!important}
@media(pointer:coarse){#narr{bottom:145px!important;max-width:65vw!important}#fc-story-goal{top:48px;max-width:45vw;font-size:11px}#fc-boss{top:8px;left:auto;right:8px;transform:none;width:40vw}#fn-scene .scene-box{max-height:65dvh;overflow:auto}#front-root .fc-action{padding:12px 16px}#menu-overlay .title{font-size:42px!important}}
@media(prefers-reduced-motion:reduce){#front-root .fc-action{transition:none}}
`;document.head.appendChild(css);
function ui(id){let e=document.getElementById(id);if(!e){e=document.createElement('div');e.id=id;document.body.appendChild(e)}return e}
setInterval(()=>{
 if(S.boss&&(S.boss.st!==Outbreak.st||!State.enemies.includes(S.boss.enemy)))clearBoss();
 const playing=State.citySeed&&!State.ui.paused&&!State.ui.inIntro&&!State.ui.inDialogue&&!State.ui.inMiniGame&&!FN.prologue;
 const ch=Campaign.active&&!Campaign.finished&&shChapter(),goal=ui('fc-story-goal'),o=ch&&shNextObjective(),target=o&&shCampaignTarget(o),ep=episodes[Campaign.chapter];
 goal.innerHTML=playing&&ch&&FCQuietUI.compact?'<small>THE CORRECTION · '+(Campaign.chapter+1)+' / 5</small>'+esc(target?.label||o?.text||ep?.goal||'') :'';
 const b=S.boss?.enemy,boss=ui('fc-boss');boss.innerHTML=playing&&b?esc(b.fcBoss.ep.boss)+'<progress max="'+b.maxHp+'" value="'+b.hp+'"></progress><small>'+esc(b.fcBoss.wind>0?(b.fcBoss.ep.pattern==='ring'?'Get inside the clear center or outside the ring!':b.fcBoss.ep.pattern==='cross'?'Move diagonally away from the stamped cross!':'Leave the lit circle!'):b.fcBoss.vulnerable>0?'Overruled! Attacks deal bonus damage.':b.fcBoss.ep.quote)+'</small>':'';
},150);
})();
