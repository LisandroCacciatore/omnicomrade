/**
 * routine-builder.js
 * TechFitness — Creador de Rutinas con sets individuales
 */

(async () => {
  const session = await window.authGuard(['gim_admin', 'profesor']);
  if (!session) return;

  const db    = window.supabaseClient;
  const gymId = session.user.app_metadata.gym_id;
  const { PROGRAMS, toast, escHtml, debounce } = window.tfUtils;

  /* ─── State ─────────────────────────────────────────── */
  let mode           = 'libre';
  let days           = [];
  let exercises      = [];
  let selObjetivo    = null;
  let sourceProgram  = null;
  let sourceRMs      = {};
  let activeDayId    = null;
  let exPickerMuscle = 'all';
  let exPickerSearch = '';
  let tempProgPick   = null;
  let editRoutineId  = null;  // null = crear, UUID = editar

  // Detectar ?id= en la URL
  const _urlParams = new URLSearchParams(window.location.search);
  const _editId    = _urlParams.get('id');
  if (_editId) editRoutineId = _editId;

  const MUSCLE_COLORS = {
    pecho:'#F97316', espalda:'#3B82F6', hombros:'#8B5CF6',
    biceps:'#EC4899', triceps:'#F59E0B', core:'#EF4444',
    piernas:'#10B981', gluteos:'#06B6D4', cardio:'#84CC16', otros:'#64748B'
  };

  /* ─── Helpers ────────────────────────────────────────── */
  function newSetId() { return `s-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
  function newExId()  { return `e-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }

  /** Parsea "3×5" → [{set_number,reps,is_amrap}, ...]  */
  function parseSetsStr(setsStr, weight) {
    if (window.tfRoutineBuilderUtils?.parseSetsStr) {
      return window.tfRoutineBuilderUtils.parseSetsStr(setsStr, weight, newSetId);
    }

    return [{
      _sid:       newSetId(),
      set_number: 1,
      weight_kg:  weight || null,
      weight_pct: null,
      rpe_target: null,
      rir_target: null,
      reps:       setsStr || '',
      is_amrap:   false,
      notes:      '',
    }];
  }

  /* ─── Load DB ────────────────────────────────────────── */
  async function loadExercises() {
    const [{ data: g }, { data: c }] = await Promise.all([
      db.from('exercises').select('id,name,muscle_group,category').eq('is_global', true).is('deleted_at', null).order('name'),
      db.from('exercises').select('id,name,muscle_group,category').eq('gym_id', gymId).is('deleted_at', null).order('name'),
    ]);
    exercises = [...(g || []), ...(c || [])];
  }

  /* ─── Mode toggle ────────────────────────────────────── */
  document.getElementById('mode-libre').addEventListener('click', () => setMode('libre'));
  document.getElementById('mode-programa').addEventListener('click', () => setMode('programa'));

  function setMode(m) {
    mode = m;
    document.getElementById('mode-libre').classList.toggle('active', m === 'libre');
    document.getElementById('mode-programa').classList.toggle('active', m === 'programa');
    document.getElementById('program-source-config').classList.toggle('hidden', m === 'libre');
  }

  /* ─── Program picker ─────────────────────────────────── */
  const modalProgram  = document.getElementById('modal-program-pick');
  const programListEl = document.getElementById('modal-program-list');

  document.getElementById('btn-pick-program').addEventListener('click', openProgramModal);
  document.getElementById('close-prog-modal').addEventListener('click', () => modalProgram.classList.remove('open'));
  modalProgram.addEventListener('click', e => { if (e.target === modalProgram) modalProgram.classList.remove('open'); });

  function openProgramModal() {
    programListEl.innerHTML = PROGRAMS.map(p => `
      <div class="prog-pick-card ${tempProgPick?.id === p.id ? 'selected' : ''}" data-pid="${p.id}">
        <span style="font-size:20px">${p.icon}</span>
        <div class="flex-1">
          <div class="text-sm font-bold text-white">${p.name}</div>
          <div class="text-xs text-slate-500">${p.level} · ${p.daysPerWeek} días/sem</div>
        </div>
        <div style="width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0"></div>
      </div>`).join('');
    document.getElementById('confirm-prog-pick').disabled = !tempProgPick;
    modalProgram.classList.add('open');
  }

  programListEl.addEventListener('click', e => {
    const card = e.target.closest('.prog-pick-card');
    if (!card) return;
    tempProgPick = PROGRAMS.find(p => p.id === card.dataset.pid);
    programListEl.querySelectorAll('.prog-pick-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    document.getElementById('confirm-prog-pick').disabled = false;
  });

  document.getElementById('confirm-prog-pick').addEventListener('click', () => {
    if (!tempProgPick) return;
    sourceProgram = tempProgPick;
    renderProgramConfig();
    modalProgram.classList.remove('open');
  });

  function renderProgramConfig() {
    const p = sourceProgram;
    document.getElementById('selected-program-preview').classList.remove('hidden');
    document.getElementById('sp-icon').textContent   = p.icon;
    document.getElementById('sp-name').textContent   = p.name;
    document.getElementById('sp-meta').textContent   = `${p.daysPerWeek} días/sem · ${p.inputs.length} cargas`;
    document.getElementById('sp-level').textContent  = p.level;
    document.getElementById('btn-pick-program-label').textContent = p.name;

    p.inputs.forEach(i => { if (!sourceRMs[i.id]) sourceRMs[i.id] = i.default; });

    document.getElementById('rm-inputs-grid').innerHTML = p.inputs.map(i => `
      <div>
        <label class="form-label">${i.label}</label>
        <div class="rm-input-wrap">
          <input type="number" class="rm-input" data-rm-id="${i.id}" value="${sourceRMs[i.id]}" min="0" max="999" step="2.5"/>
          <span class="unit">KG</span>
        </div>
      </div>`).join('');
  }

  document.getElementById('rm-inputs-grid').addEventListener('input', e => {
    if (e.target.classList.contains('rm-input'))
      sourceRMs[e.target.dataset.rmId] = parseFloat(e.target.value) || 0;
  });

  document.getElementById('btn-generate-from-program').addEventListener('click', () => {
    if (!sourceProgram) return;
    const weeksList = sourceProgram.generate(sourceRMs);
    if (!weeksList?.length) return;

    const week1 = weeksList[0];
    const nameInput = document.getElementById('routine-name');
    if (!nameInput.value) {
      nameInput.value = `${sourceProgram.name} — ${week1.label}`;
      nameInput.dispatchEvent(new Event('input'));
    }
    if (!selObjetivo) setObjetivo('fuerza');

    days = week1.days.map((d, i) => ({
      id:        `day-${Date.now()}-${i}`,
      name:      d.label || `Día ${i + 1}`,
      exercises: (d.lifts || [])
        .filter(ex => ex.type !== 'ACC')   // Excluir asistencia genérica
        .map((ex, j) => ({
          _id:         newExId(),
          exercise_id: null,
          name:        ex.name,
          muscle_group: null,
          rest:        ex.rest || 90,
          notes:       ex.note || '',
          method_slug: sourceProgram.id,
          sets_detail: parseSetsStr(ex.sets, ex.w),
        }))
    }));

    renderDays();
  });

  /* ─── Objetivo picker ────────────────────────────────── */
  document.getElementById('obj-picker').addEventListener('click', e => {
    const btn = e.target.closest('.obj-btn');
    if (!btn) return;
    setObjetivo(btn.dataset.val);
  });

  function setObjetivo(val) {
    selObjetivo = val;
    document.querySelectorAll('.obj-btn').forEach(b => b.classList.toggle('active', b.dataset.val === val));
  }

  /* ─── Routine name + metadata watchers ──────────────── */
  document.getElementById('routine-name').addEventListener('input', e => {
    document.getElementById('btn-save-routine').disabled = !(e.target.value.trim() && days.length > 0);
  });

  // Re-calcular límite cuando cambian semanas o días/sem
  ['routine-weeks', 'routine-days-per-week'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => renderDays());
  });

  /* ─── Days management ────────────────────────────────── */
  const canvas = document.getElementById('days-canvas');

  function getMaxDays() {
    const weeks    = parseInt(document.getElementById('routine-weeks').value) || 0;
    const daysPerW = parseInt(document.getElementById('routine-days-per-week')?.value) || 0;
    if (weeks > 0 && daysPerW > 0) return weeks * daysPerW;
    return null; // sin límite definido
  }

  function addDay(name = '') {
    const max = getMaxDays();
    if (max !== null && days.length >= max) {
      toast(`Límite alcanzado: ${max} días para ${document.getElementById('routine-weeks').value} semanas × ${document.getElementById('routine-days-per-week').value} días/sem`, 'error');
      return;
    }
    days.push({ id: `day-${Date.now()}`, name: name || `Día ${days.length + 1}`, exercises: [] });
    renderDays();
  }

  function removeDay(id) {
    days = days.filter(d => d.id !== id);
    renderDays();
  }

  function removeExercise(dayId, exId) {
    const day = days.find(d => d.id === dayId);
    if (day) day.exercises = day.exercises.filter(ex => ex._id !== exId);
    renderDays();
  }

  function addSet(dayId, exId) {
    const day = days.find(d => d.id === dayId);
    if (!day) return;
    const ex = day.exercises.find(ex => ex._id === exId);
    if (!ex) return;
    const n = ex.sets_detail.length + 1;
    // Copiar peso del último set como default
    const lastSet = ex.sets_detail[ex.sets_detail.length - 1];
    ex.sets_detail.push(defaultSet(n, lastSet?.weight_kg, lastSet?.reps || ''));
    renderDays();
  }

  function removeSet(dayId, exId, sid) {
    const day = days.find(d => d.id === dayId);
    if (!day) return;
    const ex = day.exercises.find(ex => ex._id === exId);
    if (!ex || ex.sets_detail.length <= 1) return;
    ex.sets_detail = ex.sets_detail.filter(s => s._sid !== sid);
    // Renumerar
    ex.sets_detail.forEach((s, i) => { s.set_number = i + 1; });
    renderDays();
  }

  function renderDays() {
    canvas.innerHTML = days.map((day, idx) => `
      <div class="day-col" data-day-id="${day.id}">
        <div class="day-header">
          <button type="button" class="collapse-toggle" data-day-id="${day.id}" title="Colapsar/Expandir">
            <span class="material-symbols-rounded text-slate-500 text-[16px]">chevron_right</span>
          </button>
          <span class="material-symbols-rounded drag-handle text-slate-600 text-[16px]">drag_indicator</span>
          <input class="day-name-input" value="${escHtml(day.name)}" placeholder="Nombre del día"
            maxlength="40" data-day-id="${day.id}" />
          <button type="button" class="action-btn danger btn-remove-day" data-day-id="${day.id}" title="Eliminar día">
            <span class="material-symbols-rounded pointer-events-none">close</span>
          </button>
        </div>
        <div class="day-exercises" data-day-id="${day.id}" data-expanded="true">
          ${day.exercises.map(ex => exerciseBlockHTML(ex, day.id)).join('')}
        </div>
        <button type="button" class="btn-add-ex" data-day-id="${day.id}">
          <span class="material-symbols-rounded" style="font-size:16px">add</span> Agregar ejercicio
        </button>
      </div>`).join('') + `
      <button type="button" class="btn-add-day" id="btn-add-day-main">
        <span class="material-symbols-rounded text-[28px] text-slate-600">add_circle</span>
        Agregar día
      </button>`;

    document.querySelectorAll('.collapse-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const dayId = btn.dataset.dayId;
        const exercises = document.querySelector(`.day-exercises[data-day-id="${dayId}"]`);
        const isExpanded = exercises.dataset.expanded === 'true';
        exercises.dataset.expanded = isExpanded ? 'false' : 'true';
        exercises.style.display = isExpanded ? 'none' : '';
        btn.querySelector('span').style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(90deg)';
      });
    });

    document.getElementById('days-count').textContent = days.length;
    const name_ = document.getElementById('routine-name').value.trim();
    document.getElementById('btn-save-routine').disabled = !(name_ && days.length > 0);

    // Límite de días: mostrar badge y bloquear botón si se alcanza
    const maxDays   = getMaxDays();
    const limitBadge = document.getElementById('days-limit-badge');
    const limitHint  = document.getElementById('days-limit-hint');
    const addDayBtn  = document.getElementById('btn-add-day-main');

    if (maxDays !== null) {
      const remaining = maxDays - days.length;
      limitBadge.textContent = `${days.length}/${maxDays}`;
      limitBadge.classList.remove('hidden');

      if (remaining <= 0) {
        limitBadge.className = 'ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/20';
        if (addDayBtn) { addDayBtn.disabled = true; addDayBtn.style.opacity = '0.3'; addDayBtn.style.cursor = 'not-allowed'; }
        if (limitHint) limitHint.textContent = `Límite alcanzado (${maxDays} días para ${document.getElementById('routine-weeks').value} sem × ${document.getElementById('routine-days-per-week').value} días/sem)`;
      } else {
        limitBadge.className = 'ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-500';
        if (addDayBtn) { addDayBtn.disabled = false; addDayBtn.style.opacity = ''; addDayBtn.style.cursor = ''; }
        if (limitHint) limitHint.textContent = `Podés agregar ${remaining} día${remaining !== 1 ? 's' : ''} más`;
      }
    } else {
      limitBadge.classList.add('hidden');
      if (addDayBtn) { addDayBtn.disabled = false; addDayBtn.style.opacity = ''; addDayBtn.style.cursor = ''; }
      if (limitHint) limitHint.textContent = 'Hacé click en el día para agregar ejercicios';
    }
  }

  /* ─── Exercise block HTML ────────────────────────────── */
  function exerciseBlockHTML(ex, dayId) {
    const mc = MUSCLE_COLORS[ex.muscle_group] || '#64748B';

    const setsHTML = ex.sets_detail.map(s => `
      <div class="ex-set-row"
        data-day-id="${dayId}" data-ex-id="${ex._id}" data-sid="${s._sid}">
        <span class="set-num">S${s.set_number}</span>
        <input class="set-input" type="number" value="${s.weight_kg ?? ''}" placeholder="—"
          data-day-id="${dayId}" data-ex-id="${ex._id}" data-sid="${s._sid}" data-field="weight_kg"
          step="2.5" min="0" />
        <input class="set-input" value="${escHtml(s.reps ?? '')}" placeholder="—"
          data-day-id="${dayId}" data-ex-id="${ex._id}" data-sid="${s._sid}" data-field="reps" />
        <input class="set-input" type="number" value="${s.rpe_target ?? ''}" placeholder="—"
          data-day-id="${dayId}" data-ex-id="${ex._id}" data-sid="${s._sid}" data-field="rpe_target"
          step="0.5" min="1" max="10" />
        <input class="set-input" type="number" value="${s.rir_target ?? ''}" placeholder="—"
          data-day-id="${dayId}" data-ex-id="${ex._id}" data-sid="${s._sid}" data-field="rir_target"
          min="0" max="5" />
        <span class="amrap-toggle">
          <input type="checkbox" id="amrap-${s._sid}" class="set-amrap" ${s.is_amrap ? 'checked' : ''}
            data-day-id="${dayId}" data-ex-id="${ex._id}" data-sid="${s._sid}" />
          <label for="amrap-${s._sid}" class="amrap-label">${s.is_amrap ? 'AMRAP' : 'AMRAP'}</label>
        </span>
        <button type="button" class="btn-remove-set"
          data-day-id="${dayId}" data-ex-id="${ex._id}" data-sid="${s._sid}"
          ${ex.sets_detail.length <= 1 ? 'disabled' : ''}>
          <span class="material-symbols-rounded pointer-events-none" style="font-size:12px">close</span>
        </button>
      </div>`).join('');

    return `
    <div class="ex-block" data-ex-id="${ex._id}">
      <div class="ex-block-header">
        <span class="material-symbols-rounded drag-handle" style="font-size:14px">drag_indicator</span>
        <span class="ex-block-name" title="${escHtml(ex.name)}">${escHtml(ex.name)}</span>
        ${ex.muscle_group ? `<span class="ex-block-muscle" style="background:${mc}18;color:${mc};border:1px solid ${mc}30">${ex.muscle_group}</span>` : ''}
        <button type="button" class="action-btn danger btn-remove-ex"
          data-day-id="${dayId}" data-ex-id="${ex._id}">
          <span class="material-symbols-rounded pointer-events-none">close</span>
        </button>
      </div>

      <div class="ex-sets-header">
        <span></span>
        <span>PESO KG</span>
        <span>REPS</span>
        <span>RPE</span>
        <span>RIR</span>
        <span>AMRAP</span>
        <span></span>
      </div>

      ${setsHTML}

      <div class="ex-footer">
        <button type="button" class="btn-add-set" data-day-id="${dayId}" data-ex-id="${ex._id}">
          <span class="material-symbols-rounded" style="font-size:12px">add</span> Set
        </button>
        <div class="ex-footer-rest">
          <span class="ex-param-label">DESC.</span>
          <input class="set-input" type="number" value="${ex.rest ?? ''}" placeholder="90"
            style="width:52px" data-day-id="${dayId}" data-ex-id="${ex._id}" data-field="rest" min="0" />
          <span class="ex-param-label">seg</span>
        </div>
      </div>
    </div>`;
  }

  /* ─── Canvas events (delegation) ────────────────────── */
  canvas.addEventListener('click', e => {
    if (e.target.closest('#btn-add-day-main')) { addDay(); return; }

    const btnRD = e.target.closest('.btn-remove-day');
    if (btnRD) { removeDay(btnRD.dataset.dayId); return; }

    const btnAE = e.target.closest('.btn-add-ex');
    if (btnAE) { openExPicker(btnAE.dataset.dayId); return; }

    const btnRE = e.target.closest('.btn-remove-ex');
    if (btnRE) { removeExercise(btnRE.dataset.dayId, btnRE.dataset.exId); return; }

    const btnAS = e.target.closest('.btn-add-set');
    if (btnAS) { addSet(btnAS.dataset.dayId, btnAS.dataset.exId); return; }

    const btnRS = e.target.closest('.btn-remove-set');
    if (btnRS) { removeSet(btnRS.dataset.dayId, btnRS.dataset.exId, btnRS.dataset.sid); return; }
  });

  canvas.addEventListener('input', e => {
    if (e.target.classList.contains('day-name-input')) {
      const d = days.find(d => d.id === e.target.dataset.dayId);
      if (d) d.name = e.target.value;
      return;
    }

    const { dayId, exId, sid, field } = e.target.dataset;
    if (!dayId || !exId) return;

    const day = days.find(d => d.id === dayId);
    if (!day) return;
    const ex = day.exercises.find(x => x._id === exId);
    if (!ex) return;

    // Descanso (nivel ejercicio)
    if (field === 'rest') { ex.rest = parseInt(e.target.value) || null; return; }

    // Campos de set
    if (!sid) return;
    const s = ex.sets_detail.find(s => s._sid === sid);
    if (!s) return;

    const val = e.target.value.trim();
    if (field === 'weight_kg')  s.weight_kg  = val ? parseFloat(val) : null;
    if (field === 'reps')       s.reps       = val || null;
    if (field === 'rpe_target') s.rpe_target = val ? parseFloat(val) : null;
    if (field === 'rir_target') s.rir_target = val ? parseInt(val) : null;
  });

  canvas.addEventListener('change', e => {
    if (!e.target.classList.contains('set-amrap')) return;
    const { dayId, exId, sid } = e.target.dataset;
    const day = days.find(d => d.id === dayId);
    const ex  = day?.exercises.find(x => x._id === exId);
    const s   = ex?.sets_detail.find(s => s._sid === sid);
    if (s) s.is_amrap = e.target.checked;
  });

  /* ─── Exercise picker ────────────────────────────────── */
  const exPickerBackdrop = document.getElementById('ex-picker-backdrop');
  const exPickerEl       = document.getElementById('ex-picker');
  const exPickerListEl   = document.getElementById('ex-picker-list');

  function openExPicker(dayId) {
    activeDayId = dayId;
    const day = days.find(d => d.id === dayId);
    document.getElementById('ex-picker-day-label').textContent = day ? `→ ${day.name}` : '';
    renderExPickerList();
    exPickerBackdrop.classList.add('open');
    exPickerEl.classList.add('open');
    document.getElementById('ex-picker-search').focus();
  }

  function closeExPicker() {
    exPickerBackdrop.classList.remove('open');
    exPickerEl.classList.remove('open');
    activeDayId = null;
  }

  document.getElementById('close-ex-picker').addEventListener('click', closeExPicker);
  exPickerBackdrop.addEventListener('click', closeExPicker);

  document.getElementById('ex-picker-search').addEventListener('input', debounce(e => {
    exPickerSearch = e.target.value.toLowerCase().trim();
    renderExPickerList();
  }, 200));

  document.getElementById('ex-picker-muscle-filter').addEventListener('click', e => {
    const btn = e.target.closest('.sel-btn');
    if (!btn) return;
    document.querySelectorAll('#ex-picker-muscle-filter .sel-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    exPickerMuscle = btn.dataset.muscle;
    renderExPickerList();
  });

  function renderExPickerList() {
    const filtered = exercises.filter(ex => {
      const matchM = exPickerMuscle === 'all' || ex.muscle_group === exPickerMuscle;
      const matchS = !exPickerSearch || ex.name.toLowerCase().includes(exPickerSearch);
      return matchM && matchS;
    });

    if (!filtered.length) {
      exPickerListEl.innerHTML = `<div style="text-align:center;padding:40px 16px;color:#334155;font-size:12px">Sin resultados</div>`;
      return;
    }

    exPickerListEl.innerHTML = filtered.map(ex => {
      const mc = MUSCLE_COLORS[ex.muscle_group] || '#64748B';
      return `
      <div class="ex-pick-item" data-ex-id="${ex.id}">
        <div style="width:8px;height:8px;border-radius:50%;background:${mc};flex-shrink:0"></div>
        <div class="flex-1 min-w-0 pointer-events-none">
          <div style="font-size:12px;font-weight:700;color:#E2E8F0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(ex.name)}</div>
          <div style="font-size:10px;color:#475569">${ex.muscle_group || ''}${ex.category ? ' · ' + ex.category : ''}</div>
        </div>
        <span class="material-symbols-rounded pointer-events-none" style="font-size:18px;color:#334155">add_circle</span>
      </div>`;
    }).join('');
  }

  exPickerListEl.addEventListener('click', e => {
    const item = e.target.closest('.ex-pick-item');
    if (!item || !activeDayId) return;

    const ex  = exercises.find(ex => ex.id === item.dataset.exId);
    const day = days.find(d => d.id === activeDayId);
    if (!ex || !day) return;

    day.exercises.push({
      _id:         newExId(),
      exercise_id: ex.id,
      name:        ex.name,
      muscle_group: ex.muscle_group,
      rest:        90,
      notes:       '',
      method_slug: null,
      sets_detail: [defaultSet(1, null, '')],
    });

    // Flash de confirmación → cerrar automáticamente
    item.style.background = 'rgba(16,185,129,.15)';
    item.style.transition = 'background .2s';
    setTimeout(() => {
      closeExPicker();
      renderDays();
    }, 220);
  });

  /* ─── Save / Update routine ─────────────────────────── */
  document.getElementById('form-routine').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('routine-name').value.trim();
    if (!name) { toast('El nombre es obligatorio', 'error'); return; }
    if (!days.length) { toast('Agregá al menos un día', 'error'); return; }

    const btn = document.getElementById('btn-save-routine');
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-rounded text-[17px] animate-spin">progress_activity</span>${editRoutineId ? 'Actualizando…' : 'Guardando…'}`;

    const routinePayload = {
      name,
      description:      document.getElementById('routine-desc').value.trim() || null,
      objetivo:         selObjetivo || 'general',
      duration_weeks:   parseInt(document.getElementById('routine-weeks').value) || null,
      days_per_week:    parseInt(document.getElementById('routine-days-per-week')?.value) || days.length,
      source_program:   mode === 'programa' && sourceProgram ? sourceProgram.id : null,
      source_rm_values: mode === 'programa' && sourceProgram ? sourceRMs : null,
      updated_at:       new Date().toISOString(),
    };

    try {
      let routineId;

      if (editRoutineId) {
        // ── EDITAR: UPDATE routine + borrar días viejos y reinsertar ──
        const { error: ue } = await db.from('routines').update(routinePayload).eq('id', editRoutineId);
        if (ue) throw ue;
        routineId = editRoutineId;

        // Borrar días existentes en cascada (routine_days → rde → rdes por FK CASCADE)
        const { error: de } = await db.from('routine_days').delete().eq('routine_id', routineId);
        if (de) throw de;

      } else {
        // ── CREAR: INSERT routine ──
        const { data: routine, error: re } = await db.from('routines').insert({
          gym_id: gymId, ...routinePayload
        }).select('id').single();
        if (re) throw re;
        routineId = routine.id;
      }

      // 2. Days → exercises → sets (igual para crear y editar)
      for (let di = 0; di < days.length; di++) {
        const day = days[di];
        const { data: rdRow, error: rde } = await db.from('routine_days').insert({
          routine_id: routineId, day_number: di + 1, name: day.name,
        }).select('id').single();
        if (rde) throw rde;

        for (let ei = 0; ei < day.exercises.length; ei++) {
          const ex = day.exercises[ei];
          const { data: rdeRow, error: exErr } = await db.from('routine_day_exercises').insert({
            routine_day_id: rdRow.id,
            exercise_id:    ex.exercise_id || null,
            exercise_name:  ex.name,
            order_index:    ei,
            sets:           ex.sets_detail.length,
            reps:           ex.sets_detail[0]?.reps || null,
            rest_seconds:   ex.rest || null,
            notes:          ex.notes || null,
            method_slug:    ex.method_slug || null,
          }).select('id').single();
          if (exErr) throw exErr;

          const setRows = ex.sets_detail.map(s => ({
            routine_day_exercise_id: rdeRow.id,
            set_number:  s.set_number,
            weight_kg:   s.weight_kg   || null,
            weight_pct:  s.weight_pct  || null,
            tm_ref:      s.tm_ref      || null,
            rpe_target:  s.rpe_target  || null,
            rir_target:  s.rir_target  || null,
            reps_target: s.reps        || null,
            is_amrap:    s.is_amrap    || false,
            notes:       s.notes       || null,
          }));
          const { error: setsErr } = await db.from('routine_day_exercise_sets').insert(setRows);
          if (setsErr) throw setsErr;
        }
      }

      toast(editRoutineId ? 'Rutina actualizada ✓' : 'Rutina guardada ✓');
      setTimeout(() => { window.location.href = 'routine-list.html'; }, 1400);

    } catch (err) {
      console.error(err);
      toast(err.message || 'Error al guardar', 'error');
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-rounded text-[17px]">save</span><span id="save-routine-text">${editRoutineId ? 'Actualizar rutina' : 'Guardar rutina'}</span>`;
    }
  });

  /* ─── ESC ────────────────────────────────────────────── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && exPickerEl.classList.contains('open')) closeExPicker();
  });

  /* ─── Load existing routine for edit ────────────────── */
  async function loadRoutineForEdit(id) {
    const { data: r, error } = await db.from('routines').select(`
      id, name, description, objetivo, duration_weeks, days_per_week,
      routine_days (
        id, day_number, name,
        routine_day_exercises (
          id, order_index, exercise_name, exercise_id, sets, reps, rest_seconds, notes, method_slug,
          routine_day_exercise_sets (
            id, set_number, weight_kg, weight_pct, rpe_target, rir_target, reps_target, is_amrap, notes
          )
        )
      )
    `).eq('id', id).single();

    if (error || !r) { toast('No se pudo cargar la rutina', 'error'); return; }

    // Poblar campos del header
    document.getElementById('routine-name').value = r.name || '';
    document.getElementById('routine-desc').value = r.description || '';
    document.getElementById('routine-weeks').value = r.duration_weeks || '';
    document.getElementById('routine-days-per-week').value = r.days_per_week || '';

    // Objetivo
    selObjetivo = r.objetivo || null;
    document.querySelectorAll('.objetivo-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.val === selObjetivo));

    // Rebuild days state
    const sortedDays = (r.routine_days || []).sort((a,b) => a.day_number - b.day_number);
    days = sortedDays.map(rd => ({
      id: `day-${rd.id}`,
      name: rd.name || `Día ${rd.day_number}`,
      exercises: (rd.routine_day_exercises || [])
        .sort((a,b) => a.order_index - b.order_index)
        .map(rde => {
          const setsRaw = (rde.routine_day_exercise_sets || [])
            .sort((a,b) => a.set_number - b.set_number);

          const sets_detail = setsRaw.length > 0
            ? setsRaw.map(s => ({
                _sid:       `sid-${s.id}`,
                set_number:  s.set_number,
                weight_kg:   s.weight_kg  || null,
                weight_pct:  s.weight_pct || null,
                rpe_target:  s.rpe_target || null,
                rir_target:  s.rir_target || null,
                reps:        s.reps_target || rde.reps || '',
                is_amrap:    s.is_amrap   || false,
                notes:       s.notes      || '',
              }))
            : [defaultSet(1, rde.weight_kg, rde.reps || '')];

          return {
            _id:          newExId(),
            exercise_id:  rde.exercise_id  || null,
            name:         rde.exercise_name || '—',
            muscle_group: null,
            rest:         rde.rest_seconds || 90,
            notes:        rde.notes        || '',
            method_slug:  rde.method_slug  || null,
            sets_detail,
          };
        }),
    }));

    // UI: cambiar título y botón
    document.getElementById('header-title').textContent    = 'Editar rutina';
    document.getElementById('header-subtitle').textContent = 'Modificá el plan existente';
    const _saveSpan = document.getElementById('save-routine-text');
    if (_saveSpan) _saveSpan.textContent = 'Actualizar rutina';

    renderDays();
  }

  /* ─── Init ───────────────────────────────────────────── */
  await loadExercises();

  if (editRoutineId) {
    await loadRoutineForEdit(editRoutineId);
  } else {
    renderDays();
  }

})();

