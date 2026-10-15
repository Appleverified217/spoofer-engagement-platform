class ProxyManager {
  constructor(proxies = []) {
    this.proxies = proxies;
    this.currentIndex = 0;
    this.failedProxies = new Set();
  }

  addProxy(proxy) {
    if (!this.proxies.includes(proxy)) {
      this.proxies.push(proxy);
    }
  }

  getNextProxy() {
    if (this.proxies.length === 0) return null;

    // Filter out failed proxies if others are available
    const activeProxies = this.proxies.filter(p => !this.failedProxies.has(p));
    const pool = activeProxies.length > 0 ? activeProxies : this.proxies;

    const proxy = pool[this.currentIndex % pool.length];
    this.currentIndex++;
    return proxy;
  }

  markFailed(proxy) {
    this.failedProxies.add(proxy);
    console.warn(`Proxy marked as failed: ${proxy}`);
  }

  reset() {
    this.failedProxies.clear();
    this.currentIndex = 0;
  }
}

// Default instance with example free/test proxy slots or empty
const defaultProxyManager = new ProxyManager(
  process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : []
);

module.exports = { ProxyManager, defaultProxyManager };
