/**
 * routine-builder.js
 * TechFitness — Creador de Rutinas con sets individuales
 */

(async () => {
  const ctx = await window.authGuard(['gim_admin', 'profesor']);
  if (!ctx) return;

  const { gymId } = ctx;
  const dbClient = window.supabaseClient;
  const db = dbClient;
  const dbApi = window.tfDb?.createDB ? window.tfDb.createDB(dbClient) : null;
  const { PROGRAMS, toast, escHtml, debounce } = window.tfUtils;

  /* ─── State ─────────────────────────────────────────── */
  let mode = 'libre';
  let days = [];
  let exercises = [];
  let selObjetivo = null;
  let sourceProgram = null;
  let sourceRMs = {};
  let activeDayId = null;
  let exPickerMuscle = 'all';
  let exPickerSearch = '';
  let tempProgPick = null;
  let editRoutineId = null; // null = crear, UUID = editar
  let expandedExercises = new Set(); // track exercises con métricas avanzadas visibles
  let compactView = false;
  let draftAutoSaveTimer = null;
  let lastSavedDraft = null;

  // Detectar ?id= en la URL
  const _urlParams = new URLSearchParams(window.location.search);
  const _editId = _urlParams.get('id');
  if (_editId) editRoutineId = _editId;

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

  /* ─── Helpers ────────────────────────────────────────── */
  function newSetId() {
    return `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
  function newExId() {
    return `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /** Parsea "3×5" → [{set_number,reps,is_amrap}, ...]  */
  function parseSetsStr(setsStr, weight) {
    if (window.tfRoutineBuilderUtils?.parseSetsStr) {
      return window.tfRoutineBuilderUtils.parseSetsStr(setsStr, weight, newSetId);
    }

    return [
      {
        _sid: newSetId(),
        set_number: 1,
        weight_kg: weight || null,
        weight_pct: null,
        rpe_target: null,
        rir_target: null,
        reps: setsStr || '',
        is_amrap: false,
        notes: ''
      }
    ];
  }

  function defaultSet(n, weightKg, reps) {
    if (window.tfRoutineBuilderUtils?.defaultSet) {
      return window.tfRoutineBuilderUtils.defaultSet(n, weightKg, reps, newSetId);
    }

    return {
      _sid: newSetId(),
      set_number: n,
      weight_kg: weightKg || null,
      weight_pct: null,
      rpe_target: null,
      rir_target: null,
      reps: reps || '',
      is_amrap: false,
      notes: ''
    };
  }

  function findExercise(dayId, exId) {
    const day = days.find((d) => d.id === dayId);
    if (!day) return null;
    return day.exercises.find((x) => x._id === exId) || null;
  }

  function normalizeMuscleKey(raw) {
    const key = String(raw || 'otros')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return key || 'otros';
  }

  function updateSummary() {
    const name = document.getElementById('routine-name')?.value?.trim() || 'Sin nombre';
    const objetivo = selObjetivo || 'Sin objetivo';
    const daysCount = days.length;
    const exCount = days.reduce((acc, d) => acc + (d.exercises?.length || 0), 0);
    const setsCount = days.reduce(
      (acc, d) => acc + d.exercises.reduce((sAcc, ex) => sAcc + (ex.sets_detail?.length || 0), 0),
      0
    );

    const byMuscle = {};
    days.forEach((day) => {
      day.exercises.forEach((ex) => {
        const muscle = normalizeMuscleKey(ex.muscle_group);
        byMuscle[muscle] = (byMuscle[muscle] || 0) + (ex.sets_detail?.length || 0);
      });
    });

    const summaryEl = document.getElementById('routine-summary');
    if (summaryEl) summaryEl.classList.remove('hidden');
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    setText('sum-name', name);
    setText('sum-obj', objetivo);
    setText('sum-days', `${daysCount} día${daysCount !== 1 ? 's' : ''}`);
    setText('sum-ex', `${exCount} ejercicio${exCount !== 1 ? 's' : ''}`);
    setText('sum-sets', `${setsCount} sets`);

    const volumeEl = document.getElementById('summary-muscle-volume');
    if (!volumeEl) return;
    const volumeEntries = Object.entries(byMuscle)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (!volumeEntries.length) {
      volumeEl.innerHTML =
        '<span class="text-[10px] text-slate-600">Sin volumen por músculo todavía</span>';
      return;
    }

    volumeEl.innerHTML = volumeEntries
      .map(([muscle, sets]) => {
        const color =
          sets > 20
            ? 'bg-warning/15 text-warning border-warning/40'
            : 'bg-slate-900 text-slate-400 border-border-dark';
        return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold ${color}">${escHtml(
          muscle
        )}: ${sets} sets</span>`;
      })
      .join('');

    const pushMuscles = ['pecho', 'hombros', 'triceps'];
    const pullMuscles = ['espalda', 'biceps'];
    const pushSets = pushMuscles.reduce((acc, m) => acc + (byMuscle[m] || 0), 0);
    const pullSets = pullMuscles.reduce((acc, m) => acc + (byMuscle[m] || 0), 0);
    const ratioEl = document.getElementById('summary-movement-alert');
    if (!ratioEl) return;

    if (pushSets > 0 && pullSets === 0) {
      ratioEl.className =
        'mt-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-warning/10 text-warning border border-warning/30';
      ratioEl.textContent = `Push/Pull desbalanceado (${pushSets}:0). Sumá volumen de espalda para prevenir sobrecarga anterior.`;
      return;
    }

    if (pushSets > pullSets * 1.8 && pullSets > 0) {
      ratioEl.className =
        'mt-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-warning/10 text-warning border border-warning/30';
      ratioEl.textContent = `Push/Pull ratio: ${pushSets}:${pullSets} (alto empuje).`;
      return;
    }

    ratioEl.className =
      'mt-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    ratioEl.textContent = `Push/Pull ratio balanceado: ${pushSets}:${pullSets}`;
  }

  /* ─── Load DB ────────────────────────────────────────── */
  async function loadExercises() {
    if (dbApi?.exercises?.getGlobalAndGym) {
      const { data, error } = await dbApi.exercises.getGlobalAndGym(gymId);
      if (error) {
        console.error('❌ Error cargando ejercicios via dbApi:', error.message || error);
        toast('No se pudo cargar el catálogo de ejercicios', 'error');
        exercises = [];
        return;
      }
      exercises = data || [];
      return;
    }

    const [{ data: g }, { data: c }] = await Promise.all([
      dbClient
        .from('exercises')
        .select('id,name,muscle_group,category')
        .eq('is_global', true)
        .is('deleted_at', null)
        .order('name'),
      dbClient
        .from('exercises')
        .select('id,name,muscle_group,category')
        .eq('gym_id', gymId)
        .is('deleted_at', null)
        .order('name')
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
  const modalProgram = document.getElementById('modal-program-pick');
  const programListEl = document.getElementById('modal-program-list');

  document.getElementById('btn-pick-program').addEventListener('click', openProgramModal);
  document
    .getElementById('close-prog-modal')
    .addEventListener('click', () => modalProgram.classList.remove('open'));
  modalProgram.addEventListener('click', (e) => {
    if (e.target === modalProgram) modalProgram.classList.remove('open');
  });

  function openProgramModal() {
    programListEl.innerHTML = PROGRAMS.map(
      (p) => `
      <div class="prog-pick-card ${tempProgPick?.id === p.id ? 'selected' : ''}" data-pid="${p.id}">
        <span style="font-size:20px">${p.icon}</span>
        <div class="flex-1">
          <div class="text-sm font-bold text-white">${p.name}</div>
          <div class="text-xs text-slate-500">${p.level} · ${p.daysPerWeek} días/sem</div>
        </div>
        <div style="width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0"></div>
      </div>`
    ).join('');
    document.getElementById('confirm-prog-pick').disabled = !tempProgPick;
    modalProgram.classList.add('open');
  }

  programListEl.addEventListener('click', (e) => {
    const card = e.target.closest('.prog-pick-card');
    if (!card) return;
    tempProgPick = PROGRAMS.find((p) => p.id === card.dataset.pid);
    programListEl
      .querySelectorAll('.prog-pick-card')
      .forEach((c) => c.classList.remove('selected'));
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
    document.getElementById('sp-icon').textContent = p.icon;
    document.getElementById('sp-name').textContent = p.name;
    document.getElementById('sp-meta').textContent =
      `${p.daysPerWeek} días/sem · ${p.inputs.length} cargas`;
    document.getElementById('sp-level').textContent = p.level;
    document.getElementById('btn-pick-program-label').textContent = p.name;

    p.inputs.forEach((i) => {
      if (!sourceRMs[i.id]) sourceRMs[i.id] = i.default;
    });

    document.getElementById('rm-inputs-grid').innerHTML = p.inputs
      .map(
        (i) => `
      <div>
        <label class="form-label">${i.label}</label>
        <div class="rm-input-wrap">
          <input type="number" class="rm-input" data-rm-id="${i.id}" value="${sourceRMs[i.id]}" min="0" max="999" step="2.5"/>
          <span class="unit">KG</span>
        </div>
      </div>`
      )
      .join('');
  }

  document.getElementById('rm-inputs-grid').addEventListener('input', (e) => {
    if (e.target.classList.contains('rm-input'))
      sourceRMs[e.target.dataset.rmId] = parseFloat(e.target.value) || 0;
  });

  document.getElementById('btn-generate-from-program').addEventListener('click', () => {
    if (!sourceProgram) return;

    // Si hay días existentes, mostrar modal de confirmación
    if (days.length > 0) {
      const existingDays = days.length;
      const existingEx = days.reduce((acc, d) => acc + (d.exercises?.length || 0), 0);

      // Crear modal de confirmación
      const modalId = 'modal-confirm-generate';
      let modal = document.getElementById(modalId);
      if (modal) modal.remove();

      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal-backdrop open';
      modal.innerHTML = `
        <div class="modal-box">
          <div class="flex items-center justify-between p-5 border-b border-border-dark">
            <h3 class="text-base font-700 text-white">¿Reemplazar los días actuales?</h3>
            <button type="button" class="action-btn" id="close-confirm-generate"><span class="material-symbols-rounded">close</span></button>
          </div>
          <div class="p-5">
            <p class="text-sm text-slate-400 mb-4">Vas a perder los <span class="text-white font-600">${existingDays} día${existingDays !== 1 ? 's' : ''}</span> y sus <span class="text-white font-600">${existingEx} ejercicio${existingEx !== 1 ? 's' : ''}</span>. Esta acción no se puede deshacer.</p>
            <div class="bg-surface-dark border border-border-dark rounded-xl p-4 mb-4">
              <p class="text-[10px] font-700 text-slate-500 uppercase tracking-widest mb-2">Vista previa</p>
              <div class="space-y-2">
                ${generatePreviewHTML(sourceProgram, sourceRMs)}
              </div>
            </div>
          </div>
          <div class="p-5 border-t border-border-dark flex gap-3">
            <button type="button" id="cancel-confirm-generate" class="flex-1 py-2.5 rounded-xl border border-border-dark hover:bg-surface-2 transition text-sm font-600 text-slate-400">Cancelar</button>
            <button type="button" id="confirm-generate" class="flex-1 py-2.5 rounded-xl bg-danger hover:bg-red-600 transition text-sm font-600 text-white">Reemplazar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Handlers
      document
        .getElementById('close-confirm-generate')
        .addEventListener('click', () => modal.remove());
      document
        .getElementById('cancel-confirm-generate')
        .addEventListener('click', () => modal.remove());
      document.getElementById('confirm-generate').addEventListener('click', async () => {
        const btn = document.getElementById('confirm-generate');
        btn.disabled = true;
        btn.textContent = 'Generando...';
        try {
          modal.remove();
          await doGenerateFromProgram();
        } finally {
          btn.disabled = false;
          btn.textContent = 'Reemplazar';
        }
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
      return;
    }

    // Si no hay días, generar directamente
    doGenerateFromProgram();
  });

  function generatePreviewHTML(program, rms) {
    const weeksList = program.generate(rms);
    if (!weeksList?.length) return '<p class="text-xs text-slate-500">No hay datos</p>';
    const week1 = weeksList[0];
    return week1.days
      .map((d) => {
        const exCount = (d.lifts || []).filter((ex) => ex.type !== 'ACC').length;
        return `<div class="flex justify-between text-xs"><span class="text-slate-300">${d.label || 'Día'}</span><span class="text-slate-500">${exCount} ejercicio${exCount !== 1 ? 's' : ''}</span></div>`;
      })
      .join('');
  }

  function doGenerateFromProgram() {
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

    const prevCount = days.length;
    days = week1.days.map((d, i) => ({
      id: `day-${Date.now()}-${i}`,
      name: d.label || `Día ${i + 1}`,
      exercises: (d.lifts || [])
        .filter((ex) => ex.type !== 'ACC')
        .map((ex, j) => ({
          _id: newExId(),
          exercise_id: null,
          name: ex.name,
          muscle_group: null,
          rest: ex.rest || 90,
          notes: ex.note || '',
          method_slug: sourceProgram.id,
          sets_detail: parseSetsStr(ex.sets, ex.w)
        }))
    }));

    renderDays();
    toast(`${days.length} días generados desde ${sourceProgram.name}`);
  }

  /* ─── Objetivo picker ────────────────────────────────── */
  document.getElementById('obj-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('.obj-btn');
    if (!btn) return;
    setObjetivo(btn.dataset.val);
  });

  function setObjetivo(val) {
    selObjetivo = val;
    document
      .querySelectorAll('.obj-btn')
      .forEach((b) => b.classList.toggle('active', b.dataset.val === val));
    updateSummary();
  }

  // Empty state options handlers
  document.getElementById('empty-create-day')?.addEventListener('click', () => {
    addDay();
    document.getElementById('step-4-empty')?.classList.add('hidden');
  });

  document.getElementById('empty-switch-program')?.addEventListener('click', () => {
    setMode('programa');
    document.getElementById('step-4-empty')?.classList.add('hidden');
    document
      .getElementById('mode-programa')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  document.getElementById('empty-goto-program-config')?.addEventListener('click', () => {
    document
      .getElementById('btn-pick-program')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* ─── Routine name + metadata watchers ──────────────── */
  document.getElementById('routine-name').addEventListener('input', (e) => {
    document.getElementById('btn-save-routine').disabled = !(
      e.target.value.trim() && days.length > 0
    );
    updateSummary();
  });

  // Re-calcular límite cuando cambian semanas o días/sem
  ['routine-weeks', 'routine-days-per-week'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => renderDays());
  });

  /* ─── Toggle compact view ────────────────────────────── */
  document.getElementById('toggle-compact-view')?.addEventListener('click', () => {
    compactView = !compactView;
    const btn = document.getElementById('toggle-compact-view');
    if (btn) {
      btn.innerHTML = compactView
        ? '<span class="material-symbols-rounded" style="font-size:14px">view_agenda</span> Normal'
        : '<span class="material-symbols-rounded" style="font-size:14px">view_agenda</span> Compacto';
    }
    renderDays();
  });

  /* ─── Days management ────────────────────────────────── */
  const canvas = document.getElementById('days-canvas');

  function getMaxDays() {
    const weeks = parseInt(document.getElementById('routine-weeks').value) || 0;
    const daysPerW = parseInt(document.getElementById('routine-days-per-week')?.value) || 0;
    if (weeks > 0 && daysPerW > 0) return weeks * daysPerW;
    return null; // sin límite definido
  }

  function addDay(name = '') {
    const max = getMaxDays();
    if (max !== null && days.length >= max) {
      toast(
        `Límite alcanzado: ${max} días para ${document.getElementById('routine-weeks').value} semanas × ${document.getElementById('routine-days-per-week').value} días/sem`,
        'error'
      );
      return;
    }
    days.push({ id: `day-${Date.now()}`, name: name || `Día ${days.length + 1}`, exercises: [] });
    renderDays();
  }

  function removeDay(id) {
    const dayIdx = days.findIndex((d) => d.id === id);
    if (dayIdx === -1) return;
    const removedDay = days[dayIdx];
    const hasContent =
      removedDay.exercises.length > 0 &&
      removedDay.exercises.some((ex) => (ex.sets_detail?.length || 0) > 0);
    if (hasContent) {
      if (
        !confirm(
          `¿Eliminar "${removedDay.name}"? Tiene ${removedDay.exercises.length} ejercicio(s). Podrás deshacer con Ctrl+Z.`
        )
      )
        return;
      pushUndo({ type: 'day', id, idx: dayIdx, data: removedDay });
    }
    days = days.filter((d) => d.id !== id);
    renderDays();
  }

  function duplicateDay(id) {
    const dayIdx = days.findIndex((d) => d.id === id);
    if (dayIdx === -1) return;
    const max = getMaxDays();
    if (max !== null && days.length >= max) {
      toast(`Límite alcanzado: no podés agregar más días`, 'error');
      return;
    }
    const original = days[dayIdx];
    const copy = JSON.parse(JSON.stringify(original));
    copy.id = `day-${Date.now()}`;
    copy.name = `${copy.name} (copia)`;
    copy.exercises = copy.exercises.map((ex) => ({
      ...ex,
      _id: newExId(),
      sets_detail: ex.sets_detail.map((s) => ({ ...s, _sid: newSetId() }))
    }));
    days.splice(dayIdx + 1, 0, copy);
    renderDays();
    toast('Día duplicado');
  }

  function moveDay(id, direction) {
    const dayIdx = days.findIndex((d) => d.id === id);
    if (dayIdx === -1) return;
    const newIdx = direction === 'up' ? dayIdx - 1 : dayIdx + 1;
    if (newIdx < 0 || newIdx >= days.length) return;
    const [moved] = days.splice(dayIdx, 1);
    days.splice(newIdx, 0, moved);
    renderDays();
  }

  function removeExercise(dayId, exId) {
    const day = days.find((d) => d.id === dayId);
    if (!day) return;
    const exIdx = day.exercises.findIndex((ex) => ex._id === exId);
    if (exIdx === -1) return;
    const removedEx = day.exercises[exIdx];
    const hasContent = removedEx.sets_detail?.some((s) => s.weight_kg != null || s.reps);
    if (hasContent) {
      if (
        !confirm(
          `¿Eliminar "${removedEx.name}"? Tiene ${removedEx.sets_detail.length} set(s). Podrás deshacer con Ctrl+Z.`
        )
      )
        return;
      pushUndo({ type: 'exercise', id: exId, dayId, idx: exIdx, data: removedEx });
    }
    day.exercises = day.exercises.filter((ex) => ex._id !== exId);
    renderDays();
  }

  function addSet(dayId, exId) {
    const day = days.find((d) => d.id === dayId);
    if (!day) return;
    const ex = day.exercises.find((ex) => ex._id === exId);
    if (!ex) return;
    const n = ex.sets_detail.length + 1;
    // Copiar peso del último set como default
    const lastSet = ex.sets_detail[ex.sets_detail.length - 1];
    ex.sets_detail.push(defaultSet(n, lastSet?.weight_kg, lastSet?.reps || ''));
    renderDays();
  }

  function removeSet(dayId, exId, sid) {
    const day = days.find((d) => d.id === dayId);
    if (!day) return;
    const ex = day.exercises.find((ex) => ex._id === exId);
    if (!ex || ex.sets_detail.length <= 1) return;
    ex.sets_detail = ex.sets_detail.filter((s) => s._sid !== sid);
    ex.sets_detail.forEach((s, i) => {
      s.set_number = i + 1;
    });
    renderDays();
    toast('Set eliminado');
  }

  function duplicateExercise(dayId, exId) {
    const day = days.find((d) => d.id === dayId);
    if (!day) return;
    const exIdx = day.exercises.findIndex((ex) => ex._id === exId);
    if (exIdx === -1) return;
    const original = day.exercises[exIdx];
    const copy = JSON.parse(JSON.stringify(original));
    copy._id = newExId();
    copy.sets_detail = copy.sets_detail.map((s) => ({ ...s, _sid: newSetId() }));
    day.exercises.splice(exIdx + 1, 0, copy);
    renderDays();
    toast('Ejercicio duplicado');
  }

  function moveExercise(dayId, exId, direction) {
    const day = days.find((d) => d.id === dayId);
    if (!day) return;
    const exIdx = day.exercises.findIndex((ex) => ex._id === exId);
    if (exIdx === -1) return;
    const newIdx = direction === 'up' ? exIdx - 1 : exIdx + 1;
    if (newIdx < 0 || newIdx >= day.exercises.length) return;
    const [moved] = day.exercises.splice(exIdx, 1);
    day.exercises.splice(newIdx, 0, moved);
    renderDays();
  }

  let clipboardSets = null;

  function copySets(dayId, exId) {
    const day = days.find((d) => d.id === dayId);
    if (!day) return;
    const ex = day.exercises.find((ex) => ex._id === exId);
    if (!ex) return;
    clipboardSets = JSON.parse(JSON.stringify(ex.sets_detail));
    toast('Sets copiados');
  }

  function pasteSets(dayId, exId) {
    if (!clipboardSets) return;
    const day = days.find((d) => d.id === dayId);
    if (!day) return;
    const ex = day.exercises.find((ex) => ex._id === exId);
    if (!ex) return;
    ex.sets_detail = clipboardSets.map((s, i) => ({
      ...s,
      _sid: newSetId(),
      set_number: i + 1
    }));
    renderDays();
    toast('Sets pegados');
  }

  function renderDays() {
    const isMobile = window.innerWidth < 768;
    canvas.innerHTML =
      days
        .map(
          (day, idx) => `
      <div class="day-col${compactView ? ' compact' : ''}" data-day-id="${day.id}" data-mobile-expanded="${isMobile ? 'true' : 'true'}">
        <div class="day-header">
          ${
            isMobile
              ? `
          <button type="button" class="mobile-expand-toggle" data-day-id="${day.id}" title="Expandir/Colapsar">
            <span class="material-symbols-rounded text-slate-500 text-[16px]">expand_more</span>
          </button>
          `
              : ''
          }
          <button type="button" class="collapse-toggle" data-day-id="${day.id}" title="Colapsar/Expandir">
            <span class="material-symbols-rounded text-slate-500 text-[16px]">chevron_right</span>
          </button>
          ${!compactView ? `<span class="material-symbols-rounded drag-handle text-slate-600 text-[16px]">drag_indicator</span>` : ''}
          ${
            compactView
              ? `
          <div class="flex-1 cursor-pointer compact-day-header" data-day-id="${day.id}">
            <span class="text-sm font-bold text-white">${escHtml(day.name)}</span>
            <span class="text-xs text-slate-500 ml-2">${day.exercises.length} exercises · ${day.exercises.reduce((a, ex) => a + (ex.sets_detail?.length || 0), 0)} sets</span>
          </div>
          `
              : `
          <input class="day-name-input" value="${escHtml(day.name)}" placeholder="Nombre del día"
            maxlength="40" data-day-id="${day.id}" />
          `
          }
          ${
            !compactView
              ? `
          <button type="button" class="action-btn btn-move-day" data-day-id="${day.id}" data-dir="up" title="Mover arriba" ${idx === 0 ? 'disabled style="opacity:0.2"' : ''}>
            <span class="material-symbols-rounded pointer-events-none" style="font-size:14px">arrow_upward</span>
          </button>
          <button type="button" class="action-btn btn-move-day" data-day-id="${day.id}" data-dir="down" title="Mover abajo" ${idx === days.length - 1 ? 'disabled style="opacity:0.2"' : ''}>
            <span class="material-symbols-rounded pointer-events-none" style="font-size:14px">arrow_downward</span>
          </button>
          <button type="button" class="action-btn btn-dup-day" data-day-id="${day.id}" title="Duplicar día">
            <span class="material-symbols-rounded pointer-events-none" style="font-size:14px">content_copy</span>
          </button>
          `
              : ''
          }
          <button type="button" class="action-btn danger btn-remove-day" data-day-id="${day.id}" title="Eliminar día">
            <span class="material-symbols-rounded pointer-events-none">close</span>
          </button>
        </div>
        ${
          !compactView
            ? `
        <div class="day-exercises" data-day-id="${day.id}" data-expanded="true">
          ${day.exercises.map((ex) => exerciseBlockHTML(ex, day.id)).join('')}
        </div>
        <button type="button" class="btn-add-ex" data-day-id="${day.id}">
          <span class="material-symbols-rounded" style="font-size:16px">add</span> Agregar ejercicio
        </button>
        `
            : ''
        }
      </div>`
        )
        .join('') +
      `
      <button type="button" class="btn-add-day" id="btn-add-day-main">
        <span class="material-symbols-rounded text-[28px] text-slate-600">add_circle</span>
        Agregar día
      </button>`;

    document.querySelectorAll('.collapse-toggle').forEach((btn) => {
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

    // Actualizar resumen en tiempo real
    updateSummary();

    // Mostrar/ocultar step 4 vacío
    const step4Empty = document.getElementById('step-4-empty');
    if (step4Empty) {
      if (days.length === 0) {
        step4Empty.classList.remove('hidden');
      } else {
        step4Empty.classList.add('hidden');
      }
    }

    // Límite de días: mostrar badge y bloquear botón si se alcanza
    const maxDays = getMaxDays();
    const limitBadge = document.getElementById('days-limit-badge');
    const limitHint = document.getElementById('days-limit-hint');
    const addDayBtn = document.getElementById('btn-add-day-main');

    if (maxDays !== null) {
      const remaining = maxDays - days.length;
      limitBadge.textContent = `${days.length}/${maxDays}`;
      limitBadge.classList.remove('hidden');

      if (remaining <= 0) {
        limitBadge.className =
          'ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/20';
        if (addDayBtn) {
          addDayBtn.disabled = true;
          addDayBtn.style.opacity = '0.3';
          addDayBtn.style.cursor = 'not-allowed';
        }
        if (limitHint)
          limitHint.textContent = `Límite alcanzado (${maxDays} días para ${document.getElementById('routine-weeks').value} sem × ${document.getElementById('routine-days-per-week').value} días/sem)`;
      } else {
        limitBadge.className =
          'ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-500';
        if (addDayBtn) {
          addDayBtn.disabled = false;
          addDayBtn.style.opacity = '';
          addDayBtn.style.cursor = '';
        }
        if (limitHint)
          limitHint.textContent = `Podés agregar ${remaining} día${remaining !== 1 ? 's' : ''} más`;
      }
    } else {
      limitBadge.classList.add('hidden');
      if (addDayBtn) {
        addDayBtn.disabled = false;
        addDayBtn.style.opacity = '';
        addDayBtn.style.cursor = '';
      }
      // Microcopy coherente con la acción real
      if (days.length === 0) {
        if (mode === 'programa') {
          if (limitHint) {
            limitHint.textContent = '';
            const progHint = document.getElementById('empty-state-program-hint');
            const optCards = document.getElementById('empty-state-options');
            if (progHint) progHint.classList.remove('hidden');
            if (optCards) optCards.classList.add('hidden');
          }
        } else {
          if (limitHint)
            limitHint.textContent = 'Agregá un día y luego sumá ejercicios desde cada columna';
        }
      } else {
        // Verificar si todos los días tienen al menos un ejercicio
        const allDaysHaveExercises = days.every((d) => d.exercises && d.exercises.length > 0);
        if (allDaysHaveExercises) {
          if (limitHint) limitHint.textContent = ''; // Ocultar cuando todo tiene ejercicios
        } else {
          if (limitHint)
            limitHint.textContent = 'Hacé click en "+ Agregar ejercicio" dentro de cada día';
        }
      }
    }
  }

  /* ─── Exercise block HTML ────────────────────────────── */
  function exerciseBlockHTML(ex, dayId) {
    const mc = MUSCLE_COLORS[ex.muscle_group] || '#64748B';
    const isExpanded = expandedExercises.has(ex._id);

    const setsHTML = ex.sets_detail
      .map(
        (s) => `
      <div class="ex-set-row${isExpanded ? '' : ' collapsed'}"
        data-day-id="${dayId}" data-ex-id="${ex._id}" data-sid="${s._sid}">
        <span class="set-num">S${s.set_number}</span>
        <input class="set-input" type="number" value="${s.weight_kg ?? ''}" placeholder="—"
          data-day-id="${dayId}" data-ex-id="${ex._id}" data-sid="${s._sid}" data-field="weight_kg"
          step="2.5" min="0" />
        <input class="set-input" value="${escHtml(s.reps ?? '')}" placeholder="—"
          data-day-id="${dayId}" data-ex-id="${ex._id}" data-sid="${s._sid}" data-field="reps" />
        ${
          isExpanded
            ? `
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
        `
            : ''
        }
        <button type="button" class="btn-remove-set"
          data-day-id="${dayId}" data-ex-id="${ex._id}" data-sid="${s._sid}"
          ${ex.sets_detail.length <= 1 ? 'disabled' : ''}>
          <span class="material-symbols-rounded pointer-events-none" style="font-size:12px">close</span>
        </button>
      </div>`
      )
      .join('');

    return `
    <div class="ex-block" data-ex-id="${ex._id}" data-day-id="${dayId}">
      <div class="ex-block-header">
        <span class="material-symbols-rounded drag-handle" style="font-size:14px">drag_indicator</span>
        <span class="ex-block-name" title="${escHtml(ex.name)}">${escHtml(ex.name)}</span>
        ${ex.muscle_group ? `<span class="ex-block-muscle" style="background:${mc}18;color:${mc};border:1px solid ${mc}30">${ex.muscle_group}</span>` : ''}
        <button type="button" class="action-btn btn-expand-ex"
          data-day-id="${dayId}" data-ex-id="${ex._id}" title="${isExpanded ? 'Ocultar opciones avanzadas' : 'Más opciones'}">
          <span class="material-symbols-rounded pointer-events-none" style="font-size:14px">${isExpanded ? 'visibility' : 'visibility_off'}</span>
        </button>
        <button type="button" class="action-btn btn-dup-ex"
          data-day-id="${dayId}" data-ex-id="${ex._id}" title="Duplicar">
          <span class="material-symbols-rounded pointer-events-none" style="font-size:14px">content_copy</span>
        </button>
        <button type="button" class="action-btn danger btn-remove-ex"
          data-day-id="${dayId}" data-ex-id="${ex._id}">
          <span class="material-symbols-rounded pointer-events-none">close</span>
        </button>
      </div>

      <div class="ex-sets-header${isExpanded ? '' : ' collapsed'}">
        <span></span>
        <span>PESO KG</span>
        <span>REPS</span>
        ${
          isExpanded
            ? `
        <span>RPE</span>
        <span>RIR</span>
        <span>AMRAP</span>
        `
            : ''
        }
        <span></span>
      </div>

      <div class="quick-fill-row">
        <span class="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Set 1 →</span>
        <button type="button" class="btn-apply-all" data-day-id="${dayId}" data-ex-id="${ex._id}" data-field="weight_kg" title="Aplicar peso del Set 1 a todos">
          <span class="material-symbols-rounded" style="font-size:12px">fitness_center</span> Aplicar peso a todos
        </button>
        <button type="button" class="btn-apply-all" data-day-id="${dayId}" data-ex-id="${ex._id}" data-field="reps" title="Aplicar reps del Set 1 a todos">
          <span class="material-symbols-rounded" style="font-size:12px">repeat</span> Aplicar reps a todos
        </button>
      </div>

      ${setsHTML}

      <div class="ex-footer">
        <div class="flex gap-1">
          <button type="button" class="btn-add-set" data-day-id="${dayId}" data-ex-id="${ex._id}">
            <span class="material-symbols-rounded" style="font-size:12px">add</span> Set
          </button>
          <button type="button" class="btn-copy-sets" data-day-id="${dayId}" data-ex-id="${ex._id}" title="Copiar sets">
            <span class="material-symbols-rounded" style="font-size:12px">content_copy</span>
          </button>
          <button type="button" class="btn-paste-sets" data-day-id="${dayId}" data-ex-id="${ex._id}" title="Pegar sets" ${!clipboardSets ? 'disabled style="opacity:0.3"' : ''}>
            <span class="material-symbols-rounded" style="font-size:12px">content_paste</span>
          </button>
          <button type="button" class="btn-apply-all" data-day-id="${dayId}" data-ex-id="${ex._id}" data-field="weight_kg" title="Aplicar peso del Set 1 a todos">
            <span class="material-symbols-rounded" style="font-size:12px">fitness_center</span> Peso⇢Todos
          </button>
          <button type="button" class="btn-apply-all" data-day-id="${dayId}" data-ex-id="${ex._id}" data-field="reps" title="Aplicar reps del Set 1 a todos">
            <span class="material-symbols-rounded" style="font-size:12px">repeat</span> Reps⇢Todos
          </button>
        </div>
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
  canvas.addEventListener('click', (e) => {
    if (e.target.closest('#btn-add-day-main')) {
      addDay();
      return;
    }

    const btnRD = e.target.closest('.btn-remove-day');
    if (btnRD) {
      removeDay(btnRD.dataset.dayId);
      return;
    }

    const btnDupDay = e.target.closest('.btn-dup-day');
    if (btnDupDay) {
      duplicateDay(btnDupDay.dataset.dayId);
      return;
    }

    const btnMoveDay = e.target.closest('.btn-move-day');
    if (btnMoveDay) {
      moveDay(btnMoveDay.dataset.dayId, btnMoveDay.dataset.dir);
      return;
    }

    const btnAE = e.target.closest('.btn-add-ex');
    if (btnAE) {
      openExPicker(btnAE.dataset.dayId);
      return;
    }

    // Mobile accordion toggle
    const mobileToggle = e.target.closest('.mobile-expand-toggle');
    if (mobileToggle) {
      const dayId = mobileToggle.dataset.dayId;
      const dayCol = document.querySelector(`.day-col[data-day-id="${dayId}"]`);
      if (dayCol) {
        const isExpanded = dayCol.dataset.mobileExpanded === 'true';
        dayCol.dataset.mobileExpanded = isExpanded ? 'false' : 'true';
      }
      return;
    }

    // Compact view: click to expand specific exercise/day
    const compactHeader = e.target.closest('.compact-day-header');
    if (compactHeader) {
      const dayId = compactHeader.dataset.dayId;
      const dayCol = document.querySelector(`.day-col[data-day-id="${dayId}"]`);
      if (dayCol) {
        // Toggle compact view to show details
        compactView = false;
        document.getElementById('toggle-compact-view').innerHTML =
          '<span class="material-symbols-rounded" style="font-size:14px">view_agenda</span> Compacto';
        renderDays();
      }
      return;
    }

    const btnRE = e.target.closest('.btn-remove-ex');
    if (btnRE) {
      removeExercise(btnRE.dataset.dayId, btnRE.dataset.exId);
      return;
    }

    const btnAS = e.target.closest('.btn-add-set');
    if (btnAS) {
      addSet(btnAS.dataset.dayId, btnAS.dataset.exId);
      return;
    }

    const btnRS = e.target.closest('.btn-remove-set');
    if (btnRS) {
      removeSet(btnRS.dataset.dayId, btnRS.dataset.exId, btnRS.dataset.sid);
      return;
    }

    const btnExpand = e.target.closest('.btn-expand-ex');
    if (btnExpand) {
      const exId = btnExpand.dataset.exId;
      if (expandedExercises.has(exId)) {
        expandedExercises.delete(exId);
      } else {
        expandedExercises.add(exId);
      }
      renderDays();
      return;
    }

    const btnDup = e.target.closest('.btn-dup-ex');
    if (btnDup) {
      duplicateExercise(btnDup.dataset.dayId, btnDup.dataset.exId);
      return;
    }

    const btnCopySets = e.target.closest('.btn-copy-sets');
    if (btnCopySets) {
      copySets(btnCopySets.dataset.dayId, btnCopySets.dataset.exId);
      return;
    }

    const btnPasteSets = e.target.closest('.btn-paste-sets');
    if (btnPasteSets) {
      pasteSets(btnPasteSets.dataset.dayId, btnPasteSets.dataset.exId);
      return;
    }

    const btnApplyAll = e.target.closest('.btn-apply-all');
    if (btnApplyAll) {
      applyToAllSets(
        btnApplyAll.dataset.dayId,
        btnApplyAll.dataset.exId,
        btnApplyAll.dataset.field
      );
      return;
    }
  });

  canvas.addEventListener('input', (e) => {
    if (e.target.classList.contains('day-name-input')) {
      const d = days.find((d) => d.id === e.target.dataset.dayId);
      if (d) d.name = e.target.value;
      return;
    }

    const { dayId, exId, sid, field } = e.target.dataset;
    if (!dayId || !exId) return;

    const day = days.find((d) => d.id === dayId);
    if (!day) return;
    const ex = day.exercises.find((x) => x._id === exId);
    if (!ex) return;

    // Descanso (nivel ejercicio)
    if (field === 'rest') {
      ex.rest = parseInt(e.target.value) || null;
      return;
    }

    // Campos de set
    if (!sid) return;
    const s = ex.sets_detail.find((s) => s._sid === sid);
    if (!s) return;

    const val = e.target.value.trim();
    if (field === 'weight_kg') s.weight_kg = val ? parseFloat(val) : null;
    if (field === 'reps') s.reps = val || null;
    if (field === 'rpe_target') {
      const parsed = val ? parseFloat(val) : null;
      if (parsed != null && parsed > 10) {
        s.rpe_target = 10;
        e.target.value = '10';
        toast('RPE máximo permitido: 10', 'error');
      } else {
        s.rpe_target = parsed;
      }
    }
    if (field === 'rir_target') s.rir_target = val ? parseInt(val) : null;
  });

  canvas.addEventListener('change', (e) => {
    if (!e.target.classList.contains('set-amrap')) return;
    const { dayId, exId, sid } = e.target.dataset;
    const day = days.find((d) => d.id === dayId);
    const ex = day?.exercises.find((x) => x._id === exId);
    const s = ex?.sets_detail.find((s) => s._sid === sid);
    if (s) s.is_amrap = e.target.checked;
  });

  /* ─── Exercise picker ────────────────────────────────── */
  const exPickerBackdrop = document.getElementById('ex-picker-backdrop');
  const exPickerEl = document.getElementById('ex-picker');
  const exPickerListEl = document.getElementById('ex-picker-list');

  function openExPicker(dayId) {
    activeDayId = dayId;
    const day = days.find((d) => d.id === dayId);
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

  document.getElementById('ex-picker-search').addEventListener(
    'input',
    debounce((e) => {
      exPickerSearch = e.target.value.toLowerCase().trim();
      renderExPickerList();
    }, 200)
  );

  document.getElementById('ex-picker-muscle-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('.sel-btn');
    if (!btn) return;
    document
      .querySelectorAll('#ex-picker-muscle-filter .sel-btn')
      .forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    exPickerMuscle = btn.dataset.muscle;
    renderExPickerList();
  });

  function renderExPickerList() {
    const filtered = exercises.filter((ex) => {
      const matchM = exPickerMuscle === 'all' || ex.muscle_group === exPickerMuscle;
      const matchS = !exPickerSearch || ex.name.toLowerCase().includes(exPickerSearch);
      return matchM && matchS;
    });

    if (!filtered.length) {
      exPickerListEl.innerHTML = `<div style="text-align:center;padding:40px 16px;color:#334155;font-size:12px">Sin resultados</div>`;
      return;
    }

    exPickerListEl.innerHTML = filtered
      .map((ex) => {
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
      })
      .join('');
  }

  exPickerListEl.addEventListener('click', (e) => {
    const item = e.target.closest('.ex-pick-item');
    if (!item || !activeDayId) return;

    const ex = exercises.find((ex) => ex.id === item.dataset.exId);
    const day = days.find((d) => d.id === activeDayId);
    if (!ex || !day) return;

    day.exercises.push({
      _id: newExId(),
      exercise_id: ex.id,
      name: ex.name,
      muscle_group: ex.muscle_group,
      rest: 90,
      notes: '',
      method_slug: null,
      sets_detail: [defaultSet(1, null, '')]
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
    const validation = window.tfRoutineBuilderUtils?.validateRoutineDraft
      ? window.tfRoutineBuilderUtils.validateRoutineDraft({ name, days })
      : { valid: !!name && days.length > 0, errors: {} };
    if (!validation.valid) {
      if (validation.errors.name) {
        toast(validation.errors.name[0], 'error');
        document.getElementById('routine-name')?.focus();
      } else if (validation.errors.days) {
        toast(validation.errors.days[0], 'error');
      } else if (validation.errors.exercises) {
        toast(validation.errors.exercises[0], 'error');
      }
      return;
    }

    const btn = document.getElementById('btn-save-routine');
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-rounded text-[17px] animate-spin">progress_activity</span>${editRoutineId ? 'Actualizando…' : 'Guardando…'}`;

    const routinePayload = {
      name,
      description: document.getElementById('routine-desc').value.trim() || null,
      objetivo: selObjetivo || 'general',
      duration_weeks: parseInt(document.getElementById('routine-weeks').value) || null,
      days_per_week:
        parseInt(document.getElementById('routine-days-per-week')?.value) || days.length,
      source_program: mode === 'programa' && sourceProgram ? sourceProgram.id : null,
      source_rm_values: mode === 'programa' && sourceProgram ? sourceRMs : null,
      updated_at: new Date().toISOString()
    };

    try {
      let routineId;

      if (editRoutineId) {
        if (
          !confirm(
            '¿Actualizar esta rutina? Se reemplazarán todos los días y ejercicios existentes.'
          )
        ) {
          btn.disabled = false;
          btn.innerHTML = `<span class="material-symbols-rounded text-[17px]">save</span>${editRoutineId ? 'Actualizar' : 'Guardar'}`;
          return;
        }
        const { error: ue } = await db
          .from('routines')
          .update(routinePayload)
          .eq('id', editRoutineId);
        if (ue) throw ue;
        routineId = editRoutineId;

        // Borrar días existentes en cascada (routine_days → rde → rdes por FK CASCADE)
        const { error: de } = await db.from('routine_days').delete().eq('routine_id', routineId);
        if (de) throw de;
      } else {
        // ── CREAR: INSERT routine ──
        const { data: routine, error: re } = await db
          .from('routines')
          .insert({
            gym_id: gymId,
            ...routinePayload
          })
          .select('id')
          .single();
        if (re) throw re;
        routineId = routine.id;
      }

      // 2. Days → exercises → sets (igual para crear y editar)
      for (let di = 0; di < days.length; di++) {
        const day = days[di];
        const { data: rdRow, error: rde } = await db
          .from('routine_days')
          .insert({
            routine_id: routineId,
            day_number: di + 1,
            name: day.name
          })
          .select('id')
          .single();
        if (rde) throw rde;

        for (let ei = 0; ei < day.exercises.length; ei++) {
          const ex = day.exercises[ei];
          const { data: rdeRow, error: exErr } = await db
            .from('routine_day_exercises')
            .insert({
              routine_day_id: rdRow.id,
              exercise_id: ex.exercise_id || null,
              exercise_name: ex.name,
              order_index: ei,
              sets: ex.sets_detail.length,
              reps: ex.sets_detail[0]?.reps || null,
              rest_seconds: ex.rest || null,
              notes: ex.notes || null,
              method_slug: ex.method_slug || null
            })
            .select('id')
            .single();
          if (exErr) throw exErr;

          const setRows = ex.sets_detail.map((s) => ({
            routine_day_exercise_id: rdeRow.id,
            set_number: s.set_number,
            weight_kg: s.weight_kg || null,
            weight_pct: s.weight_pct || null,
            tm_ref: s.tm_ref || null,
            rpe_target: s.rpe_target || null,
            rir_target: s.rir_target || null,
            reps_target: s.reps || null,
            is_amrap: s.is_amrap || false,
            notes: s.notes || null
          }));
          const { error: setsErr } = await db.from('routine_day_exercise_sets').insert(setRows);
          if (setsErr) throw setsErr;
        }
      }

      toast(editRoutineId ? 'Rutina actualizada ✓' : 'Rutina guardada ✓');
      clearDraft();
      setTimeout(() => {
        window.location.href = 'routine-list.html';
      }, 1400);
    } catch (err) {
      console.error(err);
      toast(err.message || 'Error al guardar', 'error');
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-rounded text-[17px]">save</span><span id="save-routine-text">${editRoutineId ? 'Actualizar rutina' : 'Guardar rutina'}</span>`;
    }
  });

  /* ─── ESC ────────────────────────────────────────────── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && exPickerEl.classList.contains('open')) closeExPicker();
  });

  /* ─── Load existing routine for edit ────────────────── */
  async function loadRoutineForEdit(id) {
    const { data: r, error } = await db
      .from('routines')
      .select(
        `
      id, name, description, objetivo, duration_weeks, days_per_week,
      source_program, source_rm_values,
      routine_days (
        id, day_number, name,
        routine_day_exercises (
          id, order_index, exercise_name, exercise_id, sets, reps, rest_seconds, notes, method_slug,
          routine_day_exercise_sets (
            id, set_number, weight_kg, weight_pct, rpe_target, rir_target, reps_target, is_amrap, notes
          )
        )
      )
    `
      )
      .eq('id', id)
      .single();

    if (error || !r) {
      toast('No se pudo cargar la rutina', 'error');
      return;
    }

    // Poblar campos del header
    document.getElementById('routine-name').value = r.name || '';
    document.getElementById('routine-desc').value = r.description || '';
    document.getElementById('routine-weeks').value = r.duration_weeks || '';
    document.getElementById('routine-days-per-week').value = r.days_per_week || '';

    // Rehidratar modo y programa
    if (r.source_program) {
      const prog = PROGRAMS.find((p) => p.id === r.source_program);
      if (prog) {
        sourceProgram = prog;
        sourceRMs = r.source_rm_values || {};
        setMode('programa');
        renderProgramConfig();
      }
    } else {
      setMode('libre');
    }

    // Objetivo
    selObjetivo = r.objetivo || null;
    document
      .querySelectorAll('.obj-btn')
      .forEach((b) => b.classList.toggle('active', b.dataset.val === selObjetivo));

    // Rebuild days state
    const sortedDays = (r.routine_days || []).sort((a, b) => a.day_number - b.day_number);
    days = sortedDays.map((rd) => ({
      id: `day-${rd.id}`,
      name: rd.name || `Día ${rd.day_number}`,
      exercises: (rd.routine_day_exercises || [])
        .sort((a, b) => a.order_index - b.order_index)
        .map((rde) => {
          const setsRaw = (rde.routine_day_exercise_sets || []).sort(
            (a, b) => a.set_number - b.set_number
          );

          const sets_detail =
            setsRaw.length > 0
              ? setsRaw.map((s) => ({
                  _sid: `sid-${s.id}`,
                  set_number: s.set_number,
                  weight_kg: s.weight_kg || null,
                  weight_pct: s.weight_pct || null,
                  rpe_target: s.rpe_target || null,
                  rir_target: s.rir_target || null,
                  reps: s.reps_target || rde.reps || '',
                  is_amrap: s.is_amrap || false,
                  notes: s.notes || ''
                }))
              : [defaultSet(1, rde.weight_kg, rde.reps || '')];

          return {
            _id: newExId(),
            exercise_id: rde.exercise_id || null,
            name: rde.exercise_name || '—',
            muscle_group: null,
            rest: rde.rest_seconds || 90,
            notes: rde.notes || '',
            method_slug: rde.method_slug || null,
            sets_detail
          };
        })
    }));

    // Auto-expand exercises with RPE configured
    sortedDays.forEach((rd) => {
      (rd.routine_day_exercises || []).forEach((rde) => {
        const hasRPE = (rde.routine_day_exercise_sets || []).some((s) => s.rpe_target != null);
        if (hasRPE) {
          const exId = `e-${rde.id}`;
          expandedExercises.add(exId);
        }
      });
    });

    // UI: cambiar título y botón
    document.getElementById('header-title').textContent = 'Editar rutina';
    document.getElementById('header-subtitle').textContent = 'Modificá el plan existente';
    const _saveSpan = document.getElementById('save-routine-text');
    if (_saveSpan) _saveSpan.textContent = 'Actualizar rutina';

    renderDays();
  }

  function applyToAllSets(dayId, exId, field) {
    const ex = findExercise(dayId, exId);
    if (!ex || !ex.sets_detail?.length) return;
    const sourceValue = ex.sets_detail[0]?.[field];
    if (sourceValue == null || sourceValue === '') {
      toast('Completá el primer set antes de aplicar al resto', 'error');
      return;
    }
    ex.sets_detail.forEach((set, idx) => {
      if (idx === 0) return;
      set[field] = sourceValue;
    });
    renderDays();
    toast(
      field === 'weight_kg' ? 'Peso aplicado a todos los sets' : 'Reps aplicadas a todos los sets'
    );
  }

  /* ─── Auto-guardado de borrador ─────────────────────── */
  function saveDraft() {
    if (days.length === 0 && !document.getElementById('routine-name').value.trim()) return;
    const draft = {
      name: document.getElementById('routine-name').value.trim(),
      objetivo: selObjetivo,
      description: document.getElementById('routine-desc').value.trim(),
      duration_weeks: parseInt(document.getElementById('routine-weeks').value) || null,
      days_per_week: parseInt(document.getElementById('routine-days-per-week').value) || null,
      mode,
      sourceProgramId: sourceProgram?.id || null,
      sourceRMs,
      days,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(`tfDraft_${gymId}`, JSON.stringify(draft));
    lastSavedDraft = draft.savedAt;
    const draftIndicator = document.getElementById('draft-indicator');
    if (draftIndicator) {
      draftIndicator.textContent = `Borrador guardado`;
      draftIndicator.classList.remove('hidden');
    }
  }

  function loadDraft() {
    const saved = localStorage.getItem(`tfDraft_${gymId}`);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }

  function clearDraft() {
    localStorage.removeItem(`tfDraft_${gymId}`);
    lastSavedDraft = null;
    const draftIndicator = document.getElementById('draft-indicator');
    if (draftIndicator) draftIndicator.classList.add('hidden');
  }

  function scheduleDraftAutoSave() {
    if (draftAutoSaveTimer) clearTimeout(draftAutoSaveTimer);
    draftAutoSaveTimer = setTimeout(() => {
      saveDraft();
      scheduleDraftAutoSave();
    }, 30000);
  }

  /* ─── Undo para eliminación ───────────────────────────── */
  let undoStack = [];
  let undoTimers = {};

  function pushUndo(action) {
    undoStack.push(action);
    const timerKey = action.type + '-' + action.id;
    const timeout = action.type === 'day' ? 8000 : 5000;
    if (undoTimers[timerKey]) clearTimeout(undoTimers[timerKey]);
    undoTimers[timerKey] = setTimeout(() => {
      undoStack = undoStack.filter((a) => a.id !== action.id || a.type !== action.type);
      delete undoTimers[timerKey];
    }, timeout);
    showUndoToast(action);
  }

  function showUndoToast(action) {
    const msg =
      action.type === 'day' ? 'Día eliminado · Deshacer' : 'Ejercicio eliminado · Deshacer';
    const toastEl = document.getElementById('toast');
    const iconEl = document.getElementById('toast-icon');
    const msgEl = document.getElementById('toast-msg');
    if (!toastEl || !msgEl) return;
    iconEl.className = 'material-symbols-rounded text-warning text-[18px]';
    iconEl.textContent = 'undo';
    msgEl.textContent = msg;
    toastEl.classList.remove('translate-y-[150%]', 'opacity-0', 'pointer-events-none');
    toastEl.dataset.undoAction = JSON.stringify(action);
    setTimeout(() => {
      toastEl.classList.add('translate-y-[150%]', 'opacity-0', 'pointer-events-none');
    }, 4000);
  }

  function performUndo(action) {
    if (action.type === 'day') {
      const day = action.data;
      days.splice(action.idx, 0, day);
      renderDays();
      toast('Día restaurado');
    } else if (action.type === 'exercise') {
      const day = days.find((d) => d.id === action.dayId);
      if (day) {
        day.exercises.splice(action.idx, 0, action.data);
        renderDays();
        toast('Ejercicio restaurado');
      }
    }
  }

  // Bind undo en toast click
  document.addEventListener('click', (e) => {
    const toast = document.getElementById('toast');
    if (!toast || toast.classList.contains('translate-y-[150%]')) return;
    if (toast.dataset.undoAction) {
      try {
        const action = JSON.parse(toast.dataset.undoAction);
        performUndo(action);
        delete toast.dataset.undoAction;
      } catch {}
    }
  });

  /* ─── Init ───────────────────────────────────────────── */
  await loadExercises();

  // Bind draft buttons
  document.getElementById('btn-restore-draft')?.addEventListener('click', () => {
    const draft = loadDraft();
    if (draft) {
      document.getElementById('routine-name').value = draft.name || '';
      document.getElementById('routine-desc').value = draft.description || '';
      document.getElementById('routine-weeks').value = draft.duration_weeks || '';
      document.getElementById('routine-days-per-week').value = draft.days_per_week || '';
      if (draft.objetivo) setObjetivo(draft.objetivo);
      if (draft.mode) setMode(draft.mode);
      days = draft.days || [];
      renderDays();
      document.getElementById('draft-restore-banner')?.classList.add('hidden');
      scheduleDraftAutoSave();
      toast('Borrador restaurado');
    }
  });

  document.getElementById('btn-discard-draft')?.addEventListener('click', () => {
    clearDraft();
    document.getElementById('draft-restore-banner')?.classList.add('hidden');
  });

  // Check for draft
  const draft = loadDraft();
  if (draft && !editRoutineId && draft.days?.length > 0) {
    const banner = document.getElementById('draft-restore-banner');
    if (banner) {
      banner.classList.remove('hidden');
      document.getElementById('draft-restore-date').textContent = new Date(
        draft.savedAt
      ).toLocaleString('es-AR');
    }
  }

  if (editRoutineId) {
    await loadRoutineForEdit(editRoutineId);
  } else {
    renderDays();
    // Start auto-save
    scheduleDraftAutoSave();
  }
})();
