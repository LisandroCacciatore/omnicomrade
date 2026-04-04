/**
 * db.js
 * TechFitness — Capa de Abstracción de Datos (Data Access Layer)
 *
 * Provee una fachada tipada sobre Supabase para evitar acoplamiento
 * directo entre UI y queries. Incluye:
 *  - Retry automático para errores transitorios de red
 *  - Clasificación de errores (DBError)
 *  - Fachadas para todas las tablas del schema
 *
 * Exports (global): window.tfDb
 * Exports (CJS):    require('./db')
 */

(function (global) {
  /* ═══════════════════════════════════════════════════════
     ERROR CLASSIFICATION
  ═══════════════════════════════════════════════════════ */

  /**
   * Error tipado para operaciones de base de datos.
   * @param {object} supabaseError - Error original de Supabase
   * @param {string} table - Tabla que causó el error
   * @param {string} operation - Tipo de operación (select, insert, update, delete)
   */
  function DBError(supabaseError, table, operation) {
    this.name = 'DBError';
    this.message = supabaseError.message || 'Error desconocido en base de datos';
    this.code = supabaseError.code || 'UNKNOWN';
    this.table = table;
    this.operation = operation;
    this.originalError = supabaseError;

    // Clasificación semántica del error
    var msg = (supabaseError.message || '').toLowerCase();
    var code = supabaseError.code || '';

    /** @type {boolean} Error de tabla/columna inexistente (schema desincronizado) */
    this.isSchemaError = code === '42P01' || code === '42703' || msg.includes('does not exist');

    /** @type {boolean} Error transitorio de red (puede reintentarse) */
    this.isTransient = msg.includes('fetch') || msg.includes('network') ||
                       msg.includes('timeout') || msg.includes('econnrefused') ||
                       code === 'PGRST301';

    /** @type {boolean} Error de permisos (RLS o auth) */
    this.isAuthError = code === '42501' || msg.includes('permission denied') ||
                       msg.includes('row-level security');

    /** @type {boolean} Error de duplicado (constraint violation) */
    this.isDuplicate = code === '23505';

    /** @type {string} Mensaje amigable para mostrar al usuario */
    this.userMessage = this.isSchemaError
      ? 'Configuración pendiente. Contactá al administrador para aplicar las migraciones.'
      : this.isAuthError
        ? 'No tenés permisos para realizar esta acción.'
        : this.isDuplicate
          ? 'Este registro ya existe.'
          : this.isTransient
            ? 'Error de conexión. Reintentando...'
            : 'Error inesperado: ' + this.message;
  }
  DBError.prototype = Object.create(Error.prototype);
  DBError.prototype.constructor = DBError;

  /* ═══════════════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════════════ */

  function getClient(clientOverride) {
    var client = clientOverride || global.supabaseClient;
    if (!client) throw new Error('Supabase client not initialized');
    return client;
  }

  /**
   * Ejecuta una query de Supabase con normalización de resultado.
   * @param {Promise<{data:any,error:any}>} queryPromise
   * @returns {Promise<{data:any,error:any}>}
   */
  async function run(queryPromise) {
    try {
      var result = await queryPromise;
      if (result.error) return { data: null, error: result.error };
      return { data: result.data, error: null };
    } catch (error) {
      return { data: null, error: error };
    }
  }

  /**
   * Ejecuta una operación con retry automático para errores transitorios.
   * @param {() => Promise<{data:any,error:any}>} operation - Función que retorna la query
   * @param {string} table - Nombre de la tabla (para logging)
   * @param {string} opType - Tipo de operación
   * @param {number} [maxRetries=3] - Máximo de reintentos
   * @param {number} [delayMs=1000] - Delay inicial entre reintentos (exponential backoff)
   * @returns {Promise<{data:any,error:DBError|null}>}
   */
  async function runWithRetry(operation, table, opType, maxRetries, delayMs) {
    if (maxRetries === undefined) maxRetries = 3;
    if (delayMs === undefined) delayMs = 1000;

    var lastError = null;
    for (var attempt = 0; attempt <= maxRetries; attempt++) {
      var result = await run(operation());

      if (!result.error) return result;

      lastError = new DBError(result.error, table, opType);

      // Solo reintentar errores transitorios
      if (!lastError.isTransient || attempt === maxRetries) {
        return { data: null, error: lastError };
      }

      // Exponential backoff
      var waitTime = delayMs * Math.pow(2, attempt);
      await new Promise(function (resolve) { setTimeout(resolve, waitTime); });

      // Log de reintento para debugging
      if (global.tfInstrumentation) {
        global.tfInstrumentation.track('db_retry', {
          table: table,
          operation: opType,
          attempt: attempt + 1,
          errorCode: lastError.code
        });
      }
    }

    return { data: null, error: lastError };
  }

  /* ═══════════════════════════════════════════════════════
     DB FACTORY
  ═══════════════════════════════════════════════════════ */

  /**
   * Crea una instancia del wrapper de DB con fachadas por tabla.
   * @param {any} [clientOverride] - Cliente Supabase (usa global si no se pasa)
   * @returns {object} Fachada con métodos por tabla
   */
  function createDB(clientOverride) {
    var client = getClient(clientOverride);

    return {
      /* ── Students ─────────────────────────────────────── */
      students: {
        getAll: function (opts) {
          opts = opts || {};
          return runWithRetry(function () {
            var query = client.from('students').select('*').is('deleted_at', null);
            if (opts.gymId) query = query.eq('gym_id', opts.gymId);
            return query.order('full_name');
          }, 'students', 'select');
        },
        getById: function (id) {
          return runWithRetry(function () {
            return client.from('students').select('*').eq('id', id).single();
          }, 'students', 'select');
        }
      },

      /* ── Memberships ──────────────────────────────────── */
      memberships: {
        getAll: function (opts) {
          opts = opts || {};
          return runWithRetry(function () {
            var query = client.from('memberships').select('*').is('deleted_at', null);
            if (opts.gymId) query = query.eq('gym_id', opts.gymId);
            return query.order('created_at', { ascending: false });
          }, 'memberships', 'select');
        },
        getByStudent: function (studentId) {
          return runWithRetry(function () {
            return client.from('memberships').select('*')
              .eq('student_id', studentId)
              .is('deleted_at', null)
              .order('created_at', { ascending: false });
          }, 'memberships', 'select');
        }
      },

      /* ── Exercises ────────────────────────────────────── */
      exercises: {
        getGlobalAndGym: function (gymId) {
          return Promise.all([
            runWithRetry(function () {
              return client.from('exercises').select('id,name,muscle_group,category')
                .eq('is_global', true).is('deleted_at', null).order('name');
            }, 'exercises', 'select'),
            runWithRetry(function () {
              return client.from('exercises').select('id,name,muscle_group,category')
                .eq('gym_id', gymId).is('deleted_at', null).order('name');
            }, 'exercises', 'select')
          ]).then(function (results) {
            return {
              data: [].concat(results[0].data || [], results[1].data || []),
              error: results[0].error || results[1].error || null
            };
          });
        }
      },

      /* ── Routines ─────────────────────────────────────── */
      routines: {
        getAll: function (opts) {
          opts = opts || {};
          return runWithRetry(function () {
            var query = client.from('routines').select('*, routine_days(*, routine_day_exercises(*))');
            if (opts.gymId) query = query.eq('gym_id', opts.gymId);
            return query.order('created_at', { ascending: false });
          }, 'routines', 'select');
        },
        getById: function (id) {
          return runWithRetry(function () {
            return client.from('routines')
              .select('*, routine_days(*, routine_day_exercises(*, exercises(name, muscle_group)))')
              .eq('id', id).single();
          }, 'routines', 'select');
        }
      },

      /* ── Program Templates ────────────────────────────── */
      programTemplates: {
        getAll: function () {
          return runWithRetry(function () {
            return client.from('program_templates').select('*').order('name');
          }, 'program_templates', 'select');
        }
      },

      /* ── Student Programs ─────────────────────────────── */
      studentPrograms: {
        getActive: function (studentId) {
          return runWithRetry(function () {
            return client.from('student_programs')
              .select('*, program_templates(name, slug)')
              .eq('student_id', studentId)
              .eq('status', 'activo')
              .maybeSingle();
          }, 'student_programs', 'select');
        }
      },

      /* ── Workout Sessions ─────────────────────────────── */
      workoutSessions: {
        getByStudent: function (studentId, opts) {
          opts = opts || {};
          return runWithRetry(function () {
            var query = client.from('workout_sessions')
              .select('*, workout_exercise_logs(*)')
              .eq('student_id', studentId)
              .order('started_at', { ascending: false });
            if (opts.limit) query = query.limit(opts.limit);
            return query;
          }, 'workout_sessions', 'select');
        }
      },

      /* ── Attendance Logs ──────────────────────────────── */
      attendanceLogs: {
        getByGym: function (gymId, opts) {
          opts = opts || {};
          return runWithRetry(function () {
            var query = client.from('attendance_logs').select('*, students(full_name)')
              .eq('gym_id', gymId)
              .order('checked_in_at', { ascending: false });
            if (opts.limit) query = query.limit(opts.limit);
            return query;
          }, 'attendance_logs', 'select');
        }
      },

      /* ── Wellbeing Logs ───────────────────────────────── */
      wellbeingLogs: {
        getByStudent: function (studentId, opts) {
          opts = opts || {};
          return runWithRetry(function () {
            var query = client.from('wellbeing_logs').select('*')
              .eq('student_id', studentId)
              .order('created_at', { ascending: false });
            if (opts.limit) query = query.limit(opts.limit);
            return query;
          }, 'wellbeing_logs', 'select');
        }
      }
    };
  }

  /* ═══════════════════════════════════════════════════════
     PUBLIC API
  ═══════════════════════════════════════════════════════ */

  var api = { createDB: createDB, DBError: DBError };
  global.tfDb = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
