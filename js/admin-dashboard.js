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
let painSummaryByZone = new Map();
let latestPainZoneLogs = [];
let selectedPainZone = '';
let showSensitiveWellbeingNotes = true;

// ─── INIT ─────────────────────────────────────────────────
async function initDashboard() {
  const ctx = await window.authGuard(['gim_admin']);
  if (!ctx) return;
  const { gymId: ctxGymId, userId, email } = ctx;
  gymId = ctxGymId;

  if (!gymId) {
    console.error('❌ No se pudo resolver gym_id');
    toast('Error de configuración: gym_id no disponible', 'error');
    return;
  }

  authUserId = userId;
  window.gymId = gymId;

  const session = await window.tfSession.get();
  const displayName = session?.user?.user_metadata?.full_name || email || '';
  userNameEl.textContent = displayName;

  // Skeleton
  recentStudentsTable.innerHTML = `
        <tr class="animate-pulse"><td class="px-6 py-4"><div class="h-4 w-32 bg-slate-800 rounded"></div></td><td class="px-6 py-4"><div class="h-4 w-12 bg-slate-800 rounded"></div></td><td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td><td class="px-6 py-4"><div class="h-4 w-8 bg-slate-800 rounded"></div></td></tr>
        <tr class="animate-pulse"><td class="px-6 py-4"><div class="h-4 w-24 bg-slate-800 rounded"></div></td><td class="px-6 py-4"><div class="h-4 w-12 bg-slate-800 rounded"></div></td><td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td><td class="px-6 py-4"><div class="h-4 w-8 bg-slate-800 rounded"></div></td></tr>`;

  await Promise.all([loadDashboardIndicators(), loadRecentStudents(), initPainMap()]);
  window.loadDashboardIndicators = loadDashboardIndicators;
  window.loadRecentStudents = loadRecentStudents;
  setupQuickActions();
  setupModals();
  setupMembershipModal();
  setupDashboardButtons();
  runSchemaHealthCheck();
}

window.addEventListener('onboarding:completed', async () => {
  await Promise.all([loadDashboardIndicators(), loadRecentStudents()]);
});

// ─── KPIs ─────────────────────────────────────────────────

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '$0';
  return (
    '$' +
    Number(value).toLocaleString('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
  );
}

async function loadDashboardIndicators() {
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
          .eq('gym_id', gymId)
          .is('deleted_at', null)
          .eq('membership_status', 'activa'),
        db
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .gte('end_date', today.toISOString().split('T')[0])
          .lte('end_date', sevenDaysFromNow),
        db
          .from('memberships')
          .select('amount')
          .eq('gym_id', gymId)
          .gte('start_date', startOfMonth)
          .lte('start_date', endOfMonth)
      ]);

    const monthlyIncome = (monthIncomeData || []).reduce((sum, m) => sum + (m.amount || 0), 0);

    const kpiActiveStudents = document.getElementById('kpi-active-students');
    const kpiExpiringSoon = document.getElementById('kpi-expiring-soon');
    const kpiMonthlyIncome =
      document.getElementById('kpi-ingresos-mes') || document.getElementById('kpi-monthly-income');

    if (kpiActiveStudents) kpiActiveStudents.textContent = activeStudents || 0;
    if (kpiExpiringSoon) kpiExpiringSoon.textContent = expiringSoon || 0;
    if (kpiMonthlyIncome) kpiMonthlyIncome.textContent = formatCurrency(monthlyIncome || 0);
  } catch (err) {
    console.error('Error loading KPIs:', err);
    toast('Error al cargar los indicadores del dashboard', 'error');
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
    toast('Error al cargar los atletas recientes', 'error');
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

  document
    .querySelector('[data-action="asignar-programa"]')
    ?.addEventListener('click', async () => {
      const btn = document.querySelector('[data-action="asignar-programa"]');
      btn?.classList.add('opacity-70');
      // Lazy init: esperar a que ProgramAssignModal esté disponible
      if (!window.ProgramAssignModal) {
        console.warn('⏳ Esperando a que ProgramAssignModal cargue...');
        let retries = 0;
        while (!window.ProgramAssignModal && retries < 20) {
          await new Promise((r) => setTimeout(r, 100));
          retries++;
        }
        if (!window.ProgramAssignModal) {
          toast('Error: no se pudo cargar el módulo de asignación', 'error');
          btn?.classList.remove('opacity-70');
          return;
        }
      }

      if (!assignProgramModal) {
        assignProgramModal = new window.ProgramAssignModal({
          gymId,
          db,
          studentFilter: { membership_status: 'activa' },
          onSuccess: async () => {
            toast('Programa asignado con éxito');
            await Promise.all([loadDashboardIndicators(), loadRecentStudents()]);
          }
        });
      }
      try {
        assignProgramModal.open();
      } catch (err) {
        console.error('Error opening assign program flow:', err);
        toast('No se pudo abrir el flujo de asignación de programa', 'error');
      } finally {
        btn?.classList.remove('opacity-70');
      }
    });

  document.querySelector('[data-action="nueva-membresia"]')?.addEventListener('click', () => {
    window.openModalMembresia();
  });

  document.getElementById('btn-enviar-alerta')?.addEventListener('click', openAlertModal);
}

// ─── DASHBOARD BUTTONS ────────────────────────────────────
function setupDashboardButtons() {
  window.StudentCreateModal?.init({
    gymId,
    db: window.supabaseClient,
    onSuccess: async () => {
      await Promise.all([loadDashboardIndicators(), loadRecentStudents()]);
    }
  });

  document.getElementById('btn-nuevo-alumno')?.addEventListener('click', () => {
    if (!window.StudentCreateModal?.open) {
      toast('No se pudo abrir el modal de alta', 'error');
      return;
    }
    window.StudentCreateModal.open();
  });
}

async function runSchemaHealthCheck() {
  try {
    const { error } = await window.supabaseClient
      .from('exercises')
      .select('id, technical_cue, safety_level')
      .limit(1);
    if (!error) return;

    const isSchemaMismatch = error.code === '42703';
    if (!isSchemaMismatch) return;
    toast('Error de sincronización: contacte a soporte.', 'error');
    console.warn('Schema health-check failed for exercises columns:', error.message);
  } catch (err) {
    console.warn('Schema health-check error:', err?.message || err);
  }
}

async function initPainMap() {
  const statusEl = document.getElementById('pain-map-status');
  const zoneListEl = document.getElementById('pain-zone-risk-list');
  const sensitiveNotesToggle = document.getElementById('pain-show-sensitive-notes');
  if (!statusEl || !zoneListEl) return;

  if (sensitiveNotesToggle) {
    sensitiveNotesToggle.checked = true;
    sensitiveNotesToggle.addEventListener('change', (evt) => {
      showSensitiveWellbeingNotes = !!evt.target.checked;
      if (selectedPainZone) renderPainZoneDetailList(selectedPainZone, latestPainZoneLogs);
    });
  }

  statusEl.textContent = 'Cargando…';
  zoneListEl.innerHTML = '<p class="text-slate-500 text-xs">Analizando reportes…</p>';

  try {
    const { data, error } = await window.supabaseClient
      .from('v_gym_pain_summary')
      .select('pain_zone, reports, students_affected, avg_pain, intensity_pct')
      .eq('gym_id', gymId)
      .order('intensity_pct', { ascending: false });
    if (error) throw error;

    renderAnatomicalMap(data || []);
    await renderPriorityAttention(data || []);
    statusEl.textContent = 'Actualizado';
  } catch (err) {
    console.error('Error loading pain heatmap:', err);
    statusEl.textContent = 'Sin datos';
    zoneListEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-6 text-center">
        <span class="material-symbols-rounded text-slate-700 text-3xl mb-2">warning</span>
        <p class="text-slate-500 text-xs">No pudimos cargar el mapa de dolor para este gimnasio.</p>
      </div>`;
    document.getElementById('pain-high-risk-list').innerHTML =
      '<li class="text-slate-500">Sin información disponible.</li>';
    document.getElementById('pain-zone-detail-list').innerHTML =
      '<li class="text-slate-500">Seleccioná una zona para ver detalle.</li>';
  }
}

function renderAnatomicalMap(rows) {
  const statusEl = document.getElementById('pain-map-status');
  const zoneListEl = document.getElementById('pain-zone-risk-list');
  painSummaryByZone = new Map();

  (rows || []).forEach((row) => {
    const zone = window.AthleteInsights.normalizePainZone(row.pain_zone);
    if (!zone) return;
    const current = painSummaryByZone.get(zone);
    if (!current || Number(row.intensity_pct || 0) > Number(current.intensity_pct || 0)) {
      painSummaryByZone.set(zone, { ...row, zone });
    }
  });

  const sortedZones = Array.from(painSummaryByZone.values()).sort(
    (a, b) => Number(b.intensity_pct || 0) - Number(a.intensity_pct || 0)
  );
  renderPainHeatChart(sortedZones);

  const totalReports = sortedZones.reduce((sum, z) => sum + Number(z.reports || 0), 0);
  const badgeEl = document.getElementById('pain-report-badge');
  if (badgeEl && totalReports > 0) {
    badgeEl.textContent = `${totalReports} reportes`;
    badgeEl.classList.remove('hidden');
  } else if (badgeEl) {
    badgeEl.classList.add('hidden');
  }

  if (!sortedZones.length) {
    zoneListEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-6 text-center">
        <span class="material-symbols-rounded text-slate-700 text-3xl mb-2">info</span>
        <p class="text-slate-500 text-xs">Aún no hay reportes suficientes (dolor ≥3) en los últimos 30 días.</p>
      </div>`;
    document.getElementById('pain-zone-detail-list').innerHTML =
      '<li class="text-slate-500">Cuando haya zonas en riesgo, aparecerán aquí.</li>';
    if (statusEl) statusEl.textContent = 'Sin alertas';
  } else {
    zoneListEl.innerHTML = sortedZones
      .map((row) => {
        const severity = window.AthleteInsights.getPainSeverity(Number(row.intensity_pct || 0));
        const badgeClass =
          severity === 'critical'
            ? 'text-danger bg-danger/10'
            : severity === 'high'
              ? 'text-warning bg-warning/10'
              : severity === 'medium'
                ? 'text-primary bg-primary/10'
                : 'text-slate-300 bg-slate-700/50';
        return `
        <div class="rounded-xl border border-border-dark bg-slate-900/40 p-2.5 flex items-center justify-between gap-3">
          <div>
            <p class="font-semibold text-slate-100">${window.AthleteInsights.formatPainZoneLabel(row.zone)}</p>
            <p class="text-[11px] text-slate-500">${Number(row.students_affected || 0)} atletas · dolor prom ${Number(row.avg_pain || 0).toFixed(1)}</p>
          </div>
          <span class="px-2 py-1 rounded-lg text-[10px] font-bold ${badgeClass}">${Number(row.intensity_pct || 0).toFixed(1)}%</span>
        </div>`;
      })
      .join('');
  }

  setupPainRegionInteractions();
}

function renderPainHeatChart(sortedZones) {
  const chartEl = document.getElementById('pain-heat-chart');
  if (!chartEl) return;
  if (!sortedZones?.length) {
    chartEl.innerHTML =
      '<p class="text-slate-500 text-xs">Sin datos de dolor en los últimos 30 días.</p>';
    return;
  }
  const max = Math.max(...sortedZones.map((z) => Number(z.intensity_pct || 0)), 1);
  chartEl.innerHTML = sortedZones
    .slice(0, 10)
    .map((row) => {
      const intensity = Number(row.intensity_pct || 0);
      const pct = Math.max(6, Math.round((intensity / max) * 100));
      return `<button type="button" data-zone-chart="${row.zone}" class="w-full text-left rounded-lg border border-border-dark p-2 bg-slate-900/40 hover:border-primary/60 transition-colors">
        <div class="flex items-center justify-between gap-3 mb-1">
          <p class="font-semibold text-slate-100">${window.AthleteInsights.formatPainZoneLabel(row.zone)}</p>
          <span class="text-[10px] font-bold text-primary">${intensity.toFixed(1)}%</span>
        </div>
        <div class="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div class="h-full bg-gradient-to-r from-blue-500 via-amber-500 to-red-500" style="width:${pct}%"></div>
        </div>
      </button>`;
    })
    .join('');
  chartEl.querySelectorAll('[data-zone-chart]').forEach((btn) => {
    btn.addEventListener('click', () => loadPainZoneDetails(btn.dataset.zoneChart));
  });
}

function setupPainRegionInteractions() {
  // Conservado para compatibilidad (interacciones ahora viven en el gráfico de barras).
}

async function loadPainZoneDetails(zone) {
  const detailEl = document.getElementById('pain-zone-detail-list');
  const labelEl = document.getElementById('pain-selected-zone-label');
  if (!detailEl || !labelEl) return;

  selectedPainZone = zone;
  labelEl.textContent = window.AthleteInsights.formatPainZoneLabel(zone);
  detailEl.innerHTML = '<li class="text-slate-500">Cargando detalle…</li>';

  try {
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await window.supabaseClient
      .from('wellbeing_logs')
      .select('student_id, pain_zone, pain, checked_at, wellbeing_notes, students(full_name)')
      .eq('gym_id', gymId)
      .gte('checked_at', fromDate)
      .gte('pain', 3)
      .order('checked_at', { ascending: false })
      .limit(120);
    if (error) throw error;

    const byStudent = new Map();
    (data || []).forEach((log) => {
      const logZone = window.AthleteInsights.normalizePainZone(log.pain_zone);
      if (logZone !== zone) return;
      const previous = byStudent.get(log.student_id);
      if (!previous || Number(log.pain || 0) > Number(previous.pain || 0))
        byStudent.set(log.student_id, log);
    });

    const rows = Array.from(byStudent.values()).sort(
      (a, b) => Number(b.pain || 0) - Number(a.pain || 0)
    );
    latestPainZoneLogs = rows;
    renderPainZoneDetailList(zone, rows);
    document
      .getElementById('pain-insight-panel')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch (err) {
    console.error('Error loading pain zone detail:', err);
    latestPainZoneLogs = [];
    detailEl.innerHTML =
      '<li class="text-danger">No se pudo cargar el detalle de la zona seleccionada.</li>';
  }
}

function renderPainZoneDetailList(zone, rows) {
  const detailEl = document.getElementById('pain-zone-detail-list');
  const labelEl = document.getElementById('pain-selected-zone-label');
  if (!detailEl || !labelEl) return;

  labelEl.textContent = window.AthleteInsights.formatPainZoneLabel(zone);
  if (!rows?.length) {
    detailEl.innerHTML =
      '<li class="text-slate-500">No hay registros recientes para esta zona.</li>';
    return;
  }

  detailEl.innerHTML = rows
    .slice(0, 8)
    .map((row) => {
      const studentName = escHtml(row.students?.full_name || 'Atleta');
      const note = showSensitiveWellbeingNotes
        ? escHtml(row.wellbeing_notes || 'Sin notas')
        : 'Nota sensible oculta. Activá “Mostrar notas sensibles” para verla.';
      const checkDate = new Date(row.checked_at).toLocaleDateString('es-AR');
      return `<li class="rounded-lg border border-border-dark bg-slate-900/50 p-2.5">
        <p class="font-semibold text-slate-100">${studentName} · dolor ${Number(row.pain || 0)}/5</p>
        <p class="text-[11px] text-slate-400">${note}</p>
        <p class="text-[10px] text-slate-500 mt-1">${checkDate}</p>
      </li>`;
    })
    .join('');
}

async function renderPriorityAttention(summaryRows) {
  const listEl = document.getElementById('pain-high-risk-list');
  if (!listEl) return;

  const criticalZones = new Set(
    (summaryRows || [])
      .map((row) => ({
        zone: window.AthleteInsights.normalizePainZone(row.pain_zone),
        avgPain: Number(row.avg_pain || 0),
        intensity: Number(row.intensity_pct || 0)
      }))
      .filter((row) => row.zone && (row.avgPain >= 4 || row.intensity >= 12))
      .map((row) => row.zone)
  );

  if (!criticalZones.size) {
    listEl.innerHTML = '<li class="text-slate-500">Sin atletas en prioridad de intervención.</li>';
    return;
  }

  try {
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [painRes, stagnationRes] = await Promise.all([
      window.supabaseClient
        .from('wellbeing_logs')
        .select('student_id, pain, pain_zone, checked_at, students(full_name)')
        .eq('gym_id', gymId)
        .gte('checked_at', fromDate)
        .gte('pain', 4)
        .order('checked_at', { ascending: false })
        .limit(300),
      window.supabaseClient
        .from('v_stagnation_check')
        .select('student_id, is_stagnant')
        .eq('gym_id', gymId)
        .eq('is_stagnant', true)
    ]);

    if (painRes.error) throw painRes.error;
    const stagnationStudents = new Set(
      (
        (stagnationRes.data || []).filter((s) => s.is_stagnant).map((s) => s.student_id) || []
      ).filter(Boolean)
    );
    const candidates = new Map();
    (painRes.data || []).forEach((row) => {
      const zone = window.AthleteInsights.normalizePainZone(row.pain_zone);
      if (!criticalZones.has(zone)) return;
      if (!stagnationStudents.has(row.student_id)) return;
      const prev = candidates.get(row.student_id);
      if (!prev || Number(row.pain || 0) > Number(prev.pain || 0)) {
        candidates.set(row.student_id, { ...row, zone });
      }
    });

    const top = Array.from(candidates.values())
      .sort((a, b) => Number(b.pain || 0) - Number(a.pain || 0))
      .slice(0, 6);

    if (!top.length) {
      listEl.innerHTML = '<li class="text-slate-500">No hay cruces dolor + estancamiento hoy.</li>';
      return;
    }

    listEl.innerHTML = top
      .map((row) => {
        const studentName = escHtml(row.students?.full_name || 'Atleta');
        const intensity = Number(painSummaryByZone.get(row.zone)?.intensity_pct || 0).toFixed(1);
        return `<li class="rounded-lg border border-danger/30 bg-danger/5 p-2.5">
          <p class="font-semibold text-slate-100">${studentName}</p>
          <p class="text-[11px] text-slate-300">${window.AthleteInsights.formatPainZoneLabel(row.zone)} · dolor ${Number(row.pain || 0)}/5 · intensidad ${intensity}%</p>
        </li>`;
      })
      .join('');
  } catch (err) {
    console.error('Error rendering priority attention:', err);
    listEl.innerHTML =
      '<li class="text-slate-500">No se pudo calcular prioridad automáticamente.</li>';
  }
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
    const confirmMsg =
      recipientIds.length === 1
        ? '¿Enviar aviso a 1 alumno?'
        : `¿Enviar aviso a ${recipientIds.length} alumnos?`;
    if (!confirm(confirmMsg)) {
      window.tfUtils.setBtnLoading(submitBtn, false, 'Enviar aviso');
      return;
    }

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

// ─── MODAL NUEVA MEMBRESÍA ────────────────────────────────
const DEFAULT_PLAN_META = {
  mensual: { label: 'Mensual', duration_days: 30, amount: 30000 },
  trimestral: { label: 'Trimestral', duration_days: 90, amount: 80000 },
  anual: { label: 'Anual', duration_days: 365, amount: 280000 }
};

async function loadGymMembershipPlans() {
  const { data, error } = await window.supabaseClient
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

function _showMembershipModal() {
  const modal = document.getElementById('modal-nueva-membresia');
  if (!modal) return;
  modal.classList.remove('opacity-0', 'pointer-events-none');
  modal.classList.add('opacity-100', 'pointer-events-auto');
}

function _hideMembershipModal() {
  const modal = document.getElementById('modal-nueva-membresia');
  if (!modal) return;
  modal.classList.add('opacity-0', 'pointer-events-none');
  modal.classList.remove('opacity-100', 'pointer-events-auto');
  document.getElementById('membresia-student-id').value = '';
  document.getElementById('membresia-plan').value = '';
  document.getElementById('membresia-amount').value = '';
  document.getElementById('membresia-notes').value = '';
  document
    .querySelectorAll('#membresia-plan-buttons .plan-btn')
    .forEach((b) => b.classList.remove('border-primary', 'text-primary', 'bg-primary/10'));
  document.getElementById('modal-membresia-error')?.classList.add('hidden');
}

window.openModalMembresia = async () => {
  try {
    await loadGymMembershipPlans();
  } catch (err) {
    toast('No se pudieron cargar los planes de membresía', 'error');
    return;
  }
  renderGymMembershipPlanButtons();
  selectGymMembershipPlan('', null);

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

  document.getElementById('membresia-start-date').value = new Date().toISOString().split('T')[0];
  _showMembershipModal();
};

window.closeModalMembresia = () => {
  _hideMembershipModal();
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
    const endDate = new Date(startDate);
    const planMeta = DEFAULT_PLAN_META[plan] || { duration_days: 30 };
    if (plan === 'trimestral') endDate.setMonth(endDate.getMonth() + 3);
    else if (plan === 'anual') endDate.setFullYear(endDate.getFullYear() + 1);
    else endDate.setMonth(endDate.getMonth() + 1);

    const { error } = await window.supabaseClient.from('memberships').insert({
      gym_id: gymId,
      student_id: studentId,
      plan,
      start_date: startDate,
      end_date: endDate.toISOString().split('T')[0],
      amount: parseFloat(amount),
      payment_method: paymentMethod,
      notes: notes || null
    });
    if (error) throw error;
    toast('Membresía registrada');
    window.closeModalMembresia();
    await Promise.all([loadDashboardIndicators(), loadRecentStudents()]);
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = 'Error: ' + err.message;
      errorEl.classList.remove('hidden');
    }
  } finally {
    window.tfUtils.setBtnLoading(submitBtn, false, 'Registrar Membresía');
  }
}

function setupMembershipModal() {
  document
    .getElementById('modal-membresia-backdrop')
    ?.addEventListener('click', window.closeModalMembresia);
  document
    .getElementById('modal-membresia-close')
    ?.addEventListener('click', window.closeModalMembresia);
  document
    .getElementById('modal-membresia-cancel')
    ?.addEventListener('click', window.closeModalMembresia);
  document.getElementById('modal-membresia-submit')?.addEventListener('click', saveMembresia);

  document.getElementById('membresia-plan-buttons')?.addEventListener('click', (evt) => {
    const btn = evt.target.closest('.plan-btn');
    if (!btn) return;
    selectGymMembershipPlan(btn.dataset.plan, btn.dataset.amount);
  });
}

// ─── ARRANCAR ─────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  // DOMContentLoaded ya se disparó antes de que este módulo cargara
  initDashboard();
}
