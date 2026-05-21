import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Inisialisasi Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Ganti \n literal jadi newline asli (penting untuk private key)
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

// Export instance Firestore biar bisa dipakai di file lain
export const db = admin.firestore();
export const auth = admin.auth();
export default admin;