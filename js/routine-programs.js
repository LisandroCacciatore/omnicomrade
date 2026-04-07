/**
 * routine-programs.js
 * TechFitness — Catálogo de Programas
 * REFACTORIZADO: Event Delegation masiva, Utils
 */

(async () => {
  /* ─── Auth ──────────────────────────────────────────────── */
  const session = await window.authGuard(['gim_admin', 'profesor']);
  if (!session) return;

  const db = window.supabaseClient;
  const { toast, escHtml, PROGRAMS } = window.tfUtils;

  /* ─── State ──────────────────────────────────────────────── */
  let currentProgram = null;
  let currentRMs = {};
  let assignModal = null;

  /* ─── DOM Elements ───────────────────────────────────────── */
  const grid = document.getElementById('programs-grid');
  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const rmGrid = document.getElementById('rm-inputs-grid');
  const programOutput = document.getElementById('program-output');

  /* ══════════════════════════════════════════════════════════
       RENDER PROGRAM CARDS
    ══════════════════════════════════════════════════════════ */
  function renderCards() {
    grid.innerHTML = PROGRAMS.map((p) => {
      const diffPips = [1, 2, 3, 4]
        .map(
          (i) => `
              <span class="diff-pip" style="background:${i <= p.difficulty ? p.color : '#1E293B'}"></span>
            `
        )
        .join('');

      const focusBadges = p.focus
        .map(
          (f) => `
              <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;border:1px solid ${p.color}30;background:${p.glowColor};color:${p.color};text-transform:uppercase;letter-spacing:.05em">${f}</span>
            `
        )
        .join('');

      return `
            <div class="program-card group" data-id="${p.id}">
              <div class="card-glow" style="box-shadow:inset 0 0 0 1px ${p.color}55, 0 0 40px ${p.glowColor}"></div>
              <div style="height:3px;background:${p.gradient}"></div>

              <div class="p-5">
                <div class="flex items-start justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style="background:${p.glowColor};border:1px solid ${p.color}30">${p.icon}</div>
                    <div>
                      <h3 class="text-sm font-700 text-white leading-tight">${p.name}</h3>
                      <p class="text-[10px] text-slate-500 mt-0.5">${p.author}</p>
                    </div>
                  </div>
                  <span style="font-size:9px;font-weight:800;padding:2px 8px;border-radius:4px;background:${p.glowColor};color:${p.color};border:1px solid ${p.color}30;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${p.level}</span>
                </div>

                <p class="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-3">${p.description}</p>
                <div class="flex flex-wrap gap-1.5 mb-4">${focusBadges}</div>

                <div class="flex items-center justify-between pt-3 border-t border-border-dark">
                  <div class="flex items-center gap-3 text-xs text-slate-500">
                    <span class="flex items-center gap-1">
                      <span class="material-symbols-rounded text-[14px]" style="font-variation-settings:'FILL' 1;color:${p.color}">calendar_month</span>
                      ${p.weeks} sem
                    </span>
                    <span class="flex items-center gap-1">
                      <span class="material-symbols-rounded text-[14px]" style="font-variation-settings:'FILL' 1;color:${p.color}">repeat</span>
                      ${p.daysPerWeek}d/sem
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[9px] text-slate-600 uppercase tracking-widest mr-1">Nivel</span>
                    ${diffPips}
                  </div>
                </div>

                <button type="button" class="mt-4 w-full py-2 rounded-xl text-sm font-600 transition pointer-events-none"
                  style="background:${p.glowColor};color:${p.color};border:1px solid ${p.color}30">
                  Ver calculadora →
                </button>
              </div>
            </div>`;
    }).join('');
  }

  // DELEGACIÓN: Abrir programa desde la grilla
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.program-card');
    if (card) openProgram(card.dataset.id);
  });

  /* ══════════════════════════════════════════════════════════
       DRAWER LOGIC
    ══════════════════════════════════════════════════════════ */
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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
  });

  function openProgram(id) {
    const p = PROGRAMS.find((x) => x.id === id);
    if (!p) return;
    currentProgram = p;
    currentRMs = {};
    p.inputs.forEach((i) => {
      currentRMs[i.id] = i.default;
    });

    // Populate Header & Info
    document.getElementById('drawer-icon').textContent = p.icon;
    document.getElementById('drawer-icon').style.background = p.glowColor;
    document.getElementById('drawer-icon').style.border = `1px solid ${p.color}30`;
    document.getElementById('drawer-title').textContent = p.name;
    document.getElementById('drawer-author').textContent = p.author;
    document.getElementById('drawer-header-strip').style.background = p.gradient;
    document.getElementById('drawer-description').textContent = p.description;

    document.getElementById('drawer-stats').innerHTML = p.stats
      .map(
        (s) => `
          <div class="stat-chip">
            <span class="material-symbols-rounded" style="color:${p.color};font-variation-settings:'FILL' 1">${s.icon}</span>
            ${s.label}
          </div>`
      )
      .join('');

    // Populate 1RM Inputs
    rmGrid.innerHTML = p.inputs
      .map(
        (i) => `
          <div>
            <label class="form-label">${i.label}</label>
            <div class="rm-input-wrap">
              <input type="number" class="rm-input" data-rm-id="${i.id}" value="${i.default}" min="0" max="999" step="2.5" />
              <span class="unit">KG</span>
            </div>
          </div>`
      )
      .join('');

    renderOutput();
    openDrawer();
    document.getElementById('drawer-body').scrollTop = 0;
  }

  // DELEGACIÓN: Capturar cambios en inputs de 1RM
  rmGrid.addEventListener('input', (e) => {
    if (e.target.classList.contains('rm-input')) {
      currentRMs[e.target.dataset.rmId] = parseFloat(e.target.value) || 0;
      renderOutput(); // Recalcula instantáneamente
    }
  });

  /* ══════════════════════════════════════════════════════════
       RENDER PROGRAM OUTPUT
    ══════════════════════════════════════════════════════════ */
  function renderOutput() {
    const p = currentProgram;
    if (!p) return;
    const weeks = p.generate(currentRMs);

    programOutput.innerHTML = weeks
      .map((wk, wi) => {
        const daysHTML = wk.days
          .map((day) => {
            const liftsHTML = day.lifts
              .map((l) => {
                const isACC = l.type === 'ACC';
                const weightStr =
                  l.w > 0
                    ? `<span class="lift-weight" style="color:${l.color || p.color}">${l.w} kg</span>`
                    : '';
                const typeTag =
                  l.type && !isACC
                    ? `<span class="phase-badge font-mono" style="background:${l.color || p.color}20;color:${l.color || p.color};border:1px solid ${l.color || p.color}30">${l.type}</span>`
                    : '';
                const sublabel = l.sublabel
                  ? `<span class="text-[10px] text-slate-600 font-mono">${l.sublabel}</span>`
                  : '';

                return `
                    <div class="lift-line ${isACC ? 'opacity-50' : ''}">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="lift-label">${escHtml(l.name)}</span>
                          ${sublabel}
                          ${typeTag}
                        </div>
                        ${l.note ? `<div class="lift-note">${escHtml(l.note)}</div>` : ''}
                      </div>
                      <div class="flex items-center gap-2 shrink-0 ml-3">
                        ${weightStr}
                        <span class="lift-scheme">${escHtml(l.sets)}</span>
                      </div>
                    </div>`;
              })
              .join('');

            return `
                <div class="session-row">
                  <div class="text-[10px] font-700 text-slate-500 uppercase tracking-widest mb-2">${escHtml(day.label)}</div>
                  <div class="space-y-1">${liftsHTML}</div>
                </div>`;
          })
          .join('');

        const metaHTML = wk.meta
          ? `<div class="px-4 pb-3 font-mono text-[10px] text-slate-600">${escHtml(wk.meta)}</div>`
          : '';

        return `
            <div class="week-block mb-3" style="animation-delay:${wi * 0.04}s">
              <div class="week-header">
                <div class="flex items-center gap-3 pointer-events-none">
                  <span class="phase-badge font-mono" style="background:${wk.phaseColor}20;color:${wk.phaseColor};border:1px solid ${wk.phaseColor}30">
                    ${wk.phase || `S${wi + 1}`}
                  </span>
                  <span class="text-sm font-700 text-white">${escHtml(wk.label)}</span>
                </div>
                <span class="material-symbols-rounded text-slate-600 text-[18px] expand-icon pointer-events-none">expand_more</span>
              </div>
              ${metaHTML}
              <div class="session-body" style="max-height: 9999px;">${daysHTML}</div>
            </div>`;
      })
      .join('');
  }

  // DELEGACIÓN: Collapsible weeks
  programOutput.addEventListener('click', (e) => {
    const header = e.target.closest('.week-header');
    if (!header) return;

    const body = header.closest('.week-block').querySelector('.session-body');
    const icon = header.querySelector('.expand-icon');
    const isOpen = body.style.maxHeight !== '0px';

    body.style.maxHeight = isOpen ? '0px' : '9999px';
    icon.textContent = isOpen ? 'chevron_right' : 'expand_more';
  });

  /* ─── Assign / Save ──────────────────────────────────────── */
  function getOrCreateModal(session, db) {
    if (!assignModal) {
      assignModal = new window.ProgramAssignModal({
        gymId: session.user.app_metadata.gym_id,
        db,
        onSuccess: ({ student, program }) => {
          toast(`${program.name} asignado a ${student.full_name} ✓`);
        }
      });
    }
    return assignModal;
  }

  document.getElementById('btn-assign').addEventListener('click', () => {
    if (!currentProgram) return;
    const modal = getOrCreateModal(session, db);
    modal.open({ preProgram: currentProgram });
  });

  document.getElementById('btn-save-template')?.addEventListener('click', async () => {
    if (!currentProgram) return;
    const btn = document.getElementById('btn-save-template');
    const gymId = session.user.app_metadata.gym_id;

    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-rounded text-[17px] animate-spin">progress_activity</span>Guardando...`;

    try {
      const { error } = await db.from('program_templates').insert({
        gym_id: gymId,
        slug: `${currentProgram.id}-${Date.now()}`,
        name: currentProgram.name,
        description: currentProgram.description,
        weeks: currentProgram.weeks,
        days_per_week: currentProgram.daysPerWeek,
        level: currentProgram.level,
        config: { rms: { ...currentRMs }, program_id: currentProgram.id }
      });

      if (error) throw error;
      toast('Programa guardado como plantilla');
    } catch (err) {
      console.error('Error saving template:', err);
      toast('No se pudo guardar la plantilla', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-rounded text-[17px]">bookmark</span>Guardar`;
    }
  });

  /* ─── Init ────────────────────────────────────────────────── */
  renderCards();
})();
