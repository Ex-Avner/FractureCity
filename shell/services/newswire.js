// =============================================================================
//  NEWSWIRE — the outside world, arriving in the block world
// -----------------------------------------------------------------------------
//  Every other service in this shell reads and writes the user's own disk. This
//  one is the single place that reaches the network, which is why it lives in
//  main rather than in an app: an app in a BrowserWindow should not be making
//  arbitrary outbound requests, and if it did, every app would have to solve
//  caching, timeouts and offline behaviour again.
//
//  It pulls real AI and technology stories from sources that need no key and no
//  account, normalises them to one shape, and caches the result to
//  data/_shell/newswire.json. Apps read that through window.fracture.newswire().
//
//  Two rules it does not break:
//
//    1. A headline is never edited. Not shortened, not rephrased, not "made to
//       fit the world". What the outlet published is what the city shows, with
//       the outlet named and the time it went out. Anything else is putting
//       words in a real publication's mouth. The fiction goes in the frame
//       around the story — never in the story.
//
//    2. When the wire is empty, it says so. There is no baked-in snapshot of
//       headlines to fall back on, because a snapshot is current news for about
//       a day and stale news presented as current forever after. Silence is
//       both honest and, for a game about a broadcast that ended, correct.
// =============================================================================

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const MAX_ITEMS = 40;
const FETCH_TIMEOUT = 9000;         // per request
const REFRESH_AFTER = 45 * 60e3;    // don't re-fetch a wire younger than this
const STALE_AFTER = 12 * 3600e3;    // past this, the city says the signal is old

//  What counts as the beat. Deliberately broad on AI and narrow on everything
//  else, so the wire reads as one subject rather than as a homepage.
const BEAT = [
  'ai', 'a.i.', 'artificial intelligence', 'machine learning', 'neural',
  'llm', 'llms', 'language model', 'transformer', 'gpt', 'claude', 'gemini',
  'openai', 'anthropic', 'deepmind', 'mistral', 'hugging face', 'nvidia',
  'inference', 'training run', 'fine-tune', 'fine-tuning', 'diffusion',
  'agent', 'agents', 'agentic', 'robotics', 'chip', 'chips', 'semiconductor',
  'compute', 'datacenter', 'data center', 'open-source model', 'open weights',
  'alignment', 'benchmark', 'reasoning model', 'multimodal', 'copilot',
];

function onBeat(text){
  const s = String(text || '').toLowerCase();
  return BEAT.some(k => {
    //  Word-boundary match, so "chip" does not fire on "shipping" and "ai"
    //  does not fire on "said", "rain", "maintain" — which is most of English.
    const i = s.indexOf(k);
    if (i < 0) return false;
    const before = i === 0 ? ' ' : s[i - 1];
    const after = s[i + k.length] === undefined ? ' ' : s[i + k.length];
    return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
  });
}

// ─── Transport ──────────────────────────────────────────────────────────────
function get(url, timeout = FETCH_TIMEOUT){
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.get(url, {
      headers: { 'user-agent': 'PresentPalm-Newswire/1.0 (+local hub, no tracking)' },
    }, res => {
      //  One redirect hop is enough for every source here; more than that and
      //  something has changed that a human should look at.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location){
        res.resume();
        return get(res.headers.location, timeout).then(resolve, reject);
      }
      if (res.statusCode !== 200){
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => {
        body += d;
        //  A source that starts streaming megabytes is a source that has
        //  changed shape. Stop rather than fill memory.
        if (body.length > 4e6){ req.destroy(new Error('response too large')); }
      });
      res.on('end', () => resolve(body));
    });
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

const getJSON = (url, t) => get(url, t).then(JSON.parse);

// ─── Sources ────────────────────────────────────────────────────────────────
//  Each returns an array of items and is allowed to fail on its own. One dead
//  source must never take the wire down with it.

//  Hacker News. No key, no quota, and the front page is most of this beat on
//  any given day. Stories are fetched individually, so the concurrency is
//  capped rather than firing eighty requests at once.
async function sourceHN(limit = 60){
  const ids = await getJSON('https://hacker-news.firebaseio.com/v0/topstories.json');
  const take = ids.slice(0, limit);
  const out = [];
  const WIDTH = 8;
  for (let i = 0; i < take.length; i += WIDTH){
    const batch = await Promise.all(take.slice(i, i + WIDTH).map(id =>
      getJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null)));
    for (const s of batch){
      if (!s || s.type !== 'story' || !s.title || s.dead || s.deleted) continue;
      if (!onBeat(s.title)) continue;
      out.push({
        id: 'hn:' + s.id,
        title: String(s.title),
        url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
        source: s.url ? hostOf(s.url) : 'Hacker News',
        via: 'Hacker News',
        at: new Date((s.time || 0) * 1000).toISOString(),
        score: s.score || 0,
      });
    }
  }
  return out;
}

//  arXiv cs.AI, newest first. This is where the wire stops being press releases
//  and starts being the actual work, which is a different and better texture on
//  a broadcast crawl.
async function sourceArxiv(){
  const url = 'http://export.arxiv.org/api/query'
            + '?search_query=cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL'
            + '&sortBy=submittedDate&sortOrder=descending&max_results=25';
  const xml = await get(url);
  const out = [];
  for (const entry of xml.split('<entry>').slice(1)){
    const title = tag(entry, 'title');
    const id = tag(entry, 'id');
    const at = tag(entry, 'published');
    if (!title || !id) continue;
    out.push({
      id: 'arxiv:' + id.split('/').pop(),
      title: collapse(title),
      url: id,
      source: 'arXiv',
      via: 'arXiv cs.AI',
      at: at || new Date().toISOString(),
      score: 0,
    });
  }
  return out;
}

//  Enough XML for two well-formed Atom feeds; not enough to be a parser. If a
//  source ever needs more than this, it needs a real dependency instead.
function tag(block, name){
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? unescapeXml(m[1]).trim() : null;
}
function unescapeXml(s){
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
const collapse = s => String(s).replace(/\s+/g, ' ').trim();

function hostOf(url){
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (e){ return 'unknown'; }
}

const SOURCES = [
  { key: 'hn',    run: sourceHN },
  { key: 'arxiv', run: sourceArxiv },
];

// ─── The wire ───────────────────────────────────────────────────────────────
function createNewswire(dataDir, opts = {}){
  const file = path.join(dataDir, '_shell', 'newswire.json');
  const sources = opts.sources || SOURCES;
  const now = opts.now || (() => Date.now());
  let inFlight = null;

  function readCache(){
    try {
      if (!fs.existsSync(file)) return null;
      const w = JSON.parse(fs.readFileSync(file, 'utf8'));
      return w && Array.isArray(w.items) ? w : null;
    } catch (e){ return null; }
  }

  function writeCache(wire){
    try {
      const dir = path.dirname(file);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(wire, null, 2));
    } catch (e){ /* a wire that cannot be cached still works this session */ }
  }

  //  The shape apps see. `stale` and `empty` are computed here rather than by
  //  each app, so every surface in the hub agrees on when the signal is old.
  function decorate(wire){
    const age = wire.fetchedAt ? now() - Date.parse(wire.fetchedAt) : Infinity;
    return {
      type: 'newswire.v1',
      items: wire.items || [],
      fetchedAt: wire.fetchedAt || null,
      sources: wire.sources || {},
      ageMs: Number.isFinite(age) ? age : null,
      stale: !(age < STALE_AFTER),
      empty: !(wire.items || []).length,
    };
  }

  async function refresh(force){
    const cached = readCache();
    if (!force && cached && cached.fetchedAt
        && now() - Date.parse(cached.fetchedAt) < REFRESH_AFTER){
      return decorate(cached);
    }
    //  Two apps launching at once must not become two sets of requests.
    if (inFlight) return inFlight;

    inFlight = (async () => {
      const status = {};
      const gathered = [];
      const results = await Promise.all(sources.map(async s => {
        try {
          const items = await s.run();
          status[s.key] = { ok: true, count: items.length };
          return items;
        } catch (e){
          status[s.key] = { ok: false, error: String(e && e.message || e) };
          return [];
        }
      }));
      for (const set of results) gathered.push(...set);

      //  Same story from two sources is one story on the crawl.
      const seen = new Set(), items = [];
      for (const it of gathered){
        const key = normaliseTitle(it.title);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        items.push(it);
      }
      items.sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0));

      const anyOk = Object.values(status).some(s => s.ok && s.count > 0);
      //  Every source failed — keep whatever was on the wire before rather than
      //  blanking the city because the café wifi is down.
      if (!anyOk && cached && cached.items && cached.items.length){
        const kept = { ...cached, sources: status, lastAttemptAt: new Date(now()).toISOString() };
        writeCache(kept);
        return decorate(kept);
      }

      const wire = {
        type: 'newswire.v1',
        fetchedAt: new Date(now()).toISOString(),
        sources: status,
        items: items.slice(0, MAX_ITEMS),
      };
      writeCache(wire);
      return decorate(wire);
    })().finally(() => { inFlight = null; });

    return inFlight;
  }

  function normaliseTitle(t){
    return String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, 90);
  }

  //  What an app calls. Never throws, never blocks on the network: it answers
  //  from cache immediately and kicks off a refresh for next time.
  function read(){
    const cached = readCache();
    const wire = cached || { type: 'newswire.v1', items: [], fetchedAt: null, sources: {} };
    refresh(false).catch(() => {});
    return decorate(wire);
  }

  return { read, refresh, path: file, onBeat, _normaliseTitle: normaliseTitle };
}

module.exports = { createNewswire, onBeat, SOURCES, STALE_AFTER, MAX_ITEMS };
