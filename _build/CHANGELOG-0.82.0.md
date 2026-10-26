# Fracture City 0.82.0 · Social hub and a bug sweep

## Social hub (O, or Tools · "Social")
- One panel for the feed, profiles and people.
- The Feed: newest first, Everyone or Following. Each post shows its
  author's portrait, name and time, and a photo, song or painted mural if
  it has one. Gallery board works appear in the feed too, marked with
  their board number.
- Posting: write straight into the feed (title optional, up to 500
  characters), add a photo, a song or the mural you have selected, and
  optionally pin it to a free gallery board in Common Ground at the same
  time. Posting is no longer limited to the eight boards.
- Threads: hearts and replies on every post and board work; authors can
  remove replies on their posts.
- Profiles: your wardrobe look rendered as a portrait, name, tagline, bio,
  counts (posts, followers, following, hearts, reputation), your posts,
  and the NPCs you have out in this city. Follow or mute from a profile.
  Edit your name, tagline, bio and colour in place; your portrait follows
  your wardrobe automatically.
- People: search residents by name; whoever is in this city with you is
  listed first.
- Esc steps back, then closes.

## One look for every social surface
- The gallery board dock and its publish form, the online panel and the
  account panel now share the punk design of the wardrobe and Casting
  Booth.
- The gallery board dock links to the artist's profile and the thread.
- The online panel's Profile button opens your social profile; names in
  chat open theirs; a Feed button opens the hub.

## Fixes
- "Spawn them here" at the Casting Booth put the NPC inside you; they now
  appear a couple of metres in front, on open ground.
- An NPC standing inside your head in first person filled the screen; it
  is hidden while that close.
- Talking to an NPC while signed out offered "I'm @resident."; the name
  option now only appears when you have a name.

## Server
- New tables (nothing existing changes): social_posts with replies and
  hearts, and social_profiles (tagline and look).
- GET /api/social/feed?scope=all|following&before=, /api/social/profile/
  <username or id:account>, /api/social/item/<id>, /api/social/people?q=.
- POST /api/social/post, post-reply, post-appreciate, post-remove,
  post-remove-reply, profile {tagline, look}.
- 12 posts an hour per resident; the newest 200 are kept. Muting hides
  posts, profiles and threads both ways. Media in feed posts is kept and
  served like board media and freed when the post is removed.
- Saving a look in the online city also updates the profile portrait.

## Known limits
- No notifications yet: you see replies and new followers by looking.
- Feed posts are text, photo, song or mural; no video.
