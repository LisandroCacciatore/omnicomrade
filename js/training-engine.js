/**
 * OmniComrade Training Engine
 * Lógica pura de entrenamiento: redondeo de pesos, cálculos de porcentajes y catálogo de programas.
 * Independiente del DOM para facilitar testeabilidad y portabilidad.
 * @module trainingEngine
 */

const TrainingEngine = (() => {
    /**
     * Redondea un valor al incremento de peso más cercano.
     * @param {number} v - Valor a redondear
     * @param {number} s - Step (default 2.5kg)
     * @returns {number}
     */
    const round = (v, s = 2.5) => Math.round(v / s) * s;
    
    /**
     * Calcula el porcentaje de un peso base y lo redondea.
     * @param {number} b - Peso base
     * @param {number} p - Porcentaje (0-1)
     * @returns {number}
     */
    const pct = (b, p) => round(b * p);

    const programsData = [
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
            description: 'El programa de fuerza más eficiente para principiantes. Progresión lineal session-a-session con los movimientos fundamentales.',
            stats: [
                { icon: 'calendar_month', label: '12 semanas' },
                { icon: 'repeat', label: '3 días/sem' },
                { icon: 'trending_up', label: 'Progresión lineal' },
                { icon: 'fitness_center', label: '5 movimientos' },
            ],
            inputs: [
                { id: 'sq', label: 'Sentadilla 1RM', default: 60 },
                { id: 'dl', label: 'Peso Muerto 1RM', default: 80 },
                { id: 'bp', label: 'Press Banca 1RM', default: 50 },
                { id: 'ohp', label: 'Press Militar 1RM', default: 35 },
                { id: 'pc', label: 'Power Clean (inicial)', default: 30 },
            ],
            generate(rms) {
                const sqW_start = pct(rms.sq, .55), dlW_start = pct(rms.dl, .55), bpW_start = pct(rms.bp, .55), ohpW_start = pct(rms.ohp, .55), pcW_start = pct(rms.pc, .65);
                const weeks = [];
                let sqW = sqW_start, dlW = dlW_start, bpW = bpW_start, ohpW = ohpW_start, pcW = pcW_start;

                for (let w = 1; w <= 4; w++) {
                    const scheme = w % 2 === 1 ? 'ABA' : 'BAB';
                    const days = scheme === 'ABA'
                        ? [
                            { label: 'Sesión A', lifts: [{ name: 'Sentadilla', w: sqW, sets: '3×5', incr: 2.5 }, { name: 'Press Militar', w: ohpW, sets: '3×5', incr: 1.25 }, { name: 'Peso Muerto', w: dlW, sets: '1×5', incr: 2.5 }] },
                            { label: 'Sesión B', lifts: [{ name: 'Sentadilla', w: sqW, sets: '3×5', incr: 2.5 }, { name: 'Press Banca', w: bpW, sets: '3×5', incr: 1.25 }, { name: 'Power Clean', w: pcW, sets: '5×3', incr: 2.5 }] },
                            { label: 'Sesión A', lifts: [{ name: 'Sentadilla', w: sqW + 2.5, sets: '3×5', incr: 2.5 }, { name: 'Press Militar', w: ohpW + 1.25, sets: '3×5', incr: 1.25 }, { name: 'Peso Muerto', w: dlW + 2.5, sets: '1×5', incr: 2.5 }] },
                        ]
                        : [
                            { label: 'Sesión B', lifts: [{ name: 'Sentadilla', w: sqW, sets: '3×5', incr: 2.5 }, { name: 'Press Banca', w: bpW, sets: '3×5', incr: 1.25 }, { name: 'Power Clean', w: pcW, sets: '5×3', incr: 2.5 }] },
                            { label: 'Sesión A', lifts: [{ name: 'Sentadilla', w: sqW + 2.5, sets: '3×5', incr: 2.5 }, { name: 'Press Militar', w: ohpW + 1.25, sets: '3×5', incr: 1.25 }, { name: 'Peso Muerto', w: dlW + 2.5, sets: '1×5', incr: 2.5 }] },
                            { label: 'Sesión B', lifts: [{ name: 'Sentadilla', w: sqW + 5, sets: '3×5', incr: 2.5 }, { name: 'Press Banca', w: bpW + 1.25, sets: '3×5', incr: 1.25 }, { name: 'Power Clean', w: pcW + 2.5, sets: '5×3', incr: 2.5 }] },
                        ];
                    weeks.push({ label: `Semana ${w}`, phase: scheme, phaseColor: '#10B981', days });
                    sqW += 7.5; dlW += 5; bpW += 3.75; ohpW += 3.75; pcW += 7.5;
                }
                return weeks;
            }
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
            description: 'Dos sesiones alternadas con los 5 movimientos básicos.',
            stats: [
                { icon: 'calendar_month', label: '12 semanas' },
                { icon: 'repeat', label: '3 días/sem' },
                { icon: 'trending_up', label: 'Progresión lineal' },
                { icon: 'stacked_bar_chart', label: '5×5 volumen' },
            ],
            inputs: [
                { id: 'sq', label: 'Sentadilla 1RM', default: 60 },
                { id: 'dl', label: 'Peso Muerto 1RM', default: 80 },
                { id: 'bp', label: 'Press Banca 1RM', default: 50 },
                { id: 'row', label: 'Remo con barra 1RM', default: 55 },
                { id: 'ohp', label: 'Press Militar 1RM', default: 35 },
            ],
            generate(rms) {
                const sq_start = pct(rms.sq, .5), dl_start = pct(rms.dl, .5), bp_start = pct(rms.bp, .5), row_start = pct(rms.row, .5), ohp_start = pct(rms.ohp, .5);
                const weeks = [];
                let sq = sq_start, dl = dl_start, bp = bp_start, row = row_start, ohp = ohp_start;

                for (let w = 1; w <= 4; w++) {
                    weeks.push({
                        label: `Semana ${w}`,
                        phaseColor: '#F97316',
                        days: [
                            { label: 'Sesión A', lifts: [{ name: 'Sentadilla', w: sq, sets: '5×5', incr: 2.5 }, { name: 'Press Banca', w: bp, sets: '5×5', incr: 1.25 }, { name: 'Remo con barra', w: row, sets: '5×5', incr: 1.25 }] },
                            { label: 'Sesión B', lifts: [{ name: 'Sentadilla', w: sq + 2.5, sets: '5×5', incr: 2.5 }, { name: 'Press Militar', w: ohp, sets: '5×5', incr: 1.25 }, { name: 'Peso Muerto', w: dl, sets: '1×5', incr: 2.5 }] },
                            { label: 'Sesión A', lifts: [{ name: 'Sentadilla', w: sq + 5, sets: '5×5', incr: 2.5 }, { name: 'Press Banca', w: bp + 1.25, sets: '5×5', incr: 1.25 }, { name: 'Remo con barra', w: row + 1.25, sets: '5×5', incr: 1.25 }] },
                        ]
                    });
                    sq += 7.5; dl += 5; bp += 3.75; row += 3.75; ohp += 3.75;
                }
                return weeks;
            }
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
            description: 'Progresión lineal estructurada en 3 tiers.',
            stats: [
                { icon: 'calendar_month', label: '10 semanas' },
                { icon: 'repeat', label: '4 días/sem' },
                { icon: 'layers', label: '3 tiers de trabajo' },
                { icon: 'trending_up', label: 'Fallo = cambio de scheme' },
            ],
            inputs: [
                { id: 'sq', label: 'Sentadilla 1RM', default: 80 },
                { id: 'hp', label: 'Hip Hinge 1RM', default: 100 },
                { id: 'bp', label: 'Press Horizontal 1RM', default: 65 },
                { id: 'pull', label: 'Pull Vertical 1RM', default: 60 },
            ],
            generate(rms) {
                const t1Schemes = ['5×3+', '6×2+', '10×1+'];
                const t2Schemes = ['3×10+', '3×8+', '3×6+'];

                const weekFn = (w, t1Idx, t2Idx) => {
                    const t1s = t1Schemes[Math.min(t1Idx, 2)], t2s = t2Schemes[Math.min(t2Idx, 2)];
                    const t1Perc = t1Idx === 0 ? .85 : t1Idx === 1 ? .90 : .95;
                    const t2Perc = t2Idx === 0 ? .65 : t2Idx === 1 ? .70 : .75;

                    const dayFn = (label, t1Name, t1Base, t2Name, t2Base) => ({
                        label,
                        lifts: [
                            { name: `[T1] ${t1Name}`, w: pct(t1Base, t1Perc), sets: t1s, type: 'T1', color: '#EF4444' },
                            { name: `[T2] ${t2Name}`, w: pct(t2Base, t2Perc), sets: t2s, type: 'T2', color: '#3B82F6' },
                            { name: `[T3] Asistencia`, w: 0, sets: '3×15+ pc', type: 'T3', color: '#64748B' },
                        ]
                    });

                    return {
                        label: `Semana ${w}`,
                        phaseColor: '#8B5CF6',
                        phase: `T1: ${t1s} T2: ${t2s}`,
                        days: [
                            dayFn('Día A — Lower + Upper', 'Sentadilla', rms.sq, 'Press Horizontal', rms.bp),
                            dayFn('Día B — Upper + Lower', 'Press Horiz.', rms.bp, 'Hip Hinge', rms.hp),
                            dayFn('Día C — Lower + Upper', 'Hip Hinge', rms.hp, 'Sentadilla', rms.sq),
                            dayFn('Día D — Upper + Lower', 'Pull Vertical', rms.pull, 'Press Horizontal', rms.bp),
                        ]
                    };
                };

                return [weekFn(1, 0, 0), weekFn(2, 0, 0), weekFn(3, 1, 1), weekFn(4, 1, 1)];
            }
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
            description: 'El programa de fuerza a largo plazo más utilizado.',
            stats: [
                { icon: 'calendar_month', label: '4 sem/ciclo' },
                { icon: 'repeat', label: '4 días/sem' },
                { icon: 'show_chart', label: '+2.5kg / +1.25kg ciclo' },
                { icon: 'psychology', label: 'AMRAP en la serie tope' },
            ],
            inputs: [
                { id: 'sq', label: 'Sentadilla 1RM', default: 120 },
                { id: 'dl', label: 'Peso Muerto 1RM', default: 160 },
                { id: 'bp', label: 'Press Banca 1RM', default: 90 },
                { id: 'ohp', label: 'Press Militar 1RM', default: 60 },
            ],
            weekConfig: [
                { w: 1, name: 'Volumen', reps: '5+', percs: [.65, .75, .85], phase: 'VOL', phaseColor: '#10B981' },
                { w: 2, name: 'Híbrido', reps: '3+', percs: [.70, .80, .90], phase: 'HYB', phaseColor: '#F59E0B' },
                { w: 3, name: 'Pico', reps: '1+', percs: [.75, .85, .95], phase: 'PEAK', phaseColor: '#EF4444' },
                { w: 4, name: 'Descarga', reps: '5', percs: [.40, .50, .60], phase: 'DLD', phaseColor: '#64748B' },
            ],
            generate(rms) {
                const TM = { sq: round(rms.sq * .9), dl: round(rms.dl * .9), bp: round(rms.bp * .9), ohp: round(rms.ohp * .9) };
                const lifts = [
                    { id: 'sq', name: 'Sentadilla', tm: TM.sq },
                    { id: 'bp', name: 'Press Banca', tm: TM.bp },
                    { id: 'dl', name: 'Peso Muerto', tm: TM.dl },
                    { id: 'ohp', name: 'Press Militar', tm: TM.ohp },
                ];

                return this.weekConfig.map(wk => {
                    const isDeload = wk.w === 4;
                    const days = lifts.map((l, i) => {
                        const sets = isDeload
                            ? [{ label: `40%`, w: pct(l.tm, .40), sets: '5 reps', amrap: false }, { label: `50%`, w: pct(l.tm, .50), sets: '5 reps', amrap: false }, { label: `60%`, w: pct(l.tm, .60), sets: '5 reps', amrap: false }]
                            : wk.percs.map((p, pi) => ({ label: `${Math.round(p * 100)}%`, w: pct(l.tm, p), sets: pi < 2 ? '5 reps' : wk.reps, amrap: pi === 2 }));

                        const bbbW = isDeload ? null : pct(l.tm, .50);
                        return {
                            label: `Día ${i + 1} — ${l.name}`,
                            lifts: [
                                ...sets.map(s => ({ name: l.name, w: s.w, sets: s.sets, type: s.amrap ? 'AMRAP' : null, sublabel: s.label })),
                                ...(bbbW ? [{ name: `${l.name} (BBB)`, w: bbbW, sets: '5×10', type: 'BBB', color: '#475569' }] : []),
                                { name: 'Asistencia push/pull/core', w: 0, sets: '3-4 series', type: 'ACC', color: '#334155' }
                            ]
                        };
                    });
                    return { label: `Semana ${wk.w} — ${wk.name}`, phase: wk.phase, phaseColor: wk.phaseColor, days, meta: `TM: SQ ${TM.sq} | BP ${TM.bp} | DL ${TM.dl} | OHP ${TM.ohp}` };
                });
            }
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
            description: 'Rotación de estímulos.',
            stats: [
                { icon: 'calendar_month', label: '3 sem/ola' },
                { icon: 'repeat', label: '3 días/sem' },
                { icon: 'rotate_3d', label: 'Rotación Pesado/Explosivo/Reps' },
                { icon: 'bolt', label: 'Énfasis en potencia' },
            ],
            inputs: [
                { id: 'sq', label: 'Sentadilla 1RM', default: 140 },
                { id: 'bp', label: 'Press Banca 1RM', default: 105 },
                { id: 'dl', label: 'Peso Muerto 1RM', default: 185 },
            ],
            matrix: {
                SQ: [{ type: 'Pesado', sets: '5×2', perc: .80, color: '#EF4444', note: 'Serie tope, máxima tensión' }, { type: 'Explosivo', sets: '8×3', perc: .60, color: '#3B82F6', note: 'Velocidad máxima en la suba' }, { type: 'Reps', sets: '1×8+', perc: .70, color: '#F59E0B', note: 'AMRAP controlado' }],
                BP: [{ type: 'Reps', sets: '1×8+', perc: .70, color: '#F59E0B', note: 'AMRAP controlado' }, { type: 'Pesado', sets: '5×2', perc: .80, color: '#EF4444', note: 'Serie tope, máxima tensión' }, { type: 'Explosivo', sets: '8×3', perc: .60, color: '#3B82F6', note: 'Pausa de 1 seg en el pecho' }],
                DL: [{ type: 'Explosivo', sets: '8×3', perc: .60, color: '#3B82F6', note: 'Pies en suelo entre reps' }, { type: 'Reps', sets: '1×8+', perc: .70, color: '#F59E0B', note: 'AMRAP controlado' }, { type: 'Pesado', sets: '5×2', perc: .80, color: '#EF4444', note: 'Serie tope, máxima tensión' }],
            },
            generate(rms) {
                const TM = { sq: round(rms.sq * .95), bp: round(rms.bp * .95), dl: round(rms.dl * .95) };
                const weekFocus = ['Sentadilla Pesada', 'Peso Muerto Pesado', 'Banca Pesada'];

                return [1, 2, 3].map(w => {
                    const sqCfg = this.matrix.SQ[w - 1], bpCfg = this.matrix.BP[w - 1], dlCfg = this.matrix.DL[w - 1];
                    return {
                        label: `Semana ${w} — Foco: ${weekFocus[w - 1]}`,
                        phase: sqCfg.type === 'Pesado' ? 'SQ HEAVY' : bpCfg.type === 'Pesado' ? 'BP HEAVY' : 'DL HEAVY',
                        phaseColor: '#06B6D4',
                        days: [
                            { label: 'Día 1 — Sentadilla', lifts: [{ name: 'Sentadilla', w: pct(TM.sq, sqCfg.perc), sets: sqCfg.sets, type: sqCfg.type, color: sqCfg.color, sublabel: `${Math.round(sqCfg.perc * 100)}% TM`, note: sqCfg.note }, { name: 'Asistencia tren inferior', w: 0, sets: '3-4 series', type: 'ACC', color: '#334155' }] },
                            { label: 'Día 2 — Press Banca', lifts: [{ name: 'Press Banca', w: pct(TM.bp, bpCfg.perc), sets: bpCfg.sets, type: bpCfg.type, color: bpCfg.color, sublabel: `${Math.round(bpCfg.perc * 100)}% TM`, note: bpCfg.note }, { name: 'Asistencia tren superior', w: 0, sets: '3-4 series', type: 'ACC', color: '#334155' }] },
                            { label: 'Día 3 — Peso Muerto', lifts: [{ name: 'Peso Muerto', w: pct(TM.dl, dlCfg.perc), sets: dlCfg.sets, type: dlCfg.type, color: dlCfg.color, sublabel: `${Math.round(dlCfg.perc * 100)}% TM`, note: dlCfg.note }, { name: 'Asistencia posterior', w: 0, sets: '3-4 series', type: 'ACC', color: '#334155' }] },
                        ],
                        meta: `TM: SQ ${TM.sq} | BP ${TM.bp} | DL ${TM.dl}`
                    };
                });
            }
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
            description: 'División Push/Pull/Legs repetida dos veces por semana.',
            stats: [
                { icon: 'calendar_month', label: '8 semanas' },
                { icon: 'repeat', label: '6 días/sem' },
                { icon: 'self_improvement', label: 'Foco hipertrofia' },
                { icon: 'stacked_bar_chart', label: 'Alto volumen' },
            ],
            inputs: [
                { id: 'bp', label: 'Press Banca 1RM', default: 80 },
                { id: 'row', label: 'Remo con barra 1RM', default: 80 },
                { id: 'sq', label: 'Sentadilla 1RM', default: 100 },
                { id: 'rdl', label: 'Peso Muerto Rumano 1RM', default: 90 },
            ],
            sessions: {
                PUSH: [{ name: 'Press Banca', pct: .72, sets: '4×8-12', note: 'RIR 2-3' }, { name: 'Press Inclinado', pct: .65, sets: '3×10-12', note: '' }, { name: 'Press Militar', pct: .62, sets: '4×8-12', note: '' }, { name: 'Elevaciones Lat.', pct: .40, sets: '4×12-15', note: 'Cables o mancuernas' }, { name: 'Extensión Tríceps', pct: .45, sets: '3×12-15', note: 'Polea' }, { name: 'Fondos', pct: 0, sets: '3×máx', note: 'Peso corporal' }],
                PULL: [{ name: 'Jalón al pecho', pct: .68, sets: '4×8-12', note: 'RIR 2-3' }, { name: 'Remo con barra', pct: .72, sets: '4×8-10', note: '' }, { name: 'Remo en cable', pct: .60, sets: '3×12', note: '' }, { name: 'Curl con barra', pct: .50, sets: '4×10-12', note: '' }, { name: 'Curl martillo', pct: .42, sets: '3×12', note: '' }, { name: 'Face pull', pct: .30, sets: '3×15', note: 'Hombro posterior' }],
                LEGS: [{ name: 'Sentadilla', pct: .75, sets: '4×6-10', note: 'RIR 2-3' }, { name: 'Prensa de piernas', pct: .70, sets: '3×10-12', note: '' }, { name: 'P. Muerto Rumano', pct: .72, sets: '4×8-10', note: '' }, { name: 'Extensión cuádriceps', pct: .55, sets: '3×12-15', note: 'Máquina' }, { name: 'Curl femoral', pct: .50, sets: '3×12-15', note: 'Máquina' }, { name: 'Elevación talones', pct: 0, sets: '4×15-20', note: 'Gemelos' }],
            },
            generate(rms) {
                const weeks = [];
                for (let w = 1; w <= 4; w++) {
                    const progFactor = 1 + (w - 1) * .03;
                    const days = ['PUSH', 'PULL', 'LEGS', 'PUSH', 'PULL', 'LEGS'].map((type, di) => ({
                        label: `Día ${di + 1} — ${type}`,
                        lifts: this.sessions[type].map(ex => {
                            const base = type === 'PUSH' ? rms.bp : type === 'PULL' ? rms.row : type === 'LEGS' && ex.name.includes('Sentadilla') ? rms.sq : type === 'LEGS' && ex.name.includes('Rumano') ? rms.rdl : type === 'LEGS' ? rms.sq * .6 : rms.bp;
                            const weight = ex.pct > 0 ? pct(base * progFactor, ex.pct) : 0;
                            return { name: ex.name, w: weight, sets: ex.sets, note: ex.note, type: null, color: null };
                        })
                    }));
                    weeks.push({ label: `Semana ${w}`, phase: `CICLO ${w}`, phaseColor: '#EC4899', days });
                }
                return weeks;
            }
        },
    ];

    return {
        round,
        pct,
        PROGRAMS: programsData,
        getProgram(id) {
            return programsData.find(p => p.id === id);
        }
    };
})();

window.trainingEngine = TrainingEngine;
