/**
 * TechFitness Auth Guard
 * Protege rutas requiriendo sesión y validando roles.
 */
async function authGuard(allowedRoles = []) {
    if (!window.supabaseClient) {
        console.error('❌ authGuard: Supabase no está inicializado.');
        window.location.href = 'login.html';
        return null;
    }

    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();

        if (error || !session) {
            console.warn('⚠️ authGuard: Sin sesión activa. Redirigiendo a Login.');
            window.location.href = 'login.html';
            return null;
        }

        const role = session.user.app_metadata?.role;
        console.log(`👤 authGuard: Usuario ${session.user.email} con rol [${role}]`);

        // Sincronizar con localStorage para el sidebar (US-12)
        if (role) {
            if (window.TFSidebar) window.TFSidebar.setRole(role);
            else localStorage.setItem('tf_role', role);
        }

        // Normalización de roles (algunos usuarios pueden venir como 'coach' antiguos)
        const normalizedRole = (role === 'coach') ? 'profesor' : role;

        if (allowedRoles.length > 0 && !allowedRoles.includes(normalizedRole)) {
            console.warn(`🚫 authGuard: Rol [${normalizedRole}] no autorizado para esta página. Redirigiendo...`);
            
            const dashboards = {
                'gim_admin': 'admin-dashboard.html',
                'profesor': 'profesor-dashboard.html',
                'alumno': 'student-dashboard.html'
            };

            const redirectUrl = dashboards[normalizedRole] || 'login.html';
            window.location.href = redirectUrl;
            return null;
        }

        return session;
    } catch (err) {
        console.error('❌ authGuard error crítico:', err.message);
        window.location.href = 'login.html';
        return null;
    }
}

// Inyectar en el objeto global
window.authGuard = authGuard;