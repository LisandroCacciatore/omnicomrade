/**
 * routine-list.js
 * TechFitness — Gestión de Rutinas
 * REFACTORIZADO: Event Delegation, Forms Nativos, Utils.js
 */

(async () => {
  /* ─── Auth guard ─────────────────────────────────────────── */
  const session = await window.authGuard(['gim_admin', 'profesor']);
  if (!session) return;

  const gymId = session.user.app_metadata.gym_id;
  const db = window.supabaseClient;

  // Extraer utilidades centralizadas
  const { toast, escHtml, debounce } = window.tfUtils;

  /* ─── State ──────────────────────────────────────────────── */
  let allRoutines = [];
  let filterObjetivo = 'all';
  let filterDiff = 'all';
  let searchQuery = '';
  let pendingDeleteId = null;
  let editingId = null;
  let selectedObjetivo = null;
  let selectedDiff = null;
  let assigningRoutineId = null;
  let assignStudents = [];
  let pendingReplacement = null;

  /* ─── DOM refs ───────────────────────────────────────────── */
  const grid = document.getElementById('routines-grid');
  const emptyState = document.getElementById('empty-state');

  // Modales y Formularios
  const modalRutina = document.getElementById('modal-rutina');
  const formRutina = document.getElementById('form-rutina');
  const modalEliminar = document.getElementById('modal-eliminar');
  const modalAsignar = document.getElementById('modal-asignar-rutina');
  const modalConfirmReplace = document.getElementById('modal-confirm-replace-routine');
  const modalError = document.getElementById('modal-error');
  const modalAsignarError = document.getElementById('modal-asignar-error');

  // Inputs
  const inputId = document.getElementById('rutina-id');
  const inputNombre = document.getElementById('rutina-nombre');
  const inputDesc = document.getElementById('rutina-descripcion');
  const inputSemanas = document.getElementById('rutina-semanas');
  const inputDias = document.getElementById('rutina-dias');
  const inputAsignarStudent = document.getElementById('asignar-student-id');
  const inputAsignarSearch = document.getElementById('asignar-student-search');
  const assignNoResults = document.getElementById('asignar-no-results');

  /* ─── Fetch data ─────────────────────────────────────────── */
  // studentCounts: { routine_id → count }
  let studentCounts = {};

  async function loadRoutines() {
    const [{ data, error }, { data: assignments }] = await Promise.all([
      db
        .from('routines')
        .select('*')
        .eq('gym_id', gymId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      db
        .from('students')
        .select('routine_id')
        .eq('gym_id', gymId)
        .is('deleted_at', null)
        .not('routine_id', 'is', null)
    ]);

    if (error) {
      toast('Error al cargar rutinas', 'error');
      return;
    }

    // Contar alumnos por rutina
    studentCounts = {};
    (assignments || []).forEach((s) => {
      if (s.routine_id) studentCounts[s.routine_id] = (studentCounts[s.routine_id] || 0) + 1;
    });

    allRoutines = data || [];
    updateKPIs();
    renderGrid();
  }

  /* ─── KPIs ───────────────────────────────────────────────── */
  function updateKPIs() {
    document.getElementById('kpi-total').textContent = allRoutines.length;
    document.getElementById('kpi-fuerza').textContent = allRoutines.filter(
      (r) => r.objetivo === 'fuerza'
    ).length;
    document.getElementById('kpi-estetica').textContent = allRoutines.filter(
      (r) => r.objetivo === 'estetica'
    ).length;
    document.getElementById('kpi-rendimiento').textContent = allRoutines.filter(
      (r) => r.objetivo === 'rendimiento'
    ).length;
  }

  /* ─── Render grid ────────────────────────────────────────── */
  function renderGrid() {
    let filtered = allRoutines.filter((r) => {
      const matchObjetivo = filterObjetivo === 'all' || r.objetivo === filterObjetivo;
      const matchDiff = filterDiff === 'all' || r.difficulty === filterDiff;
      const matchSearch =
        !searchQuery ||
        r.name.toLowerCase().includes(searchQuery) ||
        (r.description || '').toLowerCase().includes(searchQuery);
      return matchObjetivo && matchDiff && matchSearch;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '';
      grid.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    grid.classList.remove('hidden');
    emptyState.classList.add('hidden');
    grid.innerHTML = filtered.map((r) => routineCard(r)).join('');
    // NOTA: Ya no hay .forEach añadiendo eventos aquí. Usamos Delegación en el grid.
  }

  /* ─── Card HTML ──────────────────────────────────────────── */
  function routineCard(r) {
    const count = studentCounts[r.id] || 0;
    const obj = r.objetivo || 'general';
    const diff = r.difficulty || 'intermedio';
    const semanas = r.duration_weeks ? `${r.duration_weeks} sem.` : '—';
    const dias = r.days_per_week ? `${r.days_per_week} días/sem` : '—';

    const objLabel =
      {
        fuerza: 'Fuerza',
        estetica: 'Estética',
        rendimiento: 'Rendimiento',
        rehabilitacion: 'Rehab.',
        general: 'General'
      }[obj] || obj;
    const diffLabel =
      { principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado' }[diff] ||
      diff;

    // Color coding badges
    const objStyles = {
      fuerza: 'bg-red-500/15 text-red-400',
      estetica: 'bg-pink-500/15 text-pink-400',
      rendimiento: 'bg-blue-500/15 text-blue-400',
      rehabilitacion: 'bg-emerald-500/15 text-emerald-400',
      general: 'bg-slate-500/15 text-slate-400'
    };
    const diffStyles = {
      principiante: 'bg-emerald-500/15 text-emerald-400',
      intermedio: 'bg-amber-500/15 text-amber-400',
      avanzado: 'bg-red-500/15 text-red-400'
    };

    return `
        <div class="routine-card card-${obj}">
          <div class="flex items-start justify-between gap-2 mb-3">
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-bold text-white leading-snug line-clamp-2 mb-1.5">${escHtml(r.name)}</h3>
              <div class="flex flex-wrap gap-1.5">
                <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${objStyles[obj] || objStyles.general}">${objLabel}</span>
                <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${diffStyles[diff] || diffStyles.intermedio}">${diffLabel}</span>
              </div>
            </div>
            <div class="flex gap-1 shrink-0">
              <button type="button" data-action="assign" data-id="${r.id}" data-name="${escHtml(r.name)}" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-emerald-500/15 hover:text-emerald-400 transition-colors" title="Asignar a alumno">
                <span class="material-symbols-rounded text-[16px] pointer-events-none">person_add</span>
              </button>
              <button type="button" data-action="edit" data-id="${r.id}" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-[#1E293B] hover:text-white transition-colors" title="Editar">
                <span class="material-symbols-rounded text-[16px] pointer-events-none">edit</span>
              </button>
              <button type="button" data-action="delete" data-id="${r.id}" data-name="${escHtml(r.name)}" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-500/15 hover:text-red-500 transition-colors" title="Eliminar">
                <span class="material-symbols-rounded text-[16px] pointer-events-none">delete</span>
              </button>
            </div>
          </div>
          <p class="text-xs text-slate-500 line-clamp-2 mb-4 min-h-[32px]">
            ${r.description ? escHtml(r.description) : '<span class="italic">Sin descripción</span>'}
          </p>
          <div class="flex items-center justify-between pt-3 border-t border-[#1E293B]">
            <div class="flex items-center gap-3 text-xs text-slate-500">
              <div class="flex items-center gap-1.5"><span class="material-symbols-rounded text-[16px]">calendar_month</span>${semanas}</div>
              <div class="flex items-center gap-1.5"><span class="material-symbols-rounded text-[16px]">repeat</span>${dias}</div>
            </div>
            <div class="flex items-center gap-1.5 text-xs font-bold ${count > 0 ? 'text-primary' : 'text-slate-700'}">
              <span class="material-symbols-rounded text-[14px]">group</span>
              ${count > 0 ? count : '—'}
            </div>
          </div>
        </div>`;
  }

  /* ─── EVENT DELEGATION ───────────────────────────────────── */
  grid.addEventListener('click', (e) => {
    const assignBtn = e.target.closest('button[data-action="assign"]');
    const editBtn = e.target.closest('button[data-action="edit"]');
    const deleteBtn = e.target.closest('button[data-action="delete"]');

    if (assignBtn) {
      e.preventDefault();
      openAssignModal(assignBtn.dataset.id, assignBtn.dataset.name);
    } else if (editBtn) {
      e.preventDefault();
      openEdit(editBtn.dataset.id);
    } else if (deleteBtn) {
      e.preventDefault();
      openDelete(deleteBtn.dataset.id, deleteBtn.dataset.name);
    }
  });

  /* ─── Modal Open/Close Logic ─────────────────────────────── */
  function openModal(el) {
    el.classList.remove('hidden');
    setTimeout(() => {
      el.classList.remove('opacity-0');
      const f = el.querySelector('form');
      if (f) f.classList.remove('scale-95');
    }, 10);
  }

  function closeModal(el) {
    el.classList.add('opacity-0');
    const f = el.querySelector('form');
    if (f) f.classList.add('scale-95');
    setTimeout(() => el.classList.add('hidden'), 200);
  }

  function openCreate() {
    editingId = null;
    document.getElementById('modal-rutina-title').textContent = 'Nueva rutina';
    formRutina.reset();
    inputId.value = '';
    modalError.classList.add('hidden');
    selectedObjetivo = null;
    selectedDiff = null;
    syncObjetivoUI();
    syncDiffUI();
    document.getElementById('save-rutina-text').textContent = 'Guardar';
    openModal(modalRutina);
  }

  function openEdit(id) {
    // Ir al builder en modo edición
    window.location.href = `routine-builder.html?id=${id}`;
  }

  function renderAssignStudentOptions(query = '') {
    const term = query.trim().toLowerCase();
    const filtered = !term
      ? assignStudents
      : assignStudents.filter((s) => (s.full_name || '').toLowerCase().includes(term));

    inputAsignarStudent.innerHTML = '<option value="">Seleccioná un alumno...</option>';
    filtered.forEach((student) => {
      inputAsignarStudent.innerHTML += `<option value="${student.id}">${escHtml(student.full_name || 'Sin nombre')}</option>`;
    });

    const noResults = term && filtered.length === 0;
    assignNoResults?.classList.toggle('hidden', !noResults);
  }

  async function loadStudentsForAssign() {
    const { data, error } = await db
      .from('students')
      .select('id, full_name')
      .eq('gym_id', gymId)
      .is('deleted_at', null)
      .order('full_name', { ascending: true });

    if (error) throw error;
    assignStudents = data || [];
    renderAssignStudentOptions('');
  }

  async function openAssignModal(routineId, routineName) {
    assigningRoutineId = routineId;
    modalAsignarError?.classList.add('hidden');
    document.getElementById('asignar-rutina-nombre').textContent = routineName || 'Rutina';
    inputAsignarStudent.value = '';
    if (inputAsignarSearch) inputAsignarSearch.value = '';

    try {
      await loadStudentsForAssign();
    } catch (error) {
      toast('No se pudo cargar la lista de alumnos', 'error');
      return;
    }

    openModal(modalAsignar);
  }

  /* ─── Botones de selección UI ────────────────────────────── */
  document.querySelectorAll('.objetivo-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedObjetivo = btn.dataset.val;
      syncObjetivoUI();
    });
  });
  document.querySelectorAll('.diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedDiff = btn.dataset.val;
      syncDiffUI();
    });
  });

  function syncObjetivoUI() {
    document
      .querySelectorAll('.objetivo-btn')
      .forEach((b) => b.classList.toggle('active', b.dataset.val === selectedObjetivo));
  }
  function syncDiffUI() {
    document.querySelectorAll('.diff-btn').forEach((b) => {
      b.className =
        'diff-btn flex-1 py-2 rounded-xl text-xs font-semibold border border-[#1E293B] bg-[#0B1218] text-slate-400 transition-colors';
      if (b.dataset.val === selectedDiff) b.classList.add(`active-${selectedDiff}`);
    });
  }

  /* ─── FORM SUBMIT (Guardar) ──────────────────────────────── */
  formRutina.addEventListener('submit', async (e) => {
    e.preventDefault(); // Previene recarga de página al apretar Enter

    if (!selectedObjetivo) {
      modalError.textContent = 'Seleccioná un objetivo de entrenamiento';
      modalError.classList.remove('hidden');
      return;
    }

    const payload = {
      gym_id: gymId,
      name: inputNombre.value.trim(),
      description: inputDesc.value.trim() || null,
      objetivo: selectedObjetivo,
      difficulty: selectedDiff || null,
      duration_weeks: inputSemanas.value ? parseInt(inputSemanas.value) : null,
      days_per_week: inputDias.value ? parseInt(inputDias.value) : null,
      updated_at: new Date().toISOString()
    };

    const btnText = document.getElementById('save-rutina-text');
    const btnSpinner = document.getElementById('save-rutina-spinner');
    const submitBtn = document.getElementById('save-rutina');

    btnText.textContent = 'Guardando…';
    btnSpinner.classList.remove('hidden');
    submitBtn.disabled = true;

    let error;
    if (editingId) {
      ({ error } = await db.from('routines').update(payload).eq('id', editingId));
    } else {
      ({ error } = await db.from('routines').insert(payload));
    }

    submitBtn.disabled = false;
    btnSpinner.classList.add('hidden');
    btnText.textContent = editingId ? 'Actualizar' : 'Guardar';

    if (error) {
      modalError.textContent = 'Error al guardar en base de datos. Intentá de nuevo.';
      modalError.classList.remove('hidden');
      return;
    }

    closeModal(modalRutina);
    toast(editingId ? 'Rutina actualizada' : 'Rutina creada');
    await loadRoutines();
  });

  /* ─── FORM SUBMIT (Eliminar) ─────────────────────────────── */
  function openDelete(id, nombre) {
    pendingDeleteId = id;
    document.getElementById('delete-rutina-nombre').textContent = `"${nombre}"`;
    openModal(modalEliminar);
  }

  document.getElementById('confirm-delete').addEventListener('click', async () => {
    if (!pendingDeleteId) return;

    const btnSubmit = document.getElementById('confirm-delete');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Eliminando...';

    const { error } = await db
      .from('routines')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', pendingDeleteId);

    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Eliminar';

    closeModal(modalEliminar);
    if (error) {
      toast('Error al eliminar', 'error');
      return;
    }

    toast('Rutina eliminada correctamente');
    pendingDeleteId = null;
    await loadRoutines();
  });

  /* ─── Cerrar Modales ─────────────────────────────────────── */
  [modalRutina, modalEliminar, modalAsignar, modalConfirmReplace].forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target === m) closeModal(m);
    });
  });
  document
    .getElementById('close-modal-rutina')
    .addEventListener('click', () => closeModal(modalRutina));
  document
    .getElementById('cancel-modal-rutina')
    .addEventListener('click', () => closeModal(modalRutina));
  document
    .getElementById('cancel-delete')
    .addEventListener('click', () => closeModal(modalEliminar));
  document
    .getElementById('close-modal-asignar')
    ?.addEventListener('click', () => closeModal(modalAsignar));
  document
    .getElementById('cancel-modal-asignar')
    ?.addEventListener('click', () => closeModal(modalAsignar));
  document.getElementById('cancel-replace-routine')?.addEventListener('click', () => {
    pendingReplacement = null;
    closeModal(modalConfirmReplace);
    openModal(modalAsignar);
  });
  document.getElementById('confirm-replace-routine')?.addEventListener('click', async () => {
    if (!pendingReplacement) return;
    await assignRoutineToStudent({
      studentId: pendingReplacement.studentId,
      oldRoutineId: pendingReplacement.oldRoutineId,
      newRoutineId: pendingReplacement.newRoutineId
    });
  });

  inputAsignarSearch?.addEventListener(
    'input',
    debounce((e) => renderAssignStudentOptions(e.target.value), 150)
  );
  document.getElementById('btn-invite-student')?.addEventListener('click', () => {
    window.location.href = 'student-list.html';
  });

  document.getElementById('form-asignar-rutina')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!assigningRoutineId) return;

    const studentId = inputAsignarStudent.value;
    if (!studentId) {
      modalAsignarError.textContent = 'Seleccioná un alumno para asignar la rutina.';
      modalAsignarError.classList.remove('hidden');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-asignar');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Asignando...';

    try {
      const { data: student, error: studentError } = await db
        .from('students')
        .select('id, full_name, routine_id')
        .eq('id', studentId)
        .eq('gym_id', gymId)
        .maybeSingle();

      if (studentError || !student) {
        modalAsignarError.textContent = 'No se pudo validar el alumno seleccionado.';
        modalAsignarError.classList.remove('hidden');
        return;
      }

      const hasActiveRoutine = student.routine_id && student.routine_id !== assigningRoutineId;
      if (hasActiveRoutine) {
        pendingReplacement = {
          studentId: student.id,
          studentName: student.full_name || 'Alumno',
          oldRoutineId: student.routine_id,
          newRoutineId: assigningRoutineId
        };
        document.getElementById('replace-routine-student-name').textContent =
          pendingReplacement.studentName;
        closeModal(modalAsignar);
        openModal(modalConfirmReplace);
        return;
      }

      await assignRoutineToStudent({
        studentId: student.id,
        oldRoutineId: student.routine_id,
        newRoutineId: assigningRoutineId
      });
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Asignar';
    }
  });

  async function assignRoutineToStudent({ studentId, oldRoutineId = null, newRoutineId }) {
    if (oldRoutineId && oldRoutineId !== newRoutineId) {
      await db.from('student_routine_history').insert({
        gym_id: gymId,
        student_id: studentId,
        old_routine_id: oldRoutineId,
        new_routine_id: newRoutineId,
        replaced_at: new Date().toISOString()
      });
    }

    const { error } = await db
      .from('students')
      .update({ routine_id: newRoutineId, updated_at: new Date().toISOString() })
      .eq('id', studentId)
      .eq('gym_id', gymId);

    if (error) {
      modalAsignarError.textContent = `No se pudo asignar la rutina: ${error.message}`;
      modalAsignarError.classList.remove('hidden');
      openModal(modalAsignar);
      return;
    }

    closeModal(modalAsignar);
    closeModal(modalConfirmReplace);
    pendingReplacement = null;
    toast('Rutina asignada al alumno');
    await loadRoutines();
  }

  /* ─── Filtros (En Memoria) ───────────────────────────────── */
  document.querySelectorAll('.filter-chip[data-objetivo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document
        .querySelectorAll('.filter-chip[data-objetivo]')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      filterObjetivo = btn.dataset.objetivo;
      renderGrid();
    });
  });

  document.querySelectorAll('.filter-chip[data-diff]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document
        .querySelectorAll('.filter-chip[data-diff]')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      filterDiff = btn.dataset.diff;
      renderGrid();
    });
  });

  // Usando el debounce de utils.js para no saturar el navegador si el usuario tipea rápido
  const handleSearch = debounce((e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderGrid();
  }, 200);
  document.getElementById('search-input').addEventListener('input', handleSearch);

  /* ─── Init ───────────────────────────────────────────────── */
  await loadRoutines();
})();
