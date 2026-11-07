/* Shared, clock-injected sentencing and escape rules. No rendering or IO. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FCJusticeRules=api;})(typeof window==='undefined'?globalThis:window,function(){'use strict';
const WINDOW=300000,SENTENCE=600000,CELL={x:34,y:2,z:-35},EXIT={x:70,y:1,z:-3};
const stations=[
 {id:'note',name:'The scratched bedframe',at:{x:32,y:2,z:-39},seconds:2,verb:'Read the scratches',text:'“The tray has a loose edge. Keep it. Laundry access is behind the vent. The guard takes the west stair when the bell is quiet.”'},
 {id:'tool',name:'The meal tray',at:{x:36,y:2,z:-39},seconds:4,verb:'Work the tray edge loose',text:'A thin strip of metal comes free. It will turn the vent fasteners.'},
 {id:'vent',name:'The laundry vent',at:{x:31,y:2,z:-34},seconds:8,verb:'Open the vent and crawl through',text:'The duct leads into the laundry room. Leave the tool behind; it will catch on the grate.'},
 {id:'roster',name:'The service roster',at:{x:43,y:2,z:-22},seconds:3,verb:'Study the guard’s round',text:'The service door is watched for the first half of each 36-second round. Wait until the guard walks west.'},
 {id:'service',name:'The service passage',at:{x:62,y:2,z:-16},seconds:3,verb:'Slip into the service passage',text:'You found the unlocked drain inspection hatch. Reach the outlet before the route is noticed.'},
 {id:'outlet',name:'The rainwater outlet',at:{x:64,y:2,z:-8},seconds:5,verb:'Crawl out to the street',text:'You emerge beyond the perimeter. Your sentence is over; new civilian killings begin a new record.'}
];
const fresh=()=>({kills:[],seen:[],until:0,started:0,stage:0,work:null,reason:''});
function clean(s,t){s=s||fresh();s.kills=(s.kills||[]).filter(k=>Number.isFinite(k)&&t-k<=WINDOW&&k<=t);s.seen=(s.seen||[]).filter(k=>k&&t-k.at<=SENTENCE+WINDOW).slice(-128);if(s.until&&t>=s.until){s.until=0;s.stage=0;s.work=null;s.reason='served';}return s;}
function active(s,t){return !!s.until&&t<s.until;}
function record(s,id,t){clean(s,t);if(s.seen.some(k=>k.id===id))return false;s.seen.push({id,at:t});if(active(s,t))return false;s.kills.push(t);if(s.kills.length>=3){s.until=t+SENTENCE;s.started=t;s.stage=0;s.work=null;s.kills=[];s.reason='sentenced';return true;}return false;}
const near=(p,a,r=2.8)=>Math.hypot(p.x-a.x,p.z-a.z)<=r&&Math.abs((p.y??2)-a.y)<1.4;
const guardAway=(s,t)=>((t-s.started)%36000+36000)%36000>=18000;
function allowed(s,p,t){if(!active(s,t))return true;const cell=s.stage<3;return p.x>=(cell?30:29.5)&&p.x<=(cell?39:66.5)&&p.z>=(cell?-41:-42)&&p.z<=(cell?-30:-6)&&p.y>=1.8&&p.y<=4.5;}
function anchor(s){return s.stage<3?CELL:{x:34,y:2,z:-25};}
function action(s,p,b,t){clean(s,t);if(!active(s,t))throw Error('There is no active sentence.');const a=stations[s.stage];if(!a||b.id!==a.id)throw Error('Follow the next lead in your escape plan.');if(!near(p,a.at))throw Error('Walk to '+a.name.toLowerCase()+'.');if(a.id==='service'&&!guardAway(s,t)){s.work=null;throw Error('The guard is watching. Wait until the round moves west.');}
 if(b.action==='begin'){s.work={id:a.id,at:t};return null;}
 if(b.action!=='finish'||s.work?.id!==a.id||t-s.work.at<a.seconds*1000||t-s.work.at>30000)throw Error('Start the action here and stay nearby until it finishes.');
 s.work=null;s.stage++;if(s.stage===stations.length){s.until=0;s.kills=[];s.reason='escaped';return EXIT;}if(a.id==='vent')return {x:34,y:2,z:-25};return null;
}
return {WINDOW,SENTENCE,CELL,EXIT,stations,fresh,clean,active,record,near,guardAway,allowed,anchor,action};
});
