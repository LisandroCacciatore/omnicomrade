(function (global) {
  function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    if (!el) return;

    const icon = document.getElementById('toast-icon');
    const text = document.getElementById('toast-msg');

    if (icon) {
      icon.textContent = type === 'success' ? 'check_circle' : 'error';
      icon.style.color = type === 'success' ? '#10B981' : '#EF4444';
    }
    if (text) text.textContent = msg;

    el.className = `show ${type}`;
    setTimeout(() => { el.className = ''; }, 3200);
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function setBtnLoading(btnId, isLoading, loadingText = 'Procesando...') {
    const btn = typeof btnId === 'string' ? document.getElementById(btnId) : btnId;
    if (!btn) return;

    const textEl = btn.querySelector('[id$="-text"]') || btn;
    const spinner = btn.querySelector('[id$="-spinner"]');

    if (isLoading) {
      btn.disabled = true;
      if (!btn._originalText) btn._originalText = textEl.textContent;
      textEl.textContent = loadingText;
      if (spinner) spinner.classList.remove('hidden');
    } else {
      btn.disabled = false;
      if (btn._originalText) textEl.textContent = btn._originalText;
      if (spinner) spinner.classList.add('hidden');
    }
  }

  const api = { toast, escHtml, debounce, setBtnLoading };
  global.tfUiUtils = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
