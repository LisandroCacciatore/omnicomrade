/**
 * student-dashboard.js
 * TechFitness — Dashboard del alumno (rediseño v2)
 */

(async () => {
  const session = await window.authGuard(['alumno', 'gim_admin', 'profesor']);
  if (!session) return;

  const db = window.supabaseClient;
  const gymId = session.user.app_metadata?.gym_id;
  const userId = session.user.id;
  const role = session.user.app_metadata?.role;
  const isStaff = role === 'gim_admin' || role === 'profesor';
  const urlParams = new URLSearchParams(window.location.search);
  const targetId = urlParams.get('id');
  function escHtml(s) {
    return window.tfUtils?.escHtml?.(s) ?? (s ? String(s) : '');
  }
  function logout() {
    window.tfUtils?.logout?.();
  }

  document.getElementById('logout-btn').addEventListener('click', logout);

  if (isStaff && targetId) {
    const backBtn = document.createElement('a');
    backBtn.href = 'student-list.html';
    backBtn.className =
      'flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-white transition-colors px-4 pt-4 -mb-2';
    backBtn.innerHTML =
      '<span class="material-symbols-rounded text-[16px]">arrow_back</span> Volver a alumnos';
    document.querySelector('main')?.prepend(backBtn);
  }

  /* ─── Resolver student ─────────────────────────────────── */
  let student = null;
  const STUDENT_SELECT =
    'id, full_name, email, routine_id, membership_status, medical_certificate_url, coach_notes, gyms(name)';

  if (isStaff && targetId) {
    const { data } = await db
      .from('students')
      .select(STUDENT_SELECT)
      .eq('id', targetId)
      .is('deleted_at', null)
      .maybeSingle();
    student = data;
  } else {
    const { data: byProfile } = await db
      .from('students')
      .select(STUDENT_SELECT)
      .eq('profile_id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    student = byProfile;

    if (!student && gymId && session.user.email) {
      const { data: byEmail } = await db
        .from('students')
        .select(STUDENT_SELECT)
        .eq('gym_id', gymId)
        .eq('email', session.user.email)
        .is('deleted_at', null)
        .maybeSingle();
      if (byEmail) {
        student = byEmail;
        try {
          db.from('students')
            .update({ profile_id: userId })
            .eq('id', byEmail.id)
            .is('profile_id', null)
            .then(() => {});
        } catch (_) {}
      }
    }
  }

  if (!student) {
    document.getElementById('loading-skeleton').classList.add('hidden');
    document.getElementById('dashboard-content').classList.remove('hidden');
    document.getElementById('cta-routine-name').textContent = 'Sin perfil asignado';
    return;
  }

  /* ─── Header ───────────────────────────────────────────── */
  document.getElementById('gym-name').textContent = student.gyms?.name || 'TechFitness';
  document.getElementById('student-name').textContent = student.full_name || 'Mi Dashboard';

  /* ─── Fetch paralelo ──────────────────────────────────── */
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const [
    { data: membership },
    { data: activeProg },
    { data: routine },
    { data: coach },
    { data: sessions },
    { data: wellbeingRaw }
  ] = await Promise.all([
    db
      .from('memberships')
      .select('plan, end_date, start_date')
      .eq('student_id', student.id)
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    db
      .from('student_programs')
      .select(
        `
      id, current_week, started_at, status,
      program_templates(id, slug, name, weeks, days_per_week, level)
    `
      )
      .eq('student_id', student.id)
      .eq('status', 'activo')
      .maybeSingle(),

    student.routine_id
      ? db
          .from('routines')
          .select('id, name, objetivo, days_per_week')
          .eq('id', student.routine_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    db
      .from('profiles')
      .select('full_name')
      .eq('gym_id', gymId)
      .eq('role', 'profesor')
      .limit(1)
      .maybeSingle(),

    db
      .from('workout_sessions')
      .select('id, completed_at, day_name, duration_minutes')
      .eq('student_id', student.id)
      .not('completed_at', 'is', null)
      .gte('completed_at', monthStart.toISOString())
      .order('completed_at', { ascending: false }),

    db
      .from('wellbeing_logs')
      .select('sleep, pain, energy, checked_at')
      .eq('student_id', student.id)
      .order('checked_at', { ascending: false })
      .limit(60)
  ]);

  const sessData = sessions || [];
  const wbData = wellbeingRaw || [];
  const daysPerWeek =
    activeProg?.program_templates?.days_per_week ||
    routine?.data?.days_per_week ||
    routine?.days_per_week ||
    4;
  const sessThisWeek = sessData.filter((s) => new Date(s.completed_at) >= weekStart).length;

  /* ─── CTA Entrenar ──────────────────────────────────── */
  const routineName =
    activeProg?.program_templates?.name || routine?.data?.name || routine?.name || 'Mi Rutina';

  const week = activeProg?.current_week || 1;
  const dayOfWeek = Math.min(sessThisWeek + 1, daysPerWeek);
  const isLastDayOfWeek = dayOfWeek >= daysPerWeek;

  document.getElementById('cta-routine-name').textContent = routineName;
  document.getElementById('cta-day-info').textContent =
    daysPerWeek > 0
      ? `Semana ${week} · Día ${dayOfWeek} de ${daysPerWeek}${isLastDayOfWeek ? ' · ¡Última sesión de la semana!' : ''}`
      : 'Comenzá tu entrenamiento';

  const btnEntrenar = document.getElementById('btn-entrenar');
  if (btnEntrenar) {
    btnEntrenar.addEventListener('click', (e) => {
      e.preventDefault();
      sessionStorage.setItem(
        'pendingWorkout',
        JSON.stringify({
          week,
          day: dayOfWeek,
          daysPerWeek,
          routineName,
          source: 'student-dashboard'
        })
      );
      window.location.href = btnEntrenar.href;
    });
  }

  /* ─── Membresía ─────────────────────────────────────── */
  if (membership) {
    const end = new Date(membership.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end - today) / 864e5);
    const isActive = diffDays >= 0;
    const isExpiringSoon = isActive && diffDays <= 7;

    document.getElementById('memb-plan').textContent = membership.plan || '—';
    document.getElementById('memb-vence').textContent = isActive
      ? `Vence en ${diffDays} día${diffDays !== 1 ? 's' : ''}`
      : `Venció hace ${Math.abs(diffDays)} días`;

    let badgeHTML;
    if (!isActive) {
      badgeHTML = `<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">VENCIDA</span>`;
    } else if (isExpiringSoon) {
      badgeHTML = `<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">${diffDays}D</span>`;
    } else {
      badgeHTML = `<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ACTIVA</span>`;
    }
    document.getElementById('memb-status').innerHTML = badgeHTML;
  } else {
    document.getElementById('memb-plan').textContent = 'Sin membresía';
    document.getElementById('memb-vence').textContent = 'Contactá al gimnasio';
  }

  /* ─── Entrenador ─────────────────────────────────────── */
  const coachName = coach?.full_name || 'Sin asignar';
  const hasCoach = coachName !== 'Sin asignar';
  document.getElementById('coach-name').textContent = coachName;
  document.getElementById('coach-avatar').textContent = coachName.charAt(0).toUpperCase();
  const avatar = document.getElementById('coach-avatar');
  avatar.className = `w-9 h-9 rounded-full bg-[#3B82F6]/10 border-2 ${hasCoach ? 'border-[#3B82F6]/40' : 'border-[#1E293B]'} flex items-center justify-center text-sm font-black ${hasCoach ? 'text-[#60A5FA]' : 'text-slate-500'} shrink-0`;

  /* ─── Plan activo / meta info ───────────────────────── */
  if (activeProg) {
    const tpl = activeProg.program_templates;
    const week = activeProg.current_week || 1;
    const total = tpl.weeks || 1;
    document.getElementById('plan-name').textContent = tpl.name;
    document.getElementById('plan-meta').textContent =
      `Semana ${week} de ${total} · ${tpl.level || ''}`;
  } else if (routine?.name || routine?.data?.name) {
    const r = routine?.data || routine;
    document.getElementById('plan-name').textContent = r.name;
    document.getElementById('plan-meta').textContent =
      `${r.objetivo || 'general'} · ${r.days_per_week || '—'} días/sem`;
  } else {
    document.getElementById('plan-meta').textContent =
      'Sin plan asignado — contactá a tu entrenador';
  }

  /* ─── Consistency ring ───────────────────────────────── */
  function buildRing(done, target) {
    const r = 28,
      cx = 34,
      cy = 34;
    const circ = 2 * Math.PI * r;
    const pct = Math.min(done / target, 1);
    const color = pct >= 1 ? '#10B981' : pct >= 0.6 ? '#F59E0B' : '#3B82F6';
    return `<svg viewBox="0 0 68 68" width="68" height="68">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1E293B" stroke-width="6"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="6"
        stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${circ.toFixed(1)}"
        stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
        class="consistency-ring"/>
      <text x="${cx}" y="${cy - 3}" text-anchor="middle" font-family="IBM Plex Mono"
        font-size="16" font-weight="700" fill="white">${done}</text>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="Space Grotesk"
        font-size="9" fill="#475569">/ ${target}</text>
    </svg>`;
  }

  document.getElementById('consistency-ring-wrap').innerHTML = buildRing(sessThisWeek, daysPerWeek);
  requestAnimationFrame(() => {
    const ring = document.querySelector('.consistency-ring');
    if (!ring) return;
    const circ = 2 * Math.PI * 28;
    ring.style.strokeDashoffset = (circ * (1 - Math.min(sessThisWeek / daysPerWeek, 1))).toFixed(1);
  });

  document.getElementById('consistency-label').textContent =
    `${sessThisWeek} sesión${sessThisWeek !== 1 ? 'es' : ''} esta semana`;

  /* ─── 7-day dot heatmap ──────────────────────────────── */
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const todayDate = new Date();
  const todayDow = todayDate.getDay();
  const sessionDates = new Set(
    sessData
      .filter((s) => new Date(s.completed_at) >= weekStart)
      .map((s) => new Date(s.completed_at).toDateString())
  );

  const dotsHTML = dayNames
    .map((d, i) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + i);
      const trained = sessionDates.has(dayDate.toDateString());
      const isToday = i === todayDow;
      const cls = `day-dot${trained ? ' trained' : ''}${isToday ? ' is-today' : ''}`;
      const colCls =
        isToday && trained
          ? 'day-dot-col trained-today'
          : isToday
            ? 'day-dot-col is-today'
            : 'day-dot-col';
      return `<div class="${colCls}">
      <div class="${cls}" title="${dayDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' })}"></div>
      <span class="day-dot-label">${d}</span>
    </div>`;
    })
    .join('');

  document.getElementById('week-days-chips').innerHTML = dotsHTML;

  /* ─── Últimas 3 sesiones ─────────────────────────────── */
  const recent = sessData.slice(0, 3);
  if (recent.length > 0) {
    document.getElementById('last-sessions-list').innerHTML =
      `<p class="zone-label mt-3">Últimas sesiones</p>` +
      recent
        .map((s) => {
          const d = new Date(s.completed_at);
          const dateStr = d.toLocaleDateString('es-AR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
          });
          return `<div class="session-row">
          <div>
            <p class="text-xs font-bold text-slate-300">${escHtml(s.day_name || 'Sesión')}</p>
            <p class="text-[10px] text-slate-500">${dateStr}</p>
          </div>
          <span class="text-[10px] font-mono text-slate-500 bg-[#0B1218] px-2 py-0.5 rounded-md border border-[#1E293B]">
            ${s.duration_minutes ? s.duration_minutes + ' min' : '✓'}
          </span>
        </div>`;
        })
        .join('');
  }

  /* ─── Wellbeing (últimos 7 días, sin filtros) ────────── */
  const cutoff7 = new Date();
  cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoff14 = new Date();
  cutoff14.setDate(cutoff14.getDate() - 14);

  const current = wbData.filter((w) => new Date(w.checked_at) >= cutoff7);
  const previous = wbData.filter((w) => {
    const d = new Date(w.checked_at);
    return d >= cutoff14 && d < cutoff7;
  });

  const metricsEl = document.getElementById('wellbeing-metrics');
  const emptyEl = document.getElementById('wellbeing-empty');

  if (!current.length) {
    metricsEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
  } else {
    metricsEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');

    const avg = (arr, key) =>
      arr.length ? arr.reduce((a, w) => a + (w[key] || 0), 0) / arr.length : null;

    [
      { key: 'sleep', id: 'wb-sleep', invertTrend: false },
      { key: 'pain', id: 'wb-pain', invertTrend: true },
      { key: 'energy', id: 'wb-energy', invertTrend: false }
    ].forEach(({ key, id, invertTrend }) => {
      const curr = avg(current, key);
      const prev = avg(previous, key);
      if (curr === null) return;

      const valEl = document.getElementById(`${id}-val`);
      const barEl = document.getElementById(`${id}-bar`);
      if (valEl) valEl.textContent = `${curr.toFixed(1)}/5`;
      if (barEl) barEl.style.width = `${(curr / 5) * 100}%`;

      const trendEl = document.getElementById(`${id}-trend`);
      if (trendEl && prev !== null) {
        const delta = curr - prev;
        const improved = invertTrend ? delta < 0 : delta > 0;
        const neutral = Math.abs(delta) < 0.3;
        trendEl.textContent = neutral ? '→' : delta > 0 ? '↑' : '↓';
        trendEl.style.color = neutral ? '#64748B' : improved ? '#10B981' : '#EF4444';
        trendEl.title = `Anterior: ${prev.toFixed(1)}/5`;
      }
    });

    document.getElementById('wb-registros').textContent =
      `${current.length} registro${current.length !== 1 ? 's' : ''} · últimos 7 días`;
  }

  /* ─── Certificado médico ─────────────────────────────── */
  function renderCert(url) {
    if (url) {
      document.getElementById('cert-link').href = url;
      document.getElementById('cert-current').classList.remove('hidden');
      document.getElementById('cert-empty').classList.add('hidden');
      document.getElementById('cert-status-badge').innerHTML =
        `<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">CARGADO</span>`;
    } else {
      document.getElementById('cert-current').classList.add('hidden');
      document.getElementById('cert-empty').classList.remove('hidden');
      document.getElementById('cert-status-badge').innerHTML =
        `<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-[#1E293B]">PENDIENTE</span>`;
    }
  }

  renderCert(student.medical_certificate_url);

  if (isStaff && targetId) {
    document.querySelector('label:has(#cert-file-input)')?.classList.add('hidden');
  }

  document.getElementById('cert-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('cert-upload-status');
    const errorEl = document.getElementById('cert-upload-error');
    statusEl.classList.remove('hidden');
    errorEl.classList.add('hidden');

    try {
      const ext = file.name.split('.').pop();
      const path = `${student.id}/certificado.${ext}`;
      const { error: upErr } = await db.storage
        .from('medical-certificates')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = await db.storage
        .from('medical-certificates')
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      const url = urlData?.signedUrl;
      if (url) {
        await db.from('students').update({ medical_certificate_url: url }).eq('id', student.id);
        student.medical_certificate_url = url;
        renderCert(url);
        window.tfUtils.toast('Certificado subido correctamente');
      }
    } catch (err) {
      errorEl.textContent = 'Error al subir: ' + err.message;
      errorEl.classList.remove('hidden');
    } finally {
      statusEl.classList.add('hidden');
      e.target.value = '';
    }
  });

  /* ─── Score del atleta ────────────────────────────────── */
  if (window.AthleteInsights) {
    const scoreData = window.AthleteInsights.calcAthleteScore({
      wbLogs: wbData,
      sessions: sessData,
      logs: [],
      daysPerWeek
    });
    const prediction = window.AthleteInsights.predictSessionQuality({
      wbLogs: wbData,
      logs: [],
      sessions: sessData
    });
    renderAthleteScoreWidget(scoreData, prediction);
  }

  /* ─── Mostrar contenido ─────────────────────────────── */
  document.getElementById('loading-skeleton').classList.add('hidden');
  document.getElementById('dashboard-content').classList.remove('hidden');

  /* ─── Score widget renderer ──────────────────────────── */
  function renderAthleteScoreWidget(scoreData, prediction) {
    const el = document.getElementById('athlete-score-widget');
    if (!el) return;

    const AI = window.AthleteInsights;
    const sl = AI.getScoreLevel(scoreData.total_score);
    const { total_score, components } = scoreData;
    const circ = 125.66;
    const offset = circ - (total_score / 100) * circ;

    const predBanner =
      prediction.risk > 35
        ? `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;background:${prediction.color}0d;border:1px solid ${prediction.color}33;margin-top:10px">
        <span style="font-size:14px">${prediction.emoji}</span>
        <p style="font-size:11px;font-weight:700;color:${prediction.color}">${prediction.label}</p>
      </div>`
        : '';

    el.innerHTML = `
      <div style="background:#161E26;border:1px solid ${sl.border};border-radius:18px;padding:16px 18px">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="position:relative;width:60px;height:60px;flex-shrink:0">
            <svg width="60" height="60" style="transform:rotate(-90deg)">
              <circle cx="30" cy="30" r="20" stroke="#1E293B" stroke-width="5" fill="none"/>
              <circle cx="30" cy="30" r="20" stroke="${sl.color}" stroke-width="5" fill="none"
                stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
              <span style="font-size:16px;font-weight:900;font-family:'IBM Plex Mono',monospace;color:${sl.color};line-height:1">${total_score}</span>
            </div>
          </div>
          <div style="flex:1;min-width:0">
            <p style="font-size:9px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.08em">Estado del atleta</p>
            <p style="font-size:14px;font-weight:900;color:${sl.color};margin:2px 0">${sl.emoji} ${sl.label}</p>
            <div style="display:flex;gap:5px;margin-top:6px">
              ${[
                [components.wbPts, 30, '😴', '#3B82F6'],
                [components.consistencyPts, 25, '📅', '#10B981'],
                [components.progressionPts, 25, '📈', '#8B5CF6'],
                [components.fatiguePts, 20, '⚡', '#F59E0B']
              ]
                .map(
                  ([pts, max, icon, c]) => `
                <div style="flex:1">
                  <div style="height:3px;background:#1E293B;border-radius:2px">
                    <div style="height:100%;width:${(pts / max) * 100}%;background:${c};border-radius:2px"></div>
                  </div>
                  <span style="font-size:8px;color:#334155">${icon}</span>
                </div>`
                )
                .join('')}
            </div>
          </div>
          <a href="progress.html" style="padding:6px 10px;border-radius:9px;border:1px solid #1E293B;color:#475569;font-size:10px;font-weight:700;text-decoration:none;white-space:nowrap">Ver detalle</a>
        </div>
        ${predBanner}
      </div>`;
  }
})();
