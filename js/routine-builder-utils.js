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

  const api = { parseSetsStr, defaultSet };
  global.tfRoutineBuilderUtils = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
