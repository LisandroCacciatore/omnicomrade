/**
 * profesor-dashboard.js
 * TechFitness — Dashboard del Semáforo (Traffic Light)
 */

(async () => {
    const session = await window.authGuard(['profesor', 'gim_admin']);
    if (!session) return;
    
    const db = window.supabaseClient;
    const gymId = session.user.app_metadata.gym_id;
    const { toast, escHtml, debounce, logout } = window.tfUtils;

    // Header date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('header-date').textContent = new Date().toLocaleDateString('es-AR', options);
    document.getElementById('user-name').textContent = session.user.user_metadata?.full_name || 'Profesor';
    document.getElementById('logout-btn').addEventListener('click', logout);

    /* ─── State ──────────────────────────────────────────────── */
    let studentsWithStatus = [];
    let currentFilter = 'all';
    let searchQuery = '';

    /* ─── DOM Elements ───────────────────────────────────────── */
    const listEl = document.getElementById('students-list');
    const drawer = document.getElementById('drawer');
    const backdrop = document.getElementById('drawer-backdrop');

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

    /* ─── Carga y Cálculo de Semáforo ────────────────────────── */
    async function loadDashboard() {
        const db = window.supabaseClient;

        // Una sola query que ya trae risk_level, risk_reason y datos de bienestar
        const { data: riskData, error } = await db
            .from('v_athlete_risk')
            .select(`
                student_id, full_name, avatar_url,
                risk_level, risk_reason, risk_score,
                wellbeing_score, avg_sleep, avg_pain, avg_energy,
                wellbeing_checks, last_check_at,
                current_week_sets, avg_weekly_sets, volume_spike_pct,
                days_since_last, last_completed_at,
                stagnant_exercises
            `)
            .eq('gym_id', gymId)
            .order('risk_score', { ascending: false });

        if (error || !riskData) {
            toast('Error al cargar datos', 'error');
            return;
        }

        // Mapear al formato que espera renderList()
        const STATUS_MAP = {
            red:    { color: 'red',    label: 'Riesgo / Sobrecarga',  textClass: 'text-[#EF4444]', bgClass: 'bg-[#EF4444]/10 border-[#EF4444]/30' },
            yellow: { color: 'yellow', label: 'Requiere atención',    textClass: 'text-[#F59E0B]', bgClass: 'bg-[#F59E0B]/10 border-[#F59E0B]/30' },
            green:  { color: 'green',  label: 'Progresando bien',     textClass: 'text-[#10B981]', bgClass: 'bg-[#10B981]/10 border-[#10B981]/30' },
        };

        studentsWithStatus = riskData.map(r => ({
            id:          r.student_id,
            full_name:   r.full_name,
            avatar_url:  r.avatar_url,
            coach_notes: '',    // se carga al abrir el drawer
            // Datos de riesgo
            risk_level:   r.risk_level,
            risk_reason:  r.risk_reason,
            risk_score:   r.risk_score,
            // Bienestar
            wellbeing_score:  r.wellbeing_score,
            avg_sleep:        r.avg_sleep,
            avg_pain:         r.avg_pain,
            avg_energy:       r.avg_energy,
            wellbeing_checks: r.wellbeing_checks,
            last_check_at:    r.last_check_at,
            // Carga
            volume_spike_pct: r.volume_spike_pct,
            current_week_sets: r.current_week_sets,
            days_since_last:  r.days_since_last,
            last_completed_at: r.last_completed_at,
            stagnant_exercises: r.stagnant_exercises,
            // Compatibilidad con renderList()
            status: STATUS_MAP[r.risk_level] || STATUS_MAP.green,
            activeProgName: r.risk_reason || '—',
            sessions: [],   // historial se carga al abrir drawer
        }));

        updateKPIs();
        renderList();
    }

    function updateKPIs() {
        document.getElementById('kpi-total').textContent = studentsWithStatus.length;
        document.getElementById('kpi-red').textContent = studentsWithStatus.filter(s => s.status.color === 'red').length;
        document.getElementById('kpi-yellow').textContent = studentsWithStatus.filter(s => s.status.color === 'yellow').length;
        document.getElementById('kpi-green').textContent = studentsWithStatus.filter(s => s.status.color === 'green').length;
    }

    /* ─── Renderizado de la Lista ────────────────────────────── */
    function renderList() {
        // Sort: Red first, then Yellow, then Green
        const colorWeight = { 'red': 1, 'yellow': 2, 'green': 3 };
        
        let filtered = studentsWithStatus.filter(s => {
            const matchFilter = currentFilter === 'all' || s.status.color === currentFilter;
            const matchSearch = !searchQuery || s.full_name.toLowerCase().includes(searchQuery);
            return matchFilter && matchSearch;
        });

        filtered.sort((a, b) => colorWeight[a.status.color] - colorWeight[b.status.color]);

        if (filtered.length === 0) {
            listEl.innerHTML = `<div class="text-center py-12 text-slate-500">No hay alumnos que coincidan con la búsqueda.</div>`;
            return;
        }

        listEl.innerHTML = filtered.map(s => {
            const initials = s.full_name.substring(0, 2).toUpperCase();
            const lastSess = s.last_completed_at ? new Date(s.last_completed_at).toLocaleDateString('es-AR', {day:'2-digit', month:'short'}) : 'Nunca';
            const avatarSrc = sanitizeImageSrc(s.avatar_url);

            return `
            <div class="student-row" data-id="${s.id}">
                <div class="w-12 h-12 rounded-full bg-[#1E293B] flex items-center justify-center font-bold text-slate-400 shrink-0 overflow-hidden">
                    ${avatarSrc ? `<img src="${avatarSrc}" class="w-full h-full object-cover" alt="${escHtml(s.full_name || 'Alumno')}">` : escHtml(initials)}
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="text-base font-bold text-white truncate">${escHtml(s.full_name)}</h3>
                    <p class="text-xs text-slate-500 truncate">${escHtml(s.activeProgName)}</p>
                </div>
                <div class="text-right hidden sm:block mr-4">
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Última sesión</p>
                    <p class="text-sm font-bold text-white">${lastSess}</p>
                </div>
                <div class="shrink-0">
                    <span class="inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-bold uppercase tracking-widest ${s.status.bgClass} ${s.status.textClass}">
                        ${s.status.label}
                    </span>
                </div>
            </div>`;
        }).join('');
    }

    /* ─── Eventos de Filtros y Búsqueda ──────────────────────── */
    document.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderList();
        });
    });

    document.getElementById('search-input').addEventListener('input', debounce(e => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderList();
    }, 200));

    /* ─── Drawer / Panel Lateral (Event Delegation) ──────────── */
    listEl.addEventListener('click', e => {
        const row = e.target.closest('.student-row');
        if (!row) return;
        
        const s = studentsWithStatus.find(x => x.id === row.dataset.id);
        if (s) openStudentDrawer(s);
    });

    async function openStudentDrawer(student) {
        const initials = student.full_name.substring(0, 2).toUpperCase();
        const avatarEl = document.getElementById('drawer-avatar');
        const avatarSrc = sanitizeImageSrc(student.avatar_url);
        avatarEl.innerHTML = avatarSrc ? `<img src="${avatarSrc}" class="w-full h-full object-cover" alt="${escHtml(student.full_name || 'Alumno')}">` : escHtml(initials);
        
        document.getElementById('drawer-name').textContent = student.full_name;
        document.getElementById('drawer-student-id').value = student.id;
        
        // Cargar coach_notes y sesiones al abrir
        const { data: detailData } = await db.from('students').select('coach_notes').eq('id', student.id).single();
        document.getElementById('drawer-notes').value = detailData?.coach_notes || '';
        
        const { data: sessions } = await db.from('workout_sessions')
            .select('id, routine_name, day_name, completed_at, duration_minutes, workout_exercise_logs(status)')
            .eq('student_id', student.id)
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(5);

        document.getElementById('drawer-status-badge').innerHTML = `
            <span class="inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-widest ${student.status.bgClass} ${student.status.textClass}">
                ${student.status.label}
            </span>
        `;

        // Render mini history
        const sessContainer = document.getElementById('drawer-sessions');
        if (!sessions || sessions.length === 0) {
            sessContainer.innerHTML = `<p class="text-xs text-slate-500 italic bg-[#0B1218] p-3 rounded-xl border border-[#1E293B]">Sin sesiones registradas recientemente.</p>`;
        } else {
            sessContainer.innerHTML = sessions.map(sess => {
                const date = new Date(sess.completed_at).toLocaleDateString('es-AR', {day:'2-digit', month:'short'});
                const dur = sess.duration_minutes ? `${sess.duration_minutes} min` : '';
                const logsCount = (sess.workout_exercise_logs || []).length;
                return `
                <div class="session-mini-card flex items-center justify-between">
                    <div>
                        <p class="text-[11px] font-bold text-white">${escHtml(sess.routine_name)} <span class="text-slate-500 font-normal ml-1">— ${escHtml(sess.day_name)}</span></p>
                        <p class="text-[10px] text-slate-500 mt-0.5">${logsCount} ejercicios logueados</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[11px] font-mono font-bold text-[#3B82F6]">${date}</p>
                        <p class="text-[10px] text-slate-500">${dur}</p>
                    </div>
                </div>`;
            }).join('');
        }

        // ─── BIENESTAR ───────────────────────────────────────────
        const wellbeingHTML = buildWellbeingPanel(student);
        sessContainer.insertAdjacentHTML('afterend', wellbeingHTML);

        drawer.classList.add('open');
        backdrop.classList.add('open');
    }

    function closeDrawer() {
        drawer.classList.remove('open');
        backdrop.classList.remove('open');
    }

    backdrop.addEventListener('click', closeDrawer);
    document.getElementById('close-drawer').addEventListener('click', closeDrawer);

    /* ─── Guardar Notas (Form Submit) ────────────────────────── */
    document.getElementById('drawer').addEventListener('submit', async (e) => {
        e.preventDefault();
        const sId = document.getElementById('drawer-student-id').value;
        const notes = document.getElementById('drawer-notes').value.trim();
        const btn = document.getElementById('btn-save-notes');

        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-rounded animate-spin">progress_activity</span> Guardando...`;

        const { error } = await db.from('students').update({
            coach_notes: notes,
            updated_at: new Date().toISOString()
        }).eq('id', sId);

        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-rounded text-[18px]">save</span> Guardar Notas`;

        if (error) {
            toast('Error al guardar notas', 'error');
            return;
        }

        // Actualizar estado en memoria
        const s = studentsWithStatus.find(x => x.id === sId);
        if (s) s.coach_notes = notes;

        toast('Notas guardadas correctamente');
        closeDrawer();
    });

    /* ─── Init ───────────────────────────────────────────────── */
    await loadDashboard();
        loadActiveSessions();
        setInterval(loadActiveSessions, 60000);

    /* ─── Sesiones activas en tiempo real ─────────────────── */
    async function loadActiveSessions() {
        const db = window.supabaseClient;

        // Sesiones con started_at pero sin completed_at = activas ahora
        const { data: active } = await db
            .from('workout_sessions')
            .select('id, student_id, routine_name, day_name, started_at, students(full_name)')
            .eq('gym_id', gymId)
            .is('completed_at', null)
            .not('started_at', 'is', null)
            .gte('started_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()) // últimas 3hs
            .order('started_at', { ascending: false });

        const section = document.getElementById('active-sessions-section');
        const listEl2 = document.getElementById('active-sessions-list');
        const countEl = document.getElementById('active-count');

        if (!active || active.length === 0) {
            section?.classList.add('hidden');
            return;
        }

        section?.classList.remove('hidden');
        if (countEl) countEl.textContent = active.length;

        // Para cada sesión activa, obtener cuántos sets tiene el día
        const sessionIds = active.map(s => s.id);
        const { data: logCounts } = await db
            .from('workout_exercise_logs')
            .select('session_id')
            .in('session_id', sessionIds);

        const setsBySession = {};
        (logCounts || []).forEach(l => {
            setsBySession[l.session_id] = (setsBySession[l.session_id] || 0) + 1;
        });

        // Estimar total de sets del día (desde workoutData no lo tenemos, usamos 20 como promedio)
        const EST_TOTAL = 20;

        if (listEl2) {
            listEl2.innerHTML = active.map(s => {
                const doneSets  = setsBySession[s.id] || 0;
                const pct       = Math.min(100, Math.round((doneSets / EST_TOTAL) * 100));
                const name      = s.students?.full_name || 'Alumno';
                const elapsed   = Math.floor((Date.now() - new Date(s.started_at)) / 60000);
                const initials  = name.substring(0, 2).toUpperCase();

                return `
                <div class="flex items-center gap-3 py-1">
                    <div class="w-8 h-8 rounded-full bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center text-[10px] font-black text-[#10B981] shrink-0">
                        ${initials}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between mb-1">
                            <span class="text-xs font-bold text-white truncate">${window.tfUtils.escHtml(name)}</span>
                            <span class="text-[9px] text-slate-500 shrink-0 ml-2">${elapsed} min · ${doneSets} sets</span>
                        </div>
                        <div class="h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                            <div class="h-full rounded-full bg-[#10B981] transition-all duration-500" style="width:${pct}%"></div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    }

})();

function buildWellbeingPanel(student) {
    const score = student.wellbeing_score;
    const scoreColor = score >= 7 ? '#10B981'
                     : score >= 4 ? '#F59E0B' : '#EF4444';

    const sleepEmojis  = ['', '😫', '😔', '😐', '😊', '🤩'];
    const painEmojis   = ['', '✅', '🟡', '🟠', '🔴', '🚨'];
    const energyEmojis = ['', '🪫', '😴', '👍', '💪', '🔥'];

    const hasData = student.wellbeing_checks > 0;

    return `
    <div class="mt-4 pt-4 border-t border-[#1E293B]">
        <div class="flex items-center justify-between mb-3">
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bienestar (últimos 7 días)</p>
            <a href="wellbeing-check.html" class="text-[10px] text-[#3B82F6] font-bold hover:underline">ver historial →</a>
        </div>

        ${!hasData ? `
            <div class="bg-[#0B1218] border border-[#1E293B] rounded-xl p-4 text-center">
                <p class="text-xs text-slate-500">Sin checks de bienestar esta semana.</p>
            </div>
        ` : `
            <div class="bg-[#0B1218] border border-[#1E293B] rounded-xl p-4">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-bold text-slate-400">Score promedio</span>
                    <span class="font-mono font-bold text-lg" style="color:${scoreColor}">${score}/10</span>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center">
                    <div>
                        <div class="text-xl mb-0.5">${sleepEmojis[Math.round(student.avg_sleep)] || '—'}</div>
                        <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Sueño</div>
                        <div class="font-mono text-xs font-bold text-white">${student.avg_sleep}/5</div>
                    </div>
                    <div>
                        <div class="text-xl mb-0.5">${painEmojis[Math.round(student.avg_pain)] || '—'}</div>
                        <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Dolor</div>
                        <div class="font-mono text-xs font-bold text-white">${student.avg_pain}/5</div>
                    </div>
                    <div>
                        <div class="text-xl mb-0.5">${energyEmojis[Math.round(student.avg_energy)] || '—'}</div>
                        <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Energía</div>
                        <div class="font-mono text-xs font-bold text-white">${student.avg_energy}/5</div>
                    </div>
                </div>
                ${student.avg_pain >= 4 ? `
                    <div class="mt-3 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        <span class="material-symbols-rounded text-[#EF4444] text-[16px]">warning</span>
                        <span class="text-xs font-bold text-[#EF4444]">Dolor elevado — revisar antes de entrenar</span>
                    </div>
                ` : ''}
            </div>
        `}

        <!-- Razón del riesgo -->
        <div class="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg"
             style="background:rgba(${student.risk_level==='red'?'239,68,68':student.risk_level==='yellow'?'245,158,11':'16,185,129'},.08);
                    border:1px solid rgba(${student.risk_level==='red'?'239,68,68':student.risk_level==='yellow'?'245,158,11':'16,185,129'},.25)">
            <span class="material-symbols-rounded text-[15px]"
                  style="color:${student.risk_level==='red'?'#EF4444':student.risk_level==='yellow'?'#F59E0B':'#10B981'}">
                ${student.risk_level==='red'?'warning':student.risk_level==='yellow'?'info':'check_circle'}
            </span>
            <span class="text-xs font-bold"
                  style="color:${student.risk_level==='red'?'#F87171':student.risk_level==='yellow'?'#FCD34D':'#34D399'}">
                ${window.tfUtils.escHtml(student.risk_reason || 'Sin alertas')}
            </span>
            <span class="ml-auto font-mono text-[10px] text-slate-600">Score: ${student.risk_score}</span>
        </div>
    </div>`;
}

