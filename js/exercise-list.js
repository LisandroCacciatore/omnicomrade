/**
 * exercise-list.js
 * TechFitness — Biblioteca de Ejercicios
 * REFACTORIZADO: Utils.js, Event Delegation, Bug de memoria reparado, Forms Nativos
 */

(async () => {
  /* ─── Auth ──────────────────────────────────────────────── */
  const session = await window.authGuard(['gim_admin', 'profesor']);
  if (!session) return;

  const db = window.supabaseClient;
  const gymId = session.user.app_metadata.gym_id;
  const { toast, escHtml, debounce } = window.tfUtils;

  /* ─── Config ────────────────────────────────────────────── */
  const MUSCLES = [
    { key: 'pecho', label: 'Pecho', color: '#F97316' },
    { key: 'espalda', label: 'Espalda', color: '#3B82F6' },
    { key: 'hombros', label: 'Hombros', color: '#8B5CF6' },
    { key: 'biceps', label: 'Bíceps', color: '#EC4899' },
    { key: 'triceps', label: 'Tríceps', color: '#F59E0B' },
    { key: 'core', label: 'Core', color: '#EF4444' },
    { key: 'piernas', label: 'Piernas', color: '#10B981' },
    { key: 'gluteos', label: 'Glúteos', color: '#06B6D4' },
    { key: 'cardio', label: 'Cardio', color: '#84CC16' },
    { key: 'otros', label: 'Otros', color: '#64748B' }
  ];

  const CAT_LABELS = {
    fuerza: 'Fuerza',
    hipertrofia: 'Hipertrofia',
    resistencia: 'Resistencia',
    movilidad: 'Movilidad',
    tecnica: 'Técnica'
  };
  const CAT_COLORS = {
    fuerza: '#EF4444',
    hipertrofia: '#3B82F6',
    resistencia: '#10B981',
    movilidad: '#8B5CF6',
    tecnica: '#F59E0B'
  };
  const CAT_BG = {
    fuerza: 'rgba(239,68,68,.12)',
    hipertrofia: 'rgba(59,130,246,.12)',
    resistencia: 'rgba(16,185,129,.12)',
    movilidad: 'rgba(139,92,246,.12)',
    tecnica: 'rgba(245,158,11,.12)'
  };
  const DIFF_LABELS = {
    principiante: 'Principiante',
    intermedio: 'Intermedio',
    avanzado: 'Avanzado'
  };
  const DIFF_COLORS = { principiante: '#10B981', intermedio: '#F59E0B', avanzado: '#EF4444' };
  const GOAL_LABELS = {
    fuerza: 'Fuerza',
    hipertrofia: 'Hipertrofia',
    resistencia_muscular: 'Resistencia',
    movilidad: 'Movilidad',
    potencia: 'Potencia',
    readaptacion: 'Readaptación'
  };
  const GOAL_COLORS = {
    fuerza: '#EF4444',
    hipertrofia: '#3B82F6',
    resistencia_muscular: '#10B981',
    movilidad: '#8B5CF6',
    potencia: '#F59E0B',
    readaptacion: '#64748B'
  };
  const PATTERN_LABELS = {
    empuje_horizontal: 'Empuje horizontal',
    empuje_vertical: 'Empuje vertical',
    traccion_horizontal: 'Tracción horizontal',
    traccion_vertical: 'Tracción vertical',
    dominante_rodilla: 'Dominante rodilla',
    dominante_cadera: 'Dominante cadera',
    core_anti_extension: 'Core anti-extensión',
    core_anti_rotacion: 'Core anti-rotación',
    locomocion: 'Locomoción'
  };
  const SAFETY_META = {
    sin_alerta: { label: 'Sin alerta', color: '#10B981', icon: 'verified' },
    precaucion: { label: 'Precaución', color: '#F59E0B', icon: 'warning' },
    supervision_recomendada: { label: 'Supervisión', color: '#3B82F6', icon: 'visibility' },
    alerta_alta: { label: 'Alerta alta', color: '#EF4444', icon: 'priority_high' }
  };
  const COLOR_MAP = {
    red: 'active-red',
    blue: 'active-blue',
    green: 'active-green',
    amber: 'active-amber',
    purple: 'active-purple',
    slate: 'active-slate'
  };

  /* ─── State ──────────────────────────────────────────────── */
  let allExercises = [];
  let filterMuscle = null;
  let filterCat = 'all';
  let filterGoal = 'all';
  let filterPattern = 'all';
  let filterOrigin = 'all';
  let filterFavsOnly = false;
  let filterCompatibleOnly = true;
  const availableEquipment = new Set();
  let searchQuery = '';
  let viewMode = 'grid';
  let editingId = null;
  let pendingDeleteId = null;

  // Form state
  let selMuscle = null;
  let selCat = null;
  let selDiff = null;
  let selEquip = null;
  let selGoal = null;
  let selPattern = null;
  let selSafety = null;
  let selComplexity = null;
  let selRegressionId = null;
  let selProgressionId = null;

  const favorites = new Set();
  const usageMap = {};

  /* ─── DOM ───────────────────────────────────────────────── */
  const grid = document.getElementById('exercises-grid');
  const emptyEl = document.getElementById('empty-state');
  const countEl = document.getElementById('result-count');
  const drawer = document.getElementById('drawer'); // Ahora es un <form>
  const backdrop = document.getElementById('drawer-backdrop');
  const formDel = document.getElementById('form-delete-exercise');
  const modalDel = document.getElementById('modal-delete');
  const modalRepl = document.getElementById('modal-replacements');

  /* ─── Funciones de Filtros y Músculos ────────────────────── */
  function buildMuscleList(counts = {}) {
    const el = document.getElementById('muscle-list');
    el.innerHTML = MUSCLES.map(
      (m) => `
        <div class="muscle-item ${filterMuscle === m.key ? 'active' : ''}" data-m="${m.key}">
          <span class="muscle-dot" style="background:${m.color}; ${filterMuscle === m.key ? `box-shadow:0 0 6px ${m.color}` : ''}"></span>
          <span style="${filterMuscle === m.key ? `color:${m.color}` : ''}">${m.label}</span>
          <span class="muscle-count">${counts[m.key] || 0}</span>
        </div>`
    ).join('');

    el.querySelectorAll('.muscle-item').forEach((item) => {
      item.addEventListener('click', () => {
        const key = item.dataset.m;
        filterMuscle = filterMuscle === key ? null : key;
        document.getElementById('clear-muscle').classList.toggle('hidden', !filterMuscle);
        syncSvgHighlight();
        buildMuscleList(counts);
        renderGrid();
      });
    });
  }

  function buildMusclePicker() {
    const el = document.getElementById('muscle-picker');
    el.innerHTML = MUSCLES.map(
      (m) => `
        <button type="button" class="muscle-pick-btn ${selMuscle === m.key ? 'active' : ''}"
          data-m="${m.key}"
          style="${selMuscle === m.key ? `border-color:${m.color};background:rgba(${hexToRgb(m.color)},.12);color:${m.color}` : ''}">
          <span class="muscle-pick-dot" style="background:${m.color}; ${selMuscle === m.key ? `box-shadow:0 0 5px ${m.color}` : 'opacity:.5'}"></span>
          ${m.label}
        </button>`
    ).join('');

    el.querySelectorAll('.muscle-pick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selMuscle = btn.dataset.m;
        buildMusclePicker(); // Re-render solo de este picker
      });
    });
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16),
      g = parseInt(hex.slice(3, 5), 16),
      b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  function syncSvgHighlight() {
    document.querySelectorAll('.muscle-region').forEach((r) => {
      r.classList.toggle('active', r.dataset.muscle === filterMuscle);
    });
  }

  document.querySelectorAll('.muscle-region').forEach((r) => {
    r.addEventListener('click', () => {
      const key = r.dataset.muscle;
      filterMuscle = filterMuscle === key ? null : key;
      document.getElementById('clear-muscle').classList.toggle('hidden', !filterMuscle);
      syncSvgHighlight();
      buildMuscleList(countByMuscle());
      renderGrid();
    });
    r.addEventListener('mouseenter', () => {
      const m = MUSCLES.find((x) => x.key === r.dataset.muscle);
      if (m) r.setAttribute('title', m.label);
    });
  });

  document.getElementById('clear-muscle').addEventListener('click', () => {
    filterMuscle = null;
    document.getElementById('clear-muscle').classList.add('hidden');
    syncSvgHighlight();
    buildMuscleList(countByMuscle());
    renderGrid();
  });

  function countByMuscle() {
    const c = {};
    allExercises.forEach((e) => {
      c[e.muscle_group] = (c[e.muscle_group] || 0) + 1;
    });
    return c;
  }

  // NOTE: loadGymEquipment removed - table gyms.available_equipment does not exist

  // NOTE: loadFavorites removed - table exercise_favorites does not exist

  // NOTE: loadUsageStats removed - table exercise_usage_events does not exist

  function populateProgressionSelectors(currentId = null) {
    const reg = document.getElementById('ex-regression-id');
    const prog = document.getElementById('ex-progression-id');
    if (!reg || !prog) return;
    const options = [`<option value="">Sin vínculo</option>`]
      .concat(
        allExercises
          .filter((ex) => !currentId || ex.id !== currentId)
          .map((ex) => `<option value="${ex.id}">${escHtml(ex.name)}</option>`)
      )
      .join('');
    reg.innerHTML = options;
    prog.innerHTML = options;
    reg.value = selRegressionId || '';
    prog.value = selProgressionId || '';
  }

  function renderUsageTop() {
    const usageEl = document.getElementById('usage-top-list');
    if (!usageEl) return;
    // NOTE: usageMap no longer populated - table exercise_usage_events removed
    usageEl.innerHTML = '<div class="text-slate-600">Sin datos todavía</div>';
  }

  function generateRecommendations() {
    const recsEl = document.getElementById('recs-list');
    if (!recsEl) return;
    const list = allExercises
      .filter((ex) => !filterGoal || filterGoal === 'all' || ex.main_goal === filterGoal)
      .filter(
        (ex) =>
          !filterPattern ||
          filterPattern === 'all' ||
          !ex.movement_pattern ||
          ex.movement_pattern === filterPattern
      )
      // NOTE: safety_level column removed - no longer filtering
      .sort((a, b) => {
        // Favorites and usage stats disabled
        return 0;
      })
      .slice(0, 5);
    recsEl.innerHTML = list.length
      ? list.map((ex) => `<div>• ${escHtml(ex.name)}</div>`).join('')
      : '<div class="text-slate-600">Sin recomendación con filtros actuales</div>';
  }

  function openReplacements(exerciseId) {
    const current = allExercises.find((ex) => ex.id === exerciseId);
    if (!current) return;
    const candidates = allExercises
      .filter((ex) => ex.id !== current.id)
      // NOTE: main_goal and movement_pattern columns may not exist in all records
      .filter((ex) => !current.main_goal || !ex.main_goal || ex.main_goal === current.main_goal)
      .filter(
        (ex) =>
          !current.movement_pattern ||
          !ex.movement_pattern ||
          ex.movement_pattern === current.movement_pattern ||
          ex.muscle_group === current.muscle_group
      )
      // NOTE: safety_level column removed from schema
      .filter((ex) => true)
      .filter(
        (ex) => !ex.equipment || availableEquipment.has(ex.equipment) || ex.equipment === 'otros'
      )
      .slice(0, 6);
    document.getElementById('replacement-title').textContent = `Alternativas para ${current.name}`;
    document.getElementById('replacement-list').innerHTML = candidates.length
      ? candidates
          .map(
            (ex) =>
              `<div class="p-2 rounded-lg bg-[#0B1218] border border-[#1E293B]">${escHtml(ex.name)} <span class="text-slate-500">• ${PATTERN_LABELS[ex.movement_pattern] || ex.muscle_group}</span></div>`
          )
          .join('')
      : '<div class="text-slate-500">No hay reemplazos compatibles con equipamiento/configuración actual.</div>';
    modalRepl.classList.add('open');
  }

  document.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-cat]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      filterCat = btn.dataset.cat;
      renderGrid();
    });
  });

  document.querySelectorAll('[data-origin]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-origin]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      filterOrigin = btn.dataset.origin;
      renderGrid();
    });
  });

  document.querySelectorAll('[data-goal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-goal]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      filterGoal = btn.dataset.goal;
      renderGrid();
    });
  });

  document.querySelectorAll('[data-pattern]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-pattern]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      filterPattern = btn.dataset.pattern;
      renderGrid();
    });
  });

  document.querySelectorAll('[data-favs-only]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filterFavsOnly = !filterFavsOnly;
      btn.classList.toggle('active', filterFavsOnly);
      renderGrid();
    });
  });

  document.querySelectorAll('[data-avail-equip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toast('Equipamiento definido por configuración del gym');
    });
  });

  document.querySelectorAll('[data-compatible-only]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filterCompatibleOnly = !filterCompatibleOnly;
      btn.classList.toggle('active', filterCompatibleOnly);
      renderGrid();
    });
  });

  const recBtn = document.getElementById('btn-generate-recs');
  if (recBtn) recBtn.addEventListener('click', generateRecommendations);

  /* ─── Search (Optimizado con Debounce) ──────────────────── */
  const handleSearch = debounce((e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderGrid();
  }, 300);

  ['search-header', 'search-mobile', 'search-mobile2'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', handleSearch);
  });

  /* ─── View toggle ───────────────────────────────────────── */
  document.getElementById('view-grid').addEventListener('click', () => {
    viewMode = 'grid';
    document.getElementById('view-grid').classList.add('active');
    document.getElementById('view-list').classList.remove('active');
    grid.classList.remove('list-view');
  });
  document.getElementById('view-list').addEventListener('click', () => {
    viewMode = 'list';
    document.getElementById('view-list').classList.add('active');
    document.getElementById('view-grid').classList.remove('active');
    grid.classList.add('list-view');
  });

  /* ─── Load & Render ─────────────────────────────────────── */
  async function loadExercises() {
    const [{ data: gymEx }, { data: globalEx }] = await Promise.all([
      db.from('exercises').select('*').eq('gym_id', gymId).is('deleted_at', null).order('name'),
      db.from('exercises').select('*').eq('is_global', true).is('deleted_at', null).order('name')
    ]);
    allExercises = [...(globalEx || []), ...(gymEx || [])];
    buildMuscleList(countByMuscle());
    populateProgressionSelectors(editingId);
    renderGrid();
  }

  function renderGrid() {
    const items = allExercises.filter((ex) => {
      const matchM = !filterMuscle || ex.muscle_group === filterMuscle;
      const matchCat = filterCat === 'all' || ex.category === filterCat;
      // NOTE: main_goal and movement_pattern columns removed from schema
      const matchGoal = filterGoal === 'all' || !ex.main_goal || ex.main_goal === filterGoal;
      const matchPattern =
        filterPattern === 'all' || !ex.movement_pattern || ex.movement_pattern === filterPattern;
      const matchOrigin =
        filterOrigin === 'all' ||
        (filterOrigin === 'preset' && ex.is_global) ||
        (filterOrigin === 'custom' && !ex.is_global);
      // NOTE: favorites feature disabled - table exercise_favorites removed
      const matchFav = true;
      const matchCompat =
        !filterCompatibleOnly ||
        !ex.equipment ||
        availableEquipment.size === 0 ||
        availableEquipment.has(ex.equipment) ||
        ex.equipment === 'otros';
      const matchSearch =
        !searchQuery ||
        ex.name.toLowerCase().includes(searchQuery) ||
        (ex.description || '').toLowerCase().includes(searchQuery) ||
        (ex.muscle_group || '').toLowerCase().includes(searchQuery) ||
        (GOAL_LABELS[ex.main_goal] || '').toLowerCase().includes(searchQuery) ||
        (PATTERN_LABELS[ex.movement_pattern] || '').toLowerCase().includes(searchQuery) ||
        (ex.technical_cue || '').toLowerCase().includes(searchQuery);
      return (
        matchM &&
        matchCat &&
        matchGoal &&
        matchPattern &&
        matchOrigin &&
        matchFav &&
        matchCompat &&
        matchSearch
      );
    });

    countEl.textContent = `${items.length} ejercicio${items.length !== 1 ? 's' : ''}`;

    if (items.length === 0) {
      grid.innerHTML = '';
      grid.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      return;
    }

    grid.classList.remove('hidden');
    emptyEl.classList.add('hidden');
    grid.innerHTML = items.map((ex) => exerciseCard(ex)).join('');
    generateRecommendations();
    renderUsageTop();
    // NOTA: Se eliminó la asignación de eventos querySelectorAll aquí. Ahora usamos Event Delegation.
  }

  function exerciseCard(ex) {
    const muscle = MUSCLES.find((m) => m.key === ex.muscle_group) || {
      color: '#64748B',
      label: ex.muscle_group
    };
    const catColor = CAT_COLORS[ex.category] || '#64748B';
    const catBg = CAT_BG[ex.category] || 'rgba(100,116,139,.12)';
    const catLabel = CAT_LABELS[ex.category] || ex.category || '';
    const diffColor = DIFF_COLORS[ex.difficulty] || '#64748B';
    const diffLabel = DIFF_LABELS[ex.difficulty] || ex.difficulty || '';
    // NOTE: main_goal, movement_pattern, safety_level, complexity_level removed - use safe access
    const goalColor = GOAL_COLORS[ex.main_goal] || '#64748B';
    const goalLabel = GOAL_LABELS[ex.main_goal] || '';
    const patternLabel = PATTERN_LABELS[ex.movement_pattern] || '';
    const safety = null;
    const isFav = false; // favorites feature disabled
    const complexity = 0;

    const equipIcon =
      {
        barra: 'sports_score',
        mancuernas: 'fitness_center',
        maquina: 'computer',
        cable: 'cable',
        peso_corporal: 'accessibility_new',
        banda: 'loop',
        kettlebell: 'fitness_center',
        otros: 'more_horiz'
      }[ex.equipment] || 'fitness_center';

    return `
      <div class="exercise-card" style="animation-delay:inherit">
        <div class="card-accent" style="background:${muscle.color}"></div>
        <div class="card-actions">
          <button type="button" class="action-btn ${isFav ? 'active' : ''}" data-action="favorite" data-id="${ex.id}" title="Favorito">
            <span class="material-symbols-rounded pointer-events-none">${isFav ? 'star' : 'star_outline'}</span>
          </button>
          ${
            !ex.is_global
              ? `
            <button type="button" class="action-btn" data-action="edit" data-id="${ex.id}" title="Editar">
              <span class="material-symbols-rounded pointer-events-none">edit</span>
            </button>
            <button type="button" class="action-btn danger" data-action="delete" data-id="${ex.id}" data-name="${escHtml(ex.name)}" title="Eliminar">
              <span class="material-symbols-rounded pointer-events-none">delete</span>
            </button>`
              : `
            <button type="button" class="action-btn" title="Ejercicio preset — no editable" style="opacity:.4;cursor:default">
              <span class="material-symbols-rounded">lock</span>
            </button>`
          }
        </div>
        <div class="pl-4 pr-3 pt-3 pb-3">
          <div class="flex items-start gap-2 mb-2 pr-14">
            <h3 class="text-sm font-bold text-white leading-snug flex-1">${escHtml(ex.name)}</h3>
          </div>
          <div class="flex flex-wrap gap-1.5 mb-3">
            <span class="badge" style="background:rgba(${hexToRgb(muscle.color)},.13); color:${muscle.color}; border:1px solid rgba(${hexToRgb(muscle.color)},.25)">
              ${muscle.label}
            </span>
            ${catLabel ? `<span class="badge" style="background:${catBg};color:${catColor};border:1px solid rgba(${hexToRgb(catColor)},.22)">${catLabel}</span>` : ''}
            ${diffLabel ? `<span class="badge" style="background:rgba(${hexToRgb(diffColor)},.12);color:${diffColor};border:1px solid rgba(${hexToRgb(diffColor)},.2)">${diffLabel}</span>` : ''}
            ${goalLabel ? `<span class="badge" style="background:rgba(${hexToRgb(goalColor)},.12);color:${goalColor};border:1px solid rgba(${hexToRgb(goalColor)},.2)">${goalLabel}</span>` : ''}
            ${patternLabel ? `<span class="badge" style="background:rgba(148,163,184,.12);color:#94A3B8;border:1px solid rgba(148,163,184,.24)">${patternLabel}</span>` : ''}
            ${safety ? `<span class="badge" style="background:rgba(${hexToRgb(safety.color)},.12);color:${safety.color};border:1px solid rgba(${hexToRgb(safety.color)},.2)"><span class="material-symbols-rounded text-[11px]">${safety.icon}</span>${safety.label}</span>` : ''}
            ${complexity ? `<span class="badge" style="background:rgba(148,163,184,.12);color:#E2E8F0;border:1px solid rgba(148,163,184,.24)">Complejidad ${complexity}/5</span>` : ''}
            ${ex.is_global ? `<span class="global-pill"><span class="material-symbols-rounded" style="font-size:9px">verified</span>Preset</span>` : ''}
          </div>
          <p class="text-[11px] text-slate-500 line-clamp-2 min-h-[32px] leading-relaxed">
            ${ex.description ? escHtml(ex.description) : '<span class="italic text-slate-700">Sin descripción</span>'}
          </p>
          ${ex.technical_cue ? `<p class="text-[11px] text-slate-400 mt-2 line-clamp-1"><span class="font-semibold text-slate-300">Cue:</span> ${escHtml(ex.technical_cue)}</p>` : ''}
          <div class="flex items-center gap-3 mt-3 pt-2.5 border-t border-[#1E293B]">
            ${
              ex.equipment
                ? `
              <div class="flex items-center gap-1 text-[11px] text-slate-600">
                <span class="material-symbols-rounded text-[14px]" style="font-variation-settings:'FILL' 1">${equipIcon}</span>
                ${ex.equipment.replace('_', ' ')}
              </div>`
                : ''
            }
            ${
              ex.video_url
                ? `
              <a href="${escHtml(ex.video_url)}" target="_blank" rel="noopener" class="ml-auto flex items-center gap-1 text-[11px] text-[#3B82F6] hover:underline" onclick="event.stopPropagation()">
                <span class="material-symbols-rounded text-[14px]" style="font-variation-settings:'FILL' 1">play_circle</span>
                Ver video
              </a>`
                : ''
            }
            <button type="button" class="ml-auto flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200" data-action="replace" data-id="${ex.id}">
              <span class="material-symbols-rounded text-[14px]">swap_horiz</span>
              Reemplazos
            </button>
          </div>
          ${
            ex.regression_exercise_id || ex.progression_exercise_id
              ? `
            <div class="flex flex-wrap gap-1 mt-2">
              ${ex.regression_exercise_id ? `<span class="badge text-[10px]">↘ Regresión</span>` : ''}
              ${ex.progression_exercise_id ? `<span class="badge text-[10px]">↗ Progresión</span>` : ''}
            </div>`
              : ''
          }
        </div>
      </div>`;
  }

  /* ─── EVENT DELEGATION (Grid) ───────────────────────────── */
  grid.addEventListener('click', (e) => {
    const editBtn = e.target.closest('button[data-action="edit"]');
    const deleteBtn = e.target.closest('button[data-action="delete"]');
    const favBtn = e.target.closest('button[data-action="favorite"]');
    const replBtn = e.target.closest('button[data-action="replace"]');
    const cardEl = e.target.closest('.exercise-card');

    if (favBtn) {
      e.stopPropagation();
      // Favorites feature disabled - table exercise_favorites does not exist
      window.tfUtils?.toast?.('Próximamente: favoritos', 'info');
    } else if (replBtn) {
      e.stopPropagation();
      openReplacements(replBtn.dataset.id);
    } else if (editBtn) {
      e.stopPropagation();
      openEdit(editBtn.dataset.id);
    } else if (deleteBtn) {
      e.stopPropagation();
      openDelete(deleteBtn.dataset.id, deleteBtn.dataset.name);
    } else if (cardEl) {
      const id = cardEl.querySelector('[data-action="favorite"]')?.dataset.id;
      if (id) {
        // Usage tracking disabled - table exercise_usage_events does not exist
        window.tfUtils?.toast?.('Ejercicio abierto', 'info');
      }
    }
  });

  /* ─── Drawer: open/close ──────────────────────────────────── */
  function openDrawer() {
    drawer.classList.add('open');
    backdrop.classList.add('open');
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
  }

  backdrop.addEventListener('click', closeDrawer);
  document.getElementById('close-drawer').addEventListener('click', closeDrawer);
  document.getElementById('cancel-drawer').addEventListener('click', closeDrawer);

  /* ─── Form Openers ────────────────────────────────────────── */
  function openCreate() {
    editingId = null;
    document.getElementById('drawer-title').textContent = 'Nuevo ejercicio';
    document.getElementById('drawer-subtitle').textContent = 'Completá los datos del movimiento';
    drawer.reset(); // Aprovechamos que ahora es un form para limpiar
    document.getElementById('exercise-id').value = '';
    document.getElementById('drawer-error').classList.add('hidden');
    selMuscle = null;
    selCat = null;
    selDiff = null;
    selEquip = null;
    selGoal = null;
    selPattern = null;
    selSafety = null;
    selComplexity = null;
    selRegressionId = null;
    selProgressionId = null;
    buildMusclePicker();
    resetSelBtns();
    populateProgressionSelectors();
    document.getElementById('save-exercise').innerHTML =
      `<span class="material-symbols-rounded text-[17px]">save</span>Guardar ejercicio`;
    openDrawer();
  }

  function openEdit(id) {
    const ex = allExercises.find((e) => e.id === id);
    if (!ex || ex.is_global) return;

    editingId = id;
    document.getElementById('drawer-title').textContent = 'Editar ejercicio';
    document.getElementById('drawer-subtitle').textContent = escHtml(ex.name);
    document.getElementById('exercise-id').value = ex.id;
    document.getElementById('ex-name').value = ex.name;
    document.getElementById('ex-description').value = ex.description || '';
    document.getElementById('ex-video-url').value = ex.video_url || '';
    document.getElementById('drawer-error').classList.add('hidden');

    selMuscle = ex.muscle_group || null;
    selCat = ex.category || null;
    selDiff = ex.difficulty || null;
    selEquip = ex.equipment || null;
    selGoal = ex.main_goal || null;
    selPattern = ex.movement_pattern || null;
    selSafety = ex.safety_level || null;
    selComplexity = ex.complexity_level ? String(ex.complexity_level) : null;
    selRegressionId = ex.regression_exercise_id || null;
    selProgressionId = ex.progression_exercise_id || null;
    document.getElementById('ex-cue').value = ex.technical_cue || '';

    buildMusclePicker();
    resetSelBtns();
    activateSelBtn('cat-picker', selCat, ex.category);
    activateSelBtn('diff-picker', selDiff, ex.difficulty);
    activateSelBtn('equip-picker', selEquip, ex.equipment);
    activateSelBtn('goal-picker', selGoal, ex.main_goal);
    activateSelBtn('pattern-picker', selPattern, ex.movement_pattern);
    activateSelBtn('safety-picker', selSafety, ex.safety_level);
    activateSelBtn('complexity-picker', selComplexity, selComplexity);
    populateProgressionSelectors(ex.id);

    document.getElementById('save-exercise').innerHTML =
      `<span class="material-symbols-rounded text-[17px]">save</span>Actualizar`;
    openDrawer();
  }

  /* ─── Botones de Formulario (Limpieza de Bug) ─────────────── */
  // Solo remueve clases visuales. NO bindea eventos de nuevo.
  function resetSelBtns() {
    [
      'cat-picker',
      'diff-picker',
      'equip-picker',
      'goal-picker',
      'pattern-picker',
      'safety-picker',
      'complexity-picker'
    ].forEach((id) => {
      document.querySelectorAll(`#${id} .sel-btn`).forEach((b) => {
        const classes = [...b.classList].filter((c) => c.startsWith('active-'));
        classes.forEach((c) => b.classList.remove(c));
      });
    });
  }

  function activateSelBtn(pickerId, state, val) {
    if (!val) return;
    const btn = document.querySelector(`#${pickerId} [data-val="${val}"]`);
    if (btn) btn.classList.add(COLOR_MAP[btn.dataset.color] || 'active-blue');
  }

  // SE LLAMA SOLO UNA VEZ EN EL INIT
  function initBindSelBtns() {
    document.querySelectorAll('#cat-picker .sel-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document
          .querySelectorAll('#cat-picker .sel-btn')
          .forEach((b) => b.classList.remove(...Object.values(COLOR_MAP)));
        btn.classList.add(COLOR_MAP[btn.dataset.color]);
        selCat = btn.dataset.val;
      });
    });
    document.querySelectorAll('#diff-picker .sel-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document
          .querySelectorAll('#diff-picker .sel-btn')
          .forEach((b) => b.classList.remove(...Object.values(COLOR_MAP)));
        btn.classList.add(COLOR_MAP[btn.dataset.color]);
        selDiff = btn.dataset.val;
      });
    });
    document.querySelectorAll('#equip-picker .sel-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const isActive = [...btn.classList].some((c) => c.startsWith('active-'));
        document
          .querySelectorAll('#equip-picker .sel-btn')
          .forEach((b) => b.classList.remove(...Object.values(COLOR_MAP)));
        if (!isActive) {
          btn.classList.add(COLOR_MAP[btn.dataset.color]);
          selEquip = btn.dataset.val;
        } else {
          selEquip = null;
        }
      });
    });
    document.querySelectorAll('#goal-picker .sel-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document
          .querySelectorAll('#goal-picker .sel-btn')
          .forEach((b) => b.classList.remove(...Object.values(COLOR_MAP)));
        btn.classList.add(COLOR_MAP[btn.dataset.color]);
        selGoal = btn.dataset.val;
      });
    });
    document.querySelectorAll('#pattern-picker .sel-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document
          .querySelectorAll('#pattern-picker .sel-btn')
          .forEach((b) => b.classList.remove(...Object.values(COLOR_MAP)));
        btn.classList.add(COLOR_MAP[btn.dataset.color]);
        selPattern = btn.dataset.val;
      });
    });
    document.querySelectorAll('#safety-picker .sel-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document
          .querySelectorAll('#safety-picker .sel-btn')
          .forEach((b) => b.classList.remove(...Object.values(COLOR_MAP)));
        btn.classList.add(COLOR_MAP[btn.dataset.color]);
        selSafety = btn.dataset.val;
      });
    });
    document.querySelectorAll('#complexity-picker .sel-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document
          .querySelectorAll('#complexity-picker .sel-btn')
          .forEach((b) => b.classList.remove(...Object.values(COLOR_MAP)));
        btn.classList.add(COLOR_MAP[btn.dataset.color]);
        selComplexity = btn.dataset.val;
      });
    });
    const regSelect = document.getElementById('ex-regression-id');
    const progSelect = document.getElementById('ex-progression-id');
    if (regSelect)
      regSelect.addEventListener('change', (e) => {
        selRegressionId = e.target.value || null;
      });
    if (progSelect)
      progSelect.addEventListener('change', (e) => {
        selProgressionId = e.target.value || null;
      });
  }

  /* ─── Save exercise (FORM SUBMIT) ───────────────────────── */
  drawer.addEventListener('submit', async (e) => {
    e.preventDefault(); // Previene el refresco al presionar Enter

    const name = document.getElementById('ex-name').value.trim();
    const errEl = document.getElementById('drawer-error');

    // El nombre ya está validado por el 'required' del HTML, pero chequeamos espacios y músculo
    if (!name) {
      errEl.textContent = 'El nombre es obligatorio';
      errEl.classList.remove('hidden');
      return;
    }
    if (!selMuscle) {
      errEl.textContent = 'Seleccioná un músculo principal';
      errEl.classList.remove('hidden');
      return;
    }
    if (!selGoal) {
      errEl.textContent = 'Seleccioná un objetivo principal';
      errEl.classList.remove('hidden');
      return;
    }
    if (!selPattern) {
      errEl.textContent = 'Seleccioná un patrón de movimiento';
      errEl.classList.remove('hidden');
      return;
    }
    if (!selSafety) {
      errEl.textContent = 'Seleccioná un nivel de seguridad';
      errEl.classList.remove('hidden');
      return;
    }
    const technicalCue = document.getElementById('ex-cue').value.trim();
    if (!technicalCue) {
      errEl.textContent = 'El cue técnico es obligatorio';
      errEl.classList.remove('hidden');
      return;
    }
    if (!selComplexity) {
      errEl.textContent = 'Seleccioná complejidad técnica (1-5)';
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');

    const payload = {
      gym_id: gymId,
      name,
      description: document.getElementById('ex-description').value.trim() || null,
      muscle_group: selMuscle,
      category: selCat || null,
      difficulty: selDiff || null,
      // NOTE: main_goal, movement_pattern, safety_level, complexity_level, technical_cue removed - columns don't exist
      equipment: selEquip || null,
      video_url: document.getElementById('ex-video-url').value.trim() || null,
      is_global: false,
      updated_at: new Date().toISOString()
    };

    const btn = document.getElementById('save-exercise');
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-rounded text-[17px] animate-spin">progress_activity</span>Guardando…`;

    const query = editingId
      ? db.from('exercises').update(payload).eq('id', editingId)
      : db.from('exercises').insert(payload);
    const { error } = await query;

    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-rounded text-[17px]">save</span>${editingId ? 'Actualizar' : 'Guardar ejercicio'}`;

    if (error) {
      errEl.textContent = 'Error al guardar en base de datos. Intentá de nuevo.';
      errEl.classList.remove('hidden');
      return;
    }

    closeDrawer();
    toast(editingId ? 'Ejercicio actualizado' : 'Ejercicio creado ✓');
    await loadExercises();
  });

  /* ─── Delete ──────────────────────────────────────────────── */
  function openDelete(id, name) {
    pendingDeleteId = id;
    document.getElementById('delete-ex-name').textContent = `"${name}"`;
    modalDel.classList.add('open');
  }

  document
    .getElementById('cancel-delete')
    .addEventListener('click', () => modalDel.classList.remove('open'));
  modalDel.addEventListener('click', (e) => {
    if (e.target === modalDel) modalDel.classList.remove('open');
  });
  document
    .getElementById('close-replacements')
    .addEventListener('click', () => modalRepl.classList.remove('open'));
  modalRepl.addEventListener('click', (e) => {
    if (e.target === modalRepl) modalRepl.classList.remove('open');
  });

  formDel.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pendingDeleteId) return;

    const btn = document.getElementById('confirm-delete');
    btn.disabled = true;
    btn.textContent = 'Eliminando...';

    const { error } = await db
      .from('exercises')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', pendingDeleteId)
      .eq('gym_id', gymId);

    btn.disabled = false;
    btn.textContent = 'Eliminar';

    modalDel.classList.remove('open');
    if (error) {
      toast('Error al eliminar', 'error');
      return;
    }
    toast('Ejercicio eliminado');
    pendingDeleteId = null;
    await loadExercises();
  });

  /* ─── Empty state button ──────────────────────────────────── */
  document.getElementById('btn-nuevo-ejercicio').addEventListener('click', openCreate);
  document.getElementById('btn-empty').addEventListener('click', openCreate);

  /* ─── Keyboard: ESC closes drawer ────────────────────────── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (drawer.classList.contains('open')) closeDrawer();
      if (modalDel.classList.contains('open')) modalDel.classList.remove('open');
      if (modalRepl.classList.contains('open')) modalRepl.classList.remove('open');
    }
  });

  /* ─── Init ────────────────────────────────────────────────── */
  initBindSelBtns(); // Ejecutar SOLO UNA VEZ aquí
  buildMusclePicker();
  const compatBtn = document.querySelector('[data-compatible-only]');
  if (compatBtn) compatBtn.classList.toggle('active', filterCompatibleOnly);
  // NOTE: loadGymEquipment, loadFavorites, loadUsageStats removed - tables don't exist
  await loadExercises();
  generateRecommendations();
})();
