import express from 'express';
import { supabase } from '../index.js';

const router = express.Router();

function getActorId(req) {
  return req.headers['x-actor-id'] || req.headers['x-user-id'] || null;
}

router.post('/', async (req, res) => {
  try {
    const { gym_id, recipient_student_ids, message, target_type = 'multiple' } = req.body;
    const actorId = getActorId(req);

    if (!gym_id) return res.status(400).json({ error: 'gym_id es obligatorio' });
    if (!Array.isArray(recipient_student_ids) || !recipient_student_ids.length) {
      return res.status(400).json({ error: 'recipient_student_ids debe tener al menos 1 id' });
    }
    if (!message?.trim()) return res.status(400).json({ error: 'message es obligatorio' });

    const { data, error } = await supabase
      .from('gym_messages')
      .insert({
        gym_id,
        sender_profile_id: actorId,
        recipient_student_ids,
        recipient_count: recipient_student_ids.length,
        target_type,
        message: message.trim()
      })
      .select('id, gym_id, sender_profile_id, recipient_count, target_type, message, created_at')
      .single();

    if (error) throw error;

    return res.status(201).json({ success: true, message: data });
  } catch (error) {
    console.error('Create message error:', error);
    return res.status(500).json({ error: 'No se pudo crear el mensaje', detail: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { gym_id, cursor, limit = 20 } = req.query;
    if (!gym_id) return res.status(400).json({ error: 'gym_id es obligatorio' });

    const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);
    let query = supabase
      .from('gym_messages')
      .select('id, gym_id, sender_profile_id, recipient_student_ids, recipient_count, target_type, message, created_at')
      .eq('gym_id', gym_id)
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (cursor) query = query.lt('created_at', cursor);

    const { data, error } = await query;
    if (error) throw error;

    const nextCursor = data?.length ? data[data.length - 1].created_at : null;
    return res.json({ success: true, items: data || [], next_cursor: nextCursor });
  } catch (error) {
    console.error('List messages error:', error);
    return res.status(500).json({ error: 'No se pudieron listar mensajes', detail: error.message });
  }
});

export default router;
