const test = require('node:test');
const assert = require('node:assert/strict');

const {
  round,
  pct,
  generateStartingStrength,
  generateStrongLifts,
  generateProgram
} = require('../../js/training-engine');

test('round and pct provide deterministic defaults', () => {
  assert.equal(round(73.75), 75);
  assert.equal(pct(100, 0.55), 55);
});

test('generateStartingStrength returns 4 weeks and expected first squat', () => {
  const weeks = generateStartingStrength({ sq: 60, dl: 80, bp: 50, ohp: 35, pc: 30 });
  assert.equal(weeks.length, 4);
  assert.equal(weeks[0].days[0].lifts.find((l) => l.name === 'Sentadilla').w, 32.5);
});

test('generateStrongLifts returns 4 weeks x 3 days', () => {
  const weeks = generateStrongLifts({ sq: 60, dl: 80, bp: 50, row: 55, ohp: 35 });
  assert.equal(weeks.length, 4);
  assert.ok(weeks.every((w) => w.days.length === 3));
});

test('generateProgram falls back to legacy generator for unsupported ids', () => {
  const result = generateProgram('custom', { x: 1 }, () => ['legacy']);
  assert.deepEqual(result, ['legacy']);
});
