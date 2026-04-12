/**
 * TechFitness Utils (Legacy Adapter)
 * Archivo de compatibilidad que delega a los nuevos módulos:
 *   - training-engine.js → Lógica de programas
 *   - ui-utils.js        → Lógica de UI
 *   - db.js              → Acceso a datos
 */

window.tfUtils = {
  /* ════════════════════════════════════════════════════════
     UI HELPERS (Delegan a tfUiUtils con fallback)
  ═════════════════════════════════════════════════════════ */

  toast: (m, t) => window.tfUiUtils?.toast?.(m, t) || console.log(`[toast] ${m}`),
  escHtml: (s) => {
    if (window.tfUiUtils?.escHtml) return window.tfUiUtils.escHtml(s);
    if (!s) return '';
    return String(s).replace(
      /[&<>"']/g,
      (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]
    );
  },
  debounce: (f, w) =>
    window.tfUiUtils?.debounce?.(f, w) ||
    ((...args) => {
      clearTimeout(window._dbT);
      window._dbT = setTimeout(() => f(...args), w);
    }),
  setBtnLoading: (id, l, t) => window.tfUiUtils?.setBtnLoading?.(id, l, t),
  setLoading: (btn, l, t) => window.tfUiUtils?.setBtnLoading(btn, l, t), // Alias
  renderEmptyState: (containerId, config) => {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (window.tfUiUtils?.renderEmptyState) {
      window.tfUiUtils.renderEmptyState(containerId, config);
      return;
    }

    const {
      icon = 'inbox',
      title = 'Sin datos',
      description = '',
      actionLabel = '',
      onAction = null
    } = config || {};

    const actionHTML =
      actionLabel && onAction
        ? `<button id="es-action-${containerId}" class="mt-4 flex items-center gap-2 bg-primary hover:bg-blue-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"><span class="material-symbols-rounded text-[17px]">add</span>${window.tfUtils.escHtml(actionLabel)}</button>`
        : '';

    el.innerHTML = `<div class="flex flex-col items-center justify-center py-16 text-center px-6"><div class="w-14 h-14 rounded-2xl bg-[#161E26] border border-[#1E293B] flex items-center justify-center mb-4"><span class="material-symbols-rounded text-slate-600 text-[26px]" style="font-variation-settings:'FILL' 1">${icon}</span></div><p class="text-white font-bold text-sm mb-1">${window.tfUtils.escHtml(title)}</p><p class="text-xs text-slate-500 max-w-xs leading-relaxed">${window.tfUtils.escHtml(description)}</p>${actionHTML}</div>`;

    if (actionLabel && onAction) {
      document.getElementById(`es-action-${containerId}`)?.addEventListener('click', onAction);
    }
  },
  showModal: (id) => window.tfUiUtils?.showModal(id),
  hideModal: (id) => window.tfUiUtils?.hideModal(id),
  setupValidation: (i, e, v) => window.tfUiUtils?.setupValidation(i, e, v),
  initGlobalShortcuts: () => window.tfUiUtils?.initGlobalShortcuts(),
  showCommandPalette: () => window.tfUiUtils?.showCommandPalette(),

  /**
   * Logout centralizado.
   * Ahora limpia storage antes de cerrar sesión
   */
  logout: async () => {
    // Primero limpiar storage
    try {
      localStorage.removeItem('tf_role');
      localStorage.removeItem('gym_id');
      localStorage.removeItem('pendingWorkout');
      localStorage.removeItem('activeWorkout');
      sessionStorage.clear();
    } catch (e) {
      console.warn('⚠️ utils.logout(): Error al limpiar storage:', e.message);
    }

    // Invalidar caché de sesión para evitar sesiones fantasma
    if (window.tfSession?.invalidateCache) {
      window.tfSession.invalidateCache();
    }

    // Luego cerrar sesión en Supabase
    const db = window.supabaseClient;
    if (db) {
      await db.auth.signOut();
      window.location.href = 'login.html';
    }
  },

  /* ════════════════════════════════════════════════════════
     TRAINING ENGINE (Delegan a tfTrainingEngine)
  ═════════════════════════════════════════════════════════ */

  round: (v, s) => window.tfTrainingEngine?.round(v, s),
  pct: (b, p) => window.tfTrainingEngine?.pct(b, p),
  get PROGRAMS() {
    return window.tfTrainingEngine?.PROGRAMS || [];
  },

  /* ════════════════════════════════════════════════════════
     INIT
  ═════════════════════════════════════════════════════════ */

  init() {
    this.initGlobalShortcuts();
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

    // Accesibilidad de modales conocidos
    ['modal-nuevo-alumno', 'modal-nueva-membresia', 'modal-alumno', 'modal-eliminar'].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) {
          const backdrop = el.querySelector('[id*="-backdrop"]');
          if (backdrop) backdrop.onclick = () => this.hideModal(id);
        }
      }
    );
  }
};

// Algunos navegadores/extensiones inyectan listeners de runtime que generan
// rechazos no controlados fuera del código de la app.
// Filtramos únicamente este caso conocido para no contaminar consola ni UX.
const EXTENSION_CHANNEL_CLOSED_ERROR =
  'A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received';

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('unhandledrejection', (event) => {
    const reasonMessage = String(event?.reason?.message || event?.reason || '');
    if (!reasonMessage.includes(EXTENSION_CHANNEL_CLOSED_ERROR)) return;
    event.preventDefault();
    console.warn('[runtime] Ignoring browser-extension message channel rejection.');
  });
}

// Auto-init si es cargado en navegador
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => window.tfUtils.init());
}
