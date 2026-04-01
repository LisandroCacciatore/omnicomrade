/**
 * admin-dashboard.js
 * TechFitness — Dashboard del Administrador
 */

// ─── DOM refs ─────────────────────────────────────────────
const kpiTotalStudents = document.getElementById('kpi-total-students');
const kpiActiveMemberships = document.getElementById('kpi-active-memberships');
const kpiExpiringSoon = document.getElementById('kpi-expiring-soon');
const kpiExpired = document.getElementById('kpi-expired');
const recentStudentsTable = document.getElementById('recent-students-table');
const userNameEl = document.getElementById('user-name');
const { escHtml, toast } = window.tfUtils;

let assignProgramModal = null;
let gymId = null;

// ─── INIT ─────────────────────────────────────────────────
async function initDashboard() {
  const session = await window.authGuard(['gim_admin']);
  if (!session) return;

  gymId = session.user.app_metadata.gym_id;
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
}

window.addEventListener('onboarding:completed', async () => {
  await Promise.all([loadKPIs(), loadRecentStudents()]);
});

// ─── KPIs ─────────────────────────────────────────────────
async function loadKPIs() {
  try {
    const db = window.supabaseClient;

    const [
      { count: totalCount },
      { count: activeCount },
      { count: expiredCount },
      { count: expiringSoonCount }
    ] = await Promise.all([
      db.from('students').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      db
        .from('students')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('membership_status', 'activa'),
      db
        .from('students')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('membership_status', 'vencida'),
      db
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .gte('end_date', new Date().toISOString().split('T')[0])
        .lte('end_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    ]);

    kpiTotalStudents.textContent = totalCount || 0;
    kpiActiveMemberships.textContent = activeCount || 0;
    kpiExpiringSoon.textContent = expiringSoonCount || 0;
    kpiExpired.textContent = expiredCount || 0;

    // Porcentajes calculados sobre total de alumnos
    const total = totalCount || 1;
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${val}%`;
    };
    set('pct-active-memberships', Math.round((activeCount / total) * 100));
    set('pct-expiring-soon', Math.round((expiringSoonCount / total) * 100));
    set('pct-expired', Math.round((expiredCount / total) * 100));
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
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    if (!students?.length) {
      recentStudentsTable.innerHTML = `<tr><td colspan="4" class="px-6 py-12 text-center text-slate-500 text-sm">No hay alumnos registrados todavía.</td></tr>`;
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

  // Asignar programa — solo alumnos con membresía activa
  if (window.ProgramAssignModal && !assignProgramModal) {
    assignProgramModal = new window.ProgramAssignModal({
      gymId,
      db,
      studentFilter: { membership_status: 'activa' }, // solo activos
      onSuccess: async () => {
        toast('Programa asignado con éxito');
        await Promise.all([loadKPIs(), loadRecentStudents()]);
      }
    });
  }

  document.querySelector('[data-action="asignar-programa"]')?.addEventListener('click', () => {
    assignProgramModal?.open();
  });

  document
    .querySelector('[data-action="nueva-membresia"]')
    ?.addEventListener('click', window.openModalMembresia);

  // Enviar alerta — Aviso masivo
  document.getElementById('btn-enviar-alerta')?.addEventListener('click', () => {
    const msg = prompt('Ingresá el mensaje para el aviso masivo:');
    if (msg) {
      toast('Aviso enviado correctamente');
    }
  });
}

// ─── MODAL NUEVO ALUMNO ───────────────────────────────────
function setupModals() {
  window._validateName = window.tfUtils.setupValidation(
    document.getElementById('input-full-name'),
    document.getElementById('error-input-name'),
    (val) => (!val.trim() ? 'El nombre es requerido.' : null)
  );
  window._validateEmail = window.tfUtils.setupValidation(
    document.getElementById('input-email'),
    document.getElementById('error-input-email'),
    (val) => {
      if (!val) return null;
      return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? 'Email inválido.' : null;
    }
  );
  window._validateBirthDate = window.tfUtils.setupValidation(
    document.getElementById('input-birth-date'),
    document.getElementById('error-input-birth'),
    (val) => {
      if (!val) return null;
      const age = Math.floor((Date.now() - new Date(val)) / (365.25 * 24 * 60 * 60 * 1000));
      return age < 18 ? 'Debe ser mayor de 18 años.' : null;
    }
  );
}

window.openNewAlumno = () => window.onboardingWizard.open();

window.closeModalAlumno = () => {
  document.getElementById('modal-nuevo-alumno').classList.remove('open');
  ['input-full-name', 'input-email', 'input-phone', 'input-birth-date'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = '';
      el.classList.remove('input-error');
    }
  });
  ['error-input-name', 'error-input-email', 'error-input-birth', 'modal-error'].forEach((id) =>
    document.getElementById(id)?.classList.add('hidden')
  );
};

async function saveNewStudent() {
  const isNameValid = window._validateName?.() ?? true;
  const isEmailValid = window._validateEmail?.() ?? true;
  const isBirthValid = window._validateBirthDate?.() ?? true;

  if (!isNameValid || !isEmailValid || !isBirthValid) {
    if (!isNameValid) document.getElementById('input-full-name').focus();
    else if (!isEmailValid) document.getElementById('input-email').focus();
    else document.getElementById('input-birth-date').focus();
    return;
  }

  const submitBtn = document.getElementById('modal-submit-btn');
  window.tfUtils.setBtnLoading(submitBtn, true, 'Guardando...');

  try {
    const { error } = await window.supabaseClient.from('students').insert({
      gym_id: gymId,
      full_name: document.getElementById('input-full-name').value.trim(),
      email: document.getElementById('input-email').value.trim() || null,
      phone: document.getElementById('input-phone').value.trim() || null,
      birth_date: document.getElementById('input-birth-date').value || null,
      membership_status: 'pendiente'
    });

    if (error) throw error;

    toast('Alumno creado con éxito');
    window.closeModalAlumno();
    await Promise.all([loadKPIs(), loadRecentStudents()]);
  } catch (err) {
    const modalError = document.getElementById('modal-error');
    if (modalError) {
      modalError.textContent = 'Error: ' + err.message;
      modalError.classList.remove('hidden');
    }
  } finally {
    window.tfUtils.setBtnLoading(submitBtn, false);
  }
}

document.getElementById('btn-nuevo-alumno')?.addEventListener('click', window.openNewAlumno);
document.getElementById('modal-close-btn')?.addEventListener('click', window.closeModalAlumno);
document.getElementById('modal-backdrop')?.addEventListener('click', window.closeModalAlumno);
document.getElementById('modal-submit-btn')?.addEventListener('click', saveNewStudent);

// ─── MODAL NUEVA MEMBRESÍA ────────────────────────────────
window.openModalMembresia = async () => {
  document.getElementById('modal-nueva-membresia').classList.add('open');
  document.getElementById('membresia-start-date').value = new Date().toISOString().split('T')[0];

  // Solo alumnos con membresía activa
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

document.querySelectorAll('.plan-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document
      .querySelectorAll('.plan-btn')
      .forEach((b) => b.classList.remove('border-primary', 'text-primary', 'bg-primary/10'));
    btn.classList.add('border-primary', 'text-primary', 'bg-primary/10');
    document.getElementById('membresia-plan').value = btn.dataset.plan;
  });
});

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
      errorEl.textContent = 'Alumno, plan, fecha y monto son obligatorios.';
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

document
  .getElementById('modal-membresia-backdrop')
  ?.addEventListener('click', window.closeModalMembresia);
document
  .getElementById('modal-membresia-close')
  ?.addEventListener('click', window.closeModalMembresia);
document.getElementById('modal-membresia-submit')?.addEventListener('click', saveMembresia);

// ─── ARRANCAR ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initDashboard);
