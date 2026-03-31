(function (global) {
  const queue = [];

  /**
   * Track product analytics events with a minimal transport-agnostic queue.
   * @param {string} name
   * @param {Record<string, unknown>} payload
   */
  function track(name, payload = {}) {
    const event = {
      name,
      payload,
      timestamp: new Date().toISOString()
    };
    queue.push(event);
    return event;
  }

  function flush() {
    const copy = [...queue];
    queue.length = 0;
    return copy;
  }

  const api = { track, flush };
  global.tfInstrumentation = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
