/**
 * TechFitness Auth Guard
 * Protege rutas requiriendo sesión y validando roles.
 * Enriquecido para devolver contexto de sesión completo.
 */

const RoutesFallback = {
  ROLE_MAPPING: {
    gim_admin: 'admin-dashboard.html',
    profesor: 'profesor-dashboard.html',
    coach: 'profesor-dashboard.html',
    alumno: 'student-profile.html'
  },
  getDashboardUrl(role) {
    const normalizedRole = role === 'coach' ? 'profesor' : role;
    return this.ROLE_MAPPING[normalizedRole] || 'login.html';
  }
};

async function authGuard(allowedRoles = []) {
  const getDashboardByRole =
    window.tfRouteMap?.getDashboardByRole ||
    ((role, fallback = 'login.html') => {
      const map = {
        gim_admin: 'admin-dashboard.html',
        profesor: 'profesor-dashboard.html',
        alumno: 'student-profile.html',
        coach: 'profesor-dashboard.html'
      };
      const normalized = role === 'coach' ? 'profesor' : role;
      return map[normalized] || map[role] || fallback;
    });

  if (!window.supabaseClient) {
    console.error('❌ authGuard: Supabase no está inicializado.');
    window.location.href = 'login.html';
    return null;
  }

  try {
    // Usar tfSession.get() para obtener la sesión con caché
    const session = await window.tfSession.get();

    if (!session) {
      console.warn('⚠️ authGuard: Sin sesión activa. Redirigiendo a Login.');
      window.location.href = 'login.html';
      return null;
    }

    // Obtener rol de app_metadata o perfil
    let role = session.user.app_metadata?.role;
    if (!role) {
      const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      role = profile?.role || null;
    }

    console.log(`👤 authGuard: Usuario ${session.user.email} con rol [${role}]`);

    // Normalización de roles (algunos usuarios pueden venir como 'coach' antiguos)
    const normalizedRole = role === 'coach' ? 'profesor' : role;

    if (allowedRoles.length > 0 && !allowedRoles.includes(normalizedRole)) {
      console.warn(
        `🚫 authGuard: Rol [${normalizedRole}] no autorizado para esta página. Redirigiendo...`
      );

      const redirectUrl = getDashboardByRole(normalizedRole, 'login.html');
      window.location.href = redirectUrl;
      return null;
    }

    // Obtener gymId usando el nuevo tfSession (mantiene las reglas de fallback y redirección)
    const gymId = await window.tfSession.getCurrentGymId();
    // Si gymId es null, getCurrentGymId() ya manejó la redirección a error.html

    // Dispatch session-loaded event for components that need it (e.g., onboardingWizard)
    window.dispatchEvent(new CustomEvent('auth:session-loaded', { detail: { session } }));

    // Devolver objeto de contexto de sesión enriquecido
    return {
      userId: session.user.id,
      email: session.user.email,
      role: normalizedRole,
      gymId: gymId // Puede ser null si hubo error (ya redirigido)
    };
  } catch (err) {
    console.error('❌ authGuard error crítico:', err.message);
    window.location.href = 'login.html';
    return null;
  }
}

// Inyectar en el objeto global
window.authGuard = authGuard;
