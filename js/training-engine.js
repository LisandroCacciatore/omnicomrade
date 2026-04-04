/**
 * training-engine.js
 * TechFitness — Motor de Entrenamiento Unificado
 *
 * SINGLE SOURCE OF TRUTH para la generación de programas.
 * Todas las páginas que necesiten PROGRAMS deben consumir
 * window.tfTrainingEngine.PROGRAMS en lugar de duplicar lógica.
 *
 * Exports (global):
 *   window.tfTrainingEngine.round(value, step)
 *   window.tfTrainingEngine.pct(base, percent, step)
 *   window.tfTrainingEngine.generateProgram(programId, rms)
 *   window.tfTrainingEngine.PROGRAMS  — metadata + generate()
 */

(function (global) {
  /* ══════════════════════════════════════════════════════════
     MATH HELPERS
  ══════════════════════════════════════════════════════════ */

  /**
   * Redondea un peso al múltiplo más cercano del step.
   * @param {number} value - Peso en kg
   * @param {number} [step=2.5] - Paso de redondeo (default 2.5kg)
   * @returns {number} Peso redondeado
   */
  function round(value, step) {
    if (step === undefined) step = 2.5;
    if (global.tfTrainingMath && global.tfTrainingMath.roundWeight) {
      return global.tfTrainingMath.roundWeight(value, step);
    }
    return Math.round(value / step) * step;
  }

  /**
   * Calcula un porcentaje de un peso base y lo redondea.
   * @param {number} base - Peso base (1RM o TM)
   * @param {number} percent - Porcentaje (0-1), ej: 0.85
   * @param {number} [step=2.5] - Paso de redondeo
   * @returns {number} Peso calculado redondeado
   * @example pct(100, 0.85) // => 85
   * @example pct(97, 0.55)  // => 52.5 (redondeado a 2.5)
   */
  function pct(base, percent, step) {
    if (step === undefined) step = 2.5;
    if (global.tfTrainingMath && global.tfTrainingMath.pct) {
      return global.tfTrainingMath.pct(base, percent, step);
    }
    return round(base * percent, step);
  }

  /* ══════════════════════════════════════════════════════════
     PROGRAM GENERATORS
  ══════════════════════════════════════════════════════════ */

  /**
   * Genera 4 semanas de Starting Strength (progresión lineal A/B).
   * @param {{sq:number, dl:number, bp:number, ohp:number, pc:number}} rms
   * @returns {Array<{label:string, phase:string, phaseColor:string, days:Array}>}
   */
  function generateStartingStrength(rms) {
    var sqW = pct(rms.sq, 0.55);
    var dlW = pct(rms.dl, 0.55);
    var bpW = pct(rms.bp, 0.55);
    var ohpW = pct(rms.ohp, 0.55);
    var pcW = pct(rms.pc, 0.65);

    var weeks = [];
    for (var w = 1; w <= 4; w++) {
      var scheme = w % 2 === 1 ? 'ABA' : 'BAB';
      var days = scheme === 'ABA'
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

      weeks.push({ label: 'Semana ' + w, phase: scheme, phaseColor: '#10B981', days: days });
      sqW += 7.5; dlW += 5; bpW += 3.75; ohpW += 3.75; pcW += 7.5;
    }
    return weeks;
  }

  /**
   * Genera 4 semanas de StrongLifts 5×5 (progresión lineal A/B).
   * @param {{sq:number, dl:number, bp:number, row:number, ohp:number}} rms
   * @returns {Array}
   */
  function generateStrongLifts(rms) {
    var sqW = pct(rms.sq, 0.5);
    var dlW = pct(rms.dl, 0.5);
    var bpW = pct(rms.bp, 0.5);
    var rowW = pct(rms.row, 0.5);
    var ohpW = pct(rms.ohp, 0.5);

    var weeks = [];
    for (var w = 1; w <= 4; w++) {
      weeks.push({
        label: 'Semana ' + w,
        phaseColor: '#F97316',
        days: [
          { label: 'Sesión A', lifts: [{ name: 'Sentadilla', w: sqW, sets: '5×5', incr: 2.5 }, { name: 'Press Banca', w: bpW, sets: '5×5', incr: 1.25 }, { name: 'Remo con barra', w: rowW, sets: '5×5', incr: 1.25 }] },
          { label: 'Sesión B', lifts: [{ name: 'Sentadilla', w: sqW + 2.5, sets: '5×5', incr: 2.5 }, { name: 'Press Militar', w: ohpW, sets: '5×5', incr: 1.25 }, { name: 'Peso Muerto', w: dlW, sets: '1×5', incr: 2.5 }] },
          { label: 'Sesión A', lifts: [{ name: 'Sentadilla', w: sqW + 5, sets: '5×5', incr: 2.5 }, { name: 'Press Banca', w: bpW + 1.25, sets: '5×5', incr: 1.25 }, { name: 'Remo con barra', w: rowW + 1.25, sets: '5×5', incr: 1.25 }] }
        ]
      });
      sqW += 7.5; dlW += 5; bpW += 3.75; rowW += 3.75; ohpW += 3.75;
    }
    return weeks;
  }

  /**
   * Genera 4 semanas de GZCLP (3 tiers).
   * @param {{sq:number, hp:number, bp:number, pull:number}} rms
   * @returns {Array}
   */
  function generateGZCLP(rms) {
    var t1Schemes = ['5×3+', '6×2+', '10×1+'];
    var t2Schemes = ['3×10+', '3×8+', '3×6+'];

    function weekFn(w, t1Idx, t2Idx) {
      var t1s = t1Schemes[Math.min(t1Idx, 2)];
      var t2s = t2Schemes[Math.min(t2Idx, 2)];
      var t1Perc = t1Idx === 0 ? 0.85 : t1Idx === 1 ? 0.9 : 0.95;
      var t2Perc = t2Idx === 0 ? 0.65 : t2Idx === 1 ? 0.7 : 0.75;

      function dayFn(label, t1Name, t1Base, t2Name, t2Base) {
        return {
          label: label,
          lifts: [
            { name: '[T1] ' + t1Name, w: pct(t1Base, t1Perc), sets: t1s, type: 'T1', color: '#EF4444' },
            { name: '[T2] ' + t2Name, w: pct(t2Base, t2Perc), sets: t2s, type: 'T2', color: '#3B82F6' },
            { name: '[T3] Asistencia', w: 0, sets: '3×15+ pc', type: 'T3', color: '#64748B' }
          ]
        };
      }

      return {
        label: 'Semana ' + w,
        phaseColor: '#8B5CF6',
        phase: 'T1: ' + t1s + ' T2: ' + t2s,
        days: [
          dayFn('Día A — Lower + Upper', 'Sentadilla', rms.sq, 'Press Horizontal', rms.bp),
          dayFn('Día B — Upper + Lower', 'Press Horiz.', rms.bp, 'Hip Hinge', rms.hp),
          dayFn('Día C — Lower + Upper', 'Hip Hinge', rms.hp, 'Sentadilla', rms.sq),
          dayFn('Día D — Upper + Lower', 'Pull Vertical', rms.pull, 'Press Horizontal', rms.bp)
        ]
      };
    }

    return [weekFn(1, 0, 0), weekFn(2, 0, 0), weekFn(3, 1, 1), weekFn(4, 1, 1)];
  }

  /**
   * Genera 4 semanas (1 ciclo) de Wendler 5/3/1 BBB.
   * @param {{sq:number, dl:number, bp:number, ohp:number}} rms
   * @returns {Array}
   */
  function generateWendler531(rms) {
    var TM = {
      sq: round(rms.sq * 0.9),
      dl: round(rms.dl * 0.9),
      bp: round(rms.bp * 0.9),
      ohp: round(rms.ohp * 0.9)
    };
    var lifts = [
      { id: 'sq', name: 'Sentadilla', tm: TM.sq },
      { id: 'bp', name: 'Press Banca', tm: TM.bp },
      { id: 'dl', name: 'Peso Muerto', tm: TM.dl },
      { id: 'ohp', name: 'Press Militar', tm: TM.ohp }
    ];

    var weekConfig = [
      { w: 1, name: 'Volumen',  reps: '5+', percs: [0.65, 0.75, 0.85], phase: 'VOL',  phaseColor: '#10B981' },
      { w: 2, name: 'Híbrido',  reps: '3+', percs: [0.7, 0.8, 0.9],   phase: 'HYB',  phaseColor: '#F59E0B' },
      { w: 3, name: 'Pico',     reps: '1+', percs: [0.75, 0.85, 0.95], phase: 'PEAK', phaseColor: '#EF4444' },
      { w: 4, name: 'Descarga', reps: '5',  percs: [0.4, 0.5, 0.6],   phase: 'DLD',  phaseColor: '#64748B' }
    ];

    return weekConfig.map(function (wk) {
      var isDeload = wk.w === 4;
      var days = lifts.map(function (l, i) {
        var sets = isDeload
          ? [
            { label: '40%', w: pct(l.tm, 0.4), sets: '5 reps', amrap: false },
            { label: '50%', w: pct(l.tm, 0.5), sets: '5 reps', amrap: false },
            { label: '60%', w: pct(l.tm, 0.6), sets: '5 reps', amrap: false }
          ]
          : wk.percs.map(function (p, pi) {
            return {
              label: Math.round(p * 100) + '%',
              w: pct(l.tm, p),
              sets: pi < 2 ? '5 reps' : wk.reps,
              amrap: pi === 2
            };
          });

        var bbbW = isDeload ? null : pct(l.tm, 0.5);
        var liftEntries = sets.map(function (s) {
          return { name: l.name, w: s.w, sets: s.sets, type: s.amrap ? 'AMRAP' : null, sublabel: s.label };
        });

        if (bbbW) {
          liftEntries.push({ name: l.name + ' (BBB)', w: bbbW, sets: '5×10', type: 'BBB', color: '#475569' });
        }
        liftEntries.push({ name: 'Asistencia push/pull/core', w: 0, sets: '3-4 series', type: 'ACC', color: '#334155' });

        return { label: 'Día ' + (i + 1) + ' — ' + l.name, lifts: liftEntries };
      });

      return {
        label: 'Semana ' + wk.w + ' — ' + wk.name,
        phase: wk.phase,
        phaseColor: wk.phaseColor,
        days: days,
        meta: 'TM: SQ ' + TM.sq + ' | BP ' + TM.bp + ' | DL ' + TM.dl + ' | OHP ' + TM.ohp
      };
    });
  }

  /**
   * Genera 3 semanas (1 ola) de Cube Method.
   * @param {{sq:number, bp:number, dl:number}} rms
   * @returns {Array}
   */
  function generateCubeMethod(rms) {
    var TM = { sq: round(rms.sq * 0.95), bp: round(rms.bp * 0.95), dl: round(rms.dl * 0.95) };
    var weekFocus = ['Sentadilla Pesada', 'Peso Muerto Pesado', 'Banca Pesada'];

    var matrix = {
      SQ: [
        { type: 'Pesado',    sets: '5×2',  perc: 0.8, color: '#EF4444', note: 'Serie tope, máxima tensión' },
        { type: 'Explosivo', sets: '8×3',  perc: 0.6, color: '#3B82F6', note: 'Velocidad máxima en la suba' },
        { type: 'Reps',      sets: '1×8+', perc: 0.7, color: '#F59E0B', note: 'AMRAP controlado' }
      ],
      BP: [
        { type: 'Reps',      sets: '1×8+', perc: 0.7, color: '#F59E0B', note: 'AMRAP controlado' },
        { type: 'Pesado',    sets: '5×2',  perc: 0.8, color: '#EF4444', note: 'Serie tope, máxima tensión' },
        { type: 'Explosivo', sets: '8×3',  perc: 0.6, color: '#3B82F6', note: 'Pausa de 1 seg en el pecho' }
      ],
      DL: [
        { type: 'Explosivo', sets: '8×3',  perc: 0.6, color: '#3B82F6', note: 'Pies en suelo entre reps' },
        { type: 'Reps',      sets: '1×8+', perc: 0.7, color: '#F59E0B', note: 'AMRAP controlado' },
        { type: 'Pesado',    sets: '5×2',  perc: 0.8, color: '#EF4444', note: 'Serie tope, máxima tensión' }
      ]
    };

    return [1, 2, 3].map(function (w) {
      var sqCfg = matrix.SQ[w - 1];
      var bpCfg = matrix.BP[w - 1];
      var dlCfg = matrix.DL[w - 1];
      return {
        label: 'Semana ' + w + ' — Foco: ' + weekFocus[w - 1],
        phase: sqCfg.type === 'Pesado' ? 'SQ HEAVY' : bpCfg.type === 'Pesado' ? 'BP HEAVY' : 'DL HEAVY',
        phaseColor: '#06B6D4',
        days: [
          {
            label: 'Día 1 — Sentadilla',
            lifts: [
              { name: 'Sentadilla', w: pct(TM.sq, sqCfg.perc), sets: sqCfg.sets, type: sqCfg.type, color: sqCfg.color, sublabel: Math.round(sqCfg.perc * 100) + '% TM', note: sqCfg.note },
              { name: 'Asistencia tren inferior', w: 0, sets: '3-4 series', type: 'ACC', color: '#334155' }
            ]
          },
          {
            label: 'Día 2 — Press Banca',
            lifts: [
              { name: 'Press Banca', w: pct(TM.bp, bpCfg.perc), sets: bpCfg.sets, type: bpCfg.type, color: bpCfg.color, sublabel: Math.round(bpCfg.perc * 100) + '% TM', note: bpCfg.note },
              { name: 'Asistencia tren superior', w: 0, sets: '3-4 series', type: 'ACC', color: '#334155' }
            ]
          },
          {
            label: 'Día 3 — Peso Muerto',
            lifts: [
              { name: 'Peso Muerto', w: pct(TM.dl, dlCfg.perc), sets: dlCfg.sets, type: dlCfg.type, color: dlCfg.color, sublabel: Math.round(dlCfg.perc * 100) + '% TM', note: dlCfg.note },
              { name: 'Asistencia posterior', w: 0, sets: '3-4 series', type: 'ACC', color: '#334155' }
            ]
          }
        ],
        meta: 'TM: SQ ' + TM.sq + ' | BP ' + TM.bp + ' | DL ' + TM.dl
      };
    });
  }

  /**
   * Genera 4 semanas de PPL (Push/Pull/Legs × 2).
   * @param {{bp:number, row:number, sq:number, rdl:number}} rms
   * @returns {Array}
   */
  function generatePPL(rms) {
    var sessions = {
      PUSH: [
        { name: 'Press Banca',       pct: 0.72, sets: '4×8-12', note: 'RIR 2-3' },
        { name: 'Press Inclinado',   pct: 0.65, sets: '3×10-12', note: '' },
        { name: 'Press Militar',     pct: 0.62, sets: '4×8-12', note: '' },
        { name: 'Elevaciones Lat.',  pct: 0.4,  sets: '4×12-15', note: 'Cables o mancuernas' },
        { name: 'Extensión Tríceps', pct: 0.45, sets: '3×12-15', note: 'Polea' },
        { name: 'Fondos',            pct: 0,    sets: '3×máx', note: 'Peso corporal' }
      ],
      PULL: [
        { name: 'Jalón al pecho',   pct: 0.68, sets: '4×8-12', note: 'RIR 2-3' },
        { name: 'Remo con barra',   pct: 0.72, sets: '4×8-10', note: '' },
        { name: 'Remo en cable',    pct: 0.6,  sets: '3×12', note: '' },
        { name: 'Curl con barra',   pct: 0.5,  sets: '4×10-12', note: '' },
        { name: 'Curl martillo',    pct: 0.42, sets: '3×12', note: '' },
        { name: 'Face pull',        pct: 0.3,  sets: '3×15', note: 'Hombro posterior' }
      ],
      LEGS: [
        { name: 'Sentadilla',             pct: 0.75, sets: '4×6-10', note: 'RIR 2-3' },
        { name: 'Prensa de piernas',      pct: 0.7,  sets: '3×10-12', note: '' },
        { name: 'P. Muerto Rumano',       pct: 0.72, sets: '4×8-10', note: '' },
        { name: 'Extensión cuádriceps',   pct: 0.55, sets: '3×12-15', note: 'Máquina' },
        { name: 'Curl femoral',           pct: 0.5,  sets: '3×12-15', note: 'Máquina' },
        { name: 'Elevación talones',      pct: 0,    sets: '4×15-20', note: 'Gemelos' }
      ]
    };

    var weeks = [];
    for (var w = 1; w <= 4; w++) {
      var progFactor = 1 + (w - 1) * 0.03;
      var types = ['PUSH', 'PULL', 'LEGS', 'PUSH', 'PULL', 'LEGS'];
      var days = types.map(function (type, di) {
        return {
          label: 'Día ' + (di + 1) + ' — ' + type,
          lifts: sessions[type].map(function (ex) {
            var base =
              type === 'PUSH' ? rms.bp
              : type === 'PULL' ? rms.row
              : type === 'LEGS' && ex.name.includes('Sentadilla') ? rms.sq
              : type === 'LEGS' && ex.name.includes('Rumano') ? rms.rdl
              : type === 'LEGS' ? rms.sq * 0.6
              : rms.bp;
            var weight = ex.pct > 0 ? pct(base * progFactor, ex.pct) : 0;
            return { name: ex.name, w: weight, sets: ex.sets, note: ex.note, type: null, color: null };
          })
        };
      });
      weeks.push({ label: 'Semana ' + w, phase: 'CICLO ' + w, phaseColor: '#EC4899', days: days });
    }
    return weeks;
  }

  /* ══════════════════════════════════════════════════════════
     PROGRAMS CATALOG — Single Source of Truth
  ══════════════════════════════════════════════════════════ */

  /** @type {Array<{id:string, name:string, author:string, icon:string, color:string, gradient:string, glowColor:string, difficulty:number, weeks:number, daysPerWeek:number, focus:string[], level:string, description:string, stats:Array, inputs:Array, generate:Function}>} */
  var PROGRAMS = [
    {
      id: 'starting-strength',
      name: 'Starting Strength',
      author: 'Mark Rippetoe',
      icon: '🚂',
      color: '#10B981',
      gradient: 'linear-gradient(135deg,#10B981,#059669)',
      glowColor: 'rgba(16,185,129,.08)',
      difficulty: 1,
      weeks: 12,
      daysPerWeek: 3,
      focus: ['fuerza', 'tecnica'],
      level: 'Principiante',
      description: 'El programa de fuerza más eficiente para principiantes. Progresión lineal session-a-session con los movimientos fundamentales. Cuando la barra sube cada entrenamiento, no hay sistema más efectivo.',
      stats: [
        { icon: 'calendar_month', label: '12 semanas' },
        { icon: 'repeat', label: '3 días/sem' },
        { icon: 'trending_up', label: 'Progresión lineal' },
        { icon: 'fitness_center', label: '5 movimientos' }
      ],
      inputs: [
        { id: 'sq', label: 'Sentadilla 1RM', default: 60 },
        { id: 'dl', label: 'Peso Muerto 1RM', default: 80 },
        { id: 'bp', label: 'Press Banca 1RM', default: 50 },
        { id: 'ohp', label: 'Press Militar 1RM', default: 35 },
        { id: 'pc', label: 'Power Clean (inicial)', default: 30 }
      ],
      generate: function (rms) { return generateStartingStrength(rms); }
    },
    {
      id: 'stronglifts-5x5',
      name: 'StrongLifts 5×5',
      author: 'Mehdi Hadim',
      icon: '🏗️',
      color: '#F97316',
      gradient: 'linear-gradient(135deg,#F97316,#EA580C)',
      glowColor: 'rgba(249,115,22,.08)',
      difficulty: 1,
      weeks: 12,
      daysPerWeek: 3,
      focus: ['fuerza', 'hipertrofia'],
      level: 'Principiante',
      description: 'Dos sesiones alternadas con los 5 movimientos básicos. Volumen mayor que SS con 5×5 en todos los levantamientos principales. Ideal cuando el principiante necesita más práctica técnica acumulando volumen.',
      stats: [
        { icon: 'calendar_month', label: '12 semanas' },
        { icon: 'repeat', label: '3 días/sem' },
        { icon: 'trending_up', label: 'Progresión lineal' },
        { icon: 'stacked_bar_chart', label: '5×5 volumen' }
      ],
      inputs: [
        { id: 'sq', label: 'Sentadilla 1RM', default: 60 },
        { id: 'dl', label: 'Peso Muerto 1RM', default: 80 },
        { id: 'bp', label: 'Press Banca 1RM', default: 50 },
        { id: 'row', label: 'Remo con barra 1RM', default: 55 },
        { id: 'ohp', label: 'Press Militar 1RM', default: 35 }
      ],
      generate: function (rms) { return generateStrongLifts(rms); }
    },
    {
      id: 'gzclp',
      name: 'GZCLP',
      author: 'Sayit Garip',
      icon: '⚡',
      color: '#8B5CF6',
      gradient: 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
      glowColor: 'rgba(139,92,246,.08)',
      difficulty: 2,
      weeks: 10,
      daysPerWeek: 4,
      focus: ['fuerza', 'hipertrofia'],
      level: 'Principiante / Intermedio',
      description: 'Progresión lineal estructurada en 3 tiers. T1 (fuerza máxima), T2 (hipertrofia de base) y T3 (volumen asistencia). Cuando falla la progresión en T1, cambia la rep scheme antes de reiniciar pesos.',
      stats: [
        { icon: 'calendar_month', label: '10 semanas' },
        { icon: 'repeat', label: '4 días/sem' },
        { icon: 'layers', label: '3 tiers de trabajo' },
        { icon: 'trending_up', label: 'Fallo = cambio de scheme' }
      ],
      inputs: [
        { id: 'sq', label: 'Sentadilla 1RM', default: 80 },
        { id: 'hp', label: 'Hip Hinge 1RM', default: 100 },
        { id: 'bp', label: 'Press Horizontal 1RM', default: 65 },
        { id: 'pull', label: 'Pull Vertical 1RM', default: 60 }
      ],
      generate: function (rms) { return generateGZCLP(rms); }
    },
    {
      id: 'wendler-531',
      name: 'Wendler 5/3/1',
      author: 'Jim Wendler',
      icon: '📈',
      color: '#3B82F6',
      gradient: 'linear-gradient(135deg,#3B82F6,#2563EB)',
      glowColor: 'rgba(59,130,246,.08)',
      difficulty: 3,
      weeks: 4,
      daysPerWeek: 4,
      focus: ['fuerza', 'resistencia'],
      level: 'Intermedio',
      description: 'El programa de fuerza a largo plazo más utilizado. Ciclos de 4 semanas (5+, 3+, 1+, deload) sobre el 90% del 1RM real. La clave: respetar el Training Max y acumular más reps que el ciclo anterior.',
      stats: [
        { icon: 'calendar_month', label: '4 sem/ciclo' },
        { icon: 'repeat', label: '4 días/sem' },
        { icon: 'show_chart', label: '+2.5kg / +1.25kg ciclo' },
        { icon: 'psychology', label: 'AMRAP en la serie tope' }
      ],
      inputs: [
        { id: 'sq', label: 'Sentadilla 1RM', default: 120 },
        { id: 'dl', label: 'Peso Muerto 1RM', default: 160 },
        { id: 'bp', label: 'Press Banca 1RM', default: 90 },
        { id: 'ohp', label: 'Press Militar 1RM', default: 60 }
      ],
      generate: function (rms) { return generateWendler531(rms); }
    },
    {
      id: 'cube-method',
      name: 'The Cube Method',
      author: 'Brandon Lilly',
      icon: '🧊',
      color: '#06B6D4',
      gradient: 'linear-gradient(135deg,#06B6D4,#0891B2)',
      glowColor: 'rgba(6,182,212,.08)',
      difficulty: 3,
      weeks: 3,
      daysPerWeek: 3,
      focus: ['fuerza', 'potencia'],
      level: 'Intermedio / Avanzado',
      description: 'Rotación de estímulos: nunca todo pesado al mismo tiempo. Cada semana un levantamiento es Pesado, otro Explosivo y otro de Repeticiones. El SNC descansa mientras el cuerpo se adapta.',
      stats: [
        { icon: 'calendar_month', label: '3 sem/ola' },
        { icon: 'repeat', label: '3 días/sem' },
        { icon: 'rotate_3d', label: 'Rotación Pesado/Explosivo/Reps' },
        { icon: 'bolt', label: 'Énfasis en potencia' }
      ],
      inputs: [
        { id: 'sq', label: 'Sentadilla 1RM', default: 140 },
        { id: 'bp', label: 'Press Banca 1RM', default: 105 },
        { id: 'dl', label: 'Peso Muerto 1RM', default: 185 }
      ],
      generate: function (rms) { return generateCubeMethod(rms); }
    },
    {
      id: 'ppl',
      name: 'Push / Pull / Legs',
      author: 'Método clásico',
      icon: '🔄',
      color: '#EC4899',
      gradient: 'linear-gradient(135deg,#EC4899,#DB2777)',
      glowColor: 'rgba(236,72,153,.08)',
      difficulty: 2,
      weeks: 8,
      daysPerWeek: 6,
      focus: ['hipertrofia', 'estetica'],
      level: 'Intermedio',
      description: 'División Push/Pull/Legs repetida dos veces por semana. Máximo volumen para hipertrofia con alta frecuencia por grupo muscular. Sin necesidad de 1RM específico — se trabaja por RPE y peso propio.',
      stats: [
        { icon: 'calendar_month', label: '8 semanas' },
        { icon: 'repeat', label: '6 días/sem' },
        { icon: 'self_improvement', label: 'Foco hipertrofia' },
        { icon: 'stacked_bar_chart', label: 'Alto volumen' }
      ],
      inputs: [
        { id: 'bp', label: 'Press Banca 1RM', default: 80 },
        { id: 'row', label: 'Remo con barra 1RM', default: 80 },
        { id: 'sq', label: 'Sentadilla 1RM', default: 100 },
        { id: 'rdl', label: 'Peso Muerto Rumano 1RM', default: 90 }
      ],
      generate: function (rms) { return generatePPL(rms); }
    }
  ];

  /* ══════════════════════════════════════════════════════════
     PROGRAM DISPATCHER
  ══════════════════════════════════════════════════════════ */

  /**
   * Genera semanas de un programa por su ID.
   * @param {string} programId - Identificador del programa (ej: 'wendler-531')
   * @param {Record<string, number>} rms - Valores de 1RM del atleta
   * @param {Function} [legacyGenerate] - Fallback para programas custom
   * @returns {Array} Semanas generadas
   */
  function generateProgram(programId, rms, legacyGenerate) {
    var program = PROGRAMS.find(function (p) { return p.id === programId; });
    if (program) return program.generate(rms);
    if (typeof legacyGenerate === 'function') return legacyGenerate(rms);
    return [];
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════ */

  var api = {
    round: round,
    pct: pct,
    PROGRAMS: PROGRAMS,
    generateStartingStrength: generateStartingStrength,
    generateStrongLifts: generateStrongLifts,
    generateGZCLP: generateGZCLP,
    generateWendler531: generateWendler531,
    generateCubeMethod: generateCubeMethod,
    generatePPL: generatePPL,
    generateProgram: generateProgram
  };

  global.tfTrainingEngine = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
