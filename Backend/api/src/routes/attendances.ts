import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';
import { db } from '../config/firebase';
import { isInRadius } from '../utils/haversine';
import { requireAuth } from '../middleware/auth';
import { isWithinSessionTime } from '../utils/time';

const router = Router();

// Semua route di file ini membutuhkan autentikasi
router.use(requireAuth);

const ATTENDANCES = 'attendances';
const SESSIONS = 'sessions';
const USERS = 'users';

/**
 * POST /api/attendances
 * Submit absensi dengan validasi geofencing (Haversine) + validasi waktu sesi.
 *
 * Phase 2 Behavior:
 * - Koordinat kampus & radius diambil dari dokumen SESI (bukan hardcode)
 * - Validasi: sesi ada? status open? dalam rentang waktu? dalam radius? belum absen?
 * - Disimpan ke Firestore collection 'attendances'
 * - User ID sementara dari header 'X-Mock-User-Id' (Phase 3: dari Firebase Auth token)
 *
 * Body: { sessionId, latitude, longitude, selfieUrl }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
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
            'sessionId (string), latitude (number), longitude (number), selfieUrl (string) wajib diisi',
        },
      });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Koordinat GPS tidak valid' },
      });
    }

    // === Ambil dokumen sesi ===
    const sessionDoc = await db.collection(SESSIONS).doc(sessionId).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sesi tidak ditemukan' },
      });
    }
    const session = sessionDoc.data() as Record<string, any>;

    // === Validasi status sesi ===
    if (session.status !== 'open') {
      return res.status(410).json({
        success: false,
        error: { code: 'SESSION_CLOSED', message: 'Sesi sudah ditutup' },
      });
    }

    // === Validasi waktu sesi (soft auto-close) ===
    const timeStatus = isWithinSessionTime(
      session.tanggal,
      session.jamMulai,
      session.jamSelesai,
    );
    if (!timeStatus.isActive) {
      const code =
        timeStatus.reason === 'not_started'
          ? 'SESSION_NOT_STARTED'
          : 'SESSION_CLOSED';
      const message =
        timeStatus.reason === 'not_started'
          ? 'Sesi belum dimulai'
          : 'Waktu sesi sudah berakhir';
      return res.status(410).json({
        success: false,
        error: { code, message },
      });
    }

    // === Validasi geofencing (Haversine) pakai koordinat SESI ===
    if (
      typeof session.latitude !== 'number' ||
      typeof session.longitude !== 'number' ||
      typeof session.radius !== 'number'
    ) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Data lokasi sesi tidak lengkap',
        },
      });
    }

    const { inRadius, distanceMeters } = isInRadius(
      latitude,
      longitude,
      session.latitude,
      session.longitude,
      session.radius,
    );

    if (!inRadius) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'OUT_OF_RADIUS',
          message: 'Anda berada di luar radius kampus',
          details: {
            distanceMeters,
            allowedRadiusMeters: session.radius,
          },
        },
      });
    }

    // === Cek duplikat (sudah absen di sesi ini?) ===
    const existing = await db
      .collection(ATTENDANCES)
      .where('sessionId', '==', sessionId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(409).json({
        success: false,
        error: { code: 'ALREADY_SUBMITTED', message: 'Anda sudah absen di sesi ini' },
      });
    }

    // === Lookup data user (nama & nim) dari collection 'users' ===
    // Document ID di 'users' = userId (UID Firebase Auth).
    // Kalau user gak ketemu, absensi tetap disimpan dengan nama/nim null
    // (biar absensi gak ke-blokir gara-gara data user belum lengkap).
    let userNama: string | null = null;
    let userNim: string | null = null;
    try {
      const userDoc = await db.collection(USERS).doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data() as Record<string, any>;
        userNama = userData.nama ?? null;
        userNim = userData.nim ?? null;
      } else {
        console.warn(`[POST /attendances] User ${userId} tidak ditemukan di collection users`);
      }
    } catch (lookupErr) {
      // Lookup gagal jangan bikin absensi gagal total — log aja, lanjut dengan null
      console.error('[POST /attendances] Gagal lookup user:', lookupErr);
    }

    // === Simpan absensi ke Firestore ===
    const newAttendance = {
      sessionId,
      userId,
      nama: userNama,
      nim: userNim,
      namaKelas: session.namaKelas ?? null,
      kodeKelas: session.kodeKelas ?? null,
      latitude,
      longitude,
      distanceMeters,
      selfieUrl,
      status: 'present',
      timestamp: new Date(),
    };

    const docRef = await db.collection(ATTENDANCES).add(newAttendance);

    return res.status(201).json({
      success: true,
      data: {
        attendanceId: docRef.id,
        sessionId,
        nama: userNama,
        nim: userNim,
        distanceMeters,
        status: 'present',
        timestamp: newAttendance.timestamp.toISOString(),
      },
    });
  } catch (error) {
    console.error('[POST /attendances]', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Gagal submit absensi' },
    });
  }
});

/**
 * GET /api/attendances/me
 * Riwayat absensi user yang lagi login.
 *
 * Query: ?limit=20 (max 50)
 * User ID sementara dari header 'X-Mock-User-Id'.
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);

    console.log(`[GET /attendances/me] userId="${userId}", limit=${limit}`);

    const snapshot = await db
      .collection(ATTENDANCES)
      .where('userId', '==', userId)
      .get();

    console.log(`[GET /attendances/me] Found ${snapshot.size} documents for userId="${userId}"`);

    // Sort by timestamp desc di sisi server (hindari butuh composite index)
    const attendances = snapshot.docs
      .map((doc: admin.firestore.QueryDocumentSnapshot) => {
        const a = doc.data() as Record<string, any>;
        const ts =
          a.timestamp?.toDate?.() instanceof Date
            ? a.timestamp.toDate()
            : new Date(a.timestamp);
        return {
          attendanceId: doc.id,
          nama: a.nama ?? null,
          nim: a.nim ?? null,
          session: {
            id: a.sessionId,
            courseName: a.namaKelas ?? 'Unknown',
          },
          timestamp: ts.toISOString(),
          status: a.status,
          latitude: a.latitude ?? 0.0,
          longitude: a.longitude ?? 0.0,
          distanceMeters: a.distanceMeters,
          _sortTs: ts.getTime(),
        };
      })
      .sort((x, y) => y._sortTs - x._sortTs)
      .slice(0, limit)
      .map(({ _sortTs, ...rest }) => rest);

    return res.json({ success: true, data: attendances });
  } catch (error) {
    console.error('[GET /attendances/me]', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Gagal memuat riwayat absensi' },
    });
  }
});

export default router;