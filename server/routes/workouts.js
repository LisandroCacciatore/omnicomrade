import express from 'express';
import { supabase } from '../index.js';

const router = express.Router();

function getActorId(req) {
  return req.headers['x-actor-id'] || req.headers['x-user-id'] || null;
}

router.post('/intents', async (req, res) => {
  try {
    const { gym_id, student_id, routine_name, day_name, source_payload, expires_at } = req.body;
    if (!gym_id || !student_id) {
      return res.status(400).json({ error: 'gym_id y student_id son obligatorios' });
    }

    const actorId = getActorId(req);

    const { data: intent, error } = await supabase
      .from('workout_intents')
      .insert({
        gym_id,
        student_id,
        routine_name: routine_name || null,
        day_name: day_name || null,
        source_payload: source_payload || null,
        initiated_by: actorId,
        status: 'created',
        expires_at: expires_at || null
      })
      .select('id, gym_id, student_id, status, expires_at, created_at')
      .single();

    if (error) throw error;

    await supabase.from('workout_intent_events').insert({
      intent_id: intent.id,
      gym_id,
      actor_id: actorId,
      event_type: 'intent_created',
      payload: source_payload || {}
    });

    return res.status(201).json({ success: true, intent });
  } catch (error) {
    console.error('Create workout intent error:', error);
    return res.status(500).json({ error: 'No se pudo crear el intent', detail: error.message });
  }
});

router.post('/intents/:intentId/wellbeing', async (req, res) => {
  try {
    const { intentId } = req.params;
    const { wellbeing } = req.body;
    const actorId = getActorId(req);

    const { data: updated, error } = await supabase
      .from('workout_intents')
      .update({
        wellbeing_payload: wellbeing || {},
        status: 'wellbeing_done',
        updated_at: new Date().toISOString()
      })
      .eq('id', intentId)
      .in('status', ['created', 'wellbeing_done'])
      .select('id, gym_id, student_id, status, wellbeing_payload, updated_at')
      .single();

    if (error) throw error;

    await supabase.from('workout_intent_events').insert({
      intent_id: intentId,
      gym_id: updated.gym_id,
      actor_id: actorId,
      event_type: 'wellbeing_saved',
      payload: wellbeing || {}
    });

    return res.json({ success: true, intent: updated });
  } catch (error) {
    console.error('Save wellbeing intent error:', error);
    return res.status(500).json({ error: 'No se pudo registrar wellbeing', detail: error.message });
  }
});

router.post('/intents/:intentId/start', async (req, res) => {
  try {
    const { intentId } = req.params;
    const actorId = getActorId(req);

    const { data: intent, error: fetchError } = await supabase
      .from('workout_intents')
      .select('id, gym_id, student_id, routine_name, day_name, status')
      .eq('id', intentId)
      .single();

    if (fetchError || !intent) {
      return res.status(404).json({ error: 'Intent no encontrado' });
    }

    if (!['created', 'wellbeing_done', 'started'].includes(intent.status)) {
      return res.status(422).json({
        error: 'Intent no iniciable',
        code: 'INVALID_INTENT_STATUS',
        current_status: intent.status
      });
    }

    const nowIso = new Date().toISOString();

    const { data: session, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert({
        gym_id: intent.gym_id,
        student_id: intent.student_id,
        routine_name: intent.routine_name,
        day_name: intent.day_name,
        started_at: nowIso
      })
      .select('id, gym_id, student_id, started_at')
      .single();

    if (sessionError) throw sessionError;

    const { error: updateError } = await supabase
      .from('workout_intents')
      .update({ status: 'started', started_at: nowIso, updated_at: nowIso })
      .eq('id', intentId);

    if (updateError) throw updateError;

    await supabase.from('workout_intent_events').insert({
      intent_id: intentId,
      gym_id: intent.gym_id,
      actor_id: actorId,
      event_type: 'session_started',
      payload: { session_id: session.id }
    });

    return res.json({ success: true, session_id: session.id, intent_id: intentId });
  } catch (error) {
    console.error('Start workout session error:', error);
    return res.status(500).json({ error: 'No se pudo iniciar sesión de entrenamiento', detail: error.message });
  }
});

router.post('/sessions/:sessionId/complete', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { intent_id, logs, duration_minutes } = req.body;
    const actorId = getActorId(req);
    const completedAt = new Date().toISOString();

    const { data: session, error: sessionFetchError } = await supabase
      .from('workout_sessions')
      .select('id, gym_id, student_id, started_at')
      .eq('id', sessionId)
      .single();

    if (sessionFetchError || !session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    const { error: sessionUpdateError } = await supabase
      .from('workout_sessions')
      .update({
        completed_at: completedAt,
        duration_minutes: Number.isFinite(duration_minutes) ? duration_minutes : null
      })
      .eq('id', sessionId);

    if (sessionUpdateError) throw sessionUpdateError;

    if (Array.isArray(logs) && logs.length) {
      const rows = logs.map((log) => ({
        ...log,
        gym_id: session.gym_id,
        session_id: sessionId,
        student_id: session.student_id
      }));

      const { error: logsError } = await supabase.from('workout_exercise_logs').insert(rows);
      if (logsError) throw logsError;
    }

    if (intent_id) {
      const { error: intentError } = await supabase
        .from('workout_intents')
        .update({ status: 'completed', completed_at: completedAt, updated_at: completedAt })
        .eq('id', intent_id);
      if (intentError) throw intentError;

      await supabase.from('workout_intent_events').insert({
        intent_id,
        gym_id: session.gym_id,
        actor_id: actorId,
        event_type: 'session_completed',
        payload: { session_id: sessionId, logs_count: Array.isArray(logs) ? logs.length : 0 }
      });
    }

    return res.json({ success: true, session_id: sessionId, completed_at: completedAt });
  } catch (error) {
    console.error('Complete workout session error:', error);
    return res.status(500).json({ error: 'No se pudo completar la sesión', detail: error.message });
  }
});

export default router;
