(function (global) {
  /**
   * Minimal evented store using CustomEvent for page-level decoupling.
   * Works in browser and Node test environments.
   * @param {Record<string, unknown>} initialState
   */
  function createStore(initialState = {}) {
    let state = { ...initialState };
    const listeners = new Set();

    function getState() {
      return { ...state };
    }

    function emit(detail) {
      if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
        global.dispatchEvent(new global.CustomEvent('tf:store:update', { detail }));
      }
      listeners.forEach((listener) => listener(detail));
    }

    function setState(partial, reason = 'update') {
      state = { ...state, ...partial };
      const detail = { reason, state: getState() };
      emit(detail);
      return detail.state;
    }

    function subscribe(listener) {
      listeners.add(listener);

      const domHandler = (event) => listener(event.detail);
      if (typeof global.addEventListener === 'function') {
        global.addEventListener('tf:store:update', domHandler);
      }

      return () => {
        listeners.delete(listener);
        if (typeof global.removeEventListener === 'function') {
          global.removeEventListener('tf:store:update', domHandler);
        }
      };
    }

    return { getState, setState, subscribe };
  }

  const api = { createStore };
  global.tfStore = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
