#!/usr/bin/env python3
"""
patch_shell.py — wires the language-model service into the Present Palm shell.

Run from the repository root:

    python3 _patches/patch_shell.py

Idempotent: running it twice reports "already wired" and changes nothing. A
timestamped .bak is written beside every file it edits, so an undo is a copy
command rather than a git operation.

It touches exactly two files and adds one:

    shell/services/llm.js   (new)  the service itself
    shell/main.js           three handlers, registered beside providers:read
    shell/preload.js        window.fracture.llm, the API apps actually call

Nothing else in the shell is aware of it. An app that never calls llm is
unaffected, and the shell starts identically with or without a model server
running, because discovery happens on demand and never at boot.
"""

import os
import shutil
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.path.join(ROOT, 'shell', 'main.js')
PRELOAD = os.path.join(ROOT, 'shell', 'preload.js')
SERVICE = os.path.join(ROOT, 'shell', 'services', 'llm.js')

STAMP = time.strftime('%Y%m%d-%H%M%S')


def backup(p):
    shutil.copy2(p, p + '.' + STAMP + '.bak')


def must(hay, needle, what):
    if needle not in hay:
        sys.exit('! could not find %s in the shell — it has moved on since this '
                 'patch was written. Wire it by hand; the three pieces are in '
                 'the docstring at the top of this file.' % what)


MAIN_BLOCK = r'''
// ─── Language models ─────────────────────────────────────────────────────────
//  The shell owns the connection to whatever model server is running on this
//  machine, for the reason set out at the top of services/llm.js: apps load
//  from file://, and a file:// origin is refused by every local model server
//  there is. The main process has no origin, so it makes the call and relays
//  the bytes. Loopback only — llm.js checks the hostname before it opens a
//  socket, so this cannot become a general outbound proxy for apps.
const { LLM } = require('./services/llm');
const llm = new LLM();

ipcMain.handle('llm:discover', (event, extra) => llm.discover(extra));
ipcMain.handle('llm:models', (event, baseUrl, api) =>
  llm.models(baseUrl, api).catch(e => ({ ok: false, error: e.code || 'ERR',
                                         message: e.message })));

//  Hosted providers. The allow-list of hosts lives in llm.js; nothing else
//  can be dialled, so this cannot become a general outbound proxy for apps.
ipcMain.handle('llm:providers', () => llm.providers());
ipcMain.handle('llm:hostedModels', (event, provider, apiKey) =>
  llm.hostedModels(provider, apiKey));

//  Streaming. The renderer gets one 'llm:event' per token on its own
//  webContents, tagged with the stream id it was handed when it started.
ipcMain.handle('llm:chat', (event, opts) => {
  const wc = event.sender;
  return llm.start(opts, (msg) => {
    if (!wc.isDestroyed()) wc.send('llm:event', msg);
  });
});
ipcMain.handle('llm:stop', (event, id) => llm.stop(id));

//  A window that closes mid-generation must not leave a socket pulling tokens
//  out of the model for the rest of the session.
app.on('browser-window-created', (e, win) => {
  win.on('closed', () => { try { llm.stopAll(); } catch (err) {} });
});

'''

PRELOAD_BLOCK = r'''
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
    providers: () => ipcRenderer.invoke('llm:providers'),
    hostedModels: (provider, apiKey) =>
      ipcRenderer.invoke('llm:hostedModels', provider, apiKey),
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
'''


def patch_main():
    src = open(MAIN, encoding='utf-8').read()
    if "ipcMain.handle('llm:discover'" in src:
        print('  main.js     already wired')
        return False
    anchor = "ipcMain.handle('providers:read'"
    must(src, anchor, 'the providers:read handler')
    line_start = src.rindex('\n', 0, src.index(anchor)) + 1
    src = src[:line_start] + MAIN_BLOCK.lstrip('\n') + '\n' + src[line_start:]
    backup(MAIN)
    open(MAIN, 'w', encoding='utf-8').write(src)
    print('  main.js     three handlers added')
    return True


def patch_preload():
    src = open(PRELOAD, encoding='utf-8').read()
    if 'llm:' in src and 'llm:discover' in src:
        print('  preload.js  already wired')
        return False
    anchor = '  // ── Cross-app data read ──'
    if anchor not in src:
        anchor = '  listFrom:'
    must(src, anchor, 'the cross-app data read block')
    src = src.replace(anchor, PRELOAD_BLOCK.lstrip('\n') + '\n' + anchor, 1)
    backup(PRELOAD)
    open(PRELOAD, 'w', encoding='utf-8').write(src)
    print('  preload.js  window.fracture.llm exposed')
    return True


def check_service():
    if not os.path.exists(SERVICE):
        sys.exit('! shell/services/llm.js is missing. Copy it into place first; '
                 'this patch only wires it up.')
    print('  llm.js      present (%.1f KB)' % (os.path.getsize(SERVICE) / 1024))


if __name__ == '__main__':
    for p in (MAIN, PRELOAD):
        if not os.path.exists(p):
            sys.exit('! not a Present Palm checkout: missing %s' % p)
    print('wiring the model service into the shell')
    check_service()
    a = patch_main()
    b = patch_preload()
    if a or b:
        print('\ndone. Quit Present Palm and start it again for this to take effect.')
    else:
        print('\nnothing to do.')
