# Fracture City Districts 0.39.0

Persistent resident accounts, profiles and saved districts for the twelve-player social/PvP mode. The main single-player campaign keeps its existing local saves; it is not automatically uploaded to the online account.

## Run locally

Use Node 24 or newer, from the repository root:

```sh
node server/start.cjs
```

Open http://127.0.0.1:8787. Create an account with a username and a password of 12–128 characters. Save the private recovery key when it is shown. There is no email dependency and no email-reset service. Password changes and recovery replace the recovery key and revoke prior login sessions.

Your profile has a public username, display name, bio, coat color, kills, deaths, reputation and completed-contract history. The resident directory shows public profile fields, never password hashes, session tokens or recovery keys. Download My Profile exports your profile and a list of saved districts.

Create or join a district, ready up and play. Return through Resident Account → Saved Districts. Signing in on a different browser gives access to the same account on this server. Account data does not automatically transfer to a different server installation. Older 0.38 guest sessions have no verified account owner and are not silently converted into accounts.

## What persists

- Profiles, password hashes, recovery-key hashes and thirty-day login sessions.
- Lifetime kills, deaths and reputation; completed contract IDs and choices.
- District map, phase, quest progression, recent room chat and removed-account list.
- Player position, heading, health, ammunition and district score for each visited district.

Critical rewards and PvP outcomes use database transactions. Movement/health snapshots save every five seconds, when leaving and on graceful shutdown. An abrupt process failure can lose up to five seconds of ordinary movement. A completed contract awards permanent reputation once per account, even if repeated in another district. Repeated jobs can still advance that district’s shared story. Empty districts unload from memory while their saved record remains in SQLite.

One active seat per account is allowed across the running server. Reconnecting that account rotates the room capability; another login cannot create duplicate reward-bearing seats. An account removed by a host cannot immediately rejoin that district under a new room token. Profile appearance/name changes propagate to the online avatar. Host control goes to an active resident when the prior host leaves; the district’s creator record is retained.

## Database and backups

Default database: `server/data/districts.sqlite`. Set DB_PATH to use another location. SQLite uses WAL, foreign keys, full synchronization and a schema version. Account files are excluded from Git and deployment archives. Keep the database private: it includes password hashes, session hashes and recovery-key hashes.

The supported start command creates a dated backup at startup and checks hourly for a new UTC day. BACKUP_DIR defaults to a backups directory beside the database. Existing backup files are never overwritten. These same-disk copies help with application mistakes; they do not protect against losing the entire disk. The deployment also configures Fly volume snapshots with fourteen-day retention, but that takes effect only after a volume is provisioned. Off-site export, restore drills and storage monitoring remain operator responsibilities.

```sh
node server/database.cjs check
node server/database.cjs backup /absolute/path/to/a-new-backup.sqlite
```

To restore safely: stop the server, retain the current database and its WAL/SHM files together as a safety copy, and start against a copied, verified backup using DB_PATH. Do not overwrite a database while its server is running. The restore test opens the backup independently and verifies saved profiles and integrity. Never put account databases in a publicly served folder.

## First public deployment

Use one paid Fly.io machine and one persistent volume in the same region. Do not deploy multiple instances against separate SQLite volumes: their accounts and rooms would diverge. Later scaling requires a shared account database and room-aware routing.

1. Create and fund a Fly account, create an app, and place its exact name in `app = "your-app-name"` at the top of server/fly.toml. Choose the region near the first players.
2. Create a volume named `fracture_data` in that same region, for example with `fly volumes create fracture_data --region lax --size 1 --snapshot-retention 14 --app YOUR_APP`. Use your actual region/app and review charges before provisioning.
3. Deploy from this repository root using `fly deploy --config server/fly.toml --ha=false`. The mount is /data and DB_PATH is /data/districts.sqlite. Keep one machine.
4. Serve through HTTPS. Production cookies are Secure and HttpOnly. Set PUBLIC_ORIGIN to the exact HTTPS origin if a custom domain is used.
5. Verify signup, login, profile updates, recovery, saved-district continuation after a machine restart, backup restore, and a twelve-human internet playtest before opening registration broadly.

The container starts briefly as root to give uid/gid 1000 ownership of a fresh mounted directory, then drops privileges before opening the database or listening. Its build allowlist excludes local data, credentials and other applications. No hosting account, volume, paid resource or public deployment has been created here. Docker and flyctl are unavailable on this Mac, so the container build/public deployment have not been executed.

Official references: [Fly volumes](https://fly.io/docs/volumes/overview/), [configuration](https://fly.io/docs/reference/configuration/), [Node SQLite](https://nodejs.org/api/sqlite.html), [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Authentication boundaries

Passwords use salted scrypt (N=131072, r=8, p=1). Expensive hashing is capped at two simultaneous operations. Account sessions and recovery keys use random 256-bit capabilities with only hashes stored in SQLite. Account cookies are HttpOnly/SameSite=Lax, Secure in production; API responses are not cached. Mutations require JSON and same-origin requests when an Origin header is present. Room capabilities also require the correct logged-in account. Login and registration have rate limits. Password recovery and Sign Out Everywhere revoke previous sessions. All profile content is length-limited and escaped when displayed. These controls have automated coverage; no independent security audit or public abuse test is claimed.

There is no MFA, verified email, password-reset email, account deletion UI, friends graph, direct messaging or cross-server identity yet. The community website’s existing recovery-key identity is separate; these logins do not authenticate to that site. Persistent online accounts are implemented for Districts, not presented as a completed social network.

## Gameplay and verification

Three authored maps, safe central plazas, PvP outside, chat, waves, shared contracts, first/third-person cameras and a residents scoreboard. The server owns movement, map collisions, damage, ammunition and rewards. Commands use authenticated JSON POST; snapshots stream at 10 Hz. Reverse proxies must not buffer event streams. Twelve seats are enforced per active district; four active districts is the configured ceiling, not a validated production capacity promise.

```sh
node --test server/accounts.test.cjs
node --test server/server.test.cjs
node _test/accounts-browser.test.cjs
node _test/dispatch-browser.test.cjs
node server/load.test.cjs
```

Tests use isolated memory or temporary databases. The account suite restarts the real HTTP server against a disk database and verifies recovery, session revocation, durable stats, reward uniqueness and a valid backup. Browser checks use installed Chrome and the repository Playwright setup. The twelve-client load test is local loopback, not a WAN benchmark.
