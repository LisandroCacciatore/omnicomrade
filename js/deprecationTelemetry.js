// Deprecation Telemetry - Track usage of legacy aliases in tfUtils
// Used to plan gradual removal of legacy aliases

const DEPRECATION_CONFIG = {
  aliases: {
    showToast: { replacement: 'toast', deprecatedAt: null, removeAt: null },
    escapeHtml: { replacement: 'escHtml', deprecatedAt: null, removeAt: null },
    setButtonLoading: { replacement: 'setBtnLoading', deprecatedAt: null, removeAt: null },
    validateForm: { replacement: 'setupValidation', deprecatedAt: null, removeAt: null },
    openModalLegacy: { replacement: 'showModal', deprecatedAt: null, removeAt: null },
    closeModalLegacy: { replacement: 'hideModal', deprecatedAt: null, removeAt: null }
  },
  telemetryEndpoint: null
};

const deprecationTelemetry = {
  queue: [],
  initialized: false,

  init(options = {}) {
    if (this.initialized) return;
    this.initialized = true;

    if (options.endpoint) {
      DEPRECATION_CONFIG.telemetryEndpoint = options.endpoint;
    }

    this.flushInterval = setInterval(() => this.flush(), 60000);
  },

  track(aliasName, usageContext = {}) {
    const alias = DEPRECATION_CONFIG.aliases[aliasName];
    if (!alias) return;

    this.queue.push({
      alias: aliasName,
      replacement: alias.replacement,
      timestamp: new Date().toISOString(),
      page: typeof window !== 'undefined' ? window.location.pathname : 'server',
      context: usageContext
    });

    if (this.queue.length >= 10) {
      this.flush();
    }
  },

  async flush() {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    if (DEPRECATION_CONFIG.telemetryEndpoint) {
      try {
        await fetch(DEPRECATION_CONFIG.telemetryEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: batch })
        });
      } catch (e) {
        this.queue.push(...batch);
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const key = 'tf_deprecation_log';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const merged = [...existing, ...batch].slice(-500);
      localStorage.setItem(key, JSON.stringify(merged));
    }

    return batch;
  },

  getUsageStats() {
    const stats = {};
    this.queue.forEach((e) => {
      stats[e.alias] = (stats[e.alias] || 0) + 1;
    });
    return stats;
  },

  getAliases() {
    return Object.entries(DEPRECATION_CONFIG.aliases).map(([name, config]) => ({
      name,
      replacement: config.replacement,
      deprecated: config.deprecatedAt !== null,
      removeDate: config.removeAt
    }));
  },

  deprecate(aliasName, removeAt = null) {
    if (DEPRECATION_CONFIG.aliases[aliasName]) {
      DEPRECATION_CONFIG.aliases[aliasName].deprecatedAt = new Date().toISOString();
      DEPRECATION_CONFIG.aliases[aliasName].removeAt = removeAt;
    }
  },

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
};

if (typeof window !== 'undefined') {
  window.tfDeprecationTelemetry = deprecationTelemetry;
}

export { deprecationTelemetry, DEPRECATION_CONFIG };
export default deprecationTelemetry;
