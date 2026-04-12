/**
 * TechFitness Session Manager
 * Centraliza el acceso a la sesión y datos del tenant (gym_id)
 * Cargar DESPUÉS de supabase.js y ANTES de auth-guard.js
 */

window.tfSession = {
  /**
   * Cache de la sesión en memoria
   * @type {Object|null}
   */
  _sessionCache: null,

  /**
   * Obtiene la sesión completa de Supabase con caché en memoria
   * @returns {Promise<Object|null>} Objeto de sesión o null
   */
  async get() {
    // Si ya tenemos la sesión en caché, retornarla
    if (this._sessionCache) {
      return this._sessionCache;
    }

    try {
      const { data, error } = await window.supabaseClient.auth.getSession();

      if (error || !data.session) {
        this._sessionCache = null;
        return null;
      }

      // Guardar en caché
      this._sessionCache = data.session;
      return this._sessionCache;
    } catch (err) {
      console.error('❌ tfSession.get(): Error al obtener sesión:', err.message);
      this._sessionCache = null;
      return null;
    }
  },

  /**
   * Obtiene el ID del gimnasio (tenant_id) asociado al usuario actual
   * Prioridad: app_metadata.gym_id -> profiles.tenant_id -> error
   * @returns {Promise<string|null>} gym_id como string o null
   */
  async getCurrentGymId() {
    try {
      const session = await this.get();

      if (!session) {
        // No hay sesión, redirigir a login (será manejado por auth-guard)
        return null;
      }

      // 1. Intentar obtener gym_id de app_metadata
      let gymId = session.user.app_metadata?.gym_id;

      if (gymId) {
        return gymId;
      }

      // 2. Fallback: consultar tabla profiles para obtener tenant_id
      try {
        const { data, error } = await window.tfDb
          .from('profiles')
          .select('tenant_id')
          .eq('id', session.user.id)
          .single();

        if (error) {
          throw error;
        }

        if (data && data.tenant_id) {
          gymId = data.tenant_id;
          return gymId;
        }
      } catch (profileError) {
        console.warn(
          '⚠️ tfSession.getCurrentGymId(): Error al consultar profiles:',
          profileError.message
        );
      }

      // 3. Si no se encontró gym_id en ningún lugar, redirigir a error
      console.warn(
        '⚠️ tfSession.getCurrentGymId(): No se pudo determinar gym_id para usuario',
        session.user.id
      );
      window.location.href = 'error.html?reason=missing_tenant';
      return null;
    } catch (err) {
      console.error('❌ tfSession.getCurrentGymId(): Error crítico:', err.message);
      // En caso de error crítico, también redirigir
      window.location.href = 'error.html?reason=missing_tenant';
      return null;
    }
  },

  /**
   * Invalida la caché de sesión (útil después de logout)
   */
  invalidateCache() {
    this._sessionCache = null;
  }
};
