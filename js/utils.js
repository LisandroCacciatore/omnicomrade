/**
 * TechFitness Utils (Legacy Adapter)
 * Archivo de compatibilidad que delega a los nuevos módulos:
 *   - training-engine.js → Lógica de programas
 *   - ui-utils.js        → Lógica de UI
 *   - db.js              → Acceso a datos
 */

window.tfUtils = {
  /* ═══════════════════════════════════════════════════════
     UI HELPERS (Delegan a tfUiUtils con fallback)
  ═══════════════════════════════════════════════════════ */

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
  showModal: (id) => window.tfUiUtils?.showModal(id),
  hideModal: (id) => window.tfUiUtils?.hideModal(id),
  setupValidation: (i, e, v) => window.tfUiUtils?.setupValidation(i, e, v),
  initGlobalShortcuts: () => window.tfUiUtils?.initGlobalShortcuts(),
  showCommandPalette: () => window.tfUiUtils?.showCommandPalette(),

  /**
   * Logout centralizado.
   */
  logout: async () => {
    const db = window.supabaseClient;
    if (db) {
      await db.auth.signOut();
      window.location.href = 'login.html';
    }
  },

  /* ═══════════════════════════════════════════════════════
     TRAINING ENGINE (Delegan a tfTrainingEngine)
  ═══════════════════════════════════════════════════════ */

  round: (v, s) => window.tfTrainingEngine?.round(v, s),
  pct: (b, p) => window.tfTrainingEngine?.pct(b, p),
  get PROGRAMS() {
    return window.tfTrainingEngine?.PROGRAMS || [];
  },

  /* ═══════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════ */

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
