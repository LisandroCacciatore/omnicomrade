const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

function loadTfUtils() {
  const source = fs.readFileSync('js/utils.js', 'utf8');
  const sandbox = {
    window: {},
    document: {
      addEventListener: () => {},
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => []
    },
    console,
    setTimeout,
    clearTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.tfUtils;
}

test('PROGRAMS contains major strength programs', () => {
  const tfUtils = loadTfUtils();
  const ids = tfUtils.PROGRAMS.map((p) => p.id);

  assert.ok(ids.includes('starting-strength'));
  assert.ok(ids.includes('stronglifts-5x5'));
  assert.ok(ids.includes('wendler-531'));
  assert.ok(tfUtils.PROGRAMS.length >= 5);
});

test('starting-strength generate returns expected structure and first squat weight', () => {
  const tfUtils = loadTfUtils();
  const ss = tfUtils.PROGRAMS.find((p) => p.id === 'starting-strength');

  const weeks = ss.generate({ sq: 60, dl: 80, bp: 50, ohp: 35, pc: 30 });

  assert.equal(weeks.length, 4);
  assert.equal(weeks[0].days.length, 3);

  const firstDay = weeks[0].days[0];
  const squat = firstDay.lifts.find((l) => l.name === 'Sentadilla');
  assert.equal(squat.w, 32.5);
});

test('stronglifts-5x5 generate returns 4 weeks x 3 sessions', () => {
  const tfUtils = loadTfUtils();
  const sl = tfUtils.PROGRAMS.find((p) => p.id === 'stronglifts-5x5');

  const weeks = sl.generate({ sq: 60, dl: 80, bp: 50, row: 55, ohp: 35 });

  assert.equal(weeks.length, 4);
  assert.ok(weeks.every((w) => w.days.length === 3));
});

test('non-existent program id returns undefined', () => {
  const tfUtils = loadTfUtils();
  const program = tfUtils.PROGRAMS.find((p) => p.id === 'programa-fake');
  assert.equal(program, undefined);
});
