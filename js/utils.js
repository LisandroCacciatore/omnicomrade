/**
 * TechFitness Utils (Legacy Adapter)
 * Archivo de compatibilidad que delega a los nuevos módulos:
 *   - training-engine.js → Lógica de programas
 *   - ui-utils.js        → Lógica de UI
 *   - db.js              → Acceso a datos
 */

window.tfUtils = {
  /* ═══════════════════════════════════════════════════════
     UI HELPERS (Delegan a tfUiUtils)
  ═══════════════════════════════════════════════════════ */

  toast: (m, t) => window.tfUiUtils?.toast(m, t),
  escHtml: (s) => window.tfUiUtils?.escHtml(s),
  debounce: (f, w) => window.tfUiUtils?.debounce(f, w),
  setBtnLoading: (id, l, t) => window.tfUiUtils?.setBtnLoading(id, l, t),
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
  get PROGRAMS() { return window.tfTrainingEngine?.PROGRAMS || []; },

  /* ═══════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════ */

  init() {
    this.initGlobalShortcuts();
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

    // Accesibilidad de modales conocidos
    ['modal-nuevo-alumno', 'modal-nueva-membresia', 'modal-alumno', 'modal-eliminar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const backdrop = el.querySelector('[id*="-backdrop"]');
        if (backdrop) backdrop.onclick = () => this.hideModal(id);
      }
    });
  }
};

// Auto-init si es cargado en navegador
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => window.tfUtils.init());
}
