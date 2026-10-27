# Fracture City 0.83.0 · Inbox, moderation, and fixes from play

## Fixes from play
- Other residents online appeared backwards: you saw the back of someone
  who was looking at you. They now face the way they are looking.
- Protest signs (Casting Booth protesters, parades, the booth regulars)
  were held upside down and back to front. They stay upright and face
  forward, standing or marching.
- PvP hits did not show on the health bar until you went down. Hits
  (and brawler NPC punches) now take the same share off the HUD bar, with
  the red flash; the server still decides when you are down, and a
  respawn refills the bar. The PvP bar moved up so the "Later" prompt no
  longer covers it.
- Remove, Mute and Take down in the social hub need a second tap; the
  panel redrew between taps, so the second tap never counted. Fixed.
- A protester whose march ran into a wall pushed against it forever; the
  march now turns.

## Inbox
- Replies, hearts, new followers, @mentions and courier messages arrive
  in an Inbox (social hub · Inbox, or the ✉ button under the map, which
  appears when something is unread). A short toast says what came in.
- Tap a note to open the thread or the profile; Mark all read.

## Reporting and moderation
- Report any post or board work from its card (spam, hate or harassment,
  sexual content, someone else's work, other).
- The server owner gets a Mod tab: open reports with the post, Take down
  (its author is told), Suspend 1 day, 7 days or until lifted, Dismiss,
  and a list of suspensions to lift. The owner can also take down any post
  straight from the feed. A suspended resident cannot post, reply, publish,
  chat, spawn NPCs or change NPC stories, and sees why and until when.

## Word filter
- Slurs and "kill yourself" style harassment are refused in posts,
  replies, board works, profiles, display names, usernames, chat and NPC
  names, stories and courier messages, including spaced-out and
  leetspeak spellings. Ordinary swearing is fine.

## Server
- New tables: social_notes, social_bans. GET /api/social/notes and
  /api/social/mod (owner); POST social/notes-read, post-report, mod-remove,
  mod-dismiss, mod-ban, mod-unban. server/wordfilter.cjs.

## Not in this release
- Repairing the older tests that no longer match the game is next.
