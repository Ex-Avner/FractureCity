/* Shared, deterministic demonstration interpreter. No generated code or model calls. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.FCApprenticeModel=factory()})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const stations={intake:{x:152,z:-16,verb:'take'},repair:{x:160,z:-16,verb:'repair'},tune:{x:160,z:-9,verb:'repair'},window:{x:152,z:-9,verb:'deliver'},street:{x:156,z:-18,verb:'deliver'},teacher:{x:155,z:-10,verb:'teach'},correct:{x:158,z:-10,verb:'teach'}};
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(){return{v:1,revision:0,mode:'idle',owner:null,lease:0,record:[],skill:null,carry:null,repairAt:0,stock:3,outputs:{window:0,street:0},styles:{window:[],street:[]},dispatched:0,completed:0,npc:{x:156,z:-10,stage:0,wait:0,carry:null},job:null,stamp:0}}
function fail(message,status=409){throw Object.assign(Error(message),{status})}
function close(p,t){return !!p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Number.isFinite(p.y)&&Math.hypot(p.x-t.x,p.z-t.z)<2.6&&Math.abs(p.y-2)<1.6&&p.hp>0}
function recipe(r){return Array.isArray(r)&&r.length===3&&r[0]==='intake'&&['repair','tune'].includes(r[1])&&['window','street'].includes(r[2])}
function restore(raw){const s=fresh();if(!raw||raw.v!==1)return s;if(recipe(raw.skill))s.skill=clone(raw.skill);for(const k of ['window','street'])s.outputs[k]=Math.max(0,Math.min(6,Math.floor(Number(raw.outputs?.[k])||0)));for(const k of ['window','street'])s.styles[k]=Array.from({length:s.outputs[k]},(_,i)=>raw.styles?.[k]?.[i]==='cyan'?'cyan':'warm');s.dispatched=Math.max(0,Math.min(1000000,Math.floor(Number(raw.dispatched)||0)));s.completed=Math.max(0,Math.min(1e6,Math.floor(Number(raw.completed)||0)));return s}
function durable(s){return{v:1,skill:s.skill,outputs:s.outputs,styles:s.styles,dispatched:s.dispatched,completed:s.completed}}
function reset(s){if(s.carry||s.npc.carry)s.stock=Math.min(3,s.stock+1);s.owner=null;s.lease=0;s.record=[];s.carry=null;s.repairAt=0;s.mode='idle';s.job=null;s.npc.carry=null;s.npc.stage=0;s.npc.wait=0;s.revision++}
function startJob(s,trial){const r=trial?s.record:s.skill;if(!recipe(r)||s.stock<=0||s.outputs[r[2]]>=6)return false;s.job=clone(r);s.mode=trial?'trial':'running';s.npc.stage=0;s.npc.wait=0;s.npc.carry=null;return true}
function action(s,p,b,time){
 if(!b||typeof b!=='object'||b.revision!==s.revision)fail('The workshop changed. Try again.');
 const id=b.station,t=stations[id];if(!t||!close(p,t))fail('Move closer to the work station.');
 const op=b.op;if(!['teach','take','repair','finish','deliver','approve','cancel','order','collect'].includes(op))fail('Unknown workshop action.',400);
 if(['recording','trial','review'].includes(s.mode)&&s.owner!==p.accountId)fail('Someone else is teaching Olli.');
 if(op==='teach'){
  if(!['teacher','correct'].includes(id)||!['idle','review'].includes(s.mode))fail('Let Olli finish first.');
  if(s.stock<2)fail('Request two broken lamps at the intake first.');reset(s);s.owner=p.accountId;s.mode='recording';s.lease=time+120000;
 }else if(op==='cancel'){
  if(id!=='teacher'||s.owner!==p.accountId)fail('Only the teacher can stop this lesson.');reset(s);
 }else if(op==='take'){
  if(s.mode!=='recording'||id!=='intake'||s.record.length||s.stock<1)fail('Start a lesson and take one broken lamp.');s.stock--;s.carry='broken';s.record.push(id);
 }else if(op==='repair'){
  if(s.mode!=='recording'||t.verb!=='repair'||s.carry!=='broken'||s.repairAt)fail('Bring a broken lamp.');s.repairAt=time+2000;s.record.push(id);
 }else if(op==='finish'){
  if(s.mode!=='recording'||s.record[1]!==id||!s.repairAt||time<s.repairAt)fail('The repair is not finished.');s.carry=s.record[1]==='tune'?'cyan':'warm';s.repairAt=0;
 }else if(op==='deliver'){
  if(s.mode!=='recording'||t.verb!=='deliver'||!['cyan','warm'].includes(s.carry)||s.outputs[id]>=6)fail('Bring a repaired lamp to an empty rack.');
  s.outputs[id]++;s.styles[id].push(s.carry);s.carry=null;s.record.push(id);s.stamp++;s.lease=time+120000;
  if(!startJob(s,true)){s.mode='review';}
 }else if(op==='approve'){
  if(id!=='teacher'||s.mode!=='review'||!recipe(s.record))fail('Watch Olli complete the trial first.');s.skill=clone(s.record);s.owner=null;s.mode='idle';s.lease=0;s.record=[];s.stamp++;
 }else if(op==='order'){
  if(id!=='intake'||s.stock>=3)fail('The intake is full.');s.stock++;
 }else if(op==='collect'){
  if(t.verb!=='deliver'||s.outputs[id]<=0)fail('No finished lamps here.');s.outputs[id]--;s.styles[id].shift();s.dispatched++;s.stamp++;
 }
 if(s.owner)s.lease=time+120000;s.revision++;return s;
}
function step(s,dt,time,present=()=>true){
 dt=Math.max(0,Math.min(.25,dt));
 if(s.owner&&(time>s.lease||!present(s.owner))){reset(s);return}
 if(s.mode==='idle'&&s.skill)startJob(s,false);
 if(!['trial','running'].includes(s.mode))return;
 const n=s.npc,target=stations[s.job[n.stage]],dx=target.x-n.x,dz=target.z-n.z,d=Math.hypot(dx,dz);
 if(d>1.26){const v=Math.min(d-1.25,dt*1.8);n.x+=dx/d*v;n.z+=dz/d*v;return}
 n.wait+=dt;if(n.wait<(n.stage===1?2.5:.65))return;n.wait=0;
 if(n.stage===0){if(s.stock<1){s.mode='idle';s.job=null;return}s.stock--;n.carry='broken'}
 if(n.stage===1)n.carry=s.job[1]==='tune'?'cyan':'warm';
 if(n.stage===2){const dest=s.job[2];if(s.outputs[dest]>=6){n.wait=.65;return}s.outputs[dest]++;s.styles[dest].push(n.carry);s.completed++;s.stamp++;n.carry=null;s.mode=s.mode==='trial'?'review':'idle';s.job=null;n.stage=0;s.revision++;return}
 n.stage++;s.revision++;
}
return{stations,fresh,restore,durable,action,step,close,recipe,reset};
});
