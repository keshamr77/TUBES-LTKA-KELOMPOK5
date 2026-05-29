import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';
import { db } from '../config/firebase';
import { isWithinSessionTime } from '../utils/time';
import { requireAuth } from '../middleware/auth';
 
const router = Router();
const COLLECTION = 'sessions';
 
// Tipe lokasi yang valid
const VALID_LOCATION_TYPES = ['smart_classroom', 'lab', 'wfh'] as const;
type LocationType = (typeof VALID_LOCATION_TYPES)[number];
 
/**
 * Turunkan locationRequired dari locationType.
 * wfh -> false (tidak butuh GPS), selain itu -> true.
 */
function deriveLocationRequired(locationType: string): boolean {
  return locationType !== 'wfh';
}
 
/**
 * Bentuk satu dokumen session jadi response object yang konsisten.
 */
function formatSession(
  doc:
    | admin.firestore.QueryDocumentSnapshot
    | admin.firestore.DocumentSnapshot,
) {
  const data = doc.data() as Record<string, any>;
  const timeStatus = isWithinSessionTime(
    data.tanggal,
    data.jamMulai,
    data.jamSelesai,
  );
 
  // Default ke smart_classroom kalau sesi lama belum punya field ini
  const locationType: string = data.locationType ?? 'smart_classroom';
  const locationRequired: boolean =
    typeof data.locationRequired === 'boolean'
      ? data.locationRequired
      : deriveLocationRequired(locationType);
 
  return {
    sessionId: doc.id,
    namaKelas: data.namaKelas ?? null,
    kodeKelas: data.kodeKelas ?? null,
    dosenEmail: data.dosenEmail ?? null,
    tanggal: data.tanggal ?? null,
    jamMulai: data.jamMulai ?? null,
    jamSelesai: data.jamSelesai ?? null,
    status: data.status ?? null,
    locationType,
    locationRequired,
    lokasiKelas: data.lokasiKelas ?? null,
    // Untuk WFH, location boleh null (tidak dipakai validasi)
    location: locationRequired
      ? {
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          radius: data.radius ?? null,
        }
      : null,
    // Status terkomputasi (soft auto-close): walau field status "open",
    // kalau waktu sudah lewat, isActive = false.
    isActive: data.status === 'open' && timeStatus.isActive,
    timeStatus: timeStatus.reason,
  };
}
 
/**
 * GET /api/sessions/active
 * List sesi yang sedang aktif (status open DAN dalam rentang waktu).
 *
 * Ini endpoint yang dipanggil mobile app Kesha.
 */
router.get('/active', async (_req: Request, res: Response) => {
  try {
    // Ambil semua sesi yang status-nya open dari Firestore
    const snapshot = await db
      .collection(COLLECTION)
      .where('status', '==', 'open')
      .get();
 
    // Filter lagi pakai logic waktu (soft auto-close)
    const activeSessions = snapshot.docs
      .map(formatSession)
      .filter((s) => s.isActive);
 
    return res.json({
      success: true,
      data: activeSessions,
    });
  } catch (error) {
    console.error('[GET /sessions/active]', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Gagal memuat sesi aktif' },
    });
  }
});
 
// Semua route di bawah ini membutuhkan autentikasi
router.use(requireAuth);
 
/**
 * GET /api/sessions
 * List semua sesi (buat dashboard dosen / debugging).
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .orderBy('createdAt', 'desc')
      .get();
 
    const sessions = snapshot.docs.map(formatSession);
    return res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('[GET /sessions]', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Gagal memuat daftar sesi' },
    });
  }
});
 
/**
 * GET /api/sessions/:sessionId
 * Detail satu sesi.
 */
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.sessionId).get();
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sesi tidak ditemukan' },
      });
    }
    return res.json({ success: true, data: formatSession(doc) });
  } catch (error) {
    console.error('[GET /sessions/:id]', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Gagal memuat sesi' },
    });
  }
});
 
/**
 * POST /api/sessions
 * Bikin sesi baru. Dipanggil dashboard dosen.
 *
 * Body:
 *   namaKelas, kodeKelas, dosenEmail, tanggal, jamMulai, jamSelesai,
 *   locationType ("smart_classroom" | "lab" | "wfh"), 
 *   latitude, longitude, radius (WAJIB kecuali locationType = "wfh")
 *
 * locationRequired diturunkan otomatis dari locationType (tidak perlu dikirim).
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      namaKelas,
      kodeKelas,
      dosenEmail,
      tanggal,
      jamMulai,
      jamSelesai,
      latitude,
      longitude,
      radius,
    } = req.body;
 
    // Default ke smart_classroom kalau dosen tidak memilih tipe lokasi
    const locationType: string = req.body.locationType || 'smart_classroom';
 
    // Validasi locationType valid
    if (!VALID_LOCATION_TYPES.includes(locationType as LocationType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message:
            'locationType harus salah satu dari: smart_classroom, lab, wfh',
        },
      });
    }
 
    const locationRequired = deriveLocationRequired(locationType);
 
    // Validasi field wajib (umum untuk semua tipe)
    if (!namaKelas || !kodeKelas || !tanggal || !jamMulai || !jamSelesai) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message:
            'Field wajib: namaKelas, kodeKelas, tanggal, jamMulai, jamSelesai',
        },
      });
    }
 
    // Validasi koordinat HANYA kalau butuh lokasi (kelas/lab)
    if (locationRequired) {
      if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        typeof radius !== 'number'
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PAYLOAD',
            message:
              'Untuk tipe smart_classroom/lab, latitude, longitude, dan radius (number) wajib diisi',
          },
        });
      }
    }
 
    const newSession: Record<string, any> = {
      namaKelas,
      kodeKelas,
      dosenEmail: dosenEmail ?? null,
      tanggal,
      jamMulai,
      jamSelesai,
      locationType,
      locationRequired,
      status: 'open',
      createdAt: new Date(),
    };
 
    // Simpan koordinat hanya kalau butuh lokasi. Untuk WFH, set null.
    if (locationRequired) {
      newSession.latitude = latitude;
      newSession.longitude = longitude;
      newSession.radius = radius;
    } else {
      newSession.latitude = null;
      newSession.longitude = null;
      newSession.radius = null;
    }
 
    const docRef = await db.collection(COLLECTION).add(newSession);
    const created = await docRef.get();
 
    return res.status(201).json({
      success: true,
      data: formatSession(created),
    });
  } catch (error) {
    console.error('[POST /sessions]', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Gagal membuat sesi' },
    });
  }
});
 
/**
 * PATCH /api/sessions/:sessionId/close
 * Tutup sesi secara manual (set status jadi "closed").
 */
router.patch('/:sessionId/close', async (req: Request, res: Response) => {
  try {
    const docRef = db.collection(COLLECTION).doc(req.params.sessionId);
    const doc = await docRef.get();
 
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sesi tidak ditemukan' },
      });
    }
 
    await docRef.update({ status: 'closed', closedAt: new Date() });
    const updated = await docRef.get();
 
    return res.json({ success: true, data: formatSession(updated) });
  } catch (error) {
    console.error('[PATCH /sessions/:id/close]', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Gagal menutup sesi' },
    });
  }
});
 
export default router;
 