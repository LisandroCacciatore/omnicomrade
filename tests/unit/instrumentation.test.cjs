const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTfScript } = require('../test-utils.cjs');

const tfInstrumentation = loadTfScript('instrumentation.js');
const { track, flush } = tfInstrumentation;

test('track queues events and flush drains queue', () => {
  track('signup_started', { source: 'landing' });
  track('signup_completed', { plan: 'basic' });

  const events = flush();
  assert.equal(events.length, 2);
  assert.equal(events[0].name, 'signup_started');
  assert.equal(events[1].payload.plan, 'basic');

  assert.equal(flush().length, 0);
});
