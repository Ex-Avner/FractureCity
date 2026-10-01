//  A check collector. Every assertion is recorded by name, printed, and counted.
//  The exit code is a function of the checks, not of whatever happened to reach
//  the console. The previous version of this harness reported eight checks and
//  exited on none of them.

class Checks {
  constructor(title){ this.title = title; this.rows = []; }

  ok(name, cond, detail){
    this.rows.push({ name, pass: !!cond, detail: detail == null ? '' : String(detail) });
    return !!cond;
  }
  eq(name, actual, expected){
    const pass = Object.is(actual, expected);
    return this.ok(name, pass, pass ? String(actual) : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  }
  gt(name, actual, bound){
    const pass = typeof actual === 'number' && actual > bound;
    return this.ok(name, pass, pass ? String(actual) : `got ${JSON.stringify(actual)}, want > ${bound}`);
  }
  absent(name, value){
    const pass = value === undefined || value === null;
    return this.ok(name, pass, pass ? '' : String(value).split('\n')[0].slice(0, 200));
  }

  get failures(){ return this.rows.filter(r => !r.pass); }

  report(){
    const w = Math.max(...this.rows.map(r => r.name.length), 10);
    console.log('\n' + this.title);
    console.log('-'.repeat(this.title.length));
    for (const r of this.rows){
      console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name.padEnd(w)}  ${r.detail}`);
    }
    const f = this.failures.length;
    console.log(`\n  ${this.rows.length - f} passed, ${f} failed`);
    return f;
  }
}

//  Request classification.
//
//  The old filter dropped every line containing "Failed to load resource",
//  which is the same message Chromium prints for a 404 on a local script. That
//  is exactly the regression the mesher extraction can introduce, so the filter
//  was hiding the one failure it most needed to catch. Classify by URL instead.

//  The feed hosts the game contacts on purpose. This list is the same one
//  build-beta.py writes into the CSP; if the two ever disagree, one of them is
//  lying to the player.
const OPTIONAL_HOSTS = [
  'mastodon.social',
  'hn.algolia.com',
  'hacker-news.firebaseio.com',
  'public.api.bsky.app',
  'en.wikipedia.org',
];

function classify(url, origin){
  if (url.startsWith(origin)) return 'local';
  try {
    const h = new URL(url).hostname;
    return OPTIONAL_HOSTS.some(o => h === o || h.endsWith('.' + o)) ? 'optional' : 'foreign';
  } catch (e){ return 'foreign'; }
}

//  Watch a page and return a summary that names what went wrong and where.
//  A local request that does not answer 2xx is a failure. A foreign request the
//  game was never supposed to make is a failure. An optional feed host that
//  cannot be reached is recorded and forgiven, because a sandbox with no egress
//  is not a broken build.
function watch(page, origin){
  const w = { localBad: [], foreign: [], optionalOffline: [], consoleErrors: [], pageErrors: [] };

  page.on('response', r => {
    const kind = classify(r.url(), origin);
    if (kind === 'local' && r.status() >= 400) w.localBad.push(`${r.status()} ${r.url()}`);
    if (kind === 'foreign') w.foreign.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', r => {
    const kind = classify(r.url(), origin);
    const why = (r.failure() && r.failure().errorText) || 'failed';
    if (kind === 'local') w.localBad.push(`${why} ${r.url()}`);
    else if (kind === 'optional') w.optionalOffline.push(`${why} ${r.url()}`);
    else w.foreign.push(`${why} ${r.url()}`);
  });
  page.on('pageerror', e => w.pageErrors.push(String(e && e.message)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    //  Chromium's resource-load error reads "Failed to load resource:
    //  net::ERR_..." and carries no URL in the text at all, so matching on the
    //  text cannot tell an unreachable feed host from a 404 on a local script.
    //  The URL is in the message location. Use that, and fall back to any URL
    //  in the text for messages the page logged itself.
    let url = '';
    try { url = (m.location() && m.location().url) || ''; } catch (e){}
    if (!url) url = (text.match(/https?:\/\/[^\s"']+/) || [])[0] || '';
    //  Only an optional feed host is forgiven. A local 404 lands here with a
    //  local URL and counts, which is the whole point of this classifier.
    if (url && classify(url, origin) === 'optional') return;
    w.consoleErrors.push(url ? `${text}  [${url}]` : text);
  });
  return w;
}

//  A static server that answers with real status codes and, when a _headers
//  file is present, with the headers a deploy would actually send. Without the
//  second part the harness cannot say anything about the CSP.
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain',
};

//  Cloudflare/Netlify _headers: a path pattern on one line, then indented
//  "Name: value" lines. Only the globbing we actually use is supported.
function parseHeaders(file){
  if (!file || !fs.existsSync(file)) return [];
  const rules = [];
  let cur = null;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')){
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)){
      cur = { pattern: raw.trim(), headers: [] };
      rules.push(cur);
    } else if (cur){
      const i = raw.indexOf(':');
      if (i > 0) cur.headers.push([raw.slice(0, i).trim(), raw.slice(i + 1).trim()]);
    }
  }
  return rules;
}

function headersFor(rules, urlPath){
  const out = [];
  for (const r of rules){
    const rx = new RegExp('^' + r.pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    if (rx.test(urlPath)) out.push(...r.headers);
  }
  return out;
}

async function serve(root, opts = {}){
  const rules = parseHeaders(opts.headersFile);
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(root, urlPath);
    if (!path.resolve(file).startsWith(path.resolve(root))){
      res.writeHead(403); res.end('no'); return;
    }
    fs.readFile(file, (err, data) => {
      if (err){
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }
      const head = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' };
      for (const [k, v] of headersFor(rules, urlPath)) head[k] = v;
      res.writeHead(200, head);
      res.end(data);
    });
  });
  const port = opts.port || (8700 + Math.floor(Math.random() * 200));
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  return { origin: `http://127.0.0.1:${port}`, close: () => server.close() };
}

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl', '--disable-dev-shm-usage',
];

module.exports = { Checks, watch, serve, classify, OPTIONAL_HOSTS, LAUNCH_ARGS, parseHeaders, headersFor };
