// Configuración de Supabase
const SUPABASE_URL = 'https://pugwofiapgdzxpdbbtnn.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Z3dvZmlhcGdkenhwZGJidG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMjQ2OTIsImV4cCI6MjA4ODkwMDY5Mn0.18yf_cFDH11GemKdNC7TvFvPMAQdeXj1TTaXBH5L7gE'

try {
    if (!window.supabase) throw new Error('SDK de Supabase no cargó')

    const { createClient } = window.supabase
    window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    console.log('✅ Supabase inicializado correctamente')
} catch (e) {
    console.error('❌ Error inicializando Supabase:', e.message)
}
