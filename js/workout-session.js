/**
 * workout-session.js
 * TechFitness — Sesión de entrenamiento
 * 
 * UX v2:
 * - +/- grande inline para peso (sin modal)
 * - Carry-over de delta al siguiente set del mismo ejercicio
 * - Un tap = logrado, swipe/botón = ajustar esfuerzo
 * - Historial inline (último peso usado)
 * - Timer con vibración
 */

const getStudentHomeUrl = () => {
  const role = localStorage.getItem('tf_role') || 'alumno';
  const routes = { 'gim_admin': 'admin-dashboard.html', 'profesor': 'profesor-dashboard.html', 'alumno': 'student-profile.html' };
  return routes[role] || 'student-profile.html';
};

(async () => {
  const session = await window.authGuard(['alumno', 'gim_admin', 'profesor']);
  if (!session) return;

  const db    = window.supabaseClient;
  const gymId = session.user.app_metadata.gym_id;
  const apiHeaders = {
    'Content-Type': 'application/json',
    'x-actor-id': session.user.id,
  };

  /* ─── Resolver student_id ─────────────────────────────── */
  const workoutDataRaw = sessionStorage.getItem('activeWorkout');
  if (!workoutDataRaw) { window.location.href = getStudentHomeUrl(); return; }
  const workoutData = JSON.parse(workoutDataRaw);

  let studentId = workoutData.studentId || null;
  if (!studentId) {
    const { data: byProfile } = await db.from('students').select('id')
      .eq('profile_id', session.user.id).is('deleted_at', null).maybeSingle();
    studentId = byProfile?.id || null;
  }
  if (!studentId && gymId && session.user.email) {
    const { data: byEmail } = await db.from('students').select('id')
      .eq('gym_id', gymId).eq('email', session.user.email)
      .is('deleted_at', null).maybeSingle();
    if (byEmail) {
      studentId = byEmail.id;
      db.from('students').update({ profile_id: session.user.id })
        .eq('id', byEmail.id).is('profile_id', null).then(() => {});
    }
  }

  /* ─── Sets — array mutable para carry-over de peso ──── */
  // Cada item: { name, muscle, setNum, totalSets, reps, weight_kg, rpe_target, rir_target, is_amrap, rest }
  // weight_kg se modifica en tiempo real cuando el usuario ajusta
  const sets = (workoutData.exercises || []).map(s => ({ ...s, weight_kg: parseFloat(s.weight_kg) || 0 }));
  const totalSets = sets.length;
  if (!totalSets) { window.location.href = getStudentHomeUrl(); return; }

  // Dynamic Load Factor por bienestar: si readiness está en rojo, sugerir -15%.
  const readinessScore = Number(workoutData?.wellbeing?.score || 0);
  const isLowReadiness = workoutData?.wellbeing?.level === 'rojo' || readinessScore < 40;
  if (isLowReadiness) {
    sets.forEach((set) => {
      if (!set.weight_kg || set.weight_kg <= 0) return;
      set.weight_kg = Math.max(0, Math.round((set.weight_kg * 0.85) / 2.5) * 2.5);
    });
  }

  /* ─── Historial: último peso por ejercicio ──────────── */
  const lastWeightByEx = {};
  if (studentId) {
    try {
      // Buscar la última sesión completada por este alumno
      const { data: lastSess } = await db.from('workout_sessions')
        .select('id')
        .eq('student_id', studentId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1).maybeSingle();

      if (lastSess) {
        const exNames = [...new Set(sets.map(s => s.name))];
        const { data: prevLogs } = await db.from('workout_exercise_logs')
          .select('exercise_name, weight_used, reps_actual, set_number')
          .eq('session_id', lastSess.id)
          .in('exercise_name', exNames)
          .gt('weight_used', 0);

        (prevLogs || []).forEach(l => {
          const ex = l.exercise_name;
          if (!lastWeightByEx[ex] || l.weight_used > lastWeightByEx[ex].weight) {
            lastWeightByEx[ex] = { weight: l.weight_used, reps: l.reps_actual };
          }
        });
      }
    } catch (_) {}
  }

  /* ─── State ───────────────────────────────────────────── */
  let currentIndex     = 0;
  let workoutLogs      = [];
  let sessionStartTime = new Date().toISOString();
  let startedSessionId = workoutData.sessionId || null;
  let restTimerInterval = null;
  let heavySetsCount   = 0;
  let readinessOverride = false;

  function repsToNumber(repsValue) {
    if (repsValue == null) return 0;
    const match = String(repsValue).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  /* ─── DOM ─────────────────────────────────────────────── */
  const deckEl      = document.getElementById('exercise-deck');
  const progressBar = document.getElementById('workout-progress');
  const timerEl     = document.getElementById('rest-timer');
  const timerDisplay = document.getElementById('timer-display');

  document.getElementById('session-routine-name').textContent = workoutData.routineName || '';
  document.getElementById('session-day-name').textContent     = workoutData.dayName || '';

  /* ─── Wellbeing banner ─────────────────────────────────── */
  const wb = workoutData.wellbeing;
  if (wb?.level) {
    const bannerEl = document.getElementById('wellbeing-banner');
    if (bannerEl) {
      const cfg = {
        verde:    { color: '#10B981', bg: 'rgba(16,185,129,.1)',  border: 'rgba(16,185,129,.25)', icon: '🟢' },
        amarillo: { color: '#F59E0B', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.25)', icon: '🟡' },
        rojo:     { color: '#EF4444', bg: 'rgba(239,68,68,.1)',  border: 'rgba(239,68,68,.25)',  icon: '🔴' },
      }[wb.level];
      const recs = {
        verde: 'Condiciones óptimas.',
        amarillo: 'Bajá el peso un 5-10%.',
        rojo: 'Sesión ligera hoy.',
      };
      const zoneText = wb.painZone && wb.pain >= 2
        ? ` · Dolor en ${wb.painZone.replace('_', ' ')}` : '';
      bannerEl.style.cssText = `display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;border:1px solid ${cfg.border};background:${cfg.bg};margin-bottom:8px`;
      bannerEl.innerHTML = `
        <span style="font-size:18px">${cfg.icon}</span>
        <div style="flex:1">
          <p style="font-size:12px;font-weight:800;color:${cfg.color};line-height:1">${wb.label}${zoneText}</p>
          <p style="font-size:10px;color:#94A3B8;margin-top:2px">${recs[wb.level]}</p>
        </div>
        <span style="font-size:13px;font-weight:900;font-family:'IBM Plex Mono',monospace;color:${cfg.color}">${wb.score}</span>`;
    }
  }

  await ensureWorkoutSessionStarted();

  /* ═══════════════════════════════════════════════════════
     RENDER DECK
  ═══════════════════════════════════════════════════════ */
  function renderDeck() {
    deckEl.innerHTML = sets.map((s, index) => buildCard(s, index)).join('');
    updateProgressBar();
  }

  function buildCard(s, index) {
    const isFirst  = index === 0;
    const classes  = isFirst
      ? 'translate-x-0 scale-100 opacity-100 z-10'
      : 'translate-x-[110%] scale-95 opacity-50 z-0 pointer-events-none';

    const hist = lastWeightByEx[s.name];
    const histHTML = hist
      ? `<div class="text-center mb-2">
           <span style="font-size:10px;font-weight:700;color:#334155;background:#0B1218;padding:3px 10px;border-radius:999px;border:1px solid #1E293B">
             Última vez: <span style="color:#60A5FA;font-family:'IBM Plex Mono',monospace">${hist.weight}kg × ${hist.reps || '?'}</span>
           </span>
         </div>`
      : '';

    const amrapBadge = s.is_amrap
      ? `<span style="font-size:9px;font-weight:800;color:#F59E0B;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);padding:2px 8px;border-radius:999px;margin-left:6px">AMRAP</span>`
      : '';

    const rpeHTML = s.rpe_target
      ? `<div style="text-align:center;margin-bottom:8px">
           <span style="font-size:9px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.07em">RPE objetivo </span>
           <span style="font-family:'IBM Plex Mono',monospace;font-weight:900;font-size:15px;color:${s.rpe_target >= 9 ? '#EF4444' : s.rpe_target >= 7 ? '#F59E0B' : '#10B981'}">${s.rpe_target}</span>
           ${s.rir_target != null ? `<span style="color:#334155;font-size:10px"> / RIR ${s.rir_target}</span>` : ''}
         </div>`
      : '';

    const weight = s.weight_kg || 0;

    return `
    <div id="card-${index}" class="absolute inset-x-5 top-5 bottom-5 bg-[#161E26] border border-[#1E293B] rounded-3xl flex flex-col p-5 shadow-2xl transition-all duration-300 ease-out ${classes}">

      <!-- Set badge + exercise name -->
      <div class="text-center mb-2">
        <span class="text-[10px] font-black text-[#3B82F6] bg-[#3B82F6]/10 border border-[#3B82F6]/20 px-3 py-1 rounded-full uppercase tracking-widest">
          Set ${s.setNum} de ${s.totalSets}
        </span>
      </div>

      <h2 class="text-xl font-black text-white text-center leading-tight mb-0.5">${window.tfUtils.escHtml(s.name)}</h2>
      ${s.muscle ? `<p class="text-[9px] font-bold text-slate-500 text-center uppercase tracking-widest mb-1">${s.muscle}</p>` : '<div class="mb-1"></div>'}

      <!-- Historial -->
      ${histHTML}

      <!-- Reps objetivo -->
      <div class="text-center mb-2">
        <span class="text-4xl font-black text-white">${s.reps || '—'}</span>
        <span class="text-base text-slate-500 ml-1">reps${s.is_amrap ? ' máx' : ''}${amrapBadge}</span>
      </div>

      ${rpeHTML}

      <!-- ── Peso con +/- inline ── -->
      <div class="bg-[#0B1218] rounded-2xl border border-[#1E293B] p-3 mb-3">
        <p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center mb-2">Peso</p>
        <div class="flex items-center justify-between gap-2">

          <!-- Botones minus -->
          <div class="flex flex-col gap-1.5">
            <button class="btn-weight-adj w-14 h-10 rounded-xl border border-[#1E293B] bg-[#161E26] text-slate-400 font-mono font-bold text-sm active:bg-[#EF4444]/20 active:border-[#EF4444] active:text-[#EF4444] transition-colors" data-card="${index}" data-delta="-5">-5</button>
            <button class="btn-weight-adj w-14 h-12 rounded-xl border border-[#1E293B] bg-[#161E26] text-slate-300 font-mono font-bold text-base active:bg-[#EF4444]/20 active:border-[#EF4444] active:text-[#EF4444] transition-colors" data-card="${index}" data-delta="-2.5">-2.5</button>
          </div>

          <!-- Peso actual -->
          <div class="flex-1 text-center">
            ${weight > 0
              ? `<span id="weight-display-${index}" class="block text-5xl font-black font-mono tracking-tighter text-[#60A5FA]">${weight}</span>
                 <span class="text-xl text-slate-500">kg</span>
                 <p id="weight-delta-${index}" class="text-[10px] font-bold text-[#F59E0B] mt-1 min-h-[14px]"></p>`
              : `<span id="weight-display-${index}" class="block text-4xl font-black text-slate-600">Peso libre</span>
                 <p id="weight-delta-${index}" class="text-[10px] font-bold text-[#F59E0B] mt-1 min-h-[14px]"></p>`
            }
          </div>

          <!-- Botones plus -->
          <div class="flex flex-col gap-1.5">
            <button class="btn-weight-adj w-14 h-10 rounded-xl border border-[#1E293B] bg-[#161E26] text-slate-400 font-mono font-bold text-sm active:bg-[#10B981]/20 active:border-[#10B981] active:text-[#10B981] transition-colors" data-card="${index}" data-delta="+5">+5</button>
            <button class="btn-weight-adj w-14 h-12 rounded-xl border border-[#1E293B] bg-[#161E26] text-slate-300 font-mono font-bold text-base active:bg-[#10B981]/20 active:border-[#10B981] active:text-[#10B981] transition-colors" data-card="${index}" data-delta="+2.5">+2.5</button>
          </div>
        </div>
      </div>

      <!-- Acción principal -->
      <div class="flex gap-3 mt-auto shrink-0">
        <button type="button" class="btn-effort w-16 h-[52px] rounded-xl border border-[#1E293B] bg-[#0B1218] text-slate-400 text-2xl flex flex-col items-center justify-center active:bg-[#1E293B] transition-colors" data-index="${index}" title="Registrar esfuerzo al límite">
          😓
          <span class="text-[8px] font-bold text-slate-600 mt-0.5">AL LÍMITE</span>
        </button>
        <button type="button" class="btn-logrado flex-1 h-[52px] rounded-xl bg-[#10B981] text-black font-black text-lg shadow-[0_0_30px_rgba(16,185,129,0.2)] active:scale-95 transition-transform" data-index="${index}">
          ✔ LOGRADO
        </button>
      </div>
    </div>`;
  }

  /* ─── Actualizar display de peso en una card ─────────── */
  function updateWeightDisplay(cardIndex) {
    const s = sets[cardIndex];
    const displayEl = document.getElementById(`weight-display-${cardIndex}`);
    const deltaEl   = document.getElementById(`weight-delta-${cardIndex}`);
    if (!displayEl) return;

    const originalWeight = parseFloat(workoutData.exercises[cardIndex]?.weight_kg) || 0;
    const currentWeight  = s.weight_kg;
    const delta          = Math.round((currentWeight - originalWeight) * 10) / 10;

    if (originalWeight > 0) {
      displayEl.textContent = currentWeight;
      if (deltaEl) {
        deltaEl.textContent = delta !== 0
          ? `${delta > 0 ? '+' : ''}${delta} vs plan`
          : '';
      }
    }
  }

  /* ─── Carry-over de peso a sets siguientes ───────────── */
  function applyWeightCarryOver(fromIndex, delta) {
    const exerciseName = sets[fromIndex].name;
    const originalWeightAtSource = parseFloat(workoutData.exercises[fromIndex]?.weight_kg) || 0;

    for (let i = fromIndex + 1; i < sets.length; i++) {
      if (sets[i].name !== exerciseName) continue;

      const origNext = parseFloat(workoutData.exercises[i]?.weight_kg) || 0;

      if (origNext === originalWeightAtSource || originalWeightAtSource === 0) {
        // Serie plana: aplicar mismo delta absoluto
        sets[i].weight_kg = Math.max(0, origNext + delta);
      } else {
        // Serie escalada: aplicar mismo delta absoluto (mantiene la escala relativa)
        sets[i].weight_kg = Math.max(0, origNext + delta);
      }

      // Redondear a 2.5
      sets[i].weight_kg = Math.round(sets[i].weight_kg / 2.5) * 2.5;

      // Actualizar display si la card ya está renderizada
      updateWeightDisplay(i);
    }
  }

  /* ─── Event: botones de peso ──────────────────────────── */
  deckEl.addEventListener('click', e => {
    const wBtn = e.target.closest('.btn-weight-adj');
    if (wBtn) {
      const cardIdx = parseInt(wBtn.dataset.card);
      if (cardIdx !== currentIndex) return; // solo la card activa

      const delta = parseFloat(wBtn.dataset.delta);
      const s = sets[cardIdx];

      if (s.weight_kg > 0) {
        s.weight_kg = Math.max(0, Math.round((s.weight_kg + delta) / 2.5) * 2.5);
        updateWeightDisplay(cardIdx);
        // Carry-over inmediato a sets siguientes del mismo ejercicio
        applyWeightCarryOver(cardIdx, delta);
      }
      return;
    }

    const btnLogrado = e.target.closest('.btn-logrado');
    if (btnLogrado) {
      saveLogAndNext(parseInt(btnLogrado.dataset.index), 'logrado', 'normal');
      return;
    }

    const btnEffort = e.target.closest('.btn-effort');
    if (btnEffort) {
      saveLogAndNext(parseInt(btnEffort.dataset.index), 'logrado', 'muy_pesado');
      return;
    }
  });

  /* ─── Guardar set y avanzar ───────────────────────────── */
  function saveLogAndNext(index, status, effort) {
    const s            = sets[index];
    const plannedWeight = parseFloat(workoutData.exercises[index]?.weight_kg) || 0;
    const actualWeight  = s.weight_kg > 0 ? s.weight_kg : null;

    const actualReps = repsToNumber(s.reps);
    workoutLogs.push({
      // payload base para exercise_logs
      exercise_id: s.exercise_id || null,
      exercise_name: s.name,
      set_number: s.setNum,
      planned_reps: s.reps || null,
      actual_reps: actualReps || null,
      planned_weight_kg: plannedWeight > 0 ? plannedWeight : null,
      actual_weight_kg: actualWeight,
      rpe_reported: s.rpe_target || null,
      performed_at: new Date().toISOString(),
      ignored_readiness_recommendation: readinessOverride,
      // compat para endpoints legacy
      muscle_group: s.muscle || null,
      reps_target: s.reps || null,
      reps_actual: s.reps || null,
      weight_target: plannedWeight > 0 ? plannedWeight : null,
      weight_used: actualWeight,
      status,
      effort_level: effort,
    });

    // Animar salida
    const currentCard = document.getElementById(`card-${index}`);
    if (currentCard) {
      currentCard.className = currentCard.className
        .replace('translate-x-0 scale-100 opacity-100 z-10', '')
        + ' transform -translate-x-[120%] opacity-0 pointer-events-none z-0';
    }

    // Auto-suggest esfuerzo elevado
    if (effort === 'muy_pesado' || effort === 'al_fallo') {
      heavySetsCount++;
      if (heavySetsCount >= 2) { showLoadSuggestion(); heavySetsCount = 0; }
    } else { heavySetsCount = 0; }

    currentIndex++;

    if (currentIndex < totalSets) {
      const nextCard = document.getElementById(`card-${currentIndex}`);
      if (nextCard) {
        nextCard.className = 'absolute inset-x-5 top-5 bottom-5 bg-[#161E26] border border-[#1E293B] rounded-3xl flex flex-col p-5 shadow-2xl transition-all duration-300 ease-out translate-x-0 scale-100 opacity-100 z-10';
      }

      // Timer si cambia ejercicio o terminó los sets del ejercicio actual
      const nextSet = sets[currentIndex];
      if (nextSet && (nextSet.name !== s.name || s.setNum === s.totalSets) && s.rest > 0) {
        startTimer(s.rest);
      }
    } else {
      finishWorkout();
    }

    updateProgressBar();
  }

  function updateProgressBar() {
    progressBar.style.width = `${(currentIndex / totalSets) * 100}%`;
  }

  /* ─── Timer con vibración ──────────────────────────────── */
  function startTimer(seconds) {
    clearInterval(restTimerInterval);
    let timeLeft = seconds;
    timerEl.classList.remove('hidden');
    timerEl.classList.add('flex');

    const update = () => {
      timerDisplay.textContent = `${String(Math.floor(timeLeft / 60)).padStart(2,'0')}:${String(timeLeft % 60).padStart(2,'0')}`;
    };
    update();

    restTimerInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(restTimerInterval);
        timerDisplay.textContent = '¡TIEMPO!';
        timerEl.classList.add('animate-bounce');
        // Vibración
        if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
        setTimeout(() => {
          timerEl.classList.remove('flex', 'animate-bounce');
          timerEl.classList.add('hidden');
        }, 3000);
      } else { update(); }
    }, 1000);
  }

  timerEl.addEventListener('click', () => {
    clearInterval(restTimerInterval);
    timerEl.classList.add('hidden');
    timerEl.classList.remove('flex');
  });

  /* ─── Sugerencia de carga ─────────────────────────────── */
  function showLoadSuggestion() {
    const el = document.getElementById('load-suggestion');
    if (!el || el.dataset.shown) return;
    el.dataset.shown = '1';
    el.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;border:1px solid rgba(245,158,11,.3);background:rgba(245,158,11,.08);margin-bottom:8px';
    el.innerHTML = `
      <span style="font-size:16px">⚠️</span>
      <p style="flex:1;font-size:11px;font-weight:700;color:#F59E0B">Esfuerzo elevado — considerá bajar 5-10%</p>
      <button onclick="this.parentElement.style.display='none'" style="color:#475569;font-size:18px;background:none;border:none;cursor:pointer">×</button>`;
    setTimeout(() => { if (el) el.style.display = 'none'; }, 7000);
  }

  if (isLowReadiness) {
    const loadSuggestion = document.getElementById('load-suggestion');
    if (loadSuggestion) {
      loadSuggestion.style.cssText =
        'display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;border:1px solid rgba(239,68,68,.35);background:rgba(239,68,68,.1);margin-bottom:8px';
      loadSuggestion.innerHTML = `
        <span style="font-size:16px">🛟</span>
        <p style="flex:1;font-size:11px;font-weight:700;color:#FCA5A5">
          Puntaje bajo: sugerimos reducir carga un 15% para entrenar de forma segura.
        </p>
        <button id="btn-override-readiness" style="background:#0B1218;border:1px solid rgba(248,113,113,.35);color:#FCA5A5;padding:6px 10px;border-radius:8px;font-size:10px;font-weight:800;cursor:pointer">
          Mantener carga original
        </button>
      `;
      const btnOverride = document.getElementById('btn-override-readiness');
      btnOverride?.addEventListener('click', () => {
        readinessOverride = true;
        sets.forEach((set, idx) => {
          const original = parseFloat(workoutData.exercises[idx]?.weight_kg) || 0;
          set.weight_kg = original;
        });
        loadSuggestion.style.display = 'none';
        toast('Override activo: se mantiene la carga original', 'warning');
        renderDeck();
      });
    }
  }

  /* ─── Finalizar ────────────────────────────────────────── */
  async function finishWorkout() {
    deckEl.innerHTML = `
    <div class="absolute inset-x-5 top-5 bottom-5 bg-[#10B981] rounded-3xl flex flex-col items-center justify-center p-6 text-black shadow-[0_0_40px_rgba(16,185,129,0.4)] z-50">
      <span class="material-symbols-rounded text-6xl mb-4 animate-spin">progress_activity</span>
      <h2 class="text-3xl font-black text-center mb-2">¡Entrenamiento Completado!</h2>
      <p class="font-bold opacity-80">Guardando tus resultados...</p>
    </div>`;

    try {
      const endTime = new Date();
      const durationMinutes = Math.round((endTime - new Date(sessionStartTime)) / 60000);
      const totalVolumeKg = workoutLogs.reduce((acc, log) => {
        const reps = repsToNumber(log.actual_reps ?? log.reps_actual);
        const weight = Number((log.actual_weight_kg ?? log.weight_used) || 0);
        return acc + (Number.isFinite(weight) ? weight : 0) * reps;
      }, 0);
      if (startedSessionId) {
        const completeRes = await fetch(`/api/workouts/sessions/${startedSessionId}/complete`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            intent_id: workoutData.intentId || null,
            duration_minutes: durationMinutes,
            logs: workoutLogs.map(log => ({ ...log, logged_at: new Date().toISOString() })),
          }),
        });
        if (!completeRes.ok) {
          throw new Error(`Complete API failed (${completeRes.status})`);
        }

        const exerciseLogRows = workoutLogs.map(log => ({
          gym_id: gymId,
          student_id: studentId,
          routine_id: workoutData.routineId || null,
          routine_day_id: workoutData.dayId || null,
          exercise_id: log.exercise_id || null,
          exercise_name: log.exercise_name,
          performed_at: log.performed_at || new Date().toISOString(),
          set_number: log.set_number || null,
          planned_reps: log.planned_reps,
          actual_reps: String(log.actual_reps || ''),
          planned_weight_kg: log.planned_weight_kg,
          actual_weight_kg: log.actual_weight_kg,
          rpe_reported: log.rpe_reported,
          notes: log.ignored_readiness_recommendation
            ? `override_readiness:${log.effort_level || 'normal'}`
            : log.effort_level || null
        }));
        const { error: exLogErr } = await db.from('exercise_logs').insert(exerciseLogRows);
        if (exLogErr) throw exLogErr;
      } else {
        const { data: sessionData, error: sessionErr } = await db.from('workout_sessions').insert({
          gym_id:           gymId,
          student_id:       studentId,
          routine_name:     workoutData.routineName,
          day_name:         workoutData.dayName,
          started_at:       sessionStartTime,
          completed_at:     endTime.toISOString(),
          duration_minutes: durationMinutes,
        }).select('id').single();
        if (sessionErr) throw sessionErr;

        const exerciseLogRows = workoutLogs.map(log => ({
          gym_id: gymId,
          student_id: studentId,
          routine_id: workoutData.routineId || null,
          routine_day_id: workoutData.dayId || null,
          exercise_id: log.exercise_id || null,
          exercise_name: log.exercise_name,
          performed_at: log.performed_at || new Date().toISOString(),
          set_number: log.set_number || null,
          planned_reps: log.planned_reps,
          actual_reps: String(log.actual_reps || ''),
          planned_weight_kg: log.planned_weight_kg,
          actual_weight_kg: log.actual_weight_kg,
          rpe_reported: log.rpe_reported,
          notes: log.ignored_readiness_recommendation
            ? `override_readiness:${log.effort_level || 'normal'}`
            : log.effort_level || null
        }));

        const { error: exLogErr } = await db.from('exercise_logs').insert(exerciseLogRows);
        if (exLogErr) throw exLogErr;
      }

      sessionStorage.removeItem('activeWorkout');

      deckEl.innerHTML = `
      <div class="absolute inset-x-5 top-5 bottom-5 bg-[#10B981] rounded-3xl flex flex-col items-center justify-center p-6 text-black shadow-[0_0_40px_rgba(16,185,129,0.4)] z-50">
        <span class="text-7xl mb-4">🎉</span>
        <h2 class="text-3xl font-black text-center mb-2">¡Guardado!</h2>
        <p class="font-bold opacity-80">${workoutLogs.length} sets completados.</p>
        <p class="font-bold opacity-80 mt-1">Entrenamiento completado: ${Math.round(totalVolumeKg).toLocaleString('es-AR')} kg movilizados.</p>
      </div>`;

      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 300]);
      setTimeout(() => { window.location.href = getStudentHomeUrl(); }, 2000);

    } catch (err) {
      console.error(err);
      deckEl.innerHTML = `
      <div class="absolute inset-x-5 top-5 bottom-5 flex items-center justify-center p-6">
        <div class="text-center">
          <p class="text-white font-bold mb-4">Error al guardar. No cierres la app.</p>
          <button onclick="location.reload()" class="bg-white text-black px-6 py-3 rounded-xl font-bold">Reintentar</button>
        </div>
      </div>`;
    }
  }

  async function ensureWorkoutSessionStarted() {
    if (!workoutData.intentId || startedSessionId) return;
    try {
      const startRes = await fetch(`/api/workouts/intents/${workoutData.intentId}/start`, {
        method: 'POST',
        headers: apiHeaders,
      });
      if (!startRes.ok) return;
      const payload = await startRes.json();
      startedSessionId = payload.session_id || null;
      if (startedSessionId) {
        workoutData.sessionId = startedSessionId;
        sessionStorage.setItem('activeWorkout', JSON.stringify(workoutData));
      }
    } catch (_) {}
  }

  document.getElementById('btn-cancel-workout').addEventListener('click', () => {
    if (confirm('¿Cancelar entrenamiento? No se guardará el progreso.')) {
      sessionStorage.removeItem('activeWorkout');
      window.location.href = getStudentHomeUrl();
    }
  });

  /* ─── Init ─────────────────────────────────────────────── */
  renderDeck();

})();
