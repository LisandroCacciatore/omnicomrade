// Renombrá este archivo a supabase.js y completá con tus credenciales
const SUPABASE_URL = 'https://TU_PROJECT.supabase.co'
const SUPABASE_ANON_KEY = 'TU_ANON_KEY'

try {
    if (!window.supabase) throw new Error('SDK de Supabase no cargó')
    const { createClient } = window.supabase
    window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    console.log('✅ Supabase inicializado correctamente')
} catch (e) {
    console.error('❌ Error inicializando Supabase:', e.message)
}


