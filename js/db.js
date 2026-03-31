(function (global) {
  function getClient(clientOverride) {
    const client = clientOverride || global.supabaseClient;
    if (!client) throw new Error('Supabase client not initialized');
    return client;
  }

  async function run(queryPromise) {
    try {
      const { data, error } = await queryPromise;
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  function createDB(clientOverride) {
    const client = getClient(clientOverride);

    return {
      students: {
        getAll({ gymId } = {}) {
          let query = client.from('profiles').select('*').eq('role', 'alumno').is('deleted_at', null);
          if (gymId) query = query.eq('gym_id', gymId);
          return run(query.order('full_name'));
        }
      },
      memberships: {
        getAll({ gymId } = {}) {
          let query = client.from('memberships').select('*').is('deleted_at', null);
          if (gymId) query = query.eq('gym_id', gymId);
          return run(query.order('created_at', { ascending: false }));
        }
      },
      exercises: {
        getGlobalAndGym(gymId) {
          return Promise.all([
            run(client.from('exercises').select('id,name,muscle_group,category').eq('is_global', true).is('deleted_at', null).order('name')),
            run(client.from('exercises').select('id,name,muscle_group,category').eq('gym_id', gymId).is('deleted_at', null).order('name'))
          ]).then(([globalExercises, customExercises]) => ({
            data: [...(globalExercises.data || []), ...(customExercises.data || [])],
            error: globalExercises.error || customExercises.error || null
          }));
        }
      }
    };
  }

  const api = { createDB };
  global.tfDb = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
