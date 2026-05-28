import { Router, Request, Response } from 'express';
import { db } from '../config/firebase';
import { requireAuth } from '../middleware/auth';

const router = Router();
const COLLECTION = 'users';

// Semua route di file ini membutuhkan autentikasi
router.use(requireAuth);

/**
 * GET /api/users/me
 * Mendapatkan profil user yang sedang login dari Firestore
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    // Cari dokumen user berdasarkan UID di Firestore
    const userDoc = await db.collection(COLLECTION).doc(userId).get();

    if (!userDoc.exists) {
      // Jika mock user, berikan data mock agar testing lokal/offline berjalan mulus
      if (userId.startsWith('mock_')) {
        return res.json({
          success: true,
          data: {
            userId: userId,
            name: 'Mock Student ' + userId.replace('mock_user_', ''),
            nim: '12345678',
            email: req.userEmail || `${userId}@mock.local`,
            role: 'mahasiswa',
          },
        });
      }

      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Data user tidak ditemukan di database Firestore',
        },
      });
    }

    const userData = userDoc.data() as Record<string, any>;

    // Normalisasi key dari Firestore untuk menghindari trailing/leading space (seperti "email ")
    const normalizedData: Record<string, any> = {};
    for (const key of Object.keys(userData)) {
      normalizedData[key.trim()] = userData[key];
    }

    return res.json({
      success: true,
      data: {
        userId: userDoc.id,
        name: normalizedData.nama ?? normalizedData.name ?? '',
        nim: normalizedData.nim ?? '',
        email: normalizedData.email ?? req.userEmail ?? '',
        role: normalizedData.role ?? 'mahasiswa',
      },
    });
  } catch (error) {
    console.error('[GET /users/me]', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Gagal memuat profil user' },
    });
  }
});

/**
 * POST /api/users
 * Menyimpan/memperbarui data profil user di Firestore (dipanggil setelah registrasi/login jika belum sinkron)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, nim, email } = req.body;

    if (!name || !nim) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Nama dan NIM wajib diisi' },
      });
    }

    const userRef = db.collection(COLLECTION).doc(userId);
    
    // Simpan data dengan schema mahasiswa standard
    await userRef.set({
      nama: name,
      nim: nim.toString().trim(),
      email: email || req.userEmail || '',
      role: 'mahasiswa', // default role dari mobile app
    });

    console.log(`[POST /users] Berhasil menyimpan profil user: userId="${userId}", nama="${name}", nim="${nim}"`);

    return res.status(201).json({
      success: true,
      message: 'Profil user berhasil disimpan',
      data: {
        userId,
        name,
        nim,
        email: email || req.userEmail || '',
        role: 'mahasiswa',
      },
    });
  } catch (error) {
    console.error('[POST /users]', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Gagal menyimpan profil user' },
    });
  }
});

export default router;

