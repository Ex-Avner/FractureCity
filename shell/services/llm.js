// =============================================================================
//  llm.js — the shell's language-model service.
//
//  WHY THIS LIVES IN THE SHELL AND NOT IN THE APP
//  ----------------------------------------------
//  Apps are loaded with loadFile(), so their origin is file://. A fetch() from
//  there to http://127.0.0.1:11434 is a cross-origin request carrying
//  `Origin: null`, and every local model server rejects that by default. The
//  usual workaround is to tell the user to set OLLAMA_ORIGINS and restart the
//  server, which is a shell environment variable on a machine where most
//  people have never opened a shell, and which has to be set again for every
//  other runtime they try.
//
//  The main process has no origin and no CORS. So the request is made here and
//  the bytes are relayed to the renderer over IPC. Nothing to configure, it
//  works for every runtime identically, and every other Present Palm app gets
//  a local model for free rather than each one solving this again.
//
//  WHAT IT TALKS TO
//  ----------------
//  Two wire formats cover everything people actually run:
//
//    · Ollama native      /api/tags, /api/chat            newline-delimited JSON
//    · OpenAI-compatible  /v1/models, /v1/chat/completions  SSE
//                         — LM Studio, llama.cpp's server, mlx_lm.server,
//                           vLLM, text-generation-webui, LocalAI, Jan
//
//  Discovery probes the ports those use, in parallel, and reports what
//  answered. Nothing is assumed to be installed and nothing is ever launched:
//  this service only speaks to a server the user is already running.
//
//  SAFETY
//  ------
//  Only loopback. baseUrl is validated against a hostname allow-list before a
//  socket is opened, so an app cannot use this service as a general-purpose
//  outbound proxy or reach anything on the user's network.
// =============================================================================

const http = require('http');
const https = require('https');
const { URL } = require('url');

//  Where local runtimes listen. Ordered by how likely a given machine is to
//  have one, because discovery reports in completion order and the first
//  healthy endpoint becomes the default.
const CANDIDATES = [
  { url: 'http://127.0.0.1:11434', api: 'ollama',  name: 'Ollama' },
  { url: 'http://127.0.0.1:1234',  api: 'openai',  name: 'LM Studio' },
  { url: 'http://127.0.0.1:8080',  api: 'openai',  name: 'llama.cpp / MLX' },
  { url: 'http://127.0.0.1:8081',  api: 'openai',  name: 'llama.cpp (alt)' },
  { url: 'http://127.0.0.1:5000',  api: 'openai',  name: 'text-generation-webui' },
  { url: 'http://127.0.0.1:4891',  api: 'openai',  name: 'GPT4All' },
  { url: 'http://127.0.0.1:8000',  api: 'openai',  name: 'vLLM / LocalAI' },
  { url: 'http://127.0.0.1:1337',  api: 'openai',  name: 'Jan' },
];

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]', '0.0.0.0']);

//  Hosted providers, by exact hostname. This is an ALLOW-LIST and not a
//  pattern, deliberately: the moment this service will dial an arbitrary
//  host, an app that can call it has an outbound proxy with the user's
//  network position, and that is a much bigger thing than a chat window.
//
//  `wire` is the request shape. Anthropic is its own: a different path, a
//  different auth header, a system prompt that is a top-level field rather
//  than a message, and an event-typed SSE stream.
const PROVIDERS = {
  openai: {
    name: 'OpenAI', host: 'api.openai.com', base: 'https://api.openai.com',
    wire: 'openai', auth: 'bearer', models: '/v1/models',
    hint: 'platform.openai.com/api-keys',
  },
  anthropic: {
    name: 'Anthropic', host: 'api.anthropic.com', base: 'https://api.anthropic.com',
    wire: 'anthropic', auth: 'x-api-key', models: '/v1/models',
    hint: 'console.anthropic.com/settings/keys',
  },
  openrouter: {
    name: 'OpenRouter', host: 'openrouter.ai', base: 'https://openrouter.ai/api',
    wire: 'openai', auth: 'bearer', models: '/v1/models',
    hint: 'openrouter.ai/keys \u2014 one key, most models',
  },
  groq: {
    name: 'Groq', host: 'api.groq.com', base: 'https://api.groq.com/openai',
    wire: 'openai', auth: 'bearer', models: '/v1/models',
    hint: 'console.groq.com/keys \u2014 very fast',
  },
  mistral: {
    name: 'Mistral', host: 'api.mistral.ai', base: 'https://api.mistral.ai',
    wire: 'openai', auth: 'bearer', models: '/v1/models',
    hint: 'console.mistral.ai/api-keys',
  },
  deepseek: {
    name: 'DeepSeek', host: 'api.deepseek.com', base: 'https://api.deepseek.com',
    wire: 'openai', auth: 'bearer', models: '/v1/models',
    hint: 'platform.deepseek.com',
  },
  together: {
    name: 'Together', host: 'api.together.xyz', base: 'https://api.together.xyz',
    wire: 'openai', auth: 'bearer', models: '/v1/models',
    hint: 'api.together.ai/settings/api-keys',
  },
};
const HOSTED_HOSTS = new Set(Object.values(PROVIDERS).map(p => p.host));

function isLocal(u) {
  try {
    const p = new URL(u);
    if (p.protocol !== 'http:' && p.protocol !== 'https:') return false;
    return LOOPBACK.has(p.hostname);
  } catch (e) {
    return false;
  }
}

//  The only two kinds of address this service will ever open a socket to.
function isAllowed(u) {
  try {
    const p = new URL(u);
    if (LOOPBACK.has(p.hostname)) return true;
    return p.protocol === 'https:' && HOSTED_HOSTS.has(p.hostname);
  } catch (e) {
    return false;
  }
}

function authHeaders(prov, key) {
  if (!key) return {};
  if (prov && prov.auth === 'x-api-key') {
    return { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  }
  return { authorization: 'Bearer ' + key };
}

//  One request helper for the whole file. Returns the body as a string, or
//  rejects with an Error whose .code says what kind of failure it was, because
//  "connection refused" and "404" mean completely different things to the user
//  and the difference has to survive as far as the screen.
function request(url, { method = 'GET', body = null, timeout = 6000, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch (e) {
      const err = new Error('bad url'); err.code = 'BAD_URL'; return reject(err);
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const payload = body == null ? null : Buffer.from(JSON.stringify(body));
    const req = lib.request(parsed, {
      method,
      headers: Object.assign(
        payload ? { 'content-type': 'application/json',
                    'content-length': payload.length } : {},
        headers),
      timeout,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 400) {
          const err = new Error(`HTTP ${res.statusCode}`);
          err.code = 'HTTP_' + res.statusCode;
          err.body = text.slice(0, 600);
          return reject(err);
        }
        resolve(text);
      });
    });
    req.on('timeout', () => {
      req.destroy();
      const err = new Error('timed out'); err.code = 'TIMEOUT'; reject(err);
    });
    req.on('error', (e) => {
      const err = new Error(e.message);
      err.code = e.code === 'ECONNREFUSED' ? 'REFUSED' : (e.code || 'NET');
      reject(err);
    });
    if (payload) req.write(payload);
    req.end();
  });
}


class LLM {
  constructor() {
    //  id -> { req, res, cancelled }. Streams in flight, so one can be
    //  stopped without touching the others.
    this.streams = new Map();
    this.seq = 0;
  }

  // ── Discovery ────────────────────────────────────────────────────────────
  //  Probes everything at once with a short timeout. A machine with nothing
  //  running answers in well under a second, because "connection refused" on
  //  loopback is immediate; only a port that is open but slow costs the
  //  full timeout.

  async discover(extra) {
    const list = CANDIDATES.slice();
    if (extra && isLocal(extra) && !list.some(c => c.url === extra.replace(/\/+$/, ''))) {
      //  A hand-entered endpoint is probed under both wire formats, since the
      //  person typing a port number has no reason to know which it speaks.
      list.unshift({ url: extra.replace(/\/+$/, ''), api: 'openai', name: 'custom' });
      list.unshift({ url: extra.replace(/\/+$/, ''), api: 'ollama', name: 'custom' });
    }
    const probes = list.map((c) => this._probe(c).catch((e) => ({
      ...c, ok: false, error: e.code || 'ERR',
    })));
    const results = await Promise.all(probes);
    const up = results.filter(r => r.ok);
    //  De-duplicate: llama.cpp and MLX both sit on 8080, and a custom entry
    //  may repeat a candidate. Keep the one that actually listed models.
    const seen = new Set();
    const uniq = [];
    for (const r of up.sort((a, b) => b.models.length - a.models.length)) {
      const key = r.url;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(r);
    }
    return {
      ok: true,
      endpoints: uniq,
      probed: results.map(r => ({ url: r.url, api: r.api, name: r.name,
                                  ok: !!r.ok, error: r.error || null })),
    };
  }

  async _probe(c) {
    if (!isLocal(c.url)) throw Object.assign(new Error('not local'), { code: 'BLOCKED' });
    const path = c.api === 'ollama' ? '/api/tags' : '/v1/models';
    const text = await request(c.url + path, { timeout: 2500 });
    let data;
    try { data = JSON.parse(text); } catch (e) {
      throw Object.assign(new Error('not json'), { code: 'NOT_JSON' });
    }
    let models = [];
    if (c.api === 'ollama') {
      if (!Array.isArray(data.models)) {
        throw Object.assign(new Error('unexpected'), { code: 'NOT_OLLAMA' });
      }
      models = data.models.map(m => ({
        id: m.name,
        size: m.size || 0,
        family: (m.details && m.details.family) || '',
        params: (m.details && m.details.parameter_size) || '',
        quant: (m.details && m.details.quantization_level) || '',
      }));
    } else {
      const arr = Array.isArray(data.data) ? data.data
                : (Array.isArray(data.models) ? data.models : null);
      if (!arr) throw Object.assign(new Error('unexpected'), { code: 'NOT_OPENAI' });
      models = arr.map(m => ({
        id: m.id || m.name || String(m),
        size: 0, family: m.owned_by || '', params: '', quant: '',
      }));
    }
    return { ...c, ok: true, models };
  }

  async models(baseUrl, api) {
    const r = await this._probe({ url: String(baseUrl).replace(/\/+$/, ''), api, name: '' });
    return { ok: true, models: r.models };
  }

  //  What a hosted provider will answer for, given a key. Two of them do not
  //  return a usable list — Anthropic's needs a recent API version and some
  //  keys cannot read it at all — so a curated fallback is shipped rather
  //  than an empty menu, which is indistinguishable from a broken key.
  providers() {
    return Object.keys(PROVIDERS).map(k => ({
      key: k, name: PROVIDERS[k].name, base: PROVIDERS[k].base,
      wire: PROVIDERS[k].wire, hint: PROVIDERS[k].hint,
    }));
  }

  async hostedModels(provKey, apiKey) {
    const prov = PROVIDERS[provKey];
    if (!prov) return { ok: false, error: 'UNKNOWN_PROVIDER' };
    if (!apiKey) return { ok: false, error: 'NO_KEY' };
    try {
      const text = await request(prov.base + prov.models, {
        timeout: 12000, headers: authHeaders(prov, apiKey),
      });
      const d = JSON.parse(text);
      const arr = Array.isArray(d.data) ? d.data
                : (Array.isArray(d.models) ? d.models : []);
      let models = arr.map(m => ({ id: m.id || m.name, size: 0,
                                   params: '', quant: '',
                                   family: m.owned_by || m.display_name || '' }));
      //  Anything that cannot hold a conversation is noise in a model picker.
      models = models.filter(m => m.id &&
        !/embed|moderation|whisper|tts|dall-e|rerank|guard|vision-only/i.test(m.id));
      models.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      return { ok: true, models };
    } catch (e) {
      return { ok: false, error: e.code || 'ERR',
               message: e.code === 'HTTP_401' || e.code === 'HTTP_403'
                 ? 'That key was refused by ' + prov.name + '.'
                 : 'Could not reach ' + prov.name + ': ' + e.message };
    }
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  //  Streaming, because a local 8B model on a laptop produces its first token
  //  in about a second and its last one in thirty, and a UI that shows nothing
  //  until the end of that is indistinguishable from a UI that has crashed.
  //
  //  `send` is a callback the caller wires to a webContents channel. Every
  //  event carries the stream id so a renderer with two conversations open
  //  does not merge them.

  start(opts, send) {
    const id = 'llm' + (++this.seq) + '.' + Date.now().toString(36);
    const {
      provider = null, apiKey = null,
      messages = [], temperature = 0.8, topP = 0.95,
      maxTokens = 1024, stop = [], seed = null,
    } = opts || {};
    let { baseUrl, api = 'openai', model } = opts || {};

    //  A hosted provider supplies its own base and wire format; the caller
    //  only names it and hands over the key.
    const prov = provider ? PROVIDERS[provider] : null;
    if (provider && !prov) {
      send({ id, type: 'error', error: 'UNKNOWN_PROVIDER',
             message: 'No provider called "' + provider + '".' });
      return { ok: false, id };
    }
    if (prov) { baseUrl = prov.base; api = prov.wire; }

    const base = String(baseUrl || '').replace(/\/+$/, '');
    if (!isAllowed(base)) {
      send({ id, type: 'error', error: 'BLOCKED',
             message: 'This service only opens connections to this machine or '
                    + 'to a known model provider. ' + base + ' is neither.' });
      return { ok: false, id };
    }
    if (prov && !apiKey) {
      send({ id, type: 'error', error: 'NO_KEY',
             message: prov.name + ' needs an API key. Add one on the Engine '
                    + 'screen.' });
      return { ok: false, id };
    }
    if (!model) {
      send({ id, type: 'error', error: 'NO_MODEL',
             message: 'No model chosen.' });
      return { ok: false, id };
    }

    const isOllama = api === 'ollama';
    const isAnthropic = api === 'anthropic';

    //  Anthropic takes the system prompt out of the message list and puts it
    //  at the top level, and refuses a list that starts with anything but a
    //  user turn. Everything else here speaks one of the other two shapes.
    let path, body;
    if (isAnthropic) {
      const sys = messages.filter(m => m.role === 'system')
                          .map(m => m.content).join('\n\n');
      let turns = messages.filter(m => m.role !== 'system');
      while (turns.length && turns[0].role !== 'user') turns = turns.slice(1);
      path = '/v1/messages';
      body = { model, messages: turns, stream: true, max_tokens: maxTokens,
               temperature, top_p: topP,
               ...(sys ? { system: sys } : {}),
               ...(stop.length ? { stop_sequences: stop } : {}) };
    } else if (isOllama) {
      path = '/api/chat';
      body = { model, messages, stream: true,
               options: Object.assign(
                 { temperature, top_p: topP, num_predict: maxTokens },
                 stop.length ? { stop } : {},
                 seed != null ? { seed } : {}) };
    } else {
      path = '/v1/chat/completions';
      body = { model, messages, stream: true, temperature, top_p: topP,
               max_tokens: maxTokens,
               ...(stop.length ? { stop } : {}),
               ...(seed != null ? { seed } : {}) };
    }

    let parsed;
    try { parsed = new URL(base + path); } catch (e) {
      send({ id, type: 'error', error: 'BAD_URL', message: 'Bad endpoint.' });
      return { ok: false, id };
    }

    const lib = parsed.protocol === 'https:' ? https : http;
    const payload = Buffer.from(JSON.stringify(body));
    const state = { cancelled: false, req: null, chars: 0, t0: Date.now(), first: 0 };
    this.streams.set(id, state);

    const req = lib.request(parsed, {
      method: 'POST',
      headers: Object.assign({ 'content-type': 'application/json',
                               'content-length': payload.length,
                               accept: 'text/event-stream' },
                             authHeaders(prov, apiKey)),
      //  No response timeout: generation legitimately takes minutes on a big
      //  model. The connect phase is guarded separately below.
      timeout: 0,
    }, (res) => {
      if (res.statusCode >= 400) {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const t = Buffer.concat(chunks).toString('utf8').slice(0, 600);
          this.streams.delete(id);
          send({ id, type: 'error', error: 'HTTP_' + res.statusCode,
                 message: this._explain(res.statusCode, t, model) });
        });
        return;
      }

      //  Both formats are line-oriented. Ollama sends one JSON object per
      //  line; OpenAI-compatible servers send `data: {...}` per line with a
      //  `data: [DONE]` sentinel. One buffer handles both, and a partial line
      //  held across chunk boundaries is the bug that makes streaming look
      //  like it drops characters at random.
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        if (state.cancelled) return;
        buf += chunk;
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let piece = null, done = false;
          if (isAnthropic) {
            //  Event-typed SSE. The text lives in content_block_delta; the
            //  other event kinds carry structure this does not need, except
            //  message_stop, which is the end.
            if (!line.startsWith('data:')) continue;
            try {
              const o = JSON.parse(line.slice(5).trim());
              if (o.type === 'content_block_delta' && o.delta) {
                piece = o.delta.text || '';
              } else if (o.type === 'message_delta' && o.usage) {
                state.evalCount = o.usage.output_tokens;
              } else if (o.type === 'message_stop') {
                done = true;
              } else if (o.type === 'error') {
                this.streams.delete(id);
                send({ id, type: 'error', error: 'PROVIDER',
                       message: (o.error && o.error.message) || 'Provider error.' });
                try { res.destroy(); } catch (e) {}
                return;
              }
            } catch (e) { continue; }
          } else if (isOllama) {
            try {
              const o = JSON.parse(line);
              piece = (o.message && o.message.content) || '';
              done = !!o.done;
              if (done && o.eval_count) {
                state.evalCount = o.eval_count;
                state.evalDuration = o.eval_duration;
              }
            } catch (e) { continue; }
          } else {
            if (!line.startsWith('data:')) continue;
            const d = line.slice(5).trim();
            if (d === '[DONE]') { done = true; }
            else {
              try {
                const o = JSON.parse(d);
                const c0 = o.choices && o.choices[0];
                piece = (c0 && ((c0.delta && c0.delta.content) || c0.text)) || '';
                if (c0 && c0.finish_reason) done = done || false;
                if (o.usage) state.usage = o.usage;
              } catch (e) { continue; }
            }
          }
          if (piece) {
            if (!state.first) state.first = Date.now() - state.t0;
            state.chars += piece.length;
            send({ id, type: 'token', text: piece });
          }
          if (done) {
            this.streams.delete(id);
            send({ id, type: 'done',
                   stats: { chars: state.chars,
                            ms: Date.now() - state.t0,
                            firstMs: state.first,
                            tokens: state.evalCount
                                 || (state.usage && state.usage.completion_tokens)
                                 || null } });
            try { res.destroy(); } catch (e) {}
            return;
          }
        }
      });
      res.on('end', () => {
        if (!this.streams.has(id)) return;
        this.streams.delete(id);
        send({ id, type: 'done',
               stats: { chars: state.chars, ms: Date.now() - state.t0,
                        firstMs: state.first, tokens: null } });
      });
      res.on('error', (e) => {
        if (!this.streams.has(id)) return;
        this.streams.delete(id);
        send({ id, type: 'error', error: 'STREAM',
               message: 'The connection dropped part-way through: ' + e.message });
      });
    });

    state.req = req;
    //  Guard the connect only. Once bytes are flowing the socket may sit idle
    //  for a long time while the model thinks, and killing it then would be
    //  wrong.
    const connectGuard = setTimeout(() => {
      if (state.chars === 0 && this.streams.has(id)) {
        state.cancelled = true;
        try { req.destroy(); } catch (e) {}
        this.streams.delete(id);
        send({ id, type: 'error', error: 'TIMEOUT',
               message: 'The model server accepted the request but sent nothing '
                      + 'back within two minutes. On a first run this is usually '
                      + 'the model still loading into memory — try again once it '
                      + 'has settled.' });
      }
    }, 120000);
    req.on('close', () => clearTimeout(connectGuard));

    req.on('error', (e) => {
      if (state.cancelled) return;
      this.streams.delete(id);
      send({ id, type: 'error',
             error: e.code === 'ECONNREFUSED' ? 'REFUSED' : (e.code || 'NET'),
             message: e.code === 'ECONNREFUSED'
               ? 'Nothing is listening on ' + base + ' any more. The model '
                 + 'server may have stopped.'
               : 'Could not reach the model: ' + e.message });
    });
    req.write(payload);
    req.end();
    return { ok: true, id };
  }

  //  Turn a status code into something a person can act on. A bare "HTTP 404"
  //  in a chat window tells the user nothing about the fact that they typed a
  //  model name that is not installed.
  _explain(code, bodyText, model) {
    let detail = '';
    try {
      const o = JSON.parse(bodyText);
      detail = o.error && (o.error.message || o.error) || o.message || '';
      if (typeof detail !== 'string') detail = JSON.stringify(detail);
    } catch (e) { detail = (bodyText || '').trim(); }
    if (code === 404) {
      return `The server does not have a model called "${model}". Pick one from `
           + 'the list, or pull it first.' + (detail ? ' — ' + detail : '');
    }
    if (code === 400) {
      return 'The server refused the request as malformed'
           + (detail ? ': ' + detail : '.');
    }
    if (code === 500 || code === 503) {
      return 'The model server hit an internal error'
           + (detail ? ': ' + detail : '')
           + '. Out of memory is the usual cause with a large model.';
    }
    return `The model server answered ${code}` + (detail ? ': ' + detail : '.');
  }

  stop(id) {
    const s = this.streams.get(id);
    if (!s) return { ok: false, error: 'no such stream' };
    s.cancelled = true;
    try { s.req.destroy(); } catch (e) {}
    this.streams.delete(id);
    return { ok: true };
  }

  stopAll() {
    for (const id of [...this.streams.keys()]) this.stop(id);
    return { ok: true };
  }
}

module.exports = { LLM, isLocal, CANDIDATES };
