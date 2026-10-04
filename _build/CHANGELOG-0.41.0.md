# 0.41.0: complete mobile Netlify release

- New full static build preserves apps/shared paths so all nine arcade destinations load. Root home links to the city, arcade and bundled radio. No SPA catch-all masks missing game files.
- Bundle all 13 final tracks with a playlist. Browser radio discovers the soundtrack, streams on demand and stops cycling if every track fails. Desktop media behavior is retained.
- Multi-touch steering, gas, brake, drift and nitro in Palm Drive. Touch movement, actions and drag-to-look for Coherence, Still Human, Wild and Sun Fall. Inputs release on cancellation, focus loss and menu transitions.
- Scrollable Sun Fall phone menu; lower render pixel density for its mobile view and Still Human. Pointer lock is optional on browsers that lack it. Light Bearer tracks touch pointers.
- Visitor web edition uses built-in vector illustrations with no external image-generation account. Desktop provider behavior is unchanged.
- Compact city radio tray fits phone height. Existing main-city mobile controls and campaign remain.

Build: python3 _build/build-netlify.py
Output: _build/netlify-mobile and _build/fracture-city-netlify-mobile-v0.41.0.zip
Deploy: drop the ZIP or its extracted folder into Netlify Drop. No build command.

Verification: 59 main-city touchscreen checks; nine integration scenarios including all cabinets and radio; core boot/campaign/prologue/web suites. Chromium mobile emulation, including unavailable pointer-lock APIs. Physical iPhone/iPad and Safari-device validation remain outstanding. Browser saves are per-device and per-origin. Netlify does not run the persistent multiplayer server.
