/**
 * progress.js  — TechFitness
 * Rediseño: 3 zonas, sin tabs, speedometers SVG, sparklines inline.
 */

(async () => {
  const session = await window.authGuard(['gim_admin', 'profesor', 'alumno']);
  if (!session) return;

  const db = window.supabaseClient;
  const gymId = session.user.app_metadata?.gym_id;
  const role = session.user.app_metadata?.role;
  function escHtml(s) {
    return window.tfUtils?.escHtml?.(s) ?? (s ? String(s) : '');
  }
  function toast(m, t) {
    window.tfUtils?.toast?.(m, t);
  }
  function debounce(f, w) {
    return window.tfUtils?.debounce?.(f, w) || f;
  }

  let selectedStudentId = null;
  let expandChart = null;
  let activeExRow = null;

  function repsToNumber(value) {
    const match = String(value ?? '').match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  const urlStudentId = new URLSearchParams(window.location.search).get('student');

  function normalizeStudentRow(row) {
    const fullName = row.full_name || row.name || row.display_name || row.email || 'Atleta';
    return { ...row, full_name: fullName };
  }

  /* ── MOCK DATA (DB vacía) ─────────────────────────────────── */
  const MOCK_EXERCISES = [
    {
      name: 'Sentadilla',
      muscle: 'piernas',
      allTimePR: 100,
      data: [
        { d: '3 mar', w: 80 },
        { d: '7 mar', w: 82.5 },
        { d: '11 mar', w: 87.5 },
        { d: '14 mar', w: 90 },
        { d: '18 mar', w: 90 },
        { d: '21 mar', w: 95 },
        { d: '24 mar', w: 92.5 },
        { d: '25 mar', w: 95 }
      ]
    },
    {
      name: 'Press de Banco',
      muscle: 'pecho',
      allTimePR: 75,
      data: [
        { d: '3 mar', w: 60 },
        { d: '7 mar', w: 62.5 },
        { d: '11 mar', w: 65 },
        { d: '14 mar', w: 65 },
        { d: '18 mar', w: 67.5 },
        { d: '21 mar', w: 70 },
        { d: '24 mar', w: 70 },
        { d: '25 mar', w: 72.5 }
      ]
    },
    {
      name: 'Peso Muerto',
      muscle: 'espalda',
      allTimePR: 120,
      data: [
        { d: '3 mar', w: 100 },
        { d: '7 mar', w: 105 },
        { d: '11 mar', w: 110 },
        { d: '14 mar', w: 115 },
        { d: '18 mar', w: 120 },
        { d: '25 mar', w: 120 }
      ]
    },
    {
      name: 'Press Militar',
      muscle: 'hombros',
      allTimePR: 55,
      data: [
        { d: '3 mar', w: 42.5 },
        { d: '7 mar', w: 45 },
        { d: '11 mar', w: 47.5 },
        { d: '18 mar', w: 47.5 },
        { d: '21 mar', w: 50 },
        { d: '25 mar', w: 52.5 }
      ]
    },
    {
      name: 'Jalón al Pecho',
      muscle: 'espalda',
      allTimePR: 65,
      data: [
        { d: '7 mar', w: 55 },
        { d: '11 mar', w: 60 },
        { d: '18 mar', w: 62.5 },
        { d: '21 mar', w: 65 }
      ]
    },
    {
      name: 'Curl de Bíceps',
      muscle: 'biceps',
      allTimePR: 32.5,
      data: [
        { d: '3 mar', w: 25 },
        { d: '7 mar', w: 27.5 },
        { d: '14 mar', w: 27.5 },
        { d: '21 mar', w: 30 },
        { d: '25 mar', w: 32.5 }
      ]
    }
  ];
  const MOCK_SESSIONS = 8;
  const MOCK_WEEK_DONE = 3;
  const MOCK_WEEK_GOAL = 4;

  /* ── MUSCLE COLORS ────────────────────────────────────────── */
  const MUSCLE_COLOR = {
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

  /* ── KEY EXERCISE CARD (CSS progress bar — no SVG arc) ───── */
  function barColor(pct) {
    if (pct >= 100) return '#F59E0B';
    if (pct >= 80) return '#10B981';
    if (pct >= 60) return '#F59E0B';
    return '#3B82F6';
  }

  function buildGaugeSVG(name, current, pr) {
    // renamed kept for compatibility — now renders a CSS bar card
    const pct = pr > 0 ? Math.min(Math.round((current / pr) * 100), 100) : 0;
    const color = barColor(pct);
    const isPR = current >= pr && pr > 0;
    const delta = pr > 0 && current < pr ? (pr - current).toFixed(1) : null;

    return `
    <div class="gauge-card ${isPR ? 'is-pr' : ''}">
      <!-- Muscle name -->
      <p class="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-3 truncate">${escHtml(name)}</p>

      <!-- Big weight number -->
      <div class="flex items-end gap-1.5 mb-1">
        <span class="font-mono font-black text-[28px] leading-none ${isPR ? 'text-amber-400' : 'text-white'}">${current}</span>
        <span class="font-mono text-xs text-slate-500 mb-1">kg</span>
        ${isPR ? '<span class="text-sm mb-1">🏆</span>' : ''}
      </div>

      <!-- Progress bar -->
      <div class="relative h-2 rounded-full bg-[#1E293B] overflow-hidden mb-2">
        <div class="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
             style="width:${pct}%; background:${color}"></div>
      </div>

      <!-- PR row -->
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-mono font-bold" style="color:${color}">${pct}%</span>
        <span class="text-[10px] text-slate-500">
          PR <span class="font-mono font-bold text-[#60A5FA]">${pr} kg</span>
          ${delta ? `<span class="text-slate-700"> · −${delta} kg</span>` : ''}
        </span>
      </div>
    </div>`;
  }

  /* ── SPARKLINE SVG ────────────────────────────────────────── */
  function buildSparkline(data, color) {
    const vals = data.map((d) => d.w);
    if (vals.length < 2) return `<span class="text-slate-600 text-[10px]">— sin datos</span>`;
    const min = Math.min(...vals),
      max = Math.max(...vals);
    const range = max - min || 1;
    const W = 80,
      H = 32,
      PAD = 4;
    const pts = vals
      .map((v, i) => {
        const x = PAD + (i / (vals.length - 1)) * (W - PAD * 2);
        const y = PAD + (1 - (v - min) / range) * (H - PAD * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    // Tiny area fill for sparkline
    const lastX = PAD + (W - PAD * 2);
    const areaD = `M ${pts.split(' ')[0].split(',')[0]} ${H} L ${pts
      .split(' ')
      .map((p) => p)
      .join(' L ')} L ${lastX} ${H} Z`;
    return `<svg viewBox="0 0 ${W} ${H}" width="80" height="32" style="overflow:visible">
      <path d="${areaD}" fill="${color}" opacity=".08"/>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${pts.split(' ').at(-1).split(',')[0]}" cy="${pts.split(' ').at(-1).split(',')[1]}" r="2.5" fill="${color}"/>
    </svg>`;
  }

  /* ── EXERCISE LIST ROW ────────────────────────────────────── */
  function buildExRow(ex, idx) {
    const vals = ex.data.map((d) => d.w);
    const current = vals[vals.length - 1] || 0;
    const pr = ex.allTimePR || Math.max(...vals);
    const first = vals[0] || current;
    const delta = first > 0 ? (((current - first) / first) * 100).toFixed(1) : null;
    const color = MUSCLE_COLOR[ex.muscle] || '#64748B';
    const spark = buildSparkline(ex.data, color);
    const deltaStr =
      delta != null
        ? `<span class="text-[10px] font-mono font-bold ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-500'}">${delta > 0 ? '+' : ''}${delta}%</span>`
        : '';

    return `
    <div class="ex-row" data-idx="${idx}" id="ex-row-${idx}">
      <div class="dot" style="background:${color}"></div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold text-white truncate">${escHtml(ex.name)}</p>
        <p class="text-[10px] text-slate-500">${ex.data.length} sesión${ex.data.length !== 1 ? 'es' : ''} · ${ex.muscle}</p>
      </div>
      <div class="flex items-center gap-4 shrink-0">
        ${deltaStr}
        <div class="text-right hidden sm:block">
          <p class="text-[9px] text-slate-600">ACTUAL</p>
          <p class="text-sm font-black font-mono text-white">${current}kg</p>
        </div>
        <div class="text-right">
          <p class="text-[9px] text-slate-600">PR</p>
          <p class="text-sm font-black font-mono text-[#60A5FA]">${pr}kg</p>
        </div>
        ${spark}
        <span class="material-symbols-rounded text-slate-600 text-[16px] shrink-0">expand_more</span>
      </div>
    </div>`;
  }

  /* ── EXPAND FULL CHART ────────────────────────────────────── */
  function expandExercise(ex, rowEl) {
    // Toggle off
    if (activeExRow === rowEl) {
      rowEl.classList.remove('active');
      document.getElementById('expand-chart-wrap').classList.add('hidden');
      activeExRow = null;
      return;
    }
    if (activeExRow) activeExRow.classList.remove('active');
    activeExRow = rowEl;
    rowEl.classList.add('active');

    const vals = ex.data.map((d) => d.w);
    const labels = ex.data.map((d) => d.d || d.date || '');
    const pr = ex.allTimePR || Math.max(...vals);
    const color = MUSCLE_COLOR[ex.muscle] || '#3B82F6';

    document.getElementById('expand-chart-title').textContent = ex.name;
    document.getElementById('expand-chart-pr').textContent = `PR: ${pr} kg`;

    const wrap = document.getElementById('expand-chart-wrap');
    wrap.classList.remove('hidden');
    // Scroll to it
    setTimeout(() => wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);

    const ctx = document.getElementById('expand-chart').getContext('2d');
    if (expandChart) expandChart.destroy();

    const grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, color + '33');
    grad.addColorStop(1, 'transparent');

    expandChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            data: vals,
            borderColor: color,
            backgroundColor: grad,
            borderWidth: 3,
            pointBackgroundColor: vals.map((v) => (v >= pr ? '#F59E0B' : color)),
            pointBorderColor: '#0B1218',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 8,
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#161E26',
            titleColor: '#94A3B8',
            bodyColor: '#F8FAFC',
            borderColor: '#1E293B',
            borderWidth: 1,
            cornerRadius: 10,
            padding: 10,
            displayColors: false,
            callbacks: { label: (c) => `  ${c.raw} kg${c.raw >= pr ? '  🏆 PR' : ''}` }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#64748B', font: { size: 10 } } },
          y: {
            grid: { color: 'rgba(30,41,59,.3)' },
            ticks: {
              color: '#64748B',
              font: { size: 10, family: 'IBM Plex Mono' },
              callback: (v) => v + 'kg'
            }
          }
        }
      }
    });
  }

  /* ── CONSISTENCY RING ─────────────────────────────────────── */
  function buildConsistencyRing(done, target) {
    const r = 36,
      cx = 44,
      cy = 44;
    const circ = 2 * Math.PI * r;
    const pct = Math.min(done / target, 1);
    const offset = circ * (1 - pct);
    const color = pct >= 1 ? '#10B981' : pct >= 0.6 ? '#F59E0B' : '#3B82F6';

    return `<svg viewBox="0 0 88 88" width="88" height="88">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1E293B" stroke-width="8"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="8"
        stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${circ.toFixed(1)}"
        stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
        class="consistency-ring" style="transition:stroke-dashoffset .8s ease"/>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="IBM Plex Mono"
        font-size="18" font-weight="700" fill="white">${done}</text>
      <text x="${cx}" y="${cy + 11}" text-anchor="middle" font-family="Space Grotesk"
        font-size="10" fill="#475569">/ ${target}</text>
    </svg>`;
  }

  /* ── STAGNATION ROW ───────────────────────────────────────── */
  function buildStagRow(ex) {
    return `
    <div class="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
      <span class="material-symbols-rounded text-amber-400 text-[16px]" style="font-variation-settings:'FILL' 1">warning</span>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-bold text-white truncate">${escHtml(ex.exercise_name)}</p>
        <p class="text-[10px] text-slate-500">${ex.sessions_tracked} sesiones sin mejora</p>
      </div>
      <span class="text-[10px] font-mono text-amber-400 shrink-0">${ex.progress_pct > 0 ? '+' : ''}${(ex.progress_pct || 0).toFixed(1)}%</span>
    </div>`;
  }

  /* ═══════════════════════════════════════════════════════════
     LOAD ANALYTICS — corazón del módulo
  ═══════════════════════════════════════════════════════════ */
  async function loadAnalytics(studentId) {
    selectedStudentId = studentId;
    document.getElementById('empty-state')?.classList.add('hidden');
    document.getElementById('analytics-content')?.classList.remove('hidden');

    // Reset charts/expand
    if (expandChart) {
      expandChart.destroy();
      expandChart = null;
    }
    document.getElementById('expand-chart-wrap')?.classList.add('hidden');
    activeExRow = null;

    const weekCutoff = new Date();
    weekCutoff.setDate(weekCutoff.getDate() - 7);
    const monthCutoff = new Date();
    monthCutoff.setDate(monthCutoff.getDate() - 30);

    let sessData = [];
    let logsData = [];
    let stagData = [];
    let exerciseLogsData = [];
    let queryFailed = false;

    /* ─── Fetch en paralelo ─────────────────────────────── */
    try {
      const { data: sessionIdsRaw, error: sessionIdsError } = await db
        .from('workout_sessions')
        .select('id')
        .eq('student_id', studentId)
        .not('completed_at', 'is', null);
      if (sessionIdsError) throw sessionIdsError;
      const sessionIds = (sessionIdsRaw || []).map((s) => s.id);

      const results = await Promise.allSettled([
        db
          .from('workout_sessions')
          .select('id, completed_at')
          .eq('student_id', studentId)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false }),

        sessionIds.length
          ? db
              .from('v_exercise_progress')
              .select('exercise_name, muscle_group, session_date, max_weight, session_id')
              .eq('student_id', studentId)
              .eq('gym_id', gymId)
              .order('session_date', { ascending: true })
          : Promise.resolve({ data: [] }),

        db
          .from('v_stagnation_check')
          .select(
            'exercise_name, muscle_group, is_stagnant, progress_pct, sessions_tracked:sessions_with_data'
          )
          .eq('student_id', studentId)
          .eq('gym_id', gymId),

        db
          .from('exercise_logs')
          .select('exercise_name, performed_at, actual_weight_kg, actual_reps, rpe_reported')
          .eq('student_id', studentId)
          .eq('gym_id', gymId)
          .order('performed_at', { ascending: true })
      ]);

      const [sessionsRes, logsRes, stagRes, exerciseLogsRes] = results;
      if (sessionsRes.status === 'fulfilled' && !sessionsRes.value.error)
        sessData = sessionsRes.value.data || [];
      else queryFailed = true;

      if (logsRes.status === 'fulfilled' && !logsRes.value.error)
        logsData = logsRes.value.data || [];
      else queryFailed = true;

      if (stagRes.status === 'fulfilled' && !stagRes.value.error)
        stagData = stagRes.value.data || [];
      else queryFailed = true;

      if (exerciseLogsRes.status === 'fulfilled' && !exerciseLogsRes.value.error)
        exerciseLogsData = exerciseLogsRes.value.data || [];
    } catch (error) {
      console.error('❌ Error cargando progreso:', error.message || error);
      queryFailed = true;
    }

    /* ─── Decidir si usar mock ──────────────────────────── */
    const useMock = queryFailed || sessData.length === 0;
    const exercises = useMock ? MOCK_EXERCISES : buildExerciseData(logsData);
    const totalSessions = useMock ? MOCK_SESSIONS : sessData.length;
    const weekDone = useMock
      ? MOCK_WEEK_DONE
      : sessData.filter((s) => new Date(s.completed_at) >= weekCutoff).length;
    const weekGoal = 4; // target semanal

    if (useMock) {
      const msg = queryFailed
        ? 'No pudimos cargar datos reales. Mostrando ejemplo para que puedas visualizar progreso.'
        : 'Mostrando datos de ejemplo — completá sesiones para ver datos reales';
      toast(msg, 'info');
    }

    /* ─── KPIs en header ────────────────────────────────── */
    document.getElementById('kpi-sessions').textContent = totalSessions;
    document.getElementById('kpi-consistency').textContent = `${weekDone}/${weekGoal}`;
    document.getElementById('kpi-stag').textContent = useMock
      ? 1
      : stagData.filter((s) => s.is_stagnant).length;
    document.getElementById('header-kpis')?.classList.remove('hidden');

    /* ─── ZONA 1: Speedometers ──────────────────────────── */
    renderGauges(exercises);

    /* ─── ZONA 2: Exercise list ─────────────────────────── */
    renderExerciseList(exercises);

    renderSessionTonnageTrend(exerciseLogsData);

    /* ─── ZONA 3: Consistency + Stagnation ──────────────── */
    renderConsistency(weekDone, weekGoal, sessData, useMock);
    const derivedStagnation = deriveStagnationFromExerciseLogs(exerciseLogsData);
    renderStagnation(useMock
      ? [
          {
            exercise_name: 'Press de Banco',
            is_stagnant: true,
            progress_pct: 0,
            sessions_tracked: 3
          }
        ]
      : [...stagData, ...derivedStagnation]);
  }

  function renderSessionTonnageTrend(exerciseLogsData) {
    if (!Array.isArray(exerciseLogsData) || !exerciseLogsData.length) return;
    const byDay = {};
    exerciseLogsData.forEach((log) => {
      const day = String(log.performed_at || '').slice(0, 10);
      if (!day) return;
      const weight = Number(log.actual_weight_kg || 0);
      const reps = repsToNumber(log.actual_reps);
      byDay[day] = (byDay[day] || 0) + weight * reps;
    });
    const points = Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, total]) => ({ day, total: Math.round(total) }));
    if (!points.length) return;

    document.getElementById('expand-chart-wrap')?.classList.remove('hidden');
    document.getElementById('expand-chart-title').textContent = 'Evolución de tonelaje por sesión';
    document.getElementById('expand-chart-pr').textContent = `Máximo: ${Math.max(...points.map((p) => p.total)).toLocaleString('es-AR')} kg`;
    if (expandChart) expandChart.destroy();
    const ctx = document.getElementById('expand-chart').getContext('2d');
    expandChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: points.map((p) => p.day.slice(5)),
        datasets: [
          {
            label: 'Total Kg',
            data: points.map((p) => p.total),
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59,130,246,0.15)',
            tension: 0.35,
            borderWidth: 2,
            fill: true
          }
        ]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { color: '#64748B' }, grid: { color: 'rgba(30,41,59,.5)' } },
          x: { ticks: { color: '#64748B' }, grid: { display: false } }
        }
      }
    });
  }

  function deriveStagnationFromExerciseLogs(exerciseLogsData) {
    if (!Array.isArray(exerciseLogsData) || !exerciseLogsData.length) return [];
    const byExerciseSession = {};
    exerciseLogsData.forEach((log) => {
      const ex = log.exercise_name;
      const day = String(log.performed_at || '').slice(0, 10);
      if (!ex || !day) return;
      const key = `${ex}__${day}`;
      byExerciseSession[key] = (byExerciseSession[key] || 0) + Number(log.actual_weight_kg || 0) * repsToNumber(log.actual_reps);
    });

    const byExercise = {};
    Object.entries(byExerciseSession).forEach(([key, total]) => {
      const [exercise, day] = key.split('__');
      byExercise[exercise] ||= [];
      byExercise[exercise].push({ day, total });
    });

    return Object.entries(byExercise)
      .map(([exercise_name, sessions]) => {
        const sorted = sessions.sort((a, b) => b.day.localeCompare(a.day)).slice(0, 3);
        if (sorted.length < 3) return null;
        const [s1, s2, s3] = sorted;
        const stagnant = s1.total <= s2.total && s2.total <= s3.total;
        if (!stagnant) return null;
        return {
          exercise_name,
          is_stagnant: true,
          progress_pct: s3.total > 0 ? ((s1.total - s3.total) / s3.total) * 100 : 0,
          sessions_tracked: 3
        };
      })
      .filter(Boolean);
  }

  /* ─── Build exercise data from v_exercise_progress ────────── */
  function buildExerciseData(logs) {
    const byEx = {};
    logs.forEach((row) => {
      if (!byEx[row.exercise_name]) {
        byEx[row.exercise_name] = {
          name: row.exercise_name,
          muscle: row.muscle_group || 'otros',
          data: [],
          allTimePR: 0
        };
      }
      byEx[row.exercise_name].data.push({ d: row.session_date, w: parseFloat(row.max_weight) });
      if (row.max_weight > byEx[row.exercise_name].allTimePR)
        byEx[row.exercise_name].allTimePR = parseFloat(row.max_weight);
    });
    return Object.values(byEx)
      .filter((e) => e.data.length >= 1)
      .sort((a, b) => b.data.length - a.data.length);
  }

  /* ─── ZONA 1 render ──────────────────────────────────────── */
  function renderGauges(exercises) {
    const grid = document.getElementById('gauges-grid');
    const top4 = exercises.slice(0, 4);

    if (!top4.length) {
      grid.innerHTML = `<div class="col-span-2 lg:col-span-4 text-center py-12 text-slate-600">
        <span class="material-symbols-rounded text-[40px] mb-2 block">fitness_center</span>
        <p class="text-sm">Sin ejercicios con datos de peso</p>
      </div>`;
      return;
    }

    grid.innerHTML = top4
      .map((ex) => {
        const vals = ex.data.map((d) => d.w);
        const current = vals[vals.length - 1] || 0;
        const pr = ex.allTimePR || Math.max(...vals);
        return buildGaugeSVG(ex.name, current, pr);
      })
      .join('');

    // Animate gauge fills on load
    requestAnimationFrame(() => {
      document.querySelectorAll('#gauges-grid .gauge-card').forEach((card, i) => {
        // Cards are already rendered with SVG paths — animation is CSS/SVG native
      });
    });
  }

  /* ─── ZONA 2 render ──────────────────────────────────────── */
  function renderExerciseList(exercises) {
    const listEl = document.getElementById('exercise-list');
    const filtered = exercises.filter((e) => e.data.length >= 1);

    if (!filtered.length) {
      listEl.innerHTML = `<p class="text-sm text-slate-500 text-center py-8">Sin ejercicios registrados</p>`;
      return;
    }

    listEl.innerHTML = filtered.map((ex, i) => buildExRow(ex, i)).join('');

    listEl.querySelectorAll('.ex-row').forEach((row) => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.dataset.idx);
        expandExercise(filtered[idx], row);
      });
    });
  }

  /* ─── ZONA 3: Consistency ─────────────────────────────────── */
  function renderConsistency(done, target, sessData, useMock) {
    document.getElementById('consistency-ring-wrap').innerHTML = buildConsistencyRing(done, target);
    document.getElementById('consistency-label').textContent =
      `${done} sesión${done !== 1 ? 'es' : ''} esta semana`;

    const totalMonthSessions = useMock ? 8 : sessData.length;
    document.getElementById('consistency-sub').textContent =
      `${totalMonthSessions} sesiones en el último mes · Meta: ${target}/semana`;

    // 7-day dot heatmap
    const dotsEl = document.getElementById('consistency-dots');
    const today = new Date();
    const dots = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - 6 + i);
      const dateStr = d.toISOString().slice(0, 10);
      const trained = useMock
        ? [0, 2, 5].includes(i) // Mon, Wed, Sat
        : sessData.some((s) => s.completed_at?.slice(0, 10) === dateStr);
      const isToday = i === 6;
      return `<div class="w-6 h-6 rounded-md transition-colors ${trained ? 'bg-primary' : 'bg-[#1E293B]'} ${isToday ? 'ring-1 ring-slate-500' : ''}" title="${dateStr}"></div>`;
    });
    dotsEl.innerHTML = dots.join('');

    // Animate ring after render
    setTimeout(() => {
      const ring = document.querySelector('.consistency-ring');
      if (!ring) return;
      const circ = 2 * Math.PI * 36;
      ring.style.strokeDashoffset = (circ * (1 - Math.min(done / target, 1))).toFixed(1);
    }, 100);
  }

  /* ─── ZONA 3: Stagnation ──────────────────────────────────── */
  function renderStagnation(stagData) {
    const listEl = document.getElementById('stagnation-list');
    const okEl = document.getElementById('stagnation-ok');
    const stagnantMap = new Map();
    (stagData || [])
      .filter((s) => s.is_stagnant)
      .forEach((s) => {
        const key = s.exercise_name || `stag-${stagnantMap.size}`;
        if (!stagnantMap.has(key)) stagnantMap.set(key, s);
      });
    const stagnant = Array.from(stagnantMap.values());

    if (!stagnant.length) {
      listEl.innerHTML = '';
      okEl.classList.remove('hidden');
      return;
    }

    okEl.classList.add('hidden');
    listEl.innerHTML = stagnant.slice(0, 3).map(buildStagRow).join('');

    // Auto-progression suggestions
    const progEl = document.getElementById('progression-list');
    progEl.innerHTML = stagnant
      .slice(0, 2)
      .map(
        (ex) => `
      <div class="flex items-start gap-2 p-2.5 rounded-xl bg-[#0B1218] border border-[#1E293B] mt-1">
        <span class="material-symbols-rounded text-[#3B82F6] text-[14px] mt-0.5" style="font-variation-settings:'FILL' 1">auto_fix</span>
        <p class="text-[10px] text-slate-400">
          <span class="font-bold text-slate-200">${escHtml(ex.exercise_name)}:</span>
          Intentá cambiar el rango de repeticiones o bajar 5–10% de carga y buscar fatiga real.
        </p>
      </div>`
      )
      .join('');
  }

  /* ═══════════════════════════════════════════════════════════
     STUDENT PICKER
  ═══════════════════════════════════════════════════════════ */
  const dropdown = document.getElementById('student-picker-dropdown');
  const listEl = document.getElementById('student-picker-list');
  const searchInp = document.getElementById('student-search-input');
  let allStudents = [];

  // Auto-load if alumno
  if (role === 'alumno') {
    let student = null;
    const { data: byProfile } = await db
      .from('students')
      .select('id, full_name')
      .eq('profile_id', session.user.id)
      .is('deleted_at', null)
      .maybeSingle();
    student = byProfile;

    if (!student && gymId && session.user.email) {
      const { data: byEmail } = await db
        .from('students')
        .select('id, full_name')
        .eq('gym_id', gymId)
        .eq('email', session.user.email)
        .is('deleted_at', null)
        .maybeSingle();
      student = byEmail;
    }

    if (student) {
      document.getElementById('student-picker-label').textContent = student.full_name;
      document.getElementById('btn-empty-picker')?.classList.add('hidden');
      document.getElementById('empty-state')?.classList.add('hidden');
      await loadAnalytics(student.id);
    }
  } else {
    const { data, error } = await db
      .from('students')
      .select('id, full_name, membership_status')
      .eq('gym_id', gymId)
      .is('deleted_at', null)
      .order('full_name');
    allStudents = (data || []).map(normalizeStudentRow);

    if (error || allStudents.length === 0) {
      const fallback = await db
        .from('profiles')
        .select('id, full_name, email')
        .eq('gym_id', gymId)
        .eq('role', 'alumno')
        .is('deleted_at', null)
        .order('full_name');
      allStudents = (fallback.data || []).map(normalizeStudentRow);
    }

    if (urlStudentId) {
      const preselected = allStudents.find((s) => String(s.id) === String(urlStudentId));
      if (preselected) {
        document.getElementById('student-picker-label').textContent = preselected.full_name;
        await loadAnalytics(preselected.id);
      }
    }
  }

  function openPicker(e) {
    renderPickerList(allStudents);
    if (e?.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      dropdown.style.top = rect.bottom + 8 + 'px';
      dropdown.style.left = rect.left + 'px';
    }
    dropdown.classList.remove('hidden');
    setTimeout(() => searchInp?.focus(), 50);
  }
  function closePicker() {
    dropdown?.classList.add('hidden');
  }

  document.getElementById('btn-empty-picker')?.addEventListener('click', openPicker);
  document.addEventListener('click', (e) => {
    if (!dropdown?.contains(e.target) && !e.target.closest('#btn-empty-picker')) closePicker();
  });
  searchInp?.addEventListener(
    'input',
    debounce((e) => {
      const q = e.target.value.toLowerCase();
      renderPickerList(allStudents.filter((s) => s.full_name.toLowerCase().includes(q)));
    }, 200)
  );

  function renderPickerList(students) {
    if (!listEl) return;
    if (!students.length) {
      listEl.innerHTML = `
        <div class="px-3 py-6 text-center text-xs text-slate-500">
          No hay alumnos disponibles para seleccionar.
        </div>`;
      return;
    }
    listEl.innerHTML = students
      .map(
        (s) => `
      <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-[#1E293B] transition-colors" data-id="${s.id}" data-name="${escHtml(s.full_name)}">
        <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0">
          ${s.full_name.charAt(0).toUpperCase()}
        </div>
        <span class="text-sm font-bold text-slate-200">${escHtml(s.full_name)}</span>
      </div>`
      )
      .join('');

    listEl.querySelectorAll('[data-id]').forEach((el) => {
      el.addEventListener('click', () => {
        document.getElementById('student-picker-label').textContent = el.dataset.name;
        closePicker();
        loadAnalytics(el.dataset.id);
      });
    });
  }
})();
