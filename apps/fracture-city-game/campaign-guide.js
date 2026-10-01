/* Campaign support: authored interactions, navigation and recoverable checkpoints.
 * Kept separate from rendering/physics; loaded before the main game script.
 * The main script owns Campaign, Slots and the twelve movement definitions. */
const CAMPAIGN_FILES = [
  {id:'q1902', name:'Q-1902 · THE FIRST', text:'“We hope the stall can replace the night shift.” Rejected: projected income cannot replace presently required employment. One household. Eleven months ago.'},
  {id:'q1931', name:'Q-1931 · THE NINTH', text:'“As required, I have retained my position.” Rejected: current work leaves insufficient hours to operate the proposed business. Same field. Different clerk.'},
  {id:'q1956', name:'Q-1956 · THE SIXTEENTH', text:'No covering letter. All forty boxes filled correctly. Rejected: continued employment is required to establish eligibility to leave employment. The Vales were next.'},
];
let campaignCheckpointTimer = null;
let campaignCheckpointChain = Promise.resolve();
let campaignMarker = null;
let campaignMarkerScene = null;

function shCampaignSilence(){
  if (typeof Campaign !== 'undefined' && Campaign._quiet){ shQuietMinute(false); Campaign._quiet = false; }
  if (typeof Narr !== 'undefined'){
    Narr.active = false; Narr.line = null; Narr.queue = []; Narr.pending = []; Narr.done = null;
    if (Narr.el) Narr.el.classList.remove('on');
  }
  if (typeof Dialogue !== 'undefined'){
    Dialogue.active = false; Dialogue.onDone = null; Dialogue.queue = [];
    State.ui.inDialogue = false;
    const el = document.getElementById('dialogue'); if (el) el.classList.remove('show');
    document.body.classList.remove('in-dialogue');
  }
}
function shCampaignCheckpointSoon(){
  clearTimeout(campaignCheckpointTimer);
  campaignCheckpointTimer = setTimeout(shCampaignCheckpoint, 250);
}
function shCampaignCheckpoint(){
  if (typeof Slots === 'undefined' || !Slots.activeId || !State.citySeed) return Promise.resolve();
  const id = Slots.activeId, seed = State.citySeed;
  campaignCheckpointChain = campaignCheckpointChain.catch(() => {}).then(async () => {
    if (Slots.activeId !== id || State.citySeed !== seed) return;
    try { await shSlotSave(id, null); }
    catch (e){ console.warn('[campaign] checkpoint failed', e); toast('Checkpoint could not save. Use Save in the menu to retry.', 'warn'); }
  });
  return campaignCheckpointChain;
}
function shCampaignResume(){
  if (!Campaign.active || Campaign.finished) return;
  const ch = shChapter(); if (!ch) return;
  delete Campaign.done['closed:' + ch.id];
  Campaign._choicePending = false;
  // An interrupted first assignment must still be delivered, not leave an
  // unsatisfiable broadcast objective behind a restored apartment gate.
  if (ch.id === 'evening' && !Campaign.done.wake){ shEnterChapter(); return; }
  // Old saves can mark a choice opened without recording the actual decision.
  if (ch.decisionKey && !Campaign.choices[ch.decisionKey]){
    delete Campaign.done['chose:' + ch.id];
    for (const o of ch.objectives) if (o.kind === 'choose') { delete Campaign.done[o.id]; delete Campaign.progress[o.id]; }
  }
  shCampaignHUD(); shCheckChapterComplete();
}
function shCampaignIntro(ch){
  if (ch.id !== 'morning') return ch.intro || [];
  const lines = {
    deny:'Marcus is back at the quarry. Clara kept the denial: “At least this one says what it did.”',
    override:'Clara has the keys. Marcus is unpacking stock. A discrepancy notice is already under the door.',
    carry:'No money came. Marcus left for the early shift. Clara has thirty days, and your name on the page.'
  };
  return [
    {who:'ned',text:'Morning. The answer you signed last night has reached an address.'},
    {who:'mara',text:lines[Campaign.caseDecision] || lines.carry},
    {who:'ned',text:'Go there. Then find Mara at the crossroads. The file ends at a signature. The people do not.'}
  ];
}
function shCampaignPanel(id){
  if (typeof Campaign === 'undefined' || !Campaign.active || Campaign.finished) return null;
  const ch = shChapter(); if (!ch) return null;
  const close = '<button class="sh-btn ghost" data-act="close">Back to the street</button>';
  if (ch.id === 'seventeen' && id === 'echo-rook'){
    return '<p class="sh-kicker">Rook’s relay / the raw index</p><h2 class="sh-card-h">Different names.<br>The same trap.</h2><p class="sh-dek">Compare each file. When all three are in your casebook, decide what seventeen households amount to.</p>' + CAMPAIGN_FILES.map(f => `<div class="sh-ev"><p>${f.name}</p><q>${f.text}</q><button class="sh-btn cyan" data-act="campaign-file" data-val="${f.id}" ${Campaign.done['file:'+f.id] ? 'disabled' : ''}>${Campaign.done['file:'+f.id] ? 'Filed in your casebook' : 'Keep this evidence'}</button></div>`).join('') + close;
  }
  if (ch.id === 'morning' && id === 'echo-mara'){
    const line = shCampaignIntro(ch)[1].text;
    return `<p class="sh-kicker">Mara / the morning after</p><h2 class="sh-card-h">Somebody lives<br>inside your answer.</h2><blockquote class="sh-quote">${shEsc(line)}</blockquote><button class="sh-btn coral" data-act="campaign-listen">Stay long enough to listen</button>${close}`;
  }
  if (ch.id === 'audit' && id === 'club' && !Campaign.done['m11-hear']){
    return '<p class="sh-kicker">The Residue Room / Auditor Vess</p><h2 class="sh-card-h">Oppose the real thing.</h2><blockquote class="sh-quote">“A form is a promise to the person who cannot get into this room. Change the broken field. Do not give the room the power to choose whose suffering counts.”</blockquote><p class="sh-dek">Hear her argument. Then leave your own sentence in this room.</p><button class="sh-btn coral" data-act="case-witness">Hear Vess out</button>' + close;
  }
  if (ch.id === 'anniversary' && id === 'fcn'){
    return '<p class="sh-kicker">FCN / fire escape</p><h2 class="sh-card-h">One minute.<br>No announcements.</h2><p class="sh-dek">Take the fire escape to the roof. The ceremony starts when you are there; you cannot miss it while finding your way. Stay for sixty seconds. J keeps the count.</p><button class="sh-btn coral" data-act="campaign-roof">Take the fire escape</button>' + close;
  }
  return null;
}
function shCampaignRoof(){
  // Stand on existing roof geometry; never teleport into an assumed floor.
  updateChunks();
  let best = null;
  for (let x = -20; x <= -5; x++) for (let z = -20; z <= -5; z++){
    for (let y = VOX_H - 4; y >= 18; y--){
      if (isSolid(getBlock(x,y,z)) && !isSolid(getBlock(x,y+1,z)) && !isSolid(getBlock(x,y+2,z))){
        if (!best || y < best.y) best = {x,y,z}; break;
      }
    }
  }
  if (!best){ toast('The roof access is obstructed. Clear a landing above FCN and try again.', 'warn'); return; }
  Player.position.set(best.x+.5,best.y+1+Player.height+.1,best.z+.5);
  if (Player.velocity) Player.velocity.set(0,0,0);
  Player.yaw = Math.PI * 0.75;
  toast('Stay for the minute. J opens the casebook and the way back down.', 'info');
}
function shCampaignAtTowerHeight(){
  return Player.position.y - Player.height >= 18 && Math.hypot(Player.position.x+12,Player.position.z+12)<22;
}
function shCampaignStreet(){
  if (!shCampaignAtTowerHeight()) return;
  const foot=shSafeFooting({x:-2.6,z:-12,y:null,indoors:false});
  Player.position.set(foot.x,foot.y+Player.height,foot.z);
  Player.velocity.set(0,0,0);
  toast('Back at the broadcast entrance. The next case is in your book.', 'info');
}
function shCampaignTarget(o){
  if (!o) return null;
  if (o.kind === 'reach'){
    if (o.id === 'm10-high') return {x:-2.6,z:-12,label:'FCN fire escape · E to enter'};
    return {x:o.x,z:o.z,y:o.y,label:o.text};
  }
  const table = {
    broadcast:['profile','Listen to the assignment · N advances subtitles'],
    witness:[shChapter().id === 'audit' ? 'club':'echo-rook','E to hear the witness'],
    evidence:['echo-rook','Rook has the three files · E to compare'],
    site:['project','Lot 09 · E to inspect the site'],
    case:['bureau','Window Three · E to sign your action'],
    hold:['bureau','E to enter HOLD; complete the seven cases'],
    residue:['club','E to enter; write and leave one sentence'],
    echo:['echo-mara','Mara · E to listen'],
    mine:['project','Hold left mouse on solid blocks · collect 12; J for controls'],
  };
  if (o.kind === 'hold' && shChapter().id === 'anniversary'){
    if (Player.position.y-Player.height<18) return {x:-2.6,z:-12,label:'Return to the observation deck · E at FCN; your time is kept'};
    return {x:Player.position.x,z:Player.position.z,label:`Keep the minute · ${Math.ceil(60-(Campaign.progress['quiet-seconds']||0))}s remaining`};
  }
  if (o.kind === 'vehicle'){
    const cars = [...State.chunkMap.values()].flatMap(c=>c.parkedCars||[]);
    const car = cars.find(c=>c.storyVehicle) || cars.sort((a,b)=>a.position.distanceTo(Player.position)-b.position.distanceTo(Player.position))[0];
    if (car) return {x:car.position.x,z:car.position.z,label:'Municipal Recovery · E to enter'};
  }
  if (o.kind === 'drive') return {x:0,z:0,label:'WASD to drive · cover 80m, then return to the crossroads'};
  const entry = o.kind === 'panel' ? [o.target,'E to enter'] : table[o.kind];
  const spot = entry && SH_HOTSPOTS.find(h=>h.id===entry[0]);
  return spot ? {x:spot.x,z:spot.z,label:entry[1]} : null;
}
function shCampaignCasebook(){
  const ch = shChapter();
  if (!ch) return '<h2>No open case</h2>';
  const o = shNextObjective(), target = shCampaignTarget(o);
  const decision = LOAN_DECISIONS.find(d=>d.id===Campaign.caseDecision);
  const choices = Object.values(Campaign.choices || {});
  return `<p class="sh-kicker">Casebook · movement ${Campaign.chapter+1} / ${CAMPAIGN.length}</p>
    <h2 class="sh-card-h">${shEsc(ch.title)}</h2><p class="sh-dek">${shEsc(ch.open)}</p>
    <blockquote class="sh-quote">${shEsc(o ? o.text : 'Movement complete. Return to the street to continue.')}${target ? '<br><small>'+shEsc(target.label)+'</small>' : ''}</blockquote>
    <p class="sh-note">WASD move · mouse look · E interact · Space jump · Shift sprint · hold left mouse to mine · N advance narration · J casebook. The gold beacon marks your next destination. Time in the story is not a failure timer.</p>
    <div class="sh-rule"></div><p class="sh-kicker">Your record</p>
    ${decision ? '<p class="sh-dek">'+shEsc(decision.consequence)+'</p>' : '<p class="sh-note">Q-1957 is still awaiting your decision.</p>'}
    ${choices.map(v=>'<p class="sh-note">'+shEsc(v.replace(/-/g,' '))+'</p>').join('')}
    ${CAMPAIGN_FILES.filter(f=>Campaign.done['file:'+f.id]).map(f=>'<div class="sh-ev"><p>'+f.name+'</p><q>'+f.text+'</q></div>').join('')}
    <details><summary>Read the current briefing</summary>${shCampaignIntro(ch).map(l=>'<p class="sh-dek"><strong>'+shEsc(l.who.toUpperCase())+'</strong> '+shEsc(l.text)+'</p>').join('')}</details>
    ${shCampaignAtTowerHeight() ? '<button class="sh-btn cyan" data-act="campaign-street">Take the fire escape down</button>' : ''}
    <button class="sh-btn coral" data-act="close">Back to the case</button>`;
}
function shCampaignGuideTick(dt){
  const active = Campaign.active && !Campaign.finished;
  const button = document.getElementById('campaign-casebook'); if (button) button.hidden = !active;
  if (!active){ if (campaignMarker) campaignMarker.visible=false; return; }
  const target = shCampaignTarget(shNextObjective());
  if (!target || !State.scene){ if (campaignMarker) campaignMarker.visible=false; return; }
  if (!campaignMarker){
    campaignMarker = new THREE.Mesh(new THREE.ConeGeometry(.45,1.15,6),new THREE.MeshBasicMaterial({color:0xffd47a,transparent:true,opacity:.85,depthTest:false}));
    campaignMarker.rotation.z=Math.PI; campaignMarker.renderOrder=900;
  }
  if (campaignMarkerScene !== State.scene){
    if (campaignMarkerScene) campaignMarkerScene.remove(campaignMarker);
    State.scene.add(campaignMarker); campaignMarkerScene=State.scene;
  }
  const distance=Math.hypot(Player.position.x-target.x,Player.position.z-target.z);
  campaignMarker.visible=distance>2 && shNextObjective().kind!=='hold';
  campaignMarker.position.set(target.x,(target.y||0)+3.5+Math.sin(performance.now()/350)*.2,target.z);
}
document.addEventListener('DOMContentLoaded',()=>{
  const button=document.createElement('button');button.id='campaign-casebook';button.textContent='J · CASEBOOK';button.hidden=true;
  button.style.cssText='position:fixed;right:20px;bottom:100px;z-index:58;padding:10px 14px;background:#160f25;color:#ffd47a;border:1px solid #ffd47a;font:12px monospace;cursor:pointer';
  const toggle=()=>{
    if (typeof Campaign==='undefined'||!Campaign.active||Campaign.finished||State.ui.inIntro||State.ui.paused||State.ui.inMiniGame||State.ui.inInventory||Dialogue.active) return;
    if (Shift.panel==='casebook') shClosePanel(); else if (!State.ui.inShiftPanel) shOpenPanel('casebook');
  };
  button.onclick=toggle;document.body.appendChild(button);
  document.addEventListener('keydown',e=>{
    if (e.repeat || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
    if (e.code==='KeyJ'){e.preventDefault();toggle();}
    if (e.code==='KeyN' && !e.repeat && !State.ui.inShiftPanel && !State.ui.paused) shNarrPush();
  });
});
