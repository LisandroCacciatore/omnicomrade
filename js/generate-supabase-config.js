import fs from 'fs';
import path from 'path';

// Tomar variables de entorno (Vercel las provee gracias a la integración)
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

const content = `/**
 * Configuración de Supabase generada automáticamente durante el build.
 */
const SUPABASE_URL = '${url}';
const SUPABASE_ANON_KEY = '${key}';

try {
    if (!window.supabase) {
        console.error('❌ Error: El SDK de Supabase (CDN) no se cargó correctamente.');
    } else {
        const { createClient } = window.supabase;
        window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase Client inicializado con éxito.');
    }
} catch (e) {
    console.error('❌ Error crítico inicializando Supabase:', e.message);
}
`;

// Asegurar que el directorio de salida existe (dist/js)
const distJsDir = path.join(process.cwd(), 'dist', 'js');
if (!fs.existsSync(distJsDir)) {
    fs.mkdirSync(distJsDir, { recursive: true });
}

// Escribir el archivo
const outputPath = path.join(distJsDir, 'supabase.js');
fs.writeFileSync(outputPath, content);

console.log(`🚀 Configuración de Supabase generada en ${outputPath}`);
if (!url || !key) {
    console.warn('⚠️ ADVERTENCIA: SUPABASE_URL o SUPABASE_ANON_KEY están vacíos.');
}


