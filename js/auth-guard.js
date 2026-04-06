/**
 * TechFitness Auth Guard
 * Protege rutas requiriendo sesión y validando roles.
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
    const {
      data: { session },
      error
    } = await window.supabaseClient.auth.getSession();

    if (error || !session) {
      console.warn('⚠️ authGuard: Sin sesión activa. Redirigiendo a Login.');
      window.location.href = 'login.html';
      return null;
    }

    let role = session.user.app_metadata?.role;
    if (!role) {
      const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      role = profile?.role || localStorage.getItem('tf_role') || null;
    }
    console.log(`👤 authGuard: Usuario ${session.user.email} con rol [${role}]`);

    // Sincronizar con localStorage para el sidebar (US-12)
    if (role) {
      if (window.TFSidebar) window.TFSidebar.setRole(role);
      else localStorage.setItem('tf_role', role);
    }

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

    // Dispatch session-loaded event for components that need it (e.g., onboardingWizard)
    window.dispatchEvent(new CustomEvent('auth:session-loaded', { detail: { session } }));

    return session;
  } catch (err) {
    console.error('❌ authGuard error crítico:', err.message);
    window.location.href = 'login.html';
    return null;
  }
}

// Inyectar en el objeto global
window.authGuard = authGuard;
