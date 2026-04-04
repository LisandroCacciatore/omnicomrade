/**
 * training-math.js
 * TechFitness — Funciones Matemáticas de Entrenamiento
 *
 * Cálculos puros de pesos, porcentajes y estimaciones de 1RM.
 * Sin dependencias de DOM ni de otros módulos.
 *
 * Exports (global): window.tfTrainingMath
 * Exports (CJS):    require('./training-math')
 */

(function (global) {
  /**
   * Redondea un peso al múltiplo más cercano del step.
   * Útil para ajustar cargas a los discos disponibles en un gimnasio.
   * @param {number} value - Peso en kg a redondear
   * @param {number} [step=2.5] - Paso de redondeo en kg (default: 2.5kg)
   * @returns {number} Peso redondeado al step más cercano
   * @example
   * roundWeight(73.75)       // => 75
   * roundWeight(73.75, 5)    // => 75
   * roundWeight(53.35, 2.5)  // => 52.5
   * roundWeight(0, 2.5)      // => 0
   */
  function roundWeight(value, step) {
    if (step === undefined) step = 2.5;
    if (step === 0) return value;
    return Math.round(value / step) * step;
  }

  /**
   * Calcula un porcentaje de un peso base y lo redondea al step.
   * Combina multiplicación + redondeo en una sola llamada.
   * @param {number} base - Peso base (1RM o Training Max)
   * @param {number} percent - Porcentaje como decimal (0-1), ej: 0.85 para 85%
   * @param {number} [step=2.5] - Paso de redondeo en kg
   * @returns {number} Peso calculado y redondeado
   * @example
   * pct(100, 0.85)      // => 85
   * pct(100, 0.55)      // => 55
   * pct(97, 0.55)       // => 52.5 (97*0.55=53.35, rounded to 52.5)
   * pct(120, 0.725, 5)  // => 85 (120*0.725=87, rounded to 85)
   */
  function pct(base, percent, step) {
    if (step === undefined) step = 2.5;
    return roundWeight(base * percent, step);
  }

  /**
   * Estima el 1RM (One Rep Max) usando la fórmula de Brzycki.
   * Válido para rangos de 2-12 repeticiones.
   * @param {number} weight - Peso levantado (kg)
   * @param {number} reps - Número de repeticiones completadas (1-12)
   * @returns {number} Estimación del 1RM redondeada a 2.5kg
   * @example
   * estimate1RM(100, 5)  // => 112.5 (aprox)
   * estimate1RM(80, 10)  // => 107.5 (aprox)
   * estimate1RM(100, 1)  // => 100
   */
  function estimate1RM(weight, reps) {
    if (reps <= 0) return 0;
    if (reps === 1) return roundWeight(weight);
    // Fórmula de Brzycki: weight × 36 / (37 - reps)
    return roundWeight(weight * 36 / (37 - reps));
  }

  /**
   * Calcula el RPE (Rate of Perceived Exertion) teórico basado en %1RM y repeticiones.
   * Fórmula simplificada: RPE ≈ reps + (percentage * 10 - 5)
   * @param {number} percentage - Porcentaje del 1RM (0-1)
   * @param {number} reps - Número de repeticiones
   * @returns {number} RPE estimado (1-10)
   */
  function estimateRPE(percentage, reps) {
    var raw = reps + (percentage * 10 - 5);
    return Math.max(1, Math.min(10, Math.round(raw * 10) / 10));
  }

  /* ─── Public API ────────────────────────────────────────── */

  var api = { roundWeight: roundWeight, pct: pct, estimate1RM: estimate1RM, estimateRPE: estimateRPE };

  global.tfTrainingMath = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
