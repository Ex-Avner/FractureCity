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
  `;
  document.head.appendChild(style);
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const action=(id,title,detail,primary=false)=>`<button class="fc-action ${primary?'fc-primary':''}" data-action="${id}">${title}<small>${detail}</small></button>`;
  function draw(html){const root=document.getElementById('front-root');if(!root)return;root.innerHTML=html;root.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>act(b.dataset.action));}
  window.shFrontHome=function(){
    const live=State.chunkMap.size>0, recent=Slots.index[0];
    draw(`<p class="fc-intro">The news is becoming the problem. A Bureau test hijacks Ned’s bulletin. Take back five city systems before his next broadcast makes it worse.</p><div class="fc-actions">`+
      (live?action('resume','Resume game','Return to the city you are playing.',true):recent?action('continue','Continue game',esc(recent.name||'Your latest save'),true):'')+
      action('new-campaign',recent||live?'Start a new story':'Start story','Watch the bulletin. Hit the streets. Make the correction.',!recent&&!live)+
      action('saves','Load a saved game',`${Slots.index.length} saved ${Slots.index.length===1?'city':'cities'}`)+
      `</div><div class="fc-links"><button class="fc-link" data-action="modes">Other ways to play</button><button class="fc-link" data-action="help">How to play</button><button class="fc-link" data-action="resident">Edit resident</button></div>`);
  };
  function act(id){
    if(id==='resume'){closeMenu();return;}
    if(id==='home'){Slots.view='home';shFrontHome();return;}
    if(id==='resident'){closeMenu();shOpenPanel('avatar');return;}
    if(id==='modes')return draw(`<p class="fc-intro">Choose your pace.</p><div class="fc-actions">${action('new-free','Explore freely','Build and explore without story objectives or a timer.')}${action('shift','Daily shift','A timed, twenty-minute visit to the city.')}</div><div class="fc-links"><button class="fc-link" data-action="home">Back to main menu</button></div>`);
    if(id==='help')return draw(`<p class="fc-intro">Your first steps</p><div class="fc-controls">Move with <b>W A S D</b> and look with the mouse.<br>Click the game to control the camera.<br><b>E</b> — interact; hold at marked repair boxes<br><b>1 / 2 / 3</b> — weapons · left click attacks<br><b>R</b> — pick up a weapon · <b>Q</b> — role ability<br><b>V</b> — first / third person · <b>F</b> — graphics<br><b>Space</b> — jump<br><b>N</b> — dismiss a radio message<br><b>J</b> — open your field journal<br><b>Esc</b> — release the mouse and open the menu<p>In Story mode, follow the gold objective marker. Your progress saves automatically while playing.</p></div><div class="fc-links"><button class="fc-link" data-action="home">Back to main menu</button></div>`);
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
