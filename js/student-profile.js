/**
 * student-profile.js
 * TechFitness — Vista del alumno: programa, rutina y estadísticas (Chart.js)
 */

(async () => {
  const session = await window.authGuard(['alumno', 'gim_admin', 'profesor']);
  if (!session) return;

  const db = window.supabaseClient;
  const { round, pct, escHtml, logout } = window.tfUtils;

  // HU 4: Soporte para vista de admin/entrenador (por student.id o profile_id)
  const urlParams = new URLSearchParams(window.location.search);
  const targetId = urlParams.get('id');
  const role = session.user.app_metadata?.role;
  const isStaff = role === 'gim_admin' || role === 'profesor';

  let student = null;
  let profile = null;

  // STUDENT_SELECT sin join a routines — la FK via ALTER TABLE no siempre queda
  // en el schema cache de Supabase (error PGRST200). La rutina se carga aparte.
  // routine_id puede no existir si la migración no se ejecutó aún — se pide
  // con try/catch implícito al nivel de query; si falla usamos solo los campos base.
  const STUDENT_SELECT = 'id, profile_id, full_name, email, gym_id, routine_id, gyms(name)';
  const STUDENT_SELECT_FALLBACK = 'id, profile_id, full_name, email, gym_id, gyms(name)';

  // Carga la rutina completa dado un routine_id (query separada)
  async function loadRoutineById(routineId) {
    if (!routineId) return null;
    const { data } = await db
      .from('routines')
      .select(
        `
      id, name, objetivo, duration_weeks, days_per_week,
      routine_days (
        id, day_number, name,
        routine_day_exercises (
          id, order_index, exercise_name, sets, reps, rest_seconds,
          rpe, weight_kg, weight_ref, notes, method_slug,
          exercises (id, name, muscle_group),
          routine_day_exercise_sets (
            id, set_number, reps_target, weight_kg, weight_pct,
            rpe_target, rir_target, tempo, is_amrap, notes
          )
        )
      )
    `
      )
      .eq('id', routineId)
      .maybeSingle();
    return data;
  }

  // Helper: ejecuta query con SELECT principal; si la columna routine_id no existe
  // en la DB (migración pendiente), reintenta sin ella.
  async function fetchStudent(filter) {
    let { data, error } = await db
      .from('students')
      .select(STUDENT_SELECT)
      .match(filter)
      .is('deleted_at', null)
      .maybeSingle();
    if (error && error.code === '42703') {
      // routine_id no existe aún → fallback sin esa columna
      ({ data, error } = await db
        .from('students')
        .select(STUDENT_SELECT_FALLBACK)
        .match(filter)
        .is('deleted_at', null)
        .maybeSingle());
    }
    return data;
  }

  // 1. Buscar al alumno
  if (isStaff && targetId) {
    student = await fetchStudent({ id: targetId });
  } else {
    student = await fetchStudent({ profile_id: session.user.id });

    // Fallback por email+gym_id si profile_id no estaba vinculado
    if (!student) {
      const gymId = session.user.app_metadata?.gym_id;
      const userEmail = session.user.email;
      if (gymId && userEmail) {
        const byEmail = await fetchStudent({ gym_id: gymId, email: userEmail });
        if (byEmail) {
          // Auto-link silencioso — fire and forget
          db.from('students')
            .update({ profile_id: session.user.id })
            .eq('id', byEmail.id)
            .is('profile_id', null)
            .then(() => {});
          // ignore 409 conflict — another auth user may already be linked
          student = { ...byEmail, profile_id: session.user.id };
        }
      }
    }
  }

  // 2. Cargar rutina en query separada (evita PGRST200 por FK no cacheada)
  if (student) {
    student.routines = await loadRoutineById(student.routine_id ?? null);
  }

  if (!student) {
    // Si no encontramos al alumno, mostramos estado vacío
    hideLoading();
    const area = document.getElementById('content-area');
    if (area)
      area.innerHTML = buildNoProgram(
        'No se encontró el alumno',
        'El ID proporcionado no corresponde a un alumno activo.'
      );
    return;
  }

  // 3. Cargar perfil para nombre y gimnasio (no-fatal si no existe)
  if (student.profile_id) {
    const { data: prof } = await db
      .from('profiles')
      .select('id, full_name, gym_id, gyms(name)')
      .eq('id', student.profile_id)
      .maybeSingle();
    profile = prof;
  }

  const studentNameHeader = document.getElementById('student-name-header');
  const gymNameHeader = document.getElementById('gym-name-header');

  let painBadge = '';
  if (student) {
    const todayDateStr = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires'
    });
    const { data: todayLog } = await db
      .from('wellbeing_logs')
      .select('pain, pain_zone')
      .eq('student_id', student.id)
      .eq('check_date', todayDateStr)
      .maybeSingle();
    if (todayLog && todayLog.pain >= 4) {
      painBadge = `<span class="inline-flex items-center px-2 py-0.5 ml-3 rounded border text-[10px] font-bold uppercase tracking-widest bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]" title="Dolor activo reportado hoy">Dolor Activo Hoy</span>`;
    }
  }

  if (studentNameHeader)
    studentNameHeader.innerHTML = `${escHtml(profile?.full_name || student.full_name || 'Atleta')}${painBadge}`;
  if (gymNameHeader)
    gymNameHeader.textContent = profile?.gyms?.name || student.gyms?.name || 'TechFitness';

  const MUSCLE_COLORS = {
    pecho: '#F97316',
    espalda: '#3B82F6',
    hombros: '#8B5CF6',
    biceps: '#EC4899',
    triceps: '#F59E0B',
    core: '#EF4444',
    piernas: '#10B981',
    gluteos: '#06B6D4',
    cardio: '#84CC16',
    otros: '#64748B'
  };
  let chartInstance = null;
  let rawStatsData = {};

  function hideLoading() {
    const loading = document.getElementById('loading-state');
    const content = document.getElementById('content-area');
    const toggle = document.getElementById('view-toggle');
    if (loading) loading.classList.add('hidden');
    if (content) content.classList.remove('hidden');
    if (toggle) toggle.classList.remove('hidden');
  }

  document.getElementById('logout-btn')?.addEventListener('click', logout);

  /* ── Load Program/Routine Data ── */
  let activeProgram = null;
  let activeRoutine = null;

  // Prioridad 1: Programas estructurados (SS, 5x5, etc.)
  const { data: ap } = await db
    .from('student_programs')
    .select(
      `id, status, current_week, started_at, rm_values, program_templates (id, slug, name, description, weeks, days_per_week, level)`
    )
    .eq('student_id', student.id)
    .eq('status', 'activo')
    .maybeSingle();
  activeProgram = ap;

  // Prioridad 2: Rutina simple asignada
  if (!activeProgram) {
    activeRoutine = student.routines || null;
  }

  // Cargar días completados hoy para bloquear el botón
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: todaySessions } = await db
    .from('workout_sessions')
    .select('day_name')
    .eq('student_id', student.id)
    .not('completed_at', 'is', null)
    .gte('completed_at', todayStart.toISOString());
  const completedToday = new Set((todaySessions || []).map((s) => s.day_name));

  /* ── Render Routine View ── */
  const area = document.getElementById('content-area');
  if (area) {
    if (activeProgram) {
      area.innerHTML = buildProgramView(activeProgram, completedToday);
      bindDayTabs();
    } else if (activeRoutine) {
      area.innerHTML = buildRoutineView(activeRoutine, completedToday);
      bindDayTabs();
    } else {
      area.innerHTML = buildNoProgram(
        'Sin rutina asignada',
        'Todavía no hay programas o rutinas activas para este entrenamiento.'
      );
    }
  }

  hideLoading();
  loadStatsData(student.id);

  /* ── Tab Toggle Logic ── */
  const tabRoutine = document.getElementById('tab-routine');
  const tabStats = document.getElementById('tab-stats');
  const areaRoutine = document.getElementById('content-area');
  const areaStats = document.getElementById('stats-area');

  tabRoutine?.addEventListener('click', () => {
    tabStats?.classList.remove('active', 'bg-[#1E293B]', 'text-[#E2E8F0]');
    tabStats?.classList.add('text-slate-500');
    tabRoutine?.classList.add('active', 'bg-[#1E293B]', 'text-[#E2E8F0]');
    tabRoutine?.classList.remove('text-slate-500');
    areaStats?.classList.add('hidden');
    areaRoutine?.classList.remove('hidden');
  });

  tabStats?.addEventListener('click', () => {
    tabRoutine?.classList.remove('active', 'bg-[#1E293B]', 'text-[#E2E8F0]');
    tabRoutine?.classList.add('text-slate-500');
    tabStats?.classList.add('active', 'bg-[#1E293B]', 'text-[#E2E8F0]');
    tabStats?.classList.remove('text-slate-500');
    areaRoutine?.classList.add('hidden');
    areaStats?.classList.remove('hidden');
  });

  /* ── Stats Logic (Chart.js) ── */
  // ── Stats tab: muestra el último entreno comparado con el anterior ──
  async function loadStatsData(studentId) {
    const statsArea = document.getElementById('stats-area');
    if (!statsArea) return;

    // Pain map: últimos 30 días
    const thirtyDaysAgoDate = new Date();
    thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);
    const yyyy = thirtyDaysAgoDate.getFullYear();
    const mm = String(thirtyDaysAgoDate.getMonth() + 1).padStart(2, '0');
    const dd = String(thirtyDaysAgoDate.getDate()).padStart(2, '0');
    const thirtyDaysAgoStr = `${yyyy}-${mm}-${dd}`;

    const { data: painLogs } = await db
      .from('wellbeing_logs')
      .select('pain_zone')
      .eq('student_id', studentId)
      .not('pain_zone', 'is', null)
      .gte('check_date', thirtyDaysAgoStr);

    const zoneCounts = {};
    (painLogs || []).forEach((l) => {
      zoneCounts[l.pain_zone] = (zoneCounts[l.pain_zone] || 0) + 1;
    });

    let painMapHTML = '';
    if (Object.keys(zoneCounts).length > 0) {
      const sortedZones = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]);
      const maxCount = sortedZones[0][1];

      painMapHTML = `
        <div style="background:#161E26;border:1px solid #1E293B;border-radius:18px;overflow:hidden;margin-bottom:20px">
          <div style="padding:14px 18px;border-bottom:1px solid #1E293B">
            <h3 style="font-size:13px;font-weight:800;color:#E2E8F0;display:flex;align-items:center;gap:6px">
              <span class="material-symbols-rounded" style="color:#EF4444;font-size:18px">body_system</span> Zonas de Dolor (30D)
            </h3>
          </div>
          <div style="padding:14px 18px;display:flex;flex-direction:column;gap:10px">
            ${sortedZones
              .map(([zone, count]) => {
                const widthPct = Math.round((count / maxCount) * 100);
                const color = count >= 3 ? '#EF4444' : count == 2 ? '#F59E0B' : '#3B82F6';
                return `
                <div>
                   <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                     <span style="font-size:11px;font-weight:700;color:#E2E8F0;text-transform:capitalize">${escHtml(zone)}</span>
                     <span style="font-size:11px;font-weight:800;color:${color}">${count} reportes</span>
                   </div>
                   <div style="height:6px;background:#0B1218;border-radius:3px;overflow:hidden">
                     <div style="height:100%;width:${widthPct}%;background:${color};border-radius:3px"></div>
                   </div>
                </div>`;
              })
              .join('')}
          </div>
        </div>`;
    }

    // Traer las últimas 20 sesiones con sus logs
    const { data: sessions } = await db
      .from('workout_sessions')
      .select(
        'id, completed_at, day_name, workout_exercise_logs(exercise_name, weight_used, set_number, status)'
      )
      .eq('student_id', studentId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(20);

    if (!sessions || sessions.length === 0) {
      statsArea.innerHTML =
        painMapHTML +
        buildStatsEmpty(
          'Sin sesiones completadas',
          'Completá tu primer entrenamiento para ver el seguimiento aquí.'
        );
      return;
    }

    // Peso máximo por ejercicio por sesión
    const sessionsByDay = {}; // day_name → [sesiones ordenadas por fecha desc]
    sessions.forEach((s) => {
      const key = s.day_name || 'Sesión';
      if (!sessionsByDay[key]) sessionsByDay[key] = [];
      sessionsByDay[key].push(s);
    });

    // Último día entrenado
    const lastSession = sessions[0];
    const lastDayName = lastSession.day_name || 'Sesión';
    const sameDaySessions = sessionsByDay[lastDayName] || [];

    // Peso máximo por ejercicio en la última sesión vs la anterior del mismo día
    const lastLogs = maxWeightByEx(lastSession.workout_exercise_logs || []);
    const prevSession = sameDaySessions[1]; // la anterior del mismo día
    const prevLogs = prevSession ? maxWeightByEx(prevSession.workout_exercise_logs || []) : {};

    const exercises = Object.keys(lastLogs);

    if (!exercises.length) {
      statsArea.innerHTML = buildStatsEmpty(
        'Sin datos de peso',
        'Registrá pesos en tu entreno para ver la evolución.'
      );
      return;
    }

    const dateStr = new Date(lastSession.completed_at).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
    const prevDateStr = prevSession
      ? new Date(prevSession.completed_at).toLocaleDateString('es-AR', {
          day: 'numeric',
          month: 'short'
        })
      : null;

    const rows = exercises
      .sort()
      .map((ex) => {
        const current = lastLogs[ex];
        const prev = prevLogs[ex];
        let delta = null,
          color = '#64748B',
          icon = '→',
          bgColor = 'rgba(100,116,139,.08)',
          borderColor = '#1E293B';

        if (prev && prev > 0) {
          delta = current - prev;
          if (delta > 0) {
            color = '#10B981';
            icon = '↑';
            bgColor = 'rgba(16,185,129,.06)';
            borderColor = 'rgba(16,185,129,.25)';
          } else if (delta < 0) {
            color = '#EF4444';
            icon = '↓';
            bgColor = 'rgba(239,68,68,.06)';
            borderColor = 'rgba(239,68,68,.25)';
          } else {
            color = '#F59E0B';
            icon = '→';
            bgColor = 'rgba(245,158,11,.06)';
            borderColor = 'rgba(245,158,11,.2)';
          }
        } else if (!prev && current > 0) {
          // Primera vez — marcar como nuevo
          color = '#3B82F6';
          icon = '★';
          bgColor = 'rgba(59,130,246,.06)';
          borderColor = 'rgba(59,130,246,.2)';
        }

        const deltaLabel =
          delta !== null
            ? `<span style="font-size:10px;font-weight:800;color:${color};margin-left:4px">${delta > 0 ? '+' : ''}${delta}kg</span>`
            : prev === undefined
              ? `<span style="font-size:9px;color:#475569;margin-left:4px">1ª vez</span>`
              : '';

        return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:12px;border:1px solid ${borderColor};background:${bgColor};margin-bottom:8px">
        <div style="flex:1;min-width:0;padding-right:12px">
          <p style="font-size:12px;font-weight:700;color:#E2E8F0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(ex)}</p>
          ${prev ? `<p style="font-size:10px;color:#475569">Antes: ${prev}kg</p>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span style="font-size:22px;font-weight:900;font-family:'IBM Plex Mono',monospace;color:${color}">${icon}</span>
          <div style="text-align:right">
            <p style="font-size:16px;font-weight:900;font-family:'IBM Plex Mono',monospace;color:#E2E8F0;line-height:1">${current}<span style="font-size:10px;color:#475569;margin-left:2px">kg</span></p>
            ${deltaLabel}
          </div>
        </div>
      </div>`;
      })
      .join('');

    statsArea.innerHTML =
      painMapHTML +
      `
      <div style="background:#161E26;border:1px solid #1E293B;border-radius:18px;overflow:hidden">
        <div style="padding:14px 18px;border-bottom:1px solid #1E293B;display:flex;align-items:center;justify-content:space-between">
          <div>
            <p style="font-size:13px;font-weight:800;color:#E2E8F0">${escHtml(lastDayName)}</p>
            <p style="font-size:10px;color:#475569;margin-top:2px;text-transform:capitalize">${dateStr}${prevDateStr ? ` · vs ${prevDateStr}` : ''}</p>
          </div>
          <a href="progress.html" style="font-size:11px;font-weight:700;color:#3B82F6;display:flex;align-items:center;gap:4px;text-decoration:none">
            Ver todo
            <span class="material-symbols-rounded" style="font-size:14px">arrow_forward</span>
          </a>
        </div>
        <div style="padding:14px 18px">
          <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
            <span style="font-size:9px;font-weight:800;padding:3px 8px;border-radius:999px;background:rgba(16,185,129,.1);color:#10B981;border:1px solid rgba(16,185,129,.2)">↑ Mejoró</span>
            <span style="font-size:9px;font-weight:800;padding:3px 8px;border-radius:999px;background:rgba(245,158,11,.1);color:#F59E0B;border:1px solid rgba(245,158,11,.2)">→ Igual</span>
            <span style="font-size:9px;font-weight:800;padding:3px 8px;border-radius:999px;background:rgba(239,68,68,.1);color:#EF4444;border:1px solid rgba(239,68,68,.2)">↓ Bajó</span>
            <span style="font-size:9px;font-weight:800;padding:3px 8px;border-radius:999px;background:rgba(59,130,246,.1);color:#3B82F6;border:1px solid rgba(59,130,246,.2)">★ Primera vez</span>
          </div>
          ${rows}
        </div>
      </div>`;
  }

  function maxWeightByEx(logs) {
    const result = {};
    logs.forEach((l) => {
      if (!l.weight_used || l.weight_used <= 0) return;
      if (!result[l.exercise_name] || l.weight_used > result[l.exercise_name])
        result[l.exercise_name] = l.weight_used;
    });
    return result;
  }

  function buildStatsEmpty(title, subtitle) {
    return `<div style="text-align:center;padding:48px 24px">
      <span class="material-symbols-rounded" style="font-size:40px;color:#334155">query_stats</span>
      <p style="font-size:14px;font-weight:700;color:#E2E8F0;margin-top:12px">${title}</p>
      <p style="font-size:12px;color:#475569;margin-top:6px;max-width:220px;margin-left:auto;margin-right:auto">${subtitle}</p>
    </div>`;
  }

  function buildProgramView(prog, completedToday = new Set()) {
    const tpl = prog.program_templates;
    const rms = prog.rm_values || {};
    const week = prog.current_week || 1;
    const totalW = tpl.weeks || 1;
    const progress = Math.round((week / totalW) * 100);
    const days = getProgramDays(tpl.slug, rms, week);
    const r = 28,
      circ = 2 * Math.PI * r;
    const offset = circ - (progress / 100) * circ;
    const icon =
      {
        'starting-strength': '🚂',
        'stronglifts-5x5': '🏗️',
        'wendler-531': '📈',
        'cube-method': '🧊',
        gzclp: '⚡',
        ppl: '🔄'
      }[tpl.slug] || '🏋️';

    return `
    <div class="bg-[#161E26] border border-[#1E293B] rounded-[18px] overflow-hidden">
      <div class="h-[3px] bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]"></div>
      <div class="p-4">
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center text-[22px] shrink-0">${icon}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <h2 class="text-base font-bold text-white">${escHtml(tpl.name)}</h2>
              <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-[#3B82F6]/10 text-[#60A5FA] border border-[#3B82F6]/20">
                <span class="material-symbols-rounded text-[13px]">calendar_month</span> Sem. ${week} de ${totalW}
              </span>
            </div>
            <p class="text-xs text-slate-500">${escHtml(tpl.description || '')} · ${tpl.level || ''}</p>
          </div>
          <div class="flex flex-col items-center shrink-0 relative">
            <svg width="64" height="64" class="progress-ring transform -rotate-90">
              <circle cx="32" cy="32" r="${r}" stroke="#1E293B" stroke-width="4" fill="none"/>
              <circle cx="32" cy="32" r="${r}" stroke="#3B82F6" stroke-width="4" fill="none" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round" class="transition-all duration-500"/>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center pt-1">
                <span class="text-[10px] font-bold text-[#60A5FA] leading-none">${progress}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="flex gap-2 overflow-x-auto pb-1 mt-4" id="day-tabs">
      ${days
        .map(
          (d, i) => `
        <button type="button"
          class="day-tab ${i === 0 ? 'active' : ''} ${completedToday.has(d.name) ? 'completed-day' : ''}"
          data-day-idx="${i}">
          ${escHtml(d.name)}${completedToday.has(d.name) ? ' <span style="color:#10B981">✓</span>' : ''}
        </button>`
        )
        .join('')}
    </div>
    <div id="day-panels" class="mt-4">
      ${days.map((d, i) => buildDayPanel(d, i, rms, tpl.name, completedToday)).join('')}
    </div>`;
  }

  function buildRoutineView(routine, completedToday = new Set()) {
    const days = (routine.routine_days || [])
      .sort((a, b) => a.day_number - b.day_number)
      .map((rd) => ({
        name: rd.name || `Día ${rd.day_number}`,
        exercises: (rd.routine_day_exercises || [])
          .sort((a, b) => a.order_index - b.order_index)
          .map((rde) => ({
            name: rde.exercises?.name || rde.exercise_name || '—',
            exercise_id: rde.exercises?.id || null,
            muscle: rde.exercises?.muscle_group,
            sets: rde.sets,
            reps: rde.reps,
            rest: rde.rest_seconds,
            rpe: rde.rpe,
            weight_kg: rde.weight_kg,
            weight_ref: rde.weight_ref,
            note: rde.notes,
            sets_data: (rde.routine_day_exercise_sets || []).sort(
              (a, b) => a.set_number - b.set_number
            )
          }))
      }));
    const oc =
      {
        fuerza: '#EF4444',
        estetica: '#EC4899',
        rendimiento: '#3B82F6',
        rehabilitacion: '#10B981',
        general: '#64748B'
      }[routine.objetivo] || '#64748B';

    return `
    <div class="bg-[#161E26] border border-[#1E293B] rounded-[18px] overflow-hidden">
      <div class="h-[3px]" style="background:${oc}"></div>
      <div class="p-4">
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style="background:${oc}18; border:1px solid ${oc}30">
            <span class="material-symbols-rounded text-[22px]" style="color:${oc}; font-variation-settings:'FILL' 1">fitness_center</span>
          </div>
          <div class="flex-1">
            <h2 class="text-base font-bold text-white mb-1.5">${escHtml(routine.name)}</h2>
            <div class="flex gap-1.5 flex-wrap">
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style="background:${oc}15; color:${oc}; border:1px solid ${oc}30">${routine.objetivo || 'general'}</span>
              <span class="text-[10px] font-bold text-slate-500 bg-[#0B1218] px-2 py-0.5 rounded-full border border-[#1E293B]">${days.length} días</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="flex gap-2 overflow-x-auto pb-1 mt-4" id="day-tabs">
      ${days
        .map(
          (d, i) => `
        <button type="button"
          class="day-tab ${i === 0 ? 'active' : ''} ${completedToday.has(d.name) ? 'completed-day' : ''}"
          data-day-idx="${i}">
          ${escHtml(d.name)}${completedToday.has(d.name) ? ' <span style="color:#10B981">✓</span>' : ''}
        </button>`
        )
        .join('')}
    </div>
    <div id="day-panels" class="mt-4">
      ${days.map((d, i) => buildDayPanel(d, i, {}, routine.name, completedToday)).join('')}
    </div>`;
  }

  function buildDayPanel(day, idx, rms, routineName, completedToday = new Set()) {
    // Mostrar botón si hay ejercicios Y el usuario es el alumno dueño de la rutina
    // (profile_id puede haber sido auto-linkeado en este mismo load, por eso también chequeamos role)
    const isStudentOwner = role === 'alumno' || student.profile_id === session.user.id;
    const doneToday = completedToday.has(day.name);
    // Flatten exercises+sets into individual set cards for workout-session
    const flatSets = [];
    day.exercises.forEach((ex) => {
      const numSets = parseInt(ex.sets) || 1;
      // Detectar AMRAP desde el string de reps (ej: '5+', '3+', '1+', 'máx')
      const repsRaw = String(ex.reps || '');
      const isAmrapEx = repsRaw.endsWith('+') || repsRaw === 'máx';
      const repsClean = isAmrapEx && repsRaw !== 'máx' ? repsRaw.slice(0, -1) : repsRaw;

      const sd =
        ex.sets_data && ex.sets_data.length > 0
          ? ex.sets_data
          : Array.from({ length: numSets }, (_, i) => ({
              set_number: i + 1,
              reps_target: isAmrapEx && i === numSets - 1 ? repsClean + '+' : repsClean || '—',
              weight_kg: ex.weight_kg || null,
              rpe_target: ex.rpe || null,
              rir_target: null,
              is_amrap: isAmrapEx && i === numSets - 1
            }));

      sd.forEach((s) => {
        flatSets.push({
          name: ex.name,
          muscle: ex.muscle || null,
          exercise_id: ex.exercise_id || null,
          setNum: s.set_number,
          totalSets: sd.length,
          reps: s.reps_target || repsClean || '—',
          weight_kg: s.weight_kg ?? ex.weight_kg ?? 0,
          rpe_target: s.rpe_target ?? ex.rpe ?? null,
          rir_target: s.rir_target ?? null,
          is_amrap: s.is_amrap || false,
          rest: ex.rest || 90,
          set_notes: s.notes || null
        });
      });
    });

    const startButtonHTML = doneToday
      ? `<div class="w-full py-4 mb-4 rounded-2xl flex items-center justify-center gap-3"
             style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25)">
           <span class="material-symbols-rounded" style="color:#10B981;font-size:22px">check_circle</span>
           <span style="color:#10B981;font-weight:900;font-size:15px">¡Completado hoy!</span>
         </div>`
      : flatSets.length > 0 && isStudentOwner
        ? `<button class="btn-start-workout w-full py-4 mb-4 rounded-2xl bg-[#10B981] text-black text-base font-black shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2 active:scale-95 transition-transform"
            data-routine-name="${escHtml(routineName)}"
            data-day-name="${escHtml(day.name)}"
            data-exercises='${JSON.stringify(flatSets).replace(/'/g, '&apos;')}'>
            <span class="material-symbols-rounded">play_arrow</span> COMENZAR ENTRENAMIENTO (${flatSets.length} series)
        </button>`
        : '';
    return `
    <div class="day-panel flex flex-col gap-3 ${idx === 0 ? '' : 'hidden'}" data-day-idx="${idx}">
      ${startButtonHTML}
      ${day.exercises.length === 0 ? `<div class="text-center py-12 text-slate-500 text-sm border border-dashed border-[#1E293B] rounded-2xl">Sin ejercicios en este día</div>` : day.exercises.map((ex) => buildExCard(ex, rms)).join('')}
    </div>`;
  }

  function buildExCard(ex, rms) {
    const mc = MUSCLE_COLORS[ex.muscle] || '#64748B';

    // Si tiene sets individuales, mostrarlos como tabla
    // Para ejercicios on-the-fly (programas pre-generados), crear sets_data sintético
    if (!ex.sets_data && ex.sets && ex.sets > 0) {
      const numSets = parseInt(ex.sets) || 1;
      const repsRaw = String(ex.reps || '');
      const isAmrapEx = repsRaw.endsWith('+') || repsRaw === 'máx';
      const repsClean = isAmrapEx && repsRaw !== 'máx' ? repsRaw.slice(0, -1) : repsRaw;
      ex.sets_data = Array.from({ length: numSets }, (_, i) => ({
        set_number: i + 1,
        reps_target: isAmrapEx && i === numSets - 1 ? repsClean + '+' : repsClean,
        weight_kg: ex.weight_kg || null,
        rpe_target: ex.rpe || null,
        rir_target: null,
        is_amrap: isAmrapEx && i === numSets - 1
      }));
    }
    const hasSets = ex.sets_data && ex.sets_data.length > 0;

    if (hasSets) {
      const setsHTML = ex.sets_data
        .map((s) => {
          const w =
            s.weight_kg != null
              ? `${s.weight_kg}<span class="text-[9px] text-slate-500 ml-0.5">kg</span>`
              : `<span class="text-slate-600">—</span>`;
          const rpeStr =
            s.rpe_target != null
              ? `<span class="text-[9px] font-mono text-amber-400">RPE ${s.rpe_target}</span>`
              : '';
          const rirStr =
            s.rir_target != null
              ? `<span class="text-[9px] font-mono text-slate-500">RIR ${s.rir_target}</span>`
              : '';
          const amrap = s.is_amrap
            ? `<span class="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1 rounded">AMRAP</span>`
            : '';
          const reps = s.reps_target || '—';
          return `
        <div class="flex items-center gap-2 px-3 py-1.5 border-b border-[#0B1218] last:border-none">
          <span class="text-[10px] font-bold text-slate-600 font-mono w-5 shrink-0">${s.set_number}</span>
          <span class="font-mono text-[12px] font-bold ${reps.includes('+') ? 'text-[#60A5FA]' : 'text-white'} w-10 shrink-0">${reps}</span>
          <span class="font-mono text-[12px] font-bold text-[#60A5FA] flex-1">${w}</span>
          <div class="flex items-center gap-1.5">${rpeStr}${rirStr}${amrap}</div>
        </div>`;
        })
        .join('');

      return `
      <div class="bg-[#161E26] border border-[#1E293B] rounded-2xl overflow-hidden hover:border-[#334155] transition-colors">
        <div class="p-3 flex items-center gap-2.5 border-b border-[#0B1218]">
          <div class="w-1 h-9 rounded-full shrink-0" style="background:${mc}"></div>
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-bold text-white truncate">${escHtml(ex.name)}</div>
            ${ex.muscle ? `<div class="text-[9px] font-bold uppercase tracking-widest mt-0.5" style="color:${mc}">${ex.muscle}</div>` : ''}
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-[10px] text-slate-500 font-mono">${ex.sets_data.length} series</span>
            ${ex.rest ? `<span class="text-[10px] text-slate-500 font-mono">${ex.rest}s</span>` : ''}
          </div>
        </div>
        <div class="flex px-3 py-1 bg-[#0B1218]/80 border-b border-[#060A0E]">
          <span class="text-[8px] font-bold text-slate-700 uppercase w-5 shrink-0">#</span>
          <span class="text-[8px] font-bold text-slate-700 uppercase w-10 shrink-0">Reps</span>
          <span class="text-[8px] font-bold text-slate-700 uppercase flex-1">Peso</span>
          <span class="text-[8px] font-bold text-slate-700 uppercase">Intensidad</span>
        </div>
        ${setsHTML}
        ${ex.note ? `<div class="px-3 pb-2 pt-1 text-[11px] text-slate-400 italic bg-[#0B1218]/50">${escHtml(ex.note)}</div>` : ''}
      </div>`;
    }

    // Fallback: formato compacto para rutinas sin sets individuales
    const weightDisplay =
      ex.weight_kg > 0
        ? `<span class="font-mono text-[#60A5FA] text-sm">${ex.weight_kg}</span><span class="text-[9px] text-slate-500 ml-0.5">KG</span>`
        : `<span class="text-slate-600 text-xs">—</span>`;
    const rpeHTML = ex.rpe
      ? `<span class="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">RPE ${ex.rpe}</span>`
      : '';
    return `
    <div class="bg-[#161E26] border border-[#1E293B] rounded-2xl overflow-hidden hover:border-[#334155] transition-colors">
      <div class="p-3 flex items-center gap-2.5 border-b border-[#0B1218]">
        <div class="w-1 h-9 rounded-full shrink-0" style="background:${mc}"></div>
        <div class="flex-1 min-w-0">
          <div class="text-[13px] font-bold text-white truncate">${escHtml(ex.name)}</div>
          ${ex.muscle ? `<div class="text-[9px] font-bold uppercase tracking-widest mt-0.5" style="color:${mc}">${ex.muscle}</div>` : ''}
        </div>
        ${rpeHTML}
      </div>
      <div class="flex divide-x divide-[#1E293B] bg-[#0B1218]/50">
        <div class="param-pill"><span class="param-label">Series</span><span class="font-mono text-sm font-bold text-white">${ex.sets || '—'}</span></div>
        <div class="param-pill"><span class="param-label">Reps</span><span class="font-mono text-sm font-bold ${ex.reps?.includes('+') ? 'text-[#60A5FA]' : 'text-white'}">${ex.reps || '—'}</span></div>
        <div class="param-pill"><span class="param-label">Peso</span><div class="flex items-baseline">${weightDisplay}</div></div>
        <div class="param-pill"><span class="param-label">Desc.</span><span class="font-mono text-[13px] font-bold text-white">${ex.rest ? ex.rest + 's' : '—'}</span></div>
      </div>
      ${ex.note ? `<div class="px-4 pb-3 pt-1 text-[11px] text-slate-400 italic bg-[#0B1218]/50">${escHtml(ex.note)}</div>` : ''}
    </div>`;
  }

  function buildNoProgram(title, subtitle) {
    return `<div class="flex flex-col items-center justify-center py-20 text-center"><div class="w-16 h-16 rounded-[20px] bg-[#161E26] border border-[#1E293B] flex items-center justify-center mb-4"><span class="material-symbols-rounded text-slate-500 text-[32px]">fitness_center</span></div><h2 class="text-base font-bold text-white mb-1.5">${title}</h2><p class="text-xs text-slate-500 max-w-[260px] leading-relaxed">${subtitle}</p></div>`;
  }

  function bindDayTabs() {
    const tabsContainer = document.getElementById('day-tabs');
    const panelsContainer = document.getElementById('day-panels');
    if (!tabsContainer || !panelsContainer) return;
    tabsContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('.day-tab');
      if (!tab) return;
      const idx = tab.dataset.dayIdx;
      tabsContainer.querySelectorAll('.day-tab').forEach((t) => t.classList.remove('active'));
      panelsContainer.querySelectorAll('.day-panel').forEach((p) => p.classList.add('hidden'));
      tab.classList.add('active');
      panelsContainer
        .querySelector(`.day-panel[data-day-idx="${idx}"]`)
        ?.classList.remove('hidden');
    });
  }

  function getProgramDays(slug, rms, week) {
    const w = week || 1;
    const wFactor = 1 + (w - 1) * 0.025;
    const applyFactor = (kg) => (kg > 0 ? round(kg * wFactor) : 0);
    switch (slug) {
      case 'starting-strength': {
        const sq = applyFactor(pct(rms.sq || 60, 0.55)),
          dl = applyFactor(pct(rms.dl || 80, 0.55)),
          bp = applyFactor(pct(rms.bp || 50, 0.55)),
          ohp = applyFactor(pct(rms.ohp || 35, 0.55)),
          pc = applyFactor(pct(rms.pc || 30, 0.65));
        return [
          {
            name: 'Sesión A',
            exercises: [
              {
                name: 'Sentadilla',
                muscle: 'piernas',
                sets: 3,
                reps: '5',
                rest: 180,
                weight_kg: sq
              },
              {
                name: 'Press Militar',
                muscle: 'hombros',
                sets: 3,
                reps: '5',
                rest: 120,
                weight_kg: ohp
              },
              {
                name: 'Peso Muerto',
                muscle: 'espalda',
                sets: 1,
                reps: '5',
                rest: 180,
                weight_kg: dl
              }
            ]
          },
          {
            name: 'Sesión B',
            exercises: [
              {
                name: 'Sentadilla',
                muscle: 'piernas',
                sets: 3,
                reps: '5',
                rest: 180,
                weight_kg: sq
              },
              {
                name: 'Press Banca',
                muscle: 'pecho',
                sets: 3,
                reps: '5',
                rest: 120,
                weight_kg: bp
              },
              {
                name: 'Power Clean',
                muscle: 'espalda',
                sets: 5,
                reps: '3',
                rest: 120,
                weight_kg: pc
              }
            ]
          }
        ];
      }
      case 'stronglifts-5x5': {
        const sq = applyFactor(pct(rms.sq || 60, 0.5)),
          ohp = applyFactor(pct(rms.ohp || 30, 0.5)),
          bp = applyFactor(pct(rms.bp || 45, 0.5)),
          row = applyFactor(pct(rms.row || 45, 0.5)),
          dl = applyFactor(pct(rms.dl || 80, 0.5));
        return [
          {
            name: 'Sesión A',
            exercises: [
              {
                name: 'Sentadilla',
                muscle: 'piernas',
                sets: 5,
                reps: '5',
                rest: 180,
                weight_kg: sq
              },
              {
                name: 'Press Banca',
                muscle: 'pecho',
                sets: 5,
                reps: '5',
                rest: 120,
                weight_kg: bp
              },
              {
                name: 'Remo con Barra',
                muscle: 'espalda',
                sets: 5,
                reps: '5',
                rest: 120,
                weight_kg: row
              }
            ]
          },
          {
            name: 'Sesión B',
            exercises: [
              {
                name: 'Sentadilla',
                muscle: 'piernas',
                sets: 5,
                reps: '5',
                rest: 180,
                weight_kg: sq
              },
              {
                name: 'Press Militar',
                muscle: 'hombros',
                sets: 5,
                reps: '5',
                rest: 120,
                weight_kg: ohp
              },
              {
                name: 'Peso Muerto',
                muscle: 'espalda',
                sets: 1,
                reps: '5',
                rest: 180,
                weight_kg: dl
              }
            ]
          }
        ];
      }
      case 'wendler-531': {
        const wc = [
          { percs: [0.65, 0.75, 0.85], reps: ['5', '5', '5+'], name: 'Vol 5+' },
          { percs: [0.7, 0.8, 0.9], reps: ['3', '3', '3+'], name: 'Hib 3+' },
          { percs: [0.75, 0.85, 0.95], reps: ['5', '3', '1+'], name: 'Pico 1+' },
          { percs: [0.4, 0.5, 0.6], reps: ['5', '5', '5'], name: 'Deload' }
        ][(w - 1) % 4];
        const TM = {
          sq: round((rms.sq || 120) * 0.9),
          bp: round((rms.bp || 90) * 0.9),
          dl: round((rms.dl || 160) * 0.9),
          ohp: round((rms.ohp || 60) * 0.9)
        };
        const top = (tm, pi) => round(tm * wc.percs[pi]);
        return [
          {
            name: `Día 1 — SQ`,
            exercises: [
              {
                name: 'Sentadilla',
                muscle: 'piernas',
                sets: 1,
                reps: wc.reps[0],
                rest: 180,
                weight_kg: top(TM.sq, 0)
              },
              {
                name: 'Sentadilla',
                muscle: 'piernas',
                sets: 1,
                reps: wc.reps[1],
                rest: 180,
                weight_kg: top(TM.sq, 1)
              },
              {
                name: 'Sentadilla (top)',
                muscle: 'piernas',
                sets: 1,
                reps: wc.reps[2],
                rest: 180,
                weight_kg: top(TM.sq, 2),
                rpe: 9
              },
              {
                name: 'Sentadilla (BBB)',
                muscle: 'piernas',
                sets: 5,
                reps: '10',
                rest: 90,
                weight_kg: round(TM.sq * 0.5)
              }
            ]
          },
          {
            name: `Día 2 — BP`,
            exercises: [
              {
                name: 'Press Banca',
                muscle: 'pecho',
                sets: 1,
                reps: wc.reps[0],
                rest: 180,
                weight_kg: top(TM.bp, 0)
              },
              {
                name: 'Press Banca',
                muscle: 'pecho',
                sets: 1,
                reps: wc.reps[1],
                rest: 180,
                weight_kg: top(TM.bp, 1)
              },
              {
                name: 'Press Banca (top)',
                muscle: 'pecho',
                sets: 1,
                reps: wc.reps[2],
                rest: 180,
                weight_kg: top(TM.bp, 2),
                rpe: 9
              },
              {
                name: 'Press Banca (BBB)',
                muscle: 'pecho',
                sets: 5,
                reps: '10',
                rest: 90,
                weight_kg: round(TM.bp * 0.5)
              }
            ]
          }
        ];
      }
      // ── GZCLP ──────────────────────────────────────────────────
      case 'gzclp': {
        const t1Schemes = ['5×3+', '6×2+', '10×1+'];
        const t2Schemes = ['3×10+', '3×8+', '3×6+'];
        const t1Idx = Math.min(Math.floor((w - 1) / 2), 2);
        const t2Idx = Math.min(Math.floor((w - 1) / 2), 2);
        const t1s = t1Schemes[t1Idx],
          t2s = t2Schemes[t2Idx];
        const t1Perc = [0.85, 0.9, 0.95][t1Idx];
        const t2Perc = [0.65, 0.7, 0.75][t2Idx];

        const sq = applyFactor(pct(rms.sq || 80, t1Perc));
        const hp = applyFactor(pct(rms.hp || 100, t1Perc));
        const bp = applyFactor(pct(rms.bp || 65, t1Perc));
        const pul = applyFactor(pct(rms.pull || 60, t1Perc));
        const sqT2 = applyFactor(pct(rms.sq || 80, t2Perc));
        const hpT2 = applyFactor(pct(rms.hp || 100, t2Perc));
        const bpT2 = applyFactor(pct(rms.bp || 65, t2Perc));

        return [
          {
            name: 'Día A — Lower+Upper',
            exercises: [
              {
                name: 'Sentadilla [T1]',
                muscle: 'piernas',
                sets: 5,
                reps: t1s,
                rest: 240,
                weight_kg: sq,
                rpe: 9
              },
              {
                name: 'Press Horizontal [T2]',
                muscle: 'pecho',
                sets: 3,
                reps: t2s,
                rest: 120,
                weight_kg: bpT2
              },
              {
                name: 'Asistencia [T3]',
                muscle: 'otros',
                sets: 3,
                reps: '15+',
                rest: 60,
                weight_kg: 0
              }
            ]
          },
          {
            name: 'Día B — Upper+Lower',
            exercises: [
              {
                name: 'Press Horiz. [T1]',
                muscle: 'pecho',
                sets: 5,
                reps: t1s,
                rest: 240,
                weight_kg: bp,
                rpe: 9
              },
              {
                name: 'Hip Hinge [T2]',
                muscle: 'espalda',
                sets: 3,
                reps: t2s,
                rest: 120,
                weight_kg: hpT2
              },
              {
                name: 'Asistencia [T3]',
                muscle: 'otros',
                sets: 3,
                reps: '15+',
                rest: 60,
                weight_kg: 0
              }
            ]
          },
          {
            name: 'Día C — Lower+Upper',
            exercises: [
              {
                name: 'Hip Hinge [T1]',
                muscle: 'espalda',
                sets: 5,
                reps: t1s,
                rest: 240,
                weight_kg: hp,
                rpe: 9
              },
              {
                name: 'Sentadilla [T2]',
                muscle: 'piernas',
                sets: 3,
                reps: t2s,
                rest: 120,
                weight_kg: sqT2
              },
              {
                name: 'Asistencia [T3]',
                muscle: 'otros',
                sets: 3,
                reps: '15+',
                rest: 60,
                weight_kg: 0
              }
            ]
          },
          {
            name: 'Día D — Upper+Lower',
            exercises: [
              {
                name: 'Pull Vertical [T1]',
                muscle: 'espalda',
                sets: 5,
                reps: t1s,
                rest: 240,
                weight_kg: pul,
                rpe: 9
              },
              {
                name: 'Press Horizontal [T2]',
                muscle: 'pecho',
                sets: 3,
                reps: t2s,
                rest: 120,
                weight_kg: bpT2
              },
              {
                name: 'Asistencia [T3]',
                muscle: 'otros',
                sets: 3,
                reps: '15+',
                rest: 60,
                weight_kg: 0
              }
            ]
          }
        ];
      }

      // ── Cube Method ────────────────────────────────────────────
      case 'cube-method': {
        const TM = {
          sq: round((rms.sq || 140) * 0.95),
          bp: round((rms.bp || 105) * 0.95),
          dl: round((rms.dl || 185) * 0.95)
        };
        // Rotación semanal: Heavy / Explosive / Reps (cicla cada 3 semanas)
        const rotation = [
          { sq: 'Pesado', bp: 'Reps', dl: 'Explosivo' },
          { sq: 'Reps', bp: 'Pesado', dl: 'Reps' },
          { sq: 'Explosivo', bp: 'Explosivo', dl: 'Pesado' }
        ][(w - 1) % 3];

        const cubeSet = (name, muscle, tm, type) => {
          if (type === 'Pesado')
            return {
              name,
              muscle,
              sets: 5,
              reps: '2',
              rest: 300,
              weight_kg: applyFactor(pct(tm, 0.8)),
              rpe: 9
            };
          if (type === 'Explosivo')
            return {
              name,
              muscle,
              sets: 8,
              reps: '3',
              rest: 120,
              weight_kg: applyFactor(pct(tm, 0.6)),
              rpe: 7
            };
          /* Reps */ return {
            name,
            muscle,
            sets: 1,
            reps: '8+',
            rest: 180,
            weight_kg: applyFactor(pct(tm, 0.7)),
            rpe: 8
          };
        };

        return [
          {
            name: 'Día 1 — Sentadilla',
            exercises: [
              cubeSet('Sentadilla', 'piernas', TM.sq, rotation.sq),
              {
                name: 'Asistencia tren inferior',
                muscle: 'piernas',
                sets: 3,
                reps: '10-12',
                rest: 90,
                weight_kg: 0
              }
            ]
          },
          {
            name: 'Día 2 — Press Banca',
            exercises: [
              cubeSet('Press Banca', 'pecho', TM.bp, rotation.bp),
              {
                name: 'Asistencia tren superior',
                muscle: 'pecho',
                sets: 3,
                reps: '10-12',
                rest: 90,
                weight_kg: 0
              }
            ]
          },
          {
            name: 'Día 3 — Peso Muerto',
            exercises: [
              cubeSet('Peso Muerto', 'espalda', TM.dl, rotation.dl),
              {
                name: 'Asistencia posterior',
                muscle: 'espalda',
                sets: 3,
                reps: '10-12',
                rest: 90,
                weight_kg: 0
              }
            ]
          }
        ];
      }

      // ── PPL (Push / Pull / Legs) ────────────────────────────────
      case 'ppl': {
        const progFactor = 1 + (w - 1) * 0.03;
        const bp = applyFactor(pct((rms.bp || 80) * progFactor, 0.72));
        const inc = applyFactor(pct((rms.bp || 80) * progFactor, 0.65));
        const ohp = applyFactor(pct((rms.bp || 80) * progFactor, 0.62));
        const row = applyFactor(pct((rms.row || 80) * progFactor, 0.72));
        const sq = applyFactor(pct((rms.sq || 100) * progFactor, 0.75));
        const rdl = applyFactor(pct((rms.rdl || 90) * progFactor, 0.72));

        return [
          {
            name: 'Push 1',
            exercises: [
              {
                name: 'Press Banca',
                muscle: 'pecho',
                sets: 4,
                reps: '8-12',
                rest: 180,
                weight_kg: bp
              },
              {
                name: 'Press Inclinado',
                muscle: 'pecho',
                sets: 3,
                reps: '10-12',
                rest: 120,
                weight_kg: inc
              },
              {
                name: 'Press Militar',
                muscle: 'hombros',
                sets: 4,
                reps: '8-12',
                rest: 120,
                weight_kg: ohp
              },
              {
                name: 'Elevaciones Lat.',
                muscle: 'hombros',
                sets: 4,
                reps: '12-15',
                rest: 60,
                weight_kg: 0
              },
              {
                name: 'Extensión Tríceps',
                muscle: 'triceps',
                sets: 3,
                reps: '12-15',
                rest: 60,
                weight_kg: 0
              }
            ]
          },
          {
            name: 'Pull 1',
            exercises: [
              {
                name: 'Jalón al pecho',
                muscle: 'espalda',
                sets: 4,
                reps: '8-12',
                rest: 180,
                weight_kg: 0
              },
              {
                name: 'Remo con barra',
                muscle: 'espalda',
                sets: 4,
                reps: '8-10',
                rest: 180,
                weight_kg: row
              },
              {
                name: 'Remo en cable',
                muscle: 'espalda',
                sets: 3,
                reps: '12',
                rest: 90,
                weight_kg: 0
              },
              {
                name: 'Curl con barra',
                muscle: 'biceps',
                sets: 4,
                reps: '10-12',
                rest: 60,
                weight_kg: 0
              },
              {
                name: 'Curl martillo',
                muscle: 'biceps',
                sets: 3,
                reps: '12',
                rest: 60,
                weight_kg: 0
              }
            ]
          },
          {
            name: 'Legs 1',
            exercises: [
              {
                name: 'Sentadilla',
                muscle: 'piernas',
                sets: 4,
                reps: '6-10',
                rest: 240,
                weight_kg: sq
              },
              {
                name: 'Prensa',
                muscle: 'piernas',
                sets: 3,
                reps: '10-12',
                rest: 120,
                weight_kg: 0
              },
              {
                name: 'P. Muerto Rumano',
                muscle: 'gluteos',
                sets: 4,
                reps: '8-10',
                rest: 180,
                weight_kg: rdl
              },
              {
                name: 'Extensión cuádriceps',
                muscle: 'piernas',
                sets: 3,
                reps: '12-15',
                rest: 60,
                weight_kg: 0
              },
              {
                name: 'Curl femoral',
                muscle: 'piernas',
                sets: 3,
                reps: '12-15',
                rest: 60,
                weight_kg: 0
              }
            ]
          },
          {
            name: 'Push 2',
            exercises: [
              {
                name: 'Press Banca',
                muscle: 'pecho',
                sets: 4,
                reps: '8-12',
                rest: 180,
                weight_kg: bp
              },
              {
                name: 'Press Inclinado',
                muscle: 'pecho',
                sets: 3,
                reps: '10-12',
                rest: 120,
                weight_kg: inc
              },
              {
                name: 'Press Militar',
                muscle: 'hombros',
                sets: 4,
                reps: '8-12',
                rest: 120,
                weight_kg: ohp
              },
              {
                name: 'Elevaciones Lat.',
                muscle: 'hombros',
                sets: 4,
                reps: '12-15',
                rest: 60,
                weight_kg: 0
              },
              { name: 'Fondos', muscle: 'triceps', sets: 3, reps: 'máx', rest: 90, weight_kg: 0 }
            ]
          },
          {
            name: 'Pull 2',
            exercises: [
              {
                name: 'Jalón al pecho',
                muscle: 'espalda',
                sets: 4,
                reps: '8-12',
                rest: 180,
                weight_kg: 0
              },
              {
                name: 'Remo con barra',
                muscle: 'espalda',
                sets: 4,
                reps: '8-10',
                rest: 180,
                weight_kg: row
              },
              { name: 'Face pull', muscle: 'hombros', sets: 3, reps: '15', rest: 60, weight_kg: 0 },
              {
                name: 'Curl con barra',
                muscle: 'biceps',
                sets: 4,
                reps: '10-12',
                rest: 60,
                weight_kg: 0
              },
              {
                name: 'Curl martillo',
                muscle: 'biceps',
                sets: 3,
                reps: '12',
                rest: 60,
                weight_kg: 0
              }
            ]
          },
          {
            name: 'Legs 2',
            exercises: [
              {
                name: 'Sentadilla',
                muscle: 'piernas',
                sets: 4,
                reps: '6-10',
                rest: 240,
                weight_kg: sq
              },
              {
                name: 'Prensa',
                muscle: 'piernas',
                sets: 3,
                reps: '10-12',
                rest: 120,
                weight_kg: 0
              },
              {
                name: 'P. Muerto Rumano',
                muscle: 'gluteos',
                sets: 4,
                reps: '8-10',
                rest: 180,
                weight_kg: rdl
              },
              {
                name: 'Extensión cuádriceps',
                muscle: 'piernas',
                sets: 3,
                reps: '12-15',
                rest: 60,
                weight_kg: 0
              },
              {
                name: 'Elevación talones',
                muscle: 'piernas',
                sets: 4,
                reps: '15-20',
                rest: 45,
                weight_kg: 0
              }
            ]
          }
        ];
      }

      default:
        return [{ name: 'Día 1', exercises: [] }];
    }
  }

  // Delegación Iniciar Entrenamiento
  area?.addEventListener('click', (e) => {
    const startBtn = e.target.closest('.btn-start-workout');
    if (!startBtn) return;
    const payload = {
      routineName: startBtn.dataset.routineName,
      dayName: startBtn.dataset.dayName,
      exercises: JSON.parse(startBtn.dataset.exercises.replace(/&apos;/g, "'"))
    };
    sessionStorage.setItem('pendingWorkout', JSON.stringify(payload));
    window.location.href = 'wellbeing-check.html';
  });
})();
