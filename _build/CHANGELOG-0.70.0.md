# v0.70.0 — Atelier frontage and usable phone controls

## Architecture
- Atelier 01 has open exhibition bays, metal framing, a broader illuminated canopy, restrained signage, ceiling-edge baffles, and a solid entry landing. The editable studio and existing mezzanine remain available.
- Echo Room, radio stage, roof walk and arrival promenade share the square’s cooler material and lighting palette. Removed the low direction-board obstruction from the promenade.
- Opened the previously blocked rooftop stair exit. Visitor waypoints now approach the new studio landing from clear ground.

## Farm ledger and mobile
- Ledger/plot dialogs explicitly own the cursor and stop pointer events reaching gameplay. Panel refresh preserves scroll and exact focused action; crop countdown updates no longer replace the interactive DOM every second.
- Seed panels scroll within the available height. Ledger navigation and buttons adapt to portrait/landscape touch screens.
- Removed legacy viewport resets to 980px; the main page, mobile module and flow module now agree on device width. Removed the full-screen portrait rotation blocker.
- Building tools have accessible touch-sized controls, scrollable placement at the top, and a Done action; duplicate top chips are hidden during room building.

## Verification and limits
- Own-the-block browser suite passed, including studio claim, commissions, full rooftop run, visiting residents, saves and touch interaction. Baseline comparison confirmed the blocked rooftop exit predated this release.
- Farming suite passed including growth, market, raids, pets and reload persistence.
- New ledger-touch suite passed: cursor, tabs, scroll, sale, planting, stable countdown nodes, both orientations, and building actions. It asserts actual phone viewport width, rather than merely fitting within the old scaled desktop viewport.
- Reading Garden and news/gallery browser suites passed again after the viewport changes, including phone/touch interaction. Visual checks covered Atelier and phone layouts.
- This is a targeted mobile pass for the district, farming, building and social readers, not certification of every arcade/minigame or physical iOS/Android device. Surrounding procedural skyline is unchanged. Not deployed or packaged.
