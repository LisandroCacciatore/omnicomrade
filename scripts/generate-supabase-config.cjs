const fs = require('fs');
const path = require('path');

function validateEnv(env) {
  const url = env.SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  return { url, anonKey };
}

function buildSupabaseConfig(url, anonKey) {
  return `// Configuración de Supabase
const SUPABASE_URL = "${url}"
const SUPABASE_ANON_KEY = "${anonKey}"

try { if (!window.supabase) throw new Error("SDK de Supabase no cargó"); const { createClient } = window.supabase; window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); console.log("✅ Supabase inicializado correctamente"); } catch (e) { console.error("❌ Error inicializando Supabase:", e.message); }`;
}

function writeConfigFile(filepath, content) {
  const dir = path.dirname(filepath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, content);
}

function main() {
  try {
    const { url, anonKey } = validateEnv(process.env);
    const content = buildSupabaseConfig(url, anonKey);
    const outputPath = process.env.SUPABASE_CONFIG_PATH || 'js/supabase.js';
    writeConfigFile(outputPath, content);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateEnv, buildSupabaseConfig, writeConfigFile, main };
