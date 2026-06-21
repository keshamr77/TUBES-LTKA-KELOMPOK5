import cron from 'node-cron';
import { db } from '../config/firebase';
import { isWithinSessionTime } from '../utils/time';

const SESSIONS = 'sessions';

/**
 * [R4] Auto-close sesi di sisi server.
 *
 * Tiap menit, cek semua sesi yang masih status "open". Kalau waktunya sudah
 * lewat jamSelesai (hasEnded), set status jadi "closed" + tambah closedAt.
 *
 * Ini memindahkan logika auto-close dari dashboard (client) ke backend (server),
 * jadi sesi tetap ditutup walau gak ada dosen yang buka dashboard.
 */
async function closeSesiYangLewat(): Promise<void> {
  try {
    const snapshot = await db
      .collection(SESSIONS)
      .where('status', '==', 'open')
      .get();

    if (snapshot.empty) return;

    let closedCount = 0;
    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as Record<string, any>;
      const timeStatus = isWithinSessionTime(
        data.tanggal,
        data.jamMulai,
        data.jamSelesai,
      );

      // Tutup sesi kalau waktunya sudah lewat (hasEnded)
      if (timeStatus.hasEnded) {
        batch.update(doc.ref, {
          status: 'closed',
          closedAt: new Date(),
          closedBy: 'auto_cron',
        });
        closedCount++;
      }
    });

    if (closedCount > 0) {
      await batch.commit();
      console.log(`[cron auto-close] Menutup ${closedCount} sesi yang sudah lewat waktu`);
    }
  } catch (error) {
    console.error('[cron auto-close] Gagal menutup sesi:', error);
  }
}

/**
 * Mulai scheduler auto-close. Dipanggil sekali saat server start.
 */
export function startAutoCloseCron(): void {
  // Jalan tiap menit
  cron.schedule('* * * * *', () => {
    closeSesiYangLewat();
  });
  console.log('⏰ Cron auto-close sesi aktif (cek tiap menit)');
}
