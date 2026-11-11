(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./college-content.js'):root.FCCollegeContent);if(typeof module==='object'&&module.exports)module.exports=api;else root.FCCollegeProgress=api;})(typeof window==='undefined'?globalThis:window,function(C){'use strict';
const fresh=()=>({version:C.version,revision:0,notes:{},project:{},review:[],projectSubmitted:false,results:{},completedAt:null,updatedAt:null});
const fail=(m,status=400)=>{throw Object.assign(Error(m),{status});};
function questions(id){if(id==='final')return C.exam;return C.units.find(u=>u.id===id)?.test;}
function finished(s){return C.units.every(u=>(s.results[u.id]?.best??0)>=80)&&(s.results.final?.best??0)>=80&&s.projectSubmitted;}
function projectErrors(s){const e=[];for(const f of C.projectFields)if((s.project[f.id]||'').trim().length<80)e.push(f.label+': write at least 80 characters so your reasoning is recorded.');if(!/\b[ABCDE]\b/.test(s.project.evidence||'')||new Set((s.project.evidence||'').match(/\b[ABCDE]\b/g)||[]).size<2)e.push('Evidence: reference at least two dossier IDs (A–E).');if(!C.rubric.every((_,i)=>s.review.includes(i)))e.push('Complete every self-review statement. These are your judgments, not an automatic essay grade.');return e;}
function apply(input,b,time=Date.now()){
 const s=JSON.parse(JSON.stringify(input));
 if(b.action==='assess'&&s.results[b.id]?.attempts.some(a=>a.id===b.attempt))return s;
 if(b.revision!==s.revision)fail('Progress changed in another tab. Your draft is kept on this device. Reload saved progress before trying again.',409);
 if(b.action==='draft'){
  if(b.notes){for(const [id,text]of Object.entries(b.notes)){if(!C.units.some(u=>u.id===id)||typeof text!=='string'||text.length>12000)fail('Invalid notebook entry.');s.notes[id]=text;}}
  if(b.project){for(const [id,text]of Object.entries(b.project)){if(!C.projectFields.some(f=>f.id===id)||typeof text!=='string'||text.length>12000)fail('Invalid investigation field.');s.project[id]=text;}s.projectSubmitted=false;}
  if(b.review!==undefined){if(!Array.isArray(b.review)||b.review.some(i=>!Number.isInteger(i)||i<0||i>=C.rubric.length))fail('Invalid self-review.');s.review=[...new Set(b.review)];s.projectSubmitted=false;}
 }else if(b.action==='assess'){
  const qs=questions(b.id);if(!qs)fail('Unknown assessment.');if(b.id==='final'&&!C.units.every(u=>(s.results[u.id]?.best??0)>=80))fail('Pass all six unit tests before taking the final.',409);
  if(typeof b.attempt!=='string'||!/^[-a-zA-Z0-9]{8,80}$/.test(b.attempt))fail('Invalid attempt identifier.');
  if(!Array.isArray(b.answers)||b.answers.length!==qs.length||b.answers.some((a,i)=>!Number.isInteger(a)||a<0||a>=qs[i].options.length))fail('Answer every question before submitting.');
  const correct=qs.reduce((n,q,i)=>n+(q.answer===b.answers[i]?1:0),0),score=Math.round(correct/qs.length*100),v=s.results[b.id]||{best:0,attempts:[],count:0};v.count++;v.best=Math.max(v.best,score);v.attempts.push({id:b.attempt,score,correct,total:qs.length,answers:b.answers,at:time});v.attempts=v.attempts.slice(-5);s.results[b.id]=v;
 }else if(b.action==='project'){
  if(!C.units.every(u=>(s.results[u.id]?.best??0)>=80)||(s.results.final?.best??0)<80)fail('Pass the unit tests and final before submitting the investigation.',409);
  const e=projectErrors(s);if(e.length)fail(e.join(' '));s.projectSubmitted=true;
 }else fail('Unknown course action.');
 s.revision++;s.updatedAt=time;s.completedAt=finished(s)?(s.completedAt||time):null;return s;
}
return {fresh,apply,questions,finished,projectErrors};
});
