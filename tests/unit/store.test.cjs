const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTfScript } = require('../test-utils.cjs');

const tfStore = loadTfScript('store.js');
const { createStore } = tfStore;

test('createStore updates and reads state', () => {
  const store = createStore({ count: 1 });

  const seen = [];
  const unsubscribe = store.subscribe((detail) => seen.push(detail));
  const state = store.setState({ count: 2 }, 'increment');

  assert.equal(state.count, 2);
  assert.equal(store.getState().count, 2);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].reason, 'increment');

  unsubscribe();
});
