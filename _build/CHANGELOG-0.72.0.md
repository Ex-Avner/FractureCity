# v0.72.0 — Chainfire at Common Ground

- Added the supplied Chainfire v4 game as a local Present Palm app. Preserves its levels, adaptive swarm, bosses, shop and browser-local progress.
- Added a chunk-owned arcade cabinet at (187, 1, 30), on Common Ground's east edge, with collision, illuminated trim, illustrated screen, joystick and marquee.
- Walk up and press E or tap Play Chainfire. The normal arcade overlay and Leave cabinet button return to the city.
- The news hub yields its interaction prompt when the player approaches the cabinet. Existing arcade machines keep their slots.
- Added the app to the web packager and online server allowlist. Removed remote Google Fonts requests and supplied a standard mobile viewport; system font fallbacks work offline.
- Verified desktop gameplay, touch layout, cabinet entry/exit and chunk reload; online server serves app and cabinet assets. Chainfire progression remains per browser/device, not an account-synced score service.
