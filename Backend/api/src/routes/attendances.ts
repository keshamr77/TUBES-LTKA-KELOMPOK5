import { Router, Request, Response } from 'express';
import { isInRadius } from '../utils/haversine';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Semua route di file ini membutuhkan autentikasi
router.use(requireAuth);

/**
 * MOCK CAMPUS DATA
 * TODO Phase 2: Ganti dengan query Firestore ke collection courses/{courseId}.location
 * Koordinat ini: ITB.
 */
const MOCK_CAMPUS = {
  latitude: -6.89147,
  longitude: 107.61022,
  radiusMeters: 300,
};

/**
 * MOCK ATTENDANCE STORE
 * In-memory storage. Data akan hilang saat server restart.
 * TODO Phase 2: Ganti dengan write ke Firestore collection attendances.
 */
interface MockAttendance {
  attendanceId: string;
  sessionId: string;
  userId: string;
  timestamp: string;
  distanceMeters: number;
  status: string;
  selfieUrl: string;
}

const mockAttendances: MockAttendance[] = [];

/**
 * POST /api/attendances
 * Submit absensi dengan validasi Haversine.
 *
 * Phase 1 Behavior:
 * - Belum verify Firebase ID token (Phase 2)
 * - User ID dari header 'X-Mock-User-Id' (default: 'mock_user_001')
 * - Course location pakai MOCK_CAMPUS hardcoded
 * - Data disimpan in-memory (hilang saat restart)
 *
 * Format request & response: sesuai API_CONTRACT.md
 */
router.post('/', (req: Request, res: Response) => {
  const { sessionId, latitude, longitude, selfieUrl } = req.body;
  const userId = req.userId!;

  // === Validate payload ===
  if (
    !sessionId ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !selfieUrl
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PAYLOAD',
        message:
          'sessionId (string), latitude (number), longitude (number), dan selfieUrl (string) wajib diisi',
      },
    });
  }

  // === Validate coordinate range (-90..90 dan -180..180) ===
  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PAYLOAD',
        message: 'Koordinat GPS tidak valid',
      },
    });
  }

  // === Haversine validation ===
  const { inRadius, distanceMeters } = isInRadius(
    latitude,
    longitude,
    MOCK_CAMPUS.latitude,
    MOCK_CAMPUS.longitude,
    MOCK_CAMPUS.radiusMeters,
  );

  if (!inRadius) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'OUT_OF_RADIUS',
        message: 'Anda berada di luar radius kampus',
        details: {
          distanceMeters,
          allowedRadiusMeters: MOCK_CAMPUS.radiusMeters,
        },
      },
    });
  }

  // === Check duplicate (mock) ===
  const exists = mockAttendances.find(
    (a) => a.sessionId === sessionId && a.userId === userId,
  );
  if (exists) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'ALREADY_SUBMITTED',
        message: 'Anda sudah absen di sesi ini',
      },
    });
  }

  const newAttendance: MockAttendance = {
    attendanceId: `att_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    sessionId,
    userId: userId,
    timestamp: new Date().toISOString(),
    distanceMeters,
    status: 'present',
    selfieUrl,
  };
  mockAttendances.push(newAttendance);

  return res.status(201).json({
    success: true,
    data: {
      attendanceId: newAttendance.attendanceId,
      sessionId: newAttendance.sessionId,
      distanceMeters,
      status: 'present',
      timestamp: newAttendance.timestamp,
    },
  });
});

/**
 * GET /api/attendances/me
 * Riwayat absensi user yang lagi login.
 *
 * Phase 1 Behavior:
 * - Belum verify Firebase ID token (Phase 2)
 * - User ID dari header 'X-Mock-User-Id'
 * - Course name di-mock
 *
 * Query params:
 * - limit (optional, default 20, max 50)
 */
router.get('/me', (req: Request, res: Response) => {
  const userId = req.userId!;
  const limit = Math.min(
    parseInt(req.query.limit as string, 10) || 20,
    50,
  );

  const userAttendances = mockAttendances
    .filter((a) => a.userId === userId)
    .slice(-limit)
    .reverse() // terbaru di atas
    .map((a) => ({
      attendanceId: a.attendanceId,
      session: {
        id: a.sessionId,
        courseName: 'Mock Course (Phase 1)', // TODO Phase 2: query Firestore
      },
      timestamp: a.timestamp,
      status: a.status,
      distanceMeters: a.distanceMeters,
    }));

  return res.json({
    success: true,
    data: userAttendances,
  });
});

export default router;
