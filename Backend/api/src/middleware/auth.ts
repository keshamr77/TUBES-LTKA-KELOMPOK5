import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { auth } from '../config/firebase';

/**
 * Middleware untuk autentikasi user menggunakan Firebase ID Token.
 * 
 * Flow:
 * 1. Cek header `Authorization: Bearer <token>`
 * 2. Jika ada, verifikasi token tersebut dengan Firebase Admin Auth
 * 3. Jika token valid, inject `userId` dan `userEmail` ke objek `req`
 * 4. Jika token tidak ada atau tidak valid, cek header `X-Mock-User-Id` sebagai fallback
 * 5. Jika kedua cara gagal, kembalikan response 401 Unauthorized
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const mockUserIdHeader = req.header('X-Mock-User-Id');

  // 1. Verifikasi menggunakan Firebase ID Token (Bearer) jika ada
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];

    // Cek apakah Firebase Admin sudah terinisialisasi
    if (!admin.apps.length) {
      console.warn('⚠️  Firebase Admin tidak terinisialisasi. Melewati verifikasi JWT.');
      if (mockUserIdHeader) {
        req.userId = mockUserIdHeader;
        return next();
      }
      return res.status(501).json({
        success: false,
        error: {
          code: 'FIREBASE_NOT_CONFIGURED',
          message: 'Firebase Admin tidak terkonfigurasi di server. Silakan hubungi admin.',
        },
      });
    }

    try {
      const decodedToken = await auth.verifyIdToken(token);
      req.userId = decodedToken.uid;
      req.userEmail = decodedToken.email;
      return next();
    } catch (error: any) {
      console.error('❌ Gagal memverifikasi Firebase ID Token:', error.message);
      
      // Jika token salah/expired tapi ada mock header, gunakan fallback X-Mock-User-Id (di dev & prod selama transisi)
      if (mockUserIdHeader) {
        console.warn('⚠️  Token tidak valid, tetapi menggunakan fallback X-Mock-User-Id.');
        req.userId = mockUserIdHeader;
        req.userEmail = `${mockUserIdHeader}@mock.local`;
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

  // 2. Fallback menggunakan X-Mock-User-Id untuk kompatibilitas Phase 1 & Testing
  if (mockUserIdHeader) {
    req.userId = mockUserIdHeader;
    req.userEmail = `${mockUserIdHeader}@mock.local`;
    return next();
  }

  // 3. Tidak ada metode autentikasi yang valid
  return res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Autentikasi diperlukan. Kirim Authorization Bearer token atau X-Mock-User-Id.',
    },
  });
};
