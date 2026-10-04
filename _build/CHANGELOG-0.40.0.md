# 0.40.0: Mac kit, final soundtrack and compact HUD

- Package the creator-authorized 13-track Final Collection. WAV masters stay untouched; distribution copies are 256 kbps MP3, supplied MP3s copied unchanged.
- Add F2 Radio & menu with previous/play/pause/skip and a focused track/volume panel. U/Y/H shortcuts remain.
- Compact HUD defaults on, retaining health, combat warnings, objectives, interactions and dialogue. Extra labels, persistent control legend and cosmetic interference move out of the way. Full HUD is one toggle away.
- Package launcher preload correctly. Store packaged data, ideas and added media in Application Support; include soundtrack as read-only app resources.
- Fix Sun Fall pause overlay blocking its initial Begin button.
- Sun Fall uses the shipped Three library so startup does not require a CDN.
- Mac Apple Silicon kit includes the runtime, install guide, Applications shortcut and separate online-server sources/instructions. No Node/Homebrew/Terminal needed by players. Developer preview is not Apple-notarized. Intel and Windows installers are not part of this kit.
- Exclude machine-specific external studio/Signal launchers from the portable build, not from the developer tree. Optional AI providers and live feeds still require their own service/network setup.

Verification: boot (21), campaign (15 including 54 routes), first-night (65), web build (17) passed. Packaged-app tests use isolated profiles. No personal saves or online account databases are included. Public hosting has not been provisioned or tested over WAN.
