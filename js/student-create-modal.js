window.StudentCreateModal = (function () {
  let gymId = null;
  let db = null;
  let onSuccess = null;
  let currentTab = 0;
  let routinesCache = [];

  const defaultFormData = () => ({
    full_name: '',
    email: '',
    phone: '',
    birth_date: '',
    objetivo: '',
    plan: '',
    start_date: '',
    amount: '',
    payment_method: 'efectivo',
    skip_membership: false,
    routine_id: '',
    skip_program: true
  });

  let formData = defaultFormData();

  function init({ gymId: gId, db: dbClient, onSuccess: cb }) {
    gymId = gId;
    db = dbClient;
    onSuccess = cb;
    renderModal();
    bindEvents();
  }

  function renderModal() {
    if (document.getElementById('scm-modal')) return;
    const root =
      document.getElementById('student-create-modal-root') || document.body;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div id="scm-modal" class="hidden fixed inset-0 z-[80] items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="scm-title">
        <div id="scm-backdrop" class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
        <div class="relative z-10 w-full max-w-2xl rounded-2xl border border-[#1E293B] bg-[#161E26] overflow-hidden">
          <div class="px-5 py-4 border-b border-[#1E293B] flex items-center justify-between">
            <h3 id="scm-title" class="text-lg font-black text-white">Nuevo alumno</h3>
            <button id="scm-close" type="button" class="size-8 rounded-lg hover:bg-slate-800 text-slate-400">✕</button>
          </div>

          <div class="px-5 pt-4">
            <div class="grid grid-cols-3 gap-2 text-xs">
              <button type="button" class="scm-tab-btn rounded-lg border border-[#334155] py-2 font-bold text-white" data-tab="0">1. Datos</button>
              <button type="button" class="scm-tab-btn rounded-lg border border-[#1E293B] py-2 font-bold text-slate-500" data-tab="1">2. Membresía</button>
              <button type="button" class="scm-tab-btn rounded-lg border border-[#1E293B] py-2 font-bold text-slate-500" data-tab="2">3. Programa</button>
            </div>
          </div>

          <div class="p-5 space-y-4 max-h-[68vh] overflow-y-auto">
            <p id="scm-error" class="hidden text-xs font-semibold text-danger"></p>

            <section class="scm-tab-content" data-tab-content="0">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="md:col-span-2">
                  <label class="text-xs text-slate-400 font-bold uppercase">Nombre *</label>
                  <input id="scm-full-name" type="text" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white" placeholder="Ej: Juan Pérez" />
                  <p id="scm-full-name-error" class="hidden text-[11px] text-danger mt-1">El nombre es obligatorio.</p>
                </div>
                <div>
                  <label class="text-xs text-slate-400 font-bold uppercase">Email</label>
                  <input id="scm-email" type="email" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white" />
                </div>
                <div>
                  <label class="text-xs text-slate-400 font-bold uppercase">Teléfono</label>
                  <input id="scm-phone" type="tel" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white" />
                </div>
                <div>
                  <label class="text-xs text-slate-400 font-bold uppercase">Nacimiento</label>
                  <input id="scm-birth-date" type="date" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white" />
                </div>
                <div>
                  <label class="text-xs text-slate-400 font-bold uppercase">Objetivo</label>
                  <select id="scm-objetivo" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white">
                    <option value="">Sin definir</option>
                    <option value="fuerza">Fuerza</option>
                    <option value="estetica">Estética</option>
                    <option value="rendimiento">Rendimiento</option>
                    <option value="rehabilitacion">Rehabilitación</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>
            </section>

            <section class="scm-tab-content hidden" data-tab-content="1">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="text-xs text-slate-400 font-bold uppercase">Plan</label>
                  <select id="scm-plan" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white">
                    <option value="">Sin membresía</option>
                    <option value="mensual">Mensual</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
                <div>
                  <label class="text-xs text-slate-400 font-bold uppercase">Inicio</label>
                  <input id="scm-start-date" type="date" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white" />
                </div>
                <div>
                  <label class="text-xs text-slate-400 font-bold uppercase">Monto</label>
                  <input id="scm-amount" type="number" min="0" step="0.01" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white" />
                </div>
                <div>
                  <label class="text-xs text-slate-400 font-bold uppercase">Método</label>
                  <select id="scm-payment-method" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white">
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </div>
              </div>
              <button id="scm-skip-membership" type="button" class="mt-3 text-xs font-bold text-primary hover:underline">Omitir este paso</button>
            </section>

            <section class="scm-tab-content hidden" data-tab-content="2">
              <label class="text-xs text-slate-400 font-bold uppercase">Programa / rutina</label>
              <select id="scm-routine" class="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-white">
                <option value="">Sin programa asignado</option>
              </select>
              <p class="text-[11px] text-slate-500 mt-2">Podés omitir este paso y asignar una rutina después.</p>
            </section>
          </div>

          <div class="px-5 py-4 border-t border-[#1E293B] flex items-center justify-between gap-2">
            <button id="scm-prev" type="button" class="px-4 py-2 rounded-xl border border-[#334155] text-slate-300 text-sm font-semibold">Atrás</button>
            <div class="flex items-center gap-2">
              <button id="scm-next" type="button" class="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold">Siguiente</button>
              <button id="scm-submit-btn" type="button" class="hidden px-4 py-2 rounded-xl bg-success text-white text-sm font-bold">Crear Alumno</button>
            </div>
          </div>
        </div>
      </div>`;

    root.appendChild(wrapper.firstElementChild);
  }

  function bindEvents() {
    if (document.getElementById('scm-modal')?.dataset.bound === '1') return;
    document.getElementById('scm-modal').dataset.bound = '1';

    document.getElementById('scm-close')?.addEventListener('click', close);
    document.getElementById('scm-backdrop')?.addEventListener('click', close);
    document.getElementById('scm-prev')?.addEventListener('click', () => goToTab(Math.max(0, currentTab - 1)));
    document.getElementById('scm-next')?.addEventListener('click', handleNext);
    document.getElementById('scm-submit-btn')?.addEventListener('click', saveStudent);
    document.getElementById('scm-skip-membership')?.addEventListener('click', () => {
      formData.skip_membership = true;
      goToTab(2);
    });

    ['full-name', 'email', 'phone', 'birth-date', 'objetivo', 'plan', 'start-date', 'amount', 'payment-method', 'routine'].forEach((key) => {
      document.getElementById(`scm-${key}`)?.addEventListener('input', syncFormData);
      document.getElementById(`scm-${key}`)?.addEventListener('change', syncFormData);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  function syncFormData() {
    formData.full_name = document.getElementById('scm-full-name')?.value || '';
    formData.email = document.getElementById('scm-email')?.value || '';
    formData.phone = document.getElementById('scm-phone')?.value || '';
    formData.birth_date = document.getElementById('scm-birth-date')?.value || '';
    formData.objetivo = document.getElementById('scm-objetivo')?.value || '';
    formData.plan = document.getElementById('scm-plan')?.value || '';
    formData.start_date = document.getElementById('scm-start-date')?.value || '';
    formData.amount = document.getElementById('scm-amount')?.value || '';
    formData.payment_method = document.getElementById('scm-payment-method')?.value || 'efectivo';
    formData.routine_id = document.getElementById('scm-routine')?.value || '';
    formData.skip_program = !formData.routine_id;
    if (formData.plan) formData.skip_membership = false;
  }

  function setFieldError(show) {
    document.getElementById('scm-full-name-error')?.classList.toggle('hidden', !show);
    document.getElementById('scm-full-name')?.classList.toggle('border-danger', show);
  }

  function clearGlobalError() {
    const errorEl = document.getElementById('scm-error');
    if (!errorEl) return;
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }

  function showGlobalError(msg) {
    const errorEl = document.getElementById('scm-error');
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  function handleNext() {
    syncFormData();
    if (currentTab === 0) {
      const isValid = Boolean(formData.full_name.trim());
      setFieldError(!isValid);
      if (!isValid) return;
      goToTab(1);
      return;
    }
    if (currentTab === 1) {
      if (!formData.plan) formData.skip_membership = true;
      goToTab(2);
    }
  }

  async function loadRoutines() {
    if (!db || !gymId) return;
    if (!routinesCache.length) {
      const { data } = await db
        .from('routines')
        .select('id, name')
        .eq('gym_id', gymId)
        .order('name', { ascending: true });
      routinesCache = data || [];
    }

    const select = document.getElementById('scm-routine');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Sin programa asignado</option>';
    routinesCache.forEach((routine) => {
      const opt = document.createElement('option');
      opt.value = routine.id;
      opt.textContent = routine.name;
      select.appendChild(opt);
    });
    if (currentValue) select.value = currentValue;
  }

  function goToTab(index) {
    currentTab = index;

    document.querySelectorAll('.scm-tab-btn').forEach((btn, i) => {
      const isActive = i === index;
      const isDisabled = i > index;
      btn.classList.toggle('text-white', isActive);
      btn.classList.toggle('border-[#334155]', isActive);
      btn.classList.toggle('text-slate-500', !isActive);
      btn.classList.toggle('opacity-50', isDisabled);
      btn.disabled = isDisabled;
    });

    document.querySelectorAll('.scm-tab-content').forEach((tab, i) => {
      tab.classList.toggle('hidden', i !== index);
    });

    document.getElementById('scm-prev')?.classList.toggle('invisible', index === 0);
    document.getElementById('scm-next')?.classList.toggle('hidden', index === 2);
    document.getElementById('scm-submit-btn')?.classList.toggle('hidden', index !== 2);

    if (index === 2) loadRoutines();
  }

  async function saveStudent() {
    syncFormData();
    clearGlobalError();
    setFieldError(false);
    if (!formData.full_name.trim()) {
      goToTab(0);
      setFieldError(true);
      return;
    }

    const btn = document.getElementById('scm-submit-btn');
    window.tfUtils?.setBtnLoading?.(btn, true, 'Creando alumno...');

    try {
      const { data: student, error: errStudent } = await db
        .from('students')
        .insert({
          gym_id: gymId,
          full_name: formData.full_name.trim(),
          email: formData.email || null,
          phone: formData.phone || null,
          birth_date: formData.birth_date || null,
          objetivo: formData.objetivo || null,
          membership_status: formData.skip_membership ? 'pendiente' : 'activa'
        })
        .select('id')
        .single();

      if (errStudent) throw errStudent;

      if (!formData.skip_membership && formData.plan) {
        const { error: errMemb } = await db.from('memberships').insert({
          gym_id: gymId,
          student_id: student.id,
          plan: formData.plan,
          start_date: formData.start_date || new Date().toISOString().slice(0, 10),
          end_date: formData.start_date || new Date().toISOString().slice(0, 10),
          amount: Number(formData.amount) || 0,
          payment_method: formData.payment_method
        });
        if (errMemb) console.warn('Membresía no guardada:', errMemb.message || errMemb);
      }

      if (formData.routine_id) {
        const { error: errRoutine } = await db
          .from('students')
          .update({ routine_id: formData.routine_id })
          .eq('id', student.id);
        if (errRoutine) console.warn('Rutina no asignada:', errRoutine.message || errRoutine);
      }

      close();
      window.tfUtils?.toast?.('¡Alumno creado!');
      onSuccess?.({ student });
    } catch (err) {
      goToTab(0);
      showGlobalError(err?.message || 'No se pudo crear el alumno');
    } finally {
      window.tfUtils?.setBtnLoading?.(btn, false);
    }
  }

  function hydrateForm() {
    document.getElementById('scm-full-name').value = formData.full_name;
    document.getElementById('scm-email').value = formData.email;
    document.getElementById('scm-phone').value = formData.phone;
    document.getElementById('scm-birth-date').value = formData.birth_date;
    document.getElementById('scm-objetivo').value = formData.objetivo;
    document.getElementById('scm-plan').value = formData.plan;
    document.getElementById('scm-start-date').value = formData.start_date;
    document.getElementById('scm-amount').value = formData.amount;
    document.getElementById('scm-payment-method').value = formData.payment_method;
    document.getElementById('scm-routine').value = formData.routine_id;
  }

  function resetForm() {
    formData = defaultFormData();
    hydrateForm();
    setFieldError(false);
    clearGlobalError();
  }

  function open() {
    if (!document.getElementById('scm-modal')) renderModal();
    resetForm();
    goToTab(0);
    document.getElementById('scm-modal')?.classList.remove('hidden');
    document.getElementById('scm-modal')?.classList.add('flex');
  }

  function close() {
    document.getElementById('scm-modal')?.classList.add('hidden');
    document.getElementById('scm-modal')?.classList.remove('flex');
  }

  return { init, open, close };
})();
