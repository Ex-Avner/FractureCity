/* ============================================================================
   FractureCore — the application.

   Four things, in one window:

     ASK     a conversation that is grounded in the manuscripts. Every answer
             is built on passages the retrieval model actually found, and the
             passages are shown beside it so a claim can be checked against
             the book it came from rather than taken on trust.
     READ    the retrieval model on its own: search by meaning, every
             occurrence of a phrase, and what a passage sits next to.
     TRAIN   the fine-tune. It cannot be run from in here — MLX needs the
             Mac's own GPU and a terminal — so this is the part that knows
             what to run, hands it over, watches for the result, and then
             tests the tuned model against the base one so the difference is
             heard rather than assumed.
     ENGINE  which model is answering, and everything about how it is reached.

   THE ONE THING TO UNDERSTAND
   ---------------------------
   Two different models are in play and they do different jobs:

     · The retrieval model was trained on the manuscripts and ships inside
       this app. It knows where everything is. It cannot write a sentence.
     · The language model runs on this machine, outside this app, and supplies
       every word of generated prose. Its reasoning and its English are its
       own; the manuscripts steer what it talks about and how it sounds.

   Neither is a substitute for the other, and the app is honest about which
   one produced what: with no language model running, ASK still answers, but
   it answers with passages and says so rather than inventing prose.
   ============================================================================ */

(function () {
'use strict';

// ─── 1 · The bridge ─────────────────────────────────────────────────────────
//  Inside Present Palm, window.fracture is already there. Opened as a loose
//  file it is not, and the app should still run rather than show a stack
//  trace, so localStorage stands in for storage and the model service falls
//  back to a direct fetch.

const F = (function () {
  const real = window.fracture;
  if (real && real.shell) return real;
  const pre = 'fracture::fracture-core::';
  return {
    shell: false, appSlug: 'fracture-core', received: null,
    save(k, v) { try { localStorage.setItem(pre + k, JSON.stringify(v)); } catch (e) {} return Promise.resolve(true); },
    read(k) { try { const r = localStorage.getItem(pre + k); return Promise.resolve(r == null ? null : JSON.parse(r)); } catch (e) { return Promise.resolve(null); } },
    list() { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(pre)) o.push(k.slice(pre.length)); } return Promise.resolve(o); },
    delete(k) { localStorage.removeItem(pre + k); return Promise.resolve(true); },
    me() { return Promise.resolve({ type: 'person.v1', username: 'resident', displayName: '' }); },
    openExternal(u) { window.open(u, '_blank'); return Promise.resolve(true); },
    emit() { return Promise.resolve(true); }, subscribe() { return () => {}; },
  };
})();

//  The model service. Provided by the shell when it has been patched; the
//  fallback speaks the same two wire formats directly from the page, which
//  works only where the server allows a file:// origin. The distinction
//  matters enough to surface, so `viaShell` is reported on the Engine screen.
const LLM = (function () {
  if (F.llm) return Object.assign({ viaShell: true }, F.llm);

  const CANDIDATES = [
    { url: 'http://127.0.0.1:11434', api: 'ollama', name: 'Ollama' },
    { url: 'http://127.0.0.1:1234', api: 'openai', name: 'LM Studio' },
    { url: 'http://127.0.0.1:8080', api: 'openai', name: 'llama.cpp / MLX' },
    { url: 'http://127.0.0.1:8081', api: 'openai', name: 'llama.cpp (alt)' },
    { url: 'http://127.0.0.1:5000', api: 'openai', name: 'text-generation-webui' },
    { url: 'http://127.0.0.1:1337', api: 'openai', name: 'Jan' },
    { url: 'http://127.0.0.1:8000', api: 'openai', name: 'vLLM / LocalAI' },
  ];

  async function probe(c) {
    const path = c.api === 'ollama' ? '/api/tags' : '/v1/models';
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 2500);
    try {
      const r = await fetch(c.url + path, { signal: ctl.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      let models = [];
      if (c.api === 'ollama') {
        if (!Array.isArray(d.models)) throw new Error('shape');
        models = d.models.map(m => ({ id: m.name, size: m.size || 0,
          params: (m.details && m.details.parameter_size) || '',
          quant: (m.details && m.details.quantization_level) || '' }));
      } else {
        const arr = d.data || d.models;
        if (!Array.isArray(arr)) throw new Error('shape');
        models = arr.map(m => ({ id: m.id || m.name, size: 0, params: '', quant: '' }));
      }
      return Object.assign({}, c, { ok: true, models });
    } catch (e) {
      clearTimeout(to);
      return Object.assign({}, c, { ok: false, error: e.name === 'AbortError' ? 'TIMEOUT' : 'BLOCKED' });
    }
  }

  return {
    viaShell: false,
    async discover(extra) {
      const list = CANDIDATES.slice();
      if (extra) {
        const u = String(extra).replace(/\/+$/, '');
        list.unshift({ url: u, api: 'openai', name: 'custom' });
        list.unshift({ url: u, api: 'ollama', name: 'custom' });
      }
      const res = await Promise.all(list.map(probe));
      const up = res.filter(r => r.ok);
      const seen = new Set(); const uniq = [];
      for (const r of up.sort((a, b) => b.models.length - a.models.length)) {
        if (seen.has(r.url)) continue; seen.add(r.url); uniq.push(r);
      }
      return { ok: true, endpoints: uniq,
               probed: res.map(r => ({ url: r.url, api: r.api, name: r.name,
                                       ok: !!r.ok, error: r.error || null })) };
    },
    async models(url, api) { const r = await probe({ url, api, name: '' });
      return r.ok ? { ok: true, models: r.models } : { ok: false, error: r.error }; },
    //  Deliberately absent on this path: providers/hostedModels. Reaching a
    //  hosted provider from a file:// page means putting the user's API key
    //  in the page and hoping CORS lets it through, which it does not. The
    //  Engine screen checks for these and says so rather than failing later.
    providers: null, hostedModels: null,
    async chat(opts, onEvent) {
      const isO = opts.api === 'ollama';
      const path = isO ? '/api/chat' : '/v1/chat/completions';
      const body = isO
        ? { model: opts.model, messages: opts.messages, stream: true,
            options: { temperature: opts.temperature, top_p: opts.topP,
                       num_predict: opts.maxTokens } }
        : { model: opts.model, messages: opts.messages, stream: true,
            temperature: opts.temperature, top_p: opts.topP,
            max_tokens: opts.maxTokens };
      const ctl = new AbortController();
      const t0 = Date.now(); let chars = 0, first = 0;
      (async () => {
        try {
          const r = await fetch(opts.baseUrl.replace(/\/+$/, '') + path, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body), signal: ctl.signal });
          if (!r.ok) {
            const t = await r.text();
            onEvent({ type: 'error', error: 'HTTP_' + r.status,
                      message: 'The model server answered ' + r.status + '. ' + t.slice(0, 300) });
            return;
          }
          const rd = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
          for (;;) {
            const { value, done } = await rd.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let nl;
            while ((nl = buf.indexOf('\n')) >= 0) {
              const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
              if (!line) continue;
              let piece = null, fin = false;
              if (isO) {
                try { const o = JSON.parse(line);
                      piece = (o.message && o.message.content) || ''; fin = !!o.done; }
                catch (e) { continue; }
              } else {
                if (!line.startsWith('data:')) continue;
                const d = line.slice(5).trim();
                if (d === '[DONE]') fin = true;
                else { try { const o = JSON.parse(d); const c = o.choices && o.choices[0];
                             piece = (c && ((c.delta && c.delta.content) || c.text)) || ''; }
                       catch (e) { continue; } }
              }
              if (piece) { if (!first) first = Date.now() - t0; chars += piece.length;
                           onEvent({ type: 'token', text: piece }); }
              if (fin) { onEvent({ type: 'done', stats: { chars, ms: Date.now() - t0, firstMs: first } }); return; }
            }
          }
          onEvent({ type: 'done', stats: { chars, ms: Date.now() - t0, firstMs: first } });
        } catch (e) {
          if (e.name === 'AbortError') return;
          onEvent({ type: 'error', error: 'BLOCKED',
            message: 'The page could not reach the model server. This is the '
                   + 'browser security rule that the shell’s model service '
                   + 'exists to avoid — see Engine for the one-line fix.' });
        }
      })();
      return { ok: true, id: 'direct', stop: () => ctl.abort() };
    },
  };
})();

// ─── 2 · Small helpers ──────────────────────────────────────────────────────

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nfmt = (n) => n.toLocaleString('en-US');

function status(left, right) {
  if (left != null) $('#st-left').textContent = left;
  if (right != null) $('#st-right').textContent = right;
}

function sheet(title, html) {
  $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = html;
  $('#sheet').classList.add('on');
}
$('#sheet-x').onclick = () => $('#sheet').classList.remove('on');
$('#sheet').onclick = (e) => { if (e.target.id === 'sheet') $('#sheet').classList.remove('on'); };

function copyText(t, btn) {
  const done = () => { if (!btn) return; const o = btn.textContent;
    btn.textContent = 'copied'; setTimeout(() => { btn.textContent = o; }, 1300); };
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, () => {});
  else { const ta = document.createElement('textarea'); ta.value = t;
         document.body.appendChild(ta); ta.select();
         try { document.execCommand('copy'); done(); } catch (e) {}
         document.body.removeChild(ta); }
}

// ─── 3 · State ──────────────────────────────────────────────────────────────

const S = {
  R: null,                    // the retrieval model
  view: 'ask',
  engine: null,               // { url, api, name, model } or { provider, model }
  keys: {},                   // provider -> api key, kept in this app's own store
  hosted: [],                 // provider catalogue from the shell
  hostedModels: {},           // provider -> [models], once a key works
  endpoints: [],
  probed: [],
  gen: {                      // generation settings
    //  2,400 rather than 900: a capable model asked a real question needs
    //  room to work, and an answer that stops mid-thought reads as
    //  stupidity when it is actually a budget.
    temperature: 0.7, topP: 0.95, maxTokens: 2400, passages: 5,
  },
  //  Conversations. The first version had exactly one thread that grew
  //  forever with no way to start another, which is not a design choice,
  //  it is a missing feature.
  convos: [],                 // [{ id, title, at, thread }]
  convoId: null,
  thread: [],                 // the open one's turns, [{ role, text, cites, stats }]
  stream: null,
  srcFilter: new Set(),
  readMode: 'search',
  train: { tier: '32', stage: 0, base: '', adapterSeen: false,
           prompt: 'The mirror does not', a: '', b: '' },
};

const SAVE_KEY = 'session';

//  Bumped whenever a default in S.gen changes meaning. restore() reads saved
//  settings over the defaults, so without this a person who has used the app
//  once keeps the old numbers forever and a shipped improvement never reaches
//  them — which is how a 900-token answer limit survived being raised to
//  2,400, and why answers kept stopping mid-thought after the fix.
const SETTINGS_VERSION = 2;

async function persist() {
  syncConvo();
  await F.save(SAVE_KEY, {
    v: SETTINGS_VERSION,
    engine: S.engine, gen: S.gen, train: S.train, keys: S.keys,
    convoId: S.convoId, seenGuide: S.seenGuide,
    //  Thirty conversations of sixty turns is more than anyone keeps, and it
    //  bounds the file so a year of use cannot make opening the app slow.
    convos: S.convos.slice(0, 30).map(c => ({
      id: c.id, title: c.title, at: c.at, thread: (c.thread || []).slice(-60),
    })),
  });
}

async function restore() {
  const d = await F.read(SAVE_KEY);
  if (!d) return;
  if (d.engine) S.engine = d.engine;
  if (d.keys) S.keys = d.keys;
  //  Only carry generation settings forward across a version where they still
  //  mean the same thing. Everything else — the engine, the keys, the
  //  conversation, where you are in the training sequence — is yours and
  //  survives regardless.
  if (d.gen && (d.v || 0) >= SETTINGS_VERSION) Object.assign(S.gen, d.gen);
  if (d.train) Object.assign(S.train, d.train);
  S.seenGuide = !!d.seenGuide;
  if (Array.isArray(d.convos) && d.convos.length) {
    S.convos = d.convos;
    const open = S.convos.find(c => c.id === d.convoId) || S.convos[0];
    S.convoId = open.id;
    S.thread = open.thread || [];
  } else if (Array.isArray(d.thread) && d.thread.length) {
    //  Carry a pre-conversations save forward rather than discarding it.
    S.convos = [{ id: cid(), title: titleFor(d.thread), at: Date.now(),
                  thread: d.thread }];
    S.convoId = S.convos[0].id;
    S.thread = d.thread;
  }
}

// ─── 4 · Boot ───────────────────────────────────────────────────────────────

async function boot() {
  const msg = $('#boot-msg');
  try {
    //  Already in memory. data/fracture-index.js is a plain script that
    //  assigns the trained model to a global, and it is loaded by a <script>
    //  tag rather than fetched, because an app window is a file:// page and
    //  Chromium forbids a file:// page from fetching a file:// URL. That is
    //  not a header the page can set; it is a hard rule about the scheme, and
    //  it is why the first version of this app booted to a blank screen.
    const model = window.FRACTURE_INDEX;
    if (!model) throw new Error('data/fracture-index.js did not load');
    msg.textContent = 'unpacking the retrieval model\u2026';
    await new Promise(r => setTimeout(r, 16));
    S.R = new window.FractureRetrieval(model);
  } catch (e) {
    msg.innerHTML = 'The retrieval model did not load.<br><br>'
      + '<span style="font:12px/1.7 var(--mono);color:var(--faint)">'
      + esc(e.message) + '</span>';
    return;
  }

  await restore();
  if (!S.convos.length) {
    S.convos = [{ id: cid(), title: 'New conversation', at: Date.now(), thread: [] }];
    S.convoId = S.convos[0].id;
    S.thread = S.convos[0].thread;
  }
  buildRead();
  buildTrain();
  renderAll();
  $('#boot').classList.add('gone');
  if (!S.seenGuide) showGuide();

  const st = S.R.stats();
  status(`${nfmt(st.passages)} passages · ${nfmt(st.windows)} windows · `
       + `${nfmt(st.vocab)} terms · ${st.dims} dimensions`,
         LLM.viaShell ? 'model service: shell' : 'model service: direct');

  //  Discovery is on a timer rather than in the boot path: the app has to be
  //  usable the moment it opens, and probing eight ports that mostly are not
  //  there takes a second or two.
  setTimeout(discover, 120);
  setTimeout(loadProviders, 200);
}

// ─── 5 · The engine ─────────────────────────────────────────────────────────

function setDot(kind, label) {
  const d = $('#dot');
  d.className = kind || '';
  $('#engine-label').textContent = label;
  try { weakNote(); } catch (e) {}
}

async function discover(extra) {
  setDot('busy', 'looking…');
  let r;
  try { r = await LLM.discover(extra || null); }
  catch (e) { r = { ok: false, endpoints: [], probed: [] }; }
  S.endpoints = r.endpoints || [];
  S.probed = r.probed || [];

  //  A remembered choice wins if it is still answering; otherwise the first
  //  thing found does, because an app that finds a model and refuses to use
  //  it until you pick it from a menu is just a menu.
  //  A hosted engine is not something discovery can confirm or deny, so it
  //  is left alone entirely. Only a local choice is re-checked.
  if (S.engine && S.engine.provider) {
    setDot('live', shortModel(S.engine.model));
    if (S.view === 'model') buildModel();
    return;
  }
  if (S.engine) {
    const still = S.endpoints.find(e => e.url === S.engine.url && e.api === S.engine.api);
    if (still && still.models.some(m => m.id === S.engine.model)) {
      setDot('live', shortModel(S.engine.model));
      if (S.view === 'model') buildModel();
      return;
    }
  }
  if (S.endpoints.length) {
    const e = S.endpoints[0];
    const m = pickDefaultModel(e.models);
    S.engine = { url: e.url, api: e.api, name: e.name, model: m };
    setDot('live', shortModel(m));
    persist();
  } else {
    S.engine = null;
    setDot('bad', 'no engine');
  }
  if (S.view === 'model') buildModel();
}

//  Prefer a fine-tune of these manuscripts if one is installed, then a
//  reasonably sized instruct model, then anything.
function pickDefaultModel(models) {
  if (!models || !models.length) return null;
  const ids = models.map(m => m.id);
  const fc = ids.find(i => /fracture|fmt|exulansis|erickson/i.test(i));
  if (fc) return fc;
  const inst = ids.find(i => /instruct|chat|it\b/i.test(i) && !/embed/i.test(i));
  if (inst) return inst;
  const nonEmbed = ids.find(i => !/embed|bge|minilm|rerank/i.test(i));
  return nonEmbed || ids[0];
}

function shortModel(m) {
  if (!m) return 'no model';
  return String(m).replace(/^mlx-community\//, '').replace(/:latest$/, '');
}

$('#engine').onclick = () => show('model');

// ─── 6 · ASK ────────────────────────────────────────────────────────────────

//  THE PROMPT, AND WHY THE FIRST ONE MADE A DECENT MODEL SOUND STUPID
//  -------------------------------------------------------------------
//  The first version opened with "You answer out of three manuscripts" and
//  told the model to announce when it was working without them. What came
//  back was: "As FractureCore, I must rely on general knowledge since no
//  passages were retrieved for this question." That is not the model being
//  dim. That is the prompt turning an assistant into a compliance officer,
//  and then the compliance officer hedging instead of answering.
//
//  Three things were wrong and all three are fixed here.
//
//    1. It was told it answers OUT OF the books. So anything not in the books
//       felt out of scope, and it deflected rather than just answering.
//       It is a general assistant now. The books are something it knows,
//       not the edge of what it is allowed to think about.
//
//    2. Passages went in on EVERY question. Ask it "think" and it got six
//       paragraphs of unrelated prose to reconcile with a one-word prompt.
//       Irrelevant context does not sit there harmlessly; it drags the answer
//       toward whatever it happens to say. Passages are now gated on their
//       actual retrieval score, and most questions get none.
//
//    3. It was told to say when it had not used the manuscripts. Nobody
//       wants that sentence. The sources are on screen. It now narrates
//       nothing about its own plumbing, ever.

const VOICE_RULES = [
  'Flat declarative prose. Short sentences. Concrete before abstract.',
  'Never use em dashes. A comma, a full stop, or a colon instead.',
  'No throat-clearing. Do not restate the question before answering it.',
  'No summary paragraph at the end repeating what you just said.',
  'Bullet lists only when the material is genuinely a list.',
];

//  WHEN TO HAND OVER PASSAGES, AND WHY THIS IS NOT A CLASSIFIER
//  -----------------------------------------------------------
//  The obvious design is a relevance gate: decide whether the question is
//  about these books, and pass passages only if it is. That was tried and it
//  does not work, and the reason is worth writing down rather than tuning
//  around.
//
//  Measured over on-topic and off-topic questions, no single signal
//  separates them. Not the search score, which is min-max normalised so the
//  top hit is 1.0 whether it is a perfect match or the least bad of 1,132
//  irrelevant ones. Not the raw cosine, where "retirement is a promise nobody
//  intends to keep" (on-topic, 0.076) scores BELOW "write a python function"
//  (off-topic, 0.111), because the books discuss retirement in words the
//  question does not use while the code question shares ordinary words like
//  function and list. Not term coverage, where "think" scores a perfect 1.0.
//
//  A 106,000-word corpus about meaning, systems and collapse shares
//  vocabulary with almost any question. That is a fact about the corpus, not
//  a threshold waiting to be found.
//
//  So the gate only refuses the hopeless cases, and the model decides the
//  rest, because deciding what is relevant is the thing the model is
//  genuinely better at than a bag of words. The prompt tells it plainly that
//  some of what it is given may be beside the point.
//
//  Failure direction is deliberate: it lets marginal material through rather
//  than withholding material that turns out to matter. A passage the model
//  ignores costs a little context. A passage it never saw costs the answer.

const GATE = {
  minTerms: 2,       // one word is not a question about anything
  minCos: 0.06,      // below this the corpus has nothing in the neighbourhood
  minBmFrac: 0.55,   // unless the exact words are there in force
  max: 4,            // four is plenty; more crowds out the question itself
};

function relevant(res) {
  const hits = (res && res.hits) || [];
  if (!hits.length) return [];
  if ((res.terms || []).length < GATE.minTerms) return [];
  const top = hits[0];
  if (top.cos < GATE.minCos && top.bmFrac < GATE.minBmFrac) return [];
  return hits.slice(0, GATE.max);
}

function buildPrompt(question, hits, opts) {
  const sys = [];

  sys.push(
    'You are FractureCore.\n\n'
  + 'You are a capable, well-read assistant with broad general knowledge, and '
  + 'you answer anything you are asked as well as you can. Reason carefully. '
  + 'Take a position. Work through a problem rather than gesturing at how one '
  + 'might be worked through. Answer hypotheticals as asked instead of '
  + 'explaining that they are hypothetical.');

  sys.push(
    'You also happen to know three manuscripts by P. R. Erickson intimately: '
  + 'Fractured Mirror Theory, Exulansis, and The Next Ten Years. They are '
  + 'part of what you know, not the boundary of it.');

  if (opts.ground && hits.length) {
    sys.push(
      'Passages from those manuscripts are supplied below. A search put them '
    + 'there; a search can be wrong. Read them, use whichever actually bear '
    + 'on the question, and ignore the rest completely \u2014 including all of '
    + 'them, if none do. Never bend an answer toward a passage to justify '
    + 'having been given it. Cite one as [1], [2] and so on at the point '
    + 'where you genuinely draw on it.\n\n'
    + 'Never attribute a claim to the manuscripts that is not in the passages '
    + 'given. Inventing a citation is the one unforgivable failure here. '
    + 'Everything else you say from your own knowledge, uncited, in your own '
    + 'voice.');
  }

  //  NOTHING about retrieval state. No "no passages were found", no "I must
  //  rely on general knowledge", no "as FractureCore". The reader can see the
  //  source panel; being told about it in prose is noise at best and reads as
  //  incapacity at worst.
  sys.push(
    'Never narrate your own machinery. Do not mention passages, retrieval, '
  + 'context, what you were or were not given, or what you are. Do not open '
  + 'with "As FractureCore". Just answer.');

  if (opts.voice) sys.push('Style: ' + VOICE_RULES.join(' '));

  const messages = [{ role: 'system', content: sys.join('\n\n') }];

  //  Prior turns. Longer than before: a model that forgets what was said four
  //  exchanges ago reads as stupid no matter how good it is.
  const prior = S.thread.filter(t => t.role !== 'system' && !t.retrievalOnly)
                        .slice(-12);
  for (const t of prior) {
    const text = (t.text || '').trim();
    if (!text) continue;
    messages.push({ role: t.role === 'me' ? 'user' : 'assistant', content: text });
  }

  //  Passages ride with the question, not in the system prompt, so they are
  //  scoped to this turn and do not accumulate across a conversation.
  let content = question;
  if (opts.ground && hits.length) {
    const ctx = hits.map((h, i) => {
      const lbl = S.R.sources[h.source] ? S.R.sources[h.source].label : h.source;
      return `[${i + 1}] (${lbl})\n${h.text}`;
    }).join('\n\n');
    content = `${ctx}\n\n———\n\n${question}`;
  }
  messages.push({ role: 'user', content });
  return messages;
}

//  ── Conversations ─────────────────────────────────────────────

function cid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

//  The first thing you said, trimmed. Better than "Conversation 4", and it is
//  what you will actually recognise the thread by a week later.
function titleFor(thread) {
  const first = (thread || []).find(t => t.role === 'me');
  if (!first) return 'New conversation';
  const t = first.text.replace(/\s+/g, ' ').trim();
  return t.length > 64 ? t.slice(0, 63) + '\u2026' : (t || 'New conversation');
}

function current() { return S.convos.find(c => c.id === S.convoId) || null; }

//  S.thread is the live array the rest of the app appends to. This copies it
//  back into the conversation record before anything is written to disk.
function syncConvo() {
  const c = current();
  if (!c) return;
  c.thread = S.thread;
  const t = titleFor(S.thread);
  //  Repaint only when the name actually changed, which is once per
  //  conversation, rather than on every token of every answer.
  const changed = c.title !== t;
  c.title = t;
  c.at = Date.now();
  if (changed) { try { renderConvoBar(); } catch (e) {} }
}

function newConvo(focus) {
  syncConvo();
  //  Do not stack empty ones. Pressing New twice should not leave a trail of
  //  blank conversations in the list.
  const c = current();
  if (c && !c.thread.length) { S.thread = []; renderAll(); return; }
  const n = { id: cid(), title: 'New conversation', at: Date.now(), thread: [] };
  S.convos.unshift(n);
  S.convoId = n.id;
  S.thread = n.thread;
  renderAll();
  persist();
  if (focus !== false) setTimeout(() => $('#q').focus(), 20);
}

function openConvo(id) {
  syncConvo();
  const c = S.convos.find(x => x.id === id);
  if (!c) return;
  S.convoId = c.id;
  S.thread = c.thread || (c.thread = []);
  $('#convolist').classList.remove('on');
  renderAll();
  persist();
}

function deleteConvo(id) {
  const i = S.convos.findIndex(c => c.id === id);
  if (i < 0) return;
  S.convos.splice(i, 1);
  if (!S.convos.length) {
    S.convos = [{ id: cid(), title: 'New conversation', at: Date.now(), thread: [] }];
  }
  const next = S.convos[Math.min(i, S.convos.length - 1)];
  S.convoId = next.id;
  S.thread = next.thread || (next.thread = []);
  renderAll();
  persist();
}

function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return m + 'm';
  const h = Math.round(m / 60);
  if (h < 24) return h + 'h';
  return Math.round(h / 24) + 'd';
}

function renderConvoBar() {
  const c = current();
  $('#convo-title').textContent = c ? c.title : 'New conversation';
  $('#convo-count').textContent = S.convos.length > 1
    ? S.convos.length + ' conversations' : '';
  $('#convo-del').style.display = (c && c.thread.length) ? '' : 'none';

  const list = $('#convolist');
  list.innerHTML = S.convos.map(x => `
    <div class="crow ${x.id === S.convoId ? 'on' : ''}" data-c="${x.id}">
      <b>${esc(x.title)}</b>
      <span>${(x.thread || []).filter(t => t.role === 'me').length} asked</span>
      <span>${ago(x.at)}</span>
    </div>`).join('');
  $$('.crow', list).forEach(r => { r.onclick = () => openConvo(r.dataset.c); });
}

function renderAll() {
  renderConvoBar(); renderThread(); renderSources(lastHits);
  try { weakNote(); } catch (e) {}
}

let lastHits = [];

//  ── A word about the model actually answering ────────────────────
//  Everything else in this app is bounded by which model is behind it, and a
//  person running a two-year-old 8B has no way to know that is why the answers
//  are thin. So the app says so, once, where it matters, rather than leaving
//  it to be discovered.

const WEAK = /^(llama3(\.[01])?|llama-?3|mistral|mixtral|gemma:|gemma2|phi3|phi-3|vicuna|orca|openhermes|zephyr|neural-chat|stablelm|tinyllama|qwen2(:|\b)|qwen:)/i;

function weakNote() {
  const el = $('#weak');
  if (!el) return;
  const m = S.engine && S.engine.model;
  if (!m || S.engine.provider || !WEAK.test(shortModel(m))) {
    el.classList.remove('on');
    return;
  }
  el.classList.add('on');
  el.innerHTML = `<b>${esc(shortModel(m))} is the ceiling here.</b>
    Everything this app does is bounded by the model behind it, and that one is
    a couple of generations old. Nothing else will make the answers sharper.
    Two ways out, both on the Engine tab: run
    <code id="weak-cmd">ollama pull qwen3:8b</code> in a terminal for something
    the same size and much newer, or paste an API key for a frontier model.
    <span style="color:var(--faint)">Click the command to copy it.</span>`;
  const cmd = $('#weak-cmd');
  if (cmd) cmd.onclick = () => copyText('ollama pull qwen3:8b', null);
}

function renderThread() {
  const el = $('#thread');
  const keep = $('#weak');
  if (!S.thread.length) {
    el.innerHTML = `<div class="empty" style="margin-top:9vh">
      <b>Ask it anything</b>
      It is a general assistant. Ask it about anything at all and it just
      answers.<br><br>
      When the question touches your books it searches them first and builds
      the answer on what it finds, citing which passage it used. Those appear
      on the right so you can check it.<br><br>
      <em>what does the mirror do that a metaphor does not</em><br>
      <em>continue this, in the same voice: The town did not grow by gathering.</em><br>
      <em>where does the theory contradict itself</em>
    </div>`;
    if (keep) el.insertBefore(keep, el.firstChild);
    $('#sources-list').innerHTML = '<div class="empty">Sources appear here once you ask something.</div>';
    return;
  }
  el.innerHTML = S.thread.map((t, i) => {
    const who = t.role === 'me' ? 'you' : 'fracturecore';
    let meta = '';
    if (t.stats) {
      const bits = [];
      if (t.stats.ms) bits.push((t.stats.ms / 1000).toFixed(1) + 's');
      if (t.stats.firstMs) bits.push(t.stats.firstMs + 'ms to first word');
      if (t.model) bits.push(shortModel(t.model));
      if (t.retrievalOnly) bits.push('retrieval only — no language model was running');
      meta = `<div class="meta">${esc(bits.join('  ·  '))}</div>`;
    }
    const cites = (t.cites && t.cites.length)
      ? `<div class="cites">${t.cites.map((c, j) =>
          `<span class="cite" data-t="${i}" data-c="${j}">[${j + 1}] ${esc(
            S.R.sources[c.source] ? S.R.sources[c.source].short : c.source)}</span>`
        ).join('')}</div>` : '';
    return `<div class="turn ${t.role}">
        <div class="who">${who}</div>
        <div class="body">${esc(t.text)}${t.live ? '<span class="caret"></span>' : ''}</div>
        ${cites}${meta}
      </div>`;
  }).join('');
  if (keep) el.insertBefore(keep, el.firstChild);
  el.scrollTop = el.scrollHeight;

  $$('.cite', el).forEach(c => {
    c.onclick = () => {
      const t = S.thread[+c.dataset.t], h = t.cites[+c.dataset.c];
      const lbl = S.R.sources[h.source] ? S.R.sources[h.source].label : h.source;
      sheet(lbl, `<div style="white-space:pre-wrap">${esc(h.text)}</div>`);
    };
  });
}

function renderSources(hits, notUsed) {
  const el = $('#sources-list');
  if (!hits || !hits.length) {
    el.innerHTML = '<div class="empty">Nothing was retrieved for that.</div>';
    return;
  }
  const head = notUsed
    ? '<div style="padding:0 16px 12px;font-size:12px;line-height:1.65;'
    + 'color:var(--faint)">Nothing in the books was close enough to this '
    + 'question to be worth handing over, so the answer is from general '
    + 'knowledge. These are the nearest passages anyway.</div>' : '';
  el.innerHTML = head + hits.map((h, i) => {
    const s = S.R.sources[h.source] || { short: h.source, label: h.source };
    return `<div class="src-card" data-i="${i}">
      <div class="t"><span>[${i + 1}] ${esc(s.short)}</span>
        <span>${h.score.toFixed(3)}</span></div>
      <div class="x">${esc(h.text)}</div>
    </div>`;
  }).join('');
  $$('.src-card', el).forEach(c => { c.onclick = () => c.classList.toggle('open'); });
}

async function ask() {
  const q = $('#q').value.trim();
  if (!q || S.stream) return;
  $('#q').value = ''; sizeQ();

  const ground = $('#opt-ground').checked;
  const voice = $('#opt-voice').checked;

  //  Retrieve, then keep only what is actually about the question. Six
  //  paragraphs of unrelated prose bolted to a one-word prompt is how the
  //  first version answered “think” with a lecture on retirement.
  let hits = [], found = [];
  if (ground) {
    const r = S.R.search(q, { limit: Math.max(S.gen.passages, 8) });
    found = r.hits;
    hits = relevant(r).slice(0, S.gen.passages);
    lastHits = hits.length ? hits : found.slice(0, 3);
    renderSources(lastHits, hits.length === 0);
    status(null, hits.length
      ? `${hits.length} passage${hits.length === 1 ? '' : 's'} in context`
      : 'nothing in the books on this — answering from knowledge');
  } else {
    lastHits = [];
    renderSources([]);
  }

  S.thread.push({ role: 'me', text: q });

  //  No engine: answer with what was found and say so. This is the one place
  //  it would be easy to fake, and faking it would make the app worthless —
  //  a montage of real passages presented as prose is a forgery of the book.
  if (!S.engine || !S.engine.model) {
    S.thread.push({
      role: 'it', retrievalOnly: true, cites: hits, stats: { ms: 0 },
      text: hits.length
        ? 'No language model is running, so nothing here is written — what '
        + 'follows is the ' + hits.length + ' passages the retrieval model found '
        + 'for that, strongest first. They are on the right in full.\n\n'
        + hits.map((h, i) => `[${i + 1}] ${h.text.split(/\s+/).slice(0, 44).join(' ')}…`)
              .join('\n\n')
        : 'No language model is running, and the retrieval model found nothing '
        + 'for that in the three books. Open Engine to connect a model.',
    });
    renderThread(); persist();
    return;
  }

  const turn = { role: 'it', text: '', cites: hits, live: true,
                 model: S.engine.model };
  S.thread.push(turn);
  renderThread();

  $('#send').style.display = 'none';
  $('#halt').style.display = '';
  setDot('busy', 'writing…');

  const messages = buildPrompt(q, hits, { ground, voice });
  let painted = 0;
  const repaint = () => {
    const now = Date.now();
    if (now - painted < 55) return;
    painted = now; renderThread();
  };

  S.stream = await LLM.chat(Object.assign({
    model: S.engine.model, messages,
    temperature: S.gen.temperature, topP: S.gen.topP,
    maxTokens: S.gen.maxTokens,
  }, S.engine.provider
      ? { provider: S.engine.provider, apiKey: S.keys[S.engine.provider] || '' }
      : { baseUrl: S.engine.url, api: S.engine.api }),
  (ev) => {
    if (ev.type === 'token') { turn.text += ev.text; repaint(); }
    else if (ev.type === 'done') {
      turn.live = false; turn.stats = ev.stats; S.stream = null;
      renderThread(); persist();
      $('#send').style.display = ''; $('#halt').style.display = 'none';
      setDot('live', shortModel(S.engine.model));
      status(null, `${ev.stats.chars} characters in ${(ev.stats.ms / 1000).toFixed(1)}s`);
    } else if (ev.type === 'error') {
      turn.live = false;
      turn.text += (turn.text ? '\n\n' : '') + '———\n' + ev.message;
      S.stream = null; renderThread(); persist();
      $('#send').style.display = ''; $('#halt').style.display = 'none';
      setDot('bad', 'failed');
      status(null, ev.error);
    }
  });
}

function sizeQ() {
  const t = $('#q');
  t.style.height = 'auto';
  t.style.height = Math.min(190, t.scrollHeight) + 'px';
}

$('#q').addEventListener('input', sizeQ);
$('#q').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ask(); }
  else if (e.key === 'Enter' && !e.shiftKey && !e.altKey) { e.preventDefault(); ask(); }
});
$('#send').onclick = ask;
$('#convo-new').onclick = () => newConvo();
$('#convo-pick').onclick = () => {
  const l = $('#convolist');
  l.classList.toggle('on');
  if (l.classList.contains('on')) renderConvoBar();
};
$('#convo-del').onclick = () => deleteConvo(S.convoId);
$('#helpbtn').onclick = () => showGuide();
$('#guide-x').onclick = () => {
  $('#guide').classList.remove('on');
  S.seenGuide = true;
  persist();
  setTimeout(() => $('#q').focus(), 30);
};
function showGuide() { $('#guide').classList.add('on'); }
$('#halt').onclick = () => {
  if (S.stream) { S.stream.stop(); S.stream = null; }
  const last = S.thread[S.thread.length - 1];
  if (last && last.live) { last.live = false; last.stats = { ms: 0 }; }
  renderThread();
  $('#send').style.display = ''; $('#halt').style.display = 'none';
  setDot('live', shortModel(S.engine && S.engine.model));
};

// ─── 7 · READ ───────────────────────────────────────────────────────────────

function buildRead() {
  const st = S.R.stats();
  $('#corpus-stats').innerHTML = `<dl class="kv">
    <dt>passages</dt><dd>${nfmt(st.passages)}</dd>
    <dt>windows</dt><dd>${nfmt(st.windows)}</dd>
    <dt>vocabulary</dt><dd>${nfmt(st.vocab)}</dd>
    <dt>dimensions</dt><dd>${st.dims}</dd>
  </dl>`;

  $('#src-filters').innerHTML = Object.keys(st.sources).map(k => {
    const s = st.sources[k];
    return `<label style="font-size:12.5px;cursor:pointer;color:var(--dim)">
      <input type="checkbox" data-src="${esc(k)}" checked> ${esc(s.label)}
      <span style="color:var(--faint)">${s.count}</span></label>`;
  }).join('');
  $$('#src-filters input').forEach(cb => {
    S.srcFilter.add(cb.dataset.src);
    cb.onchange = () => {
      if (cb.checked) S.srcFilter.add(cb.dataset.src);
      else S.srcFilter.delete(cb.dataset.src);
      runRead();
    };
  });

  const e = st.eval || {};
  const L = e.long || {}, SH = e.short || {};
  $('#eval-report').innerHTML = `
    <div style="font-size:12px;line-height:1.75;color:var(--faint)">
      Measured on held-out windows the model never saw fitted.
    </div>
    <dl class="kv" style="margin-top:9px">
      <dt>a few words in</dt><dd>${(SH.r1 * 100).toFixed(1)}% exact, first try</dd>
      <dt>a paragraph in</dt><dd>${(L.r5 * 100).toFixed(0)}% in the top five</dd>
      <dt>against lexical</dt><dd>${((L.mrr / (L.bm25_mrr || 1) - 1) * 100).toFixed(0)}% better</dd>
      <dt>neighbours</dt><dd>${(e.adj1 * 100).toFixed(0)}% land adjacent</dd>
    </dl>
    <div style="margin-top:10px"><button class="btn sm" id="eval-more">the numbers</button></div>`;
  $('#eval-more').onclick = () => sheet('How the retrieval model was measured', evalHtml(e));

  $$('input[name=rmode]').forEach(r => r.onchange = () => {
    S.readMode = r.value;
    $('#s').placeholder = S.readMode === 'kwic'
      ? 'An exact phrase, as it appears on the page…'
      : 'A theme, a half-remembered line, a phrase…';
    runRead();
  });

  let t = null;
  $('#s').addEventListener('input', () => { clearTimeout(t); t = setTimeout(runRead, 130); });
}

function evalHtml(e) {
  const L = e.long || {}, SH = e.short || {};
  const row = (n, d) => `<tr><td>${n}</td><td style="text-align:right">${d}</td></tr>`;
  return `
  <p>There are no relevance labels for these manuscripts, so one was built that
  cannot leak. Every window of the corpus was cut in half. The second halves
  were indexed; the first halves became the queries. A hit is the window a
  query was cut from, and the query's own wording is absent from what was
  indexed, so nothing can be found by matching the question back to itself.</p>
  <p>There are two kinds of query and they want opposite settings, which is why
  the app carries two and interpolates between them on how much you type.</p>
  <table class="mem"><tr><th>a paragraph in</th><th></th></tr>
    ${row('found first', (L.r1 * 100).toFixed(1) + '%')}
    ${row('in the top five', (L.r5 * 100).toFixed(1) + '%')}
    ${row('in the top ten', (L.r10 * 100).toFixed(1) + '%')}
    ${row('mean reciprocal rank', L.mrr)}
    ${row('exact matching alone', L.bm25_mrr)}
    ${row('meaning alone', L.lsa_mrr)}
  </table>
  <table class="mem"><tr><th>a few remembered words</th><th></th></tr>
    ${row('found first', (SH.r1 * 100).toFixed(1) + '%')}
    ${row('mean reciprocal rank', SH.mrr)}
  </table>
  <p>Finding one specific seventy-word passage out of 1,105 near-identical
  ones, from different wording, is genuinely hard, and ${(L.r1 * 100).toFixed(0)}%
  first-try is the honest number for it. The one that matters more in use is
  the last: given a passage, ${(e.adj1 * 100).toFixed(0)}% of the time the top
  result is the passage next to it in the book, and a neighbour is in the top
  five ${(e.adj5 * 100).toFixed(0)}% of the time. The model reliably finds the
  right region of the books.</p>
  <p style="color:var(--faint);font-size:12.5px">Blend chosen by the sweep:
  ${e.alphaShort} meaning for short queries, ${e.alphaLong} for long ones, over
  ${e.dims} dimensions.</p>`;
}

function hiLite(text, terms) {
  let out = esc(text);
  if (!terms || !terms.length) return out;
  //  Highlight on the stem, so a query for "collapsing" marks "collapse".
  const words = out.split(/(\s+)/);
  return words.map(w => {
    const bare = w.replace(/[^A-Za-z']/g, '');
    if (!bare) return w;
    const st = S.R.stem(bare.toLowerCase());
    return terms.includes(st) ? w.replace(bare, '<mark>' + bare + '</mark>') : w;
  }).join('');
}

function runRead() {
  const q = $('#s').value.trim();
  const el = $('#hits');
  if (!q) {
    el.innerHTML = `<div class="empty"><b>The three books, searchable</b>
      Type a theme and the model finds the passages about it, whether or not
      they use your words. Switch to phrase mode on the left to see every place
      an exact wording appears.</div>`;
    return;
  }

  if (S.readMode === 'kwic') {
    const rows = S.R.concordance(q, 300).filter(r => S.srcFilter.has(r.source));
    if (!rows.length) { el.innerHTML = `<div class="empty">No occurrence of that exact wording.</div>`; return; }
    el.innerHTML = `<div style="margin-bottom:14px;font:10px/1 var(--mono);
      letter-spacing:2px;color:var(--faint)">${rows.length} OCCURRENCES</div>`
      + rows.map(r => {
          const s = S.R.sources[r.source] || { short: r.source };
          return `<div class="kwic"><i>${esc(s.short)}</i> …${esc(r.before)}<b>${esc(r.match)}</b>${esc(r.after)}…</div>`;
        }).join('');
    status(null, rows.length + ' occurrences');
    return;
  }

  const r = S.R.search(q, { limit: 18, sources: S.srcFilter });
  if (r.empty) {
    el.innerHTML = `<div class="empty">${r.unknown
      ? 'None of those words appear anywhere in the three books.'
      : 'Type something to search for.'}</div>`;
    return;
  }
  if (!r.hits.length) { el.innerHTML = `<div class="empty">Nothing in the books selected.</div>`; return; }

  el.innerHTML = `<div style="margin-bottom:16px;font:10px/1 var(--mono);
    letter-spacing:2px;color:var(--faint)">${r.hits.length} PASSAGES ·
    BLEND ${r.alpha.toFixed(2)} MEANING · ${esc(r.terms.join(' '))}</div>`
    + r.hits.map((h, i) => {
      const s = S.R.sources[h.source] || { short: h.source, label: h.source };
      const bar = h.lsa != null ? `<span class="axis" title="meaning vs exact">
          <i style="background:var(--violet);width:${Math.round(h.lsa * 100 * r.alpha)}%"></i>
          <i style="background:var(--cyan);width:${Math.round(h.lex * 100 * (1 - r.alpha))}%"></i>
        </span>` : '';
      return `<div class="hit" data-w="${h.window}">
        <div class="top"><b>${esc(s.short)}</b>
          <span>${h.score.toFixed(3)}</span>${bar}
          <span style="margin-left:auto">${h.members.length} passages</span></div>
        <div class="tx">${hiLite(h.text, r.terms)}</div>
        <div class="acts">
          <button class="btn sm" data-a="like">what this sits next to</button>
          <button class="btn sm" data-a="ask">take it to Ask</button>
          <button class="btn sm" data-a="copy">copy</button>
        </div>
      </div>`;
    }).join('');

  $$('#hits .hit').forEach(hit => {
    const w = +hit.dataset.w;
    $$('button', hit).forEach(b => {
      b.onclick = () => {
        const text = S.R.windows[w].m.map(i => S.R.passages[i].t).join('\n\n');
        if (b.dataset.a === 'copy') copyText(text, b);
        else if (b.dataset.a === 'ask') {
          show('ask');
          $('#q').value = 'Continue this, in the same voice:\n\n' + text;
          sizeQ(); $('#q').focus();
        } else {
          const near = S.R.similar(w, 6);
          sheet('What this sits next to', near.map(n => {
            const s = S.R.sources[n.source] || { short: n.source };
            return `<div style="margin-bottom:18px;padding-bottom:16px;
              border-bottom:1px solid rgba(255,255,255,.055)">
              <div style="font:9px/1 var(--mono);letter-spacing:1.8px;
                color:var(--gold);margin-bottom:8px">${esc(s.short)} ·
                ${n.score.toFixed(3)}</div>
              <div style="white-space:pre-wrap">${esc(n.text)}</div></div>`;
          }).join(''));
        }
      };
    });
  });
  status(null, `${r.hits.length} passages · blend ${r.alpha.toFixed(2)}`);
}

// ─── 8 · TRAIN ──────────────────────────────────────────────────────────────
//  What this screen is honest about: the fine-tune cannot run in here. MLX
//  wants the Mac's own GPU and a terminal, and no browser page gets either.
//  So the screen does the parts that CAN be done well from inside the app —
//  choosing the right model for the machine, writing the exact command,
//  keeping track of where you are, and testing the result against the base
//  model when it exists — and hands over the one step it cannot take.

const TIERS = {
  '16': { mem: '16 GB', model: 'mlx-community/Qwen3-4B-4bit',
          note: 'Capable small model. Below GPT-4.',
          layers: 8, batch: 1, iters: 500 },
  '32': { mem: '32 GB', model: 'mlx-community/Qwen3-8B-4bit',
          note: 'Near original GPT-4 on many benchmarks, weaker on others.',
          layers: 16, batch: 2, iters: 600 },
  '64': { mem: '64 GB or more', model: 'mlx-community/Qwen3-32B-4bit',
          note: 'Roughly GPT-4 class or better on most public benchmarks.',
          layers: 16, batch: 2, iters: 800 },
};

function trainCmds() {
  const t = TIERS[S.train.tier];
  const m = t.model;
  return {
    install: 'pip3 install -U mlx-lm',
    train: `cd "$HOME/Fracture City/apps/fracture-core/kit"\n`
         + `mlx_lm.lora \\\n  --model ${m} \\\n  --train \\\n  --data data \\\n`
         + `  --iters ${t.iters} \\\n  --batch-size ${t.batch} \\\n`
         + `  --num-layers ${t.layers} \\\n  --adapter-path adapters`,
    generate: `mlx_lm.generate \\\n  --model ${m} \\\n  --adapter-path adapters \\\n`
            + `  --max-tokens 300 \\\n  --prompt "${S.train.prompt.replace(/"/g, '\\"')}"`,
    baseline: `mlx_lm.generate \\\n  --model ${m} \\\n  --max-tokens 300 \\\n`
            + `  --prompt "${S.train.prompt.replace(/"/g, '\\"')}"`,
    fuse: `mlx_lm.fuse \\\n  --model ${m} \\\n  --adapter-path adapters \\\n`
        + `  --save-path fused_model`,
    serve: `mlx_lm.server --model fused_model --port 8080`,
    ollama: `# or, to have it sit alongside everything else in Ollama:\n`
          + `cd "$HOME/Fracture City/apps/fracture-core/kit"\n`
          + `printf 'FROM ./fused_model\\n' > Modelfile\n`
          + `ollama create fracturecore -f Modelfile`,
  };
}

function cmdBlock(label, cmd, hint) {
  const id = 'c' + Math.random().toString(36).slice(2, 8);
  return `${hint ? `<p>${hint}</p>` : ''}
    <pre class="cmd" id="${id}">${esc(cmd)}</pre>
    <div class="cmdrow"><button class="btn sm" data-copy="${id}">copy</button>
      <span style="font:9px/1 var(--mono);letter-spacing:1.6px;color:var(--faint)">${esc(label)}</span></div>`;
}

function buildTrain() {
  const c = trainCmds();
  const t = TIERS[S.train.tier];
  const stage = S.train.stage;
  const step = (n, title, right, body) => `
    <div class="step ${stage === n ? 'open now' : ''} ${stage > n ? 'done' : ''}" data-step="${n}">
      <div class="h"><span class="n">${stage > n ? '✓' : n}</span><b>${title}</b>
        <span>${right || ''}</span></div>
      <div class="c">${body}</div>
    </div>`;

  $('#train-inner').innerHTML = `
    <div class="hdr" style="padding-left:0">The fine-tune</div>
    <p style="font-size:14px;line-height:1.8;color:var(--dim);max-width:70ch;margin:0 0 8px">
      This makes a model that writes in the manuscripts' voice. It starts from
      an open-weight model that already knows English and can reason, and
      trains a small adapter on the 2,038 passages in the kit. The base model
      supplies the fluency. The manuscripts supply the voice, the vocabulary
      and the preoccupations.
    </p>
    <div class="warn"><b>It cannot run in here.</b> MLX needs the Mac's own GPU
      and a terminal, and no application window gets either. What follows is
      the exact sequence for this machine: copy each line, run it in Terminal,
      and come back. The last step tests the result against the base model so
      you can hear whether it worked rather than assume it.</div>
    <div class="rule" style="margin-left:0;margin-right:0"></div>

    ${step(0, 'Pick the model for your Mac', t.mem, `
      <p>Bigger is better and slower, and a model that does not fit in memory
      does not run at all. Pick by the memory this Mac actually has.</p>
      <table class="mem">
        <tr><th>Memory</th><th>Base model</th><th>Standing</th></tr>
        ${Object.keys(TIERS).map(k => `
          <tr class="${S.train.tier === k ? 'pick' : ''}" data-tier="${k}">
            <td>${TIERS[k].mem}</td><td><code>${TIERS[k].model.replace('mlx-community/', '')}</code></td>
            <td style="color:var(--faint)">${TIERS[k].note}</td></tr>`).join('')}
      </table>
      <p style="color:var(--faint);font-size:12.5px">All three are Apache 2.0.
      The first run downloads the weights from Hugging Face; after that it is
      offline. If a name has moved on, the current one is in the
      <code>mlx-community</code> organisation.</p>
      <button class="btn go" data-next="1">This one</button>`)}

    ${step(1, 'Install the trainer', 'once per machine', `
      ${cmdBlock('one line, once', c.install,
        'MLX is Apple’s array framework and mlx-lm is the language-model '
      + 'layer on top of it. Nothing else is needed.')}
      <button class="btn go" data-next="2">Installed</button>
      <button class="btn" data-next="0">Back</button>`)}

    ${step(2, 'Hear the base model first', 'the control', `
      <p>Run this before training anything. It is the control: the same prompt,
      the same model, without the manuscripts. Without it there is nothing to
      compare the tuned model against, and every improvement is a feeling.</p>
      <label class="f"><u>the prompt to test with</u>
        <input type="text" id="tprompt" value="${esc(S.train.prompt)}"></label>
      ${cmdBlock('the control', c.baseline)}
      <label class="f"><u>paste what it wrote</u>
        <textarea id="tbase" rows="5" placeholder="Paste the base model’s output here so it can sit beside the tuned one at the end.">${esc(S.train.a)}</textarea></label>
      <button class="btn go" data-next="3">Done</button>
      <button class="btn" data-next="1">Back</button>`)}

    ${step(3, 'Train the adapter', `${t.iters} iterations`, `
      <p>This trains a small adapter on the passages in the kit and writes it
      to <code>adapters/</code>. The base model is never modified. Validation
      loss prints as it goes: it should fall and then flatten. If it starts
      climbing, stop it, the adapter from the last checkpoint is the one you
      want.</p>
      ${cmdBlock('expect minutes to an hour', c.train)}
      <div class="warn"><b>If it runs out of memory</b>, drop
        <code>--batch-size</code> to 1 and <code>--num-layers</code> to 8 or 4,
        or add <code>--grad-checkpoint</code>. Those trade speed for headroom
        and cost very little quality at this corpus size.</div>
      <button class="btn go" data-next="4">It finished</button>
      <button class="btn" data-next="2">Back</button>`)}

    ${step(4, 'Hear the difference', 'the test that matters', `
      <p>The same prompt, now through the adapter. Put the two side by side. If
      they are indistinguishable, the training did not take and the place to
      look is the validation loss from the previous step.</p>
      ${cmdBlock('the tuned model', c.generate)}
      <label class="f"><u>paste what it wrote</u>
        <textarea id="ttuned" rows="5" placeholder="Paste the tuned model’s output here.">${esc(S.train.b)}</textarea></label>
      <div class="ab">
        <div><h5>base model</h5><div class="o" id="ab-a">${esc(S.train.a) || '<span style="color:var(--faint)">nothing pasted yet</span>'}</div></div>
        <div><h5>with the manuscripts</h5><div class="o" id="ab-b">${esc(S.train.b) || '<span style="color:var(--faint)">nothing pasted yet</span>'}</div></div>
      </div>
      <div style="margin-top:14px">
        <button class="btn go" data-next="5">It sounds like the books</button>
        <button class="btn" data-next="3">Train it again</button></div>`)}

    ${step(5, 'Make it a model this app can use', 'the last step', `
      <p>Fusing merges the adapter into the base weights and writes a complete,
      standalone model. That is what turns a training artifact into something
      you can point this app at, archive, or run anywhere else.</p>
      ${cmdBlock('writes fused_model/', c.fuse)}
      <p>Then serve it, and FractureCore will find it on the next look:</p>
      ${cmdBlock('serves on port 8080', c.serve)}
      ${cmdBlock('alternative', c.ollama)}
      <div class="warn ok"><b>Once it is running</b>, open Engine and press
        Look again. A model whose name contains "fracture" is picked ahead of
        everything else automatically.</div>
      <button class="btn go" data-next="6">Done</button>
      <button class="btn" data-next="4">Back</button>`)}

    <div class="rule" style="margin-left:0;margin-right:0"></div>
    <div class="hdr" style="padding-left:0">What it trains on</div>
    <div id="kit-stats"></div>
  `;

  //  Wiring.
  $$('#train-inner .step .h').forEach(h => {
    h.onclick = () => {
      const n = +h.parentElement.dataset.step;
      S.train.stage = (S.train.stage === n) ? -1 : n;
      buildTrain();
    };
  });
  $$('#train-inner [data-next]').forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation();
      grabTrainInputs();
      S.train.stage = +b.dataset.next;
      persist(); buildTrain();
    };
  });
  $$('#train-inner [data-tier]').forEach(r => {
    r.onclick = (e) => { e.stopPropagation(); S.train.tier = r.dataset.tier;
                         persist(); buildTrain(); };
  });
  $$('#train-inner [data-copy]').forEach(b => {
    b.onclick = (e) => { e.stopPropagation();
                         copyText($('#' + b.dataset.copy).textContent, b); };
  });
  const tp = $('#tprompt');
  if (tp) tp.oninput = () => { S.train.prompt = tp.value; };
  for (const [id, key] of [['tbase', 'a'], ['ttuned', 'b']]) {
    const el = $('#' + id);
    if (el) el.oninput = () => {
      S.train[key] = el.value;
      const t2 = $(key === 'a' ? '#ab-a' : '#ab-b');
      if (t2) t2.textContent = el.value;
      persist();
    };
  }
  kitStats();
}

function grabTrainInputs() {
  const tp = $('#tprompt'); if (tp) S.train.prompt = tp.value;
  const a = $('#tbase'); if (a) S.train.a = a.value;
  const b = $('#ttuned'); if (b) S.train.b = b.value;
}

function kitStats() {
  const el = $('#kit-stats');
  if (!el) return;
  //  Counted when the index was built, for the same reason the index ships as
  //  a script: this page cannot read a file sitting beside it at runtime.
  const k = (S.R.m && S.R.m.kit) || { train: 0, valid: 0, words: 0 };
  el.innerHTML = `<dl class="kv" style="max-width:440px">
      <dt>training passages</dt><dd>${nfmt(k.train)}</dd>
      <dt>held back</dt><dd>${nfmt(k.valid)} for validation loss</dd>
      <dt>words</dt><dd>about ${nfmt(Math.round(k.words / 1000) * 1000)}</dd>
      <dt>from</dt><dd>Fractured Mirror Theory, Exulansis, The Next Ten Years</dd>
      <dt>on disk</dt><dd><code>apps/fracture-core/kit/data/</code></dd>
    </dl>
    <p style="font-size:12.5px;color:var(--faint);margin-top:12px;max-width:70ch">
      The manuscript text is P. R. Erickson's work. It sits inside this app
      only so the trainer can reach it on disk. The app never sends it
      anywhere, and neither should anything else: a cloud model keeps what it
      is given.</p>`;
}

// ─── 9 · ENGINE ─────────────────────────────────────────────────────────────

function buildModel() {
  const eps = S.endpoints;
  const cur = S.engine;
  const curProv = cur && cur.provider;
  const cm = curProv ? (S.hostedModels[curProv] || []) : [];
  const cloudModels = curProv && cm.length ? `
    <label class="f"><u>model at ${esc(providerName(curProv))}</u>
      <select id="c-model">${cm.map(m => `
        <option value="${esc(m.id)}" ${m.id === cur.model ? 'selected' : ''}>${esc(m.id)}</option>`).join('')}
      </select></label>` : '';
  const modelsFor = (e) => e.models || [];

  const epHtml = eps.length ? eps.map((e, i) => {
    const on = cur && cur.url === e.url && cur.api === e.api;
    return `<div class="ep ${on ? 'pick' : ''}" data-ep="${i}">
      <div><div class="nm">${esc(e.name)}</div><div class="u">${esc(e.url)} · ${e.api}</div></div>
      <div class="ct">${modelsFor(e).length} model${modelsFor(e).length === 1 ? '' : 's'}</div>
    </div>`;
  }).join('') : '';

  const models = (() => {
    if (!cur) return '';
    const e = eps.find(x => x.url === cur.url && x.api === cur.api);
    if (!e) return '';
    return `<label class="f"><u>model</u>
      <select id="m-model">${e.models.map(m => `
        <option value="${esc(m.id)}" ${m.id === cur.model ? 'selected' : ''}>${esc(m.id)}${
          m.params ? ' · ' + esc(m.params) : ''}${m.quant ? ' · ' + esc(m.quant) : ''}</option>`).join('')}
      </select><em>A model whose name mentions the manuscripts is chosen first.
      Embedding models are skipped: they cannot write.</em></label>`;
  })();

  $('#model-inner').innerHTML = `
    <div class="hdr" style="padding-left:0">What is answering</div>
    <p style="font-size:14px;line-height:1.8;color:var(--dim);max-width:70ch;margin:0 0 16px">
      FractureCore does not contain a language model. The retrieval model
      inside it knows where everything in the three books is and cannot write a
      sentence; every word of generated prose comes from a model running on
      this machine, outside this app. This is where you say which.
    </p>

    ${LLM.viaShell
      ? `<div class="warn ok"><b>Going through the shell.</b> Requests are made
          by Present Palm itself rather than by this window, so no browser
          security rule applies and nothing needs configuring. Loopback
          only — the service refuses any address that is not this machine.</div>`
      : `<div class="warn"><b>Going direct, which usually fails.</b> This window
          is a <code>file://</code> page, and local model servers refuse
          requests from one. Run <code>python3 _patches/patch_shell.py</code> in
          the Fracture City folder and restart Present Palm, and the shell will
          make the requests instead. Failing that, start Ollama with
          <code>OLLAMA_ORIGINS='*'</code> set.</div>`}

    <div class="rule" style="margin-left:0;margin-right:0"></div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <div class="hdr" style="padding:0">Found on this machine</div>
      <button class="btn sm" id="m-look" style="margin-left:auto">Look again</button>
    </div>
    ${epHtml || `<div class="empty" style="text-align:left;padding:18px 0">
      <b>Nothing is running</b>
      Start a local model server and press Look again. Any of these will do:<br><br>
      <code>ollama serve</code> then <code>ollama pull qwen3:8b</code><br>
      LM Studio, with its server switched on<br>
      <code>mlx_lm.server --model &lt;model&gt; --port 8080</code><br>
      <code>llama-server -m model.gguf --port 8080</code><br><br>
      Until one is, Ask still answers — with passages from the books, and it
      says so rather than writing prose it cannot write.</div>`}

    ${models}

    <label class="f"><u>somewhere else on this machine</u>
      <div style="display:flex;gap:8px">
        <input type="text" id="m-custom" placeholder="http://127.0.0.1:8080"
          value="${esc((cur && !eps.some(e => e.url === cur.url) && cur.url) || '')}">
        <button class="btn" id="m-add">Probe</button>
      </div>
      <em>Only addresses on this machine are accepted. Both wire formats are
      tried, so the port is all you need to know.</em></label>

    <div class="rule" style="margin-left:0;margin-right:0"></div>
    <div class="hdr" style="padding-left:0">A model from outside</div>
    <p style="font-size:13.5px;line-height:1.8;color:var(--dim);max-width:70ch;margin:0 0 6px">
      A local model that fits on a laptop is a small model. If you want this to
      be as capable as it can be, point it at a frontier one. Paste a key and
      the whole catalogue becomes available.
    </p>
    <div class="warn"><b>This sends your questions and the retrieved passages
      out of the building.</b> The manuscripts are unpublished work, and a
      hosted provider keeps what it is given. Local is the private option and
      it stays one keystroke away on this same screen.</div>
    <div id="cloud-list"></div>
    ${cloudModels}

    <div class="rule" style="margin-left:0;margin-right:0"></div>
    <div class="hdr" style="padding-left:0">How it writes</div>
    <div class="grid2">
      <label class="f"><u>temperature · <span id="lv-t">${S.gen.temperature}</span></u>
        <input type="range" id="g-t" min="0" max="1.5" step="0.05" value="${S.gen.temperature}" style="width:100%">
        <em>Low is careful and repetitive. High is inventive and loses the
        thread. Around 0.8 is where these manuscripts sit.</em></label>
      <label class="f"><u>top-p · <span id="lv-p">${S.gen.topP}</span></u>
        <input type="range" id="g-p" min="0.1" max="1" step="0.05" value="${S.gen.topP}" style="width:100%">
        <em>How much of the probability mass is in play at each word.</em></label>
      <label class="f"><u>longest answer · <span id="lv-m">${S.gen.maxTokens}</span></u>
        <input type="range" id="g-m" min="400" max="16000" step="200" value="${S.gen.maxTokens}" style="width:100%">
        <em>In tokens, which are roughly three quarters of a word each.</em></label>
      <label class="f"><u>passages given · <span id="lv-k">${S.gen.passages}</span></u>
        <input type="range" id="g-k" min="0" max="12" step="1" value="${S.gen.passages}" style="width:100%">
        <em>How many retrieved windows go in with the question. More is more
        grounded and slower, and past about eight it starts crowding out the
        question itself.</em></label>
    </div>

    <div class="rule" style="margin-left:0;margin-right:0"></div>
    <div class="hdr" style="padding-left:0">Everything that was probed</div>
    <table class="mem">
      <tr><th>address</th><th>format</th><th></th></tr>
      ${S.probed.map(p => `<tr><td><code>${esc(p.url)}</code></td><td>${esc(p.api)}</td>
        <td style="color:${p.ok ? 'var(--green)' : 'var(--faint)'}">${
          p.ok ? 'answered' : esc(({ REFUSED: 'nothing listening', TIMEOUT: 'no reply',
            NOT_JSON: 'not a model server', BLOCKED: 'blocked by the browser',
            NOT_OLLAMA: 'wrong format', NOT_OPENAI: 'wrong format' })[p.error] || p.error || 'no')}</td></tr>`).join('')}
    </table>

    <div class="rule" style="margin-left:0;margin-right:0"></div>
    <div class="hdr" style="padding-left:0">The retrieval model</div>
    <dl class="kv" style="max-width:520px">
      <dt>built</dt><dd>${esc((S.R.m.builtAt || '').replace('T', ' ').replace('Z', ' UTC'))}</dd>
      <dt>format</dt><dd>${esc(S.R.m.format)}</dd>
      <dt>windows</dt><dd>${nfmt(S.R.windows.length)} of ${S.R.m.chunk.size} passages, stride ${S.R.m.chunk.stride}</dd>
      <dt>blend</dt><dd>${S.R.aShort} short · ${S.R.aLong} long</dd>
    </dl>
    <div style="margin-top:12px">
      <button class="btn sm" id="m-eval">how it was measured</button>
      <button class="btn sm" id="m-wipe">forget this conversation</button>
    </div>`;

  renderCloud();
  $('#m-look').onclick = () => discover($('#m-custom') && $('#m-custom').value.trim());
  $('#m-add').onclick = () => {
    const v = $('#m-custom').value.trim();
    if (v) discover(v);
  };
  $$('#model-inner .ep').forEach(el => {
    el.onclick = () => {
      const e = eps[+el.dataset.ep];
      S.engine = { url: e.url, api: e.api, name: e.name,
                   model: pickDefaultModel(e.models) };
      setDot('live', shortModel(S.engine.model));
      persist(); buildModel();
    };
  });
  const sel = $('#m-model');
  if (sel) sel.onchange = () => {
    S.engine.model = sel.value;
    setDot('live', shortModel(sel.value));
    persist();
  };
  for (const [id, key, lab, int] of [['g-t', 'temperature', 'lv-t', false],
                                     ['g-p', 'topP', 'lv-p', false],
                                     ['g-m', 'maxTokens', 'lv-m', true],
                                     ['g-k', 'passages', 'lv-k', true]]) {
    const el = $('#' + id);
    if (!el) continue;
    el.oninput = () => {
      S.gen[key] = int ? parseInt(el.value, 10) : parseFloat(el.value);
      $('#' + lab).textContent = S.gen[key];
      persist();
    };
  }
  $('#m-eval').onclick = () => sheet('How the retrieval model was measured',
                                     evalHtml(S.R.stats().eval || {}));
  $('#m-wipe').onclick = () => {
    S.thread.length = 0; renderAll(); persist();
    status(null, 'this conversation cleared');
  };
}

//  Hosted providers: the catalogue, the key box, and what happens when a key
//  turns out to work. Keys live in this app's own store on disk, in plain
//  text, which is the same footing as every other key Present Palm holds. It
//  is said out loud on screen rather than left to be assumed either way.

function providerName(k) {
  const p = S.hosted.find(x => x.key === k);
  return p ? p.name : k;
}

async function loadProviders() {
  if (!LLM.providers) return;
  try { S.hosted = await LLM.providers() || []; } catch (e) { S.hosted = []; }
}

function renderCloud() {
  const el = $('#cloud-list');
  if (!el) return;
  if (!LLM.providers) {
    el.innerHTML = `<div class="warn"><b>Not available on this path.</b>
      Hosted models go through the shell, which has not been patched yet.
      Run <code>python3 _patches/patch_shell.py</code> in the Fracture City
      folder and restart Present Palm.</div>`;
    return;
  }
  if (!S.hosted.length) {
    el.innerHTML = '<div style="color:var(--faint);font-size:12.5px">loading\u2026</div>';
    loadProviders().then(renderCloud);
    return;
  }
  const cur = S.engine;
  el.innerHTML = S.hosted.map(p => {
    const has = !!(S.keys[p.key] || '').trim();
    const on = cur && cur.provider === p.key;
    const n = (S.hostedModels[p.key] || []).length;
    return `<div class="ep ${on ? 'pick' : ''}" data-prov="${esc(p.key)}">
      <div><div class="nm">${esc(p.name)}</div>
        <div class="u">${esc(p.hint)}</div></div>
      <div class="ct">${has ? (n ? n + ' models' : 'key saved') : 'no key'}</div>
    </div>`;
  }).join('') + `
    <label class="f" style="margin-top:12px"><u>api key</u>
      <div style="display:flex;gap:8px">
        <select id="c-prov" style="max-width:190px">${S.hosted.map(p =>
          `<option value="${esc(p.key)}" ${cur && cur.provider === p.key ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <input type="text" id="c-key" placeholder="paste it here"
          value="${esc(S.keys[(cur && cur.provider) || (S.hosted[0] && S.hosted[0].key)] || '')}">
        <button class="btn" id="c-save">Use it</button>
      </div>
      <em>Stored on this machine, in this app's own data folder, in plain text.
      Clear the box and press Use it to remove one.</em></label>
    <div id="c-status" style="font:10px/1.7 var(--mono);letter-spacing:1.2px;
      color:var(--faint);min-height:18px"></div>`;

  $$('#cloud-list .ep').forEach(card => {
    card.onclick = async () => {
      const k = card.dataset.prov;
      const sel = $('#c-prov'); if (sel) sel.value = k;
      const box = $('#c-key'); if (box) box.value = S.keys[k] || '';
      if (S.keys[k]) await useProvider(k, S.keys[k]);
      else { $('#c-status').textContent = 'paste a key for ' + providerName(k); }
    };
  });
  const sel = $('#c-prov');
  if (sel) sel.onchange = () => { $('#c-key').value = S.keys[sel.value] || ''; };
  const save = $('#c-save');
  if (save) save.onclick = () => useProvider($('#c-prov').value, $('#c-key').value.trim());
  const cs = $('#c-model');
  if (cs) cs.onchange = () => {
    S.engine.model = cs.value;
    setDot('live', shortModel(cs.value));
    persist();
  };
}

async function useProvider(key, apiKey) {
  const st = $('#c-status');
  if (!apiKey) {
    delete S.keys[key];
    delete S.hostedModels[key];
    if (S.engine && S.engine.provider === key) { S.engine = null; discover(); }
    persist(); buildModel();
    return;
  }
  S.keys[key] = apiKey;
  persist();
  if (st) st.textContent = 'asking ' + providerName(key) + ' what it has\u2026';
  setDot('busy', 'checking key');
  let r;
  try { r = await LLM.hostedModels(key, apiKey); }
  catch (e) { r = { ok: false, message: e.message }; }

  if (!r || !r.ok) {
    //  A provider that will not list its models can still answer, so this is
    //  not fatal \u2014 it just means choosing the model by name.
    S.hostedModels[key] = [];
    if (st) st.textContent = (r && r.message) || 'that key did not work';
    setDot('bad', 'key refused');
    buildModel();
    return;
  }
  S.hostedModels[key] = r.models;
  const pick = pickHosted(key, r.models);
  S.engine = { provider: key, name: providerName(key), model: pick };
  setDot('live', shortModel(pick));
  if (st) st.textContent = r.models.length + ' models \u00b7 using ' + pick;
  persist();
  buildModel();
}

//  Prefer the strongest general model a provider offers, by the naming
//  conventions they all happen to share. Dated snapshots and mini/instant
//  variants lose to their full-size siblings.
function pickHosted(prov, models) {
  const ids = models.map(m => m.id);
  const score = (id) => {
    const s = id.toLowerCase();
    let v = 0;
    if (/opus/.test(s)) v += 100;
    if (/sonnet/.test(s)) v += 90;
    if (/\bgpt-5|\bo3|\bo4/.test(s)) v += 95;
    if (/gpt-4\.?1|gpt-4o/.test(s)) v += 80;
    if (/deepseek-(chat|reasoner)/.test(s)) v += 80;
    if (/large|70b|72b|405b|123b/.test(s)) v += 60;
    if (/mini|small|haiku|instant|lite|8b|7b|3b|1b/.test(s)) v -= 30;
    if (/preview|alpha|beta|exp/.test(s)) v -= 12;
    if (/\d{8}|\d{4}-\d{2}-\d{2}/.test(s)) v -= 6;   // dated snapshot
    return v;
  };
  const best = ids.slice().sort((a, b) => score(b) - score(a))[0];
  return best || ids[0];
}

// ─── 10 · Views ─────────────────────────────────────────────────────────────

function show(v) {
  S.view = v;
  $$('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
  if (v === 'model') buildModel();
  if (v === 'train') buildTrain();
  if (v === 'ask') { weakNote(); setTimeout(() => $('#q').focus(), 30); }
  if (v === 'read') setTimeout(() => $('#s').focus(), 30);
}
$$('nav button').forEach(b => { b.onclick = () => show(b.dataset.v); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if ($('#guide').classList.contains('on')) { $('#guide-x').click(); return; }
    if ($('#sheet').classList.contains('on')) { $('#sheet').classList.remove('on'); return; }
    if ($('#convolist').classList.contains('on')) {
      $('#convolist').classList.remove('on'); return;
    }
  }
  //  A new conversation is the one thing you reach for often enough to want a
  //  key for.
  if ((e.metaKey || e.ctrlKey) && e.key === 'n' && S.view === 'ask') {
    e.preventDefault(); newConvo(); return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '4') {
    e.preventDefault();
    show(['ask', 'read', 'train', 'model'][+e.key - 1]);
  }
});

//  A window closing mid-generation should not leave the model producing
//  tokens into nothing.
window.addEventListener('beforeunload', () => { if (S.stream) S.stream.stop(); });

boot();

//  For the test harness, and for anyone who wants to drive the retrieval
//  model from the console.
window.FC = { S, show, discover, ask, newConvo, openConvo, deleteConvo, weakNote,
              search: (q, o) => S.R.search(q, o) };

})();
