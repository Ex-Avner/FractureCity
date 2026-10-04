# Fracture City 0.39.0

Districts now has username/password registration and login, private recovery keys, editable resident profiles, a public resident directory, profile export and session revocation. SQLite stores accounts, saved districts, visits, lifetime PvP statistics, permanent reputation and contract choices. Existing single-player saves stay local and separate.

Saved districts resume across logout, browser changes and server restarts. Empty rooms unload but their progress remains. Completed contracts reward each account once across districts. Room actions require both the resident account and its room capability. Stats cannot be edited through profile requests.

Passwords use salted scrypt; cookies are HttpOnly/SameSite and Secure in production. Recovery/password changes revoke older sessions. Database backups, an integrity check utility, a persistent-volume deployment configuration and private-data exclusions are included.

Account tests passed 32 checks; account UI tests passed 8 including browser reconnection across a server restart. The authenticated multiplayer regression suite passed 28 checks, and the two-browser/twelve-seat flow with side-quest save checks passed 13. These are local tests; hosting, volume provisioning, container execution and external security/load testing remain unperformed.
