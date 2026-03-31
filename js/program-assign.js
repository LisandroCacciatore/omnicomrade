/**
 * program-assign.js
 * TechFitness — Modal de asignación de programas (reutilizable)
 * REFACTORIZADO: Usa tfUtils.PROGRAMS, clases de Tailwind, Form nativo.
 *
 * Uso:
 * const modal = new window.ProgramAssignModal({ gymId, db, onSuccess })
 * modal.open({ preProgram, preStudent })
 */

class ProgramAssignModal {
  constructor({ gymId, db, onSuccess }) {
    this.gymId     = gymId;
    this.db        = db;
    this.onSuccess = onSuccess || (() => {});
    
    // Obtenemos el catálogo centralizado desde utils
    this.PROGRAMS = window.tfUtils.PROGRAMS;

    this._preProgram = null;
    this._preStudent = null;
    this._step       = 1;
    this._selProgram = null;
    this._selStudent = null;
    this._rms        = {};
    this._students   = [];

    this._inject();
  }

  /* ── Public API ─────────────────────────────────────────── */
  open({ preProgram = null, preStudent = null } = {}) {
    this._preProgram = preProgram;
    this._preStudent = preStudent;
    this._selProgram = preProgram || null;
    this._selStudent = preStudent || null;
    this._rms        = {};

    if (preProgram && preStudent) this._step = 3;
    else if (preProgram)          this._step = 2;
    else                          this._step = 1;

    this._render();
    this._backdropEl().classList.remove('hidden');
    setTimeout(() => {
      this._backdropEl().classList.remove('opacity-0');
      this._modalEl().classList.remove('scale-95');
    }, 10);
  }

  close() {
    this._backdropEl().classList.add('opacity-0');
    this._modalEl().classList.add('scale-95');
    setTimeout(() => this._backdropEl().classList.add('hidden'), 200);
  }

  /* ── DOM injection (Usando clases Tailwind) ─────────────── */
  _inject() {
    if (document.getElementById('pa-backdrop')) return;

    const html = `
      <div id="pa-backdrop" class="fixed inset-0 z-50 bg-[#070b10]/80 backdrop-blur-sm hidden items-center justify-center p-4 opacity-0 transition-opacity duration-200">
        <form id="pa-modal" class="bg-[#161E26] border border-[#1E293B] rounded-2xl w-full max-w-lg flex flex-col overflow-hidden transform scale-95 transition-transform duration-200 max-h-[88vh]">
          
          <div class="flex items-center justify-between px-5 pt-4 pb-3">
            <h2 id="pa-title" class="text-base font-bold text-white"></h2>
            <button type="button" id="pa-close" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-[#1A2330] hover:text-white transition-colors">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>
          
          <div id="pa-step-bar" class="flex bg-[#0B1218] border-b border-[#1E293B]"></div>
          
          <div id="pa-body" class="flex-1 overflow-y-auto p-5"></div>
          
          <div id="pa-footer" class="p-4 border-t border-[#1E293B] flex gap-3"></div>
          
        </form>
      </div>`;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper.firstElementChild);

    document.getElementById('pa-close').addEventListener('click', () => this.close());
    // Click outside to close
    document.getElementById('pa-backdrop').addEventListener('click', e => {
      if (e.target.id === 'pa-backdrop') this.close();
    });
    
    // Capturar enter
    document.getElementById('pa-modal').addEventListener('submit', (e) => {
        e.preventDefault();
        this._handleNext();
    });
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  _backdropEl() { return document.getElementById('pa-backdrop'); }
  _modalEl()    { return document.getElementById('pa-modal'); }
  _bodyEl()     { return document.getElementById('pa-body'); }
  _footerEl()   { return document.getElementById('pa-footer'); }

  /* ── Render dispatcher ───────────────────────────────────── */
  _render() {
    const stepLabels = this._buildStepLabels();
    
    document.getElementById('pa-step-bar').innerHTML = stepLabels.map((l, i) => {
        const stepNum = i + 1;
        const isDone   = stepNum < this._step;
        const isActive = stepNum === this._step;
        const colorClass = isDone ? 'text-[#10B981] border-[#10B981]' : isActive ? 'text-[#3B82F6] border-[#3B82F6]' : 'text-slate-500 border-transparent';
        
        return `<div class="flex-1 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors ${colorClass}">
                  ${isDone ? '✓ ' : ''}${l}
                </div>`;
    }).join('');

    if (this._step === 1) this._renderStepProgram();
    if (this._step === 2) this._renderStepStudent();
    if (this._step === 3) this._renderStepRMs();
  }

  _buildStepLabels() {
    if (this._preProgram && this._preStudent) return ['1RMs'];
    if (this._preProgram) return ['Alumno', '1RMs'];
    if (this._preStudent) return ['Programa', '1RMs'];
    return ['Programa', 'Alumno', '1RMs'];
  }

  /* ── Step 1: Seleccionar programa ────────────────────────── */
  _renderStepProgram() {
    document.getElementById('pa-title').textContent = 'Seleccioná el programa';

    this._bodyEl().innerHTML = `
      <p class="text-xs text-slate-500 mb-4">Elegí la metodología que mejor se adapta al alumno.</p>
      <div id="pa-program-list" class="space-y-2">
        ${this.PROGRAMS.map(p => `
          <div class="pa-program-card flex items-center gap-3 p-3 rounded-xl border border-[#1E293B] bg-[#0B1218] cursor-pointer transition-colors hover:border-[#3B82F6]/50 ${this._selProgram?.id === p.id ? 'border-[#3B82F6] bg-[#3B82F6]/10' : ''}" data-pid="${p.id}">
            <span class="text-2xl w-9 text-center">${p.icon}</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-white">${p.name}</div>
              <div class="text-xs text-slate-500 mt-0.5">${p.inputs.length} cargas requeridas</div>
            </div>
            <div class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${p.color};"></div>
          </div>`).join('')}
      </div>`;

    // Event Delegation
    document.getElementById('pa-program-list').addEventListener('click', e => {
      const card = e.target.closest('.pa-program-card');
      if (!card) return;
      this._selProgram = this.PROGRAMS.find(p => p.id === card.dataset.pid);
      this._renderStepProgram(); // Re-render for selection visual state
    });

    this._renderFooter();
  }

  /* ── Step 2: Seleccionar alumno ──────────────────────────── */
  async _renderStepStudent() {
    document.getElementById('pa-title').textContent = 'Seleccioná el alumno';

    this._bodyEl().innerHTML = `
      <div class="relative mb-3">
        <span class="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[18px]">search</span>
        <input id="pa-student-search" type="text" placeholder="Buscar alumno…" class="w-full bg-[#0B1218] border border-[#1E293B] rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:border-[#3B82F6] outline-none transition-colors" autocomplete="off" />
      </div>
      <div id="pa-student-list" class="max-h-[340px] overflow-y-auto space-y-1.5 pr-1">
        <div class="text-center py-8 text-slate-500 text-xs">Cargando alumnos…</div>
      </div>`;

    // Debounce manual simple (o podés importar de tfUtils si lo pasás al constructor)
    let timeout;
    document.getElementById('pa-student-search').addEventListener('input', e => {
        clearTimeout(timeout);
        timeout = setTimeout(() => this._renderStudentList(e.target.value.toLowerCase().trim()), 300);
    });

    if (this._students.length === 0) {
      const { data } = await this.db
        .from('students')
        .select('id, full_name, email, membership_status, avatar_url')
        .eq('gym_id', this.gymId)
        .eq('membership_status', 'activa')
        .is('deleted_at', null)
        .order('full_name');
      this._students = data || [];
    }

    this._renderStudentList('');
    this._renderFooter();
  }

  _renderStudentList(query) {
    const filtered = query
      ? this._students.filter(s => s.full_name.toLowerCase().includes(query) || (s.email || '').toLowerCase().includes(query))
      : this._students;

    const statusColor = { activa:'text-[#10B981] border-[#10B981]/30 bg-[#10B981]/10', vencida:'text-[#EF4444] border-[#EF4444]/30 bg-[#EF4444]/10', suspendida:'text-[#F59E0B] border-[#F59E0B]/30 bg-[#F59E0B]/10', pendiente:'text-slate-400 border-slate-500/30 bg-slate-800' };
    
    const el = document.getElementById('pa-student-list');
    if (!el) return;

    if (filtered.length === 0) {
      el.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">Sin resultados</div>`;
      return;
    }

    el.innerHTML = filtered.map(s => {
      const initials = s.full_name.substring(0,2).toUpperCase();
      const sc = statusColor[s.membership_status] || statusColor.pendiente;
      const isSelected = this._selStudent?.id === s.id;

      return `
        <div class="pa-student-row flex items-center gap-3 p-2.5 rounded-xl border border-[#1E293B] bg-[#0B1218] cursor-pointer transition-colors hover:border-[#3B82F6]/50 ${isSelected ? 'border-[#3B82F6] bg-[#3B82F6]/10' : ''}" data-sid="${s.id}">
          <div class="w-8 h-8 rounded-full bg-[#1E293B] flex items-center justify-center text-xs font-bold text-slate-400 shrink-0 overflow-hidden">
            ${s.avatar_url ? `<img src="${s.avatar_url}" class="w-full h-full object-cover">` : initials}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-bold text-white truncate">${s.full_name}</div>
            <div class="text-[10px] text-slate-500 truncate">${s.email || ''}</div>
          </div>
          <span class="text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap uppercase tracking-wider ${sc}">${s.membership_status}</span>
        </div>`;
    }).join('');

    // Event Delegation
    el.addEventListener('click', e => {
        const row = e.target.closest('.pa-student-row');
        if (!row) return;
        this._selStudent = this._students.find(s => s.id === row.dataset.sid);
        this._renderStepStudent(); // Re-render for selection state
        document.getElementById('pa-student-search').value = query; // Maintain search term
    });
  }

  /* ── Step 3: Ingresar 1RMs ───────────────────────────────── */
  async _renderStepRMs() {
    const p = this._selProgram;
    const s = this._selStudent;
    document.getElementById('pa-title').textContent = '1RMs del alumno';

    if (Object.keys(this._rms).length === 0) {
      p.inputs.forEach(i => { this._rms[i.id] = i.default; });
    }

    const { data: activeProg } = await this.db
      .from('student_programs')
      .select('id, status, program_templates(name), started_at, current_week')
      .eq('student_id', s.id)
      .eq('status', 'activo')
      .maybeSingle();

    const warningHTML = activeProg ? `
      <div class="rounded-xl p-3 border border-amber-500/30 bg-amber-500/10 text-xs text-amber-400 mb-4 flex items-start gap-2">
        <span class="material-symbols-rounded text-[18px] shrink-0">warning</span>
        <div>
          <strong>${s.full_name}</strong> tiene el programa <strong>${activeProg.program_templates?.name || 'activo'}</strong> en curso (semana ${activeProg.current_week}).
          Al confirmar, ese programa quedará marcado como cancelado.
        </div>
      </div>` : '';

    this._bodyEl().innerHTML = `
      ${warningHTML}
      <div class="flex items-center gap-3 p-3 rounded-xl bg-[#0B1218] border border-[#1E293B] mb-4">
        <span class="text-xl">${p.icon}</span>
        <div class="flex-1">
          <div class="text-xs font-bold text-white">${p.name}</div>
          <div class="text-[11px] text-slate-500">${s.full_name}</div>
        </div>
        ${activeProg ? `<span class="text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 uppercase tracking-widest">Cambio de plan</span>` : `<span class="text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 uppercase tracking-widest">Nuevo plan</span>`}
      </div>

      <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Cargas de referencia (1RM)</p>
      <div id="pa-rm-grid" class="grid grid-cols-2 gap-3 mb-2">
        ${p.inputs.map(i => `
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">${i.label}</label>
            <div class="relative">
              <input type="number" class="pa-rm-input w-full bg-[#0B1218] border border-[#1E293B] rounded-xl pl-3 pr-8 py-2 text-sm font-bold text-white font-mono outline-none focus:border-[#3B82F6]" data-id="${i.id}" value="${this._rms[i.id] || i.default}" min="0" step="2.5" required />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 font-mono pointer-events-none">KG</span>
            </div>
          </div>`).join('')}
      </div>
      <p class="text-[10px] text-slate-500">Los pesos de cada sesión se calcularán automáticamente usando estos valores como referencia.</p>
      <p id="pa-save-error" class="text-xs text-[#EF4444] font-bold mt-2 hidden"></p>`;

    // Event Delegation
    document.getElementById('pa-rm-grid').addEventListener('input', e => {
      if(e.target.classList.contains('pa-rm-input')){
         this._rms[e.target.dataset.id] = parseFloat(e.target.value) || 0;
      }
    });

    this._renderFooter();
  }

  /* ── Footer & Navigation ─────────────────────────────────── */
  _renderFooter() {
    const footer = this._footerEl();
    const isFirstStep = this._step === 1 && !this._preProgram;
    const isLastStep  = this._step === this._totalSteps();

    let backLabel  = (isFirstStep || (this._preProgram && this._preStudent)) ? 'Cancelar' : '← Atrás';
    let nextLabel  = isLastStep ? 'Confirmar asignación ✓' : 'Siguiente →';
    let nextDisabled = false;

    if (this._step === 1 && !this._preProgram) nextDisabled = !this._selProgram;
    if (this._step === 2 && !this._preStudent) nextDisabled = !this._selStudent;

    footer.innerHTML = `
      <button type="button" id="pa-back" class="flex-1 py-2.5 rounded-xl border border-[#1E293B] text-sm font-semibold text-slate-400 hover:bg-[#1A2330] transition-colors">${backLabel}</button>
      <button type="${isLastStep ? 'submit' : 'button'}" id="pa-next" class="flex-1 py-2.5 rounded-xl bg-[#3B82F6] hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50" ${nextDisabled ? 'disabled' : ''}>${nextLabel}</button>`;

    document.getElementById('pa-back').addEventListener('click', () => {
      if (isFirstStep || (this._preProgram && this._preStudent)) this.close();
      else { this._step--; this._render(); }
    });

    if(!isLastStep) {
        document.getElementById('pa-next').addEventListener('click', () => this._handleNext());
    }
  }
  
  _handleNext() {
      if (this._step < this._totalSteps()) {
        this._step++;
        this._render();
      } else {
        this._save();
      }
  }

  _totalSteps() {
    if (this._preProgram && this._preStudent) return 1;
    if (this._preProgram || this._preStudent) return 2;
    return 3;
  }

  /* ── Save ────────────────────────────────────────────────── */
  async _save() {
    const nextBtn = document.getElementById('pa-next');
    const errEl   = document.getElementById('pa-save-error');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Guardando…'; }

    try {
      const { data: tpl } = await this.db
        .from('program_templates')
        .select('id')
        .eq('slug', this._selProgram.id)
        .single();

      if (!tpl) throw new Error('Programa no encontrado en la base de datos.');

      const { data: active } = await this.db
        .from('student_programs')
        .select('id')
        .eq('student_id', this._selStudent.id)
        .eq('status', 'activo')
        .maybeSingle();

      if (active) {
        await this.db.from('student_programs').update({
          status: 'cancelado',
          updated_at: new Date().toISOString(),
        }).eq('id', active.id);
      }

      const rmValues = {};
      this._selProgram.inputs.forEach(i => { rmValues[i.id] = this._rms[i.id] || i.default; });

      const { error } = await this.db.from('student_programs').insert({
        gym_id:      this.gymId,
        student_id:  this._selStudent.id,
        template_id: tpl.id,
        rm_values:   rmValues,
        started_at:  new Date().toISOString().split('T')[0],
        current_week: 1,
        status:      'activo',
      });

      if (error) throw error;

      this.close();
      this.onSuccess({ student: this._selStudent, program: this._selProgram, rmValues });

    } catch (err) {
      console.error(err);
      if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Confirmar asignación ✓'; }
      const msg = err.message || 'Error al guardar. Intentá de nuevo.';
      if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
      else window.tfUtils.toast(msg, 'error');
    }
  }
}

window.ProgramAssignModal = ProgramAssignModal;


