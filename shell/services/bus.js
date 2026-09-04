// =============================================================================
//  Bus — pub/sub for inter-app messaging
//  Subscribers register interest by output `type`; emitters publish.
//  Used in Phase 2+ for data-flow between apps; the scaffolding is here now.
// =============================================================================

class Bus {
  constructor() {
    this.subscribers = new Map();  // type → Set<WebContents>
  }

  subscribe(type, webContents) {
    if (!this.subscribers.has(type)) this.subscribers.set(type, new Set());
    const set = this.subscribers.get(type);
    set.add(webContents);
    webContents.once('destroyed', () => set.delete(webContents));
  }

  emit(fromSlug, type, payload) {
    const set = this.subscribers.get(type);
    if (!set) return 0;
    let delivered = 0;
    for (const wc of set) {
      if (wc.isDestroyed()) continue;
      wc.send('bus:event', { from: fromSlug, type, payload });
      delivered++;
    }
    return delivered;
  }
}

module.exports = Bus;
