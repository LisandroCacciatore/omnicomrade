(function (global) {
  function fallbackSetId() {
    return `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function defaultSet(n, weightKg, reps, makeSetId) {
    const sid = (makeSetId || fallbackSetId)();
    return {
      _sid: sid,
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

  function parseSetsStr(setsStr, weightKg, makeSetId) {
    const sidFactory = makeSetId || fallbackSetId;
    const match = (setsStr || '').match(/^(\d+)[×xX](.+)$/);

    if (!match) return [defaultSet(1, weightKg, setsStr || '', sidFactory)];

    const count = parseInt(match[1], 10);
    const repsRaw = match[2].trim();
    const isAmrapLast = repsRaw.endsWith('+');
    const baseReps = isAmrapLast ? repsRaw.slice(0, -1).trim() : repsRaw;

    return Array.from({ length: count }, (_, i) => ({
      _sid: sidFactory(),
      set_number: i + 1,
      weight_kg: weightKg || null,
      weight_pct: null,
      rpe_target: null,
      rir_target: null,
      reps: (i === count - 1 && isAmrapLast) ? `${baseReps}+` : baseReps,
      is_amrap: i === count - 1 && isAmrapLast,
      notes: ''
    }));
  }

  function validateRoutineDraft(input) {
    const name = String(input?.name || '').trim();
    const days = Array.isArray(input?.days) ? input.days : [];
    const exerciseCount = days.reduce((acc, d) => {
      const list = Array.isArray(d?.exercises) ? d.exercises : [];
      return acc + list.length;
    }, 0);

    const errors = {};
    if (!name) errors.name = ['El nombre es obligatorio'];
    if (!days.length) errors.days = ['Agregá al menos un día'];
    if (days.length && exerciseCount < 1) errors.exercises = ['Agregá al menos un ejercicio'];

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }

  const api = { parseSetsStr, defaultSet, validateRoutineDraft };
  global.tfRoutineBuilderUtils = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
