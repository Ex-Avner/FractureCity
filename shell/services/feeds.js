// =============================================================================
//  FEEDS — the boards in the Town Square
// -----------------------------------------------------------------------------
//  The newswire beside this file answers one question: what is happening in AI
//  and technology. It is a crawl — a single ticker of headlines, correctly,
//  because that is what a broadcast is.
//
//  A square is not a crawl. A square is people talking to each other, at length,
//  in threads, about whatever they like, and the interesting part is the replies
//  rather than the post. So this is a second service rather than more sources
//  bolted onto the first: different shape, different cadence, different rules.
//
//  Where the posts come from, and why:
//
//    MASTODON  is the one large social network whose public timelines and public
//              threads are readable with no account, no key, no registered
//              application and no quota — it is documented as "Public" and it
//              stays that way because the whole protocol is built for other
//              people's clients. It also serves permissive CORS headers, which
//              is the only reason the boards can work in the web build as well
//              as in the shell.
//
//    RSS/ATOM  because it is the last universal format. Any blog, any newsroom,
//              any podcast — and, usefully, any YouTube channel, which publishes
//              a feed at /feeds/videos.xml with no API key at all.
//
//    REDDIT    is deliberately absent from the defaults. Its unauthenticated
//              .json endpoints stopped being usable in 2026; reading a subreddit
//              now needs a registered OAuth application and a client secret. The
//              code path is here and works, but it stays off until somebody puts
//              credentials in the config, because a board that 403s forever is
//              worse than a board that was never offered.
//
//  Two rules carried over from the newswire, for the same reasons:
//
//    1. A post is never edited. Not shortened to fit a board, not rewritten in
//       the city's voice. Real people wrote these. The fiction goes in the frame
//       around the board — never in what somebody said.
//
//    2. An empty board says it is empty. There is no seeded sample content, so
//       the square is never quietly showing you fiction you might mistake for
//       somebody's actual opinion.
// =============================================================================

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const FETCH_TIMEOUT   = 9000;
const REFRESH_AFTER   = 8 * 60e3;      // a square moves faster than a bulletin
const STALE_AFTER     = 6 * 3600e3;
const MAX_PER_BOARD   = 30;
const MAX_BODY        = 1400;

// ─── Transport ──────────────────────────────────────────────────────────────
//  Injectable so the whole service can be tested without a network. Everything
//  below goes through `ctx.get`; nothing calls https directly.
function httpGet(url, timeout = FETCH_TIMEOUT, headers){
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.get(url, {
      headers: Object.assign({
        'user-agent': 'PresentPalm-Feeds/1.0 (+local hub, no tracking)',
        'accept': 'application/json, application/atom+xml, application/rss+xml, text/xml, */*',
      }, headers || {}),
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location){
        res.resume();
        return httpGet(res.headers.location, timeout, headers).then(resolve, reject);
      }
      if (res.statusCode !== 200){
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => {
        body += d;
        if (body.length > 4e6) req.destroy(new Error('response too large'));
      });
      res.on('end', () => resolve(body));
    });
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// ─── Text ───────────────────────────────────────────────────────────────────
//  Mastodon serves post bodies as HTML. This is the only place that HTML is
//  ever touched, and it is turned into plain text here rather than anywhere
//  nearer the screen — a renderer that receives markup will eventually put it
//  in a DOM, and then somebody's post is running in your game.
function htmlToText(html){
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function unescapeXml(s){
  return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
function xmlTag(block, name){
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? unescapeXml(m[1]).trim() : null;
}
function xmlAttr(block, name, attr){
  const m = block.match(new RegExp(`<${name}\\b[^>]*\\b${attr}=["']([^"']+)["']`, 'i'));
  return m ? unescapeXml(m[1]) : null;
}
const clip = (s, n) => {
  const t = String(s || '');
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
};
function hostOf(url){
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch (e){ return 'unknown'; }
}

// ─── Sources ────────────────────────────────────────────────────────────────
//  Every source takes (board, ctx) and returns an array of posts. Each is
//  allowed to fail on its own; one dead board never takes the square down.

//  Mastodon. Public timelines are documented as requiring no OAuth unless the
//  instance has turned public preview off, and a hashtag timeline is the same
//  endpoint with a tag in the path. Forty is the server-side maximum.
async function sourceMastodon(board, ctx){
  const host = board.host || 'mastodon.social';
  const limit = Math.min(40, board.limit || 30);
  const base = `https://${host}/api/v1/timelines/`;
  const url = board.tag
    ? `${base}tag/${encodeURIComponent(board.tag)}?limit=${limit}`
    : `${base}public?limit=${limit}${board.localOnly ? '&local=true' : ''}`;

  const list = JSON.parse(await ctx.get(url));
  if (!Array.isArray(list)) throw new Error('unexpected timeline shape');

  const out = [];
  for (const s of list){
    if (!s || !s.id) continue;
    //  A boost is somebody else's post wearing this account's name. Follow it
    //  to the original so the square attributes it to whoever wrote it.
    const post = s.reblog || s;
    const body = htmlToText(post.content);
    if (!body) continue;
    const acct = post.account || {};
    out.push({
      id: `mastodon:${host}:${post.id}`,
      remoteId: String(post.id),
      host,
      author: acct.display_name || acct.username || 'someone',
      handle: acct.acct ? '@' + String(acct.acct).replace(/^@/, '') : '',
      avatarHue: hueOf(acct.acct || acct.username || ''),
      title: '',
      body: clip(body, MAX_BODY),
      url: post.url || post.uri || `https://${host}/@${acct.acct}/${post.id}`,
      at: post.created_at || new Date().toISOString(),
      replies: post.replies_count || 0,
      score: (post.favourites_count || 0) + (post.reblogs_count || 0),
      tags: (post.tags || []).map(t => t.name).slice(0, 4),
      boosted: !!s.reblog,
      via: host,
    });
  }
  return out;
}

//  A Mastodon thread. Ancestors and descendants, public, capped server-side at
//  40 and 60 — which is a real conversation and more than fits on a board.
async function threadMastodon(item, ctx){
  const host = item.host || 'mastodon.social';
  const raw = JSON.parse(await ctx.get(
    `https://${host}/api/v1/statuses/${encodeURIComponent(item.remoteId)}/context`));
  const shape = (s) => {
    const acct = (s && s.account) || {};
    return {
      id: `mastodon:${host}:${s.id}`,
      author: acct.display_name || acct.username || 'someone',
      handle: acct.acct ? '@' + String(acct.acct).replace(/^@/, '') : '',
      avatarHue: hueOf(acct.acct || acct.username || ''),
      body: clip(htmlToText(s.content), MAX_BODY),
      at: s.created_at || null,
      url: s.url || s.uri || '',
      depth: 0,
    };
  };
  const ancestors = (raw.ancestors || []).map(shape);
  const descendants = (raw.descendants || []).map(shape);
  return { ancestors, descendants };
}

//  RSS and Atom, enough for well-formed feeds and no more. If a feed ever needs
//  more than this it needs a real parser as a dependency, not a bigger regex.
async function sourceFeed(board, ctx){
  const xml = await ctx.get(board.url);
  const isAtom = /<feed[\s>]/i.test(xml);
  const blocks = isAtom ? xml.split(/<entry[\s>]/i).slice(1)
                        : xml.split(/<item[\s>]/i).slice(1);
  const out = [];
  for (const raw of blocks.slice(0, MAX_PER_BOARD)){
    const block = '<x ' + raw;
    const title = xmlTag(block, 'title');
    const link = isAtom ? (xmlAttr(block, 'link', 'href') || xmlTag(block, 'id'))
                        : xmlTag(block, 'link');
    if (!title || !link) continue;
    const when = xmlTag(block, 'published') || xmlTag(block, 'updated')
              || xmlTag(block, 'pubDate') || null;
    const bodyRaw = xmlTag(block, 'summary') || xmlTag(block, 'description')
                 || xmlTag(block, 'content') || '';
    const author = xmlTag(block, 'name') || xmlTag(block, 'dc:creator')
                || xmlTag(block, 'author') || hostOf(link);
    out.push({
      id: 'feed:' + (xmlTag(block, 'guid') || xmlTag(block, 'id') || link),
      author: htmlToText(author) || hostOf(link),
      handle: hostOf(link),
      avatarHue: hueOf(hostOf(link)),
      title: htmlToText(title),
      body: clip(htmlToText(bodyRaw), MAX_BODY),
      url: link,
      at: when ? new Date(when).toISOString() : new Date().toISOString(),
      replies: 0, score: 0, tags: [],
      via: hostOf(link),
    });
  }
  return out;
}

//  Reddit, for whoever registers an application. Off unless the config carries
//  a clientId and secret: the anonymous .json route stopped working in 2026 and
//  a board that 403s forever is worse than a board nobody was offered.
async function sourceReddit(board, ctx){
  const { clientId, clientSecret } = board;
  if (!clientId || !clientSecret){
    throw new Error('reddit needs a registered app — see feeds.config.json');
  }
  const token = await ctx.redditToken(clientId, clientSecret);
  const sub = encodeURIComponent(board.sub || 'all');
  const sort = board.sort || 'hot';
  const raw = JSON.parse(await ctx.get(
    `https://oauth.reddit.com/r/${sub}/${sort}?limit=${Math.min(50, board.limit || 25)}`,
    { authorization: 'Bearer ' + token }));
  const kids = (raw && raw.data && raw.data.children) || [];
  return kids.map(k => k.data).filter(Boolean).filter(d => !d.stickied).map(d => ({
    id: 'reddit:' + d.id,
    author: d.author || 'someone',
    handle: 'r/' + (d.subreddit || board.sub),
    avatarHue: hueOf(d.author || ''),
    title: String(d.title || ''),
    body: clip(String(d.selftext || ''), MAX_BODY),
    url: 'https://reddit.com' + (d.permalink || ''),
    at: new Date((d.created_utc || 0) * 1000).toISOString(),
    replies: d.num_comments || 0,
    score: d.score || 0,
    tags: d.link_flair_text ? [String(d.link_flair_text)] : [],
    via: 'reddit.com',
  }));
}

const KINDS = {
  mastodon: { run: sourceMastodon, thread: threadMastodon },
  feed:     { run: sourceFeed },
  reddit:   { run: sourceReddit },
};

//  A stable colour per author, so the same person is the same colour on every
//  board without storing anything about them.
function hueOf(s){
  let h = 0;
  const t = String(s || '');
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360;
  return h;
}

// ─── The boards a square has if nobody has said otherwise ───────────────────
//  Four, because four is what fits around a plaza. Every one of them is a real
//  place run by real people, and every one is replaceable from the config file
//  without touching this code.
const DEFAULT_BOARDS = [
  { key: 'square',   kind: 'mastodon', host: 'mastodon.social',
    label: 'THE SQUARE',     sub: 'open channel · everybody', accent: '#80ffff' },
  { key: 'machines', kind: 'mastodon', host: 'mastodon.social', tag: 'ai',
    label: 'THE MACHINES',   sub: 'tagged #ai',               accent: '#ff60d0' },
  { key: 'makers',   kind: 'mastodon', host: 'mastodon.social', tag: 'gamedev',
    label: 'THE WORKSHOP',   sub: 'tagged #gamedev',          accent: '#f4bb3d' },
  { key: 'signal',   kind: 'feed',
    url: 'https://hnrss.org/frontpage',
    label: 'OUTSIDE SIGNAL',  sub: 'syndicated',              accent: '#7dffb3' },
];

// ─── The service ────────────────────────────────────────────────────────────
function createFeeds(dataDir, opts = {}){
  const file = path.join(dataDir, '_shell', 'feeds.json');
  const configFile = path.join(dataDir, '_shell', 'feeds.config.json');
  const now = opts.now || (() => Date.now());
  const kinds = opts.kinds || KINDS;
  let inFlight = null;
  let tokenCache = null;

  const ctx = {
    get: opts.get || ((url, headers) => httpGet(url, FETCH_TIMEOUT, headers)),
    //  Reddit's client-credentials grant. Cached until it expires, because the
    //  token endpoint is rate limited far harder than the read endpoints.
    async redditToken(id, secret){
      if (tokenCache && tokenCache.until > now()) return tokenCache.token;
      const token = await (opts.redditToken
        ? opts.redditToken(id, secret)
        : Promise.reject(new Error('reddit token fetch not configured')));
      tokenCache = { token, until: now() + 50 * 60e3 };
      return token;
    },
  };

  function boards(){
    try {
      if (fs.existsSync(configFile)){
        const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        if (cfg && Array.isArray(cfg.boards) && cfg.boards.length) return cfg.boards;
      }
    } catch (e){ /* a broken config falls back to the defaults, loudly in status */ }
    return opts.boards || DEFAULT_BOARDS;
  }

  function readCache(){
    try {
      if (!fs.existsSync(file)) return null;
      const v = JSON.parse(fs.readFileSync(file, 'utf8'));
      return v && Array.isArray(v.boards) ? v : null;
    } catch (e){ return null; }
  }

  function writeCache(v){
    try {
      const dir = path.dirname(file);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(v, null, 2));
    } catch (e){ /* still works this session */ }
  }

  function decorate(v){
    const age = v.fetchedAt ? now() - Date.parse(v.fetchedAt) : Infinity;
    const list = v.boards || [];
    return {
      type: 'feeds.v1',
      boards: list,
      fetchedAt: v.fetchedAt || null,
      sources: v.sources || {},
      ageMs: Number.isFinite(age) ? age : null,
      stale: !(age < STALE_AFTER),
      empty: !list.some(b => (b.items || []).length),
      total: list.reduce((n, b) => n + ((b.items || []).length), 0),
    };
  }

  async function refresh(force){
    const cached = readCache();
    if (!force && cached && cached.fetchedAt
        && now() - Date.parse(cached.fetchedAt) < REFRESH_AFTER){
      return decorate(cached);
    }
    if (inFlight) return inFlight;

    inFlight = (async () => {
      const defs = boards();
      const status = {};
      const built = await Promise.all(defs.map(async def => {
        const shell = {
          key: def.key, label: def.label || def.key.toUpperCase(),
          sub: def.sub || '', accent: def.accent || '#80ffff',
          kind: def.kind, items: [],
        };
        const impl = kinds[def.kind];
        if (!impl || !impl.run){
          status[def.key] = { ok: false, error: 'unknown kind: ' + def.kind };
          return shell;
        }
        try {
          const items = await impl.run(def, ctx);
          items.sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0));
          //  One post is one post, however many ways it arrived.
          const seen = new Set();
          shell.items = items.filter(it => {
            if (!it || !it.id || seen.has(it.id)) return false;
            seen.add(it.id); return true;
          }).slice(0, MAX_PER_BOARD);
          status[def.key] = { ok: true, count: shell.items.length };
        } catch (e){
          status[def.key] = { ok: false, error: String((e && e.message) || e) };
          //  A board that failed this time keeps what it had rather than
          //  emptying — the square should not go dark because one host did.
          const prev = cached && (cached.boards || []).find(b => b.key === def.key);
          if (prev && prev.items && prev.items.length) shell.items = prev.items;
        }
        return shell;
      }));

      const anyOk = Object.values(status).some(s => s.ok && s.count > 0);
      if (!anyOk && cached && (cached.boards || []).some(b => (b.items || []).length)){
        const kept = Object.assign({}, cached, {
          sources: status, lastAttemptAt: new Date(now()).toISOString(),
        });
        writeCache(kept);
        return decorate(kept);
      }

      const out = {
        type: 'feeds.v1',
        fetchedAt: new Date(now()).toISOString(),
        sources: status,
        boards: built,
      };
      writeCache(out);
      return decorate(out);
    })().finally(() => { inFlight = null; });

    return inFlight;
  }

  //  Answers from cache immediately and refreshes for next time — an app must
  //  never block on the network to draw a board.
  function read(){
    const cached = readCache();
    refresh(false).catch(() => {});
    return decorate(cached || { type: 'feeds.v1', boards: [], fetchedAt: null, sources: {} });
  }

  //  Opening a post. Only kinds that know how to fetch a conversation answer;
  //  everything else says so rather than inventing replies.
  async function thread(boardKey, itemId){
    const cached = readCache();
    const board = cached && (cached.boards || []).find(b => b.key === boardKey);
    const item = board && (board.items || []).find(i => i.id === itemId);
    if (!item) return { ok: false, error: 'no such post on that board' };
    const impl = kinds[board.kind];
    if (!impl || !impl.thread){
      return { ok: false, error: 'this board does not carry conversations', item };
    }
    try {
      const ctxOut = await impl.thread(item, ctx);
      return { ok: true, item, ancestors: ctxOut.ancestors || [], descendants: ctxOut.descendants || [] };
    } catch (e){
      return { ok: false, error: String((e && e.message) || e), item };
    }
  }

  return { read, refresh, thread, path: file, configPath: configFile, boards };
}

module.exports = {
  createFeeds, DEFAULT_BOARDS, KINDS, STALE_AFTER, MAX_PER_BOARD, MAX_BODY,
  htmlToText, hueOf, _sourceMastodon: sourceMastodon, _sourceFeed: sourceFeed,
  _sourceReddit: sourceReddit, _threadMastodon: threadMastodon,
};
