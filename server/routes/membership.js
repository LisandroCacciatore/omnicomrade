import express from 'express';
import { supabase } from '../index.js';
import { isValidTransition, calculateState } from '../services/membershipStateMachine.js';

const router = express.Router();

router.post('/transition', async (req, res) => {
  try {
    const { student_id, to_state, reason } = req.body;
    const actorId = req.headers['x-actor-id'] || req.headers['x-user-id'] || null;

    if (!student_id) {
      return res.status(400).json({ error: 'student_id es obligatorio' });
    }
    if (!to_state) {
      return res.status(400).json({ error: 'to_state es obligatorio' });
    }

    const VALID_STATES = ['pendiente', 'activa', 'por_vencer', 'vencida', 'suspendida'];
    if (!VALID_STATES.includes(to_state)) {
      return res.status(400).json({ error: `Estado inválido: ${to_state}` });
    }

    const { data: student, error: fetchError } = await supabase
      .from('students')
      .select('id, membership_status, memberships(end_date)')
      .eq('id', student_id)
      .single();

    if (fetchError || !student) {
      return res.status(404).json({ error: 'Atleta no encontrado' });
    }

    const currentState = student.membership_status;
    const validation = isValidTransition(currentState, to_state);

    if (!validation.valid) {
      return res.status(422).json({
        error: 'Transición inválida',
        code: 'INVALID_TRANSITION',
        current_state: currentState,
        requested_state: to_state,
        message: validation.error
      });
    }

    let computedState = to_state;
    if (to_state !== 'suspendida' && student.memberships?.length > 0) {
      computedState = calculateState({
        status: to_state,
        end_date: student.memberships[0].end_date
      });
    }

    const { error: updateError } = await supabase
      .from('students')
      .update({
        membership_status: computedState,
        updated_at: new Date().toISOString()
      })
      .eq('id', student_id);

    if (updateError) {
      throw updateError;
    }

    await supabase.from('membership_transitions').insert({
      student_id,
      from_state: currentState,
      to_state: computedState,
      actor_id: actorId,
      reason: reason || null,
      triggered_by: 'api'
    });

    return res.json({
      success: true,
      student_id,
      previous_state: currentState,
      new_state: computedState,
      message: `Estado cambiado de ${currentState} a ${computedState}`
    });
  } catch (error) {
    console.error('Transition error:', error);
    return res.status(500).json({ error: 'Error interno', detail: error.message });
  }
});

router.post('/recompute/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { data, error } = await supabase.rpc('rpc_membership_recompute_student', {
      p_student_id: studentId
    });

    if (error) throw error;

    return res.json({ success: true, student_id: studentId, status: data });
  } catch (error) {
    console.error('Membership recompute student error:', error);
    return res.status(500).json({ error: 'No se pudo recomputar estado', detail: error.message });
  }
});

router.post('/recompute-all', async (req, res) => {
  try {
    const { gym_id } = req.body;
    if (!gym_id) {
      return res.status(400).json({ error: 'gym_id es obligatorio' });
    }

    const { data, error } = await supabase.rpc('rpc_membership_recompute_gym', {
      p_gym_id: gym_id
    });

    if (error) throw error;

    return res.json({ success: true, gym_id, updated: data });
  } catch (error) {
    console.error('Membership recompute gym error:', error);
    return res
      .status(500)
      .json({ error: 'No se pudo recomputar estados del gym', detail: error.message });
  }
});

router.get('/states', (req, res) => {
  return res.json({
    states: ['pendiente', 'activa', 'por_vencer', 'vencida', 'suspendida'],
    transitions: {
      pendiente: ['activa', 'suspendida'],
      activa: ['por_vencer', 'vencida', 'suspendida'],
      por_vencer: ['activa', 'vencida', 'suspendida'],
      vencida: ['activa', 'suspendida'],
      suspendida: ['activa', 'pendiente']
    }
  });
});

export default router;
