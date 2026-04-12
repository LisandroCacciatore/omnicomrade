/**
 * js/onboarding.js
 * TechFitness — Lógica del Wizard de Onboarding
 */

(function () {
  let currentStep = 1;
  let gymId = null;
  let authUserId = null;
  let studentId = null;
  let selectedProgramId = null;
  let supabase = null;

  const { toast, setBtnLoading } = window.tfUiUtils;

  // ─── INIT ─────────────────────────────────────────────────
  async function init() {
    const ctx = await window.authGuard(['gim_admin']);
    if (!ctx) return;
    const { gymId, userId: authUserId } = ctx;

    supabase = window.supabaseClient;

    await resumeProgress();
    setupEventListeners();
    updateValidation(1);

    // Step 4: Load programs from engine
    renderPrograms();
  }

  /**
   * Intenta reanudar el progreso basado en datos existentes.
   */
  async function resumeProgress() {
    try {
      const { data: gym } = await supabase.from('gyms').select('*').eq('id', gymId).single();
      const { data: students } = await supabase
        .from('students')
        .select('id, full_name, membership_status')
        .eq('gym_id', gymId)
        .order('created_at', { ascending: false })
        .limit(1);

      const latestStudent = students?.[0];

      if (latestStudent) {
        studentId = latestStudent.id;
        document.getElementById('student-name').value = latestStudent.full_name;
        document.getElementById('membership-student-preview').textContent = latestStudent.full_name;
        document.getElementById('summary-name').textContent = latestStudent.full_name;

        const { data: membership } = await supabase
          .from('memberships')
          .select('id, plan, amount')
          .eq('student_id', studentId)
          .maybeSingle();

        if (membership) {
          document.getElementById('summary-plan').textContent = membership.plan;
          document.getElementById('summary-amount').textContent = membership.amount;

          const { data: program } = await supabase
            .from('student_programs')
            .select('id')
            .eq('student_id', studentId)
            .maybeSingle();

          if (program)
            goStep(4); // Si ya tiene programa, está en el último paso
          else goStep(3); // Tiene membresía pero no programa
        } else {
          goStep(2); // Tiene atleta pero no membresía
        }
      } else if (gym.name !== 'Mi Gimnasio' || gym.logo_url) {
        // Si cambió el nombre pero no tiene atletas, asumimos paso 2
        goStep(2);
      }

      // Update Step 1 View with DB data
      document.getElementById('gym-name').value = gym.name;
      document.getElementById('preview-gym-name').textContent = gym.name;
      if (gym.logo_url) {
        updateLogoPreview(gym.logo_url);
      }
    } catch (err) {
      console.warn('No se pudo reanudar el progreso:', err);
    }
  }

  // ─── NAVIGATION ──────────────────────────────────────────

  function goStep(n) {
    if (n > 4) {
      showCelebration();
      return;
    }

    currentStep = n;
    document.querySelectorAll('.wizard-step').forEach((s) => s.classList.add('hidden'));
    document.getElementById(`step-${n}`).classList.remove('hidden');

    // Update Progress Bar
    document.querySelectorAll('#onboarding-nav [data-step]').forEach((el) => {
      const stepNum = parseInt(el.dataset.step);
      const circle = el.querySelector('.step-circle');
      const text = el.querySelector('span');

      if (stepNum < n) {
        circle.className =
          'step-circle w-10 h-10 rounded-full border-2 border-success flex items-center justify-center font-bold font-mono text-success';
        circle.innerHTML = '<span class="material-symbols-rounded text-sm">check</span>';
        text.className = 'text-[10px] uppercase tracking-widest font-bold text-success';
      } else if (stepNum === n) {
        circle.className =
          'step-circle w-10 h-10 rounded-full border-2 border-primary flex items-center justify-center font-bold font-mono text-white ring-4 ring-primary/10';
        circle.textContent = stepNum;
        text.className = 'text-[10px] uppercase tracking-widest font-bold text-primary';
      } else {
        circle.className =
          'step-circle w-10 h-10 rounded-full border-2 border-slate-800 flex items-center justify-center font-bold font-mono text-slate-700 opacity-30';
        circle.textContent = stepNum;
        text.className =
          'text-[10px] uppercase tracking-widest font-bold text-slate-700 opacity-30';
      }
    });

    updateValidation(n);
  }

  function updateValidation(n) {
    const btn = document.getElementById(`btn-next-${n}`);
    if (!btn) return;

    const validate = () => {
      let isValid = false;
      if (n === 1) isValid = !!document.getElementById('gym-name').value.trim();
      if (n === 2)
        isValid =
          !!document.getElementById('student-name').value.trim() &&
          !!document.getElementById('student-email').value.trim();
      if (n === 3) isValid = !!document.getElementById('membership-amount').value;

      btn.disabled = !isValid;
    };

    // Listeners for real-time validation
    const inputs = document.querySelectorAll(`#step-${n} input, #step-${n} select`);
    inputs.forEach((i) => (i.oninput = validate));
    validate();
  }

  // ─── STEP ACTIONS ────────────────────────────────────────

  async function handleStep1() {
    const name = document.getElementById('gym-name').value.trim();
    const color = document.getElementById('preview-color-code').textContent;
    const logoFile = document.getElementById('gym-logo').files[0];
    const btn = document.getElementById('btn-next-1');

    setBtnLoading(btn, true);
    try {
      let logoUrl = null;
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${gymId}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('gym-logos')
          .upload(fileName, logoFile);

        if (uploadError) throw uploadError;
        const {
          data: { publicUrl }
        } = supabase.storage.from('gym-logos').getPublicUrl(fileName);
        logoUrl = publicUrl;
      }

      const updates = { name, primary_color: color };
      if (logoUrl) updates.logo_url = logoUrl;

      const { error } = await supabase.from('gyms').update(updates).eq('id', gymId);
      if (error) throw error;

      goStep(2);
    } catch (err) {
      toast('Error al guardar gimnasio: ' + err.message, 'error');
    } finally {
      setBtnLoading(btn, false);
    }
  }

  async function handleStep2() {
    const name = document.getElementById('student-name').value.trim();
    const email = document.getElementById('student-email').value.trim();
    const phone = document.getElementById('student-phone').value.trim();
    const goal = document.getElementById('student-goal').value;
    const btn = document.getElementById('btn-next-2');

    setBtnLoading(btn, true);
    try {
      const { data, error } = await supabase
        .from('students')
        .insert({
          gym_id: gymId,
          full_name: name,
          email,
          phone,
          objetivo: goal,
          membership_status: 'pendiente'
        })
        .select()
        .single();

      if (error) throw error;

      studentId = data.id;
      document.getElementById('membership-student-preview').textContent = name;
      document.getElementById('summary-name').textContent = name;
      document.getElementById('summary-goal').textContent = goal.replace('_', ' ');

      goStep(3);
    } catch (err) {
      toast('Error al crear atleta: ' + err.message, 'error');
    } finally {
      setBtnLoading(btn, false);
    }
  }

  async function handleStep3() {
    const plan = document.getElementById('membership-plan').value;
    const amount = parseFloat(document.getElementById('membership-amount').value);
    const method = document.getElementById('membership-method').value;
    const startDate =
      document.getElementById('membership-date').value || new Date().toISOString().split('T')[0];
    const btn = document.getElementById('btn-next-3');

    setBtnLoading(btn, true);
    try {
      const { error } = await supabase.from('memberships').insert({
        gym_id: gymId,
        student_id: studentId,
        plan,
        amount,
        payment_method: method,
        start_date: startDate
      });

      if (error) throw error;

      document.getElementById('summary-plan').textContent = plan;
      document.getElementById('summary-amount').textContent = amount;

      goStep(4);
    } catch (err) {
      toast('Error al registrar membresía: ' + err.message, 'error');
    } finally {
      setBtnLoading(btn, false);
    }
  }

  async function finishOnboarding() {
    const btn = document.getElementById('btn-finish');
    setBtnLoading(btn, true, 'Generando rutina...');

    try {
      // 1. Recolectar RMs
      const rms = {};
      document.querySelectorAll('.rm-input').forEach((input) => {
        rms[input.dataset.exercise] = parseFloat(input.value) || 0;
      });

      // 2. Insertar Student Program
      const { data: progData, error: progErr } = await supabase
        .from('student_programs')
        .insert({
          student_id: studentId,
          gym_id: gymId,
          program_id: selectedProgramId,
          status: 'active',
          rm_values: rms
        })
        .select()
        .single();

      if (progErr) throw progErr;

      // 3. Generar Rutina usando el Motor
      const weeks = window.tfTrainingEngine.generateProgram(selectedProgramId, rms);

      // Upsert de la rutina (una por semana/fase)
      for (const week of weeks) {
        await supabase.from('routines').insert({
          gym_id: gymId,
          name: `${week.label} - ${week.phase}`,
          source_program: selectedProgramId,
          student_program_id: progData.id,
          data: week // Guardamos el JSON completo generado
        });
      }

      // 4. Marcar Onboarding como completado
      await supabase.from('gyms').update({ onboarding_completed: true }).eq('id', gymId);

      document.getElementById('summary-program').textContent = selectedProgramId.replace('-', ' ');
      goStep(5); // Show celebration
    } catch (err) {
      toast('Error finalizando: ' + err.message, 'error');
    } finally {
      setBtnLoading(btn, false);
    }
  }

  async function skipOnboarding() {
    if (
      !confirm(
        '¿Estás seguro de saltar el onboarding? Podrás configurar todo luego desde el dashboard.'
      )
    )
      return;
    try {
      await supabase.from('gyms').update({ onboarding_completed: true }).eq('id', gymId);
      window.location.href = 'admin-dashboard.html';
    } catch (err) {
      toast('Error al saltar', 'error');
    }
  }

  // ─── RENDERING & UI ──────────────────────────────────────

  function renderPrograms() {
    const grid = document.getElementById('program-grid');
    const programs = window.tfTrainingEngine.PROGRAMS;

    grid.innerHTML = programs
      .map(
        (p) => `
      <div class="program-card glass-panel rounded-2xl p-6 cursor-pointer hover:border-primary/50 transition-all group" data-id="${p.id}">
        <div class="flex items-start justify-between mb-4">
           <span class="text-3xl">${p.icon}</span>
           <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 group-hover:text-primary transition-colors">${p.level}</span>
        </div>
        <h4 class="font-display font-bold text-lg mb-1">${p.name}</h4>
        <p class="text-xs text-slate-500 line-clamp-2">${p.description}</p>
      </div>
    `
      )
      .join('');

    grid.querySelectorAll('.program-card').forEach((card) => {
      card.onclick = () => selectProgram(card.dataset.id);
    });
  }

  function selectProgram(id) {
    selectedProgramId = id;
    document.querySelectorAll('.program-card').forEach((c) => {
      c.classList.remove('ring-2', 'ring-primary', 'bg-primary/5', 'border-primary');
    });
    const selected = document.querySelector(`.program-card[data-id="${id}"]`);
    selected.classList.add('ring-2', 'ring-primary', 'bg-primary/5', 'border-primary');

    const program = window.tfTrainingEngine.PROGRAMS.find((p) => p.id === id);
    document.getElementById('selected-program-tag').textContent = program.name;

    // Render 1RM Inputs
    const inputsGrid = document.getElementById('rms-inputs-grid');
    inputsGrid.innerHTML = program.inputs
      .map(
        (inp) => `
      <div class="space-y-1">
        <label class="text-[10px] font-bold text-slate-500 uppercase">${inp.label}</label>
        <div class="relative">
            <input type="number" step="2.5" value="${inp.default}" data-exercise="${inp.id}" class="rm-input w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:border-primary outline-none">
            <span class="absolute right-3 top-2 text-[10px] text-slate-600">kg</span>
        </div>
      </div>
    `
      )
      .join('');

    document.getElementById('rms-container').classList.remove('hidden');
    document.getElementById('rms-container').scrollIntoView({ behavior: 'smooth' });
  }

  function updateLogoPreview(url) {
    const circle = document.getElementById('preview-logo-circle');
    circle.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
  }

  function setupEventListeners() {
    // Step 1: Real-time preview
    document.getElementById('gym-name').oninput = (e) => {
      document.getElementById('preview-gym-name').textContent = e.target.value || 'Tu Gimnasio';
    };

    document.getElementById('color-presets').onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const color = btn.dataset.color;
      document.getElementById('preview-accent-bar').style.backgroundColor = color;
      document.getElementById('preview-color-code').textContent = color;

      // Update rings
      document
        .querySelectorAll('#color-presets button')
        .forEach((b) =>
          b.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-surface-base')
        );
      btn.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-surface-base');
    };

    document.getElementById('gym-logo').onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        document.getElementById('logo-filename').textContent = file.name;
        const reader = new FileReader();
        reader.onload = (ev) => updateLogoPreview(ev.target.result);
        reader.readAsDataURL(file);
      }
    };

    // Buttons
    document.getElementById('btn-next-1').onclick = handleStep1;
    document.getElementById('btn-next-2').onclick = handleStep2;
    document.getElementById('btn-next-3').onclick = handleStep3;
    document.getElementById('btn-finish').onclick = finishOnboarding;

    document.querySelectorAll('.btn-skip').forEach((b) => (b.onclick = skipOnboarding));
    document.getElementById('btn-skip-students').onclick = () => goStep(4);

    // Initial Date
    document.getElementById('membership-date').value = new Date().toISOString().split('T')[0];
  }

  function showCelebration() {
    document.querySelectorAll('.wizard-step').forEach((s) => s.classList.add('hidden'));
    document.getElementById('celebration').classList.remove('hidden');
    document.getElementById('onboarding-nav').classList.add('hidden');
  }

  // Start
  document.addEventListener('DOMContentLoaded', init);
})();
