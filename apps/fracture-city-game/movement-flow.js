/* Responsive foot movement; native collisions, boards and class speeds remain authoritative. */
(function(){'use strict';
const F=window.FCFlow={coyote:0,buffer:0,held:false,jumps:0,airUsed:false};
const input=updateWalkInput;
window.updateWalkInput=function(dt){
 if(Board.on||Player.mode!=='walk'){F.coyote=F.buffer=0;if(window.Mobile)Mobile.jumpPresses=0;F.held=State.keys.has(' ');return input.apply(this,arguments)}
 dt=Math.max(0,Math.min(.05,dt));const held=State.keys.has(' '),wasHeld=F.held,ground=Player.onGround,oldX=Player.velocity.x,oldZ=Player.velocity.z;
 const queued=!!(typeof Touch!=='undefined'&&Touch.on&&window.Mobile?.jumpPresses>0&&!window.FCWorldStudio?.god);
 if(queued)Mobile.jumpPresses--;
 const pressed=queued||(held&&!wasHeld);
 if(ground)F.airUsed=false;
 F.held=held;F.coyote=ground?.115:Math.max(0,F.coyote-dt);F.buffer=pressed?.14:Math.max(0,F.buffer-dt);
 // Let existing class, ice and movement hooks calculate the desired velocity,
 // but consume jump presses here so holding Space never repeatedly hops.
 if(held)State.keys.delete(' ');try{input.apply(this,arguments)}finally{if(held)State.keys.add(' ')}
 const moving=['w','a','s','d'].some(k=>State.keys.has(k)),blend=1-Math.exp(-(ground?(moving?24:30):(moving?8:1.6))*dt);
 const x=moving?Player.velocity.x:ground?0:oldX,z=moving?Player.velocity.z:ground?0:oldZ;
 Player.velocity.x=oldX+(x-oldX)*blend;Player.velocity.z=oldZ+(z-oldZ)*blend;
 if(F.buffer>0&&F.coyote>0){Player.velocity.y=getJumpPower();Player.onGround=false;F.buffer=F.coyote=0;F.jumps++}
 // One fresh midair press; release-to-cut also applies to the second jump.
 // God mode reserves double-tap Space for flight. No new UI or server writes.
 else if(pressed&&!ground&&!F.airUsed&&!window.FCWorldStudio?.god){Player.velocity.y=getJumpPower();Player.onGround=false;F.airUsed=true;F.buffer=F.coyote=0;F.jumps++}
 else if(!held&&wasHeld&&Player.velocity.y>0)Player.velocity.y*=.55;
};
const fresh=newGame;window.newGame=function(){F.coyote=F.buffer=0;F.held=false;F.airUsed=false;return fresh.apply(this,arguments)};
})();
