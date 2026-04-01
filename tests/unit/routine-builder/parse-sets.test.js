import test from 'node:test';
import assert from 'node:assert/strict';
import '../../../js/routine-builder-utils.js';

const { parseSetsStr } = globalThis.tfRoutineBuilderUtils;

function sidFactory() {
  let n = 0;
  return () => `sid-${++n}`;
}

test('parseSetsStr parses 3×5 into 3 sets', () => {
  const sets = parseSetsStr('3×5', 50, sidFactory());

  assert.equal(sets.length, 3);
  assert.deepEqual(sets.map(s => s.set_number), [1, 2, 3]);
  assert.ok(sets.every(s => s.reps === '5'));
  assert.ok(sets.every(s => s.weight_kg === 50));
});

test('parseSetsStr marks last set as amrap when reps end with +', () => {
  const sets = parseSetsStr('3×5+', 60, sidFactory());

  assert.equal(sets.length, 3);
  assert.equal(sets[2].is_amrap, true);
  assert.equal(sets[2].reps, '5+');
});

test('parseSetsStr supports lowercase x format', () => {
  const sets = parseSetsStr('4x8', 40, sidFactory());
  assert.equal(sets.length, 4);
  assert.ok(sets.every(s => s.reps === '8'));
});

test('parseSetsStr returns default set for invalid format', () => {
  const sets = parseSetsStr('formato-invalido', 30, sidFactory());
  assert.equal(sets.length, 1);
  assert.equal(sets[0].reps, 'formato-invalido');
});

test('parseSetsStr preserves null weight', () => {
  const sets = parseSetsStr('3×8', null, sidFactory());
  assert.ok(sets.every(s => s.weight_kg === null));
});
