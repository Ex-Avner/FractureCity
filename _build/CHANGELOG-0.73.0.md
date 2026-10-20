# v0.73.0 — A contribution worth coming back to

- Added an optional Common Ground arrival invitation and physical Ned open-call board at (160, 26).
- Three weekly creative briefs rotate from 19 October 2026 UTC: Illegal comfort, A home for the night shift, and The useless invention fair. The server determines the current brief.
- Make something opens the furniture catalogue at your studio, or travels to your existing online plot. After placing an object, the invitation remains accessible so you can capture the selected group and tell its story.
- One contribution per account per week, up to 80 validated decorative parts. A scaled editable design is exhibited on one of four Common Ground plinths; paging the showcase changes the displayed miniatures. Original builds remain intact.
- Account-authenticated submissions and real guestbook notes persist in SQLite. The feed includes the latest 40 contributions and up to 52 of your own archived contributions. New-note indicators and read markers work locally per account/device. No simulated residents or responses.
- Contribution files can be exported locally and imported in the public city across website origins. Imports are validated before replacing the draft; publication remains explicit.
- Local draft titles, stories and designs survive reload. Public sharing requires the online city and an account; offline players can build and prepare drafts.
- Existing account blocking applies. Makers can remove their entry and guestbook notes; writers can remove their notes. Reporting, request rate limits and geometry limits are enforced on the server.
- Operator moderation: `node server/social-admin.cjs challenge-reports` and `node server/social-admin.cjs challenge-remove ENTRY_ID` with the existing DB_PATH setting.
- Includes server persistence/ownership/moderation tests and a two-account browser journey covering creation, publication, phone replies, world miniatures and returning guestbooks.

This establishes the first contribution loop. It does not claim retention results: watch five new players use it without coaching, and check whether they voluntarily return. It does not add email notifications, leaderboards or automatic deployment.
