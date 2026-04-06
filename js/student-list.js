/**
 * student-list.js
 * TechFitness — Gestión de Atletas
 */

// ─── ESTADO GLOBAL ────────────────────────────────────────────
let allStudents = [];
let studentToDelete = null;
let activePanelStudentId = null;
let assignModal = null;
let gymId = null;
let gymMembershipPlans = [];
const DEFAULT_PLAN_META = {
  mensual: { label: 'Mensual', duration_days: 30, amount: 30000 },
  trimestral: { label: 'Trimestral', duration_days: 90, amount: 80000 },
  anual: { label: 'Anual', duration_days: 365, amount: 280000 }
};

// ─── INIT ─────────────────────────────────────────────────────
async function initStudentList() {
  const session = await window.authGuard(['gim_admin', 'profesor']);
  if (!session) return;

  gymId = session.user.app_metadata.gym_id;

  const userNameEl = document.getElementById('user-name');
  if (userNameEl)
    userNameEl.textContent = session.user.user_metadata?.full_name || session.user.email;

  await loadStudents();
  setupFilters();
  setupTableEvents();
  setupModalAtleta();
  setupModalMembresia();
  setupModalEliminar();
  setupProfilePanel();
}

// ─── CARGAR ALUMNOS ───────────────────────────────────────────
async function loadStudents(filters = {}) {
  const db = window.supabaseClient;

  let query = db
    .from('students')
    .select(
      `
            id, full_name, email, phone, birth_date, objetivo,
            membership_status, created_at, coach_notes, medical_certificate_url,
            routine_id,
            memberships ( id, plan, start_date, end_date, amount, payment_method, created_at )
        `
    )
    .eq('gym_id', gymId)
    .is('deleted_at', null);

  if (filters.search)
    query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  if (filters.status) query = query.eq('membership_status', filters.status);
  if (filters.objetivo) query = query.eq('objetivo', filters.objetivo);

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    window.tfUtils.toast('Error cargando alumnos', 'error');
    console.error(error);
    return;
  }

  allStudents = data || [];
  updateSubtitle();
  const hasActiveFilters = Boolean(filters.search || filters.status || filters.objetivo);
  renderTable(allStudents, hasActiveFilters);
}

function updateSubtitle() {
  const n = allStudents.length;
  const el = document.getElementById('subtitle');
  if (el) el.textContent = `${n} alumno${n !== 1 ? 's' : ''} registrado${n !== 1 ? 's' : ''}`;
}

// ─── RENDER TABLA ─────────────────────────────────────────────
function renderTable(students, hasActiveFilters = false) {
  const tbody = document.getElementById('students-table');
  const emptyState = document.getElementById('empty-state');
  if (!tbody) return;

  if (!students || students.length === 0) {
    tbody.innerHTML = '';
    const emptyTitle = document.getElementById('empty-state-title');
    const emptyDescription = document.getElementById('empty-state-description');
    const emptyAction = document.getElementById('btn-empty-add-student');

    if (hasActiveFilters) {
      if (emptyTitle) emptyTitle.textContent = 'No hay atletas con esos filtros';
      if (emptyDescription)
        emptyDescription.textContent =
          'Probá cambiar o limpiar los filtros para ver atletas registrados.';
      emptyAction?.classList.add('hidden');
    } else {
      if (emptyTitle) emptyTitle.textContent = 'No hay atletas todavía';
      if (emptyDescription)
        emptyDescription.textContent =
          'Empezá agregando tu primer atleta al gimnasio. Podés asignarle membresía y un programa de entrenamiento.';
      emptyAction?.classList.remove('hidden');
    }

    emptyState?.classList.remove('hidden');
    return;
  }
  emptyState?.classList.add('hidden');

  tbody.innerHTML = students
    .map((s) => {
      const latestMembership = s.memberships?.sort(
        (a, b) => new Date(b.end_date) - new Date(a.end_date)
      )[0];
      const statusInfo = getStatusInfo(s.membership_status);
      const objetivoInfo = getObjetivoInfo(s.objetivo);

      let vencimientoHtml = '<span class="text-slate-600 text-xs">—</span>';
      if (latestMembership) {
        const end = new Date(latestMembership.end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
        const dateStr = end.toLocaleDateString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        const colorClass =
          diffDays < 0 ? 'text-danger' : diffDays <= 7 ? 'text-warning' : 'text-slate-400';
        vencimientoHtml = `<span class="${colorClass} text-xs font-medium">${dateStr}</span>`;
      }

      const planBadge = latestMembership
        ? `<span class="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">${latestMembership.plan}</span>`
        : `<span class="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">Sin plan</span>`;

      return `
        <tr class="flex flex-col sm:table-row hover:bg-slate-800/30 transition-colors cursor-pointer border-b border-border-dark sm:border-none p-4 sm:p-0" data-id="${s.id}">
            <td class="px-6 py-2 sm:py-4 pointer-events-none sm:table-cell">
                <div class="flex items-center gap-3">
                    <div class="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        ${s.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div class="flex flex-col">
                        <span class="font-bold text-sm text-slate-100">${window.tfUtils.escHtml(s.full_name)}</span>
                        <span class="text-[10px] text-slate-500">${window.tfUtils.escHtml(s.email || s.phone || '—')}</span>
                    </div>
                </div>
            </td>
            <td class="px-6 py-2 sm:py-4 pointer-events-none sm:table-cell flex justify-between items-center sm:block">
                <span class="sm:hidden text-[10px] text-slate-500 uppercase font-black tracking-widest">Objetivo</span>
                ${
                  objetivoInfo
                    ? `<span class="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${objetivoInfo.class}">${objetivoInfo.label}</span>`
                    : `<span class="text-slate-600 text-xs">—</span>`
                }
            </td>
            <td class="px-6 py-2 sm:py-4 pointer-events-none sm:table-cell flex justify-between items-center sm:block">
                <span class="sm:hidden text-[10px] text-slate-500 uppercase font-black tracking-widest">Membresía</span>
                <span class="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${statusInfo.class}">${statusInfo.label}</span>
            </td>
            <td class="px-6 py-2 sm:py-4 pointer-events-none sm:table-cell flex justify-between items-center sm:block">
                <span class="sm:hidden text-[10px] text-slate-500 uppercase font-black tracking-widest">Vencimiento</span>
                ${vencimientoHtml}
            </td>
            <td class="px-6 py-2 sm:py-4 pointer-events-none sm:table-cell flex justify-between items-center sm:block">
                <span class="sm:hidden text-[10px] text-slate-500 uppercase font-black tracking-widest">Plan</span>
                ${planBadge}
            </td>
            <td class="px-6 py-2 sm:py-4 sm:table-cell flex justify-end sm:block">
                <div class="flex items-center gap-1 action-buttons">
                    <button data-action="edit" data-id="${s.id}"
                        class="size-8 rounded-lg border border-border-dark flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-warning transition-colors" title="Editar">
                        <span class="material-symbols-rounded text-[16px]">edit</span>
                    </button>
                    <button data-action="sell" data-id="${s.id}" data-name="${window.tfUtils.escHtml(s.full_name)}"
                        class="size-8 rounded-lg border border-border-dark flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-success transition-colors" title="Nueva membresía">
                        <span class="material-symbols-rounded text-[16px]">sell</span>
                    </button>
                    <button data-action="delete" data-id="${s.id}" data-name="${window.tfUtils.escHtml(s.full_name)}"
                        class="size-8 rounded-lg border border-border-dark flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-danger transition-colors" title="Eliminar">
                        <span class="material-symbols-rounded text-[16px]">delete</span>
                    </button>
                </div>
            </td>
        </tr>`;
    })
    .join('');

  renderCards(students);
}

function renderCards(students) {
  const container = document.getElementById('students-cards');
  if (!container) return;
  if (!students?.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = students
    .map((s) => {
      const statusInfo = getStatusInfo(s.membership_status);
      const latestM = s.memberships?.sort((a, b) => new Date(b.end_date) - new Date(a.end_date))[0];
      return `
        <div class="bg-surface-dark border border-border-dark rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-800 transition-colors"
             onclick="window.openProfilePanel('${s.id}')">
          <div class="flex items-center gap-3 min-w-0">
            <div class="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
              ${window.tfUtils.escHtml(s.full_name).charAt(0).toUpperCase()}
            </div>
            <div class="min-w-0">
              <p class="font-bold text-sm text-slate-100 truncate">${window.tfUtils.escHtml(s.full_name)}</p>
              <p class="text-[10px] text-slate-500 truncate">${window.tfUtils.escHtml(s.email || s.phone || '—')}</p>
            </div>
          </div>
          <div class="flex flex-col items-end gap-1 shrink-0">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${statusInfo.class}">
              ${statusInfo.label}
            </span>
            ${latestM ? `<span class="text-[10px] text-slate-500 capitalize">${window.tfUtils.escHtml(latestM.plan)}</span>` : ''}
          </div>
        </div>`;
    })
    .join('');
}

function setupTableEvents() {
  const tbody = document.getElementById('students-table');
  if (!tbody) return;

  tbody.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    const row = e.target.closest('tr[data-id]');

    if (actionBtn) {
      e.stopPropagation();
      const { action, id, name } = actionBtn.dataset;
      if (action === 'edit') openEditAtleta(id);
      if (action === 'sell') openMembresiaForStudent(id, name);
      if (action === 'delete') openEliminar(id, name);
      return;
    }
    if (row) openProfilePanel(row.dataset.id);
  });
}

// ─── HELPERS ──────────────────────────────────────────────────
function getStatusInfo(status) {
  const map = {
    activa: { label: 'Activa', class: 'bg-success/10 text-success' },
    por_vencer: { label: 'Por vencer', class: 'bg-warning/10 text-warning' },
    vencida: { label: 'Vencida', class: 'bg-danger/10 text-danger' },
    suspendida: { label: 'Suspendida', class: 'bg-warning/10 text-warning' },
    pendiente: { label: 'Pendiente', class: 'bg-slate-800 text-slate-400' }
  };
  return map[status] || { label: status || '—', class: 'bg-slate-800 text-slate-400' };
}

function getObjetivoInfo(objetivo) {
  const map = {
    fuerza: { label: 'Fuerza', class: 'bg-orange-500/10 text-orange-400' },
    estetica: { label: 'Estética', class: 'bg-pink-500/10 text-pink-400' },
    rendimiento: { label: 'Rendimiento', class: 'bg-primary/10 text-primary' },
    rehabilitacion: { label: 'Rehabilitación', class: 'bg-teal-500/10 text-teal-400' },
    general: { label: 'General', class: 'bg-slate-700 text-slate-300' }
  };
  return map[objetivo] || null;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// ─── FILTROS ──────────────────────────────────────────────────
function setupFilters() {
  const handleFilter = window.tfUtils.debounce(async () => {
    const searchEl = document.getElementById('search-input');
    const statusEl = document.getElementById('filter-status');
    const objEl = document.getElementById('filter-objetivo');

    const search = searchEl ? searchEl.value.trim() : '';
    const status = statusEl ? statusEl.value : '';
    const objetivo = objEl ? objEl.value : '';

    await loadStudents({ search, status, objetivo });
  }, 300);

  document.getElementById('search-input')?.addEventListener('input', handleFilter);
  document.getElementById('filter-status')?.addEventListener('change', handleFilter);
  document.getElementById('filter-objetivo')?.addEventListener('change', handleFilter);
}

// ─── TAB RUTINA ───────────────────────────────────────────────
async function renderTabRutina(studentId, studentName) {
  const tabContent = document.getElementById('tab-rutina');
  const db = window.supabaseClient;
  if (!tabContent) return;

  tabContent.innerHTML = `<div class="text-center py-8 text-slate-500 text-sm">Cargando…</div>`;

  const [{ data: activeProg }, { data: history }, { data: studentRecord }, { data: routines }] =
    await Promise.all([
      db
        .from('student_programs')
        .select(
          `id, status, current_week, started_at, rm_values,
                   program_templates (id, slug, name, description, weeks, days_per_week, level)`
        )
        .eq('student_id', studentId)
        .eq('status', 'activo')
        .maybeSingle(),
      db
        .from('student_programs')
        .select('id, status, started_at, program_templates(name)')
        .eq('student_id', studentId)
        .neq('status', 'activo')
        .order('created_at', { ascending: false })
        .limit(3),
      db
        .from('students')
        .select('id, routine_id, routines(id, name, objetivo, days_per_week, duration_weeks)')
        .eq('id', studentId)
        .maybeSingle(),
      db
        .from('routines')
        .select('id, name, objetivo, days_per_week, duration_weeks')
        .eq('gym_id', gymId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
    ]);

  const assignedRoutine = studentRecord?.routines || null;
  const routineOptions = routines || [];
  const statusColor = { completado: '#10B981', cancelado: '#F59E0B', pausado: '#64748B' };
  const statusLabel = { completado: 'Completado', cancelado: 'Cancelado', pausado: 'Pausado' };

  let html = '';

  // ── Programa activo ──
  if (activeProg) {
    const tpl = activeProg.program_templates;
    const prog = Math.round((activeProg.current_week / (tpl.weeks || 1)) * 100);
    const rmsHTML = Object.entries(activeProg.rm_values || {})
      .map(
        ([k, v]) =>
          `<span style="font-size:10px;font-weight:700;color:#64748B;background:#0B1218;padding:2px 8px;border-radius:6px;border:1px solid #1E293B;font-family:'IBM Plex Mono',monospace">${k.toUpperCase()}: ${v}kg</span>`
      )
      .join(' ');
    html += `
        <div style="background:#0B1218;border:1px solid rgba(16,185,129,.3);border-radius:14px;padding:14px;margin-bottom:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div>
              <div style="font-size:13px;font-weight:700;color:#E2E8F0">${tpl.name}</div>
              <div style="font-size:11px;color:#475569;margin-top:1px">Semana ${activeProg.current_week} de ${tpl.weeks} · ${tpl.level || ''}</div>
            </div>
            <span style="font-size:9px;font-weight:800;padding:3px 9px;border-radius:999px;background:rgba(16,185,129,.12);color:#34D399;border:1px solid rgba(16,185,129,.3)">ACTIVO</span>
          </div>
          <div style="background:#1E293B;border-radius:4px;height:4px;margin-bottom:10px;overflow:hidden">
            <div style="height:100%;width:${prog}%;background:linear-gradient(90deg,#10B981,#34D399);border-radius:4px"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#334155;margin-bottom:10px">
            <span>Inicio: ${formatDate(activeProg.started_at)}</span>
            <span>${prog}% completado</span>
          </div>
          ${rmsHTML ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">${rmsHTML}</div>` : ''}
          <button id="btn-cambiar-plan" style="width:100%;padding:8px;border-radius:10px;border:1px solid #F59E0B44;background:rgba(245,158,11,.07);color:#FCD34D;font-size:12px;font-weight:700;cursor:pointer">
            ⚡ Cambiar plan
          </button>
        </div>`;
  } else {
    html += `
        <div style="text-align:center;padding:28px 16px;border:1px dashed #1E293B;border-radius:14px;margin-bottom:14px">
          <div style="font-size:28px;margin-bottom:8px">🏋️</div>
          <p style="font-size:13px;font-weight:700;color:#E2E8F0;margin-bottom:4px">Sin programa asignado</p>
          <p style="font-size:11px;color:#475569;margin-bottom:14px">Asigná un programa y el sistema calculará las cargas automáticamente.</p>
          <button id="btn-asignar-plan" style="padding:8px 18px;border-radius:10px;background:#3B82F6;color:#fff;font-size:12px;font-weight:700;border:none;cursor:pointer">
            + Asignar programa
          </button>
        </div>`;
  }

  // ── Historial ──
  if (history?.length > 0) {
    html += `<p style="font-size:10px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Historial</p>`;
    html += history
      .map((h) => {
        const sc = statusColor[h.status] || '#64748B';
        const sl = statusLabel[h.status] || h.status;
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #111820">
              <div>
                <div style="font-size:12px;font-weight:600;color:#94A3B8">${h.program_templates?.name || '—'}</div>
                <div style="font-size:10px;color:#334155">${formatDate(h.started_at)}</div>
              </div>
              <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;background:${sc}15;color:${sc};border:1px solid ${sc}33">${sl}</span>
            </div>`;
      })
      .join('');
  }

  // ── Rutina asignada ──
  html += `
    <div style="margin-top:14px;background:#0B1218;border:1px solid ${assignedRoutine ? 'rgba(59,130,246,.25)' : '#1E293B'};border-radius:14px;padding:14px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px">
        <div>
          <p style="font-size:11px;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Rutina asignada</p>
          <div style="font-size:13px;font-weight:700;color:#E2E8F0">${assignedRoutine ? window.tfUtils.escHtml(assignedRoutine.name) : 'Sin rutina asignada'}</div>
          <div style="font-size:11px;color:#475569;margin-top:3px">
            ${
              assignedRoutine
                ? `${assignedRoutine.objetivo || 'general'} · ${assignedRoutine.days_per_week || '—'} días · ${assignedRoutine.duration_weeks || '—'} semanas`
                : 'Seleccioná una rutina para este alumno'
            }
          </div>
        </div>
        <span style="font-size:9px;font-weight:800;padding:3px 9px;border-radius:999px;background:${assignedRoutine ? 'rgba(59,130,246,.12)' : 'rgba(100,116,139,.12)'};color:${assignedRoutine ? '#60A5FA' : '#94A3B8'};border:1px solid ${assignedRoutine ? 'rgba(59,130,246,.25)' : 'rgba(100,116,139,.25)'}">
          ${assignedRoutine ? 'ASIGNADA' : 'VACÍA'}
        </span>
      </div>
      <label for="student-routine-select" style="display:block;font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Seleccionar rutina</label>
      <select id="student-routine-select" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #1E293B;background:#111827;color:#E2E8F0;font-size:12px;margin-bottom:10px" ${routineOptions.length === 0 ? 'disabled' : ''}>
        <option value="">Sin rutina asignada</option>
        ${routineOptions.map((r) => `<option value="${r.id}" ${studentRecord?.routine_id === r.id ? 'selected' : ''}>${window.tfUtils.escHtml(r.name)} · ${window.tfUtils.escHtml(r.objetivo || 'general')}</option>`).join('')}
      </select>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <p id="student-routine-help" style="font-size:11px;color:#475569;margin:0">
          ${routineOptions.length === 0 ? 'No hay rutinas creadas en este gimnasio.' : 'Guardá para asignar la rutina al alumno.'}
        </p>
        <button id="btn-save-routine-assignment" style="padding:8px 14px;border-radius:10px;background:${routineOptions.length === 0 ? '#334155' : '#3B82F6'};color:#fff;font-size:12px;font-weight:700;border:none;cursor:${routineOptions.length === 0 ? 'not-allowed' : 'pointer'}" ${routineOptions.length === 0 ? 'disabled' : ''}>
          Guardar rutina
        </button>
      </div>
      <p id="student-routine-feedback" style="display:none;font-size:11px;font-weight:700;margin-top:10px"></p>
    </div>`;

  tabContent.innerHTML = html;

  // ── Bind modales de programa ──
  if (!assignModal) {
    assignModal = new window.ProgramAssignModal({
      gymId,
      db,
      onSuccess: async () => {
        await renderTabRutina(studentId, studentName);
      }
    });
  }

  const openModal = () =>
    assignModal.open({ preStudent: { id: studentId, full_name: studentName } });
  document.getElementById('btn-asignar-plan')?.addEventListener('click', openModal);
  document.getElementById('btn-cambiar-plan')?.addEventListener('click', openModal);

  // ── Guardar rutina ──
  const btnSave = document.getElementById('btn-save-routine-assignment');
  const select = document.getElementById('student-routine-select');
  const feedback = document.getElementById('student-routine-feedback');

  btnSave?.addEventListener('click', async () => {
    const selectedRoutineId = select.value || null;
    btnSave.disabled = true;
    btnSave.textContent = 'Guardando…';
    if (feedback) feedback.style.display = 'none';

    const db = window.supabaseClient;
    const { error } = await db
      .from('students')
      .update({ routine_id: selectedRoutineId })
      .eq('id', studentId);

    if (error) {
      if (feedback) {
        feedback.textContent = 'No se pudo guardar.';
        feedback.style.color = '#F87171';
        feedback.style.display = 'block';
      }
    } else {
      if (feedback) {
        feedback.textContent = selectedRoutineId
          ? 'Rutina asignada correctamente.'
          : 'Rutina quitada.';
        feedback.style.color = '#34D399';
        feedback.style.display = 'block';
      }
      // Actualizar en memoria
      const s = allStudents.find((x) => x.id === studentId);
      if (s) s.routine_id = selectedRoutineId;
      await renderTabRutina(studentId, studentName);
    }

    btnSave.disabled = false;
    btnSave.textContent = 'Guardar rutina';
  });
}

// ─── PANEL LATERAL ────────────────────────────────────────────
function setupProfilePanel() {
  const panel = document.getElementById('profile-panel');
  const backdrop = document.getElementById('panel-backdrop');
  const db = window.supabaseClient;

  function closePanel() {
    panel.classList.remove('open');
    backdrop.classList.remove('open');
    activePanelStudentId = null;
  }

  document.getElementById('panel-close')?.addEventListener('click', closePanel);
  backdrop?.addEventListener('click', closePanel);

  // Tabs
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.getElementById(`tab-${tabId}`)?.classList.add('active');

      if (tabId === 'rutina' && activePanelStudentId) {
        const s = allStudents.find((x) => x.id === activePanelStudentId);
        await renderTabRutina(activePanelStudentId, s?.full_name || '');
      }
    });
  });

  document.getElementById('panel-btn-editar')?.addEventListener('click', () => {
    if (activePanelStudentId) openEditAtleta(activePanelStudentId);
  });

  document.getElementById('panel-btn-membresia')?.addEventListener('click', () => {
    if (!activePanelStudentId) return;
    const s = allStudents.find((x) => x.id === activePanelStudentId);
    if (s) openMembresiaForStudent(s.id, s.full_name);
  });

  // Guardar notas
  document.getElementById('panel-btn-save-notes')?.addEventListener('click', async () => {
    if (!activePanelStudentId) return;
    const notes = document.getElementById('panel-notes-input').value;
    const btnText = document.getElementById('notes-btn-text');
    const btnSpinner = document.getElementById('notes-btn-spinner');
    const savedMsg = document.getElementById('notes-saved-msg');

    if (btnText) btnText.textContent = 'Guardando...';
    btnSpinner?.classList.remove('hidden');

    const { error } = await db
      .from('students')
      .update({ coach_notes: notes })
      .eq('id', activePanelStudentId);

    if (btnText) btnText.textContent = 'Guardar notas';
    btnSpinner?.classList.add('hidden');

    if (!error) {
      const s = allStudents.find((x) => x.id === activePanelStudentId);
      if (s) s.coach_notes = notes;
      savedMsg?.classList.remove('hidden');
      setTimeout(() => savedMsg?.classList.add('hidden'), 2500);
    }
  });

  // Upload certificado médico
  document.getElementById('cert-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !activePanelStudentId) return;

    const errorEl = document.getElementById('cert-upload-error');
    const progressEl = document.getElementById('cert-upload-progress');
    errorEl?.classList.add('hidden');
    progressEl?.classList.remove('hidden');

    try {
      const ext = file.name.split('.').pop();
      const path = `${activePanelStudentId}/certificado.${ext}`;

      const { error: uploadError } = await db.storage
        .from('medical-certificates')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = await db.storage
        .from('medical-certificates')
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = urlData?.signedUrl;

      if (url) {
        await db
          .from('students')
          .update({ medical_certificate_url: url })
          .eq('id', activePanelStudentId);
        const s = allStudents.find((x) => x.id === activePanelStudentId);
        if (s) s.medical_certificate_url = url;
        const certLink = document.getElementById('cert-link');
        if (certLink) certLink.href = url;
        document.getElementById('cert-current')?.classList.remove('hidden');
        document.getElementById('cert-empty')?.classList.add('hidden');
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Error al subir: ' + err.message;
        errorEl.classList.remove('hidden');
      }
    } finally {
      progressEl?.classList.add('hidden');
      e.target.value = '';
    }
  });
}

// Abre el panel lateral con datos del alumno
window.openProfilePanel = function (studentId) {
  const s = allStudents.find((x) => x.id === studentId);
  if (!s) return;

  activePanelStudentId = studentId;

  document.getElementById('panel-avatar').textContent = s.full_name.charAt(0).toUpperCase();
  document.getElementById('panel-name').textContent = s.full_name;
  const objInfo = getObjetivoInfo(s.objetivo);
  document.getElementById('panel-objetivo-label').textContent = objInfo
    ? objInfo.label
    : 'Sin objetivo definido';

  // Tab INFO
  document.getElementById('panel-fullname').textContent = s.full_name;
  document.getElementById('panel-email').textContent = s.email || '—';
  document.getElementById('panel-phone').textContent = s.phone || '—';
  document.getElementById('panel-birth').textContent = formatDate(s.birth_date);
  document.getElementById('panel-created').textContent = formatDate(s.created_at);
  const statusInfo = getStatusInfo(s.membership_status);
  document.getElementById('panel-status-badge').innerHTML =
    `<span class="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${statusInfo.class}">${statusInfo.label}</span>`;

  // Tab MEMBRESÍAS
  const memberships =
    s.memberships?.sort((a, b) => new Date(b.end_date) - new Date(a.end_date)) || [];
  const memEl = document.getElementById('panel-membresias-list');
  if (memEl) {
    if (!memberships.length) {
      memEl.innerHTML = `<div class="text-center py-8"><span class="material-symbols-rounded text-slate-700 text-[36px]">payments</span><p class="text-slate-500 text-sm mt-2">Sin membresías registradas.</p></div>`;
    } else {
      memEl.innerHTML = memberships
        .map((m) => {
          const end = new Date(m.end_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isActive = end >= today;
          return `
                <div class="bg-background-dark border ${isActive ? 'border-success/20' : 'border-border-dark'} rounded-xl p-4 flex items-center justify-between gap-4">
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-black capitalize">${m.plan}</span>
                            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}">${isActive ? 'Activa' : 'Vencida'}</span>
                        </div>
                        <p class="text-[10px] text-slate-500">${formatDate(m.start_date)} → ${formatDate(m.end_date)}</p>
                    </div>
                    <p class="text-sm font-black text-right shrink-0">$${parseFloat(m.amount).toLocaleString('es-AR')}</p>
                </div>`;
        })
        .join('');
    }
  }

  // Tab NOTAS
  const notesInput = document.getElementById('panel-notes-input');
  if (notesInput) notesInput.value = s.coach_notes || '';
  document.getElementById('notes-saved-msg')?.classList.add('hidden');

  // Tab MÉDICO
  if (s.medical_certificate_url) {
    const certLink = document.getElementById('cert-link');
    if (certLink) certLink.href = s.medical_certificate_url;
    document.getElementById('cert-current')?.classList.remove('hidden');
    document.getElementById('cert-empty')?.classList.add('hidden');
  } else {
    document.getElementById('cert-current')?.classList.add('hidden');
    document.getElementById('cert-empty')?.classList.remove('hidden');
  }

  // Link progreso
  const btnProgress = document.getElementById('panel-btn-progress');
  if (btnProgress) btnProgress.href = `progress.html?student=${studentId}`;

  // Resetear a tab Info
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="info"]')?.classList.add('active');
  document.getElementById('tab-info')?.classList.add('active');

  // Abrir panel
  const panel = document.getElementById('profile-panel');
  panel.classList.add('open');
  document.getElementById('panel-backdrop')?.classList.add('open');
};

// ─── MODAL ALUMNO ─────────────────────────────────────────────
function setupModalAtleta() {
  const db = window.supabaseClient;
  const modal = document.getElementById('modal-alumno');
  const errorEl = document.getElementById('modal-alumno-error');
  const submitBtn = document.getElementById('modal-alumno-submit');

  window.openNewAtleta = function () {
    if (window.onboardingWizard?.open) {
      window.onboardingWizard.open();
      return;
    }

    document.getElementById('modal-title-alumno').innerHTML =
      'Nuevo <span class="text-primary">Atleta</span>';
    document.getElementById('alumno-id').value = '';
    document.getElementById('form-alumno').reset();
    errorEl?.classList.add('hidden');
    window.tfUtils.showModal('modal-alumno');
  };

  window.openEditAtleta = function (id) {
    const s = allStudents.find((x) => x.id === id);
    if (!s) return;
    document.getElementById('modal-title-alumno').innerHTML =
      'Editar <span class="text-warning">Atleta</span>';
    document.getElementById('alumno-id').value = s.id;
    document.getElementById('alumno-full-name').value = s.full_name || '';
    document.getElementById('alumno-email').value = s.email || '';
    document.getElementById('alumno-phone').value = s.phone || '';
    document.getElementById('alumno-birth-date').value = s.birth_date || '';
    document.getElementById('alumno-objetivo').value = s.objetivo || '';
    errorEl?.classList.add('hidden');
    window.tfUtils.showModal('modal-alumno');
  };

  function closeModal() {
    window.tfUtils.hideModal('modal-alumno');
  }

  async function handleSave(e) {
    e.preventDefault();
    const id = document.getElementById('alumno-id').value;
    const fullName = document.getElementById('alumno-full-name').value.trim();
    if (!fullName) return;

    window.tfUtils.setBtnLoading(submitBtn, true, 'Guardando...');

    const payload = {
      full_name: fullName,
      email: document.getElementById('alumno-email').value.trim() || null,
      phone: document.getElementById('alumno-phone').value.trim() || null,
      birth_date: document.getElementById('alumno-birth-date').value || null,
      objetivo: document.getElementById('alumno-objetivo').value || null
    };

    let error;
    if (id) {
      ({ error } = await db.from('students').update(payload).eq('id', id));
    } else {
      ({ error } = await db
        .from('students')
        .insert({ ...payload, gym_id: gymId, membership_status: 'pendiente' }));
    }

    window.tfUtils.setBtnLoading(submitBtn, false);

    if (error) {
      if (errorEl) {
        errorEl.textContent = 'Error: ' + error.message;
        errorEl.classList.remove('hidden');
      }
      return;
    }

    window.tfUtils.toast(id ? 'Atleta actualizado' : 'Atleta creado');
    closeModal();
    await loadStudents();
  }

  document.getElementById('btn-nuevo-alumno')?.addEventListener('click', window.openNewAtleta);
  document
    .getElementById('btn-empty-add-student')
    ?.addEventListener('click', window.openNewAtleta);
  document.getElementById('modal-alumno-backdrop')?.addEventListener('click', closeModal);
  document.getElementById('modal-alumno-close')?.addEventListener('click', closeModal);
  document.getElementById('form-alumno')?.addEventListener('submit', handleSave);
}

// ─── MODAL MEMBRESÍA ──────────────────────────────────────────
function setupModalMembresia() {
  const db = window.supabaseClient;
  const errorEl = document.getElementById('modal-membresia-error');
  const submitBtn = document.getElementById('modal-membresia-submit');
  const planButtonsContainer = document.getElementById('membresia-plan-buttons');

  async function loadGymPlans() {
    const { data, error } = await db
      .from('gym_membership_plans')
      .select('plan_key, label, duration_days, amount, is_active')
      .eq('gym_id', gymId)
      .eq('is_active', true)
      .order('duration_days', { ascending: true });

    if (error && error.code !== '42P01') throw error;
    if (data && data.length) {
      gymMembershipPlans = data;
      return;
    }
    gymMembershipPlans = Object.entries(DEFAULT_PLAN_META).map(([plan_key, meta]) => ({
      plan_key,
      ...meta,
      is_active: true
    }));
  }

  function renderPlanButtons() {
    if (!planButtonsContainer) return;
    if (!gymMembershipPlans.length) {
      planButtonsContainer.innerHTML =
        '<p class="text-xs text-danger col-span-3">No hay planes disponibles.</p>';
      return;
    }
    planButtonsContainer.innerHTML = gymMembershipPlans
      .map(
        (plan) => `
            <button type="button" data-plan="${plan.plan_key}" data-amount="${plan.amount ?? ''}"
                class="plan-btn border border-slate-800 rounded-xl py-3 text-xs font-bold hover:border-primary transition-all">
                ${window.tfUtils.escHtml(plan.label || plan.plan_key)}<br>
                <span class="text-slate-500 font-normal">${Number(plan.duration_days || 0)} días</span>
            </button>
        `
      )
      .join('');
  }

  function selectPlan(planKey, amount = null) {
    document
      .querySelectorAll('#membresia-plan-buttons .plan-btn')
      .forEach((b) => b.classList.remove('border-primary', 'text-primary', 'bg-primary/10'));
    const selectedBtn = document.querySelector(
      `#membresia-plan-buttons .plan-btn[data-plan="${planKey}"]`
    );
    if (selectedBtn) selectedBtn.classList.add('border-primary', 'text-primary', 'bg-primary/10');
    document.getElementById('membresia-plan').value = planKey || '';
    const parsedAmount = Number(amount ?? selectedBtn?.dataset.amount);
    const amountInput = document.getElementById('membresia-amount');
    if (amountInput) amountInput.value = Number.isFinite(parsedAmount) ? String(parsedAmount) : '';
  }

  window.openMembresiaForStudent = async function (studentId, studentName) {
    try {
      await loadGymPlans();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'No se pudieron cargar los planes del gimnasio.';
        errorEl.classList.remove('hidden');
      }
      return;
    }
    renderPlanButtons();
    document.getElementById('membresia-student-id').value = studentId;
    document.getElementById('membresia-student-name').textContent = studentName;
    document.getElementById('membresia-start-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('membresia-plan').value = '';
    document.getElementById('membresia-amount').value = '';
    document.getElementById('membresia-notes').value = '';
    document
      .querySelectorAll('#membresia-plan-buttons .plan-btn')
      .forEach((b) => b.classList.remove('border-primary', 'text-primary', 'bg-primary/10'));
    errorEl?.classList.add('hidden');
    window.tfUtils.showModal('modal-nueva-membresia');
  };

  function closeModal() {
    window.tfUtils.hideModal('modal-nueva-membresia');
  }

  planButtonsContainer?.addEventListener('click', (evt) => {
    const btn = evt.target.closest('.plan-btn');
    if (!btn) return;
    selectPlan(btn.dataset.plan, btn.dataset.amount);
  });

  async function handleSave(e) {
    e.preventDefault();
    const studentId = document.getElementById('membresia-student-id').value;
    const plan = document.getElementById('membresia-plan').value;
    const startDate = document.getElementById('membresia-start-date').value;
    const amount = document.getElementById('membresia-amount').value;
    const paymentMethod = document.getElementById('membresia-payment-method').value;
    const notes = document.getElementById('membresia-notes').value.trim();

    if (!plan) {
      if (errorEl) {
        errorEl.textContent = 'Seleccioná un plan.';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    window.tfUtils.setBtnLoading(submitBtn, true, 'Guardando...');

    const { error } = await db.from('memberships').insert({
      gym_id: gymId,
      student_id: studentId,
      plan,
      start_date: startDate,
      end_date: startDate,
      amount: parseFloat(amount),
      payment_method: paymentMethod,
      notes: notes || null
    });

    window.tfUtils.setBtnLoading(submitBtn, false, 'Registrar Membresía');

    if (error) {
      if (errorEl) {
        errorEl.textContent = 'Error: ' + error.message;
        errorEl.classList.remove('hidden');
      }
      return;
    }

    window.tfUtils.toast('Membresía registrada');
    closeModal();
    await loadStudents();
  }

  document.getElementById('modal-membresia-backdrop')?.addEventListener('click', closeModal);
  document.getElementById('modal-membresia-close')?.addEventListener('click', closeModal);
  document.getElementById('form-membresia')?.addEventListener('submit', handleSave);
}

// ─── MODAL ELIMINAR ───────────────────────────────────────────
function setupModalEliminar() {
  const db = window.supabaseClient;

  window.openEliminar = function (id, name) {
    studentToDelete = id;
    document.getElementById('eliminar-alumno-name').textContent = name;
    window.tfUtils.showModal('modal-eliminar');
  };

  function closeModal() {
    window.tfUtils.hideModal('modal-eliminar');
    studentToDelete = null;
  }

  async function confirmarEliminar() {
    if (!studentToDelete) return;
    const { error } = await db
      .from('students')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', studentToDelete);

    if (!error) {
      window.tfUtils.toast('Atleta eliminado');
      closeModal();
      if (activePanelStudentId === studentToDelete) {
        document.getElementById('profile-panel')?.classList.remove('open');
        document.getElementById('panel-backdrop')?.classList.remove('open');
        activePanelStudentId = null;
      }
      await loadStudents();
    }
  }

  document.getElementById('modal-eliminar-backdrop')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancelar-eliminar')?.addEventListener('click', closeModal);
  document.getElementById('btn-confirmar-eliminar')?.addEventListener('click', confirmarEliminar);
}

// ─── ARRANCAR ─────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStudentList);
} else {
  initStudentList();
}
