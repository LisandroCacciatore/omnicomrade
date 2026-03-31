const test = require('node:test');
const assert = require('node:assert/strict');

const { createDB } = require('../../js/db');

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

  assert.deepEqual(res, { data: [{ id: 1 }], error: null });
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
  assert.deepEqual(res.data, [{ id: 1 }, { id: 2 }]);
});
