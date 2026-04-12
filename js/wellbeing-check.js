/**
 * wellbeing-check.js
 * TechFitness — Check de bienestar pre-entrenamiento
 */

const getStudentHomeUrl = async () => {
  // FIXED: read role from JWT, not localStorage
  const session = await window.tfSession.get();
  const role = session?.user?.app_metadata?.role || 'alumno';
  const routes = {
    gim_admin: 'admin-dashboard.html',
    profesor: 'profesor-dashboard.html',
    alumno: 'student-profile.html'
  };
  return routes[role] || 'student-profile.html';
};

(async () => {
  const ctx = await window.authGuard(['alumno', 'gim_admin', 'profesor']);
  if (!ctx) return;

  const { gymId, userId } = ctx;
  const db = window.supabaseClient;
  const apiHeaders = {
    'Content-Type': 'application/json',
    'x-actor-id': userId
  };

  /* ─── Resolver student_id ──────────────────────────────── */
  const { data: studentRecord } = await db
    .from('students')
    // FIXED: tenant filter
    .eq('gym_id', gymId)
    .select('id')
    .eq('profile_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  const studentId = studentRecord?.id ?? null;

  /* ─── Recuperar workout pendiente ─────────────────────── */
  const pendingRaw = sessionStorage.getItem('pendingWorkout');
  if (!pendingRaw) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; background: #0B1218;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 12px; z-index: 100;
    `;
    overlay.innerHTML = `
      <span class="material-symbols-rounded" style="font-size:40px;color:#475569">calendar_today</span>
      <p style="color:#E2E8F0;font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:700;text-align:center;margin:0">
        Hoy no tenés entrenamiento asignado
      </p>
      <p style="color:#64748B;font-size:13px;margin:0;text-align:center">Redirigiendo a tu rutina...</p>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => {
      window.location.href = 'student-profile.html';
    }, 2000);
    return;
  }
  let pendingWorkout = JSON.parse(pendingRaw);

  /* ─── State ────────────────────────────────────────────── */
  const answers = { sleep: null, pain: null, energy: null, painZone: null };

  function getCheckDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    return [
      parts.find((p) => p.type === 'year')?.value,
      parts.find((p) => p.type === 'month')?.value,
      parts.find((p) => p.type === 'day')?.value
    ].join('-');
  }

  /* ─── Zone buttons — se bindean UNA SOLA VEZ aquí ────── */
  // FIX: antes estaba dentro de prefillAnswers() y solo corría
  // si había un check previo del día. Si era check nuevo, los
  // botones de zona no tenían handler → answers.painZone nunca se seteaba.
  document.getElementById('pain-zone-btns')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.zone-btn');
    if (!btn) return;
    document.querySelectorAll('.zone-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    answers.painZone = btn.dataset.zone;
  });

  /* ─── Check: ¿ya hizo el check hoy? ───────────────────── */
  if (studentId) {
    const todayCheckDate = getCheckDate();
    const { data: existing } = await db
      .from('wellbeing_logs')
      .select('id, sleep, pain, energy, pain_zone')
      .eq('student_id', studentId)
      .eq('check_date', todayCheckDate)
      .maybeSingle();

    if (existing) {
      document.getElementById('already-done-banner')?.classList.remove('hidden');
      answers.sleep = existing.sleep;
      answers.pain = existing.pain;
      answers.energy = existing.energy;
      answers.painZone = existing.pain_zone ?? null;
      prefillAnswers();
    }
  }

  /* ─── Q buttons ────────────────────────────────────────── */
  document.querySelectorAll('.q-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const q = btn.dataset.q;
      const val = parseInt(btn.dataset.val);

      answers[q] = val;

      document
        .querySelectorAll(`.q-btn[data-q="${q}"]`)
        .forEach((b) => b.classList.remove(`sel-${q}`));
      btn.classList.add(`sel-${q}`);

      const checkEl = document.getElementById(`check-${q}`);
      const cardEl = document.getElementById(`card-${q}`);
      checkEl?.classList.remove('hidden');
      cardEl?.classList.add('answered');

      updateDots();
      updateCTA();

      if (answers.sleep && answers.pain && answers.energy) {
        document.getElementById('notes-section')?.classList.remove('hidden');
      }

      // Mostrar/ocultar sección zona de dolor
      if (q === 'pain') {
        const zoneSection = document.getElementById('pain-zone-section');
        if (val >= 2) {
          zoneSection?.classList.remove('hidden');
        } else {
          zoneSection?.classList.add('hidden');
          answers.painZone = null;
          document.querySelectorAll('.zone-btn').forEach((b) => b.classList.remove('active'));
        }
        if (val >= 4) cardEl.style.borderColor = 'rgba(239,68,68,.4)';
        else cardEl.style.borderColor = '';
      }
    });
  });

  /* ─── Prefill (check existente hoy) ───────────────────── */
  function prefillAnswers() {
    ['sleep', 'pain', 'energy'].forEach((q) => {
      const val = answers[q];
      if (!val) return;
      const btn = document.querySelector(`.q-btn[data-q="${q}"][data-val="${val}"]`);
      if (btn) {
        btn.classList.add(`sel-${q}`);
        document.getElementById(`check-${q}`)?.classList.remove('hidden');
        document.getElementById(`card-${q}`)?.classList.add('answered');
      }
    });

    // Prefill zona si existía
    if (answers.painZone && answers.pain >= 2) {
      document.getElementById('pain-zone-section')?.classList.remove('hidden');
      const zoneBtn = document.querySelector(`.zone-btn[data-zone="${answers.painZone}"]`);
      zoneBtn?.classList.add('active');
    }

    updateDots();
    updateCTA();
    document.getElementById('notes-section')?.classList.remove('hidden');
  }

  /* ─── Dots ─────────────────────────────────────────────── */
  function updateDots() {
    ['sleep', 'pain', 'energy'].forEach((q, i) => {
      document.getElementById(`dot-${i}`)?.classList.toggle('done', !!answers[q]);
    });
  }

  /* ─── Score ────────────────────────────────────────────── */
  function calcScore() {
    const sleepScore = ((answers.sleep || 0) / 5) * 30;
    const energyScore = ((answers.energy || 0) / 5) * 40;
    const painScore = ((6 - (answers.pain || 1)) / 5) * 30;
    return Math.round(sleepScore + energyScore + painScore);
  }

  function getScoreLevel(score) {
    if (score >= 70)
      return { level: 'verde', label: 'Listo para entrenar', color: '#10B981', emoji: '🟢' };
    if (score >= 40)
      return { level: 'amarillo', label: 'Entrenar con precaución', color: '#F59E0B', emoji: '🟡' };
    return { level: 'rojo', label: 'Sesión ligera recomendada', color: '#EF4444', emoji: '🔴' };
  }

  /* ─── CTA ──────────────────────────────────────────────── */
  function updateCTA() {
    const allDone = answers.sleep && answers.pain && answers.energy;
    const btn = document.getElementById('btn-start');
    const hint = document.getElementById('missing-hint');
    const scoreEl = document.getElementById('score-display');

    btn.disabled = !allDone;
    btn.classList.toggle('ready', !!allDone);

    if (allDone) {
      hint.textContent = '';
      const score = calcScore();
      const { level, label, color, emoji } = getScoreLevel(score);

      scoreEl?.classList.remove('hidden');
      const emojiEl = document.getElementById('score-emoji');
      const labelEl = document.getElementById('score-label');
      const numEl = document.getElementById('score-num');
      const barEl = document.getElementById('score-bar-fill');
      if (emojiEl) emojiEl.textContent = emoji;
      if (labelEl) {
        labelEl.textContent = label;
        labelEl.style.color = color;
      }
      if (numEl) {
        numEl.textContent = `${score}/100`;
        numEl.style.color = color;
      }
      if (barEl) {
        barEl.style.width = `${score}%`;
        barEl.style.background = color;
      }

      btn.style.background = color;
      btn.style.color = level === 'rojo' ? '#fff' : '#000';
      btn.textContent =
        level === 'verde'
          ? '🔥 ¡A entrenar!'
          : level === 'amarillo'
            ? '⚠️ Comenzar con precaución'
            : '🛟 Comenzar (sesión ligera)';
    } else {
      scoreEl?.classList.add('hidden');
      const missing = ['sleep', 'pain', 'energy']
        .filter((q) => !answers[q])
        .map((q) => ({ sleep: 'sueño', pain: 'dolor', energy: 'energía' })[q])
        .join(', ');
      hint.textContent = `Falta: ${missing}`;
    }
  }

  /* ─── Navegación ───────────────────────────────────────── */
  document.getElementById('btn-back').addEventListener('click', async () => {
    sessionStorage.removeItem('pendingWorkout');
    window.location.href = await getStudentHomeUrl();
  });

  document.getElementById('btn-skip').addEventListener('click', skipAndRedirect);

  document.getElementById('btn-start').addEventListener('click', async () => {
    if (!answers.sleep || !answers.pain || !answers.energy) return;

    const latestPendingRaw = sessionStorage.getItem('pendingWorkout');
    if (!latestPendingRaw) {
      showPendingWorkoutError();
      return;
    }

    await saveAndRedirect();
  });

  /* ─── Guardar y redirigir ──────────────────────────────── */
  function showPendingWorkoutError() {
    const existing = document.getElementById('pending-workout-error-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'pending-workout-error-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(11,18,24,.95);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 12px; z-index: 120; padding: 24px;
    `;
    overlay.innerHTML = `
      <span class="material-symbols-rounded" style="font-size:40px;color:#F59E0B">warning</span>
      <p style="color:#E2E8F0;font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:700;text-align:center;margin:0">Hubo un problema. Seleccioná tu día de entrenamiento.</p>
      <button id="pending-workout-go-routine" type="button" style="margin-top:8px;background:#3B82F6;color:white;border:none;border-radius:12px;padding:10px 14px;font-weight:700;cursor:pointer">Ir a mi rutina</button>
    `;
    document.body.appendChild(overlay);
    document.getElementById('pending-workout-go-routine')?.addEventListener('click', () => {
      window.location.href = 'student-profile.html';
    });
  }

  async function saveAndRedirect() {
    document.getElementById('saving-overlay').classList.add('show');

    if (studentId) {
      const notes = document.getElementById('wellbeing-notes')?.value.trim() || null;
      try {
        const checkedAt = new Date();
        await db.from('wellbeing_logs').upsert(
          {
            gym_id: gymId,
            student_id: studentId,
            sleep: answers.sleep,
            pain: answers.pain,
            energy: answers.energy,
            pain_zone: answers.painZone || null,
            notes,
            checked_at: checkedAt.toISOString(),
            check_date: getCheckDate(checkedAt)
          },
          {
            onConflict: 'student_id,check_date',
            ignoreDuplicates: false
          }
        );
      } catch (err) {
        console.warn('Wellbeing save error (non-blocking):', err.message);
      }
    }

    // Enriquecer payload → workout-session lo lee
    try {
      const score = calcScore();
      const { level, label } = getScoreLevel(score);
      pendingWorkout.wellbeing = {
        score,
        level,
        label,
        sleep: answers.sleep,
        pain: answers.pain,
        energy: answers.energy,
        painZone: answers.painZone
      };
      await saveIntentWellbeing(pendingWorkout);
      sessionStorage.setItem('activeWorkout', JSON.stringify(pendingWorkout));
    } catch (_) {
      sessionStorage.setItem('activeWorkout', pendingRaw);
    }

    sessionStorage.removeItem('pendingWorkout');
    window.location.href = 'workout-session.html';
  }

  function skipAndRedirect() {
    sessionStorage.setItem('activeWorkout', JSON.stringify(pendingWorkout));
    sessionStorage.removeItem('pendingWorkout');
    window.location.href = 'workout-session.html';
  }

  async function saveIntentWellbeing(pending) {
    if (!studentId || !gymId) return;

    if (!pending.intentId) {
      const createRes = await fetch('/api/workouts/intents', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          gym_id: gymId,
          student_id: studentId,
          routine_name: pending.routineName || null,
          day_name: pending.dayName || null,
          source_payload: pending
        })
      });
      if (!createRes.ok) return;
      const created = await createRes.json();
      pending.intentId = created?.intent?.id || null;
    }

    if (!pending.intentId) return;

    await fetch(`/api/workouts/intents/${pending.intentId}/wellbeing`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        wellbeing: pending.wellbeing || null
      })
    });
  }
})();
