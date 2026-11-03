import { Router } from 'express';
import prisma from '../config/prisma.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

/**
 * Cloud Webhook for AWS EventBridge Scheduler / CloudWatch Events
 * Protected with a secret token (CRON_SECRET)
 */
router.post('/run', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerSecret = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const headerSecret = req.headers['x-cron-secret'];
    const secret = bearerSecret || headerSecret;

    if (!secret || secret !== env.CRON_SECRET) {
      throw new HttpError(401, 'Unauthorized cloud trigger', 'INVALID_CRON_SECRET');
    }

    console.log('[Cloud Jobs] Executing scheduled sp_run_jobs()...');
    const start = Date.now();
    await prisma.$executeRaw`CALL sp_run_jobs()`;
    const durationMs = Date.now() - start;

    return res.json({
      ok: true,
      job: 'sp_run_jobs',
      durationMs,
      executedAt: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

export default router;

