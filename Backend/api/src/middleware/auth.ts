import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { auth } from '../config/firebase';

/**
 * Middleware autentikasi user menggunakan Firebase ID Token.
 *
 * [R3] Mock fallback (X-Mock-User-Id) sekarang HANYA aktif di non-production.
 * Di production, request WAJIB pakai Firebase ID Token (Authorization: Bearer).
 *
 * Flow:
 * 1. Cek header `Authorization: Bearer <token>` → verify dengan Firebase Admin Auth.
 * 2. Kalau token valid → inject userId & userEmail dari token.
 * 3. Mock fallback (X-Mock-User-Id) hanya diterima kalau NODE_ENV !== 'production'.
 * 4. Kalau semua gagal → 401.
 */
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const mockUserIdHeader = req.header('X-Mock-User-Id');

  // Helper: terima mock hanya di non-production
  const tryMockFallback = (): boolean => {
    if (!IS_PRODUCTION && mockUserIdHeader) {
      req.userId = mockUserIdHeader;
      req.userEmail = `${mockUserIdHeader}@mock.local`;
      return true;
    }
    return false;
  };

  // 1. Verifikasi Firebase ID Token (Bearer) jika ada
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];

    if (!admin.apps.length) {
      console.warn('⚠️  Firebase Admin tidak terinisialisasi.');
      if (tryMockFallback()) return next();
      return res.status(501).json({
        success: false,
        error: {
          code: 'FIREBASE_NOT_CONFIGURED',
          message: 'Firebase Admin tidak terkonfigurasi di server.',
        },
      });
    }

    try {
      const decodedToken = await auth.verifyIdToken(token);
      req.userId = decodedToken.uid;
      req.userEmail = decodedToken.email;
      return next();
    } catch (error: any) {
      console.error('❌ Gagal verify Firebase ID Token:', error.message);
      // Token invalid → mock fallback HANYA di non-production
      if (tryMockFallback()) {
        console.warn('⚠️  Token invalid, pakai X-Mock-User-Id (dev only).');
        return next();
      }
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token autentikasi tidak valid atau sudah kedaluwarsa',
        },
      });
    }
  }

  // 2. Tidak ada Bearer token → coba mock fallback (dev only)
  if (tryMockFallback()) {
    return next();
  }

  // 3. Tidak ada metode auth yang valid
  return res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: IS_PRODUCTION
        ? 'Autentikasi diperlukan. Kirim Authorization Bearer token.'
        : 'Autentikasi diperlukan. Kirim Authorization Bearer token atau X-Mock-User-Id.',
    },
  });
};