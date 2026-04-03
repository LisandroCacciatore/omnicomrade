import express from 'express';
import { supabase } from '../index.js';

const router = express.Router();
const MAX_EARLY_ADOPTERS = 15;

router.post('/access-requests', async (req, res) => {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();
    const fullName = (req.body?.full_name || '').trim() || null;
    const source = (req.body?.source || 'landing_form').trim();

    if (!email) {
      return res.status(400).json({ error: 'email es obligatorio' });
    }

    const { count, error: countError } = await supabase
      .from('access_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'approved']);

    if (countError) throw countError;

    if ((count || 0) >= MAX_EARLY_ADOPTERS) {
      return res.status(409).json({
        error: 'Funnel cerrado temporalmente',
        message: `Ya alcanzamos el cupo inicial de ${MAX_EARLY_ADOPTERS} personas.`
      });
    }

    const { data, error } = await supabase
      .from('access_requests')
      .upsert({ email, full_name: fullName, source, status: 'pending' }, { onConflict: 'email_normalized' })
      .select('id, email, full_name, status, requested_at')
      .single();

    if (error) throw error;

    return res.status(201).json({ success: true, request: data, cap: MAX_EARLY_ADOPTERS });
  } catch (error) {
    console.error('Access request error:', error);
    return res.status(500).json({ error: 'No se pudo registrar la solicitud', detail: error.message });
  }
});

router.post('/auth/post-login', async (req, res) => {
  try {
    const accessToken = req.body?.access_token;
    if (!accessToken) {
      return res.status(400).json({ error: 'access_token es obligatorio' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData?.user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const user = authData.user;
    const email = (user.email || '').toLowerCase();
    if (!email) {
      return res.status(422).json({ error: 'Usuario OAuth sin email' });
    }

    const { data: invite, error: inviteError } = await supabase
      .from('access_requests')
      .select('id, email, status, role, gym_id')
      .eq('email_normalized', email)
      .eq('status', 'approved')
      .maybeSingle();

    if (inviteError) throw inviteError;

    if (!invite) {
      return res.status(403).json({
        allowed: false,
        code: 'ACCESS_NOT_APPROVED',
        message: 'Tu email todavía no está aprobado. Completá el formulario de acceso.'
      });
    }

    const metadataName = user.user_metadata?.full_name || user.user_metadata?.name || null;
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: user.id,
      email,
      full_name: metadataName,
      role: invite.role || 'alumno',
      gym_id: invite.gym_id || null,
      updated_at: new Date().toISOString(),
    });

    if (profileError) throw profileError;

    return res.json({
      allowed: true,
      role: invite.role || 'alumno',
      gym_id: invite.gym_id || null,
      message: 'Acceso aprobado'
    });
  } catch (error) {
    console.error('Post login hook error:', error);
    return res.status(500).json({ error: 'No se pudo validar acceso', detail: error.message });
  }
});

export default router;
