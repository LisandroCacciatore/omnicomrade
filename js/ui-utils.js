/**
 * TechFitness UI Utils
 * Centralized UI helpers for modals, notifications, and interactivity.
 */

(function (global) {
  /**
   * Muestra un toast de notificación.
   */
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
    setTimeout(() => {
      el.className = '';
    }, 3200);
  }

  /**
   * Escapa HTML para prevenir XSS.
   */
  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(
      /[&<>"']/g,
      (m) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        })[m]
    );
  }

  /**
   * Debounce genérico.
   */
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

  /**
   * Feedback visual en botones (loading state).
   */
  function setBtnLoading(btnId, isLoading, loadingText = 'Procesando...') {
    const btn = typeof btnId === 'string' ? document.getElementById(btnId) : btnId;
    if (!btn) return;

    // BUSCA SPAN PARA EL TEXTO (compatible con múltiples templates)
    const textEl =
      btn.querySelector('[id$="-text"]') || btn.querySelector('span:not(.animate-spin)') || btn;

    const spinner = btn.querySelector('[id$="-spinner"]') || btn.querySelector('.animate-spin');

    if (isLoading) {
      btn.disabled = true;
      if (!btn._originalText) btn._originalText = textEl.textContent;
      textEl.textContent = loadingText;
      if (spinner) spinner.classList.remove('hidden');
      if (btn.classList.contains('button-primary')) btn.style.opacity = '0.7';
    } else {
      btn.disabled = false;
      if (btn._originalText) textEl.textContent = btn._originalText;
      if (spinner) spinner.classList.add('hidden');
      btn.style.opacity = '';
    }
  }

  /* ─── MODALS ────────────────────────────────────────────── */

  /**
   * Muestra un modal con animación.
   */
  function showModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
      modal.classList.add('modal-active');
      modal.classList.remove('modal-hidden');
      modal._opener = document.activeElement;

      // Auto-focus al primer elemento
      const first = modal.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (first) setTimeout(() => first.focus(), 150);
    });
  }

  /**
   * Oculta un modal con animación.
   */
  function hideModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('modal-hidden');
    modal.classList.remove('modal-active');
    setTimeout(() => {
      modal.classList.add('hidden');
      if (modal._opener && typeof modal._opener.focus === 'function') {
        modal._opener.focus();
        modal._opener = null;
      }
    }, 200);
  }

  /**
   * Validación en tiempo real para inputs.
   */
  function setupValidation(inputEl, errorEl, validator) {
    if (!inputEl || !errorEl) return;
    const validate = () => {
      const errorMsg = validator(inputEl.value);
      if (errorMsg) {
        inputEl.classList.add('input-error');
        errorEl.textContent = errorMsg;
        errorEl.classList.remove('hidden');
        return false;
      } else {
        inputEl.classList.remove('input-error');
        errorEl.classList.add('hidden');
        return true;
      }
    };
    inputEl.addEventListener('blur', validate);
    inputEl.addEventListener('input', () => {
      if (inputEl.classList.contains('input-error')) validate();
    });
    return validate;
  }

  /* ─── COMMAND PALETTE & SHORTCUTS ─────────────────────── */

  function initGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      // ESC
      if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal-active');
        if (openModal) hideModal(openModal.id);
        const palette = document.getElementById('tf-command-palette');
        if (palette && !palette.classList.contains('hidden')) palette.classList.add('hidden');
      }
      // Ctrl+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        showCommandPalette();
      }
    });
  }

  function showCommandPalette() {
    let cp = document.getElementById('tf-command-palette');
    if (!cp) {
      cp = document.createElement('div');
      cp.id = 'tf-command-palette';
      cp.className = 'hidden fixed inset-0 z-[100] flex items-start justify-center p-4 pt-20';
      cp.innerHTML = `
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="this.parentElement.classList.add('hidden')"></div>
        <div class="relative bg-surface-dark border border-border-dark rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
          <div class="p-4 border-b border-border-dark flex items-center gap-3">
            <span class="material-symbols-rounded text-slate-500">search</span>
            <input type="text" id="cp-search-input" placeholder="Buscar acción..." class="bg-transparent border-none focus:ring-0 text-white w-full" autocomplete="off" />
          </div>
          <div id="cp-results" class="max-h-[400px] overflow-y-auto p-2 flex flex-col gap-1"></div>
        </div>`;
      document.body.appendChild(cp);
      document
        .getElementById('cp-search-input')
        .addEventListener('input', (e) => filterPalette(e.target.value));
    }
    cp.classList.remove('hidden');
    const input = document.getElementById('cp-search-input');
    input.value = '';
    filterPalette('');
    setTimeout(() => input.focus(), 50);
  }

  function filterPalette(query) {
    const results = document.getElementById('cp-results');
    const items = [
      {
        label: 'Ir a Dashboard',
        icon: 'dashboard',
        action: () => (window.location.href = 'admin-dashboard.html')
      },
      {
        label: 'Ver Atletas',
        icon: 'people',
        action: () => (window.location.href = 'student-list.html')
      },
      { label: 'Cerrar Sesión', icon: 'logout', action: () => window.tfUtils?.logout() }
    ];
    const filtered = items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()));
    results.innerHTML = filtered
      .map(
        (i) => `
      <div class="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors cp-item">
        <span class="material-symbols-rounded text-slate-400">${i.icon}</span>
        <span class="text-sm font-bold text-slate-300">${i.label}</span>
      </div>`
      )
      .join('');

    results.querySelectorAll('.cp-item').forEach((el, idx) => {
      el.onclick = () => {
        document.getElementById('tf-command-palette').classList.add('hidden');
        filtered[idx].action();
      };
    });
  }

  /* ─── Public API ────────────────────────────────────────── */

  const api = {
    toast,
    escHtml,
    debounce,
    setBtnLoading,
    showModal,
    hideModal,
    setupValidation,
    initGlobalShortcuts,
    showCommandPalette
  };

  global.tfUiUtils = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
