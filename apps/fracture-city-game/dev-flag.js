/* Developer flag (0.92). Builder-facing tools stay out of a new player's way
   unless this is on. Turn it on with ?dev=1 in the address (it is remembered)
   or FC_DEV.set(true) in the console; ?dev=0 turns it off. */
(function(){'use strict';
let on=false;
try{const q=new URLSearchParams(location.search).get('dev');if(q==='1')localStorage.setItem('fc-dev','on');if(q==='0')localStorage.removeItem('fc-dev');on=localStorage.getItem('fc-dev')==='on'}catch(e){}
window.FC_DEV={get on(){return on},set(v){on=!!v;try{v?localStorage.setItem('fc-dev','on'):localStorage.removeItem('fc-dev')}catch(e){}}};
})();
