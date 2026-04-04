const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTfScript } = require('../test-utils.cjs');

const tfTrainingEngine = loadTfScript('training-engine.js');
const {
  round,
  pct,
  PROGRAMS,
  generateStartingStrength,
  generateStrongLifts,
  generateGZCLP,
  generateWendler531,
  generateCubeMethod,
  generatePPL,
  generateProgram
} = tfTrainingEngine;

test('round and pct provide deterministic defaults', () => {
  assert.equal(round(73.75), 75);
  assert.equal(pct(100, 0.55), 55);
});

test('PROGRAMS contains all 6 programs', () => {
  assert.equal(PROGRAMS.length, 6);
  const ids = PROGRAMS.map(p => p.id);
  assert.ok(ids.includes('starting-strength'));
  assert.ok(ids.includes('stronglifts-5x5'));
  assert.ok(ids.includes('gzclp'));
  assert.ok(ids.includes('wendler-531'));
  assert.ok(ids.includes('cube-method'));
  assert.ok(ids.includes('ppl'));
});

test('Starting Strength first squat weight is 55% of 1RM', () => {
  const weeks = generateStartingStrength({ sq: 60, dl: 80, bp: 50, ohp: 35, pc: 30 });
  const squat = weeks[0].days[0].lifts.find(l => l.name === 'Sentadilla');
  assert.equal(squat.w, 32.5);
});

test('Wendler week 4 is deload (lower percentages)', () => {
  const weeks = generateWendler531({ sq: 120, dl: 160, bp: 90, ohp: 60 });
  assert.ok(weeks[3].label.includes('Descarga'));
  assert.equal(weeks[3].phase, 'DLD');
});

test('generateProgram dispatches correctly', () => {
  const weeks = generateProgram('starting-strength', { sq: 60, dl: 80, bp: 50, ohp: 35, pc: 30 });
  assert.equal(weeks.length, 4);
});
