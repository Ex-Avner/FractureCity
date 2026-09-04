/* ===========================================================================
   fracture-client.js
   Drop-in shim. Apps can include this with:
     <script src="../../shared/fracture-client.js"></script>

   If running inside the shell, window.fracture is already set by the preload
   and this file is a no-op. If opened directly in a browser, this file
   provides a graceful-degradation fallback backed by localStorage —
   so the same HTML file works in both contexts.
   =========================================================================== */
(function() {
  if (typeof window === 'undefined') return;
  if (window.fracture && window.fracture.shell) return;  // shell already injected

  // Derive a slug from the page path so localStorage keys are namespaced.
  const slug = (() => {
    try {
      const parts = window.location.pathname.split('/').filter(Boolean);
      const i = parts.lastIndexOf('apps');
      if (i >= 0 && parts[i+1]) return parts[i+1];
    } catch (e) {}
    return 'standalone';
  })();

  const prefix = `fracture::${slug}::`;
  const busListeners = new Map();
  const payloadListeners = [];

  window.fracture = {
    shell: false,
    appSlug: slug,
    received: null,

    onPayload(cb) { payloadListeners.push(cb); },

    save(key, value) {
      try { localStorage.setItem(prefix + key, JSON.stringify(value)); return Promise.resolve(true); }
      catch (e) { return Promise.resolve(false); }
    },
    read(key) {
      try {
        const raw = localStorage.getItem(prefix + key);
        return Promise.resolve(raw == null ? null : JSON.parse(raw));
      } catch (e) { return Promise.resolve(null); }
    },
    list() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length));
      }
      return Promise.resolve(out);
    },
    delete(key) {
      localStorage.removeItem(prefix + key);
      return Promise.resolve(true);
    },

    listApps() { return Promise.resolve([]); },
    openApp(targetSlug, payload) {
      console.warn('[fracture-client] openApp is a no-op outside the shell.', targetSlug, payload);
      return Promise.resolve({ ok: false, error: 'standalone-mode' });
    },

    emit(type, payload) {
      const set = busListeners.get(type);
      if (set) for (const fn of set) try { fn(payload, slug); } catch (e) {}
      return Promise.resolve(true);
    },
    subscribe(type, fn) {
      if (!busListeners.has(type)) busListeners.set(type, new Set());
      busListeners.get(type).add(fn);
      return () => busListeners.get(type)?.delete(fn);
    },
  };
})();
