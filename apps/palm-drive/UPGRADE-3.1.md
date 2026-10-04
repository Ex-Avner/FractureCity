# Palm Drive 3.1

Installed directly in Present Palm’s existing Palm Drive app and its in-game arcade entry. Reopen the racer to load the update. Existing career storage is retained.

- Solid projected car geometry: shaded body panels, tapered cabins, wheels, spoilers, rear lights and exhaust flames.
- Four seconds of nitro per full tank. Release Shift after depletion; clean driving recharges slowly, slipstreaming quickly, completed drifts reward energy.
- Pro and Fracture rivals run faster and look for clear passing lanes around the player and other rivals. Rookie remains available.
- Live approximate chase/behind gaps, nitro meter and drafting indicator.
- Fixed repeated drift payouts, reset drift state between races, and pause on window focus loss.

Controls: arrows or WASD to drive, Space to drift, Shift for nitro, P to pause/resume.

Verification: node _test/palm-drive.test.cjs (Chrome installed). Tests nitro exhaustion, drafting recharge, single drift payout, new-race reset and finite AI on all four circuits. Difficulty still needs human lap-time tuning; this is local AI racing, not online multiplayer.
