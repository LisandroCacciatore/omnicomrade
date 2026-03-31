const test = require('node:test');
const assert = require('node:assert/strict');

const { validateEnv, buildSupabaseConfig } = require('../../scripts/generate-supabase-config.cjs');

test('validateEnv throws when env vars are missing', () => {
  assert.throws(
    () => validateEnv({ SUPABASE_URL: '', SUPABASE_ANON_KEY: '' }),
    /Missing SUPABASE_URL or SUPABASE_ANON_KEY/
  );
});

test('validateEnv returns url and anonKey when both vars are present', () => {
  const result = validateEnv({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key'
  });

  assert.deepEqual(result, {
    url: 'https://example.supabase.co',
    anonKey: 'anon-key'
  });
});

test('buildSupabaseConfig injects both credentials in generated file content', () => {
  const content = buildSupabaseConfig('https://example.supabase.co', 'anon-key');

  assert.match(content, /const SUPABASE_URL = "https:\/\/example\.supabase\.co"/);
  assert.match(content, /const SUPABASE_ANON_KEY = "anon-key"/);
  assert.match(content, /window\.supabaseClient = createClient/);
});
