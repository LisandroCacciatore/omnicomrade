window.StudentOnboardingTour = (function () {
  const STORAGE_KEY = 'tf_onboarding_done';

  const STEPS = [
    {
      target: '#dashboard-content',
      title: '¡Bienvenido a TechFitness!',
      text: 'Este es tu panel. Acá ves todo de un vistazo.',
      position: 'center'
    },
    {
      target: '#btn-entrenar',
      title: 'Comenzar a entrenar',
      text: 'Hacé click acá cuando estés listo para entrenar.',
      position: 'bottom'
    },
    {
      target: '#wellbeing-metrics',
      title: 'Tu bienestar importa',
      text: 'Antes de cada sesión te vamos a preguntar cómo llegás.',
      position: 'top'
    },
    {
      target: 'a[href="progress.html"]',
      title: 'Seguí tu progreso',
      text: 'Acá podés ver cómo evolucionan tus pesos semana a semana.',
      position: 'top'
    }
  ];

  let currentStep = 0;
  let overlay = null;
  let tooltip = null;

  function shouldShow() {
    try {
      return !localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  }

  function markDone() {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
  }

  function init() {
    if (!shouldShow()) return;
    setTimeout(start, 800);
  }

  function start() {
    if (overlay || tooltip) return;
    createOverlay();
    showStep(0);
  }

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'tf-tour-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:1000;background:rgba(7,11,16,0.75);backdrop-filter:blur(2px);';
    document.body.appendChild(overlay);

    tooltip = document.createElement('div');
    tooltip.id = 'tf-tour-tooltip';
    tooltip.style.cssText =
      'position:fixed;z-index:1001;background:#161E26;border:1px solid #1E293B;border-radius:16px;padding:20px 24px;max-width:320px;width:calc(100vw - 48px);box-shadow:0 20px 60px rgba(0,0,0,.5);font-family:Space Grotesk,sans-serif;';
    document.body.appendChild(tooltip);
  }

  function showStep(index) {
    currentStep = index;
    const step = STEPS[index];
    const isLast = index === STEPS.length - 1;
    const targetEl = document.querySelector(step.target);

    tooltip.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
        <span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.08em">Paso ${index + 1} de ${STEPS.length}</span>
        <button id="tf-tour-skip" style="background:none;border:none;color:#475569;cursor:pointer;font-size:11px;font-weight:600;font-family:inherit">Saltear tour</button>
      </div>
      <h3 style="color:#E2E8F0;font-size:15px;font-weight:800;margin:0 0 6px">${step.title}</h3>
      <p style="color:#64748B;font-size:13px;line-height:1.5;margin:0 0 16px">${step.text}</p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        ${
          isLast
            ? '<button id="tf-tour-done" style="background:#3B82F6;color:#fff;border:none;padding:8px 20px;border-radius:10px;cursor:pointer;font-family:inherit;font-weight:700;font-size:13px">¡Entendido!</button>'
            : '<button id="tf-tour-next" style="background:#3B82F6;color:#fff;border:none;padding:8px 20px;border-radius:10px;cursor:pointer;font-family:inherit;font-weight:700;font-size:13px">Siguiente →</button>'
        }
      </div>
    `;

    positionTooltip(targetEl, step.position);

    document.getElementById('tf-tour-skip')?.addEventListener('click', skipTour);
    document.getElementById('tf-tour-next')?.addEventListener('click', () => showStep(index + 1));
    document.getElementById('tf-tour-done')?.addEventListener('click', finishTour);

    targetEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function positionTooltip(targetEl, position) {
    if (!tooltip) return;

    if (!targetEl || position === 'center') {
      tooltip.style.top = '50%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    const safeLeft = Math.max(16, Math.min(rect.left, window.innerWidth - 336));
    tooltip.style.transform = '';

    if (position === 'bottom') {
      tooltip.style.top = `${Math.min(window.innerHeight - 24, rect.bottom + 12)}px`;
      tooltip.style.left = `${safeLeft}px`;
      return;
    }

    tooltip.style.top = `${Math.max(24, rect.top - 12)}px`;
    tooltip.style.left = `${safeLeft}px`;
    tooltip.style.transform = 'translateY(-100%)';
  }

  function finishBaseToast(msg) {
    markDone();
    window.tfUtils?.toast?.(msg);
    overlay?.remove();
    tooltip?.remove();
    overlay = null;
    tooltip = null;
  }

  function skipTour() {
    finishBaseToast('Podés ver este tour de nuevo en Configuración');
  }

  function finishTour() {
    finishBaseToast('Tour completado.');
  }

  return { init };
})();
