/* Account-bound personal saves. Compare-and-swap prevents a second device
   silently replacing newer progress. Local copies are retained on conflicts. */
(function(){'use strict';
let user=null,docs={},pending={},ready=false,busy=false,conflict=false,status='local',epoch=0,anchor=0,at=0,retryAt=0,loading=false;
const clone=x=>JSON.parse(JSON.stringify(x));
const enabled=()=>location.pathname.startsWith('/city/')&&!!window.FCAccounts?.user;
const cacheKey=()=> 'fc-life-pending:'+user;
function cache(){try{localStorage.setItem(cacheKey(),JSON.stringify(pending))}catch{}}
function notice(text){status=text;let b=document.getElementById('resident-save-status');const host=document.querySelector('#city-online details');if(!b&&host){b=document.createElement('p');b.id='resident-save-status';b.setAttribute('role','status');host.append(b)}if(b)b.textContent='Account progress: '+text;}
async function request(body){const r=await fetch('/api/resident-life',{credentials:'same-origin',headers:{'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});const d=await r.json();if(!r.ok)throw Object.assign(Error(d.error||'Save unavailable'),{status:r.status});return d}
async function connect(){
 const a=FCAccounts.user;if(!enabled()||loading)return;loading=true;
 if(user===a.id&&ready){loading=false;return;}
 const current=++epoch;user=a.id;ready=false;conflict=false;docs={};pending={};notice('loading…');
 try{const d=await request();if(current!==epoch||FCAccounts.user?.id!==a.id)return;
  anchor=d.time;at=performance.now();docs=d.docs;for(const doc of Object.values(docs))doc.saved=clone(doc.data);
  try{pending=JSON.parse(localStorage.getItem(cacheKey())||'{}')}catch{pending={}}
  for(const [k,p]of Object.entries(pending)){
   if(p.revision===(docs[k]?.revision||0)){docs[k]={revision:p.revision,data:p.data}}
   else if(JSON.stringify(docs[k]?.data)===JSON.stringify(p.data))delete pending[k];
   else conflict=true;
  }
  cache();ready=true;notice(conflict?'another device saved newer progress; unsent copy retained on this device. Reload after resolving the copy.':'saved online');
  dispatchEvent(new Event('fc-life-ready'));await flush();
 }catch(e){if(current!==epoch)return;notice('could not load. Retrying; your existing progress is safe.');retryAt=performance.now()+10000}finally{loading=false}
}
function get(kind,fallback){
 if(!enabled())return fallback;
 if(!ready||user!==FCAccounts.user?.id)return fallback;
 if(!docs[kind]){docs[kind]={revision:0,data:clone(fallback)};put(kind,docs[kind].data)}
 return docs[kind].data;
}
function put(kind,data){
 if(!enabled()||!ready||user!==FCAccounts.user?.id||conflict)return false;
 const value=clone(data),raw=JSON.stringify(value);
 if(raw===JSON.stringify(pending[kind]?.data??docs[kind]?.saved))return true;
 docs[kind]||={revision:0};docs[kind].data=data;
 pending[kind]={revision:docs[kind].revision,data:value};cache();notice('saving…');return true;
}
async function flush(){
 if(!enabled()||!ready||user!==FCAccounts.user?.id||busy||conflict||performance.now()<retryAt)return;
 busy=true;const current=epoch;
 try{for(const kind of Object.keys(pending)){
  const sent=clone(pending[kind]);const result=await request({kind,...sent});if(current!==epoch)return;
  anchor=result.time;at=performance.now();docs[kind].revision=result.revision;docs[kind].saved=sent.data;
  if(JSON.stringify(pending[kind]?.data)===JSON.stringify(sent.data))delete pending[kind];
  else if(pending[kind])pending[kind].revision=result.revision;
  cache();
 }
 notice(Object.keys(pending).length?'saving…':'saved online');
 }catch(e){if(current!==epoch)return;if(e.status===409){conflict=true;notice('newer save on another device. Unsent copy retained. Use Tools → Account save recovery.');}else{retryAt=performance.now()+5000;notice('connection interrupted; changes retained here and will retry.')}}finally{busy=false}
}
function recover(){
 if(!conflict){flush();return}
 const blob=new Blob([JSON.stringify({account:user,pending},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='fracture-city-unsent-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 // Explicit recovery keeps the unsent copy, then loads the authoritative account save.
 try{localStorage.setItem('fc-life-conflict:'+user,JSON.stringify(pending));localStorage.removeItem(cacheKey())}catch{}
 location.reload();
}
window.FCResidentLife={get enabled(){return enabled()},get ready(){return ready&&user===FCAccounts.user?.id},get blocked(){return enabled()&&(!ready||user!==FCAccounts.user?.id||conflict)},get status(){return status},get,put,flush,recover,now:()=>enabled()&&ready&&user===FCAccounts.user?.id?anchor+performance.now()-at:Date.now()};
window.addEventListener('fc-account-ready',connect);
FCAccounts.ready.then(connect);
setInterval(()=>{if(!enabled()&&user){cache();epoch++;user=null;docs={};pending={};ready=false;conflict=false;}if(enabled()&&user!==FCAccounts.user.id)connect();else if(enabled()&&!ready&&performance.now()>retryAt)connect();else flush();const tray=document.querySelector('#fc-tools .tray');if(tray&&!tray.querySelector('[data-life-recovery]')){const b=document.createElement('button');b.dataset.lifeRecovery='1';b.textContent='Account save recovery';b.onclick=recover;tray.append(b)}},2000);
addEventListener('pagehide',()=>{cache()});
})();
