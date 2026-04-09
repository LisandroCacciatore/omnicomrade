/**
 * sidebar.js
 * TechFitness — Sidebar como componente inyectado
 * Una sola fuente de verdad para la navegación de todas las páginas admin/profesor
 *
 * USO en cada HTML:
 *   1. Reemplazar el bloque <aside>...</aside> por: <aside id="app-sidebar"></aside>
 *   2. Cargar este script ANTES que el JS de la página:
 *      <script src="js/sidebar.js"></script>
 *
 * El componente detecta la página activa comparando window.location.pathname.
 */

(function () {

  const STUDENT_NAV_ITEMS = [
    { href: 'student-dashboard.html', icon: 'home', label: 'Inicio' },
    { href: 'student-profile.html', icon: 'fitness_center', label: 'Entrenar' },
    { href: 'progress.html', icon: 'trending_up', label: 'Progreso' },
    { href: 'wellbeing-check.html', icon: 'self_improvement', label: 'Bienestar' }
  ];

  function injectStudentBottomNav() {
    const current = window.location.pathname.split('/').pop() || '';
    const hideOn = ['workout-session.html'];
    if (hideOn.includes(current)) return;

    const studentPages = new Set([
      ...STUDENT_NAV_ITEMS.map((i) => i.href),
      'wellbeing-check.html',
      'workout-session.html'
    ]);
    if (!studentPages.has(current)) return;
    if (document.getElementById('student-bottom-nav')) return;

    const nav = document.createElement('nav');
    nav.id = 'student-bottom-nav';
    nav.className = 'fixed bottom-0 left-0 right-0 z-40 lg:hidden';
    nav.innerHTML = `
      <div style="background:rgba(22,30,38,.97);backdrop-filter:blur(12px);border-top:1px solid #1E293B;display:flex;align-items:center;justify-content:space-around;padding:8px 8px calc(8px + env(safe-area-inset-bottom));">
        ${STUDENT_NAV_ITEMS.map((item) => {
          const isActive =
            current === item.href ||
            (item.href === 'student-profile.html' && current === 'workout-session.html');
          return `<a href="${item.href}" class="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl ${isActive ? 'bg-[#3B82F6]/10' : ''}" ${current === item.href ? 'aria-current="page"' : ''}><span class="material-symbols-rounded text-[22px]" style="color:${isActive ? '#3B82F6' : '#64748B'};font-variation-settings:'FILL' ${isActive ? 1 : 0}">${item.icon}</span><span style="font-size:9px;font-weight:700;color:${isActive ? '#3B82F6' : '#64748B'}">${item.label}</span></a>`;
        }).join('')}
      </div>`;
    document.body.appendChild(nav);
    document.body.style.paddingBottom = '72px';
  }

  const NAV_ITEMS = [
    {
      section: 'Principal',
      items: [
        {
          href: 'admin-dashboard.html',
          icon: 'dashboard',
          label: 'Dashboard',
          roles: ['gim_admin']
        },
        {
          href: 'profesor-dashboard.html',
          icon: 'dashboard',
          label: 'Dashboard',
          roles: ['profesor']
        },
        { href: 'attendance.html', icon: 'how_to_reg', label: 'Asistencia' },
        { href: 'student-list.html', icon: 'people', label: 'Atletas' },
        {
          href: 'membership-list.html',
          icon: 'card_membership',
          label: 'Membresías',
          roles: ['gim_admin']
        },
        { href: 'routine-list.html', icon: 'fitness_center', label: 'Rutinas' }
      ]
    },
    {
      section: 'Entrenamiento',
      items: [
        { href: 'exercise-list.html', icon: 'exercise', label: 'Ejercicios' },
        { href: 'routine-programs.html', icon: 'auto_awesome', label: 'Programas' },
        { href: 'routine-builder.html', icon: 'edit_note', label: 'Crear rutina' }
      ]
    },
    {
      section: 'Analítica',
      items: [{ href: 'progress.html', icon: 'trending_up', label: 'Progreso' }]
    },
    {
      section: 'Profesor',
      items: [
        { href: 'student-list.html', icon: 'people', label: 'Atletas' },
        { href: 'progress.html', icon: 'trending_up', label: 'Progreso y analítica' },
        { href: 'routine-builder.html', icon: 'edit_note', label: 'Constructor de rutinas' },
        { href: 'exercise-list.html', icon: 'exercise', label: 'Biblioteca' },
        { href: 'attendance.html', icon: 'how_to_reg', label: 'Asistencia' }
      ]
    },
    {
      section: 'Config',
      items: [
        {
          href: 'gym-setting.html',
          icon: 'settings',
          label: 'Configuración',
          roles: ['gim_admin']
        },
        {
          href: 'access-requests.html',
          icon: 'how_to_reg',
          label: 'Accesos OAuth',
          roles: ['gim_admin']
        }
      ]
    }
  ];

  function getCurrentPage() {
    return window.location.pathname.split('/').pop() || 'admin-dashboard.html';
  }

  async function getUserRole() {
    try {
      const stored = localStorage.getItem('tf_role');
      if (stored) return stored;

      const { data } = await window.supabaseClient.auth.getSession();
      return data?.session?.user?.app_metadata?.role ?? null;
    } catch {
      return null;
    }
  }

  async function buildSidebar(gymName, logoUrl) {
    const currentPage = getCurrentPage();
    const role = await getUserRole();

    const navHTML = NAV_ITEMS.map((group) => {
      const visibleItems = group.items.filter(
        (item) => !item.roles || !role || item.roles.includes(role)
      );
      if (visibleItems.length === 0) return '';

      const itemsHTML = visibleItems
        .map((item) => {
          const isActive = currentPage === item.href;
          return `
        <a href="${item.href}"
           class="nav-link${isActive ? ' active' : ''}">
          <span class="material-symbols-rounded">${item.icon}</span>
          ${item.label}
        </a>`;
        })
        .join('');

      return `
      <div class="mt-4 mb-2">
        <p class="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3">${group.section}</p>
      </div>
      ${itemsHTML}`;
    }).join('');

    const logoHTML = logoUrl
      ? `<img src="${logoUrl}" class="w-full h-full object-contain rounded-lg" alt="Logo" onerror="this.onerror=null; this.outerHTML='<span class=\'text-[10px] font-black text-white\'>TF</span>'" />`
      : `<span class="material-symbols-rounded text-white text-[18px]" style="font-variation-settings:'FILL' 1">bolt</span>`;

    const dashboardHref = role === 'profesor' ? 'profesor-dashboard.html' : 'admin-dashboard.html';

    return `
    <a href="${dashboardHref}" class="h-16 flex items-center px-5 border-b border-[#1E293B] gap-3 hover:bg-white/5 transition-colors shrink-0">
      <div id="sidebar-logo-icon" class="w-8 h-8 rounded-lg bg-[#3B82F6] flex items-center justify-center shrink-0">
        ${logoHTML}
      </div>
      <span id="sidebar-gym-name" class="text-sm font-bold tracking-tight text-white truncate">
        ${gymName || 'TechFitness'}
      </span>
    </a>

    <nav class="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
      ${navHTML}
    </nav>

    <div class="px-3 py-4 border-t border-[#1E293B]">
      <button id="logout-btn"
        class="nav-link w-full hover:!text-[#EF4444] hover:!bg-red-500/10">
        <span class="material-symbols-rounded">logout</span>
        Cerrar sesión
      </button>
    </div>`;
  }

  function toggle() {
    const target = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!target) return;

    const isOpen = target.classList.contains('translate-x-0');
    if (isOpen) {
      target.classList.remove('translate-x-0');
      target.classList.add('-translate-x-full');
      if (backdrop) backdrop.classList.add('hidden');
    } else {
      target.classList.add('translate-x-0');
      target.classList.remove('-translate-x-full');
      if (backdrop) backdrop.classList.remove('hidden');
    }
  }

  async function inject(gymName, logoUrl) {
    const target = document.getElementById('app-sidebar');
    if (!target) return;

    // Create backdrop if not exists
    if (!document.getElementById('sidebar-backdrop')) {
      const b = document.createElement('div');
      b.id = 'sidebar-backdrop';
      b.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-40 hidden lg:hidden';
      b.onclick = toggle;
      document.body.appendChild(b);
    }

    // Clases del aside - Drawer por defecto en móvil, fijo en desktop
    target.className =
      'w-64 shrink-0 bg-[#161E26] border-r border-[#1E293B] flex flex-col fixed lg:sticky top-0 h-screen z-50 -translate-x-full lg:translate-x-0 transition-transform duration-300';
    target.innerHTML = await buildSidebar(gymName, logoUrl);

    // Bind logout
    target.querySelector('#logout-btn')?.addEventListener('click', window.tfUtils.logout);

    // Close on navigation in mobile & prevent current page reload
    target.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href === getCurrentPage()) {
          e.preventDefault();
        }
        if (window.innerWidth < 1024) toggle();
      });
    });
  }

  /**
   * API pública
   * Llamar desde cada página después de tener la sesión:
   *
   *   window.TFSidebar.init(gymName, logoUrl)
   *   window.TFSidebar.updateGymName(name)
   *   window.TFSidebar.setRole(role)  // llamar desde auth-guard
   */
  window.TFSidebar = {
    async init(gymName, logoUrl) {
      await inject(gymName, logoUrl);
    },
    toggle() {
      toggle();
    },
    updateGymName(name) {
      const el = document.getElementById('sidebar-gym-name');
      if (el) el.textContent = name;
    },
    updateLogo(url) {
      const el = document.getElementById('sidebar-logo-icon');
      if (el)
        el.innerHTML = `<img src="${url}" class="w-full h-full object-contain rounded-lg" alt="Logo" />`;
    },
    setRole(role) {
      try {
        localStorage.setItem('tf_role', role);
      } catch {}
    }
  };

  // Auto-inject en DOMContentLoaded si existe el target
  document.addEventListener('DOMContentLoaded', async () => {
    if (document.getElementById('app-sidebar')) {
      await inject();
    }

    // Auto-bind a cualquier botón con id "hamburger-btn"
    const hamb = document.getElementById('hamburger-btn');
    if (hamb) {
      hamb.onclick = toggle;
    }

    injectStudentBottomNav();
  });
})();
