/* Shared, clock-injected sentencing and escape rules. No rendering or IO.
   0.111: the escape is a stealth breakout played in the building, not read from a panel.
   Stations are physical places with a timed hold; the client adds guards, sight and the
   duct. A client may report itself caught (it only ever costs that player progress). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FCJusticeRules=api;})(typeof window==='undefined'?globalThis:window,function(){'use strict';
const WINDOW=300000,SENTENCE=600000,CELL={x:33,y:2,z:-40.5},EXIT={x:70,y:1,z:-3};
// Footprint of the Custody House floor (x 28..67, z -44..-5, floor at y 2).
const FOOT={x0:28.5,x1:66.5,z0:-43.5,z1:-5.5},CELLBOX={x0:31,x1:35,z0:-43,z1:-38};
const stations=[
 {id:'vent',name:'The cell vent',at:{x:31.4,y:2,z:-40},seconds:5,verb:'Pry the vent cover',text:'The cover comes away. Behind it, a service duct runs along the back of the cells.'},
 {id:'duct',name:'The laundry grate',at:{x:29.5,y:2,z:-17},seconds:2,verb:'Push out the grate',text:'You drop into the laundry, behind the drums.'},
 {id:'uniform',name:'The uniform rack',at:{x:37,y:2,z:-14.6},seconds:3,verb:'Pull on a guard uniform',text:'Navy, a size too big, the cap low. Guards will not look twice unless you stand in their face.'},
 {id:'keys',name:'The key cabinet',at:{x:61,y:2,z:-23.5},seconds:3,verb:'Lift the service key',text:'The service door key. The desk is unattended for the second half of every round.'},
 {id:'outlet',name:'The rainwater outlet',at:{x:63.5,y:2,z:-7.6},seconds:5,verb:'Crawl out through the outlet',text:'You come out under the street grating. Your sentence is over; new civilian killings begin a new record.'}
];
const fresh=()=>({kills:[],seen:[],until:0,started:0,stage:0,work:null,reason:''});
function clean(s,t){s=s||fresh();s.kills=(s.kills||[]).filter(k=>Number.isFinite(k)&&t-k<=WINDOW&&k<=t);s.seen=(s.seen||[]).filter(k=>k&&t-k.at<=SENTENCE+WINDOW).slice(-128);if(!Number.isInteger(s.stage)||s.stage<0)s.stage=0;if(s.stage>=stations.length)s.stage=stations.length-1;if(s.until&&t>=s.until){s.until=0;s.stage=0;s.work=null;s.reason='served';}return s;}
function active(s,t){return !!s.until&&t<s.until;}
function record(s,id,t){clean(s,t);if(s.seen.some(k=>k.id===id))return false;s.seen.push({id,at:t});if(active(s,t))return false;s.kills.push(t);if(s.kills.length>=3){s.until=t+SENTENCE;s.started=t;s.stage=0;s.work=null;s.kills=[];s.reason='sentenced';return true;}return false;}
const near=(p,a,r=2.8)=>Math.hypot(p.x-a.x,p.z-a.z)<=r&&Math.abs((p.y??2)-a.y)<1.4;
// The desk guard walks his yard round in the second half of every 36 s cycle.
const guardAway=(s,t)=>((t-s.started)%36000+36000)%36000>=18000;
function allowed(s,p,t){if(!active(s,t))return true;const b=s.stage<1?CELLBOX:FOOT;return p.x>=b.x0&&p.x<=b.x1&&p.z>=b.z0&&p.z<=b.z1&&p.y>=1.8&&p.y<=4.5;}
function anchor(s){return CELL;}
function action(s,p,b,t){clean(s,t);if(!active(s,t))throw Error('There is no active sentence.');
 // Caught by a guard: marched back to the cell. An opened vent stays open; the uniform is taken.
 if(b.action==='caught'){s.work=null;s.stage=Math.min(s.stage,1);return CELL;}
 const a=stations[s.stage];if(!a||b.id!==a.id)throw Error('That is not the way out yet.');if(!near(p,a.at))throw Error('Get closer to '+a.name.toLowerCase()+'.');if(a.id==='keys'&&!guardAway(s,t)){s.work=null;throw Error('The desk guard is watching. Wait until he walks his round.');}
 if(b.action==='begin'){s.work={id:a.id,at:t};return null;}
 if(b.action!=='finish'||s.work?.id!==a.id||t-s.work.at<a.seconds*1000||t-s.work.at>30000)throw Error('Hold the action here until it finishes.');
 s.work=null;s.stage++;if(s.stage===stations.length){s.until=0;s.kills=[];s.reason='escaped';s.stage=0;return EXIT;}return null;
}
return {WINDOW,SENTENCE,CELL,EXIT,FOOT,CELLBOX,stations,fresh,clean,active,record,near,guardAway,allowed,anchor,action};
});
