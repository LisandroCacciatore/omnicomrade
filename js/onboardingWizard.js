/**
 * Onboarding Wizard - 3-step unified onboarding flow
 * Replaces separate modals (student + membership) with single wizard
 *
 * Usage: window.onboardingWizard.open()
 */

class OnboardingWizard {
  constructor() {
    this._currentStep = 1;
    this._data = {
      student: null,
      membership: null,
      program: null
    };
    this._el = null;
    this._inject();
  }

  get STEPS() {
    return [
      { id: 1, title: 'Alumno', icon: 'person_add' },
      { id: 2, title: 'Membresía', icon: 'card_membership' },
      { id: 3, title: 'Programa', icon: 'fitness_center' }
    ];
  }

  open() {
    this._currentStep = 1;
    this._data = { student: null, membership: null, program: null };
    this._backdropEl().classList.remove('hidden');
    this._render();
    setTimeout(() => {
      this._backdropEl().classList.remove('opacity-0');
      this._modalEl().classList.remove('opacity-0', 'scale-95');
    }, 10);
  }

  close() {
    this._backdropEl().classList.add('opacity-0');
    this._modalEl().classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
      this._backdropEl().classList.add('hidden');
      this._resetForm();
    }, 200);
  }

  _resetForm() {
    this._currentStep = 1;
    this._data = { student: null, membership: null, program: null };
  }

  /* ── DOM ───────────────────────────────────────────────── */
  _inject() {
    if (document.getElementById('ow-backdrop')) return;

    const html = `
      <div id="ow-backdrop" class="fixed inset-0 z-50 bg-[#070b10]/80 backdrop-blur-sm hidden items-center justify-center p-4 opacity-0 transition-all duration-200">
        <div id="ow-modal" class="bg-[#161E26] border border-[#1E293B] rounded-2xl w-full max-w-lg flex flex-col overflow-hidden opacity-0 scale-95 transition-all duration-200 max-h-[90vh]">
          
          <!-- Header con stepper -->
          <div class="px-6 pt-5 pb-4 border-b border-[#1E293B]">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-black text-white">Nuevo Alumno</h2>
              <button type="button" id="ow-close" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-[#1A2330] hover:text-white transition-colors">
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>
            
            <!-- Stepper -->
            <div id="ow-stepper" class="flex items-center justify-between"></div>
          </div>

          <!-- Body -->
          <div id="ow-body" class="flex-1 overflow-y-auto p-6"></div>

          <!-- Footer -->
          <div id="ow-footer" class="p-4 border-t border-[#1E293B] flex gap-3"></div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('ow-close').addEventListener('click', () => this.close());
    document.getElementById('ow-backdrop').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.close();
    });
  }

  _backdropEl() {
    return document.getElementById('ow-backdrop');
  }
  _modalEl() {
    return document.getElementById('ow-modal');
  }
  _stepperEl() {
    return document.getElementById('ow-stepper');
  }
  _bodyEl() {
    return document.getElementById('ow-body');
  }
  _footerEl() {
    return document.getElementById('ow-footer');
  }

  /* ── Render ────────────────────────────────────────────── */
  _render() {
    this._renderStepper();
    this._renderBody();
    this._renderFooter();
  }

  _renderStepper() {
    const stepper = this._stepperEl();
    stepper.innerHTML = this.STEPS.map((step, idx) => {
      const isActive = step.id === this._currentStep;
      const isCompleted = step.id < this._currentStep;
      const isLast = idx === this.STEPS.length - 1;

      return `
        <div class="flex items-center flex-1 ${isLast ? '' : 'pr-2'}">
          <div class="flex flex-col items-center flex-1 min-w-0 text-center">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${isActive ? 'bg-primary text-white' : ''}
              ${isCompleted ? 'bg-success text-white' : ''}
              ${!isActive && !isCompleted ? 'bg-slate-800 text-slate-500' : ''}">
              ${
                isCompleted
                  ? '<span class="material-symbols-rounded text-[16px] leading-none">check</span>'
                  : `<span class="leading-none">${step.id}</span>`
              }
            </div>
            <span class="text-[10px] mt-1 font-medium leading-none ${isActive ? 'text-primary' : 'text-slate-500'}">${step.title}</span>
          </div>
          ${!isLast ? `<div class="h-0.5 w-full mx-2 ${isCompleted ? 'bg-success' : 'bg-slate-800'}"></div>` : ''}
        </div>`;
    }).join('');
  }

  _renderBody() {
    const body = this._bodyEl();

    switch (this._currentStep) {
      case 1:
        body.innerHTML = this._renderStepStudent();
        this._bindStepStudent();
        break;
      case 2:
        body.innerHTML = this._renderStepMembership();
        this._bindStepMembership();
        break;
      case 3:
        body.innerHTML = this._renderStepProgram();
        this._bindStepProgram();
        break;
    }
  }

  _renderStepStudent() {
    const d = this._data.student || {};
    return `
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400">Nombre completo *</label>
          <input type="text" id="ow-student-name" value="${d.full_name || ''}"
            class="bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-primary text-white py-3 px-4 transition-all"
            placeholder="Ej: Juan Pérez" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400">Email</label>
          <input type="email" id="ow-student-email" value="${d.email || ''}"
            class="bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-primary text-white py-3 px-4 transition-all"
            placeholder="juan@email.com" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400">Teléfono</label>
          <input type="tel" id="ow-student-phone" value="${d.phone || ''}"
            class="bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-primary text-white py-3 px-4 transition-all"
            placeholder="+54 11 1234-5678" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400">Fecha de nacimiento</label>
          <input type="date" id="ow-student-birth" value="${d.birth_date || ''}"
            class="bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-primary text-white py-3 px-4 transition-all" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400">Objetivo</label>
          <select id="ow-student-objetivo" class="bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-primary text-white py-3 px-4 transition-all">
            <option value="general" ${(d.objetivo || 'general') === 'general' ? 'selected' : ''}>General</option>
            <option value="fuerza" ${d.objetivo === 'fuerza' ? 'selected' : ''}>Fuerza</option>
            <option value="estetica" ${d.objetivo === 'estetica' ? 'selected' : ''}>Estética</option>
            <option value="rendimiento" ${d.objetivo === 'rendimiento' ? 'selected' : ''}>Rendimiento</option>
            <option value="rehabilitacion" ${d.objetivo === 'rehabilitacion' ? 'selected' : ''}>Rehabilitación</option>
          </select>
        </div>
        <div id="ow-student-error" class="hidden text-danger text-xs font-bold bg-danger/10 p-3 rounded-lg border border-danger/20"></div>
      </div>`;
  }

  _renderStepMembership() {
    const d = this._data.membership || {};
    const plans = [
      { value: 'mensual', label: 'Mensual', desc: '30 días' },
      { value: 'trimestral', label: 'Trimestral', desc: '90 días' },
      { value: 'anual', label: 'Anual', desc: '365 días' }
    ];

    return `
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400">Plan *</label>
          <div class="grid grid-cols-3 gap-2">
            ${plans
              .map(
                (p) => `
              <button type="button" data-plan="${p.value}" 
                class="ow-plan-btn border border-slate-800 rounded-xl py-3 text-xs font-bold hover:border-primary transition-all
                  ${(d.plan || '') === p.value ? 'border-primary bg-primary/10 text-primary' : ''}">
                ${p.label}<br><span class="text-slate-500 font-normal">${p.desc}</span>
              </button>
            `
              )
              .join('')}
          </div>
          <input type="hidden" id="ow-membresia-plan" value="${d.plan || ''}" />
        </div>
        
        <div class="flex flex-col gap-1">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400">Fecha de inicio *</label>
          <input type="date" id="ow-membresia-start" value="${d.start_date || new Date().toISOString().split('T')[0]}"
            class="bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-primary text-white py-3 px-4 transition-all" />
        </div>
        
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-400">Monto *</label>
            <input type="number" id="ow-membresia-amount" value="${d.amount || ''}" min="0" step="0.01"
              class="bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-primary text-white py-3 px-4 transition-all"
              placeholder="0.00" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-400">Método</label>
            <select id="ow-membresia-method" class="bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-primary text-white py-3 px-4 transition-all">
              <option value="efectivo" ${(d.payment_method || 'efectivo') === 'efectivo' ? 'selected' : ''}>Efectivo</option>
              <option value="transferencia" ${d.payment_method === 'transferencia' ? 'selected' : ''}>Transferencia</option>
            </select>
          </div>
        </div>
        
        <div class="flex flex-col gap-1">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400">Notas</label>
          <textarea id="ow-membresia-notes" rows="2"
            class="bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-primary text-white py-3 px-4 transition-all resize-none"
            placeholder="Observaciones...">${d.notes || ''}</textarea>
        </div>
        
        <button type="button" id="ow-skip-membership" class="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          Omitir este paso →
        </button>
        
        <div id="ow-membresia-error" class="hidden text-danger text-xs font-bold bg-danger/10 p-3 rounded-lg border border-danger/20"></div>
      </div>`;
  }

  _renderStepProgram() {
    const programs = window.tfUtils?.PROGRAMS || [];
    const d = this._data.program || {};
    const meta = {
      'starting-strength': { icon: '🚂', level: 'Principiante · 3 días/sem', color: '#10B981' },
      'stronglifts-5x5': { icon: '🏗️', level: 'Principiante · 3 días/sem', color: '#F97316' },
      gzclp: { icon: '⚡', level: 'Principiante / Intermedio · 4 días/sem', color: '#8B5CF6' },
      'wendler-531': { icon: '📈', level: 'Intermedio · 4 días/sem', color: '#3B82F6' },
      'cube-method': { icon: '🧊', level: 'Intermedio / Avanzado · 3 días/sem', color: '#06B6D4' },
      ppl: { icon: '🔄', level: 'Intermedio · 6 días/sem', color: '#EC4899' }
    };

    return `
      <div class="flex flex-col gap-4">
        <p class="text-sm text-slate-400">Asigná un programa de entrenamiento al nuevo alumno (opcional).</p>
        
        <div id="ow-program-list" class="space-y-2">
          ${programs
            .map(
              (p) => `
            <div class="ow-program-card flex items-center gap-3 p-3 rounded-xl border border-[#1E293B] bg-[#0B1218] cursor-pointer transition-colors hover:border-[#3B82F6]/50
              ${(d.template_id || '') === p.id ? 'border-primary bg-primary/10' : ''}"
              data-pid="${p.id}"
              role="button"
              tabindex="0"
              aria-pressed="${(d.template_id || '') === p.id ? 'true' : 'false'}">
              <span class="text-2xl w-9 text-center">${meta[p.id]?.icon || '🏋️'}</span>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-white text-sm">${p.name}</div>
                <div class="text-xs text-slate-500 mt-0.5">${meta[p.id]?.level || p.description || 'Programa disponible'}</div>
              </div>
              <div class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${meta[p.id]?.color || '#64748B'};"></div>
            </div>
          `
            )
            .join('')}
        </div>
        
        ${programs.length === 0 ? '<p class="text-sm text-slate-500">No hay programas disponibles</p>' : ''}
        
        <button type="button" id="ow-skip-program" class="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          Omitir este paso →
        </button>
        
        <div id="ow-program-error" class="hidden text-danger text-xs font-bold bg-danger/10 p-3 rounded-lg border border-danger/20"></div>
      </div>`;
  }

  _renderFooter() {
    const footer = this._footerEl();
    const isFirst = this._currentStep === 1;
    const isLast = this._currentStep === 3;

    footer.innerHTML = `
      ${
        !isFirst
          ? `
        <button type="button" id="ow-prev" class="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 transition-colors">
          Atrás
        </button>
      `
          : '<div></div>'
      }
      
      <button type="button" id="ow-next" class="flex-1 px-4 py-2 rounded-xl bg-primary text-white font-bold hover:bg-blue-600 transition-colors">
        ${isLast ? 'Completar' : 'Continuar'}
      </button>
    `;

    document.getElementById('ow-next')?.addEventListener('click', () => this._handleNext());
    document.getElementById('ow-prev')?.addEventListener('click', () => this._handlePrev());
  }

  /* ── Bind Events ───────────────────────────────────────── */
  _bindStepStudent() {
    // Validation handled in _handleNext
  }

  _bindStepMembership() {
    document.querySelectorAll('.ow-plan-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document
          .querySelectorAll('.ow-plan-btn')
          .forEach((b) => b.classList.remove('border-primary', 'bg-primary/10', 'text-primary'));
        btn.classList.add('border-primary', 'bg-primary/10', 'text-primary');
        document.getElementById('ow-membresia-plan').value = btn.dataset.plan;
      });
    });

    document.getElementById('ow-skip-membership')?.addEventListener('click', () => {
      this._data.membership = null;
      this._currentStep = 3;
      this._render();
    });
  }

  _bindStepProgram() {
    document.querySelectorAll('.ow-program-card').forEach((card) => {
      const selectCard = () => {
        document.querySelectorAll('.ow-program-card').forEach((c) => {
          c.classList.remove('border-primary', 'bg-primary/10');
          c.setAttribute('aria-pressed', 'false');
        });
        card.classList.add('border-primary', 'bg-primary/10');
        card.setAttribute('aria-pressed', 'true');
        this._data.program = { template_id: card.dataset.pid };
      };

      card.addEventListener('click', selectCard);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectCard();
        }
      });
    });

    document.getElementById('ow-skip-program')?.addEventListener('click', () => {
      this._data.program = null;
      this._submit();
    });
  }

  /* ── Handlers ───────────────────────────────────────────── */
  _handleNext() {
    const errorEl = document.getElementById(
      `ow-${this._currentStep === 1 ? 'student' : this._currentStep === 2 ? 'membresia' : 'program'}-error`
    );

    if (this._currentStep === 1) {
      const name = document.getElementById('ow-student-name').value.trim();
      if (!name) {
        if (errorEl) {
          errorEl.textContent = 'El nombre es obligatorio';
          errorEl.classList.remove('hidden');
        }
        return;
      }

      this._data.student = {
        full_name: name,
        email: document.getElementById('ow-student-email').value.trim(),
        phone: document.getElementById('ow-student-phone').value.trim(),
        birth_date: document.getElementById('ow-student-birth').value || null,
        objetivo: document.getElementById('ow-student-objetivo').value
      };
    }

    if (this._currentStep === 2) {
      const plan = document.getElementById('ow-membresia-plan').value;
      const startDate = document.getElementById('ow-membresia-start').value;
      const amount = document.getElementById('ow-membresia-amount').value;

      if (plan && (!startDate || !amount)) {
        if (errorEl) {
          errorEl.textContent = 'Fecha de inicio y monto son obligatorios';
          errorEl.classList.remove('hidden');
        }
        return;
      }

      if (plan) {
        this._data.membership = {
          plan,
          start_date: startDate,
          amount: parseFloat(amount),
          payment_method: document.getElementById('ow-membresia-method').value,
          notes: document.getElementById('ow-membresia-notes').value.trim()
        };
      }
    }

    if (this._currentStep === 3) {
      if (!this._data.program?.template_id) {
        this._data.program = null;
      }
    }

    if (errorEl) errorEl.classList.add('hidden');

    if (this._currentStep < 3) {
      this._currentStep++;
      this._render();
    } else {
      this._submit();
    }
  }

  _handlePrev() {
    if (this._currentStep > 1) {
      this._currentStep--;
      this._render();
    }
  }

  async _submit() {
    const btn = document.getElementById('ow-next');
    const skipBtn = document.getElementById('ow-skip-program');
    const originalText = btn?.textContent || 'Completar';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="animate-spin mr-2">⟳</span> Guardando...';
    }
    if (skipBtn) skipBtn.disabled = true;

    try {
      const gymId = window.gymId || localStorage.getItem('gym_id');
      if (!gymId) {
        throw new Error('No se encontró gym_id para completar el onboarding');
      }
      const requestId = crypto.randomUUID();

      const payload = {
        request_id: requestId,
        gym_id: gymId,
        student: this._data.student,
        membership: this._data.membership || undefined,
        program: this._data.program?.template_id
          ? { template_id: this._data.program.template_id }
          : undefined
      };

      const result = await this._submitWithFallback(payload);

      window.tfUtils?.toast?.('Alumno creado exitosamente');

      if (typeof window.loadKPIs === 'function') window.loadKPIs();
      if (typeof window.loadRecentStudents === 'function') window.loadRecentStudents();
      window.dispatchEvent(new CustomEvent('onboarding:completed', { detail: result }));

      this.close();
    } catch (err) {
      console.error('Onboarding error:', err);
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
      if (skipBtn) skipBtn.disabled = false;
      window.tfUtils?.toast?.(err.message || 'Error al guardar', 'error');
    }
  }

  async _submitWithFallback(payload) {
    try {
      return await this._submitViaApi(payload);
    } catch (apiErr) {
      const fallbackable =
        apiErr?.status === 404 ||
        apiErr?.code === 'INVALID_JSON_RESPONSE' ||
        apiErr?.message?.includes('Failed to fetch');
      if (!fallbackable) throw apiErr;
      return this._submitViaSupabase(payload);
    }
  }

  async _submitViaApi(payload) {
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      const err = new Error('El endpoint /api/onboarding no está disponible en este entorno');
      err.code = 'INVALID_JSON_RESPONSE';
      err.status = res.status;
      err.raw = text?.slice(0, 120);
      throw err;
    }

    const result = await res.json();
    if (!res.ok) {
      const err = new Error(result.message || 'Error en el onboarding');
      err.status = res.status;
      throw err;
    }
    return result;
  }

  async _submitViaSupabase(payload) {
    const db = window.supabaseClient;
    if (!db) throw new Error('No hay cliente de base de datos disponible para fallback');

    const { data: studentRow, error: studentErr } = await db
      .from('students')
      .insert({
        gym_id: payload.gym_id,
        full_name: payload.student?.full_name,
        email: payload.student?.email || null,
        phone: payload.student?.phone || null,
        birth_date: payload.student?.birth_date || null,
        objetivo: payload.student?.objetivo || 'general',
        membership_status: payload.membership ? 'activa' : 'pendiente'
      })
      .select('id')
      .single();
    if (studentErr) throw new Error(studentErr.message || 'No se pudo crear el alumno');

    let membershipId = null;
    if (payload.membership) {
      const endDate = this._calculateEndDate(payload.membership.start_date, payload.membership.plan);
      const { data: membershipRow, error: membershipErr } = await db
        .from('memberships')
        .insert({
          gym_id: payload.gym_id,
          student_id: studentRow.id,
          plan: payload.membership.plan,
          amount: payload.membership.amount,
          payment_method: payload.membership.payment_method || 'efectivo',
          start_date: payload.membership.start_date,
          end_date: endDate,
          notes: payload.membership.notes || null
        })
        .select('id')
        .single();
      if (membershipErr) throw new Error(membershipErr.message || 'No se pudo crear la membresía');
      membershipId = membershipRow.id;
    }

    let programId = null;
    if (payload.program?.template_id) {
      const { data: programRow, error: programErr } = await db
        .from('student_programs')
        .insert({
          gym_id: payload.gym_id,
          student_id: studentRow.id,
          template_id: payload.program.template_id,
          rm_values: {},
          started_at: new Date().toISOString().split('T')[0],
          status: 'activo'
        })
        .select('id')
        .single();
      if (!programErr && programRow?.id) {
        programId = programRow.id;
      }
    }

    return {
      success: true,
      student_id: studentRow.id,
      membership_id: membershipId,
      program_id: programId,
      source: 'supabase_fallback'
    };
  }

  _calculateEndDate(startDate, plan) {
    if (!startDate) return null;
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return null;
    if (plan === 'trimestral') start.setMonth(start.getMonth() + 3);
    else if (plan === 'anual') start.setFullYear(start.getFullYear() + 1);
    else start.setMonth(start.getMonth() + 1);
    return start.toISOString().split('T')[0];
  }
}

window.onboardingWizard = new OnboardingWizard();
