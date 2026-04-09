/**
 * profesor-dashboard.js
 * TechFitness — Dashboard del Profesor con semáforo de riesgo
 */

await import('./auth-guard.js');

(async () => {
  const session = await window.authGuard(['profesor', 'gim_admin']);
  if (!session) return;

  const role = session.user.raw_app_meta_data?.role || session.user.app_metadata?.role;
  if (role === 'gim_admin') {
    window.location.href = 'admin-dashboard.html';
    return;
  }

  const db = window.supabaseClient;
  const gymId = session.user.app_metadata.gym_id;
  const { toast, escHtml, debounce, logout } = window.tfUtils;

  /* ─── Header Setup ───────────────────────────────────────── */
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('header-date').textContent = new Date().toLocaleDateString(
    'es-AR',
    options
  );
  document.getElementById('user-name').textContent =
    session.user.user_metadata?.full_name || 'Profesor';

  /* ─── State ──────────────────────────────────────────────── */
  let riskData = [];
  let todaySessions = [];
  let activeSessionIds = new Set();
  let currentFilter = 'all';

  /* ─── Helpers ────────────────────────────────────────────── */
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

  function getRiskColor(level) {
    const colors = { red: '#ef4444', yellow: '#f59e0b', green: '#10b981' };
    return colors[level] || colors.green;
  }

  function getWellbeingLabel(score) {
    if (!score || score === 0) return { label: 'Sin datos', color: '#64748b' };
    if (score >= 7) return { label: `${score}/10`, color: '#10b981' };
    if (score >= 4) return { label: `${score}/10`, color: '#f59e0b' };
    return { label: `${score}/10`, color: '#ef4444' };
  }

  function getInactivityColor(days) {
    if (days > 14) return { text: `${days}d`, color: '#ef4444' };
    if (days > 7) return { text: `${days}d`, color: '#f59e0b' };
    return { text: `${days}d`, color: '#64748b' };
  }

  /* ─── Data Loading ───────────────────────────────────────── */
  async function loadRiskData(gymId) {
    const { data: students } = await db
      .from('students')
      .select('id')
      .eq('gym_id', gymId)
      .is('deleted_at', null);

    const studentIds = students?.map((s) => s.id) || [];
    if (!studentIds.length) return [];

    const { data } = await db
      .from('v_athlete_risk')
      .select('*')
      .in('student_id', studentIds)
      .order('risk_score', { ascending: false });

    return data || [];
  }

  async function loadTodaySessions(gymId) {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).toISOString();
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59
    ).toISOString();

    const { data: sessions } = await db
      .from('workout_sessions')
      .select('id, student_id, routine_name, day_name, started_at, completed_at')
      .eq('gym_id', gymId)
      .gte('started_at', startOfDay)
      .lte('started_at', endOfDay)
      .order('started_at', { ascending: false });

    return sessions || [];
  }

  async function loadActiveSessionIds(gymId) {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    const { data } = await db
      .from('workout_sessions')
      .select('student_id')
      .eq('gym_id', gymId)
      .is('completed_at', null)
      .gte('started_at', threeHoursAgo);

    const ids = new Set();
    (data || []).forEach((s) => ids.add(s.student_id));
    return ids;
  }

  async function loadKPIs() {
    const [risk, today, inactive] = await Promise.all([
      loadRiskData(gymId),
      loadTodaySessions(gymId),
      loadActiveSessionIds(gymId)
    ]);

    riskData = risk;
    todaySessions = today;
    activeSessionIds = inactive;

    const riskCount = risk.filter((r) => r.risk_level === 'red').length;
    const todayCount = new Set(today.filter((s) => s.completed_at).map((s) => s.student_id)).size;
    const inactiveCount = risk.filter((r) => r.days_inactive > 7).length;

    document.getElementById('kpi-risk-count').textContent = riskCount;
    document.getElementById('kpi-risk-count').classList.toggle('text-danger', riskCount > 0);
    document.getElementById('kpi-risk-count').classList.toggle('text-slate-400', riskCount === 0);

    document.getElementById('kpi-today-count').textContent = todayCount;

    document.getElementById('kpi-inactive-count').textContent = inactiveCount;
    document
      .getElementById('kpi-inactive-count')
      .classList.toggle('text-warning', inactiveCount > 0);
    document
      .getElementById('kpi-inactive-count')
      .classList.toggle('text-slate-400', inactiveCount === 0);

    renderRiskTable();
    renderTodayActivity();
  }

  /* ─── Renderizado de la tabla de riesgo ──────────────────── */
  function renderRiskTable() {
    const tbody = document.getElementById('risk-table-body');
    const emptyState = document.getElementById('risk-empty-state');
    const noAthletes = document.getElementById('risk-no-athletes');
    const badge = document.getElementById('risk-badge');

    if (!riskData.length) {
      tbody.classList.add('hidden');
      emptyState.classList.add('hidden');
      noAthletes.classList.remove('hidden');
      badge.textContent = '0 requieren atención';
      return;
    }

    const colorWeight = { red: 1, yellow: 2, green: 3 };
    let filtered = riskData;

    if (currentFilter !== 'all') {
      filtered = riskData.filter((r) => r.risk_level === currentFilter);
    }

    filtered.sort((a, b) => colorWeight[a.risk_level] - colorWeight[b.risk_level]);

    const needsAttention = riskData.filter(
      (r) => r.risk_level === 'red' || r.risk_level === 'yellow'
    ).length;
    badge.textContent = `${needsAttention} requieren atención`;

    if (!filtered.length) {
      tbody.classList.add('hidden');
      noAthletes.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    tbody.classList.remove('hidden');
    emptyState.classList.add('hidden');
    noAthletes.classList.add('hidden');

    tbody.innerHTML = filtered
      .map((r) => {
        const initials = (r.full_name || '??').substring(0, 2).toUpperCase();
        const avatarSrc = sanitizeImageSrc(r.avatar_url);
        const riskColor = getRiskColor(r.risk_level);
        const inact = getInactivityColor(r.days_inactive || 0);
        const wellbeing = getWellbeingLabel(r.wellbeing_score);
        const isStagnant = r.stagnant_exercises > 0;
        const isActive = activeSessionIds.has(r.student_id);

        return `
        <div class="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer items-center"
             data-student-id="${r.student_id}">
          <div class="col-span-4 flex items-center gap-3">
            <div class="relative">
              <div class="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center font-bold text-slate-400 shrink-0 overflow-hidden ${isActive ? 'ring-2 ring-success animate-pulse' : ''}">
                ${avatarSrc ? `<img src="${avatarSrc}" class="w-full h-full object-cover" alt="${escHtml(r.full_name)}">` : escHtml(initials)}
              </div>
              ${isActive ? '<div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-bg-dark"></div>' : ''}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-bold text-white truncate"><a href="progress.html?student=${r.student_id}" class="hover:text-primary underline-offset-2 hover:underline">${escHtml(r.full_name)}</a></p>
              ${isActive ? '<p class="text-[10px] text-success font-bold">En sesión</p>' : ''}
            </div>
          </div>
          <div class="col-span-2 text-center">
            <span class="font-mono text-sm font-bold" style="color:${inact.color}">${inact.text}</span>
          </div>
          <div class="col-span-2 text-center">
            <span class="text-xs font-bold ${isStagnant ? 'text-warning' : 'text-success'}">
              ${isStagnant ? 'Estancado' : 'Progresando'}
            </span>
          </div>
          <div class="col-span-2 text-center">
            <span class="font-mono text-sm font-bold" style="color:${wellbeing.color}">${wellbeing.label}</span>
          </div>
          <div class="col-span-2 text-right">
            <span class="status-pill" style="background:${riskColor}20;color:${riskColor};border:1px solid ${riskColor}30">
              ${r.risk_level === 'red' ? 'Rojo' : r.risk_level === 'yellow' ? 'Amarillo' : 'Verde'}
            </span>
            <span class="text-[10px] text-slate-500 ml-1 font-mono">${r.risk_score}</span>
          </div>
        </div>
      `;
      })
      .join('');
  }

  /* ─── Renderizado de actividad de hoy ──────────────────────── */
  function renderTodayActivity() {
    const listEl = document.getElementById('today-activity-list');
    const emptyEl = document.getElementById('today-activity-empty');
    const viewAllEl = document.getElementById('today-activity-view-all');

    if (!todaySessions.length) {
      listEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      viewAllEl.classList.add('hidden');
      return;
    }

    listEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');

    const recentSessions = todaySessions.slice(0, 5);

    listEl.innerHTML = recentSessions
      .map((s) => {
        const time = new Date(s.started_at).toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit'
        });
        const initials = (s.student_id?.substring(0, 2) || '??').toUpperCase();
        return `
        <div class="mini-session-card">
          <div class="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
            ${initials}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold text-white truncate">Atleta</p>
            <p class="text-[10px] text-slate-500">${time}</p>
          </div>
        </div>
      `;
      })
      .join('');

    if (todaySessions.length > 5) {
      viewAllEl.classList.remove('hidden');
    } else {
      viewAllEl.classList.add('hidden');
    }
  }

  /* ─── Event Handlers ──────────────────────────────────────── */
  document.querySelectorAll('.filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderRiskTable();
    });
  });

  document.getElementById('risk-table-body').addEventListener('click', (e) => {
    const row = e.target.closest('[data-student-id]');
    if (row) {
      const studentId = row.dataset.studentId;
      window.location.href = `progress.html?student=${studentId}`;
    }
  });

  /* ─── Init ───────────────────────────────────────────────── */
  await loadKPIs();
  setInterval(loadKPIs, 60000);
})();
