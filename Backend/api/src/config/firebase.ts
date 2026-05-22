import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Inisialisasi Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

  if (fs.existsSync(serviceAccountPath)) {
    console.log('🛡️  Menginisialisasi Firebase Admin dengan file serviceAccountKey.json lokal...');
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    console.log('🛡️  Menginisialisasi Firebase Admin dengan environment variables...');
    
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
      // Hapus tanda kutip jika ada di awal dan akhir string
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      }
      // Ganti \n literal jadi newline asli (penting untuk private key)
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  }
}

// Export instance Firestore biar bisa dipakai di file lain
export const db = admin.firestore();
export const auth = admin.auth();
export default admin;