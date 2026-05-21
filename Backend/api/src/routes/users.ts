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

export default router;
