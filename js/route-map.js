(function (global) {
  const DASHBOARD_BY_ROLE = {
    gim_admin: 'admin-dashboard.html',
    profesor: 'profesor-dashboard.html',
    alumno: 'student-profile.html',
    coach: 'profesor-dashboard.html'
  };

  function normalizeRole(role) {
    return role === 'coach' ? 'profesor' : role;
  }

  function getDashboardByRole(role, fallback = 'login.html') {
    if (!role) return fallback;
    const normalized = normalizeRole(role);
    return DASHBOARD_BY_ROLE[normalized] || DASHBOARD_BY_ROLE[role] || fallback;
  }

  const api = { DASHBOARD_BY_ROLE, normalizeRole, getDashboardByRole };

  global.tfRouteMap = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
