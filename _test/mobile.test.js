//  The phone, driven by real touches.
//
//  A landscape phone (touch, mobile viewport), the campaign past the prologue,
//  and then every control a player reaches with a thumb: the chips, the KEYS
//  drawer, the context buttons, the BACK and NEXT layer over panels, the pad
//  in the terminal games, the stick. Each check taps the actual on-screen
//  element with the touchscreen and asserts the game did the thing, and that
//  the key events it synthesised carry `code`, which is what was missing.
//
//    node mobile.test.js [repoRoot]

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { Checks, watch, serve, LAUNCH_ARGS } = require('./lib/harness');
const { PHONE, skipPrologue } = require('./lib/mobile-drive');

const ROOT = process.argv[2] || path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const EXE = process.env.PW_CHROMIUM || undefined;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const c = new Checks('mobile.test.js — ' + ROOT);
  //  GAME_PATH and the _headers file let this run against a built zip, under
  //  the CSP Netlify will send.
  const site = await serve(ROOT, { headersFile: path.join(ROOT, '_headers') });
  const GAME = process.env.GAME_PATH || '/apps/fracture-city-game/index.html';
  const browser = await chromium.launch(Object.assign({ args: LAUNCH_ARGS }, EXE ? { executablePath: EXE } : {}));
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  const w = watch(page, site.origin);
  const shot = n => page.screenshot({ path: path.join(OUT, 'mob-' + n + '.png') }).catch(() => {});
  const ev = f => page.evaluate(f);
  const wait = ms => page.waitForTimeout(ms);
  //  Tap the centre of whatever matches, as a finger would.
  async function tapEl(sel){
    //  Wait for it: the layer comes back on the next animation frame, and a
    //  headless frame can be slow.
    await poll(s => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); if (!b.width) return false;
      const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!(t && (t === e || e.contains(t))); }, 3000, sel);
    const r = await page.evaluate(s => {
      const e = document.querySelector(s); if (!e) return null;
      const b = e.getBoundingClientRect(); if (!b.width) return null;
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }, sel);
    if (!r) return false;
    //  Coordinates are CSS px of the 980-wide layout; the touchscreen speaks the
    //  same units because the page reports them.
    await page.touchscreen.tap(r.x, r.y);
    return true;
  }
  async function poll(fn, ms = 7000, arg){
    const t0 = Date.now();
    while (Date.now() - t0 < ms){ if (await page.evaluate(fn, arg)) return true; await wait(60); }
    return false;
  }
  async function drawer(label){
    await tapEl('.tc-chip[data-act="keys"]');
    await poll(() => Mobile.state().keys, 7000);
    const r = await page.evaluate(l => {
      const b = [...document.querySelectorAll('#mob-keys .grid button')].find(x => x.querySelector('span').textContent === l);
      if (!b) return null; b.scrollIntoView({ block: 'center' });
      const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
    }, label);
    if (!r) return false;
    await page.touchscreen.tap(r.x, r.y);
    await wait(250);
    return true;
  }

  try {
    await page.goto(site.origin + GAME, { waitUntil: 'load' });
    await wait(2500);
    const boot = await ev(() => ({ touch: Touch.on, over: !!document.getElementById('mob-over'),
      vp: (document.querySelector('meta[name=viewport]') || {}).content, w: innerWidth, mobile: !!window.Mobile }));
    c.ok('touch mode on', boot.touch);
    c.ok('mobile.js loaded and built', boot.mobile && boot.over);
    c.ok('viewport tag set', /width=980/.test(boot.vp || '') && /viewport-fit=cover/.test(boot.vp || ''), boot.vp);
    c.eq('layout width', boot.w, 980);

    c.ok('prologue skipped', await skipPrologue(page));
    await wait(1500);
    //  Record every key event the page sees from here on.
    await ev(() => { window.__keys = []; document.addEventListener('keydown', e => __keys.push(e.code + '|' + e.key + '|' + e.keyCode), true); });
    await shot('1-hud');

    // ── Layout: nothing important sits on top of anything else ───────────
    const lay = await ev(() => {
      const R = id => { const e = document.getElementById(id); if (!e) return null; const s = getComputedStyle(e);
        if (s.display === 'none' || s.visibility === 'hidden') return null; const b = e.getBoundingClientRect(); return b.width ? b : null; };
      const hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const on = (a) => a && a.left >= 0 && a.top >= 0 && a.right <= innerWidth + 1 && a.bottom <= innerHeight + 1;
      const top = R('tc-top'), ob = R('ob-hud'), time = R('hud-time'), ch = R('campaign-hud'), mm = R('minimap'),
            acts = R('tc-acts'), stick = R('tc-stick'), wpn = R('hud-weapons'), ab = R('fn-ability'), dist = R('hud-district'),
            cr = R('hud-credits'), mctx = R('mob-ctx');
      return {
        chipsVsCounter: hit(top, ob), chipsVsTime: hit(top, time), objVsMap: hit(ch, mm), objVsStick: hit(ch, stick),
        abVsObj: hit(ab, ch), distVsChips: hit(dist, top), mapVsActs: hit(mm, acts), mapVsCredits: hit(mm, cr),
        ctxVsWeapons: hit(mctx, wpn), ctxVsActs: hit(mctx, acts),
        onScreen: [top, ch, mm, acts, stick, wpn].every(on),
        casebookBtnHidden: !R('campaign-casebook'),
      };
    });
    for (const [k, v] of Object.entries(lay)){
      if (k === 'onScreen' || k === 'casebookBtnHidden') c.ok('layout: ' + k, v);
      else c.ok('layout: no overlap ' + k, !v);
    }

    // ── Chips ────────────────────────────────────────────────────────────
    await ev(() => { window.__map = 0; const o = window.shMapToggle; window.shMapToggle = function(){ __map++; return o.apply(this, arguments); }; window.__snd = Snd.on; });
    await tapEl('.tc-chip[data-act="map"]'); await wait(200);
    const mapR = await ev(() => ({ map: __map, sndSame: Snd.on === __snd }));
    c.eq('MAP chip toggles the map', mapR.map, 1);
    c.ok('MAP chip does not mute the sound', mapR.sndSame);
    await tapEl('.tc-chip[data-act="map"]'); await wait(150);

    await tapEl('.tc-chip[data-act="case"]');
    c.ok('CASE chip opens the casebook (KeyJ)', await poll(() => State.ui.inShiftPanel && Shift.panel === 'casebook'));
    c.ok('synthetic J carries code', await ev(() => __keys.some(k => k.startsWith('KeyJ|j|74'))), await ev(() => __keys.slice(-3).join(' ')));
    c.ok('BACK shows over the casebook', await poll(() => Mobile.state().back === '✕ CLOSE'));
    await shot('2-casebook');
    const scroll = await ev(() => { const s = document.getElementById('shift-card'); return s.scrollHeight <= s.clientHeight + 2 || getComputedStyle(s).overflowY === 'auto'; });
    c.ok('casebook scrolls if it overflows', scroll);
    await tapEl('#mob-back');
    c.ok('BACK closes the casebook', await poll(() => !State.ui.inShiftPanel));

    await tapEl('.tc-chip[data-act="inv"]');
    c.ok('ITEMS chip opens the inventory', await poll(() => State.ui.inInventory), await ev(() => __keys.slice(-4).join(' ') + ' ' + JSON.stringify(State.ui) + document.getElementById('touch-layer').style.display));
    await tapEl('#mob-back');
    c.ok('BACK closes the inventory', await poll(() => !State.ui.inInventory));

    await tapEl('.tc-chip[data-act="menu"]');
    c.ok('☰ chip opens the menu', await poll(() => State.ui.paused));
    await shot('3-menu');
    //  The front menu's own Resume is the way back; it must be on screen.
    const resume = await ev(() => { const b = [...document.querySelectorAll('button, [role=button], .fm-card, a')].find(x => /resume/i.test(x.textContent) && x.offsetWidth);
      if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, on: r.bottom <= innerHeight }; });
    c.ok('menu Resume is on screen', resume && resume.on);
    if (resume) await page.touchscreen.tap(resume.x, resume.y);
    c.ok('Resume returns to the city', await poll(() => !State.ui.paused, 5000));

    // ── The KEYS drawer ──────────────────────────────────────────────────
    await tapEl('.tc-chip[data-act="keys"]');
    c.ok('KEYS opens the drawer', await poll(() => Mobile.state().keys, 7000));
    await shot('4-keys');
    const drawerFit = await ev(() => { const d = document.querySelector('#mob-keys'); return d.scrollHeight > 0 && document.querySelectorAll('#mob-keys .grid button').length; });
    c.gt('drawer lists the bindings', drawerFit, 25);
    await tapEl('#mob-back');
    c.ok('BACK closes the drawer', await poll(() => !Mobile.state().keys, 7000));

    //  Each of these was dead on a phone, because it binds on code.
    const before = await ev(() => FCResident.thirdPerson);
    await drawer('Camera view');
    await wait(300);
    c.ok('drawer V switches the camera', await ev(b => FCResident.thirdPerson !== b, before));
    await drawer('Camera view'); await wait(200);

    await drawer('Studio');
    c.ok('drawer H opens the studio', await poll(() => PalmMedia.panelOpen));
    await shot('5-studio');
    const studio = await ev(() => { const p = document.getElementById('pm-panel'); const i = p.querySelector('.in'); const r = i.getBoundingClientRect();
      p.scrollTop = 1e6; const r2 = i.getBoundingClientRect(); return { topOn: r.top >= -1, bottomReach: r2.bottom <= innerHeight + 2 }; });
    c.ok('studio top on screen', studio.topOn);
    c.ok('studio bottom reachable by scrolling', studio.bottomReach);
    await tapEl('#mob-back');
    c.ok('BACK closes the studio', await poll(() => !PalmMedia.panelOpen));

    await ev(() => { window.__q = __keys.length; });
    await drawer('Ability');
    c.ok('drawer Q sends KeyQ', await ev(() => __keys.slice(__q).some(k => k.startsWith('KeyQ|q|81'))));
    await drawer('Casebook');
    c.ok('drawer J opens the casebook', await poll(() => State.ui.inShiftPanel));
    await tapEl('#mob-back'); await poll(() => !State.ui.inShiftPanel);

    await ev(() => { window.__st = 0; });
    await drawer('Skateboard');
    c.ok('drawer Shift+S mounts the board', await poll(() => Board.on, 7000));
    await wait(300);
    await ev(() => { Board.vx = Board.vz = 0; });
    await drawer('Skateboard');
    await poll(() => !Board.on, 7000);

    // ── Context buttons ──────────────────────────────────────────────────
    const abil = await ev(() => { const a = document.getElementById('fn-ability'); return !!(a && a.classList.contains('on')); });
    if (abil){
      c.ok('ability button shows with a class', await poll(() => document.querySelector('.mob-cb.ability').classList.contains('on'), 7000));
      await ev(() => { window.__q = __keys.length; });
      await tapEl('.mob-cb.ability');
      c.ok('ability button sends KeyQ', await ev(() => __keys.slice(__q).some(k => k.startsWith('KeyQ'))));
    }
    await ev(() => shNarrate([{ who: 'ned', text: 'Testing, one, two. This is a long enough line that it types out slowly.' }, { who: 'ned', text: 'Second line.' }]));
    c.ok('NEXT shows while Ned is talking', await poll(() => document.querySelector('.mob-cb.next').classList.contains('on'), 7000));
    await shot('6-narr');
    const l0 = await ev(() => Narr.line && Narr.line.text);
    await tapEl('.mob-cb.next'); await wait(100); await tapEl('.mob-cb.next');
    c.ok('NEXT moves the narration on', await poll(t => !Narr.line || Narr.line.text !== t, 1500, l0));
    const l1 = await ev(() => Narr.line && Narr.line.text + '|' + Narr.chars);
    await tapEl('#narr');
    c.ok('tapping the narration box moves it on', await poll(t => !Narr.line || (Narr.line.text + '|' + Narr.chars) !== t, 7000, l1));

    // ── Dialogue: NEXT and SKIP above the dialogue box ───────────────────
    await ev(() => { Dialogue.queue = [{ who: 'ned', text: 'One.' }, { who: 'ned', text: 'Two.' }, { who: 'ned', text: 'Three.' }];
      Dialogue.onDone = null; Dialogue.active = true; State.ui.inDialogue = true; document.getElementById('dialogue').classList.add('show'); shAdvanceDialogue(); });
    c.ok('NEXT button over dialogue', await poll(() => Mobile.state().next, 7000));
    c.eq('BACK reads SKIP in dialogue', await ev(() => Mobile.state().back), 'SKIP ▸▸');
    await shot('7-dialogue');
    const q0 = await ev(() => Dialogue.queue.length);
    await tapEl('#mob-next');
    c.ok('NEXT advances dialogue', await poll(q => Dialogue.queue.length < q || !State.ui.inDialogue, 7000, q0));
    await tapEl('#mob-back');
    c.ok('SKIP ends dialogue', await poll(() => !State.ui.inDialogue, 7000));

    // ── Terminal games ───────────────────────────────────────────────────
    await ev(() => { const r = Math.random; Math.random = () => 0.5; try { openMiniGame({ used: false, position: { x: Player.position.x, y: 0, z: Player.position.z }, x: Player.position.x, z: Player.position.z, level: 1 }); } finally { Math.random = r; } });
    c.ok('terminal game opens', await poll(() => State.ui.inMiniGame, 7000));
    c.ok('pad shows in the terminal game', await poll(() => Mobile.state().pad, 7000));
    await shot('8-terminal');
    await ev(() => { window.__q = __keys.length; });
    await tapEl('#mob-digits [data-d="2"]');
    const r = await ev(() => { const b = document.querySelector('#mob-pad .rt').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 1 }] });
    await wait(300);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const ks = await ev(() => __keys.slice(__q));
    c.ok('pad sends Digit2 and ArrowRight', ks.some(k => k.startsWith('Digit2')) && ks.some(k => k.startsWith('ArrowRight')), ks.join(' '));
    await tapEl('#mob-back');
    c.ok('QUIT leaves the terminal game', await poll(() => !State.ui.inMiniGame, 7000));

    // ── The stick still walks ────────────────────────────────────────────
    await poll(() => document.getElementById('tc-stick').getBoundingClientRect().width > 0, 7000);
    const s = await ev(() => { const b = document.getElementById('tc-stick').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await ev(() => { window.__w = 0; const t = setInterval(() => { if (State.keys.has('w')) __w++; }, 30); setTimeout(() => clearInterval(t), 4000); });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s.x, y: s.y, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: s.x, y: s.y - 40, id: 2 }] });
    await wait(2500);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    c.ok('stick holds W', await poll(() => __w > 0 || __keys.some(k => k.startsWith('KeyW|w|87')), 7000));
    c.ok('stick releases W', await poll(() => !State.keys.has('w'), 7000));
    // ── E is held for as long as the thumb is down (field jobs: hold E) ──
    await ev(() => { window.__e = []; const t0 = performance.now();
      document.addEventListener('keydown', e => { if (e.code === 'KeyE') __e.push(['d', performance.now() - t0]); }, true);
      document.addEventListener('keyup',   e => { if (e.code === 'KeyE') __e.push(['u', performance.now() - t0]); }, true); });
    await poll(() => document.querySelector('.tc-use').getBoundingClientRect().width > 0, 7000);
    const eb = await ev(() => { const b = document.querySelector('.tc-use').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: eb.x, y: eb.y, id: 3 }] });
    await poll(() => __e.some(x => x[0] === 'd'), 7000);
    await wait(1800);
    const mid = await ev(() => __e.map(x => x[0]).join(''));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await poll(() => __e.some(x => x[0] === 'u'), 7000);
    const fin = await ev(() => __e);
    c.eq('E stays down while held', mid, 'd');
    c.ok('E comes up on release', fin.length === 2 && fin[1][0] === 'u' && fin[1][1] - fin[0][1] > 1500, JSON.stringify(fin));
    await shot('9-end');

    c.eq('no page errors', w.pageErrors.length, 0);
    if (w.pageErrors.length) console.log(w.pageErrors.slice(0, 5));
    c.eq('no console errors', w.consoleErrors.length, 0);
    if (w.consoleErrors.length) console.log(w.consoleErrors.slice(0, 5));
  } catch (e){
    c.ok('test ran to the end', false, e && e.stack);
    await shot('crash');
  }
  const f = c.report();
  await browser.close();
  site.close && site.close();
  process.exit(f ? 1 : 0);
})();
