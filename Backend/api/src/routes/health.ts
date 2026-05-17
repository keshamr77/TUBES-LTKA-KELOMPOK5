import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /health
 * Untuk verify server up & jalan. Dipake Railway buat health check juga.
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      env: process.env.NODE_ENV || 'development',
    },
  });
});

export default router;
