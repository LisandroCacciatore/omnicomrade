const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTfScript } = require('../../test-utils.cjs');

const tfTrainingMath = loadTfScript('training-math.js');
const { pct } = tfTrainingMath;

test('pct calculates and rounds percentages', () => {
  assert.equal(pct(100, 0.5), 50);
  assert.equal(pct(80, 0.55), 45);
  assert.equal(pct(60, 0.65), 40);
  assert.equal(pct(120, 0.9), 107.5);
});

test('pct handles 0 and 100%', () => {
  assert.equal(pct(100, 0), 0);
  assert.equal(pct(80, 1), 80);
});
