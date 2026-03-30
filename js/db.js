/**
 * TechFitness DB Wrapper
 * Capa de acceso estandarizada a Supabase con manejo de errores consistente.
 * @module DB
 */

const DB = (() => {
    const getClient = () => {
        if (!window.supabaseClient) {
            throw new Error('Supabase no está inicializado');
        }
        return window.supabaseClient;
    };

    const handleError = (context, error) => {
        console.error(`[DB] Error en ${context}:`, error);
        
        if (error.message?.includes('timeout') || error.code === 'P1000') {
            return { data: null, error: { message: 'timeout', friendly: 'El servidor tardó demasiado. Intentá de nuevo.' } };
        }
        if (error.message?.includes('network') || error.code === 'P1000') {
            return { data: null, error: { message: 'network', friendly: 'Sin conexión. Verificá tu internet.' } };
        }
        if (error.code === 'PGRST116') {
            return { data: null, error: { message: 'not_found', friendly: 'Registro no encontrado.' } };
        }
        if (error.code === '42501') {
            return { data: null, error: { message: 'forbidden', friendly: 'No tenés permisos para esta operación.' } };
        }
        
        return { data: null, error: { message: error.message, friendly: 'Ocurrió un error. Intentá de nuevo.' } };
    };

    /** @type {Object} */
    const students = {
        /**
         * Obtiene todos los estudiantes activos de un gimnasio.
         * @param {string} gymId - ID del gimnasio
         * @returns {Promise<{data: Array|null, error: Object|null}>}
         */
        async getAll(gymId) {
            const db = getClient();
            try {
                const { data, error } = await db
                    .from('students')
                    .select('*')
                    .eq('gym_id', gymId)
                    .is('deleted_at', null)
                    .order('name', { ascending: true });
                
                if (error) throw error;
                return { data, error: null };
            } catch (err) {
                return handleError('students.getAll', err);
            }
        },

        async getById(id) {
            const db = getClient();
            try {
                const { data, error } = await db
                    .from('students')
                    .select('*')
                    .eq('id', id)
                    .is('deleted_at', null)
                    .maybeSingle();
                
                if (error) throw error;
                return { data, error: null };
            } catch (err) {
                return handleError('students.getById', err);
            }
        },

        async getByProfileId(profileId) {
            const db = getClient();
            try {
                const { data, error } = await db
                    .from('students')
                    .select('*')
                    .eq('profile_id', profileId)
                    .is('deleted_at', null)
                    .maybeSingle();
                
                if (error) throw error;
                return { data, error: null };
            } catch (err) {
                return handleError('students.getByProfileId', err);
            }
        },

        async create(student) {
            const db = getClient();
            try {
                const { data, error } = await db
                    .from('students')
                    .insert(student)
                    .select()
                    .single();
                
                if (error) throw error;
                return { data, error: null };
            } catch (err) {
                return handleError('students.create', err);
            }
        },

        async update(id, updates) {
            const db = getClient();
            try {
                const { data, error } = await db
                    .from('students')
                    .update(updates)
                    .eq('id', id)
                    .select()
                    .single();
                
                if (error) throw error;
                return { data, error: null };
            } catch (err) {
                return handleError('students.update', err);
            }
        },

        async delete(id) {
            const db = getClient();
            try {
                const { data, error } = await db
                    .from('students')
                    .update({ deleted_at: new Date().toISOString() })
                    .eq('id', id)
                    .select()
                    .single();
                
                if (error) throw error;
                return { data, error: null };
            } catch (err) {
                return handleError('students.delete', err);
            }
        }
    };

    const memberships = {
        async getAll(gymId) {
            const db = getClient();
            try {
                const { data, error } = await db
                    .from('memberships')
                    .select('*, students(name, email)')
                    .eq('gym_id', gymId)
                    .order('end_date', { ascending: false });
                
                if (error) throw error;
                return { data, error: null };
            } catch (err) {
                return handleError('memberships.getAll', err);
            }
        },

        async getActive(gymId) {
            const db = getClient();
            const today = new Date().toISOString().split('T')[0];
            try {
                const { data, error } = await db
                    .from('memberships')
                    .select('*, students(name, email)')
                    .eq('gym_id', gymId)
                    .lte('start_date', today)
                    .gte('end_date', today)
                    .in('status', ['activa']);
                
                if (error) throw error;
                return { data, error: null };
            } catch (err) {
                return handleError('memberships.getActive', err);
            }
        },

        async create(membership) {
            const db = getClient();
            try {
                const { data, error } = await db
                    .from('memberships')
                    .insert(membership)
                    .select()
                    .single();
                
                if (error) throw error;
                return { data, error: null };
            } catch (err) {
                return handleError('memberships.create', err);
            }
        },

        async update(id, updates) {
            const db = getClient();
            try {
                const { data, error } = await db
                    .from('memberships')
                    .update(updates)
                    .eq('id', id)
                    .select()
                    .single();
                
                if (error) throw error;
                return { data, error: null };
            } catch (err) {
                return handleError('memberships.update', err);
            }
        }
    };

    const workouts = {
        async getByStudent(studentId, limit = 10) {
            const db = getClient();
            try {
                const { data, error } = await db
                    .from('workouts')
                    .select('*')
                    .eq('student_id', studentId)
                    .order('created_at', { ascending: false })
                    .limit(limit);
                
                if (error) throw error;
                return { data, error: null };
            } catch (err) {
                return handleError('workouts.getByStudent', err);
            }
        },

        async create(workout) {
            const db = getClient();
            try {
                const { data, error } = await db
                    .from('workouts')
                    .insert(workout)
                    .select()
                    .single();
                
                if (error) throw error;
                return { data, error: null };
            } catch (err) {
                return handleError('workouts.create', err);
            }
        }
    };

    return {
        students,
        memberships,
        workouts,
        getClient
    };
})();

window.DB = DB;
