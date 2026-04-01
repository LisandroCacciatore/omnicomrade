import test from 'node:test';
import assert from 'node:assert/strict';
import '../../../js/routine-builder-utils.js';

const { validateRoutineDraft } = globalThis.tfRoutineBuilderUtils;

test('validateRoutineDraft: invalida cuando falta nombre', () => {
  const res = validateRoutineDraft({ name: '', days: [{ exercises: [{ name: 'Sentadilla' }] }] });
  assert.equal(res.valid, false);
  assert.ok(res.errors.name?.length);
});

test('validateRoutineDraft: invalida cuando no hay dias', () => {
  const res = validateRoutineDraft({ name: 'Fuerza A', days: [] });
  assert.equal(res.valid, false);
  assert.ok(res.errors.days?.length);
});

test('validateRoutineDraft: invalida cuando no hay ejercicios', () => {
  const res = validateRoutineDraft({
    name: 'Fuerza A',
    days: [{ exercises: [] }, { exercises: [] }]
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.exercises?.length);
});

test('validateRoutineDraft: valida cuando hay nombre, dia y ejercicio', () => {
  const res = validateRoutineDraft({
    name: 'Fuerza A',
    days: [{ exercises: [{ name: 'Press banca' }] }]
  });
  assert.equal(res.valid, true);
  assert.deepEqual(res.errors, {});
});
