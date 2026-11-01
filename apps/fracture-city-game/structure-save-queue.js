/* A serialized, coalescing plot save queue. The server still validates the full
 * plot and its revision; only the unsaved difference is journaled locally. */
(function(scope){'use strict';
const copy=v=>JSON.parse(JSON.stringify(v)),key=c=>[c.x,c.y,c.z].join(','),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const normalize=v=>({revision:v.revision,cells:v.cells.map(c=>({x:c.x,y:c.y,z:c.z,id:c.id})),doors:v.doors.map(d=>({x:d.x,y:d.y,z:d.z,id:d.id,open:d.open}))});
function diff(a,b){const out=[];for(const field of ['cells','doors']){const before=new Map(a[field].map(v=>[key(v),v])),after=new Map(b[field].map(v=>[key(v),v]));for(const k of new Set([...before.keys(),...after.keys()])){const old=before.get(k)||null,next=after.get(k)||null;if(!same(old,next))out.push({field,key:k,before:old,after:next})}}return out}
function apply(base,patch){const out=normalize(base);for(const field of ['cells','doors']){const rows=new Map(out[field].map(v=>[key(v),v]));for(const p of patch)if(p.field===field){if(p.after)rows.set(p.key,copy(p.after));else rows.delete(p.key)}out[field]=[...rows.values()]}return out}
class StructureSaveQueue{
 constructor(io,config={}){this.io=io;this.config={idle:700,maxWait:3000,minInterval:1600,retry:2500,...config};this.base=null;this.draft=null;this.patch=[];this.flight=null;this.timer=null;this.firstDirty=0;this.lastSent=-Infinity;this.failure='';this.conflicts=0;this.retryDelay=this.config.retry;this.journalOK=true;this.needsRead=false;this.closed=false}
 get dirty(){return this.patch.length>0}
 emit(){this.io.view?.(this.draft);this.io.status?.({dirty:this.dirty,saving:!!this.flight,changes:this.patch.length,error:this.failure,conflicts:this.conflicts,journalOK:this.journalOK,connected:this.io.connected()})}
 journal(){try{this.io.store?.(this.dirty?{v:1,patch:this.patch}:null);this.journalOK=true}catch(e){this.journalOK=false}this.emit()}
 load(base,journal){this.base=normalize(base);this.draft=normalize(base);this.patch=journal?.v===1&&Array.isArray(journal.patch)?copy(journal.patch):[];this.rebase(base);this.schedule()}
 change(wanted){if(!this.base)return false;this.draft=normalize({...wanted,revision:this.base.revision});this.patch=diff(this.base,this.draft);if(this.dirty&&!this.firstDirty)this.firstDirty=Date.now();if(!this.dirty){this.firstDirty=0;this.failure='';this.conflicts=0}this.journal();this.schedule();return true}
 rebase(next){if(!next||this.base&&next.revision<this.base.revision)return;next=normalize(next);const maps=Object.fromEntries(['cells','doors'].map(f=>[f,new Map(next[f].map(v=>[key(v),v]))]));const retained=[];let conflicts=0;for(const p of this.patch){const current=maps[p.field].get(p.key)||null;if(same(current,p.after))continue;if(!same(current,p.before)){conflicts++;retained.push(p)}else retained.push({...p,before:current})}this.base=next;this.patch=retained;this.draft=apply(next,retained);this.conflicts=conflicts;if(conflicts)this.failure='This plot changed in another session. Your draft is kept here.';else if(!this.dirty){this.failure='';this.firstDirty=0}if(this.dirty&&!this.firstDirty)this.firstDirty=Date.now();this.journal()}
 schedule(delay){clearTimeout(this.timer);this.timer=null;if(this.closed||!this.dirty||this.flight||this.failure)return;const now=Date.now(),due=delay===undefined?Math.max(this.lastSent+this.config.minInterval,Math.min(now+this.config.idle,(this.firstDirty||now)+this.config.maxWait)):now+delay;this.timer=setTimeout(()=>this.flush(false).catch(()=>{}),Math.max(0,due-now))}
 async flush(drain=true){clearTimeout(this.timer);this.timer=null;if(this.flight){await this.flight;if(drain&&this.dirty&&!this.failure)return this.flush(true);return !this.dirty}if(!this.dirty)return true;if(this.failure||this.closed)return false;if(!this.io.connected()){this.emit();this.schedule(this.config.retry);return false}
  const wait=this.lastSent+this.config.minInterval-Date.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));if(this.flight)return this.flush(drain);if(!this.dirty||this.failure||this.closed)return !this.dirty;
  const run=async()=>{try{
   // An ambiguous network response must be reconciled before resubmission. A
   // successful server write whose response was lost is never charged twice.
   if(this.needsRead){const latest=await this.io.read();this.rebase(latest);this.needsRead=false;if(!this.dirty||this.failure)return}
   const sent=normalize(this.draft);sent.revision=this.base.revision;this.lastSent=Date.now();const next=await this.io.write(copy(sent));
   const tail=diff(sent,this.draft);this.base=normalize(next);this.patch=tail;this.draft=apply(this.base,tail);this.firstDirty=tail.length?Date.now():0;this.failure='';this.conflicts=0;this.retryDelay=this.config.retry;this.journal();
  }catch(e){
   this.needsRead=true;
   try{this.rebase(await this.io.read());this.needsRead=false}catch(_){/* Retain the journal and local view while offline. */}
   if(this.dirty&&!this.conflicts){const transient=!e.status||e.status>=500||e.status===429||e.status===409&&/plot changed/i.test(e.message);if(!transient)this.failure=(e.message||'This build could not be saved.')+' Your draft is kept here.';this.retryDelay=Math.min(30000,Math.max(this.config.retry,this.retryDelay*2))}
  }};
  this.flight=Promise.resolve().then(run);this.emit();await this.flight;this.flight=null;this.emit();if(this.dirty&&!this.failure)this.schedule(this.retryDelay);if(drain&&this.dirty&&!this.failure&&!this.needsRead&&this.retryDelay===this.config.retry)return this.flush(true);return !this.dirty;
 }
 retry(){// Explicitly keeping a conflicting draft affects only its changed cells.
  this.patch=diff(this.base,this.draft);this.conflicts=0;this.failure='';this.journal();return this.flush(true)}
 async discard(){if(this.flight)await this.flight;this.patch=[];this.draft=normalize(this.base);this.failure='';this.conflicts=0;this.firstDirty=0;this.journal();clearTimeout(this.timer)}
 close(){this.closed=true;clearTimeout(this.timer)}
}
StructureSaveQueue.diff=diff;StructureSaveQueue.apply=apply;
if(typeof module!=='undefined'&&module.exports)module.exports=StructureSaveQueue;else scope.FCStructureSaveQueue=StructureSaveQueue;
})(typeof window==='undefined'?globalThis:window);
