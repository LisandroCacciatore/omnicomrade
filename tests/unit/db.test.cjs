const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTfScript } = require('../test-utils.cjs');

const tfDb = loadTfScript('db.js');
const { createDB } = tfDb;

function queryBuilder(result) {
  return {
    eq: () => queryBuilder(result),
    is: () => queryBuilder(result),
    order: () => Promise.resolve(result)
  };
}

test('createDB students.getAll returns typed result', async () => {
  const fakeClient = {
    from: () => ({
      select: () => queryBuilder({ data: [{ id: 1 }], error: null })
    })
  };

  const db = createDB(fakeClient);
  const res = await db.students.getAll({ gymId: 'gym-1' });

  // Use explicit property check instead of deepStrictEqual on VM-born objects
  assert.equal(res.error, null);
  assert.equal(res.data.length, 1);
  assert.equal(res.data[0].id, 1);
});

test('createDB exercises.getGlobalAndGym merges global and custom rows', async () => {
  let call = 0;
  const fakeClient = {
    from: () => ({
      select: () => queryBuilder({ data: [{ id: ++call }], error: null })
    })
  };

  const db = createDB(fakeClient);
  const res = await db.exercises.getGlobalAndGym('gym-1');

  assert.equal(res.error, null);
  assert.equal(res.data.length, 2);
  assert.equal(res.data[0].id, 1);
  assert.equal(res.data[1].id, 2);
});
