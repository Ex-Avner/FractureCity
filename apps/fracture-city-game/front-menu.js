/* One front door, with optional modes kept on a separate screen. */
(function(){
  const style=document.createElement('style');
  style.textContent=`
  #menu-overlay{overflow-y:auto!important;padding:32px 20px!important;box-sizing:border-box;background:radial-gradient(ellipse at 20% 0%,#253249 0%,#111824 45%,#090e17 100%)!important;}
  #menu-overlay .title{font-family:system-ui,sans-serif!important;font-size:clamp(28px,5vw,48px)!important;letter-spacing:2px!important;margin:0 0 24px!important;}
  #front-root{width:min(520px,100%)!important;font-family:system-ui,sans-serif;}
  .fc-intro{color:#b9c6d6;font-size:15px;line-height:1.6;margin:0 0 22px;}
  .fc-actions{display:grid;gap:12px;}
  #front-root .fc-action{display:block;width:100%;text-align:left;padding:16px 20px;border:1px solid #425269;border-radius:10px;background:#1b2636;color:#f4f6fb;font:600 17px system-ui;cursor:pointer;}
  #front-root .fc-action small{display:block;margin-top:6px;font-size:13px;font-weight:400;line-height:1.5;color:#bac9dc;}
  #front-root .fc-action.fc-primary{background:#f4cf88;color:#172131;border-color:#f4cf88;}
  #front-root .fc-action.fc-primary small{color:#3c4756;}
  #front-root button:hover{filter:brightness(1.12);}
  #front-root button:focus-visible{outline:3px solid #91d8ff;outline-offset:4px;}
  .fc-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px;}
  #front-root .fc-link{padding:10px 14px;border:1px solid #425269;border-radius:7px;background:transparent;color:#d5e4f6;font:14px system-ui;cursor:pointer;}
  .fc-controls{color:#bac9dc;line-height:1.8;font-size:15px;}
  #fc-load-status{position:fixed;inset:0;z-index:100000;display:grid;place-content:center;background:#101826f5;color:#fff;font:18px/1.6 system-ui;padding:32px;text-align:center;}
  #fc-load-status button{padding:12px 20px;margin-top:20px;cursor:pointer;}
  @media(max-height:600px){#menu-overlay{justify-content:flex-start!important;}#menu-overlay .title{margin-top:10px!important;}}
  #menu-overlay>.title{display:none!important}#front-root{width:min(1140px,100%)!important;display:grid!important;grid-template-columns:1.35fr 1fr;gap:clamp(24px,6vw,100px);align-items:center;position:relative;z-index:1}
  #front-root:not(:has(.fc-cover)){display:block!important;max-width:620px!important}
  #menu-overlay{background:radial-gradient(ellipse at 80% 65%,#3d2a3a 0%,transparent 55%),linear-gradient(135deg,#102c30,#10171f 55%,#171625)!important;}
  .fc-kicker{font:10px/1.8 monospace;letter-spacing:.18em;color:#a9dbcf;margin:0 0 25px}.fc-cover h1{font:900 clamp(54px,8vw,110px)/.87 system-ui;letter-spacing:-.075em;color:#f1ecdb;margin:0 0 34px}.fc-cover h1 em{font-style:normal;color:#dbedac}.fc-cover .fc-intro{font-size:clamp(20px,2.1vw,28px);color:#ebe6d9;line-height:1.35}.fc-world-note{max-width:360px;color:#9ab0b5;font:14px/1.8 system-ui}.fc-entry{border-top:1px solid #68817c;padding-top:28px}.fc-entry-note{font:11px/1.8 monospace;color:#9ab0b5;margin-top:30px}#front-root .fc-action{border-radius:3px;padding:22px}#front-root .fc-action.fc-primary{background:#dbedac;border-color:#dbedac;color:#14292b;font-size:24px}#front-root .fc-action.fc-primary small{color:#304b48;font-size:13px}#front-root .fc-link{border:0;border-bottom:1px solid #526567;border-radius:0;padding:10px 2px;margin-right:14px}.fc-links{gap:8px}#front-root .fc-action small:empty{display:none}
  @media(max-width:720px){#front-root{grid-template-columns:1fr;gap:22px}.fc-cover h1{font-size:66px;margin-bottom:20px}.fc-cover .fc-intro{font-size:20px;margin-bottom:12px}.fc-world-note{display:none}.fc-kicker{margin-bottom:18px}.fc-entry{padding-top:18px}.fc-entry-note{margin-top:16px}#menu-overlay{justify-content:flex-start!important;padding-top:max(28px,env(safe-area-inset-top))!important}}
  `;
  document.head.appendChild(style);
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const action=(id,title,detail,primary=false)=>`<button class="fc-action ${primary?'fc-primary':''}" data-action="${id}">${title}<small>${detail}</small></button>`;
  function draw(html){const root=document.getElementById('front-root');if(!root)return;root.innerHTML=html;root.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>act(b.dataset.action));}
  window.shFrontHome=function(){
    const live=State.chunkMap.size>0, recent=Slots.index[0];
    draw(`<div class="fc-cover"><p class="fc-kicker">PRESENT PALM / A CITY WITH A SIGNAL PROBLEM</p><h1>FRACTURE<br><em>CITY.</em></h1><p class="fc-intro">The news broke reality.<br>What you do with the city is up to you.</p><p class="fc-world-note">Follow Ned’s bulletin into the streets. Find the people, the arcade, and a place to make something your own.</p></div><div class="fc-entry"><p class="fc-kicker">${live?'YOUR CITY IS WAITING':recent?'PICK UP WHERE YOU LEFT OFF':'TONIGHT’S BROADCAST'}</p><div class="fc-actions">`+
      (live?action('resume','Back to the streets','Continue playing this city.',true):recent?action('continue','Continue',esc(recent.name||'Your latest city'),true):action('new-campaign','Begin story','Ned is live. Something is very wrong.',true))+
      `</div><div class="fc-links">${recent||live?'<button class="fc-link" data-action="new-campaign">New story</button>':''}<button class="fc-link" data-action="saves">Saved cities</button><button class="fc-link" data-action="help">Controls</button><button class="fc-link" data-action="more">More</button></div><p class="fc-entry-note">One city. Story, studios, streets and arcade.<br>Your progress saves as you play.</p></div>`);
  };
  function act(id){
    if(id==='new-campaign'&&!State.classChosen){Player.classKey='witness';State.classChosen=true;}
    if(id==='more')return draw(`<p class="fc-kicker">YOUR CITY / YOUR PACE</p><h2>Make yourself at home.</h2><div class="fc-actions">${action('resident','Your resident','Change your appearance.')}${action('modes','Extra modes','Free exploration and daily shifts.')}</div><div class="fc-links"><button class="fc-link" data-action="home">Back</button></div>`);
    if(id==='resume'){closeMenu();return;}
    if(id==='home'){Slots.view='home';shFrontHome();return;}
    if(id==='resident'){closeMenu();shOpenPanel('avatar');return;}
    if(id==='modes')return draw(`<p class="fc-intro">Choose your pace.</p><div class="fc-actions">${action('new-free','Explore freely','Build and explore without story objectives or a timer.')}${action('shift','Daily shift','A timed, twenty-minute visit to the city.')}</div><div class="fc-links"><button class="fc-link" data-action="home">Back to main menu</button></div>`);
    if(id==='help')return draw(`<p class="fc-intro">Your first steps</p><div class="fc-controls">Move with <b>W A S D</b> and look with the mouse.<br>Click the game to control the camera.<br><b>E</b> — interact; hold at marked repair boxes<br><b>1 / 2 / 3</b> — weapons · left click attacks<br><b>R</b> — pick up a weapon · <b>Q</b> — role ability<br><b>V</b> — first / third person · <b>F</b> — graphics<br><b>Space</b> — jump<br><b>N</b> — dismiss a radio message<br><b>J</b> — open your field journal<br><b>Esc</b> — release the mouse and open the menu<p>Follow the gold marker for the story. Walk east to discover Makers’ Mile, claim Studio 01 at its doorway with E, then use B to build. You can return to the story at any time. Your progress saves automatically while playing.</p></div><div class="fc-links"><button class="fc-link" data-action="home">Back to main menu</button></div>`);
    shFrontAct(id);
  }
  let busy=false;
  window.fcLoad=async function(label,work){
    if(busy)return false;
    busy=true;
    const el=document.createElement('div');el.id='fc-load-status';el.setAttribute('role','status');el.textContent=label;document.body.appendChild(el);
    await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,30)));
    try{return await work();}
    catch(e){console.error('[city loading]',e);openMenu();el.innerHTML='<div>The city could not open. Your saved games have not been deleted.<br><button type="button">Back to menu</button></div>';el.querySelector('button').onclick=()=>el.remove();return false;}
    finally{busy=false;if(!el.querySelector('button'))el.remove();}
  };
  const restore=shSlotRestore;
  window.shSlotRestore=id=>fcLoad('Opening your saved city…',()=>restore(id));
  // The save list itself remains intact, including recovery and explicit deletion confirmation.
})();
