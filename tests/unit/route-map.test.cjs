const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTfScript } = require('../test-utils.cjs');

const tfRouteMap = loadTfScript('route-map.js');
const { normalizeRole, getDashboardByRole } = tfRouteMap;

test('normalizeRole maps coach to profesor', () => {
  assert.equal(normalizeRole('coach'), 'profesor');
});

test('getDashboardByRole returns student-profile for alumno', () => {
  assert.equal(getDashboardByRole('alumno'), 'student-profile.html');
});

test('getDashboardByRole returns profesor dashboard for coach', () => {
  assert.equal(getDashboardByRole('coach'), 'profesor-dashboard.html');
});

test('getDashboardByRole returns fallback for unknown role', () => {
  assert.equal(getDashboardByRole('otro', 'index.html'), 'index.html');
});
