/**
 * TechFitness Utils
 * Funciones compartidas y lógica core.
 * 
 * IMPORTANTE: Este archivo actúa como adapter para compatibilidad hacia atrás.
 * Las pantallas nuevas pueden importar directamente ui-utils.js o training-engine.js
 * sin necesidad de cargar todo tfUtils.
 */

window.tfUtils = {
    getUI: () => window.UIUtils || window.tfUtils,

    toast: (msg, type) => window.UIUtils?.toast?.(msg, type) ?? window.tfUtils._toast?.(msg, type),
    escHtml: (str) => window.UIUtils?.escHtml?.(str) ?? (str ? String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) : ''),
    debounce: (func, wait) => window.UIUtils?.debounce?.(func, wait) ?? (() => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => func(...a), wait); }; })(),
    logout: async () => { const db = window.supabaseClient; if (db) { await db.auth.signOut(); window.location.href = 'login.html'; } },
    initGlobalShortcuts: () => window.UIUtils?.initGlobalShortcuts?.() ?? window.tfUtils._initShortcuts?.(),
    showCommandPalette: () => window.UIUtils?.showCommandPalette?.() ?? window.tfUtils._showCP?.(),
    hideCommandPalette: () => window.UIUtils?.hideCommandPalette?.() ?? window.tfUtils._hideCP?.(),
    filterCommandPalette: (q) => window.UIUtils?.filterCommandPalette?.(q) ?? window.tfUtils._filterCP?.(q),

    round: (v, s) => window.trainingEngine?.round?.(v, s) ?? Math.round(v / s) * s,
    pct: (b, p) => window.trainingEngine?.pct?.(b, p) ?? window.trainingEngine?.round?.(b * p) ?? Math.round(b * p / 2.5) * 2.5,
    PROGRAMS: window.trainingEngine?.PROGRAMS ?? [],

    showModal: (id) => window.UIUtils?.showModal?.(id) ?? window.tfUtils._showModal?.(id),
    hideModal: (id) => window.UIUtils?.hideModal?.(id) ?? window.tfUtils._hideModal?.(id),
    setBtnLoading: (btn, loading, text) => window.UIUtils?.setBtnLoading?.(btn, loading, text) ?? window.tfUtils._setLoading?.(btn, loading, text),
    initModalAccessibility: (mid, cid, bid) => window.UIUtils?.initModalAccessibility?.(mid, cid) ?? window.tfUtils._initAcc?.(mid, cid, bid),
    setupValidation: (inputEl, errorEl, validator) => window.tfUtils._setupVal?.(inputEl, errorEl, validator),
    focusTrap: (modal) => window.tfUtils._focusTrap?.(modal),
    setLoading: (btn, loading, text) => window.tfUtils._setLoad?.(btn, loading, text),

    _toast: (msg, type) => {
        const el = document.getElementById('toast');
        if (!el) return;
        const icon = document.getElementById('toast-icon');
        const text = document.getElementById('toast-msg');
        if (icon) { icon.textContent = type === 'success' ? 'check_circle' : 'error'; icon.style.color = type === 'success' ? '#10B981' : '#EF4444'; }
        if (text) text.textContent = msg;
        el.className = `show ${type}`;
        setTimeout(() => el.className = '', 3200);
    },
    _initShortcuts: () => { document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = document.querySelector('.modal-active'); if (m) window.tfUtils.hideModal(m.id); } if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') { const s = document.querySelector('input[id*="search"]'); if (s) { e.preventDefault(); s.focus(); } } if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); window.tfUtils.showCommandPalette(); } }); },
    _showCP: () => { let cp = document.getElementById('tf-command-palette'); if (!cp) { cp = document.createElement('div'); cp.id = 'tf-command-palette'; cp.className = 'hidden fixed inset-0 z-[100] flex items-start justify-center p-4 pt-20'; cp.innerHTML = '<div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="window.tfUtils.hideCommandPalette()"></div><div class="relative bg-surface-dark border border-border-dark rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"><div class="p-4 border-b border-border-dark flex items-center gap-3"><span class="material-symbols-rounded text-slate-500">search</span><input type="text" id="cp-search-input" placeholder="Buscar..." class="bg-transparent border-none focus:ring-0 text-white w-full" autocomplete="off" /></div><div id="cp-results" class="max-h-[400px] overflow-y-auto p-2 flex flex-col gap-1"></div></div>'; document.body.appendChild(cp); document.getElementById('cp-search-input').addEventListener('input', e => window.tfUtils.filterCommandPalette(e.target.value)); document.getElementById('cp-search-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.querySelector('.cp-item')?.click(); }); } cp.classList.remove('hidden'); document.getElementById('cp-search-input').focus(); },
    _hideCP: () => { const cp = document.getElementById('tf-command-palette'); if (cp) cp.classList.add('hidden'); },
    _filterCP: (q) => { const r = document.getElementById('cp-results'); if (!r) return; const items = [{l:'Ir a Alumnos',i:'group',h:'student-list.html'},{l:'Ir a Membresías',i:'card_membership',h:'membership-list.html'},{l:'Ir a Rutinas',i:'fitness_center',h:'routine-list.html'},{l:'Ir a Ejercicios',i:'sports_gymnastics',h:'exercise-list.html'},{l:'Ir a Admin',i:'admin_panel_settings',h:'admin-dashboard.html'},{l:'Nueva Membresía',i:'add_card',a:'openModal("modal-nueva-membresia")'},{l:'Nuevo Alumno',i:'person_add',a:'openModal("modal-nuevo-alumno")'},{l:'Cerrar Sesión',i:'logout',a:'window.tfUtils.logout()'}]; const f = items.filter(i => i.l.toLowerCase().includes(q.toLowerCase())); r.innerHTML = f.map(i => `<button class="cp-item w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-left" ${i.h ? `onclick="location.href='${i.h}'"` : `onclick="${i.a};window.tfUtils.hideCommandPalette()"`}><span class="material-symbols-rounded text-slate-500">${i.i}</span><span class="text-slate-200">${i.l}</span></button>`).join(''); },
    _showModal: (id) => { const m = document.getElementById(id); if (!m) return; m.classList.remove('hidden'); requestAnimationFrame(() => { m.classList.add('modal-active'); m.classList.remove('modal-hidden'); m._opener = document.activeElement; }); },
    _hideModal: (id) => { const m = document.getElementById(id); if (!m) return; m.classList.add('modal-hidden'); m.classList.remove('modal-active'); setTimeout(() => { m.classList.add('hidden'); if (m._opener) { m._opener.focus(); m._opener = null; } }, 200); },
    _setLoading: (btnId, isLoading, loadingText) => { const btn = typeof btnId === 'string' ? document.getElementById(btnId) : btnId; if (!btn) return; const textEl = btn.querySelector('[id$="-text"]') || btn; const spinner = btn.querySelector('[id$="-spinner"]'); if (isLoading) { btn.classList.add('loading'); btn.disabled = true; if (spinner) spinner.classList.remove('hidden'); if (textEl && loadingText) textEl.textContent = loadingText; } else { btn.classList.remove('loading'); btn.disabled = false; if (spinner) spinner.classList.add('hidden'); if (textEl && textEl.dataset.originalText) textEl.textContent = textEl.dataset.originalText; } },
    _initAcc: (modalId, closeBtnId, backdropId) => { const m = document.getElementById(modalId); const c = document.getElementById(closeBtnId); if (!m || !c) return; c.addEventListener('click', () => window.tfUtils.hideModal(modalId)); m.addEventListener('keydown', e => { if (e.key === 'Escape') window.tfUtils.hideModal(modalId); }); const o = new MutationObserver(ms => ms.forEach(mu => { if (mu.attributeName === 'class' && !m.classList.contains('hidden') && m.classList.contains('modal-active')) { const f = m.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'); if (f) setTimeout(() => f.focus(), 150); } })); o.observe(m, { attributes: true }); const b = backdropId ? document.getElementById(backdropId) : m.querySelector('[id*="-backdrop"]'); if (b) b.addEventListener('click', () => window.tfUtils.hideModal(modalId)); },
    _setupVal: (inputEl, errorEl, validator) => { if (!inputEl || !errorEl) return; const validate = () => { const err = validator(inputEl.value); if (err) { inputEl.classList.add('input-error'); errorEl.textContent = err; errorEl.classList.remove('hidden'); return false; } else { inputEl.classList.remove('input-error'); errorEl.classList.add('hidden'); return true; } }; inputEl.addEventListener('blur', validate); inputEl.addEventListener('input', () => { if (inputEl.classList.contains('input-error')) validate(); }); return validate; },
    _focusTrap: (modal) => { const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'); const first = focusable[0], last = focusable[focusable.length - 1]; const handleTab = (e) => { if (e.key !== 'Tab') return; if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } } else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } } }; const handleEsc = (e) => { if (e.key === 'Escape') modal.dispatchEvent(new CustomEvent('tf:close')); }; modal.addEventListener('keydown', handleTab); modal.addEventListener('keydown', handleEsc); if (first) first.focus(); return () => { modal.removeEventListener('keydown', handleTab); modal.removeEventListener('keydown', handleEsc); }; },
    _setLoad: (btn, isLoading, loadingText) => { if (isLoading) { btn.disabled = true; btn._originalText = btn.querySelector('span:not(.animate-spin)')?.textContent || btn.textContent; btn.style.opacity = '0.6'; btn.style.cursor = 'not-allowed'; const textEl = btn.querySelector('span:not(.animate-spin)'); if (textEl) textEl.textContent = loadingText; const spinner = btn.querySelector('.animate-spin'); if (spinner) spinner.classList.remove('hidden'); } else { btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; const textEl = btn.querySelector('span:not(.animate-spin)'); if (textEl && btn._originalText) textEl.textContent = btn._originalText; const spinner = btn.querySelector('.animate-spin'); if (spinner) spinner.classList.add('hidden'); } }
};

document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', window.tfUtils.logout);
    window.tfUtils.initGlobalShortcuts();
    const knownModals = [{ id: 'modal-nuevo-alumno', close: 'modal-close-btn' }, { id: 'modal-nueva-membresia', close: 'modal-membresia-close' }, { id: 'modal-alumno', close: 'modal-alumno-close' }, { id: 'modal-eliminar', close: 'btn-cancelar-eliminar' }];
    knownModals.forEach(m => { if (document.getElementById(m.id)) window.tfUtils.initModalAccessibility(m.id, m.close); });
});
