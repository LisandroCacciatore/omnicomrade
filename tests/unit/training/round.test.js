const test = require('node:test');
const assert = require('node:assert/strict');

const { roundWeight } = require('../../../js/training-math');

test('roundWeight uses 2.5kg as default step', () => {
  assert.equal(roundWeight(73.75), 75);
});

test('roundWeight keeps exact boundary values', () => {
  assert.equal(roundWeight(77.5), 77.5);
});

test('roundWeight supports custom step', () => {
  assert.equal(roundWeight(45.3, 1), 45);
  assert.equal(roundWeight(73.75, 5), 75);
});

test('roundWeight handles zero and negatives', () => {
  assert.equal(roundWeight(0), 0);
  assert.equal(roundWeight(-5), -5);
});
