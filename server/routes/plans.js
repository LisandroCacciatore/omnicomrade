import express from 'express';
import { supabase } from '../index.js';

const router = express.Router();

router.get('/gyms/:gymId/membership-plans', async (req, res) => {
  try {
    const { gymId } = req.params;
    const { active_only = 'false' } = req.query;

    let query = supabase
      .from('gym_membership_plans')
      .select('id, gym_id, plan_key, label, duration_days, amount, is_active, updated_at, created_at')
      .eq('gym_id', gymId)
      .order('duration_days', { ascending: true });

    if (active_only === 'true') query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ success: true, items: data || [] });
  } catch (error) {
    console.error('Get plans error:', error);
    return res.status(500).json({ error: 'No se pudieron obtener los planes', detail: error.message });
  }
});

router.put('/gyms/:gymId/membership-plans/:planKey', async (req, res) => {
  try {
    const { gymId, planKey } = req.params;
    const { label, duration_days, amount, is_active = true } = req.body;
    if (!label || !duration_days || amount == null) {
      return res.status(400).json({ error: 'label, duration_days y amount son obligatorios' });
    }

    const row = {
      gym_id: gymId,
      plan_key: planKey,
      label,
      duration_days,
      amount,
      is_active,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('gym_membership_plans')
      .upsert(row, { onConflict: 'gym_id,plan_key' })
      .select('id, gym_id, plan_key, label, duration_days, amount, is_active, updated_at')
      .single();

    if (error) throw error;


    return res.json({ success: true, item: data });
  } catch (error) {
    console.error('Upsert plan error:', error);
    return res.status(500).json({ error: 'No se pudo guardar el plan', detail: error.message });
  }
});

router.post('/gyms/:gymId/membership-plans/:planKey/archive', async (req, res) => {
  try {
    const { gymId, planKey } = req.params;

    const { data, error } = await supabase
      .from('gym_membership_plans')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('gym_id', gymId)
      .eq('plan_key', planKey)
      .select('id, gym_id, plan_key, label, duration_days, amount, is_active, updated_at')
      .single();

    if (error) throw error;

    return res.json({ success: true, item: data });
  } catch (error) {
    console.error('Archive plan error:', error);
    return res.status(500).json({ error: 'No se pudo archivar el plan', detail: error.message });
  }
});

export default router;
