# Initial online room

The root render.yaml configures one Node 24 service, one permanent disk,
username/password accounts, and one active twelve-player district.
It does not purchase or deploy anything by itself. Review Render's price
before applying it. The blueprint follows https://render.com/docs/blueprint-spec.

Before deployment, push this file and the current server/game sources to the
connected GitHub repository. In Render choose a Blueprint from that repository
and review its configuration. The permanent disk is essential for accounts.
Automatic deploys are disabled so ordinary pushes do not interrupt players.

Use the Render HTTPS URL itself for the lobby and login. PUBLIC_ORIGIN is
intentionally omitted: the server accepts its own request host by default.
Do not set it to https://fracturecity.netlify.app while players are logging
in on the Render host. After obtaining the Render address, add a Play Online
link on the Netlify site. No live site has been changed by this configuration.

Netlify's current live upload predates the v0.55 ZIP. Update it separately.
The Git repository ignores personal music. This initial service is for the
online lobby; the complete soundtrack remains in the Netlify release ZIP.
Matching music delivery for the server's /city/ page still needs preparation.

Email verification/reset emails and cloud main-city/custom-NPC saves are not
enabled by this blueprint. Current account recovery uses a private recovery key.
Before inviting others, test two accounts joining the same room and confirm
that accounts and room progress survive a server restart. Daily database
backups on the same disk do not replace an off-site backup.
