import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { processOnboarding } from '../services/onboardingService.js';

const router = express.Router();

const processedRequests = new Map();

router.post('/', async (req, res) => {
  try {
    const { request_id, gym_id, student, membership, program } = req.body;

    if (!request_id) {
      return res.status(400).json({ error: 'request_id es obligatorio' });
    }
    if (!gym_id) {
      return res.status(400).json({ error: 'gym_id es obligatorio' });
    }
    if (!student) {
      return res.status(400).json({ error: 'student es obligatorio' });
    }

    if (processedRequests.has(request_id)) {
      const cached = processedRequests.get(request_id);
      return res.status(200).json({
        ...cached,
        idempotent: true
      });
    }

    const actorId = req.headers['x-actor-id'] || req.headers['x-user-id'] || null;

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

    processedRequests.set(request_id, result);

    setTimeout(() => processedRequests.delete(request_id), 3600000);

    const statusCode = result.success ? 201 : 422;
    return res.status(statusCode).json(result);
  } catch (error) {
    console.error('Onboarding error:', error);

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

    if (processedRequests.has(requestId)) {
      return res.json({ status: 'completed', data: processedRequests.get(requestId) });
    }

    return res.json({ status: 'not_found' });
  } catch (error) {
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
