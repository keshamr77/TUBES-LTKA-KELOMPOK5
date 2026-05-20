import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

let firebaseApp: admin.app.App | null = null;

try {
  const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

  if (fs.existsSync(serviceAccountPath)) {
    console.log('🛡️  Menginisialisasi Firebase Admin dengan file serviceAccountKey.json lokal...');
    const serviceAccount = require(serviceAccountPath);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    console.log('🛡️  Menginisialisasi Firebase Admin dengan environment variables...');
    // Replace \n in private key if it comes from env var
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  } else {
    console.warn(
      '⚠️  Firebase Admin tidak dapat diinisialisasi: file serviceAccountKey.json tidak ditemukan ' +
      'dan environment variables Firebase tidak dikonfigurasi. Backend berjalan dalam MOCK MODE saja.'
    );
  }
} catch (error) {
  console.error('❌ Error saat menginisialisasi Firebase Admin:', error);
}

export { admin, firebaseApp };
