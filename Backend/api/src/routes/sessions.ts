import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/sessions/active
 * Mendapatkan daftar sesi yang aktif (sedang buka) untuk mahasiswa.
 * 
 * Phase 1 Behavior:
 * - Mengembalikan mock active session dengan koordinat ITB Ganesha & radius 300m
 * - Waktu mulai dan berakhir dinamis agar sesi selalu aktif saat dites
 */
router.get('/active', (req: Request, res: Response) => {
  const now = new Date();
  
  // Sesi mulai 10 menit yang lalu
  const startTime = new Date(now.getTime() - 10 * 60 * 1000);
  // Sesi berakhir 2 jam ke depan
  const endTime = new Date(now.getTime() + 120 * 60 * 1000);

  return res.json({
    success: true,
    data: [
      {
        sessionId: 'sess_mock_001',
        course: {
          id: 'course_ltka_001',
          name: 'Layanan Tersambung dan Komputasi Awan',
        },
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        location: {
          latitude: -6.89147,
          longitude: 107.61022,
          radiusMeters: 300,
        },
      },
    ],
  });
});

export default router;
