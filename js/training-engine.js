(function (global) {
  function localRound(value, step = 2.5) {
    return Math.round(value / step) * step;
  }

  function round(value, step = 2.5) {
    if (global.tfTrainingMath?.roundWeight) return global.tfTrainingMath.roundWeight(value, step);
    return localRound(value, step);
  }

  function pct(base, percent, step = 2.5) {
    if (global.tfTrainingMath?.pct) return global.tfTrainingMath.pct(base, percent, step);
    return round(base * percent, step);
  }

  function generateStartingStrength(rms) {
    const sqWStart = pct(rms.sq, 0.55);
    const dlWStart = pct(rms.dl, 0.55);
    const bpWStart = pct(rms.bp, 0.55);
    const ohpWStart = pct(rms.ohp, 0.55);
    const pcWStart = pct(rms.pc, 0.65);

    const weeks = [];
    let sqW = sqWStart;
    let dlW = dlWStart;
    let bpW = bpWStart;
    let ohpW = ohpWStart;
    let pcW = pcWStart;

    for (let w = 1; w <= 4; w++) {
      const scheme = w % 2 === 1 ? 'ABA' : 'BAB';
      const days = scheme === 'ABA'
        ? [
          { label: 'Sesión A', lifts: [{ name: 'Sentadilla', w: sqW, sets: '3×5', incr: 2.5 }, { name: 'Press Militar', w: ohpW, sets: '3×5', incr: 1.25 }, { name: 'Peso Muerto', w: dlW, sets: '1×5', incr: 2.5 }] },
          { label: 'Sesión B', lifts: [{ name: 'Sentadilla', w: sqW, sets: '3×5', incr: 2.5 }, { name: 'Press Banca', w: bpW, sets: '3×5', incr: 1.25 }, { name: 'Power Clean', w: pcW, sets: '5×3', incr: 2.5 }] },
          { label: 'Sesión A', lifts: [{ name: 'Sentadilla', w: sqW + 2.5, sets: '3×5', incr: 2.5 }, { name: 'Press Militar', w: ohpW + 1.25, sets: '3×5', incr: 1.25 }, { name: 'Peso Muerto', w: dlW + 2.5, sets: '1×5', incr: 2.5 }] }
        ]
        : [
          { label: 'Sesión B', lifts: [{ name: 'Sentadilla', w: sqW, sets: '3×5', incr: 2.5 }, { name: 'Press Banca', w: bpW, sets: '3×5', incr: 1.25 }, { name: 'Power Clean', w: pcW, sets: '5×3', incr: 2.5 }] },
          { label: 'Sesión A', lifts: [{ name: 'Sentadilla', w: sqW + 2.5, sets: '3×5', incr: 2.5 }, { name: 'Press Militar', w: ohpW + 1.25, sets: '3×5', incr: 1.25 }, { name: 'Peso Muerto', w: dlW + 2.5, sets: '1×5', incr: 2.5 }] },
          { label: 'Sesión B', lifts: [{ name: 'Sentadilla', w: sqW + 5, sets: '3×5', incr: 2.5 }, { name: 'Press Banca', w: bpW + 1.25, sets: '3×5', incr: 1.25 }, { name: 'Power Clean', w: pcW + 2.5, sets: '5×3', incr: 2.5 }] }
        ];

      weeks.push({ label: `Semana ${w}`, phase: scheme, phaseColor: '#10B981', days });
      sqW += 7.5;
      dlW += 5;
      bpW += 3.75;
      ohpW += 3.75;
      pcW += 7.5;
    }

    return weeks;
  }

  function generateStrongLifts(rms) {
    const sqWStart = pct(rms.sq, 0.55);
    const dlWStart = pct(rms.dl, 0.55);
    const bpWStart = pct(rms.bp, 0.55);
    const rowWStart = pct(rms.row, 0.55);
    const ohpWStart = pct(rms.ohp, 0.55);

    const weeks = [];
    let sqW = sqWStart;
    let dlW = dlWStart;
    let bpW = bpWStart;
    let rowW = rowWStart;
    let ohpW = ohpWStart;

    for (let w = 1; w <= 4; w++) {
      const days = [
        { label: 'Día A', lifts: [{ name: 'Sentadilla', w: sqW, sets: '5×5', incr: 2.5 }, { name: 'Press Banca', w: bpW, sets: '5×5', incr: 2.5 }, { name: 'Remo con Barra', w: rowW, sets: '5×5', incr: 2.5 }] },
        { label: 'Día B', lifts: [{ name: 'Sentadilla', w: sqW + 2.5, sets: '5×5', incr: 2.5 }, { name: 'Press Militar', w: ohpW, sets: '5×5', incr: 2.5 }, { name: 'Peso Muerto', w: dlW, sets: '1×5', incr: 5 }] },
        { label: 'Día A', lifts: [{ name: 'Sentadilla', w: sqW + 5, sets: '5×5', incr: 2.5 }, { name: 'Press Banca', w: bpW + 2.5, sets: '5×5', incr: 2.5 }, { name: 'Remo con Barra', w: rowW + 2.5, sets: '5×5', incr: 2.5 }] }
      ];

      weeks.push({ label: `Semana ${w}`, phase: 'Base', phaseColor: '#F97316', days });
      sqW += 7.5;
      dlW += 5;
      bpW += 5;
      rowW += 5;
      ohpW += 2.5;
    }

    return weeks;
  }

  function generateProgram(programId, rms, legacyGenerate) {
    if (programId === 'starting-strength') return generateStartingStrength(rms);
    if (programId === 'stronglifts-5x5') return generateStrongLifts(rms);
    if (typeof legacyGenerate === 'function') return legacyGenerate(rms);
    return [];
  }

  const api = { round, pct, generateStartingStrength, generateStrongLifts, generateProgram };
  global.tfTrainingEngine = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
