const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTfScript } = require('../../test-utils.cjs');

const tfUtils = loadTfScript('utils.js', ['training-engine.js']);

test('tfUtils.PROGRAMS delegates to tfTrainingEngine', () => {
  const ids = tfUtils.PROGRAMS.map((p) => p.id);
  assert.ok(ids.includes('starting-strength'));
  assert.ok(ids.includes('stronglifts-5x5'));
  assert.equal(tfUtils.PROGRAMS.length, 6);
});

test('starting-strength generate via tfUtils returns expected structure', () => {
  const ss = tfUtils.PROGRAMS.find((p) => p.id === 'starting-strength');
  const weeks = ss.generate({ sq: 60, dl: 80, bp: 50, ohp: 35, pc: 30 });
  assert.equal(weeks.length, 4);
  assert.equal(weeks[0].days.length, 3);
  const firstDay = weeks[0].days[0];
  const squat = firstDay.lifts.find((l) => l.name === 'Sentadilla');
  assert.equal(squat.w, 32.5);
});

test('tfUtils.round and tfUtils.pct delegate correctly', () => {
  assert.equal(tfUtils.round(73.75), 75);
  assert.equal(tfUtils.pct(100, 0.55), 55);
});
