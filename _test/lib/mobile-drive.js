//  Shared helpers for driving the game as a phone.
const { devices } = require('playwright');
const PHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
  userAgent: devices['iPhone 13'].userAgent };

//  Skip the prologue programmatically so a test lands in the open campaign.
async function skipPrologue(page){
  await page.evaluate(() => { if (window.HD){ HD.locked = true; HD.tier = 'perf'; } shFrontAct('new-campaign'); });
  for (let i = 0; i < 900; i++){
    const s = await page.evaluate(() => {
      const o = { step: FN.prologue ? FN.prologue.step : null, campaign: Campaign.active };
      if (FN.scene){ FN.scene.advance(); o.scene = 1; return o; }
      const card = document.getElementById('fn-card');
      if (card && card.classList.contains('on')){
        const rec = card.querySelector('.fn-cls.rec'), opt = card.querySelector('.fn-opt');
        (rec || opt).click(); o.card = true; return o;
      }
      if (Dialogue.active){ Dialogue.queue.length = 0; Dialogue.chars = 1e9; shEndDialogue(); o.d = true; return o; }
      const P = FN.prologue; if (!P) return o;
      let t = P.target; if (typeof t === 'function') t = t(); if (Array.isArray(t)) t = { x: t[0], z: t[1] };
      if (t){ const s2 = shFindOpenSpot(t.x + 1.2, t.z + 1.2, 0.4, 1.8, 14); if (s2) Player.position.set(s2.x, s2.y + Player.height, s2.z); }
      if (FN._nearPickup) document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', key: 'r' }));
      if (P.step === 'break'){
        const foe = P.foes.find(e => e.state !== 'dead' && e.hp > 0);
        if (foe){ foe.hp = 0; foe.state = 'dead'; if (foe.mesh) foe.mesh.visible = false; }
      }
      return o;
    });
    if (s.campaign && !s.step && i > 20) return true;
    await page.waitForTimeout(s.card || s.d ? 120 : 40);
  }
  return false;
}
module.exports = { PHONE, skipPrologue };
