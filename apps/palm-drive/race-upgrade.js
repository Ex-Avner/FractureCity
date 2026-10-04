/* Palm Drive 3.1: projected solid car geometry, tactical nitro and race gaps.
   No external engine/assets: works in the launcher and the arcade cabinet. */
(function(){
'use strict';
function solidCar(cx,cy,width,color,yaw,braking,boost){
  const faces=[],sn=Math.sin(yaw),cs=Math.cos(yaw),elev=.38;
  function vertex(x,y,z){
    const rx=x*cs+z*sn,rz=z*cs-x*sn;
    const perspective=5/(5+rz);
    return {x:cx+rx*width*.48*perspective,y:cy+(-y-rz*elev)*width*.48*perspective,depth:rz+y*.12};
  }
  function face(points,col){
    const ps=points.map(p=>vertex(...p));
    faces.push({ps,col,depth:ps.reduce((n,p)=>n+p.depth,0)/ps.length});
  }
  function box(x,y,z,w,h,d,col){
    const a=[x-w/2,y,z-d/2],b=[x+w/2,y,z-d/2],c=[x+w/2,y,z+d/2],f=[x-w/2,y,z+d/2];
    const up=p=>[p[0],p[1]+h,p[2]];
    face([a,b,up(b),up(a)],shade(col,.64));
    face([b,c,up(c),up(b)],shade(col,.8));
    face([c,f,up(f),up(c)],shade(col,.68));
    face([f,a,up(a),up(f)],shade(col,.92));
    face([up(a),up(b),up(c),up(f)],shade(col,1.2));
  }
  CTX.save();
  CTX.fillStyle='rgba(0,0,0,.42)';CTX.beginPath();CTX.ellipse(cx,cy+width*.11,width*.58,width*.16,0,0,Math.PI*2);CTX.fill();
  // Four tyres, sidewalls and alloy hubs at real fore/aft positions.
  for(const x of [-.92,.92])for(const z of [-.8,.77]){
    box(x,.04,z,.29,.43,.56,'#161723');
    box(x+Math.sign(x)*.15,.14,z,.035,.22,.32,'#8294aa');
  }
  box(0,.20,0,1.86,.37,2.35,color);
  box(0,.57,.68,1.65,.12,.9,color);
  // Tapered cabin: rear glass, roof and sloping side windows.
  const rear=[[-.7,.58,-.52],[.7,.58,-.52],[.56,1.02,.03],[-.56,1.02,.03]];
  face(rear,'#243e55');
  face([[-.56,1.02,.03],[.56,1.02,.03],[.53,1.03,.65],[-.53,1.03,.65]],shade(color,1.3));
  for(const sign of [-1,1])face([[sign*.7,.58,-.52],[sign*.56,1.02,.03],[sign*.53,1.03,.65],[sign*.72,.58,1]],sign<0?'#50758a':'#162b40');
  face([[-.53,1.03,.65],[.53,1.03,.65],[.72,.58,1],[-.72,.58,1]],'#345467');
  // Glass reflection, deck stripe, wing supports and rear diffuser.
  face([[-.55,.68,-.4],[.5,.68,-.4],[.48,.76,-.3],[-.51,.76,-.3]],'#7aa4b7');
  box(0,.575,-.87,.19,.012,.53,'#e3ecf0');
  for(const x of [-.66,.66])box(x,.54,-.96,.06,.23,.09,'#242535');
  box(0,.77,-.96,2.08,.065,.27,'#252838');
  box(0,.2,-1.2,1.48,.17,.07,'#111523');
  for(const x of [-.62,.62])box(x,.44,-1.19,.47,.09,.035,braking?'#ff5362':'#b7274c');
  box(0,.33,-1.225,.32,.12,.025,'#d3d9dc');
  for(const x of [-.55,.55])box(x,.2,-1.25,.16,.09,.13,'#9aabb8');
  faces.sort((a,b)=>b.depth-a.depth);
  for(const f of faces){CTX.beginPath();f.ps.forEach((p,i)=>i?CTX.lineTo(p.x,p.y):CTX.moveTo(p.x,p.y));CTX.closePath();CTX.fillStyle=f.col;CTX.fill();CTX.strokeStyle='rgba(8,10,25,.15)';CTX.lineWidth=.55;CTX.stroke();}
  if(boost>.1)for(const x of [-.55,.55]){
    const p=vertex(x,.21,-1.34),len=width*(.12+boost*.2);
    const g=CTX.createLinearGradient(p.x,p.y,p.x,p.y+len);g.addColorStop(0,'#e9ffff');g.addColorStop(.3,'#58ddff');g.addColorStop(1,'rgba(30,70,255,0)');
    CTX.fillStyle=g;CTX.beginPath();CTX.moveTo(p.x-width*.035,p.y);CTX.lineTo(p.x+width*.035,p.y);CTX.lineTo(p.x,p.y+len);CTX.fill();
  }
  CTX.restore();
}
function shade(hex,m){const n=parseInt(hex.slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.min(255,Math.round(v*m)).toString(16).padStart(2,'0')).join('');}
globalThis.drawPlayer=function(){solidCar(W/2+G.lean*32,H*.845+G.bounce*3,215,'#ef398c',limit(G.driftYaw+G.steer*.14,-.55,.55),K.ArrowDown||K.KeyS||K.KeyX,G.boost);};
globalThis.drawCar=function(x,y,scale,col,fog,offset){const w=Math.min(W*1.15,1050*scale);if(w<2)return;CTX.save();CTX.globalAlpha=1-fog*.8;solidCar(x,y-w*.11,w,col,limit((offset-G.playerX)*.17,-.4,.4),false,0);CTX.restore();};
const hud=globalThis.drawHUD;
globalThis.drawHUD=function(){
  hud();if(!G.running)return;
  CTX.save();
  panel(22,104,208,86);CTX.textAlign='left';CTX.font='bold 11px Courier New';CTX.fillStyle='#7fe8ff';
  CTX.fillText(G.drafting?'SLIPSTREAM · CHARGING':'NITRO · SHIFT',36,126);
  CTX.fillStyle='#252638';CTX.fillRect(36,138,180,8);CTX.fillStyle=G.nitro<.2?'#ff6685':'#7fe8ff';CTX.fillRect(36,138,180*(G.nitro||0),8);
  CTX.font='10px Courier New';CTX.fillStyle='#e4ddef';CTX.fillText(G.boostLocked?'Release SHIFT to recharge':'Draft / drift to earn boost',36,170);
  const progress=playerProgress();
  const ahead=rivals.filter(r=>!r.finished&&(r.lap-1)*trackLength+r.z>progress).sort((a,b)=>(a.lap-b.lap)*trackLength+a.z-b.z)[0];
  const behind=rivals.filter(r=>!r.finished&&(r.lap-1)*trackLength+r.z<=progress).sort((a,b)=>(b.lap-a.lap)*trackLength+b.z-a.z)[0];
  panel(W-230,104,208,72);CTX.fillStyle='#ffd9f2';
  const gap=r=>(Math.abs((r.lap-1)*trackLength+r.z-progress)/Math.max(G.speed,r.speed,MAX_SPEED*.25)).toFixed(1)+'s';
  CTX.fillText(ahead?'CHASE '+ahead.name+'  +'+gap(ahead):'LEADING THE LIVE FIELD',W-216,128);
  CTX.fillStyle='#9aa7bf';CTX.fillText(behind?'BEHIND '+behind.name+'  '+gap(behind):'KEEP IT CLEAN',W-216,154);
  CTX.restore();
};
addEventListener('blur',()=>{for(const k in K)K[k]=false;if(G.running)G.paused=true;});
})();
