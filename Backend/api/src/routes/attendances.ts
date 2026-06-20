import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';
import { db } from '../config/firebase';
import { isInRadius } from '../utils/haversine';
import { requireAuth } from '../middleware/auth';
import { isWithinSessionTime, formatToWIBString, getAttendanceWindow } from '../utils/time';

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
 * Body: { sessionId, latitude?, longitude?, selfieUrl, type? }
 * type: 'check_in' (default) | 'check_out'
 *
 * Window waktu:
 *   - check_in  hanya boleh di 15 menit awal sesi
 *   - check_out hanya boleh di 15 menit akhir sesi
 *
 * Geofencing:
 *   - Kalau sesi locationRequired = true (kelas/lab): validasi radius (Haversine)
 *   - Kalau sesi locationRequired = false (wfh): SKIP geofencing, koordinat tidak disimpan
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, latitude, longitude, selfieUrl } = req.body;
    const type: string = req.body.type || 'check_in';
    const userId = req.userId!;

    // === Validate type ===
    if (type !== 'check_in' && type !== 'check_out') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'type harus "check_in" atau "check_out"',
        },
      });
    }

    // === Validate payload dasar (sessionId & selfieUrl selalu wajib) ===
    if (!sessionId || !selfieUrl) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'sessionId (string) dan selfieUrl (string) wajib diisi',
        },
      });
    }

    // === Ambil dokumen sesi (perlu lebih awal untuk tahu butuh lokasi atau tidak) ===
    const sessionDoc = await db.collection(SESSIONS).doc(sessionId).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sesi tidak ditemukan' },
      });
    }
    const session = sessionDoc.data() as Record<string, any>;

    // Tentukan apakah sesi ini butuh validasi lokasi.
    // Default true (smart_classroom) untuk sesi lama yang belum punya field ini.
    const locationRequired: boolean =
      typeof session.locationRequired === 'boolean'
        ? session.locationRequired
        : (session.locationType ?? 'smart_classroom') !== 'wfh';

    // === Validasi koordinat: wajib HANYA kalau sesi butuh lokasi ===
    if (locationRequired) {
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PAYLOAD',
            message: 'latitude & longitude (number) wajib untuk sesi kelas/lab',
          },
        });
      }
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PAYLOAD', message: 'Koordinat GPS tidak valid' },
        });
      }
    }

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

    // === Validasi window 15 menit (tetap berlaku untuk SEMUA tipe, termasuk WFH) ===
    const window = getAttendanceWindow(
      session.tanggal,
      session.jamMulai,
      session.jamSelesai,
    );

    if (type === 'check_in' && !window.allowCheckIn) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'OUTSIDE_CHECKIN_WINDOW',
          message: 'Waktu absen masuk sudah lewat. Check-in hanya tersedia di 15 menit awal sesi.',
        },
      });
    }

    if (type === 'check_out' && !window.allowCheckOut) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'OUTSIDE_CHECKOUT_WINDOW',
          message: 'Belum waktunya absen keluar. Check-out hanya tersedia di 15 menit akhir sesi.',
        },
      });
    }

    // === Validasi geofencing (Haversine) — HANYA kalau sesi butuh lokasi ===
    let distanceMeters: number | null = null;

    if (locationRequired) {
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

      const result = isInRadius(
        latitude,
        longitude,
        session.latitude,
        session.longitude,
        session.radius,
      );
      distanceMeters = result.distanceMeters;

      if (!result.inRadius) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'OUT_OF_RADIUS',
            message: 'Anda berada di luar radius kampus',
            details: {
              distanceMeters: result.distanceMeters,
              allowedRadiusMeters: session.radius,
            },
          },
        });
      }
    }
    // Kalau WFH (locationRequired = false): skip semua validasi lokasi di atas.

    // === [R2] Deterministic document ID: {sessionId}_{userId}_{type} ===
    // ID dibentuk dari kombinasi sesi+user+tipe, jadi mustahil ada duplikat
    // di level database (idempotent). Kalau submit 2x, dokumen kedua menimpa
    // yang pertama alih-alih bikin baru.
    const attendanceDocId = `${sessionId}_${userId}_${type}`;
    const attendanceRef = db.collection(ATTENDANCES).doc(attendanceDocId);

    // === Cek duplikat per type (sudah check-in / check-out di sesi ini?) ===
    // Sekarang cukup cek 1 dokumen by ID (bukan query) — lebih cepat & akurat.
    const existingDoc = await attendanceRef.get();
    if (existingDoc.exists) {
      const label = type === 'check_in' ? 'absen masuk' : 'absen keluar';
      return res.status(409).json({
        success: false,
        error: { code: 'ALREADY_SUBMITTED', message: `Anda sudah melakukan ${label} di sesi ini` },
      });
    }

    // === Jika check_out, pastikan sudah check_in dulu ===
    // Pakai deterministic ID juga: cek dokumen check_in by ID.
    if (type === 'check_out') {
      const checkInDocId = `${sessionId}_${userId}_check_in`;
      const checkInDoc = await db.collection(ATTENDANCES).doc(checkInDocId).get();

      if (!checkInDoc.exists) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CHECK_IN_REQUIRED',
            message: 'Anda harus melakukan absen masuk terlebih dahulu sebelum absen keluar',
          },
        });
      }
    }

    // === Lookup data user (nama & nim) dari collection 'users' ===
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
      console.error('[POST /attendances] Gagal lookup user:', lookupErr);
    }

    // === Simpan absensi ke Firestore ===
    const now = new Date();
    const newAttendance: Record<string, any> = {
      sessionId,
      userId,
      type,
      nama: userNama,
      nim: userNim,
      namaKelas: session.namaKelas ?? null,
      kodeKelas: session.kodeKelas ?? null,
      locationType: session.locationType ?? 'smart_classroom',
      distanceMeters, // null kalau WFH
      selfieUrl,
      status: 'present',
      timestamp: now,
      waktu: formatToWIBString(now),
    };

    // Simpan koordinat HANYA kalau sesi butuh lokasi (WFH tidak menyimpan koordinat)
    if (locationRequired) {
      newAttendance.latitude = latitude;
      newAttendance.longitude = longitude;
    } else {
      newAttendance.latitude = null;
      newAttendance.longitude = null;
    }

    // [R2] Pakai .set() dengan ID deterministik (bukan .add() yang ID random)
    await attendanceRef.set(newAttendance);

    return res.status(201).json({
      success: true,
      data: {
        attendanceId: attendanceDocId,
        sessionId,
        type,
        nama: userNama,
        nim: userNim,
        distanceMeters,
        locationType: newAttendance.locationType,
        status: 'present',
        timestamp: now.toISOString(),
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
 * [R1] Query pakai orderBy('timestamp','desc').limit() langsung di Firestore,
 * bukan sort+slice di memori. Lebih efisien — Firestore cuma kirim N dokumen
 * terbaru, bukan semua. (Butuh composite index userId + timestamp.)
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);

    console.log(`[GET /attendances/me] userId="${userId}", limit=${limit}`);

    // [R1] Sort & limit dilakukan di Firestore (server-side), bukan di memori.
    const snapshot = await db
      .collection(ATTENDANCES)
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    console.log(`[GET /attendances/me] Found ${snapshot.size} documents for userId="${userId}"`);

    const attendances = snapshot.docs.map(
      (doc: admin.firestore.QueryDocumentSnapshot) => {
        const a = doc.data() as Record<string, any>;
        const ts =
          a.timestamp?.toDate?.() instanceof Date
            ? a.timestamp.toDate()
            : new Date(a.timestamp);
        return {
          attendanceId: doc.id,
          type: a.type ?? 'check_in',
          nama: a.nama ?? null,
          nim: a.nim ?? null,
          session: {
            id: a.sessionId,
            courseName: a.namaKelas ?? 'Unknown',
          },
          locationType: a.locationType ?? 'smart_classroom',
          timestamp: ts.toISOString(),
          status: a.status,
          latitude: a.latitude ?? null,
          longitude: a.longitude ?? null,
          distanceMeters: a.distanceMeters ?? null,
        };
      },
    );

    return res.json({ success: true, data: attendances });
  } catch (error) {
    console.error('[GET /attendances/me]', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Gagal memuat riwayat absensi' },
    });
  }
});

/**
 * GET /api/attendances/me/status
 * Cek status absensi user di sesi tertentu (sudah check-in? sudah check-out?).
 */
router.get('/me/status', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'sessionId query parameter wajib diisi' },
      });
    }

    const sessionDoc = await db.collection(SESSIONS).doc(sessionId).get();
    let windowInfo: any = { allowCheckIn: false, allowCheckOut: false, reason: 'session_not_found' };
    if (sessionDoc.exists) {
      const session = sessionDoc.data() as Record<string, any>;
      windowInfo = getAttendanceWindow(session.tanggal, session.jamMulai, session.jamSelesai);
    }

    // [R2] Pakai deterministic ID — cek langsung 2 dokumen (check_in & check_out)
    // tanpa query. Lebih cepat & gak butuh index.
    const checkInDoc = await db.collection(ATTENDANCES).doc(`${sessionId}_${userId}_check_in`).get();
    const checkOutDoc = await db.collection(ATTENDANCES).doc(`${sessionId}_${userId}_check_out`).get();

    let hasCheckedIn = false;
    let hasCheckedOut = false;
    let checkInTime: string | null = null;
    let checkOutTime: string | null = null;

    if (checkInDoc.exists) {
      hasCheckedIn = true;
      const data = checkInDoc.data() as Record<string, any>;
      const ts = data.timestamp?.toDate?.() instanceof Date
        ? data.timestamp.toDate()
        : new Date(data.timestamp);
      checkInTime = ts.toISOString();
    }

    if (checkOutDoc.exists) {
      hasCheckedOut = true;
      const data = checkOutDoc.data() as Record<string, any>;
      const ts = data.timestamp?.toDate?.() instanceof Date
        ? data.timestamp.toDate()
        : new Date(data.timestamp);
      checkOutTime = ts.toISOString();
    }

    return res.json({
      success: true,
      data: {
        sessionId,
        hasCheckedIn,
        hasCheckedOut,
        checkInTime,
        checkOutTime,
        window: windowInfo,
      },
    });
  } catch (error) {
    console.error('[GET /attendances/me/status]', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Gagal memuat status absensi' },
    });
  }
});

export default router;