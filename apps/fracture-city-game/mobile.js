// =============================================================================
//  mobile.js · THE PHONE, FINISHED
// -----------------------------------------------------------------------------
//  Section 56 of index.html gave the city a stick, a look drag and four buttons,
//  and it drove everything else by synthesising key events. That idea is right.
//  Three things stopped it working past the letter E:
//
//    1. The synthetic events carried `key` and nothing else. Every module
//       written since binds on `code`, so on a phone these never fired:
//         Q ability · R take · J casebook · N narration · H studio · U radio
//         Y next track · V camera · M map · Shift+S board · Shift+Z siege
//       The MAP chip was worse than dead: the old sound handler reads `key`,
//       so MAP muted the game instead of opening the map.
//    2. There was no way to press most letters at all. Four buttons, five chips.
//    3. Every panel hides the controls (correctly, so panels get the taps), but
//       nothing replaced them. No Escape, no way to skip a line, no arrows for
//       the terminal games. Close buttons existed on some panels and not others.
//
//  So: events now carry code, keyCode and which. A KEYS drawer reaches every
//  binding in the game. Context buttons (NEXT, TAKE, ability) appear when they
//  mean something. A small layer above every panel always offers a way out, and
//  a pad for the terminal games. The HUD is re-laid for a 980 x 453 phone
//  screen, and overlays that overflowed now scroll instead of clipping.
//
//  Loaded last. Touches nothing on desktop: every rule is under body.touch and
//  every tick returns early when Touch is off.
// =============================================================================
(function(){
  if (typeof Touch === 'undefined') return;

  // ─── 0 · The viewport ────────────────────────────────────────────────────
  // Keep controls and readers at native device width instead of shrinking a
  // desktop layout. Safe-area insets remain available; browser zoom stays usable.
  (function(){
    let m = document.querySelector('meta[name="viewport"]');
    if (!m){ m = document.createElement('meta'); m.name = 'viewport'; document.head.appendChild(m); }
    m.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
  })();

  // ─── 1 · Key events a handler can actually read ──────────────────────────
  const NAMED = {
    shift:['ShiftLeft',16], escape:['Escape',27], enter:['Enter',13], tab:['Tab',9],
    backspace:['Backspace',8], arrowup:['ArrowUp',38], arrowdown:['ArrowDown',40],
    arrowleft:['ArrowLeft',37], arrowright:['ArrowRight',39], ' ':['Space',32],
    '[':['BracketLeft',219], ']':['BracketRight',221], '-':['Minus',189], '=':['Equal',187],
  };
  function codeFor(key){
    const k = String(key);
    if (k.length === 1){
      const u = k.toUpperCase();
      if (u >= 'A' && u <= 'Z') return ['Key' + u, u.charCodeAt(0)];
      if (u >= '0' && u <= '9') return ['Digit' + u, u.charCodeAt(0)];
    }
    return NAMED[k.toLowerCase()] || ['', 0];
  }
  function send(down, key, shift, codeOverride){
    const [code, kc] = codeFor(key);
    const init = { key, code: codeOverride || code, keyCode: kc, which: kc,
                   bubbles: true, cancelable: true, shiftKey: !!shift };
    const ev = new KeyboardEvent(down ? 'keydown' : 'keyup', init);
    //  Some engines drop the legacy fields from the init dictionary.
    if (kc && ev.keyCode !== kc){
      try { Object.defineProperty(ev, 'keyCode', { get: () => kc }); } catch (e){}
      try { Object.defineProperty(ev, 'which',   { get: () => kc }); } catch (e){}
    }
    document.dispatchEvent(ev);
    return ev;
  }
  //  Replace the global the stick and the old buttons call through.
  window.shTouchKey = function(down, key, shift){ return send(down, key, shift); };
  function tap(key, shift){
    send(true, key, shift);
    setTimeout(() => send(false, key, shift), 40);
  }
  const Mobile = window.Mobile = { send, tap, codeFor };

  // ─── 2 · What each control does ──────────────────────────────────────────
  const ui = () => State.ui || {};
  const vis = id => { const e = document.getElementById(id); if (!e) return false;
    const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && e.offsetWidth > 0; };
  const pmOpen = () => !!(window.PalmMedia && PalmMedia.panelOpen);
  const hdOpen = () => { const e = document.getElementById('hd-panel'); return !!(e && e.classList.contains('on')); };
  const narrUp = () => { try { return !!(Narr.active && Narr.line); } catch (e){ return false; } };
  const transUp = () => { try { return !!Trans.active; } catch (e){ return false; } };
  const intrusionUp = () => { try { return !!(Intrusion && Intrusion.cleanup && ui().inMiniGame); } catch (e){ return false; } };
  const menuUp = () => { const m = document.getElementById('menu-overlay'); return !!(m && !m.classList.contains('hide')); };
  const fnCardUp = () => { const c = document.getElementById('fn-card'); return !!(c && c.classList.contains('on')); };
  const fnSceneUp = () => !!(window.FN && FN.scene);

  //  The map is toggled directly: sending M would also reach the sound toggle,
  //  which listens to the same letter.
  function toggleMap(){ if (typeof shMapToggle === 'function') shMapToggle(); else send(true, 'µ', false, 'KeyM'); }
  function toggleSound(){ if (typeof shSndToggle === 'function') shSndToggle(); }

  //  "Back", resolved against whatever is actually on screen, innermost first.
  function backAction(){
    const u = ui();
    if (fnSceneUp() || fnCardUp() || transUp()) return null;
    //  A field-job question (campaign-polish.js) is a modal of its own.
    if (window.FCPolish && FCPolish.modal) return { label: '✕ CLOSE', run: () => tap('Escape') };
    if (u.inArcade)   return { label: '✕ LEAVE', run: () => typeof shExitCabinet === 'function' ? shExitCabinet() : tap('Escape') };
    if (pmOpen())     return { label: '✕ CLOSE', run: () => PalmMedia.close ? PalmMedia.close() : tap('Escape') };
    if (u.inBench)    return { label: '✕ CLOSE', run: () => shBenchClose() };
    if (u.inTune)     return { label: '✕ CLOSE', run: () => shSquareTuneClose() };
    if (u.inMiniGame){
      return { label: '✕ QUIT', run: () => {
        const b = document.getElementById('mg-close-btn');
        if (b && b.offsetWidth) b.click(); else tap('Escape');
      }};
    }
    if (u.inDialogue) return { label: 'SKIP ▸▸', run: () => tap('Escape') };
    if (u.inShiftPanel) return { label: '✕ CLOSE', run: () => shClosePanel() };
    if (u.inInventory)  return { label: '✕ CLOSE', run: () => shCloseInventory() };
    if (u.inIntro)    return { label: 'SKIP ▸▸', run: () => tap('Escape') };
    if (hdOpen())     return { label: '✕ CLOSE', run: () => tap('f') };
    if (keysOpen)     return { label: '✕ CLOSE', run: () => showKeys(false) };
    //  Build panels.
    if (document.getElementById('furniture-menu') && window.FCFurniture) return { label: '✕ CLOSE', run: () => FCFurniture.close() };
    if (window.CityArt && CityArt.panelOpen)   return { label: '✕ CLOSE', run: () => CityArt.close() };
    if (window.CityBuild && CityBuild.panelOpen) return { label: '✕ CLOSE', run: () => CityBuild.close() };
    return null;
  }

  // ─── 3 · The KEYS drawer ─────────────────────────────────────────────────
  //  Every binding in the game, by what it does rather than which letter it is.
  const KEYS = [
    { h: 'STORY' },
    { k: 'J', t: 'Casebook',      run: () => tap('j') },
    { k: 'N', t: 'Next line',     run: () => tap('n') },
    { k: 'Q', t: 'Ability',       run: () => tap('q') },
    { k: 'R', t: 'Take weapon',   run: () => tap('r') },
    { k: 'E', t: 'Use / talk',    run: () => tap('e') },
    { k: '⇧E', t: 'Sit',          run: () => tap('e', true) },
    { h: 'MOVING' },
    { k: '⇧S', t: 'Skateboard',   run: () => tap('s', true) },
    { k: 'V', t: 'Camera view',   run: () => tap('v') },
    { k: 'M', t: 'Map',           run: toggleMap },
    { k: '⇧Z', t: 'Siege',        run: () => tap('z', true) },
    { h: 'GEAR' },
    { k: '1', t: 'Weapon 1',      run: () => tap('1') },
    { k: '2', t: 'Weapon 2',      run: () => tap('2') },
    { k: '3', t: 'Weapon 3',      run: () => tap('3') },
    { k: 'I', t: 'Inventory',     run: () => tap('i') },
    { k: 'B', t: 'Build mode',    run: () => tap('b') },
    { k: 'G', t: 'Free build',    run: () => tap('g') },
    { h: 'CITY' },
    { k: 'T', t: 'Post a thought', run: () => tap('t') },
    { k: 'H', t: 'Studio',        run: () => tap('h') },
    { k: 'U', t: 'Radio on/off',  run: () => tap('u') },
    { k: 'Y', t: 'Next song',     run: () => tap('y') },
    { k: 'P', t: 'Peaceful',      run: () => tap('p') },
    { h: 'SCREEN' },
    { k: 'F', t: 'Display',       run: () => tap('f') },
    { k: 'O', t: 'Detail',        run: () => tap('o') },
    { k: '[', t: 'Darker',        run: () => tap('[') },
    { k: ']', t: 'Brighter',      run: () => tap(']') },
    { k: '♪', t: 'Sound on/off',  run: toggleSound },
    { k: '☰', t: 'Menu',          run: () => tap('Escape') },
  ];
  let keysOpen = false;

  // ─── 4 · Building it ─────────────────────────────────────────────────────
  function build(){
    if (document.getElementById('mob-over')) return true;
    const layer = document.getElementById('touch-layer');
    if (!layer) return false;

    const css = document.createElement('style');
    css.id = 'mobile-css';
    css.textContent = `
      /* ── HUD, re-laid for a landscape phone (layout 980 x 453) ───────────── */
      body.touch #tc-top{left:max(12px,env(safe-area-inset-left));top:10px;transform:none;
        flex-wrap:nowrap;justify-content:flex-start;gap:5px;}
      body.touch .tc-chip{padding:8px 8px;font-size:9px;letter-spacing:1px;min-width:34px;}
      body.touch .tc-chip.mob-keys{color:#ffd47a;border-color:rgba(255,212,122,.5);}
      body.touch #hud-district{top:48px!important;bottom:auto!important;left:max(16px,env(safe-area-inset-left))!important;font-size:9px;}
      body.touch #hud-mode{display:none!important;}
      body.touch #fn-ability{top:68px;bottom:auto;left:max(14px,env(safe-area-inset-left));font-size:10px;padding:5px 8px;}
      body.touch #campaign-hud{top:104px!important;left:max(14px,env(safe-area-inset-left))!important;right:auto!important;
        width:270px!important;max-width:270px!important;max-height:150px;overflow:hidden;
        padding:8px 10px!important;transform:none!important;}
      body.touch #campaign-hud ul,body.touch #campaign-hud li{display:none!important;}
      body.touch #campaign-hud .next{margin:4px 0 0;font-size:10.5px;line-height:1.4;}
      body.touch #minimap{top:84px!important;right:max(14px,env(safe-area-inset-right))!important;
        transform:scale(.7);transform-origin:top right;}
      body.touch #hud-credits{top:12px!important;}
      body.touch #campaign-casebook,body.touch #resident-view-toggle{display:none!important;}
      body.touch #narr{top:106px!important;bottom:auto!important;width:min(500px,50vw)!important;
        pointer-events:auto!important;cursor:pointer;}

      /* ── Context buttons, beside the main cluster ───────────────────────── */
      #mob-ctx{position:absolute;right:calc(max(16px,env(safe-area-inset-right)) + 190px);
        bottom:max(16px,env(safe-area-inset-bottom));display:flex;flex-direction:column-reverse;gap:8px;
        pointer-events:none;}
      .mob-cb{pointer-events:auto;touch-action:none;width:64px;height:64px;border-radius:50%;
        background:rgba(20,14,38,.6);border:1px solid rgba(160,200,255,.35);color:#e7e2ff;
        font:600 10px/1.1 'Courier New',monospace;letter-spacing:1px;display:none;
        align-items:center;justify-content:center;text-align:center;}
      .mob-cb.on{display:flex;}
      .mob-cb:active{background:rgba(128,255,255,.3);}
      .mob-cb.next{background:rgba(70,60,20,.6);border-color:rgba(255,212,122,.6);color:#ffd47a;}
      .mob-cb.take{background:rgba(20,70,50,.6);border-color:rgba(125,255,179,.55);color:#7dffb3;}
      .mob-cb.ability{border-color:var(--fn-c,#f4bb3d);color:var(--fn-c,#f4bb3d);}
      .mob-cb.cd{opacity:.45;}
      body.touch .tc-use.held{background:rgba(255,212,122,.45);border-color:#ffd47a;color:#fff;}

      /* ── The layer above every panel ────────────────────────────────────── */
      #mob-over{position:fixed;inset:0;z-index:9500;pointer-events:none;
        font-family:'Courier New',monospace;-webkit-user-select:none;user-select:none;
        -webkit-tap-highlight-color:transparent;display:none;}
      body.touch #mob-over{display:block;}
      #mob-over button{pointer-events:auto;touch-action:manipulation;}
      #mob-back{position:absolute;left:max(10px,env(safe-area-inset-left));top:max(10px,env(safe-area-inset-top));
        display:none;padding:12px 16px;min-width:96px;background:rgba(10,6,20,.9);
        border:1px solid rgba(255,112,136,.7);color:#ffb3c0;font:600 11px/1 'Courier New',monospace;letter-spacing:2px;
        box-shadow:0 6px 18px rgba(0,0,0,.5);}
      #mob-back.on{display:block;}
      #mob-next{position:absolute;right:max(14px,env(safe-area-inset-right));bottom:max(14px,env(safe-area-inset-bottom));
        display:none;padding:18px 24px;background:rgba(40,30,8,.92);border:1px solid #ffd47a;color:#ffd47a;
        font:600 13px/1 'Courier New',monospace;letter-spacing:3px;box-shadow:0 6px 18px rgba(0,0,0,.5);}
      #mob-next.on{display:block;}
      #mob-pad{position:absolute;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));
        display:none;grid-template-columns:repeat(3,54px);grid-template-rows:repeat(2,54px);gap:6px;}
      #mob-pad.on{display:grid;}
      #mob-pad button,#mob-digits button{background:rgba(10,6,20,.88);border:1px solid rgba(128,255,255,.45);
        color:#80ffff;font:600 15px/1 'Courier New',monospace;}
      #mob-pad button:active,#mob-digits button:active{background:rgba(128,255,255,.35);color:#fff;}
      #mob-pad .up{grid-column:2;grid-row:1;} #mob-pad .lf{grid-column:1;grid-row:2;}
      #mob-pad .dn{grid-column:2;grid-row:2;} #mob-pad .rt{grid-column:3;grid-row:2;}
      #mob-digits{position:absolute;right:max(14px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));
        display:none;gap:6px;}
      #mob-digits.on{display:flex;}
      #mob-digits button{width:54px;height:54px;}
      #mob-digits button.wide{width:auto;padding:0 12px;font-size:11px;letter-spacing:2px;}

      /* ── The drawer ─────────────────────────────────────────────────────── */
      #mob-keys{position:absolute;inset:0;background:rgba(4,2,10,.86);display:none;pointer-events:auto;
        overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;}
      #mob-keys.on{display:block;}
      #mob-keys .in{max-width:900px;margin:0 auto;padding:62px max(18px,env(safe-area-inset-right)) 24px max(18px,env(safe-area-inset-left));}
      #mob-keys h5{grid-column:1/-1;margin:10px 0 2px;color:#6a608a;font:600 9px/1 'Courier New',monospace;letter-spacing:4px;}
      #mob-keys .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:7px;}
      #mob-keys .grid button{display:flex;align-items:center;gap:10px;padding:10px 10px;text-align:left;
        background:rgba(20,14,38,.9);border:1px solid rgba(160,200,255,.22);color:#e7e2ff;
        font:12px/1.2 'Courier New',monospace;letter-spacing:.5px;}
      #mob-keys .grid button:active{border-color:#80ffff;background:rgba(128,255,255,.18);}
      #mob-keys .grid b{min-width:26px;text-align:center;color:#ffd47a;font-weight:600;}

      /* ── Overlays that clipped on a short screen now scroll ─────────────── */
      body.touch #pm-panel,body.touch #minigame-overlay,body.touch #tune-overlay{
        align-items:flex-start!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch;}
      body.touch #pm-panel .in,body.touch #minigame-overlay > *,body.touch #tune-card{margin:auto!important;}
      body.touch #pm-panel .in{padding-top:52px;}
      body.touch #shift-card,body.touch #inv-card{max-height:calc(100vh - 16px)!important;}
      body.touch #shift-card,body.touch #inv-card *{-webkit-overflow-scrolling:touch;}
      body.touch .tc-chip[data-act=siege].live{background:#7a1f2a;border-color:#ff6b6b;color:#fff;}
      body.touch #maker-goal,body.touch.fc-compact #maker-goal{top:56px!important;}
      body.touch #fc-tools,body.touch.fc-compact #fc-tools{top:52px!important;right:8px!important;}
      body.touch #city-online{top:52px!important;right:8px!important;}
      body.touch #siege-bar{top:auto!important;bottom:calc(env(safe-area-inset-bottom) + 210px);pointer-events:none;padding:6px 12px;gap:10px;font-size:11px;max-width:calc(100vw - 24px);}
      body.touch:has(#city-online) #fc-tools{top:100px!important;}
      @media (max-width:520px){body.touch #tc-top{gap:4px;max-width:calc(100vw - 16px);}body.touch .tc-chip{padding:8px 5px;letter-spacing:0;min-width:30px;}}
    `;
    document.head.appendChild(css);

    // ── Chips: rebuilt so they are ours (the old ones sent M to the radio).
    const top = document.getElementById('tc-top');
    if (top){
      top.innerHTML = '';
      const chips = [
        ['☰',     'menu',  () => tap('Escape')],
        ['MAP',   'map',   toggleMap],
        ['ITEMS', 'inv',   () => tap('i')],
        ['BUILD', 'build', () => tap('b')],
        ['BOARD', 'board', () => tap('s', true)],
        ['CASE',  'case',  () => tap('j')],
        ['ZOMBIES','siege', () => typeof shSiegeToggle === 'function' && shSiegeToggle()],
        ['KEYS',  'keys',  () => showKeys(!keysOpen)],
      ];
      for (const [label, act, run] of chips){
        const b = document.createElement('button');
        b.className = 'tc-chip' + (act === 'keys' ? ' mob-keys' : '');
        b.dataset.act = act; b.textContent = label;
        bindTap(b, run);
        top.appendChild(b);
      }
    }

    // ── E is HELD, not tapped. The field jobs (campaign-polish.js) say "hold
    //  E at the breaker" and fill while the key is down. The old button sent a
    //  40ms tap, so on a phone the first repair of Chapter One could never be
    //  finished. Replaced with a clone so the old tap listener goes with it.
    const oldUse = layer.querySelector('.tc-use');
    if (oldUse){
      const use = oldUse.cloneNode(true);
      oldUse.replaceWith(use);
      let held = false;
      const release = () => { if (!held) return; held = false; use.classList.remove('held'); send(false, 'e'); };
      use.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        if (held) return;
        held = true; use.classList.add('held');
        try { use.setPointerCapture(e.pointerId); } catch (err){}
        send(true, 'e');
        update();
      });
      use.addEventListener('pointerup', release);
      use.addEventListener('pointercancel', release);
      use.addEventListener('lostpointercapture', release);
      use.addEventListener('contextmenu', e => e.preventDefault());
      //  A panel opening mid-press must not leave E stuck down.
      Mobile.releaseUse = release;
    }

    // ── Context buttons on the main layer.
    const ctx = document.createElement('div');
    ctx.id = 'mob-ctx';
    ctx.innerHTML = `
      <button class="mob-cb next"    data-m="next">NEXT<br>▸</button>
      <button class="mob-cb take"    data-m="take">TAKE</button>
      <button class="mob-cb ability" data-m="ability">Q</button>`;
    layer.appendChild(ctx);
    bindTap(ctx.querySelector('[data-m=next]'),    () => { if (typeof shNarrPush === 'function') shNarrPush(); else tap('n'); });
    bindTap(ctx.querySelector('[data-m=take]'),    () => tap('r'));
    bindTap(ctx.querySelector('[data-m=ability]'), () => tap('q'));

    //  Ned's narration box is the thing you want to tap to move it on.
    document.addEventListener('pointerdown', e => {
      if (!Touch.on) return;
      const n = e.target && e.target.closest && e.target.closest('#narr');
      if (n && narrUp()){ e.preventDefault(); shNarrPush(); }
    }, true);

    // ── The layer above everything.
    const over = document.createElement('div');
    over.id = 'mob-over';
    over.innerHTML = `
      <div id="mob-keys"><div class="in"><div class="grid"></div></div></div>
      <button id="mob-back">✕ CLOSE</button>
      <button id="mob-next">NEXT ▸</button>
      <div id="mob-pad">
        <button class="up" data-k="ArrowUp">▲</button>
        <button class="lf" data-k="ArrowLeft">◀</button>
        <button class="dn" data-k="ArrowDown">▼</button>
        <button class="rt" data-k="ArrowRight">▶</button>
      </div>
      <div id="mob-digits">
        <button data-d="1">1</button><button data-d="2">2</button><button data-d="3">3</button>
        <button class="wide" data-d="Backspace">⌫</button><button class="wide" data-d="Enter">ENTER</button>
      </div>`;
    document.body.appendChild(over);

    const grid = over.querySelector('#mob-keys .grid');
    for (const item of KEYS){
      if (item.h){ const h = document.createElement('h5'); h.textContent = item.h; grid.appendChild(h); continue; }
      const b = document.createElement('button');
      b.innerHTML = `<b>${item.k}</b><span>${item.t}</span>`;
      b.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        showKeys(false);
        //  After the drawer is gone, so the action's own panel is not
        //  opened underneath it.
        setTimeout(() => { try { item.run(); } catch (err){} }, 30);
      });
      grid.appendChild(b);
    }
    //  A tap on the dimmed backdrop, outside any key, closes the drawer.
    over.querySelector('#mob-keys').addEventListener('click', e => {
      if (e.target.id === 'mob-keys' || e.target.classList.contains('in')) showKeys(false);
    });

    bindTap(over.querySelector('#mob-back'), () => { const a = backAction(); if (a) a.run(); });
    bindTap(over.querySelector('#mob-next'), () => {
      if (ui().inDialogue && typeof shAdvanceDialogue === 'function') shAdvanceDialogue();
      else tap('Enter');
    });
    //  Arrows are HELD, not tapped: the dial game turns while you press.
    for (const b of over.querySelectorAll('#mob-pad [data-k]')){
      const k = b.dataset.k;
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); send(true, k); b._held = true; });
      const up = e => { if (!b._held) return; b._held = false; send(false, k); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    }
    for (const b of over.querySelectorAll('#mob-digits [data-d]')){
      bindTap(b, () => tap(b.dataset.d));
    }
    return true;
  }

  //  One handler per button, fired on pointerdown so it is instant, and kept
  //  away from the canvas look drag and from the old chip listeners.
  //
  //  preventDefault on pointerdown stops the emulated mouse events but NOT the
  //  click that follows the finger lifting. By then the button has usually
  //  opened something under that finger (the drawer's backdrop, a panel), and
  //  the click lands on it: the drawer closed itself the instant it opened. So
  //  the click that belongs to a tap is swallowed here.
  let swallowUntil = 0;
  window.addEventListener('click', e => {
    //  Never a deliberate tap on a drawer key: that is the next action, not
    //  the tail of the last one.
    const own = e.target && e.target.closest && e.target.closest('#mob-keys .grid button');
    if (!own && performance.now() < swallowUntil){ swallowUntil = 0; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
  }, true);
  function bindTap(b, run){
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (e.pointerType !== 'mouse') swallowUntil = performance.now() + 450;
      try { run(); } catch (err){ console.warn('[mobile]', err); }
      update(); setTimeout(update, 60);
    });
    b.addEventListener('contextmenu', e => e.preventDefault());
  }

  function showKeys(on){
    keysOpen = !!on;
    const d = document.getElementById('mob-keys');
    if (d) d.classList.toggle('on', keysOpen);
    if (keysOpen && typeof shTouchReleaseAll === 'function') shTouchReleaseAll();
  }
  Mobile.showKeys = showKeys;
  Mobile.backAction = backAction;

  // ─── 5 · Every frame, and straight after every tap ──────────────────────
  //  Run on the animation frame AND immediately after each control fires, so a
  //  slow frame never leaves a stale CLOSE button sitting on the chip you reach
  //  for next.
  function update(){
    try {
      if (Touch.on && build()){
        const u = ui();
        const layer = document.getElementById('touch-layer');
        const busyNow = typeof shTouchBusy === 'function' && shTouchBusy();
        if (layer) layer.style.display = busyNow ? 'none' : '';
        if (busyNow && Mobile.releaseUse) Mobile.releaseUse();
        const back = backAction();
        const bb = document.getElementById('mob-back');
        bb.classList.toggle('on', !!back);
        if (back && bb.textContent !== back.label) bb.textContent = back.label;

        const dlg = !!u.inDialogue;
        document.getElementById('mob-next').classList.toggle('on', dlg && !fnSceneUp());
        const zc = document.querySelector('.tc-chip[data-act=siege]'); if (zc) zc.classList.toggle('live', typeof Siege !== 'undefined' && !!Siege.active);
        const ix = intrusionUp();
        document.getElementById('mob-pad').classList.toggle('on', ix);
        document.getElementById('mob-digits').classList.toggle('on', ix);

        const busy = (typeof shTouchBusy === 'function' && shTouchBusy()) || keysOpen;
        const ctx = document.getElementById('mob-ctx');
        if (ctx && !busy){
          const set = (m, on) => { const b = ctx.querySelector(`[data-m=${m}]`); if (b) b.classList.toggle('on', !!on); return b; };
          set('next', narrUp());
          set('take', window.FN && FN._nearPickup && Player.mode === 'walk');
          const ab = document.getElementById('fn-ability');
          const abOn = !!(ab && ab.classList.contains('on'));
          const qb = set('ability', abOn);
          if (abOn && qb){
            qb.classList.toggle('cd', ab.classList.contains('cd'));
            const nm = (ab.textContent.split('·')[1] || 'ABILITY').trim().slice(0, 9);
            const lbl = 'Q\n' + nm;
            if (qb.dataset.l !== lbl){ qb.dataset.l = lbl; qb.innerHTML = 'Q<br>' + nm; }
          }
        }
        //  If a panel opened from the drawer, the drawer must not sit on it.
        if (keysOpen && (u.inShiftPanel || u.inInventory || u.inDialogue || u.inMiniGame || pmOpen())) showKeys(false);
      }
    } catch (e){}
  }
  function tick(){ update(); requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
  //  Timers keep running when frames crawl (a hot phone, a background tab).
  setInterval(update, 120);
  Mobile.update = update;

  //  Debug surface for the test.
  Mobile.state = () => ({
    back: (backAction() || {}).label || null,
    next: document.getElementById('mob-next') && document.getElementById('mob-next').classList.contains('on'),
    pad: document.getElementById('mob-pad') && document.getElementById('mob-pad').classList.contains('on'),
    keys: keysOpen,
  });
})();
