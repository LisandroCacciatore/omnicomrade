/**
 * admin-dashboard.js
 * TechFitness — Dashboard del Administrador
 */

await import('./auth-guard.js');

// ─── DOM refs ─────────────────────────────────────────────
const recentStudentsTable = document.getElementById('recent-students-table');
const userNameEl = document.getElementById('user-name');

function escHtml(s) {
  return window.tfUtils?.escHtml?.(s) ?? (s ? String(s) : '');
}
function toast(m, t) {
  window.tfUtils?.toast?.(m, t);
}

let assignProgramModal = null;
let gymId = null;
let authUserId = null;
let alertStudents = [];
const alertSelectedStudentIds = new Set();
let gymMembershipPlans = [];

// ─── INIT ─────────────────────────────────────────────────
async function initDashboard() {
  const session = await window.authGuard(['gim_admin']);
  if (!session) return;

  // Resolve gym_id with fallbacks
  gymId =
    session.user.app_metadata?.gym_id ||
    session.user.raw_app_meta_data?.gym_id ||
    window.gymId ||
    localStorage.getItem('gym_id');

  if (!gymId && window.supabaseClient) {
    const { data: profile } = await window.supabaseClient
      .from('profiles')
      .select('gym_id')
      .eq('id', session.user.id)
      .maybeSingle();
    if (profile?.gym_id) {
      gymId = profile.gym_id;
      localStorage.setItem('gym_id', gymId);
    }
  }

  if (!gymId) {
    console.error('❌ No se pudo resolver gym_id');
    toast('Error de configuración: gym_id no disponible', 'error');
    return;
  }

  authUserId = session.user.id;
  window.gymId = gymId;

  // VERIFICAR ONBOARDING (US-ONB)
  const { data: gym } = await window.supabaseClient
    .from('gyms')
    .select('onboarding_completed')
    .eq('id', gymId)
    .single();

  if (gym && !gym.onboarding_completed) {
    window.location.href = 'onboarding.html';
    return;
  }

  userNameEl.textContent = session.user.user_metadata?.full_name || session.user.email;

  // Skeleton
  recentStudentsTable.innerHTML = `
        <tr class="animate-pulse"><td class="px-6 py-4"><div class="h-4 w-32 bg-slate-800 rounded"></div></td><td class="px-6 py-4"><div class="h-4 w-12 bg-slate-800 rounded"></div></td><td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td><td class="px-6 py-4"><div class="h-4 w-8 bg-slate-800 rounded"></div></td></tr>
        <tr class="animate-pulse"><td class="px-6 py-4"><div class="h-4 w-24 bg-slate-800 rounded"></div></td><td class="px-6 py-4"><div class="h-4 w-12 bg-slate-800 rounded"></div></td><td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td><td class="px-6 py-4"><div class="h-4 w-8 bg-slate-800 rounded"></div></td></tr>`;

  await Promise.all([loadKPIs(), loadRecentStudents()]);
  window.loadKPIs = loadKPIs;
  window.loadRecentStudents = loadRecentStudents;
  setupQuickActions();
  setupModals();
  setupMembershipModal();
  setupDashboardButtons();
}

window.addEventListener('onboarding:completed', async () => {
  await Promise.all([loadKPIs(), loadRecentStudents()]);
});

// ─── KPIs ─────────────────────────────────────────────────
async function loadKPIs() {
  try {
    const db = window.supabaseClient;
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const [{ count: activeStudents }, { count: expiringSoon }, { data: monthIncomeData }] =
      await Promise.all([
        db
          .from('students')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null)
          .eq('membership_status', 'activa'),
        db
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .gte('end_date', today.toISOString().split('T')[0])
          .lte('end_date', sevenDaysFromNow),
        db
          .from('memberships')
          .select('amount')
          .gte('start_date', startOfMonth)
          .lte('start_date', endOfMonth)
      ]);

    const monthlyIncome = (monthIncomeData || []).reduce((sum, m) => sum + (m.amount || 0), 0);

    const kpiActiveStudents = document.getElementById('kpi-active-students');
    const kpiExpiringSoon = document.getElementById('kpi-expiring-soon');
    const kpiMonthlyIncome = document.getElementById('kpi-monthly-income');

    if (kpiActiveStudents) kpiActiveStudents.textContent = activeStudents || 0;
    if (kpiExpiringSoon) kpiExpiringSoon.textContent = expiringSoon || 0;
    if (kpiMonthlyIncome)
      kpiMonthlyIncome.textContent = '$' + (monthlyIncome || 0).toLocaleString('es-AR');
  } catch (err) {
    console.error('Error loading KPIs:', err);
  }
}

// ─── ALUMNOS RECIENTES ────────────────────────────────────
async function loadRecentStudents() {
  try {
    const { data: students, error } = await window.supabaseClient
      .from('students')
      .select('id, full_name, email, membership_status, created_at')
      .eq('gym_id', gymId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    if (!students?.length) {
      recentStudentsTable.innerHTML = `<tr><td colspan="4" class="px-6 py-12 text-center text-slate-500 text-sm">No hay atletas registrados todavía.</td></tr>`;
      return;
    }

    recentStudentsTable.innerHTML = students
      .map(
        (s) => `
            <tr class="hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4">
                    <div class="flex flex-col">
                        <span class="font-bold text-sm">${escHtml(s.full_name || 'Sin nombre')}</span>
                        <span class="text-[10px] text-slate-500">${escHtml(s.email || '—')}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusClass(s.membership_status)}">
                        ${escHtml(s.membership_status || 'pendiente')}
                    </span>
                </td>
                <td class="px-6 py-4 text-xs text-slate-400">
                    ${new Date(s.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </td>
                <td class="px-6 py-4">
                    <a href="student-profile.html?id=${s.id}"
                        class="size-8 rounded-lg border border-border-dark flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-primary transition-colors"
                        title="Ver perfil">
                        <span class="material-symbols-rounded text-[16px]">visibility</span>
                    </a>
                </td>
            </tr>`
      )
      .join('');
  } catch (err) {
    console.error('Error loading students:', err);
    recentStudentsTable.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-danger text-xs">Error al cargar datos</td></tr>`;
  }
}

function getStatusClass(status) {
  return (
    {
      activa: 'bg-success/10 text-success',
      vencida: 'bg-danger/10 text-danger',
      suspendida: 'bg-warning/10 text-warning',
      pendiente: 'bg-slate-800 text-slate-400'
    }[status] || 'bg-slate-800 text-slate-400'
  );
}

// ─── ACCIONES RÁPIDAS ─────────────────────────────────────
function setupQuickActions() {
  const db = window.supabaseClient;

  if (window.ProgramAssignModal && !assignProgramModal) {
    assignProgramModal = new window.ProgramAssignModal({
      gymId,
      db,
      studentFilter: { membership_status: 'activa' },
      onSuccess: async () => {
        toast('Programa asignado con éxito');
        await Promise.all([loadKPIs(), loadRecentStudents()]);
      }
    });
  }

  document.querySelector('[data-action="asignar-programa"]')?.addEventListener('click', () => {
    assignProgramModal?.open();
  });

  document.querySelector('[data-action="nueva-membresia"]')?.addEventListener('click', () => {
    if (typeof window.openModalMembresia === 'function') window.openModalMembresia();
    else toast('No se pudo abrir el modal de membresía', 'error');
  });

  document.getElementById('btn-enviar-alerta')?.addEventListener('click', openAlertModal);
}

// ─── DASHBOARD BUTTONS ────────────────────────────────────
function setupDashboardButtons() {
  document.getElementById('btn-nuevo-alumno')?.addEventListener('click', () => {
    if (window.onboardingWizard?.open) {
      window.onboardingWizard.open();
    } else {
      console.error('❌ onboardingWizard no disponible');
      toast('Error: el wizard de onboarding no está disponible', 'error');
    }
  });

  document.getElementById('btn-nueva-membresia')?.addEventListener('click', () => {
    if (typeof window.openModalMembresia === 'function') window.openModalMembresia();
    else toast('No se pudo abrir el modal de membresía', 'error');
  });
}

// ─── ALERT MODAL ──────────────────────────────────────────
async function loadStudentsForAlerts() {
  const { data, error } = await window.supabaseClient
    .from('students')
    .select('id, full_name, email')
    .eq('gym_id', gymId)
    .is('deleted_at', null)
    .order('full_name', { ascending: true });

  if (error) throw error;
  alertStudents = data || [];
}

function renderSingleStudentOptions() {
  const select = document.getElementById('alert-student-single');
  if (!select) return;
  if (!alertStudents.length) {
    select.innerHTML = '<option value="">No hay alumnos disponibles</option>';
    return;
  }
  select.innerHTML = [
    '<option value="">Seleccioná un alumno</option>',
    ...alertStudents.map(
      (student) =>
        `<option value="${student.id}">${escHtml(student.full_name || 'Sin nombre')} · ${escHtml(student.email || 'sin email')}</option>`
    )
  ].join('');
}

function renderMultiStudentOptions(query = '') {
  const listEl = document.getElementById('alert-student-multi-list');
  if (!listEl) return;
  const term = query.trim().toLowerCase();
  const filtered = !term
    ? alertStudents
    : alertStudents.filter((student) =>
        `${student.full_name || ''} ${student.email || ''}`.toLowerCase().includes(term)
      );

  if (!filtered.length) {
    listEl.innerHTML = '<p class="text-xs text-slate-500 p-2">No se encontraron alumnos.</p>';
    return;
  }

  listEl.innerHTML = filtered
    .map((student) => {
      const checked = alertSelectedStudentIds.has(student.id) ? 'checked' : '';
      return `
        <label class="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-800 cursor-pointer">
          <input type="checkbox" class="accent-primary" data-alert-student-id="${student.id}" ${checked} />
          <span class="text-xs text-slate-200">${escHtml(student.full_name || 'Sin nombre')}</span>
          <span class="text-[10px] text-slate-500">${escHtml(student.email || 'sin email')}</span>
        </label>
      `;
    })
    .join('');

  listEl.querySelectorAll('input[type="checkbox"][data-alert-student-id]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const studentId = e.target.dataset.alertStudentId;
      if (!studentId) return;
      if (e.target.checked) alertSelectedStudentIds.add(studentId);
      else alertSelectedStudentIds.delete(studentId);
    });
  });
}

function setAlertModalOpen(isOpen) {
  const modal = document.getElementById('modal-enviar-aviso');
  if (!modal) return;
  modal.classList.toggle('hidden', !isOpen);
  modal.classList.toggle('flex', isOpen);
}

function setAlertMode(mode) {
  const singleWrap = document.getElementById('alert-single-wrap');
  const multiWrap = document.getElementById('alert-multiple-wrap');
  if (!singleWrap || !multiWrap) return;
  singleWrap.classList.toggle('hidden', mode !== 'single');
  multiWrap.classList.toggle('hidden', mode !== 'multiple');
}

function resetAlertModal() {
  const form = document.getElementById('form-enviar-aviso');
  const searchInput = document.getElementById('alert-student-search');
  const typeSelect = document.getElementById('alert-target-type');
  const errorEl = document.getElementById('alert-modal-error');
  form?.reset();
  if (typeSelect) typeSelect.value = 'single';
  if (searchInput) searchInput.value = '';
  errorEl?.classList.add('hidden');
  errorEl.textContent = '';
  alertSelectedStudentIds.clear();
  setAlertMode('single');
}

async function openAlertModal() {
  const errorEl = document.getElementById('alert-modal-error');
  try {
    await loadStudentsForAlerts();
    renderSingleStudentOptions();
    renderMultiStudentOptions();
    resetAlertModal();
    setAlertModalOpen(true);
  } catch (err) {
    console.error('Error loading students for alert modal:', err);
    if (errorEl) {
      errorEl.textContent = 'No se pudieron cargar los alumnos para enviar avisos.';
      errorEl.classList.remove('hidden');
    }
    toast('No se pudo abrir el modal de avisos', 'error');
  }
}

function closeAlertModal() {
  resetAlertModal();
  setAlertModalOpen(false);
}

async function handleAlertSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById('alert-modal-error');
  const submitBtn = document.getElementById('submit-modal-aviso');
  const targetType = document.getElementById('alert-target-type')?.value || 'single';
  const singleStudentId = document.getElementById('alert-student-single')?.value || '';
  const message = (document.getElementById('alert-message')?.value || '').trim();

  const recipientIds =
    targetType === 'single'
      ? singleStudentId
        ? [singleStudentId]
        : []
      : Array.from(alertSelectedStudentIds);

  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }
  if (!recipientIds.length) {
    if (errorEl) {
      errorEl.textContent = 'Seleccioná al menos un alumno.';
      errorEl.classList.remove('hidden');
    }
    return;
  }
  if (!message) {
    if (errorEl) {
      errorEl.textContent = 'El mensaje es obligatorio.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  window.tfUtils.setBtnLoading(submitBtn, true, 'Enviando...');
  try {
    const { error } = await window.supabaseClient.from('gym_messages').insert({
      gym_id: gymId,
      sender_profile_id: authUserId,
      recipient_student_ids: recipientIds,
      recipient_count: recipientIds.length,
      target_type: targetType,
      message
    });

    if (error) throw error;

    closeAlertModal();
    toast(`Aviso enviado a ${recipientIds.length} alumno${recipientIds.length === 1 ? '' : 's'}`);
  } catch (err) {
    console.error('Error sending alert message:', err);
    if (errorEl) {
      errorEl.textContent =
        err.code === '42P01'
          ? 'La tabla de mensajería no existe todavía. Aplicá las migraciones de Supabase.'
          : `No se pudo enviar el aviso: ${err.message || 'error desconocido'}`;
      errorEl.classList.remove('hidden');
    }
  } finally {
    window.tfUtils.setBtnLoading(submitBtn, false, 'Enviar aviso');
  }
}

// ─── MODAL NUEVO ALUMNO ───────────────────────────────────
function setupModals() {
  const alertTypeEl = document.getElementById('alert-target-type');
  const alertSearchEl = document.getElementById('alert-student-search');
  const selectAllBtn = document.getElementById('alert-select-all');
  const alertForm = document.getElementById('form-enviar-aviso');
  const alertModal = document.getElementById('modal-enviar-aviso');

  document.getElementById('close-modal-aviso')?.addEventListener('click', closeAlertModal);
  document.getElementById('cancel-modal-aviso')?.addEventListener('click', closeAlertModal);
  alertModal?.addEventListener('click', (evt) => {
    if (evt.target === alertModal) closeAlertModal();
  });
  alertTypeEl?.addEventListener('change', (evt) => setAlertMode(evt.target.value));
  alertSearchEl?.addEventListener('input', (evt) => renderMultiStudentOptions(evt.target.value));
  selectAllBtn?.addEventListener('click', () => {
    alertStudents.forEach((student) => alertSelectedStudentIds.add(student.id));
    renderMultiStudentOptions(alertSearchEl?.value || '');
  });
  alertForm?.addEventListener('submit', handleAlertSubmit);
}

window.openNewAtleta = () => window.onboardingWizard.open();

// ─── MODAL NUEVA MEMBRESÍA ────────────────────────────────
async function loadGymMembershipPlans() {
  const { data, error } = await window.supabaseClient
    .from('gym_membership_plans')
    .select('plan_key, label, duration_days, amount, is_active')
    .eq('gym_id', gymId)
    .eq('is_active', true)
    .order('duration_days', { ascending: true });
  if (error) throw error;
  gymMembershipPlans = data || [];
}

function renderGymMembershipPlanButtons() {
  const container = document.getElementById('membresia-plan-buttons');
  if (!container) return;
  if (!gymMembershipPlans.length) {
    container.innerHTML =
      '<p class="text-xs text-danger col-span-3">No hay planes creados para este gimnasio.</p>';
    return;
  }
  container.innerHTML = gymMembershipPlans
    .map(
      (plan) => `
      <button type="button" data-plan="${plan.plan_key}" data-amount="${plan.amount ?? ''}"
        class="plan-btn border border-slate-800 rounded-xl py-3 text-xs font-bold hover:border-primary transition-all">
        ${escHtml(plan.label || plan.plan_key)}<br>
        <span class="text-slate-500 font-normal">${Number(plan.duration_days || 0)} días</span>
      </button>`
    )
    .join('');
}

function selectGymMembershipPlan(planKey, amount = null) {
  document
    .querySelectorAll('#membresia-plan-buttons .plan-btn')
    .forEach((b) => b.classList.remove('border-primary', 'text-primary', 'bg-primary/10'));
  const selectedBtn = document.querySelector(
    `#membresia-plan-buttons .plan-btn[data-plan="${planKey}"]`
  );
  if (selectedBtn) selectedBtn.classList.add('border-primary', 'text-primary', 'bg-primary/10');
  document.getElementById('membresia-plan').value = planKey || '';
  const amountInput = document.getElementById('membresia-amount');
  const parsed = Number(amount ?? selectedBtn?.dataset.amount);
  if (amountInput) amountInput.value = Number.isFinite(parsed) ? String(parsed) : '';
}

window.openModalMembresia = async () => {
  document.getElementById('modal-nueva-membresia').classList.add('open');
  document.getElementById('membresia-start-date').value = new Date().toISOString().split('T')[0];

  const { data: students } = await window.supabaseClient
    .from('students')
    .select('id, full_name')
    .eq('gym_id', gymId)
    .eq('membership_status', 'activa')
    .is('deleted_at', null)
    .order('full_name');

  const select = document.getElementById('membresia-student-id');
  select.innerHTML = '<option value="">Seleccioná un alumno...</option>';
  (students || []).forEach((s) => {
    select.innerHTML += `<option value="${s.id}">${escHtml(s.full_name)}</option>`;
  });

  try {
    await loadGymMembershipPlans();
    renderGymMembershipPlanButtons();
    selectGymMembershipPlan('', null);
  } catch (err) {
    toast('No se pudieron cargar los planes de membresía', 'error');
  }
};

window.closeModalMembresia = () => {
  document.getElementById('modal-nueva-membresia').classList.remove('open');
  document.getElementById('membresia-student-id').value = '';
  document.getElementById('membresia-plan').value = '';
  document.getElementById('membresia-amount').value = '';
  document.getElementById('membresia-notes').value = '';
  document
    .querySelectorAll('.plan-btn')
    .forEach((b) => b.classList.remove('border-primary', 'text-primary', 'bg-primary/10'));
  document.getElementById('modal-membresia-error')?.classList.add('hidden');
};

async function saveMembresia() {
  const studentId = document.getElementById('membresia-student-id').value;
  const plan = document.getElementById('membresia-plan').value;
  const startDate = document.getElementById('membresia-start-date').value;
  const amount = document.getElementById('membresia-amount').value;
  const paymentMethod = document.getElementById('membresia-payment-method').value;
  const notes = document.getElementById('membresia-notes').value.trim();
  const errorEl = document.getElementById('modal-membresia-error');
  const submitBtn = document.getElementById('modal-membresia-submit');

  if (!studentId || !plan || !startDate || !amount) {
    if (errorEl) {
      errorEl.textContent = 'Atleta, plan, fecha y monto son obligatorios.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  window.tfUtils.setBtnLoading(submitBtn, true, 'Guardando...');
  try {
    const { error } = await window.supabaseClient.from('memberships').insert({
      gym_id: gymId,
      student_id: studentId,
      plan,
      start_date: startDate,
      end_date: startDate,
      amount: parseFloat(amount),
      payment_method: paymentMethod,
      notes: notes || null
    });
    if (error) throw error;
    toast('Membresía registrada');
    window.closeModalMembresia();
    await Promise.all([loadKPIs(), loadRecentStudents()]);
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = 'Error: ' + err.message;
      errorEl.classList.remove('hidden');
    }
  } finally {
    window.tfUtils.setBtnLoading(submitBtn, false);
  }
}

function setupMembershipModal() {
  document
    .getElementById('modal-membresia-backdrop')
    ?.addEventListener('click', window.closeModalMembresia);
  document
    .getElementById('modal-membresia-close')
    ?.addEventListener('click', window.closeModalMembresia);
  document.getElementById('modal-membresia-submit')?.addEventListener('click', saveMembresia);

  document.getElementById('membresia-plan-buttons')?.addEventListener('click', (evt) => {
    const btn = evt.target.closest('.plan-btn');
    if (!btn) return;
    selectGymMembershipPlan(btn.dataset.plan, btn.dataset.amount);
  });
}

// ─── ARRANCAR ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initDashboard);
