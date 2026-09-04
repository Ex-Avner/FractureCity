// =============================================================================
//  Preload for the LAUNCHER window (renderer/index.html).
//  Exposes registry + launch controls to the launcher UI.
// =============================================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shellAPI', {
  listApps:        ()                 => ipcRenderer.invoke('registry:list'),
  rescan:          ()                 => ipcRenderer.invoke('registry:rescan'),
  openApp:         (slug, payload)    => ipcRenderer.invoke('app:open', slug, payload),
  openExternal:    (url)              => ipcRenderer.invoke('app:openExternal', url),
  revealInFinder:  (slug)             => ipcRenderer.invoke('app:revealInFinder', slug),
  onRegistryUpdated: (cb) => ipcRenderer.on('registry:updated', cb),
  // Provider config — read & write the central store
  readProviders:   ()                 => ipcRenderer.invoke('providers:read'),
  writeProviders:  (providers)        => ipcRenderer.invoke('providers:write', providers),

  // person.v1 — the identity the shell owns. The launcher is where this is
  // edited, because the shell owns the record; apps only read it.
  me:              ()                 => ipcRenderer.invoke('person:read'),
  updateMe:        (patch)            => ipcRenderer.invoke('person:update', patch),
  resolveRef:      (ref)              => ipcRenderer.invoke('person:resolve', ref),
  releaseRef:      (type, ref)        => ipcRenderer.invoke('person:release', type, ref),
});
