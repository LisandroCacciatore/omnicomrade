/**
 * TechFitness UI Utils
 * Funciones de interfaz de usuario independientes del dominio.
 */

const UIUtils = {
    toast: (msg, type = 'success') => {
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
        setTimeout(() => el.className = '', 3200);
    },

    escHtml: (str) => {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    },

    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    showModal: (id) => {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.classList.add('modal-active');
            modal.classList.remove('modal-hidden');
            modal._opener = document.activeElement;
        });
    },

    hideModal: (id) => {
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
    },

    setBtnLoading: (btnId, isLoading, loadingText = 'Procesando...') => {
        const btn = typeof btnId === 'string' ? document.getElementById(btnId) : btnId;
        if (!btn) return;
        
        const textEl = btn.querySelector('[id$="-text"]') || btn;
        const spinner = btn.querySelector('[id$="-spinner"]');
        
        if (isLoading) {
            btn.classList.add('loading');
            btn.disabled = true;
            if (spinner) spinner.classList.remove('hidden');
            if (textEl && loadingText) textEl.textContent = loadingText;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
            if (spinner) spinner.classList.add('hidden');
            if (textEl && textEl.dataset.originalText) textEl.textContent = textEl.dataset.originalText;
        }
    },

    initModalAccessibility: (modalId, closeBtnId) => {
        const modal = document.getElementById(modalId);
        const closeBtn = document.getElementById(closeBtnId);
        if (!modal || !closeBtn) return;

        const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

        closeBtn.addEventListener('click', () => UIUtils.hideModal(modalId));

        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') UIUtils.hideModal(modalId);
        });

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const isNowVisible = !modal.classList.contains('hidden') && modal.classList.contains('modal-active');
                    if (isNowVisible) {
                        const first = modal.querySelector(focusableElements);
                        if (first) setTimeout(() => first.focus(), 150);
                    }
                }
            });
        });

        observer.observe(modal, { attributes: true });

        const backdrop = document.querySelector(`#${modalId} [id*="-backdrop"]`);
        if (backdrop) {
            backdrop.addEventListener('click', () => UIUtils.hideModal(modalId));
        }
    },

    showCommandPalette: () => {
        let cp = document.getElementById('tf-command-palette');
        if (!cp) {
            cp = document.createElement('div');
            cp.id = 'tf-command-palette';
            cp.className = 'hidden fixed inset-0 z-[100] flex items-start justify-center p-4 pt-20';
            cp.innerHTML = `
                <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="window.UIUtils?.hideCommandPalette()"></div>
                <div class="relative bg-surface-dark border border-border-dark rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                    <div class="p-4 border-b border-border-dark flex items-center gap-3">
                        <span class="material-symbols-rounded text-slate-500">search</span>
                        <input type="text" id="cp-search-input" placeholder="Buscar acción o página... (Ej: Alumnos, Membresías, Nuevo Alumno)" 
                            class="bg-transparent border-none focus:ring-0 text-white w-full placeholder:text-slate-600" autocomplete="off" />
                        <kbd class="hidden sm:inline shadow-sm border border-border-dark px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-500">ESC</kbd>
                    </div>
                    <div id="cp-results" class="max-h-[400px] overflow-y-auto p-2 flex flex-col gap-1">
                    </div>
                </div>`;
            document.body.appendChild(cp);

            const searchInput = document.getElementById('cp-search-input');
            searchInput.addEventListener('input', (e) => UIUtils.filterCommandPalette(e.target.value));
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const first = document.querySelector('.cp-item');
                    if (first) first.click();
                }
            });
        }

        cp.classList.remove('hidden');
        const input = document.getElementById('cp-search-input');
        input.value = '';
        UIUtils.filterCommandPalette('');
        setTimeout(() => input.focus(), 50);
    },

    hideCommandPalette: () => {
        const cp = document.getElementById('tf-command-palette');
        if (cp) cp.classList.add('hidden');
    },

    filterCommandPalette: (query) => {
        const results = document.getElementById('cp-results');
        if (!results) return;
        
        const items = [
            { label: 'Ir a Alumnos', icon: 'group', href: 'student-list.html' },
            { label: 'Ir a Membresías', icon: 'card_membership', href: 'membership-list.html' },
            { label: 'Ir a Rutinas', icon: 'fitness_center', href: 'routine-list.html' },
            { label: 'Ir a Ejercicios', icon: 'sports_gymnastics', href: 'exercise-list.html' },
            { label: 'Ir a Admin', icon: 'admin_panel_settings', href: 'admin-dashboard.html' },
            { label: 'Nueva Membresía', icon: 'add_card', action: 'openModal("modal-nueva-membresia")' },
            { label: 'Nuevo Alumno', icon: 'person_add', action: 'openModal("modal-nuevo-alumno")' },
            { label: 'Cerrar Sesión', icon: 'logout', action: 'window.tfUtils?.logout()' },
        ];

        const q = query.toLowerCase();
        const filtered = items.filter(i => i.label.toLowerCase().includes(q));

        results.innerHTML = filtered.map(item => `
            <button class="cp-item w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-left transition-colors"
                ${item.href ? `onclick="window.location.href='${item.href}'"` : `onclick="${item.action}; window.UIUtils?.hideCommandPalette()"`}>
                <span class="material-symbols-rounded text-slate-500">${item.icon}</span>
                <span class="text-slate-200 font-medium">${item.label}</span>
            </button>
        `).join('');
    },

    initGlobalShortcuts: () => {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal-active');
                if (openModal) {
                    UIUtils.hideModal(openModal.id);
                }
                const openPanel = document.querySelector('.profile-panel.open, #profile-panel.open');
                if (openPanel) {
                    openPanel.classList.remove('open');
                    const backdrop = document.getElementById('panel-backdrop') || document.getElementById('sidebar-backdrop');
                    if (backdrop) backdrop.classList.add('hidden');
                }
            }

            if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                const search = document.querySelector('input[id*="search"], input[placeholder*="Buscar"]');
                if (search) {
                    e.preventDefault();
                    search.focus();
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                UIUtils.showCommandPalette();
            }
        });
    }
};

window.UIUtils = UIUtils;
