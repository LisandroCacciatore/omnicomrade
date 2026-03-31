const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

function createSandbox(session, hasError = false) {
  const location = { href: 'initial.html' };
  const localStore = {};

  const sandbox = {
    window: {
      location,
      supabaseClient: {
        auth: {
          getSession: async () => ({
            data: { session },
            error: hasError ? new Error('boom') : null
          })
        }
      }
    },
    localStorage: {
      setItem: (k, v) => { localStore[k] = v; },
      getItem: (k) => localStore[k]
    },
    console
  };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('js/auth-guard.js', 'utf8'), sandbox);
  return sandbox;
}

function createSession(role) {
  return {
    user: {
      email: 'test@example.com',
      app_metadata: { role }
    }
  };
}

test('authGuard allows access when role is in allowedRoles', async () => {
  const sandbox = createSandbox(createSession('profesor'));
  const result = await sandbox.window.authGuard(['profesor']);

  assert.equal(result.user.app_metadata.role, 'profesor');
  assert.equal(sandbox.window.location.href, 'initial.html');
});

test('authGuard redirects alumno when role is not authorized', async () => {
  const sandbox = createSandbox(createSession('alumno'));
  const result = await sandbox.window.authGuard(['gim_admin', 'profesor']);

  assert.equal(result, null);
  assert.equal(sandbox.window.location.href, 'student-profile.html');
});

test('authGuard normalizes coach and redirects to profesor dashboard when unauthorized', async () => {
  const sandbox = createSandbox(createSession('coach'));
  const result = await sandbox.window.authGuard(['gim_admin']);

  assert.equal(result, null);
  assert.equal(sandbox.window.location.href, 'profesor-dashboard.html');
});
