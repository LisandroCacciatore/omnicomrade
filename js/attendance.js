/**
 * attendance.js
 * TechFitness — Control de Acceso y Asistencia
 */

(async () => {
  const ctx = await window.authGuard(['gim_admin', 'profesor']);
  if (!ctx) return;

  const { gymId } = ctx;
  const db = window.supabaseClient;
  const { toast, escHtml } = window.tfUtils;

  /* ─── State ──────────────────────────────────────────────── */
  let allStudents = [];
  let todayLogs = [];
  let selectedStudent = null;
  let duplicateNameKeys = new Set();
  let trendRangeDays = 15;

  /* ─── DOM Elements ───────────────────────────────────────── */
  const searchInput = document.getElementById('search-student');
  const resultsContainer = document.getElementById('search-results');
  const formCheckin = document.getElementById('form-checkin');
  const btnSubmit = document.getElementById('btn-submit-checkin');
  const logsContainer = document.getElementById('today-logs');
  const countEl = document.getElementById('today-count');
  const duplicateWarningEl = document.getElementById('duplicate-warning');

  function sanitizeImageSrc(url) {
    if (!url) return '';
    const value = String(url).trim();
    if (!value) return '';
    if (value.startsWith('/')) return escHtml(value);
    if (value.startsWith('data:image/')) return escHtml(value);
    try {
      const parsed = new URL(value, window.location.origin);
      if (['http:', 'https:', 'blob:'].includes(parsed.protocol)) return escHtml(parsed.href);
    } catch (_) {}
    return '';
  }

  // Configurar fecha de hoy
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('today-date').textContent = new Date().toLocaleDateString(
    'es-AR',
    options
  );

  /* ─── Initialization ─────────────────────────────────────── */
  async function loadInitialData() {
    // 1. Cargar alumnos para búsqueda instantánea
    let studentsResult = await db
      .from('students')
      .select('id, full_name, membership_status, avatar_url, dni, email')
      .eq('gym_id', gymId)
      .is('deleted_at', null)
      .order('full_name');
    if (studentsResult.error && String(studentsResult.error.code || '') === '42703') {
      studentsResult = await db
        .from('students')
        .select('id, full_name, membership_status, avatar_url, email')
        .eq('gym_id', gymId)
        .is('deleted_at', null)
        .order('full_name');
    }
    if (studentsResult.error) {
      console.error('Error cargando alumnos:', studentsResult.error);
      toast('No se pudieron cargar alumnos para asistencia', 'error');
    } else {
      allStudents = studentsResult.data || [];
    }

    // 2. Cargar ingresos de hoy
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: logs, error: errLogs } = await db
      .from('attendance_logs')
      .select('id, check_in_time, students(id, full_name, avatar_url)')
      .eq('gym_id', gymId)
      .gte('check_in_time', todayStart.toISOString())
      .order('check_in_time', { ascending: false });

    if (!errLogs) todayLogs = logs || [];
    renderLogs();
    await loadPeriodMetrics();
    await renderAttendanceTrend(trendRangeDays);
  }

  async function loadPeriodMetrics() {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(dayStart);
    weekStart.setDate(dayStart.getDate() - dayStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [{ count: dayCount }, { count: weekCount }, { count: monthCount }] = await Promise.all([
      db
        .from('attendance_logs')
        .select('*', { count: 'exact', head: true })
        .eq('gym_id', gymId)
        .gte('check_in_time', dayStart.toISOString()),
      db
        .from('attendance_logs')
        .select('*', { count: 'exact', head: true })
        .eq('gym_id', gymId)
        .gte('check_in_time', weekStart.toISOString()),
      db
        .from('attendance_logs')
        .select('*', { count: 'exact', head: true })
        .eq('gym_id', gymId)
        .gte('check_in_time', monthStart.toISOString())
    ]);

    const setMetric = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || 0;
    };
    setMetric('metric-day', dayCount);
    setMetric('metric-week', weekCount);
    setMetric('metric-month', monthCount);
    setGauge('metric-day-gauge', dayCount, 30);
    setGauge('metric-week-gauge', weekCount, 180);
    setGauge('metric-month-gauge', monthCount, 800);
  }

  async function renderAttendanceTrend(days = 15) {
    const chart = document.getElementById('attendance-trend-chart');
    const line = document.getElementById('attendance-trend-line');
    const area = document.getElementById('attendance-trend-area');
    const empty = document.getElementById('attendance-trend-empty');
    if (!chart || !line || !area || !empty) return;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));

    const { data, error } = await db
      .from('attendance_logs')
      .select('check_in_time')
      .eq('gym_id', gymId)
      .gte('check_in_time', from.toISOString())
      .order('check_in_time', { ascending: true });
    if (error) {
      empty.classList.remove('hidden');
      chart.classList.add('hidden');
      return;
    }
    const bucket = new Map();
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      bucket.set(d.toISOString().slice(0, 10), 0);
    }
    (data || []).forEach((row) => {
      const key = new Date(row.check_in_time).toISOString().slice(0, 10);
      if (bucket.has(key)) bucket.set(key, (bucket.get(key) || 0) + 1);
    });
    const points = Array.from(bucket.values());
    const maxY = Math.max(...points, 1);
    if (points.every((x) => x === 0)) {
      empty.classList.remove('hidden');
      chart.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');
    chart.classList.remove('hidden');
    const w = 600;
    const h = 160;
    const px = points.map((val, idx) => {
      const x = (idx / Math.max(1, points.length - 1)) * (w - 24) + 12;
      const y = h - 16 - (val / maxY) * (h - 36);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    line.setAttribute('d', `M ${px.join(' L ')}`);
    area.setAttribute('d', `M 12,${h - 16} L ${px.join(' L ')} L ${w - 12},${h - 16} Z`);
  }

  function setGauge(id, value, max) {
    const el = document.getElementById(id);
    if (!el) return;
    const v = Number(value || 0);
    const pct = Math.max(0, Math.min(100, Math.round((v / Math.max(1, max)) * 100)));
    el.textContent = `${pct}%`;
    el.style.background = `conic-gradient(#3B82F6 ${pct}%, #1E293B ${pct}% 100%)`;
  }

  /* ─── Search Logic ───────────────────────────────────────── */
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();

    if (query.length === 0) {
      resultsContainer.innerHTML = `<div class="text-center py-10 text-slate-500 text-sm">Empezá a escribir para buscar un alumno...</div>`;
      hideCheckinForm();
      return;
    }

    const filtered = allStudents.filter((s) => s.full_name.toLowerCase().includes(query));
    renderResults(filtered);
  });

  document.querySelectorAll('.attendance-range-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.attendance-range-btn').forEach((b) => {
        b.classList.remove('bg-primary/20', 'text-primary');
        b.classList.add('bg-[#1E293B]', 'text-slate-300');
      });
      btn.classList.remove('bg-[#1E293B]', 'text-slate-300');
      btn.classList.add('bg-primary/20', 'text-primary');
      trendRangeDays = Number(btn.dataset.range || 15);
      await renderAttendanceTrend(trendRangeDays);
    });
  });

  function renderResults(students) {
    if (students.length === 0) {
      resultsContainer.innerHTML = `<div class="text-center py-10 text-slate-500 text-sm">No se encontraron alumnos con ese nombre.</div>`;
      return;
    }

    const statusConfig = {
      activa: { label: 'Activa', classes: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30' },
      vencida: { label: 'Vencida', classes: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30' },
      suspendida: {
        label: 'Suspendida',
        classes: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30'
      },
      pendiente: { label: 'Pendiente', classes: 'bg-slate-800 text-slate-400 border-slate-700' }
    };

    renderDuplicateWarning(students);
    resultsContainer.innerHTML = students
      .map((s) => {
        const initials = s.full_name.substring(0, 2).toUpperCase();
        const config = statusConfig[s.membership_status] || statusConfig.pendiente;
        const isSelected = selectedStudent?.id === s.id;
        const avatarSrc = sanitizeImageSrc(s.avatar_url);

        return `
            <div class="student-result ${isSelected ? 'selected' : ''}" data-id="${s.id}">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-[#1E293B] flex items-center justify-center text-sm font-bold text-slate-400 overflow-hidden shrink-0">
                        ${avatarSrc ? `<img src="${avatarSrc}" class="w-full h-full object-cover" alt="${escHtml(s.full_name || 'Atleta')}">` : escHtml(initials)}
                    </div>
                    <div>
                        <p class="text-sm font-bold text-white leading-tight">${escHtml(s.full_name)}</p>
                    </div>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${config.classes}">
                    ${config.label}
                </span>
            </div>`;
      })
      .join('');
  }

  function renderDuplicateWarning(students) {
    if (!duplicateWarningEl) return;
    const byName = new Map();
    students.forEach((s) => {
      const key = (s.full_name || '').trim().toLowerCase();
      if (!key) return;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(s);
    });
    const duplicates = Array.from(byName.entries()).filter(([, list]) => list.length > 1);
    duplicateNameKeys = new Set(duplicates.map(([name]) => name));
    if (!duplicates.length) {
      duplicateWarningEl.classList.add('hidden');
      duplicateWarningEl.textContent = '';
      return;
    }
    const missingDniCount = duplicates.reduce(
      (acc, [, list]) => acc + list.filter((s) => !String(s.dni || '').trim()).length,
      0
    );
    duplicateWarningEl.classList.remove('hidden');
    duplicateWarningEl.textContent = `Detectamos ${duplicates.length} posibles duplicados por nombre. Validá por nombre completo + DNI antes de registrar asistencia. ${missingDniCount > 0 ? `Hay ${missingDniCount} registros sin DNI.` : ''}`;
  }

  function isSelectedStudentDuplicateWithoutDni() {
    if (!selectedStudent) return false;
    const key = (selectedStudent.full_name || '').trim().toLowerCase();
    if (!duplicateNameKeys.has(key)) return false;
    return !String(selectedStudent.dni || '').trim();
  }

  /* ─── Event Delegation para la selección ─────────────────── */
  resultsContainer.addEventListener('click', (e) => {
    const row = e.target.closest('.student-result');
    if (!row) return;

    const studentId = row.dataset.id;
    selectedStudent = allStudents.find((s) => s.id === studentId);

    // Re-render para marcar la fila seleccionada visualmente
    renderResults(
      allStudents.filter((s) =>
        s.full_name.toLowerCase().includes(searchInput.value.toLowerCase().trim())
      )
    );

    showCheckinForm();
  });

  /* ─── Check-in Form Logic ────────────────────────────────── */
  function showCheckinForm() {
    if (!selectedStudent) return;

    if (isSelectedStudentDuplicateWithoutDni()) {
      toast(
        'Este alumno tiene nombre repetido y no tiene DNI cargado. Completá DNI para evitar duplicados.',
        'error'
      );
      return;
    }

    document.getElementById('selected-student-id').value = selectedStudent.id;
    document.getElementById('selected-student-name').textContent = selectedStudent.full_name;

    const isOk = selectedStudent.membership_status === 'activa';

    const statusHTML = isOk
      ? `<span class="px-3 py-1 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-bold uppercase tracking-widest">Al Día</span>`
      : `<span class="px-3 py-1 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs font-bold uppercase tracking-widest">Vencida / Irregular</span>`;

    document.getElementById('selected-student-status').innerHTML = statusHTML;

    // Configurar el botón visualmente según el estado
    btnSubmit.className = `w-full py-4 rounded-xl text-base font-bold text-white transition-colors flex items-center justify-center gap-2 ${isOk ? 'bg-[#10B981] hover:bg-emerald-500' : 'bg-[#EF4444] hover:bg-red-500'}`;
    btnSubmit.innerHTML = `<span class="material-symbols-rounded">how_to_reg</span> ${isOk ? 'Registrar Ingreso' : 'Forzar Ingreso (Irregular)'}`;

    formCheckin.classList.remove('hidden');
    btnSubmit.focus(); // Permite apretar Enter instantáneamente
  }

  function hideCheckinForm() {
    selectedStudent = null;
    formCheckin.classList.add('hidden');
  }

  formCheckin.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;

    const studentId = selectedStudent.id;
    const isOk = selectedStudent.membership_status === 'activa';

    if (!isOk && !confirm('La membresía está vencida o irregular. ¿Continuar con el ingreso?')) {
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="material-symbols-rounded animate-spin">progress_activity</span> Procesando...`;

    try {
      // Guardar en la DB
      const { data, error } = await db
        .from('attendance_logs')
        .insert({
          gym_id: gymId,
          student_id: studentId
        })
        .select('id, check_in_time')
        .single();

      if (error) throw error;

      toast(`Ingreso de ${selectedStudent.full_name} registrado ✓`);

      // Agregar al principio de la lista en memoria
      todayLogs.unshift({
        id: data.id,
        check_in_time: data.check_in_time,
        students: { full_name: selectedStudent.full_name, avatar_url: selectedStudent.avatar_url }
      });
      renderLogs();
      await loadPeriodMetrics();
      await renderAttendanceTrend(trendRangeDays);

      // Limpiar buscador para el próximo alumno
      searchInput.value = '';
      resultsContainer.innerHTML = `<div class="text-center py-10 text-slate-500 text-sm">Ingreso registrado. Listo para el próximo.</div>`;
      hideCheckinForm();
      searchInput.focus();
    } catch (error) {
      console.error(error);
      toast('Error al registrar ingreso', 'error');
    } finally {
      btnSubmit.disabled = false;
    }
  });

  /* ─── Logs Rendering ─────────────────────────────────────── */
  function renderLogs() {
    countEl.textContent = todayLogs.length;

    if (todayLogs.length === 0) {
      logsContainer.innerHTML = `<div class="text-center py-10 text-slate-500 text-sm">Todavía no hay ingresos registrados hoy.</div>`;
      return;
    }

    logsContainer.innerHTML = todayLogs
      .map((log) => {
        const time = new Date(log.check_in_time).toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit'
        });
        const initials = log.students.full_name.substring(0, 2).toUpperCase();
        const avatarSrc = sanitizeImageSrc(log.students.avatar_url);

        return `
            <div class="log-item">
                <div class="w-8 h-8 rounded-full bg-[#1E293B] flex items-center justify-center text-xs font-bold text-slate-400 overflow-hidden shrink-0">
                    ${avatarSrc ? `<img src="${avatarSrc}" class="w-full h-full object-cover" alt="${escHtml(log.students.full_name || 'Atleta')}">` : escHtml(initials)}
                </div>
                <div class="flex-1">
                    <p class="text-sm font-bold text-white">${escHtml(log.students.full_name)}</p>
                </div>
                <div class="text-xs font-mono text-slate-500 bg-[#0B1218] px-2 py-1 rounded-md border border-[#1E293B]">
                    ${time}
                </div>
            </div>`;
      })
      .join('');
  }

  /* ─── Init ───────────────────────────────────────────────── */
  await loadInitialData();
})();
