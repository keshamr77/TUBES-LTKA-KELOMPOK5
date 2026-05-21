import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import healthRouter from './routes/health';
import attendancesRouter from './routes/attendances';
import sessionsRouter from './routes/sessions';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// === Global Middleware ===
app.use(cors()); // Allow semua origin (Phase 1-2). Nanti restrict ke domain Flutter & dashboard.
app.use(express.json({ limit: '1mb' }));

// === Request Logger ===
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// === Routes ===
app.use('/health', healthRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/attendances', attendancesRouter);
app.use('/api/sessions', sessionsRouter);

// === Root endpoint ===
app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      service: 'Absensi GPS API',
      version: '0.2.0-phase2',
      docs: 'https://github.com/keshamr77/TUBES-LTKA-KELOMPOK5/blob/fly-backend/API_CONTRACT.md',
      phase: 'Phase 2 — Firestore integration',
    },
  });
});

// === 404 handler ===
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} tidak ditemukan`,
    },
  });
});

// === Error handler ===
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Server error',
    },
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 Docs: API_CONTRACT.md di repo`);
});
