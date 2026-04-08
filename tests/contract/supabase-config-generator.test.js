import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import generateSupabaseModule from '../../scripts/generate-supabase-config.cjs';

const { buildSupabaseConfig, writeConfigFile } = generateSupabaseModule;

test('writeConfigFile creates missing directories and writes valid JS file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-config-'));
  const output = path.join(tmp, 'dist/js/supabase.js');
  const content = buildSupabaseConfig('https://test.supabase.co', 'anon-key');

  writeConfigFile(output, content);

  assert.equal(fs.existsSync(output), true);
  const saved = fs.readFileSync(output, 'utf8');
  assert.match(saved, /const SUPABASE_URL = "https:\/\/test\.supabase\.co"/);
  assert.match(saved, /const SUPABASE_ANON_KEY = "anon-key"/);
  assert.match(saved, /window\.supabaseClient = createClient/);
});

test('generator script exits with non-zero when env vars are missing', () => {
  const result = spawnSync('node', ['scripts/generate-supabase-config.cjs'], {
    cwd: process.cwd(),
    env: { ...process.env, SUPABASE_URL: '', SUPABASE_ANON_KEY: '' },
    encoding: 'utf8'
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /Missing SUPABASE_URL or SUPABASE_ANON_KEY/);
});

test('generator script writes file to custom output path when env vars are present', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-config-main-'));
  const output = path.join(tmp, 'dist/js/supabase.js');

  const result = spawnSync('node', ['scripts/generate-supabase-config.cjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_CONFIG_PATH: output
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(output), true);
});

test('generator script creates static dist output with html and generated supabase config', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-build-dist-'));
  const distDir = path.join(tmp, 'dist');

  const result = spawnSync('node', ['scripts/generate-supabase-config.cjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key',
      BUILD_OUTPUT_DIR: distDir
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(path.join(distDir, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(distDir, 'js/supabase.js')), true);
});
