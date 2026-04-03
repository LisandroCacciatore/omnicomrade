import express from 'express';
import crypto from 'crypto';
import { processOnboarding } from '../services/onboardingService.js';
import { supabase } from '../index.js';

const router = express.Router();

function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function getLedgerRow(requestId) {
  const { data, error } = await supabase
    .from('onboarding_requests')
    .select('id, request_id, gym_id, status, result_json, error_code, error_message')
    .eq('request_id', requestId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

router.post('/', async (req, res) => {
  try {
    const { request_id, gym_id, student, membership, program } = req.body;

    if (!request_id) return res.status(400).json({ error: 'request_id es obligatorio' });
    if (!gym_id) return res.status(400).json({ error: 'gym_id es obligatorio' });
    if (!student) return res.status(400).json({ error: 'student es obligatorio' });

    const actorId = req.headers['x-actor-id'] || req.headers['x-user-id'] || null;
    const payloadHash = hashPayload({ gym_id, student, membership, program });

    const existing = await getLedgerRow(request_id);

    if (existing?.status === 'success' && existing.result_json) {
      return res.status(200).json({
        ...existing.result_json,
        idempotent: true,
        source: 'api'
      });
    }

    if (!existing) {
      const { error: insertError } = await supabase.from('onboarding_requests').insert({
        request_id,
        gym_id,
        actor_id: actorId,
        payload_hash: payloadHash,
        status: 'processing'
      });
      if (insertError) throw insertError;
    }

    const result = await processOnboarding(
      {
        requestId: request_id,
        gymId: gym_id,
        student,
        membership,
        program
      },
      actorId
    );

    await supabase
      .from('onboarding_requests')
      .update({
        status: result.success ? 'success' : 'failed',
        result_json: result,
        updated_at: new Date().toISOString()
      })
      .eq('request_id', request_id);

    const statusCode = result.success ? 201 : 422;
    return res.status(statusCode).json({ ...result, source: 'api' });
  } catch (error) {
    console.error('Onboarding error:', error);

    const requestId = req.body?.request_id;
    if (requestId) {
      await supabase
        .from('onboarding_requests')
        .update({
          status: 'failed',
          error_code: error.code || 'ONBOARDING_ERROR',
          error_message: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('request_id', requestId);
    }

    const statusCode = error.recoverable === false ? 500 : 422;
    return res.status(statusCode).json({
      success: false,
      error: error.code,
      message: error.message,
      recoverable: error.recoverable !== false
    });
  }
});

router.get('/status/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const ledger = await getLedgerRow(requestId);

    if (!ledger) return res.json({ status: 'not_found' });
    if (ledger.status === 'processing') return res.json({ status: 'processing' });

    if (ledger.status === 'success') {
      return res.json({ status: 'completed', data: ledger.result_json });
    }

    return res.json({
      status: 'failed',
      error: ledger.error_code,
      message: ledger.error_message
    });
  } catch (error) {
    console.error('Onboarding status error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
