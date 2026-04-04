const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTfScript } = require('../../test-utils.cjs');

const tfTrainingMath = loadTfScript('training-math.js');
const { roundWeight } = tfTrainingMath;

test('roundWeight uses 2.5kg as default step', () => {
  assert.equal(roundWeight(73.75), 75);
  assert.equal(roundWeight(81.24), 80);
});

test('roundWeight supports custom step', () => {
  assert.equal(roundWeight(73.75, 5), 75);
  assert.equal(roundWeight(73.75, 1), 74);
});
