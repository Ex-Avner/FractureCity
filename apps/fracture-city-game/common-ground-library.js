/* Common Ground: a theory library and a listening booth, on the square where
   the Main Beta arrives. Both are physical kiosks between the arrival point and
   the gallery. Walk up, press E (or tap the prompt), read or listen.

   The library reads The Collapse of Meaning from the Works app's book.json,
   served by whichever server is hosting the game, so a redeploy updates it for
   everyone. The booth plays the bundled soundtrack through Palm Radio, so each
   player hears it on their own radio, at their own volume, from the first track
   they choose. Nothing here plays without a tap or key press. */
(function(){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
//  Between the Main Beta arrival (x≈155, z≈24) and the gallery (z=36), facing arrivals.
const KIOSKS=[
 {id:'library',x:155,z:28.5,label:'E · Theory library / The Collapse of Meaning',kick:'COMMON GROUND  /  THEORY LIBRARY',title:'The Collapse of Meaning',sub:'Read the book, chapter by chapter.',bg:'#132632',ink:'#e2f2f3',band:'#254653',bandInk:'#90e6dc'},
 {id:'booth',x:179,z:28.5,label:'E · Listening booth / original tracks',kick:'COMMON GROUND  /  LISTENING BOOTH',title:'Original music.',sub:'Choose a track. It plays on your own radio.',bg:'#232536',ink:'#f1e9cf',band:'#393c54',bandInk:'#d2c5ff'}
];
const BOOK_URL=()=>location.pathname.startsWith('/city/')?'/apps/works/data/book.json':new URL('../works/data/book.json',location.href).href;
let root=null,scene=null,visible=false,near=null,panel=null,kind=null,priorPause=false,oldFocus=null,book=null,bookError='',loadingBook=null,chapter=0;
try{chapter=Math.max(0,Number(localStorage.getItem('fc-cg-chapter'))||0)}catch(e){}

const prompt=document.createElement('button');prompt.id='cg-approach';prompt.hidden=true;prompt.onclick=()=>near&&open(near.id);document.body.append(prompt);
const css=document.createElement('style');css.textContent=`
#cg-approach{position:fixed;bottom:110px;left:50%;transform:translateX(-50%);z-index:125001;border:1px solid #e7bd78;border-radius:30px;padding:13px 22px;background:#1b1626;color:#f3ecd8;font:14px system-ui;cursor:pointer}
#cg-approach[hidden]{display:none}
body.cg-near #maker-interact{display:none!important}
body.cg-reading #city-online,body.cg-reading #maker-goal,body.cg-reading .social-dock{visibility:hidden}
.cg-panel{position:fixed;inset:5vh max(12px,calc((100vw - 1060px)/2));z-index:140000;display:grid;grid-template-columns:260px 1fr;border-radius:22px;overflow:hidden;box-shadow:0 0 0 100vmax #07060ba8,0 24px 100px #0009;font:15px/1.5 system-ui}
.cg-panel *{box-sizing:border-box}
.cg-panel button,.cg-panel select{font:inherit;cursor:pointer;min-height:42px;border-radius:20px;padding:8px 14px;border:1px solid currentColor;background:transparent;color:inherit}
.cg-panel aside{padding:26px 20px;display:flex;flex-direction:column;gap:14px;min-height:0}
.cg-panel aside h2{margin:0;font:600 30px/1.02 Georgia,serif;letter-spacing:-.5px}
.cg-panel small{font:11px/1.6 monospace;letter-spacing:.08em}
.cg-panel main{overflow:auto;overscroll-behavior:contain;padding:30px clamp(18px,5vw,64px);min-height:0}
#cg-library{background:#f4efe2;color:#1f2b28;border:1px solid #b9b39f}
#cg-library aside{background:#173b36;color:#f1e9cf}
#cg-library nav{overflow:auto;display:flex;flex-direction:column;gap:4px;min-height:0;flex:1}
#cg-library nav button{flex-shrink:0;border:0;border-radius:10px;text-align:left;min-height:36px;padding:6px 10px;font-size:13px;line-height:1.35}
#cg-library nav button[aria-current=true]{background:#f1e9cf;color:#173b36}
#cg-library select{display:none;background:#f1e9cf;color:#173b36}
#cg-library article{max-width:680px;margin:0 auto}
#cg-library article .kick{font:11px monospace;letter-spacing:.2em;color:#5b6f66}
#cg-library article h3{font:600 34px/1.1 Georgia,serif;margin:8px 0 6px}
#cg-library article .subt{font:italic 18px Georgia,serif;color:#4c5e57;margin:0 0 6px}
#cg-library article .div{color:#b48a3c;letter-spacing:10px;margin:14px 0 22px}
#cg-library article p.body{font:18px/1.75 Georgia,serif;margin:0 0 1.05em}
#cg-library footer{display:flex;justify-content:space-between;gap:10px;max-width:680px;margin:30px auto 10px}
#cg-booth{background:#14121c;color:#f1e9cf;border:1px solid #4a3f5c}
#cg-booth aside{background:#e7bd78;color:#14121c}
#cg-booth ol{list-style:none;padding:0;margin:0;display:grid;gap:8px}
#cg-booth li button{width:100%;display:flex;gap:14px;align-items:center;text-align:left;border-radius:14px;border-color:#4a3f5c}
#cg-booth li button[aria-current=true]{border-color:#e7bd78;background:#2a2335}
#cg-booth li b{font:12px monospace;color:#e7bd78;min-width:22px}
#cg-booth .now{font:600 20px Georgia,serif;margin:0 0 16px}
#cg-booth .controls{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}
@media(max-width:700px){.cg-panel{inset:8px;grid-template-columns:1fr;grid-template-rows:auto 1fr;border-radius:16px}.cg-panel aside{padding:14px 16px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px}.cg-panel aside h2{font-size:22px}.cg-panel aside p,.cg-panel aside>small{display:none}#cg-library nav{display:none}#cg-library select{display:block;grid-column:1/-1;width:100%}.cg-panel main{padding:18px}#cg-library article h3{font-size:26px}#cg-library article p.body{font-size:17px}}`;
document.head.append(css);

// ─── The kiosks ─────────────────────────────────────────────────────────────
function sign(k){const c=document.createElement('canvas');c.width=900;c.height=620;const g=c.getContext('2d');g.fillStyle=k.bg;g.fillRect(0,0,900,620);g.fillStyle=k.band;g.fillRect(0,0,900,92);g.fillStyle=k.bandInk;g.font='26px monospace';g.fillText(k.kick,34,57);g.fillStyle=k.ink;g.font='500 68px system-ui';let y=210,line='';for(const w of k.title.split(' ')){if(g.measureText(line+' '+w).width>820&&line){g.fillText(line,34,y);y+=82;line=''}line+=(line?' ':'')+w}g.fillText(line,34,y);g.font='32px system-ui';g.fillText(k.sub,34,y+80);g.fillStyle=k.band;g.fillRect(0,548,900,72);g.fillStyle=k.bandInk;g.font='26px monospace';g.fillText('WALK CLOSE  →  PRESS E',34,594);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}
function build(){if(!State.scene||scene===State.scene&&root?.parent)return;dispose();scene=State.scene;root=new THREE.Group();root.name='common-ground-library';
 for(const k of KIOSKS){const g=new THREE.Group();g.position.set(k.x,1,k.z);g.name='cg-'+k.id;
  const dark=new THREE.MeshStandardMaterial({color:0x1d2229,roughness:.8});
  const base=new THREE.Mesh(new THREE.BoxGeometry(2.6,.18,.9),dark);base.position.y=.09;g.add(base);
  for(const x of [-1.15,1.15]){const post=new THREE.Mesh(new THREE.BoxGeometry(.12,3.1,.12),dark);post.position.set(x,1.55,0);g.add(post)}
  const board=new THREE.Mesh(new THREE.PlaneGeometry(2.25,1.55),new THREE.MeshBasicMaterial({map:sign(k)}));board.position.set(0,2.25,-.07);board.rotation.y=Math.PI;g.add(board);
  const back=new THREE.Mesh(new THREE.BoxGeometry(2.36,1.66,.08),dark);back.position.set(0,2.25,0);g.add(back);
  const lamp=new THREE.Mesh(new THREE.BoxGeometry(2.36,.08,.3),new THREE.MeshBasicMaterial({color:k.id==='booth'?0xe7bd78:0xd7f7aa}));lamp.position.set(0,3.1,-.1);g.add(lamp);
  g.scale.setScalar(.82);root.add(g)}
 scene.add(root)}
function dispose(){if(!root)return;root.removeFromParent();root.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose()});root=null}

// ─── The library ────────────────────────────────────────────────────────────
function loadBook(){if(book||loadingBook)return loadingBook;bookError='';loadingBook=fetch(BOOK_URL(),{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('status '+r.status);return r.json()}).then(b=>{if(!Array.isArray(b?.chapters)||!b.chapters.length)throw Error('empty');book=b;chapter=Math.min(chapter,b.chapters.length-1)}).catch(()=>{bookError='The library could not load the book. Check your connection and try again.'}).finally(()=>{loadingBook=null;if(kind==='library')render()});return loadingBook}
function libraryHTML(){
 if(!book)return `<aside><h2>Theory<br>library.</h2><button data-close>Back to street ×</button></aside><main><article><p class="kick">COMMON GROUND / THEORY LIBRARY</p><h3>${bookError?'The shelf is out of reach.':'Opening the book…'}</h3><p class="body">${esc(bookError||'One moment.')}</p>${bookError?'<button data-retry>Try again</button>':''}</article></main>`;
 const ch=book.chapters[chapter],n=book.chapters.length;
 return `<aside><h2>${esc(book.title)}</h2><small>${esc(book.subtitle||'')}</small><small>BY ${esc(String(book.author||'').toUpperCase())}</small><select aria-label="Chapter">${book.chapters.map((c,i)=>`<option value="${i}"${i===chapter?' selected':''}>${i+1}. ${esc(c.title)}</option>`).join('')}</select><nav aria-label="Chapters">${book.chapters.map((c,i)=>`<button data-ch="${i}" aria-current="${i===chapter}">${i+1}. ${esc(c.title)}</button>`).join('')}</nav><button data-close>Back to street ×</button></aside>
 <main><article><p class="kick">CHAPTER ${chapter+1} OF ${n}</p><h3>${esc(ch.title)}</h3>${ch.subtitle?`<p class="subt">${esc(ch.subtitle)}</p>`:''}<p class="div">◆ ◆ ◆</p>${(ch.paragraphs||[]).map(p=>`<p class="body">${esc(p)}</p>`).join('')}</article>
 <footer><button data-step="-1"${chapter?'':' disabled'}>← Previous</button><button data-step="1"${chapter<n-1?'':' disabled'}>Next chapter →</button></footer></main>`}
function goChapter(i){if(!book)return;chapter=Math.max(0,Math.min(book.chapters.length-1,i));try{localStorage.setItem('fc-cg-chapter',String(chapter))}catch(e){}render();panel?.querySelector('main')?.scrollTo(0,0);panel?.querySelector('[data-ch="'+chapter+'"]')?.scrollIntoView({block:'nearest'})}

// ─── The booth ──────────────────────────────────────────────────────────────
const PM=()=>window.PalmMedia;
function playing(){const pm=PM();return pm?.audio&&!pm.audio.paused?pm.order?.[pm.pos]:-1}
function boothHTML(){const pm=PM(),tracks=pm?.music||[],cur=playing(),now=cur>=0?tracks[cur]:null;
 return `<aside><h2>Listening<br>booth.</h2><p>Original tracks, free to hear on the square.</p><small>PLAYS ON YOUR OWN PALM RADIO</small><button data-close>Back to street ×</button></aside>
 <main><p class="now" role="status">${now?'Now playing: '+esc(now.title):tracks.length?'Choose a track to start.':'Loading the tracks…'}</p>
 <div class="controls">${tracks.length?`<button data-toggle>${cur>=0?'Pause':'Play'}</button><button data-next>Next track</button>`:''}</div>
 <ol>${tracks.map((t,i)=>`<li><button data-track="${i}" aria-current="${i===cur}"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(t.title)}</span></button></li>`).join('')}</ol>
 ${tracks.length?'':'<p>No tracks are available in this edition yet.</p>'}</main>`}
function playTrack(i){const pm=PM();if(!pm)return;if(!pm.order?.length||pm.order.indexOf(i)<0){pm.order=pm.music.map((_,n)=>n)}pm.pos=pm.order.indexOf(i)-1;pm.next();setTimeout(render,250)}

// ─── Panel ──────────────────────────────────────────────────────────────────
function render(){if(!panel)return;const focus=document.activeElement?.dataset;panel.innerHTML=kind==='library'?libraryHTML():boothHTML();
 panel.querySelector('[data-close]').onclick=close;
 panel.querySelector('[data-retry]')?.addEventListener('click',()=>{bookError='';render();loadBook()});
 panel.querySelectorAll('[data-ch]').forEach(b=>b.onclick=()=>goChapter(+b.dataset.ch));
 const sel=panel.querySelector('select');if(sel)sel.onchange=()=>goChapter(+sel.value);
 panel.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>goChapter(chapter+Number(b.dataset.step)));
 panel.querySelectorAll('[data-track]').forEach(b=>b.onclick=()=>playTrack(+b.dataset.track));
 panel.querySelector('[data-toggle]')?.addEventListener('click',()=>{PM()?.play();setTimeout(render,250)});
 panel.querySelector('[data-next]')?.addEventListener('click',()=>{PM()?.next();setTimeout(render,250)});
 //  Keep keyboard focus where it was after a re-render.
 if(focus){const key=Object.keys(focus)[0];if(key){const again=panel.querySelector(`[data-${key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}="${focus[key]}"]`);again?.focus()}}}
function open(which){if(panel||!visible)return;kind=which;oldFocus=document.activeElement;priorPause=State.ui.paused;State.ui.paused=true;State.keys.clear();document.exitPointerLock?.();document.body.classList.add('cg-reading');
 panel=document.createElement('section');panel.id=which==='library'?'cg-library':'cg-booth';panel.className='cg-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',which==='library'?'Theory library':'Listening booth');document.body.append(panel);render();panel.querySelector('[data-close]').focus();
 if(which==='library')loadBook();else if(!PM()?.music?.length)PM()?.refresh?.().then(()=>kind==='booth'&&render())}
function close(){if(!panel)return;panel.remove();panel=null;kind=null;document.body.classList.remove('cg-reading');State.ui.paused=priorPause;State.keys.clear();oldFocus?.focus?.()}
window.addEventListener('keydown',e=>{if(panel){if(e.code==='Escape')close();else if(e.code==='Tab'){const nodes=[...panel.querySelectorAll('button:not([disabled]),select')],i=nodes.indexOf(document.activeElement);e.preventDefault();nodes[(i+(e.shiftKey?-1:1)+nodes.length)%nodes.length]?.focus()}else if(kind==='library'&&book&&!/SELECT/.test(e.target.tagName)&&(e.code==='ArrowRight'||e.code==='ArrowLeft')){goChapter(chapter+(e.code==='ArrowRight'?1:-1))}e.stopImmediatePropagation();return}if(e.code==='KeyE'&&!e.repeat&&!prompt.hidden&&near){e.preventDefault();e.stopImmediatePropagation();open(near.id)}},true);

function blocked(){return State.ui.paused||State.ui.inArcade||State.ui.inDialogue||window.CityArt?.panelOpen||window.CityBuild?.panelOpen||window.FCAccounts?.visible||window.FCNewsHub?.isOpen||window.CitySocial?.writing||window.OwnBlock?.modal}
function tick(){requestAnimationFrame(tick);try{visible=!!window.OwnBlock?.ready&&OwnBlock.state.enabled&&!State.ui.inIntro;near=null;
 if(visible){build();const feet=Player.position.y-Player.height;for(const k of KIOSKS)if(Math.hypot(Player.position.x-k.x,Player.position.z-(k.z-1.6))<2.6&&Math.abs(feet-1)<2){near=k;break}}
 if(root)root.visible=visible;const show=!!near&&!panel&&!blocked();if(show&&prompt.textContent!==near.label)prompt.textContent=near.label;prompt.hidden=!show;document.body.classList.toggle('cg-near',show);
 if(panel&&kind==='booth'){const cur=playing();if(cur!==panel._cur){panel._cur=cur;render()}}}catch(e){}}
requestAnimationFrame(tick);
window.FCCommonGround={kiosks:KIOSKS.map(k=>({id:k.id,x:k.x,z:k.z,approach:{x:k.x,z:k.z-1.6}})),open,close,get isOpen(){return !!panel},get kind(){return kind},get near(){return near?.id||null},get chapter(){return chapter},get book(){return book},get root(){return root}};
})();
