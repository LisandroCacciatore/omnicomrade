/**
 * gym-setting.js
 * TechFitness — Configuración del gimnasio y perfil del admin
 * REFACTORIZADO: Forms nativos, utils.js, optimización.
 */

(async () => {
  /* ─── Auth guard ─────────────────────────────────────────── */
  const ctx = await window.authGuard(['gim_admin']);
  if (!ctx) return;

  const { gymId, userId, email } = ctx;
  const db = window.supabaseClient;
  const user = { id: userId, email };

  /* ─── State ──────────────────────────────────────────────── */
  let logoFile = null;
  let avatarFile = null;
  let selectedColor = '#3B82F6';
  let notifSaveTimer = null;
  const NOTIF_DEFAULTS = {
    notify_membership_expiring: true,
    notify_student_inactive: true,
    notify_weekly_summary: true,
    notify_new_program: true,
    notify_unread_messages: true
  };

  /* ─── Tab routing ─────────────────────────────────────────── */
  document.querySelectorAll('.settings-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  /* ─── Load gym data ──────────────────────────────────────── */
  async function loadGym() {
    const { data, error } = await db
      .from('gyms')
      .select('id, name, slug, logo_url, color, plan')
      .eq('id', gymId)
      .single();

    if (error || !data) {
      window.tfUiUtils.toast('Error al cargar datos del gimnasio', 'error');
      return;
    }

    // Populate fields
    document.getElementById('gym-name').value = data.name || '';
    document.getElementById('gym-slug').value = data.slug || '';
    document.getElementById('sidebar-gym-name').textContent = data.name || 'TechFitness';

    // Logo
    if (data.logo_url) {
      const img = document.getElementById('logo-preview-img');
      // FIXED: XSS sanitization
      img.src = window.tfUiUtils.escHtml(data.logo_url);
      img.classList.remove('hidden');
      document.getElementById('logo-placeholder-icon').classList.add('hidden');

      // Sidebar
      const sidebarIcon = document.getElementById('sidebar-logo-icon');
      // FIXED: XSS sanitization
      sidebarIcon.innerHTML = `<img src="${window.tfUiUtils.escHtml(data.logo_url)}" class="w-full h-full object-contain rounded-lg" alt="Logo" />`;
    }

    // Color
    const color = data.color || '#3B82F6';
    setColor(color);

    // Plan badge
    const planBadge = document.getElementById('current-plan-badge');
    if (data.plan === 'premium') {
      planBadge.className = 'plan-badge plan-premium';
      planBadge.innerHTML = `<span class="material-symbols-rounded text-[13px]" style="font-variation-settings:'FILL' 1">workspace_premium</span> Premium`;
    } else {
      planBadge.className = 'plan-badge plan-free';
      planBadge.innerHTML = `<span class="material-symbols-rounded text-[13px]" style="font-variation-settings:'FILL' 1">star</span> Free`;
    }
  }

  /* ─── Load profile ───────────────────────────────────────── */
  async function loadProfile() {
    const { data, error } = await db
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      window.tfUiUtils.toast('Error al cargar perfil', 'error');
      return;
    }

    document.getElementById('profile-name').value = data.full_name || '';
    document.getElementById('profile-email').value = user.email || '';

    const roleMap = { gim_admin: 'Administrador', profesor: 'Profesor', alumno: 'Alumno' };
    document.getElementById('profile-role').textContent = roleMap[data.role] || data.role || '—';

    // Display header
    document.getElementById('profile-name-display').textContent = data.full_name || '—';
    document.getElementById('profile-email-display').textContent = user.email || '—';

    const initials =
      (data.full_name || '')
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || '?';
    document.getElementById('avatar-initials').textContent = initials;

    if (data.avatar_url) {
      const img = document.getElementById('avatar-img');
      // FIXED: XSS sanitization
      img.src = window.tfUiUtils.escHtml(data.avatar_url);
      img.classList.remove('hidden');
      document.getElementById('avatar-initials').classList.add('hidden');
    }
  }

  /* ─── Save gym info (FORM SUBMIT) ────────────────────────── */
  document.getElementById('form-gym-info').addEventListener('submit', async (e) => {
    e.preventDefault(); // Previene recarga
    const name = document.getElementById('gym-name').value.trim();

    const btn = document.getElementById('save-gym-info');
    setBtnLoading(btn, 'Guardando…');

    const { error } = await db
      .from('gyms')
      .update({
        name,
        updated_at: new Date().toISOString()
      })
      .eq('id', gymId);

    setBtnIdle(btn, 'Guardar cambios', 'save');
    if (error) {
      window.tfUiUtils.toast('Error al guardar', 'error');
      return;
    }

    document.getElementById('sidebar-gym-name').textContent = name;
    document.getElementById('dot-gym').classList.remove('visible');
    window.tfUiUtils.toast('Información del gimnasio actualizada');
  });

  document.getElementById('gym-name').addEventListener('input', () => {
    document.getElementById('dot-gym').classList.add('visible');
  });

  /* ─── Logo ───────────────────────────────────────────────── */
  const logoFileInput = document.getElementById('logo-file');
  const saveLogoBtn = document.getElementById('save-logo');
  const logoStatus = document.getElementById('logo-upload-status');

  logoFileInput.addEventListener('change', () => handleLogoSelect(logoFileInput.files[0]));

  const dropzone = document.getElementById('logo-dropzone');
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleLogoSelect(file);
  });

  function handleLogoSelect(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      window.tfUiUtils.toast('El archivo supera los 2 MB', 'error');
      return;
    }
    logoFile = file;
    saveLogoBtn.disabled = false;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.getElementById('logo-preview-img');
      img.src = e.target.result;
      img.classList.remove('hidden');
      document.getElementById('logo-placeholder-icon').classList.add('hidden');
    };
    reader.readAsDataURL(file);

    logoStatus.textContent = `Seleccionado: ${file.name}`;
    logoStatus.className = 'mt-3 text-xs text-slate-400';
    logoStatus.classList.remove('hidden');
  }

  saveLogoBtn.addEventListener('click', async () => {
    if (!logoFile) return;
    setBtnLoading(saveLogoBtn, 'Subiendo…');

    const ext = logoFile.name.split('.').pop();
    const path = `${gymId}/logo.${ext}`;

    const { error: uploadError } = await db.storage
      .from('gym-logos')
      .upload(path, logoFile, { upsert: true, contentType: logoFile.type });

    if (uploadError) {
      setBtnIdle(saveLogoBtn, 'Subir logo', 'cloud_upload');
      window.tfUiUtils.toast('Error al subir logo', 'error');
      return;
    }

    const { data: urlData } = await db.storage
      .from('gym-logos')
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    const logoUrl = urlData?.signedUrl || null;

    if (logoUrl) {
      await db
        .from('gyms')
        .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
        .eq('id', gymId);
      const sidebarIcon = document.getElementById('sidebar-logo-icon');
      // FIXED: XSS sanitization
      sidebarIcon.innerHTML = `<img src="${window.tfUiUtils.escHtml(logoUrl)}" class="w-full h-full object-contain rounded-lg" alt="Logo" />`;
    }

    setBtnIdle(saveLogoBtn, 'Subir logo', 'cloud_upload');
    saveLogoBtn.disabled = true;
    logoFile = null;
    window.tfUiUtils.toast('Logo actualizado');
  });

  /* ─── Color ──────────────────────────────────────────────── */
  function setColor(hex) {
    selectedColor = hex;
    document.getElementById('color-hex-input').value = hex.replace('#', '');
    document.getElementById('color-hex-preview').style.background = hex;
    document.getElementById('gym-color-preview').style.background = hex;

    document.querySelectorAll('.color-swatch').forEach((s) => {
      s.classList.toggle('selected', s.dataset.color.toLowerCase() === hex.toLowerCase());
    });
  }

  document.querySelectorAll('.color-swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => setColor(swatch.dataset.color));
  });

  document.getElementById('color-hex-input').addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (/^[0-9A-Fa-f]{6}$/.test(val)) setColor('#' + val.toUpperCase());
  });

  document.getElementById('save-color').addEventListener('click', async () => {
    const btn = document.getElementById('save-color');
    setBtnLoading(btn, 'Guardando…');

    const { error } = await db
      .from('gyms')
      .update({
        color: selectedColor,
        updated_at: new Date().toISOString()
      })
      .eq('id', gymId);

    setBtnIdle(btn, 'Guardar color', 'palette');
    if (error) {
      window.tfUiUtils.toast('Error al guardar color', 'error');
      return;
    }
    window.tfUiUtils.toast('Color del gimnasio actualizado');
  });

  /* ─── Save profile (FORM SUBMIT) ─────────────────────────── */
  document.getElementById('form-profile-info').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('profile-name').value.trim();

    const btn = document.getElementById('save-profile');
    setBtnLoading(btn, 'Guardando…');

    const { error } = await db
      .from('profiles')
      .update({
        full_name: fullName,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    setBtnIdle(btn, 'Guardar perfil', 'save');
    if (error) {
      window.tfUiUtils.toast('Error al guardar perfil', 'error');
      return;
    }

    document.getElementById('profile-name-display').textContent = fullName;
    document.getElementById('dot-profile').classList.remove('visible');
    window.tfUiUtils.toast('Perfil actualizado');
  });

  document.getElementById('profile-name').addEventListener('input', () => {
    document.getElementById('dot-profile').classList.add('visible');
  });

  /* ─── Avatar ─────────────────────────────────────────────── */
  document.getElementById('avatar-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      window.tfUiUtils.toast('La imagen supera los 2 MB', 'error');
      return;
    }
    avatarFile = file;

    const card = document.getElementById('avatar-upload-card');
    card.classList.remove('hidden');
    document.getElementById('avatar-file-name').textContent = file.name;

    const reader = new FileReader();
    reader.onload = (ev) => {
      document.getElementById('avatar-new-img').src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('cancel-avatar').addEventListener('click', () => {
    avatarFile = null;
    document.getElementById('avatar-upload-card').classList.add('hidden');
    document.getElementById('avatar-file').value = '';
  });

  document.getElementById('upload-avatar-btn').addEventListener('click', async () => {
    if (!avatarFile) return;
    const btn = document.getElementById('upload-avatar-btn');
    setBtnLoading(btn, 'Subiendo…');

    const ext = avatarFile.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await db.storage
      .from('avatars')
      .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });

    if (uploadError) {
      setBtnIdle(btn, 'Subir foto', 'cloud_upload');
      window.tfUiUtils.toast('Error al subir foto', 'error');
      return;
    }

    const { data: urlData } = await db.storage
      .from('avatars')
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    const avatarUrl = urlData?.signedUrl || null;

    if (avatarUrl) {
      await db
        .from('profiles')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      const avatarImg = document.getElementById('avatar-img');
      // FIXED: XSS sanitization
      avatarImg.src = window.tfUiUtils.escHtml(avatarUrl);
      avatarImg.classList.remove('hidden');
      document.getElementById('avatar-initials').classList.add('hidden');
    }

    setBtnIdle(btn, 'Subir foto', 'cloud_upload');
    document.getElementById('avatar-upload-card').classList.add('hidden');
    avatarFile = null;
    window.tfUiUtils.toast('Foto de perfil actualizada');
  });

  /* ─── Notification preferences ───────────────────────────── */
  function readNotifForm() {
    return {
      notify_membership_expiring: Boolean(
        document.getElementById('notif-membership-expiring')?.checked
      ),
      notify_student_inactive: Boolean(document.getElementById('notif-student-inactive')?.checked),
      notify_weekly_summary: Boolean(document.getElementById('notif-weekly-summary')?.checked),
      notify_new_program: Boolean(document.getElementById('notif-new-program')?.checked),
      notify_unread_messages: Boolean(document.getElementById('notif-unread-messages')?.checked)
    };
  }

  function applyNotifForm(prefs) {
    const values = { ...NOTIF_DEFAULTS, ...(prefs || {}) };
    const map = [
      ['notif-membership-expiring', 'notify_membership_expiring'],
      ['notif-student-inactive', 'notify_student_inactive'],
      ['notif-weekly-summary', 'notify_weekly_summary'],
      ['notif-new-program', 'notify_new_program'],
      ['notif-unread-messages', 'notify_unread_messages']
    ];
    map.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(values[key]);
    });
  }

  function setNotifStatus(msg, type = 'muted') {
    const statusEl = document.getElementById('notif-pref-status');
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className =
      type === 'error' ? 'text-xs text-danger mt-3' : 'text-xs text-slate-500 mt-3';
  }

  async function saveNotificationPreferences() {
    const payload = readNotifForm();
    const { error } = await db.from('notification_preferences').upsert(
      {
        gym_id: gymId,
        profile_id: user.id,
        ...payload,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'gym_id,profile_id' }
    );
    if (error) {
      setNotifStatus('No se pudieron guardar las preferencias.', 'error');
      return;
    }
    setNotifStatus('Preferencias guardadas automáticamente.');
  }

  function scheduleSaveNotificationPreferences() {
    setNotifStatus('Guardando...');
    clearTimeout(notifSaveTimer);
    notifSaveTimer = setTimeout(() => {
      saveNotificationPreferences();
    }, 450);
  }

  async function loadNotificationPreferences() {
    const { data, error } = await db
      .from('notification_preferences')
      .select(
        'notify_membership_expiring, notify_student_inactive, notify_weekly_summary, notify_new_program, notify_unread_messages'
      )
      .eq('gym_id', gymId)
      .eq('profile_id', user.id)
      .maybeSingle();

    if (error) {
      applyNotifForm(NOTIF_DEFAULTS);
      setNotifStatus('No se pudieron cargar preferencias. Se usan valores por defecto.', 'error');
      return;
    }

    applyNotifForm(data || NOTIF_DEFAULTS);
    setNotifStatus('Guardado automático.');

    [
      'notif-membership-expiring',
      'notif-student-inactive',
      'notif-weekly-summary',
      'notif-new-program',
      'notif-unread-messages'
    ].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', scheduleSaveNotificationPreferences);
    });
  }

  /* ─── Button helpers ─────────────────────────────────────── */
  function setBtnLoading(btn, label) {
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-rounded text-[17px] animate-spin">progress_activity</span>${label}`;
  }
  function setBtnIdle(btn, label, icon) {
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-rounded text-[17px]">${icon}</span>${label}`;
  }

  /* ─── Notification preferences ──────────────────────────────── */
  const NOTIFICATION_KEYS = [
    'toggle-new-student',
    'toggle-membership-renewal',
    'toggle-wellbeing-reports',
    'toggle-access-requests',
    'toggle-weekly-summary'
  ];

  const DEFAULT_PREFS = {
    toggle_new_student: true,
    toggle_membership_renewal: true,
    toggle_wellbeing_reports: true,
    toggle_access_requests: true,
    toggle_weekly_summary: false
  };

  let saveTimeout = null;

  async function loadNotificationPrefs() {
    const { data, error } = await db
      .from('profiles')
      .select('notification_preferences')
      .eq('id', user.id)
      .single();

    const prefs =
      error || !data?.notification_preferences ? DEFAULT_PREFS : data.notification_preferences;

    NOTIFICATION_KEYS.forEach((id) => {
      const key = id.replace('toggle-', 'toggle_');
      const toggle = document.getElementById(id);
      if (toggle) {
        toggle.checked = prefs[key] ?? DEFAULT_PREFS[key] ?? false;
      }
    });
  }

  function scheduleNotificationSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const prefs = {};
      NOTIFICATION_KEYS.forEach((id) => {
        const key = id.replace('toggle-', 'toggle_');
        const toggle = document.getElementById(id);
        prefs[key] = toggle ? toggle.checked : false;
      });

      await db
        .from('profiles')
        .update({
          notification_preferences: prefs,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
    }, 800);
  }

  NOTIFICATION_KEYS.forEach((id) => {
    const toggle = document.getElementById(id);
    if (toggle) {
      toggle.addEventListener('change', scheduleNotificationSave);
    }
  });

  /* ─── Init ───────────────────────────────────────────────── */
  await Promise.all([loadGym(), loadProfile(), loadNotificationPreferences()]);

  /* ─── Ir a Premium ──────────────────────────────────────── */
  document.getElementById('btn-go-premium')?.addEventListener('click', () => {
    window.tfUiUtils.toast('Funcionalidad Premium próximamente', 'info');
  });
})();
