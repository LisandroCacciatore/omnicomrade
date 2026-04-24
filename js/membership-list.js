// ─── ESTADO ───────────────────────────────────────────────
let allMemberships = [];
let currentFilteredMemberships = [];
let gymId = null;
let membershipPlanCatalog = [];
function escHtml(s) {
  return window.tfUtils?.escHtml?.(s) ?? (s ? String(s) : '');
}
const PLAN_DEFAULTS = {
  mensual: { label: 'Mensual', duration_days: 30, amount: 30000 },
  trimestral: { label: 'Trimestral', duration_days: 90, amount: 80000 },
  anual: { label: 'Anual', duration_days: 365, amount: 280000 }
};
// ─── INIT ─────────────────────────────────────────────────
async function initMembershipList() {
  const ctx = await window.authGuard(['gim_admin']);
  if (!ctx) return;
  const { gymId: ctxGymId, email } = ctx;
  gymId = ctxGymId || null;
  const session = await window.tfSession.get();
  document.getElementById('user-name').textContent =
    session?.user?.user_metadata?.full_name || email || '';
  document.getElementById('logout-btn')?.addEventListener('click', window.tfUtils.logout);
  await ensurePlanCatalog();
  await loadMemberships();
  setupFilters();
  setupModal();
  setupPlanPricing();
}
// ─── CARGAR MEMBRESÍAS ────────────────────────────────────
// Trae todas las membresías junto con el nombre del alumno usando un JOIN.
// El .select('*, students(full_name, email)') le dice a Supabase que traiga
// también los datos del alumno relacionado por student_id.
async function loadMemberships() {
  const tbody = document.getElementById('memberships-table');
  tbody.innerHTML = `
        <tr class="animate-pulse sk-delay-1">
            <td class="px-6 py-4 sticky left-0 bg-[#0B1218] z-10"><div class="h-4 w-32 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-16 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-16 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-16 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-8 bg-slate-800 rounded"></div></td>
        </tr>
        <tr class="animate-pulse sk-delay-2">
            <td class="px-6 py-4 sticky left-0 bg-[#0B1218] z-10"><div class="h-4 w-28 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-16 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-16 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-16 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-8 bg-slate-800 rounded"></div></td>
        </tr>`;
  const { data, error } = await window.supabaseClient
    .from('memberships')
    .select('*, students(full_name, email, objetivo)')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error cargando membresías:', error);
    window.tfUtils.toast('Error al cargar las membresías', 'error');
    return;
  }
  allMemberships = data || [];
  currentFilteredMemberships = [...allMemberships];
  updateKPIs();
  renderRelationshipChart(allMemberships);
  renderTable(allMemberships);
}
async function ensurePlanCatalog() {
  if (!gymId) return;
  const { data, error } = await window.supabaseClient
    .from('gym_membership_plans')
    .select('id, gym_id, plan_key, label, duration_days, amount, is_active')
    .eq('gym_id', gymId)
    .order('duration_days', { ascending: true });
  if (error && error.code !== '42P01') {
    console.error('Error cargando catálogo de planes:', error);
    window.tfUtils.toast('Error al cargar el catálogo de planes', 'error');
    return;
  }
  if (data && data.length) {
    membershipPlanCatalog = data;
    return;
  }
  const seedRows = Object.entries(PLAN_DEFAULTS).map(([planKey, meta]) => ({
    gym_id: gymId,
    plan_key: planKey,
    label: meta.label,
    duration_days: meta.duration_days,
    amount: meta.amount,
    is_active: true
  }));
  const { data: inserted, error: seedError } = await window.supabaseClient
    .from('gym_membership_plans')
    .insert(seedRows)
    .select('id, gym_id, plan_key, label, duration_days, amount, is_active');
  if (seedError) {
    console.error('No se pudo crear catálogo base de planes:', seedError);
    membershipPlanCatalog = Object.entries(PLAN_DEFAULTS).map(([plan_key, meta]) => ({
      ...meta,
      plan_key,
      is_active: true
    }));
    return;
  }
  membershipPlanCatalog = inserted || [];
}
// ─── KPIs ─────────────────────────────────────────────────
function updateKPIs() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const activas = allMemberships.filter((m) => {
    const end = new Date(m.end_date);
    return end >= today;
  });
  const porVencer = allMemberships.filter((m) => {
    const end = new Date(m.end_date);
    return end >= today && end <= in7days;
  });
  const vencidas = allMemberships.filter((m) => {
    const end = new Date(m.end_date);
    return end < today;
  });
  document.getElementById('kpi-total').textContent = allMemberships.length;
  document.getElementById('kpi-activas').textContent = activas.length;
  document.getElementById('kpi-por-vencer').textContent = porVencer.length;
  document.getElementById('kpi-vencidas').textContent = vencidas.length;
}
// ─── RENDER TABLA ─────────────────────────────────────────
function renderTable(memberships) {
  const tbody = document.getElementById('memberships-table');
  const emptyState = document.getElementById('empty-state');
  if (!memberships || memberships.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  tbody.innerHTML = memberships
    .map((m) => {
      const status = getMembershipStatus(m.end_date);
      return `
        <tr class="hover:bg-slate-800/30 transition-colors">
            <td class="px-6 py-4 sticky left-0 bg-[#0B1218] z-10 border-r border-border-dark sm:border-r-0">
                <div class="flex flex-col">
                    <span class="font-bold text-sm">${escHtml(m.students?.full_name || 'Sin nombre')}</span>
                    <span class="text-[10px] text-slate-500">${escHtml(m.students?.email || '')}</span>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="text-xs font-bold capitalize">${escHtml(m.plan || '—')}</span>
            </td>
            <td class="px-6 py-4">
                <span class="status-badge ${status.class}">${status.label}</span>
            </td>
            <td class="px-6 py-4 text-xs text-slate-400">${formatDate(m.start_date)}</td>
            <td class="px-6 py-4 text-xs ${status.dateClass}">${formatDate(m.end_date)}</td>
            <td class="px-6 py-4 text-sm font-bold">$${parseFloat(m.amount).toLocaleString('es-AR')}</td>
            <td class="px-6 py-4">
                <span class="flex items-center gap-1 text-xs text-slate-400">
                    <span class="material-symbols-rounded text-[14px]">${m.payment_method === 'efectivo' ? 'payments' : 'account_balance'}</span>
                    ${escHtml(m.payment_method || '—')}
                </span>
            </td>
            <td class="px-6 py-4">
                ${
                  m.notes
                    ? `
                <div class="relative group">
                    <button class="size-8 rounded-lg border border-border-dark flex items-center justify-center hover:bg-slate-800 text-slate-400 transition-colors">
                        <span class="material-symbols-rounded text-[16px]">sticky_note_2</span>
                    </button>
                    <div class="absolute right-0 bottom-full mb-2 w-48 bg-slate-900 border border-border-dark rounded-xl p-3 text-xs text-slate-300 hidden group-hover:block z-10 shadow-xl">
                        ${escHtml(m.notes)}
                    </div>
                </div>`
                    : '<div class="size-8"></div>'
                }
            </td>
        </tr>`;
    })
    .join('');
}
// ─── ESTADO DE MEMBRESÍA ──────────────────────────────────
// Calcula el estado en el frontend comparando end_date con hoy.
// Esto es más flexible que depender del campo membership_status del alumno.
function getMembershipStatus(endDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (end < today) {
    return { label: 'Vencida', class: 'bg-danger/10 text-danger', dateClass: 'text-danger' };
  } else if (end <= in7days) {
    return { label: 'Por vencer', class: 'bg-warning/10 text-warning', dateClass: 'text-warning' };
  } else {
    return { label: 'Activa', class: 'bg-success/10 text-success', dateClass: 'text-slate-400' };
  }
}
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}
// ─── FILTROS ──────────────────────────────────────────────
// Cada vez que el usuario escribe o cambia un filtro, filtra el array
// en memoria sin hacer otra llamada a Supabase.
function setupFilters() {
  const searchInput = document.getElementById('search-input');
  const filterStatus = document.getElementById('filter-status');
  const filterPlan = document.getElementById('filter-plan');
  const clearBtn = document.getElementById('clear-membership-filters');
  function applyFilters() {
    const search = searchInput.value.toLowerCase();
    const status = filterStatus.value;
    const plan = filterPlan.value;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const filtered = allMemberships.filter((m) => {
      const name = m.students?.full_name?.toLowerCase() || '';
      const end = new Date(m.end_date);
      const matchSearch = !search || name.includes(search);
      const matchPlan = !plan || m.plan === plan;
      let matchStatus = true;
      if (status === 'activa') matchStatus = end >= today && end > in7days;
      if (status === 'por_vencer') matchStatus = end >= today && end <= in7days;
      if (status === 'vencida') matchStatus = end < today;
      return matchSearch && matchPlan && matchStatus;
    });
    currentFilteredMemberships = filtered;
    renderTable(filtered);
  }
  searchInput.addEventListener('input', applyFilters);
  filterStatus.addEventListener('change', applyFilters);
  filterPlan.addEventListener('change', applyFilters);
  clearBtn?.addEventListener('click', () => {
    searchInput.value = '';
    filterStatus.value = '';
    filterPlan.value = '';
    applyFilters();
  });
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const filteredData = getCurrentFilteredData();
    const dateStr = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
    const statusSuffixMap = { activa: 'activas', por_vencer: 'por_vencer', vencida: 'vencidas' };
    const suffix = statusSuffixMap[filterStatus.value] ? `_${statusSuffixMap[filterStatus.value]}` : '';
    exportToCSV(filteredData, `membresias${suffix}_${dateStr}.csv`);
  });
  applyFilters();
}
function planMetaFromCatalog(planKey) {
  const found = membershipPlanCatalog.find((p) => p.plan_key === planKey);
  if (found) return found;
  const fallback = PLAN_DEFAULTS[planKey];
  return fallback ? { plan_key: planKey, ...fallback, is_active: true } : null;
}
function hydratePlanPriceInputs() {
  ['mensual', 'trimestral', 'anual'].forEach((planKey) => {
    const input = document.getElementById(`plan-price-${planKey}`);
    if (!input) return;
    const plan = planMetaFromCatalog(planKey);
    input.value = plan?.amount != null ? String(plan.amount) : '';
  });
}
function setupPlanPricing() {
  hydratePlanPriceInputs();
  const btn = document.getElementById('save-plan-prices');
  const feedback = document.getElementById('plan-prices-feedback');
  btn?.addEventListener('click', async () => {
    if (!gymId) return;
    const rows = ['mensual', 'trimestral', 'anual'].map((planKey) => {
      const base = PLAN_DEFAULTS[planKey];
      const amountInput = document.getElementById(`plan-price-${planKey}`);
      const amount = parseFloat(amountInput?.value || base.amount);
      return {
        gym_id: gymId,
        plan_key: planKey,
        label: base.label,
        duration_days: base.duration_days,
        amount: Number.isFinite(amount) ? amount : base.amount,
        is_active: true
      };
    });
    const { data, error } = await window.supabaseClient
      .from('gym_membership_plans')
      .upsert(rows, { onConflict: 'gym_id,plan_key' })
      .select('id, gym_id, plan_key, label, duration_days, amount, is_active');
    if (feedback) {
      if (error) {
        if (error.code === '42501' || /403|forbidden|permission/i.test(error.message || '')) {
          feedback.textContent =
            'No tenés permisos para guardar valores de planes. Verificá tu rol o iniciá sesión nuevamente.';
        } else if (error.code === '23503' && error.message.includes('changed_by')) {
          feedback.textContent =
            'Error de configuración: perfil de usuario no encontrado en la base de datos.';
        } else {
          feedback.textContent = `No se pudieron guardar los valores: ${error.message}`;
        }
        feedback.className = 'text-xs font-bold text-danger';
      } else {
        feedback.textContent = 'Valores de planes guardados.';
        feedback.className = 'text-xs font-bold text-success';
        membershipPlanCatalog = data || membershipPlanCatalog;
      }
      feedback.classList.remove('hidden');
    }
  });
}

function renderRelationshipChart(memberships) {
  const el = document.getElementById('membership-relationship-chart');
  if (!el) return;
  if (!memberships?.length) {
    el.innerHTML = '<p class="text-slate-500">Sin membresías para analizar.</p>';
    return;
  }
  const grouped = new Map();
  memberships.forEach((m) => {
    const objetivo = m.students?.objetivo || 'sin_objetivo';
    const plan = m.plan || 'sin_plan';
    const key = `${objetivo}|${plan}`;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });
  const top = Array.from(grouped.entries())
    .map(([key, total]) => ({ key, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const max = Math.max(...top.map((i) => i.total), 1);
  el.innerHTML = top
    .map(({ key, total }) => {
      const [objetivo, plan] = key.split('|');
      const pct = Math.max(8, Math.round((total / max) * 100));
      return `<div class="rounded-lg border border-border-dark p-2 bg-slate-900/40">
        <div class="flex items-center justify-between mb-1">
          <p class="truncate">${escHtml(objetivo)} · ${escHtml(plan)}</p>
          <span class="font-bold text-primary">${total}</span>
        </div>
        <div class="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div class="h-full bg-primary/80" style="width:${pct}%"></div>
        </div>
      </div>`;
    })
    .join('');
}
function getCurrentFilteredData() {
  return Array.isArray(currentFilteredMemberships) ? currentFilteredMemberships : [];
}
function exportToCSV(data, filename) {
  if (!Array.isArray(data) || data.length === 0) {
    window.tfUtils.toast('No hay datos para exportar con los filtros actuales', 'error');
    return;
  }
  const headers = ['Nombre', 'Email', 'Plan', 'Inicio', 'Vencimiento', 'Monto', 'Método', 'Estado'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows = data.map((m) => {
    const end = new Date(m.end_date);
    const estado = end < today ? 'Vencida' : 'Activa';
    return [
      m.students?.full_name || '',
      m.students?.email || '',
      m.plan || '',
      new Date(m.start_date).toLocaleDateString('es-AR'),
      new Date(m.end_date).toLocaleDateString('es-AR'),
      parseFloat(m.amount || 0).toFixed(2),
      m.payment_method || '',
      estado
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(';');
  });
  const csv = [headers.join(';'), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
// ─── MODAL NUEVA MEMBRESÍA ────────────────────────────────
function setupModal() {
  const backdrop = document.getElementById('modal-membresia-backdrop');
  const closeBtn = document.getElementById('modal-membresia-close');
  const submitBtn = document.getElementById('modal-membresia-submit');
  const errorEl = document.getElementById('modal-membresia-error');
  const planContainer = document.getElementById('plan-buttons-container');
  function renderPlanButtons() {
    if (!planContainer) return;
    const activePlans = membershipPlanCatalog
      .filter((plan) => plan.is_active !== false)
      .sort((a, b) => (a.duration_days || 0) - (b.duration_days || 0));
    if (!activePlans.length) {
      planContainer.innerHTML =
        '<p class="text-xs text-danger col-span-3">No hay planes activos configurados.</p>';
      return;
    }
    planContainer.innerHTML = activePlans
      .map(
        (plan) => `
            <button type="button" data-plan="${plan.plan_key}" data-amount="${plan.amount ?? ''}"
                class="plan-btn border border-slate-800 rounded-xl py-3 text-xs font-bold hover:border-primary transition-all">
                ${escHtml(plan.label || plan.plan_key)}<br>
                <span class="text-slate-500 font-normal">${Number(plan.duration_days || 0)} días</span>
            </button>
        `
      )
      .join('');
  }
  function applyPlanSelection(planKey, amount = null) {
    document
      .querySelectorAll('.plan-btn')
      .forEach((btn) => btn.classList.remove('border-primary', 'text-primary', 'bg-primary/10'));
    const selected = document.querySelector(`.plan-btn[data-plan="${planKey}"]`);
    if (selected) selected.classList.add('border-primary', 'text-primary', 'bg-primary/10');
    document.getElementById('membresia-plan').value = planKey || '';
    const amountInput = document.getElementById('membresia-amount');
    if (amountInput) {
      const parsed = Number(amount ?? selected?.dataset.amount);
      amountInput.value = Number.isFinite(parsed) ? String(parsed) : '';
    }
  }
  async function openModal() {
    window.tfUtils.showModal('modal-nueva-membresia');
    document.getElementById('membresia-start-date').value = new Date().toISOString().split('T')[0];
    const { data: students } = await window.supabaseClient
      .from('students')
      .select('id, full_name')
      .is('deleted_at', null)
      .order('full_name');
    const select = document.getElementById('membresia-student-id');
    select.innerHTML = '<option value="">Seleccioná un alumno...</option>';
    students?.forEach((s) => {
      select.innerHTML += `<option value="${String(s.id ?? '')}">${escHtml(s.full_name || 'Sin nombre')}</option>`;
    });
    await ensurePlanCatalog();
    renderPlanButtons();
    applyPlanSelection('', null);
  }
  function closeModal() {
    window.tfUtils.hideModal('modal-nueva-membresia');
    document.getElementById('membresia-student-id').value = '';
    document.getElementById('membresia-plan').value = '';
    document.getElementById('membresia-amount').value = '';
    document.getElementById('membresia-notes').value = '';
    document
      .querySelectorAll('.plan-btn')
      .forEach((b) => b.classList.remove('border-primary', 'text-primary', 'bg-primary/10'));
    errorEl.classList.add('hidden');
  }
  planContainer?.addEventListener('click', (evt) => {
    const btn = evt.target.closest('.plan-btn');
    if (!btn) return;
    applyPlanSelection(btn.dataset.plan, btn.dataset.amount);
  });
  async function saveMembresia() {
    const studentId = document.getElementById('membresia-student-id').value;
    const plan = document.getElementById('membresia-plan').value;
    const startDate = document.getElementById('membresia-start-date').value;
    const amount = document.getElementById('membresia-amount').value;
    const paymentMethod = document.getElementById('membresia-payment-method').value;
    const notes = document.getElementById('membresia-notes').value.trim();
    if (!studentId || !plan || !startDate || !amount) {
      errorEl.textContent = 'Atleta, plan, fecha y monto son obligatorios.';
      errorEl.classList.remove('hidden');
      return;
    }
    window.tfUtils.setBtnLoading(submitBtn, true, 'Guardando...');
    try {
      const { error } = await window.supabaseClient.from('memberships').insert({
        gym_id: gymId,
        student_id: studentId,
        plan,
        start_date: startDate,
        end_date: startDate, // el trigger lo sobreescribe
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        notes: notes || null
      });
      if (error) throw error;
      window.tfUtils.toast('Membresía registrada correctamente');
      closeModal();
      await loadMemberships();
    } catch (err) {
      errorEl.textContent = 'Error al guardar: ' + err.message;
      errorEl.classList.remove('hidden');
    } finally {
      window.tfUtils.setBtnLoading(submitBtn, false, 'Registrar Membresía');
    }
  }
  document.getElementById('btn-nueva-membresia')?.addEventListener('click', openModal);
  document.getElementById('btn-empty-nueva-membresia')?.addEventListener('click', openModal);
  backdrop?.addEventListener('click', closeModal);
  closeBtn?.addEventListener('click', closeModal);
  submitBtn?.addEventListener('click', saveMembresia);
}
// ─── ARRANCAR ─────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMembershipList);
} else {
  initMembershipList();
}
