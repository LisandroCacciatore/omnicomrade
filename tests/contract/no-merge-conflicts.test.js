import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const roots = ['js', 'scripts'];
const markers = ['<<<<<<<', '=======', '>>>>>>>'];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else if (name.endsWith('.js') || name.endsWith('.cjs')) acc.push(full);
  }
  return acc;
}

test('repository sources do not contain unresolved merge conflict markers', () => {
  const files = roots.flatMap((dir) => walk(dir));
  const offenders = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (markers.some((m) => content.includes(m))) {
      offenders.push(file);
    }
  }

  assert.deepEqual(offenders, []);
});
