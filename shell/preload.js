// =============================================================================
//  Preload for INSTALLED APPS (any app launched by the shell).
//  Exposes window.fracture — the API every app can use to:
//    · know it's running inside the shell
//    · save & read its own data
//    · talk to other apps (via openApp + bus)
// =============================================================================

const { contextBridge, ipcRenderer } = require('electron');

// Parse the slug & payload from additionalArguments
function parseArg(prefix) {
  const arg = process.argv.find(a => a.startsWith(prefix));
  if (!arg) return null;
  return arg.slice(prefix.length);
}

const slug    = parseArg('--fracture-slug=') || 'unknown';
const payloadRaw = parseArg('--fracture-payload=');
let payload = null;
if (payloadRaw) {
  try { payload = JSON.parse(decodeURIComponent(payloadRaw)); }
  catch (e) { payload = null; }
}

// Listen for late-delivered payloads (when an already-open app gets re-targeted)
let payloadListeners = [];
ipcRenderer.on('fracture:payload', (event, p) => {
  payload = p;
  for (const fn of payloadListeners) try { fn(p); } catch (e) {}
});

// Bus event listeners
let busListeners = new Map();  // type → Set<fn>
ipcRenderer.on('bus:event', (event, { from, type, payload }) => {
  const set = busListeners.get(type);
  if (!set) return;
  for (const fn of set) try { fn(payload, from); } catch (e) {}
});

contextBridge.exposeInMainWorld('fracture', {
  // Identity — of the APP
  shell:    true,
  appSlug:  slug,
  received: payload,
  onPayload: (cb) => { payloadListeners.push(cb); },

  // ── Identity — of the PERSON ──────────────────────────────────────────────
  //  The one record the shell owns rather than any app. Everything else on this
  //  object is namespaced to a slug; this is not. Apps read it instead of
  //  keeping their own idea of who the user is.
  //
  //    me()                  → person.v1 { id, username, displayName, bio, … }
  //    updateMe(patch)       → merged person.v1 (id/type/created are protected)
  //    claim(type, ref)      → record that "slug/key" belongs to this person
  //    release(type, ref)    → forget it
  //    resolve(ref)          → read "slug/key" LIVE — use instead of caching
  //    resolveAll(type)      → [{ ref, value }] for everything held of a type
  //
  //  resolve() is the one to reach for when you would otherwise write a copy
  //  into your own data directory. A copy is correct exactly until someone
  //  edits the original, and then it is wrong silently and forever.
  me:         ()           => ipcRenderer.invoke('person:read'),
  updateMe:   (patch)      => ipcRenderer.invoke('person:update', patch),
  claim:      (type, ref)  => ipcRenderer.invoke('person:claim', type, ref),
  release:    (type, ref)  => ipcRenderer.invoke('person:release', type, ref),
  resolve:    (ref)        => ipcRenderer.invoke('person:resolve', ref),
  resolveAll: (type)       => ipcRenderer.invoke('person:resolveAll', type),

  // Data — per-app scoped JSON storage
  save:   (key, value) => ipcRenderer.invoke('data:save', slug, key, value),
  read:   (key)        => ipcRenderer.invoke('data:read', slug, key),
  list:   ()           => ipcRenderer.invoke('data:list', slug),
  delete: (key)        => ipcRenderer.invoke('data:delete', slug, key),

  // Apps & inter-app launching
  info:     ()                       => ipcRenderer.invoke('shell:info'),
  listApps: ()                       => ipcRenderer.invoke('registry:list'),
  openApp:  (targetSlug, payload)    => ipcRenderer.invoke('app:open', targetSlug, payload),

  // Bus
  emit:      (type, payload) => ipcRenderer.invoke('bus:emit', slug, type, payload),
  subscribe: (type, fn) => {
    if (!busListeners.has(type)) {
      busListeners.set(type, new Set());
      ipcRenderer.send('bus:subscribe', type);
    }
    busListeners.get(type).add(fn);
    return () => busListeners.get(type)?.delete(fn);
  },

  // ── Centralized provider config ──
  // Read-only from inside apps. Stored once in data/_shell/providers.json
  // via the shell Settings panel. Apps call this instead of re-asking for
  // keys. Returns shape: { aihorde:{key,model}, pollinations:{token,model},
  // huggingface:{token,model}, openai:{key,model} }.
  getProviders: () => ipcRenderer.invoke('providers:read'),
  getProvider:  (name) => ipcRenderer.invoke('providers:read').then(p => (p||{})[name] || null),

  // ── The outside world ──
  //  Real AI and technology stories, pulled by the shell from sources that
  //  need no key, cached to disk, and handed over already normalised:
  //
  //    { type:'newswire.v1', items:[ {title,url,source,via,at,score} ],
  //      fetchedAt, sources, ageMs, stale, empty }
  //
  //  newswire() returns immediately from cache and never rejects — if there is
  //  no signal you get empty:true, which is a thing to render, not an error to
  //  handle. A headline in `items` is exactly what the outlet published; do not
  //  shorten or reword one on the way to the screen.
  newswire:        ()      => ipcRenderer.invoke('newswire:read'),
  refreshNewswire: (force) => ipcRenderer.invoke('newswire:refresh', force),

  // ── The boards ──
  //  What people are saying, rather than what was published. Same contract as
  //  the wire — cached, never rejects, empty is a thing to render — but shaped
  //  as boards of whole posts instead of a list of headlines:
  //
  //    { type:'feeds.v1', boards:[ { key,label,sub,accent,kind,
  //        items:[ {id,author,handle,title,body,url,at,replies,score,tags} ] } ],
  //      fetchedAt, sources, ageMs, stale, empty, total }
  //
  //  `body` is already plain text — the shell strips the markup, because a post
  //  that arrives as HTML and reaches a DOM is somebody else's code running in
  //  your app. It is also exactly what the person wrote: do not shorten or
  //  reword one on the way to the screen.
  //
  //  thread(boardKey, itemId) fetches the real conversation around a post, and
  //  answers { ok:false, error } for boards that do not carry one.
  feeds:        ()                 => ipcRenderer.invoke('feeds:read'),
  refreshFeeds: (force)            => ipcRenderer.invoke('feeds:refresh', force),
  thread:       (board, id)        => ipcRenderer.invoke('feeds:thread', board, id),

  //  Open a link in the user's real browser. main.js has had this handler
  //  since the beginning but nothing exposed it, so an app with an outbound
  //  link had no choice but to navigate its own window — which, for an app
  //  that is a game, means the game is gone.
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),

  // ── Language models ──
  //  Talks to whatever model server is running on this machine — Ollama, LM
  //  Studio, llama.cpp, mlx_lm.server, and anything else speaking either the
  //  Ollama or the OpenAI wire format. The shell makes the request, not the
  //  app, because an app's origin is file:// and every one of those servers
  //  refuses that.
  //
  //    llm.discover(extraUrl?)  → { endpoints:[{url,api,name,models:[…]}], probed }
  //    llm.models(url, api)     → { models:[…] }
  //    llm.chat(opts, onEvent)  → { ok, id, stop() }
  //
  //  chat streams. onEvent receives, in order:
  //      { type:'token', text }      … many
  //      { type:'done',  stats }     … once
  //      { type:'error', error, message }
  //  and the returned object's stop() halts generation at the model.
  llm: {
    discover: (extra) => ipcRenderer.invoke('llm:discover', extra || null),
    models:   (url, api) => ipcRenderer.invoke('llm:models', url, api),
    chat: async (opts, onEvent) => {
      const res = await ipcRenderer.invoke('llm:chat', opts);
      if (!res || !res.ok) {
        //  start() reports its own failure through the event channel, so the
        //  caller's handler still sees it and there is one error path, not two.
        return { ok: false, id: res && res.id, stop: () => {} };
      }
      const id = res.id;
      const handler = (event, msg) => {
        if (!msg || msg.id !== id) return;
        try { onEvent(msg); } catch (e) {}
        if (msg.type === 'done' || msg.type === 'error') {
          ipcRenderer.removeListener('llm:event', handler);
        }
      };
      ipcRenderer.on('llm:event', handler);
      return {
        ok: true, id,
        stop: () => {
          ipcRenderer.removeListener('llm:event', handler);
          return ipcRenderer.invoke('llm:stop', id);
        },
      };
    },
  },

  // ── Cross-app data read ──
  // Read another app's stored data. Single-user trust: Visitor can read the
  // latest tot.profile.v1 written by Coherence Assessment, etc.
  listFrom: (otherSlug)       => ipcRenderer.invoke('data:listFrom', otherSlug),
  readFrom: (otherSlug, key)  => ipcRenderer.invoke('data:readFrom', otherSlug, key),
});
