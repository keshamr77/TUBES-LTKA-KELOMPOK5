const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

function formatToWIBString(date) {
  const wibTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n) => n.toString().padStart(2, '0');
  const yyyy = wibTime.getUTCFullYear();
  const mm = pad(wibTime.getUTCMonth() + 1);
  const dd = pad(wibTime.getUTCDate());
  const hh = pad(wibTime.getUTCHours());
  const min = pad(wibTime.getUTCMinutes());
  const ss = pad(wibTime.getUTCSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

async function main() {
  console.log('--- STARTING MIGRATION ---');
  
  // 1. Ambil semua data absensi
  const attendancesSnapshot = await db.collection('attendances').get();
  console.log(`Menemukan ${attendancesSnapshot.size} dokumen absensi.`);

  for (const doc of attendancesSnapshot.docs) {
    const data = doc.data();
    const docId = doc.id;
    console.log(`Memproses absensi ID: ${docId}`);

    let needsUpdate = false;
    const updateData = {};

    // 2. Periksa & Perbaiki Waktu
    if (!data.waktu) {
      let dateObj = null;
      if (data.timestamp) {
        if (typeof data.timestamp.toDate === 'function') {
          dateObj = data.timestamp.toDate();
        } else {
          dateObj = new Date(data.timestamp);
        }
      } else {
        // Fallback jika tidak ada timestamp sama sekali
        dateObj = new Date();
      }

      if (dateObj && !isNaN(dateObj.getTime())) {
        updateData.waktu = formatToWIBString(dateObj);
        needsUpdate = true;
        console.log(`  -> Menambahkan waktu: ${updateData.waktu}`);
      }
    }

    // 3. Periksa & Perbaiki Nama & NIM
    if (data.userId && (!data.nama || !data.nim)) {
      console.log(`  -> Nama atau NIM kosong untuk userId: "${data.userId}". Mencari di collection users...`);
      
      let userDoc = await db.collection('users').doc(data.userId).get();
      let userData = userDoc.exists ? userDoc.data() : null;

      // Jika user tidak ada di Firestore, coba cari di Firebase Auth & buat dokumennya di Firestore (Self-Healing)
      if (!userData) {
        console.log(`  -> User tidak ditemukan di Firestore. Mencari di Firebase Auth...`);
        try {
          const authUser = await auth.getUser(data.userId);
          console.log(`  -> User ditemukan di Firebase Auth: "${authUser.displayName}" (${authUser.email})`);
          
          let extractedNim = '';
          const email = authUser.email || '';
          const nimMatch = email.match(/^(\d+)/);
          if (nimMatch) {
            extractedNim = nimMatch[1];
          } else {
            // Fallback default jika tidak ada angka di email
            extractedNim = '18123000'; 
          }

          const newUserData = {
            nama: authUser.displayName || email.split('@')[0],
            nim: extractedNim,
            email: email,
            role: 'mahasiswa'
          };

          // Tulis ke collection users
          await db.collection('users').doc(data.userId).set(newUserData);
          console.log(`  -> Berhasil membuat dokumen user baru di Firestore:`, newUserData);
          
          userData = newUserData;
        } catch (authErr) {
          console.error(`  -> Gagal mengambil user dari Firebase Auth/membuat dokumen Firestore:`, authErr.message);
        }
      }

      if (userData) {
        // Key normalisation
        const normalized = {};
        for (const k of Object.keys(userData)) {
          normalized[k.trim()] = userData[k];
        }

        const nama = normalized.nama || normalized.name || normalized.Dosen || null;
        const nim = normalized.nim || null;

        if (nama && nama !== data.nama) {
          updateData.nama = nama;
          needsUpdate = true;
          console.log(`  -> Menambahkan nama: "${nama}"`);
        }
        if (nim && nim !== data.nim) {
          updateData.nim = nim;
          needsUpdate = true;
          console.log(`  -> Menambahkan nim: "${nim}"`);
        }
      }
    }

    if (needsUpdate) {
      await db.collection('attendances').doc(docId).update(updateData);
      console.log(`  -> Dokumen ${docId} BERHASIL diupdate.`);
    } else {
      console.log(`  -> Dokumen ${docId} sudah lengkap, tidak butuh update.`);
    }
    console.log('-------------------');
  }

  console.log('--- MIGRATION COMPLETED ---');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
