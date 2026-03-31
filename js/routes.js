/**
 * TechFitness Routes Configuration
 * Punto único de verdad para rutas por rol.
 * @module AppRoutes
 */

/** @type {Object.<string, string>} */
const ROLE_MAPPING = {
    'gim_admin': 'admin-dashboard.html',
    'profesor': 'profesor-dashboard.html',
    'coach': 'profesor-dashboard.html',
    'alumno': 'student-profile.html'
};

/**
 * Obtiene la URL del dashboard según el rol del usuario.
 * @param {string} role - Rol del usuario
 * @returns {string} URL del dashboard
 */
const getDashboardUrl = (role) => {
    const normalizedRole = (role === 'coach') ? 'profesor' : role;
    return ROLE_MAPPING[normalizedRole] || 'login.html';
};

/**
 * Obtiene la URL home según el rol guardado en localStorage.
 * @returns {string} URL del home
 */
const getHomeUrl = () => {
    const role = localStorage.getItem('tf_role');
    return getDashboardUrl(role);
};

const AppRoutes = {
    ROLE_MAPPING,
    getDashboardUrl,
    getHomeUrl
};

window.AppRoutes = AppRoutes;


