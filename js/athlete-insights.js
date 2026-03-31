/**
 * athlete-insights.js
 * TechFitness — Capa 3: Score del atleta, predicciones y riesgo
 * Cargado como módulo compartido. Expone window.AthleteInsights
 */

window.AthleteInsights = (() => {

  /* ══════════════════════════════════════════════════════════
     SCORE COMBINADO DEL ATLETA (0-100)
     Bienestar 30pts · Consistencia 25pts · Progresión 25pts · Fatiga 20pts
  ══════════════════════════════════════════════════════════ */
  function calcAthleteScore({ wbLogs = [], sessions = [], logs = [], daysPerWeek = 3 }) {
    const now = new Date();

    // ── Componente 1: Bienestar 7 días (30 pts) ────────────
    const wb7 = wbLogs.filter(w => daysDiff(now, new Date(w.checked_at)) <= 7);
    let wbScore = 0;
    if (wb7.length > 0) {
      const avgSleep  = avg(wb7.map(w => w.sleep));
      const avgPain   = avg(wb7.map(w => w.pain));
      const avgEnergy = avg(wb7.map(w => w.energy));
      wbScore = Math.round((avgSleep/5*30 + avgEnergy/5*40 + (6-avgPain)/5*30));
    }
    const wbPts = Math.round((wbScore / 100) * 30);

    // ── Componente 2: Consistencia 30 días (25 pts) ────────
    const sess30 = sessions.filter(s =>
      s.completed_at && daysDiff(now, new Date(s.completed_at)) <= 30
    );
    const expectedSessions = (daysPerWeek / 7) * 30;
    const consistencyRatio = Math.min(1, sess30.length / Math.max(1, expectedSessions));
    const consistencyPts   = Math.round(consistencyRatio * 25);

    // ── Componente 3: Progresión 30 días (25 pts) ──────────
    const sess30Ids = new Set(sess30.map(s => s.id));
    const recentLogs = logs.filter(l => sess30Ids.has(l.session_id) && l.weight_used > 0);

    const byEx = {};
    recentLogs.forEach(l => {
      const s = sessions.find(s => s.id === l.session_id);
      if (!s) return;
      if (!byEx[l.exercise_name]) byEx[l.exercise_name] = [];
      byEx[l.exercise_name].push({ date: new Date(s.completed_at), weight: parseFloat(l.weight_used) });
    });

    let improving = 0, total = 0;
    Object.values(byEx).forEach(points => {
      if (points.length < 2) return;
      points.sort((a, b) => a.date - b.date);
      const first = points[0].weight, last = points[points.length - 1].weight;
      total++;
      if (last >= first) improving++;
    });
    const progressionPts = total > 0 ? Math.round((improving / total) * 25) : 12; // neutral if no data

    // ── Componente 4: Fatiga acumulada (20 pts) ────────────
    const logs7 = logs.filter(l => {
      const s = sessions.find(s => s.id === l.session_id);
      return s?.completed_at && daysDiff(now, new Date(s.completed_at)) <= 7;
    });
    let fatiguePts = 20; // máximo si sin datos
    if (logs7.length > 0) {
      const effortMap = { facil: 1, normal: 2, muy_pesado: 3, al_fallo: 4 };
      const avgEffort = avg(logs7.map(l => effortMap[l.effort_level] || 2));
      const pctFailed = logs7.filter(l => l.status === 'fallido').length / logs7.length;
      // Esfuerzo ideal = 2.5, penalizar desvíos
      fatiguePts = Math.round(Math.max(0, 20 - (avgEffort - 2.5) * 8 - pctFailed * 20));
    }

    const total_score = Math.min(100, wbPts + consistencyPts + progressionPts + fatiguePts);

    return {
      total_score,
      components: { wbPts, consistencyPts, progressionPts, fatiguePts },
      wbScore,
      improving,
      totalExercises: total,
      sess30Count: sess30.length,
    };
  }

  function getScoreLevel(score) {
    if (score >= 75) return { level: 'elite',   label: 'Rendimiento óptimo',  color: '#10B981', bg: 'rgba(16,185,129,.1)',  border: 'rgba(16,185,129,.25)', emoji: '🏆' };
    if (score >= 55) return { level: 'bueno',   label: 'En buen camino',      color: '#3B82F6', bg: 'rgba(59,130,246,.1)',  border: 'rgba(59,130,246,.25)', emoji: '💪' };
    if (score >= 35) return { level: 'regular', label: 'Requiere atención',   color: '#F59E0B', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.25)', emoji: '⚠️' };
    return              { level: 'critico',  label: 'Alerta de rendimiento', color: '#EF4444', bg: 'rgba(239,68,68,.1)',  border: 'rgba(239,68,68,.25)',  emoji: '🔴' };
  }

  /* ══════════════════════════════════════════════════════════
     PREDICCIÓN DE SESIÓN MALA
  ══════════════════════════════════════════════════════════ */
  function predictSessionQuality({ wbLogs = [], logs = [], sessions = [] }) {
    const now    = new Date();
    const flags  = [];
    let   risk   = 0;

    // ── Flag 1: Wellbeing últimos 3 días bajo ──────────────
    const wb3 = wbLogs
      .filter(w => daysDiff(now, new Date(w.checked_at)) <= 3)
      .sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at));

    if (wb3.length >= 2) {
      const scores3 = wb3.map(w => w.sleep/5*30 + w.energy/5*40 + (6-w.pain)/5*30);
      const avg3 = avg(scores3);
      if (avg3 < 40) {
        risk += 35;
        flags.push({ icon: '😴', msg: 'Bienestar bajo en los últimos días', severity: 'alta' });
      } else if (avg3 < 55) {
        risk += 20;
        flags.push({ icon: '🟡', msg: 'Bienestar moderado — sesión con precaución', severity: 'media' });
      }
    }

    // ── Flag 2: Sueño < 2 por 2 días consecutivos ──────────
    const recentSleep = wbLogs
      .filter(w => daysDiff(now, new Date(w.checked_at)) <= 3)
      .sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at))
      .map(w => w.sleep);
    const poorSleepStreak = recentSleep.filter(s => s <= 2).length;
    if (poorSleepStreak >= 2) {
      risk += 25;
      flags.push({ icon: '💤', msg: `${poorSleepStreak} noches con sueño deficiente seguidas`, severity: 'alta' });
    }

    // ── Flag 3: Última sesión con muchas series fallidas ───
    const lastSess = sessions
      .filter(s => s.completed_at)
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))[0];

    if (lastSess) {
      const lastLogs = logs.filter(l => l.session_id === lastSess.id);
      const failedCount = lastLogs.filter(l => l.status === 'fallido' || l.effort_level === 'al_fallo').length;
      if (failedCount >= 3) {
        risk += 20;
        flags.push({ icon: '⚡', msg: `Última sesión: ${failedCount} series al fallo/fallidas`, severity: 'media' });
      }
    }

    // ── Flag 4: Dolor alto hoy ─────────────────────────────
    const todayWb = wbLogs.find(w => daysDiff(now, new Date(w.checked_at)) === 0);
    if (todayWb?.pain >= 4) {
      risk += 20;
      const zone = todayWb.pain_zone && todayWb.pain_zone !== 'ninguno'
        ? ` (${todayWb.pain_zone.replace('_', ' ')})` : '';
      flags.push({ icon: '🩺', msg: `Dolor alto reportado hoy${zone}`, severity: 'alta' });
    }

    const level = risk >= 60 ? 'mala' : risk >= 35 ? 'moderada' : 'buena';
    const labels = {
      mala:     { label: 'Sesión probablemente difícil', color: '#EF4444', emoji: '🔴' },
      moderada: { label: 'Sesión con posibles dificultades', color: '#F59E0B', emoji: '🟡' },
      buena:    { label: 'Condiciones favorables hoy', color: '#10B981', emoji: '🟢' },
    };

    return { risk: Math.min(100, risk), level, flags, ...labels[level] };
  }

  /* ══════════════════════════════════════════════════════════
     RIESGO DE SOBRECARGA Y ABANDONO
  ══════════════════════════════════════════════════════════ */
  function calcRisks({ wbLogs = [], sessions = [], logs = [], daysPerWeek = 3 }) {
    const now = new Date();

    // ── RIESGO SOBRECARGA ──────────────────────────────────
    const overloadFlags = [];
    let overloadRisk = 0;

    // Tendencia de esfuerzo 7d vs 7d anterior
    const makeEffortAvg = (s_list) => {
      const ls = logs.filter(l => s_list.some(s => s.id === l.session_id));
      if (!ls.length) return null;
      const m = { facil:1, normal:2, muy_pesado:3, al_fallo:4 };
      return avg(ls.map(l => m[l.effort_level] || 2));
    };

    const sess7d  = sessions.filter(s => s.completed_at && daysDiff(now, new Date(s.completed_at)) <= 7);
    const sess7_14 = sessions.filter(s => s.completed_at && daysDiff(now, new Date(s.completed_at)) > 7 && daysDiff(now, new Date(s.completed_at)) <= 14);

    const effort7d  = makeEffortAvg(sess7d);
    const effort14d = makeEffortAvg(sess7_14);

    if (effort7d !== null && effort14d !== null && effort7d > effort14d + 0.5) {
      overloadRisk += 30;
      overloadFlags.push({ icon: '📈', msg: `Esfuerzo subiendo (${effort14d.toFixed(1)} → ${effort7d.toFixed(1)}/4)` });
    }

    // Wellbeing bajando mientras volumen sube
    const wb7avg  = wbLogs.filter(w => daysDiff(now, new Date(w.checked_at)) <= 7);
    const wb14avg = wbLogs.filter(w => daysDiff(now, new Date(w.checked_at)) > 7 && daysDiff(now, new Date(w.checked_at)) <= 14);
    const wbNow  = wb7avg.length  ? avg(wb7avg.map(w  => w.energy)) : null;
    const wbPrev = wb14avg.length ? avg(wb14avg.map(w => w.energy)) : null;

    if (wbNow !== null && wbPrev !== null && wbNow < wbPrev - 0.8) {
      overloadRisk += 25;
      overloadFlags.push({ icon: '🪫', msg: 'Energía cayendo semana a semana' });
    }

    // % series fallidas esta semana > 10%
    const logs7d = logs.filter(l => sess7d.some(s => s.id === l.session_id));
    const pctFailed = logs7d.length > 0 ? logs7d.filter(l => l.status === 'fallido').length / logs7d.length : 0;
    if (pctFailed > 0.1) {
      overloadRisk += Math.round(pctFailed * 100);
      overloadFlags.push({ icon: '❌', msg: `${Math.round(pctFailed*100)}% de series fallidas esta semana` });
    }

    // Dolor alto sostenido
    const highPainDays = wbLogs.filter(w => daysDiff(now, new Date(w.checked_at)) <= 7 && w.pain >= 4).length;
    if (highPainDays >= 2) {
      overloadRisk += 20;
      overloadFlags.push({ icon: '🩺', msg: `${highPainDays} días con dolor alto esta semana` });
    }

    // ── RIESGO ABANDONO ────────────────────────────────────
    const abandonFlags = [];
    let abandonRisk = 0;

    // Días desde última sesión
    const lastSess = sessions.filter(s => s.completed_at).sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))[0];
    const daysSinceLast = lastSess ? daysDiff(now, new Date(lastSess.completed_at)) : 999;

    if (daysSinceLast > 10) {
      abandonRisk += 40;
      abandonFlags.push({ icon: '📅', msg: `${daysSinceLast} días sin entrenar` });
    } else if (daysSinceLast > 5) {
      abandonRisk += 20;
      abandonFlags.push({ icon: '📅', msg: `${daysSinceLast} días desde la última sesión` });
    }

    // Caída de adherencia: esta semana vs semana anterior
    const sessionRatio = sess7_14.length > 0 ? sess7d.length / sess7_14.length : 1;
    if (sessionRatio < 0.5 && sess7_14.length >= 2) {
      abandonRisk += 25;
      abandonFlags.push({ icon: '📉', msg: `Caída de sesiones: ${sess7d.length} esta semana vs ${sess7_14.length} anterior` });
    }

    // Sin PRs en 4+ semanas (estancamiento como señal de abandono)
    const sess28d = sessions.filter(s => s.completed_at && daysDiff(now, new Date(s.completed_at)) <= 28);
    const sess28_56 = sessions.filter(s => s.completed_at && daysDiff(now, new Date(s.completed_at)) > 28 && daysDiff(now, new Date(s.completed_at)) <= 56);

    if (sess28d.length > 0 && sess28_56.length > 0) {
      const getMaxWeight = (sIds) => {
        const ls = logs.filter(l => sIds.has(l.session_id) && l.weight_used > 0);
        return ls.length ? Math.max(...ls.map(l => parseFloat(l.weight_used))) : 0;
      };
      const maxNow  = getMaxWeight(new Set(sess28d.map(s => s.id)));
      const maxPrev = getMaxWeight(new Set(sess28_56.map(s => s.id)));
      if (maxNow <= maxPrev && maxPrev > 0) {
        abandonRisk += 15;
        abandonFlags.push({ icon: '📊', msg: 'Sin progresión de peso en 4 semanas' });
      }
    }

    return {
      overload: { risk: Math.min(100, overloadRisk), flags: overloadFlags, level: overloadRisk >= 60 ? 'alto' : overloadRisk >= 30 ? 'medio' : 'bajo' },
      abandon:  { risk: Math.min(100, abandonRisk),  flags: abandonFlags,  level: abandonRisk  >= 60 ? 'alto' : abandonRisk  >= 30 ? 'medio' : 'bajo' },
    };
  }

  /* ══════════════════════════════════════════════════════════
     PROGRESIÓN AUTOMÁTICA DE RUTINA
  ══════════════════════════════════════════════════════════ */
  function calcAutoProgression({ logs = [], sessions = [] }) {
    const byEx = {};

    // Agrupar logs por ejercicio y sesión
    sessions
      .filter(s => s.completed_at)
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
      .slice(0, 10) // últimas 10 sesiones
      .forEach(s => {
        const sLogs = logs.filter(l => l.session_id === s.id && l.weight_used > 0);
        sLogs.forEach(l => {
          if (!byEx[l.exercise_name]) byEx[l.exercise_name] = [];
          byEx[l.exercise_name].push({
            date:    new Date(s.completed_at),
            weight:  parseFloat(l.weight_used),
            status:  l.status,
            effort:  l.effort_level,
            muscle:  l.muscle_group,
          });
        });
      });

    const suggestions = [];

    Object.entries(byEx).forEach(([exName, sets]) => {
      if (sets.length < 4) return; // necesitamos al menos 2 sesiones de datos

      sets.sort((a, b) => b.date - a.date);
      const lastDate  = sets[0].date;
      const lastSets  = sets.filter(s => s.date.getTime() === lastDate.getTime());
      // Sesión anterior
      const prevSets  = sets.filter(s => s.date.getTime() !== lastDate.getTime());

      if (!prevSets.length) return;

      const lastWeight  = Math.max(...lastSets.map(s => s.weight));
      const prevWeight  = Math.max(...prevSets.map(s => s.weight));
      const failedLast  = lastSets.filter(s => s.status === 'fallido').length;
      const falloLast   = lastSets.filter(s => s.effort === 'al_fallo').length;
      const totalLast   = lastSets.length;
      const muscle      = sets[0].muscle;

      let action, newWeight, reason;

      if (failedLast >= 2) {
        // 2+ series fallidas → bajar 5%
        action    = 'bajar';
        newWeight = Math.round((lastWeight * 0.95) / 2.5) * 2.5;
        reason    = `${failedLast} series fallidas en la última sesión`;
      } else if (falloLast >= totalLast * 0.5 && failedLast === 0) {
        // Mayoría al fallo sin fallar → mantener, consolidar
        action    = 'mantener';
        newWeight = lastWeight;
        reason    = 'Esfuerzo máximo — consolidar el peso antes de subir';
      } else if (failedLast === 0 && falloLast === 0 && lastWeight >= prevWeight) {
        // Todo bien, sin fallos → subir +2.5kg
        action    = 'subir';
        newWeight = lastWeight + 2.5;
        reason    = 'Todas las series completadas sin esfuerzo máximo';
      } else {
        return; // mixto, no hacer sugerencia
      }

      suggestions.push({
        exercise:    exName,
        muscle,
        current:     lastWeight,
        suggested:   newWeight,
        action,
        reason,
        delta:       newWeight - lastWeight,
      });
    });

    return suggestions.sort((a, b) => {
      const order = { bajar: 0, subir: 1, mantener: 2 };
      return order[a.action] - order[b.action];
    });
  }

  /* ── Helpers ─────────────────────────────────────────── */
  function avg(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }
  function daysDiff(a, b) {
    return Math.floor(Math.abs(a - b) / (1000 * 60 * 60 * 24));
  }

  // ── Public API ──────────────────────────────────────────
  return { calcAthleteScore, getScoreLevel, predictSessionQuality, calcRisks, calcAutoProgression };

})();

