const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTfScript } = require('../test-utils.cjs');

const tfTrainingMath = loadTfScript('training-math.js');
const { roundWeight, pct, estimate1RM, estimateRPE } = tfTrainingMath;

/* ═══════════════════════════════════════════════════════
   roundWeight()
═══════════════════════════════════════════════════════ */

test('roundWeight: redondea a 2.5kg por defecto', () => {
  assert.equal(roundWeight(73.75), 75);
  assert.equal(roundWeight(52.1), 52.5);
  assert.equal(roundWeight(53.35), 52.5);
  assert.equal(roundWeight(51.25), 52.5);
});

test('roundWeight: redondea a step custom', () => {
  assert.equal(roundWeight(73.75, 5), 75);
  assert.equal(roundWeight(73.75, 1), 74);
  assert.equal(roundWeight(73.75, 10), 70);
});

test('roundWeight: maneja 0 y negativos', () => {
  assert.equal(roundWeight(0), 0);
  assert.equal(roundWeight(0, 5), 0);
  assert.equal(roundWeight(-5, 2.5), -5);
});

test('roundWeight: devuelve valor exacto si step=0', () => {
  assert.equal(roundWeight(73.75, 0), 73.75);
});

/* ═══════════════════════════════════════════════════════
   pct()
═══════════════════════════════════════════════════════ */

test('pct: calcula porcentaje y redondea', () => {
  assert.equal(pct(100, 0.85), 85);
  assert.equal(pct(100, 0.55), 55);
  assert.equal(pct(100, 0.75), 75);
});

test('pct: redondea al step correcto', () => {
  assert.equal(pct(97, 0.55), 52.5);    // 97 * 0.55 = 53.35 → 52.5
  assert.equal(pct(97, 0.55, 5), 55);    // 97 * 0.55 = 53.35 → 55
});

/* ═══════════════════════════════════════════════════════
   estimate1RM()
═══════════════════════════════════════════════════════ */

test('estimate1RM: con 1 rep devuelve el mismo peso redondeado', () => {
  assert.equal(estimate1RM(100, 1), 100);
  assert.equal(estimate1RM(97, 1), 97.5);
});

test('estimate1RM: estimación con reps razonables', () => {
  const e1rm5 = estimate1RM(100, 5);
  // Brzycki: 100 * 36 / (37-5) = 112.5
  assert.equal(e1rm5, 112.5);

  const e1rm8 = estimate1RM(100, 8);
  // Brzycki: 100 * 36 / (37-8) ≈ 124.14 → 125
  assert.equal(e1rm8, 125);
});

test('estimate1RM: maneja 0 reps', () => {
  assert.equal(estimate1RM(100, 0), 0);
});

/* ═══════════════════════════════════════════════════════
   estimateRPE()
═══════════════════════════════════════════════════════ */

test('estimateRPE: retorna un valor entre 1 y 10', () => {
  const rpe = estimateRPE(0.85, 5);
  assert.ok(rpe >= 1, `RPE ${rpe} should be >= 1`);
  assert.ok(rpe <= 10, `RPE ${rpe} should be <= 10`);
});

test('estimateRPE: floor 1 y ceiling 10', () => {
  assert.equal(estimateRPE(0.1, 1), 1);
  assert.equal(estimateRPE(1.0, 10), 10);
});
