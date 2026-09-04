# Deploying The Works to avnermedia.com

This folder is **self-contained** and ready for Cloudflare Pages. No build
step — Pages just serves the static files as-is.

## Phase 0: Get it live (≈30 min of clicking + 1–24h DNS propagation)

### 1. Create a Cloudflare account (free)
Go to <https://dash.cloudflare.com/sign-up>. Email + password. No card needed
for the Pages free tier.

### 2. Create the Pages project
1. In the Cloudflare dashboard sidebar: **Workers & Pages** → **Create** →
   **Pages** → **Upload assets**.
2. Project name: `avner-works` (becomes `avner-works.pages.dev`).
3. Drag-and-drop **this entire folder** (`/Users/cashamerica/Fracture City/apps/works/`)
   into the upload area. Or zip it first and upload the zip.
4. Click **Deploy site**. First deploy takes ~1 minute.
5. Verify it works at `https://avner-works.pages.dev` before doing DNS.

### 3. Add avnermedia.com as a custom domain
1. In the project, **Custom domains** tab → **Set up a custom domain**.
2. Enter: `avnermedia.com`
3. Cloudflare will show you DNS records to add. **Copy them.** You'll see
   something like:

   | Type  | Name              | Value                    |
   |-------|-------------------|--------------------------|
   | CNAME | `avnermedia.com`  | `avner-works.pages.dev`  |

   *(If Cloudflare gives you an apex/A record set instead, use those.)*

4. Also add a record for the `www` subdomain so both work:

   | Type  | Name  | Value                   |
   |-------|-------|-------------------------|
   | CNAME | `www` | `avner-works.pages.dev` |

### 4. Add the records in GoDaddy
1. Log in to GoDaddy → **My Products** → find `avnermedia.com` →
   **DNS** (or "Manage DNS").
2. **Delete** any existing A / CNAME records for `@` (the root) and `www`
   that point to GoDaddy parking pages.
3. **Add** the records Cloudflare gave you.
4. Save.

### 5. Wait for propagation
- Cloudflare will verify within a few minutes.
- Worldwide DNS propagation can take up to 24 hours but most people see it
  in 10–30 minutes.
- Check status at <https://www.whatsmydns.net/#A/avnermedia.com>
- Once verified, the Pages dashboard shows a green check and SSL is
  auto-provisioned (Let's Encrypt). `https://avnermedia.com` is live.

### Re-deploying later
- For one-off updates: zip and re-upload via the Pages dashboard.
- For continuous deploy: connect a GitHub repo (Pages → Settings → Builds &
  deployments → Source → GitHub). Every push to `main` auto-deploys.

---

## Phase 1: Add accounts + cloud profiles (~2–4 weeks part-time)

### Recommended stack — vanilla, no framework rewrite
The current site is plain HTML+JS. Don't migrate to Next.js just to get
auth — drop the Supabase JS client in via `<script type="module">` and
keep everything else as-is.

```html
<script type="module">
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // sign in, save, query — all from the same vanilla JS
</script>
```

The existing `window.fracture.save/read` pattern is already the right
abstraction. Wrap it: if signed in, save to Supabase; if not, fall back
to localStorage (which is what we do today).

### Open-source projects to lift from

| What you need                          | Project                          | What to take from it |
|----------------------------------------|----------------------------------|----------------------|
| Auth UI patterns + RLS policy examples | [Razikus/supabase-nextjs-template](https://github.com/Razikus/supabase-nextjs-template) | Copy the RLS policies and the auth flow logic (not the React components). |
| Journaling features + DB schema        | [journiv/journiv-app](https://github.com/journiv/journiv-app) | Mood tracking, prompt-based entries, analytics, search. Lift the schema; rebuild the UI in your palette. |
| Lightweight markdown notes/journal     | [usememos/memos](https://github.com/usememos/memos) | Self-hostable Go binary. Could run alongside if you want a "quick note" surface separate from the mirror profile. |
| User analytics on Supabase Auth        | [itsmaleen/supabase-analytics](https://github.com/itsmaleen/supabase-analytics) | Dashboard for sign-ups, active users, retention. Useful when you start tracking real users. |
| Long-term metric observability         | [supabase/supabase-grafana](https://github.com/supabase/supabase-grafana) | Prometheus + Grafana for the platform's own health. Phase 3 nice-to-have. |
| Curated Supabase ecosystem             | [lyqht/awesome-supabase](https://github.com/lyqht/awesome-supabase) | Browse for any other component you need. |
| Official minimal Supabase scaffold     | [vercel/next.js/examples/with-supabase](https://github.com/vercel/next.js/tree/canary/examples/with-supabase) | Reference only — don't migrate, just read the auth pattern. |

### Suggested data model (Postgres / Supabase)

```sql
-- users table is auto-created by Supabase Auth
create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text,
  avatar_url    text,
  palette_pref  text default 'ember',     -- ember | wine | moss
  created_at    timestamptz default now()
);

create table tot_snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade,
  taken_at      timestamptz default now(),
  axes          jsonb,                    -- {v, h, t}
  zone          text,
  subtype       text,
  raw           jsonb                     -- full assessment payload
);

create table journal_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  body_md       text,                     -- markdown
  mood          int,                      -- -3..+3 or null
  tags          text[]
);

create table book_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade,
  chapter       int,
  opened_at     timestamptz default now(),
  closed_at     timestamptz,
  scroll_depth  numeric                   -- 0..1
);

create table game_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade,
  app_slug      text,                     -- fracture-city-game | the-visitor | ...
  started_at    timestamptz default now(),
  ended_at      timestamptz,
  metrics       jsonb                     -- per-app payload
);

-- RLS: each user can only read/write their own rows
alter table profiles        enable row level security;
alter table tot_snapshots   enable row level security;
alter table journal_entries enable row level security;
alter table book_sessions   enable row level security;
alter table game_runs       enable row level security;

create policy "own rows" on profiles
  for all using (auth.uid() = id);
create policy "own rows" on tot_snapshots
  for all using (auth.uid() = user_id);
create policy "own rows" on journal_entries
  for all using (auth.uid() = user_id);
create policy "own rows" on book_sessions
  for all using (auth.uid() = user_id);
create policy "own rows" on game_runs
  for all using (auth.uid() = user_id);
```

That schema covers: profile customization, longitudinal TOT tracking,
journal entries with mood/tags, reading progress per chapter, and a
generic per-app `game_runs` table that all your Fracture City apps can
post into without needing a new table each time.

## Dependencies (as of 0.2.0)

This site has **no runtime CDN dependency**. three.js 0.158.0 and the five addon
modules the page imports are vendored under `shared/vendor/three/` (~1.3 MB) and
resolved through the importmap in `index.html`. Deploy the whole `shared/`
directory or the page will not boot.

Two things to know about that:

- `_redirects` ends in an SPA catch-all (`/* /index.html 200`). Cloudflare Pages
  serves real static assets before consulting it, so the vendored files are
  unaffected — but if one ever goes **missing**, that path returns `index.html`
  with a 200 and a `text/html` content type rather than a 404. With `nosniff` set
  the browser then refuses to execute it and the failure reads as a MIME error.
  If the page comes up blank after a deploy, check `shared/vendor/` is complete
  before looking anywhere else.
- `index.html` carries a boot check that writes a plain-English message onto the
  loading veil if the module has not run within eight seconds, naming the file to
  look for. That is the intended first signal, not the console.
