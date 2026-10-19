/* One street objective, four optional first-visit milestones. No automatic modal. */
(function(){'use strict';
const css=document.createElement('style');css.textContent='body.touch .first-walk{width:94vw;font-size:clamp(16px,4vw,40px);max-height:80vh}body.touch .first-walk button{min-height:11vw}';document.head.append(css);
const fresh=()=>({met:false,listened:false,planted:false,published:false,hidden:false});
let user=null,progress=fresh(),panel=null,paused=false;
const steps=[
 ['met','Say hello to Moss','Moss keeps the corner at Common Ground. Walk over and press E, or tap the interaction prompt.',[168,1,22]],
 ['listened','Find your city soundtrack','The listening booth is beside the theory library. Choose a track; U pauses and Y skips. Your volume stays yours.',[171,1,29.5]],
 ['planted','Plant a little trouble','Follow the Seam sign east. Approach an empty raised bed and use a free wheat packet. It grows while you explore.',[249.5,2,17.5]],
 ['published','Leave something that is yours','Return to the gallery. Publish a story, photo or song on an empty display, or place your first wall in your online building plot.',[148,1,41]]
];
function save(){try{localStorage.setItem('fc-first-walk:'+user,JSON.stringify(progress))}catch{}FCResidentLife?.put('tour',progress)}
function mark(k){if(user&&!progress[k]){progress[k]=true;save()}}
function close(){if(!panel)return;panel.remove();panel=null;State.ui.paused=paused;State.keys.clear()}
function open(welcome=false){
 if(!user||window.FCResidentLife?.blocked){toast('Join the city and let your account finish loading first.','info');return}
 if(panel)return;paused=State.ui.paused;State.ui.paused=true;State.keys.clear();document.exitPointerLock?.();
 panel=document.createElement('section');panel.className='social-compose first-walk';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',welcome?'Meet Moss':'Your first ten minutes');
 panel.innerHTML=welcome?'<small>COMMON GROUND / MOSS</small><h2>You exist. That complicates the paperwork.</h2><p>“Ned called this block vacant. The rent went up during the announcement.”</p><p>“Pick a song over there. Then take a free seed to the crack in the road. If anything grows, we are calling it infrastructure.”</p><button data-follow>Sounds like a place to start</button><button data-hide>I’ll find my own way</button>':'<h2>Your first ten minutes</h2>'+steps.map(([k,title,body])=>'<p><b>'+(progress[k]?'✓ ':'')+title+'</b><br>'+body+'</p>').join('')+'<p>The library beside the booth holds The Collapse of Meaning. Read whenever you like. Nothing here has a deadline.</p><button data-follow>Follow the street guide</button><button data-hide>Explore on my own</button>';
 panel.querySelector('[data-follow]').onclick=()=>{if(welcome)progress.met=true;progress.hidden=false;save();close()};
 panel.querySelector('[data-hide]').onclick=()=>{if(welcome)progress.met=true;progress.hidden=true;save();close()};
 document.body.append(panel);panel.querySelector('button').focus();
}
addEventListener('keydown',e=>{if(!panel)return;if(e.code==='Escape'){e.preventDefault();close()}else if(e.code==='Tab'){e.preventDefault();const bs=[...panel.querySelectorAll('button')],i=bs.indexOf(document.activeElement);bs[(i+(e.shiftKey?-1:1)+bs.length)%bs.length].focus()}e.stopImmediatePropagation()},true);
setInterval(()=>{
 const tray=document.querySelector('#fc-tools .tray');if(tray&&!tray.querySelector('[data-first-walk]')){const b=document.createElement('button');b.dataset.firstWalk='1';b.textContent='Your first ten minutes';b.onclick=()=>{FCQuietUI.close();open()};tray.append(b)}
 if(!window.FCCityOnline?.ready||!FCAccounts.user||window.FCResidentLife?.blocked)return;
 if(user!==FCAccounts.user.id){user=FCAccounts.user.id;let stored={};try{stored=JSON.parse(localStorage.getItem('fc-first-walk:'+user)||'{}')}catch{}progress=FCResidentLife.get('tour',Object.assign(fresh(),stored));}
 if(window.NPCVoices?.open)mark('met');
 const p=Player.position;if(window.PalmMedia?.audio&&!PalmMedia.audio.paused&&Math.hypot(p.x-171,p.z-29.5)<9)mark('listened');
 if(window.FCSeam?.state?.plots.some(p=>p.crop)||window.FCSeam?.state?.harvests>0)mark('planted');
 if(window.CitySocial?.works.some(w=>w.artist.id===user)||window.FCStructures?.mine?.cells.length)mark('published');
},500);
window.FCOnlineTour={open,close,get progress(){return progress},meet(){if(user&&!progress.met&&!progress.hidden){open(true);return true}return false},goal(){
 if(!user||progress.hidden||!FCCityOnline?.ready)return null;
 const i=steps.findIndex(([k])=>!progress[k]);if(i<0)return null;
 let p=steps[i][3];
 if(i===2&&window.FCSeam){const bed=FCSeam.state.plots.findIndex(p=>p.open&&!p.crop);if(bed>=0)p=[FCSeam.BEDS[bed][0]+2,2,FCSeam.BEDS[bed][1]];}
 if(i===3){const slot=Array.from({length:8},(_,i)=>i).find(i=>!CitySocial.works.some(w=>w.slot===i));if(slot!=null)p=[148+slot*5,1,41];else if(FCStructures?.mine)p=[FCStructures.mine.plot.x+3.5,1,FCStructures.mine.plot.z-1];}
 return{p,text:'FIRST WALK '+(i+1)+'/4 · '+steps[i][1]+' · Tools: skip/help'};
}};
})();
