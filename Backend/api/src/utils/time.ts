/**
 * Time Utilities — handle waktu WIB (UTC+7)
 *
 * Firestore menyimpan waktu sebagai string terpisah:
 *   tanggal:    "2026-05-20"  (YYYY-MM-DD)
 *   jamMulai:   "12:48"       (HH:mm)
 *   jamSelesai: "13:00"       (HH:mm)
 *
 * Server (Railway) jalan di UTC, jadi kita harus konversi WIB -> UTC
 * biar perbandingan waktu akurat.
 */

const WIB_OFFSET_HOURS = 7;

/**
 * Gabungkan tanggal + jam (dalam WIB) jadi objek Date UTC yang bisa dibandingkan.
 *
 * @param tanggal Format "YYYY-MM-DD" (contoh: "2026-05-20")
 * @param jam     Format "HH:mm" (contoh: "12:48")
 * @returns Date object (dalam UTC), atau null kalau format invalid
 */
export function parseWIBDateTime(tanggal: string, jam: string): Date | null {
  if (!tanggal || !jam) return null;

  // Validasi format dasar
  const tanggalMatch = tanggal.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const jamMatch = jam.match(/^(\d{1,2}):(\d{2})$/);
  if (!tanggalMatch || !jamMatch) return null;

  const [, year, month, day] = tanggalMatch.map(Number);
  const [, hour, minute] = jamMatch.map(Number);

  // Buat Date dalam UTC, lalu kurangi offset WIB
  // (jam 12:48 WIB = jam 05:48 UTC)
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute) -
    WIB_OFFSET_HOURS * 60 * 60 * 1000;

  const date = new Date(utcMillis);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Cek apakah waktu sekarang masih dalam rentang sesi.
 *
 * @returns Object berisi status validasi waktu
 */
export function isWithinSessionTime(
  tanggal: string,
  jamMulai: string,
  jamSelesai: string,
): {
  isActive: boolean;
  hasStarted: boolean;
  hasEnded: boolean;
  reason: 'active' | 'not_started' | 'ended' | 'invalid_time';
} {
  const startTime = parseWIBDateTime(tanggal, jamMulai);
  const endTime = parseWIBDateTime(tanggal, jamSelesai);

  if (!startTime || !endTime) {
    return {
      isActive: false,
      hasStarted: false,
      hasEnded: false,
      reason: 'invalid_time',
    };
  }

  const now = new Date();
  const hasStarted = now >= startTime;
  const hasEnded = now > endTime;
  const isActive = hasStarted && !hasEnded;

  return {
    isActive,
    hasStarted,
    hasEnded,
    reason: isActive
      ? 'active'
      : !hasStarted
        ? 'not_started'
        : 'ended',
  };
}

/**
 * Format Date object ke string format WIB "YYYY-MM-DD HH:mm:ss" (UTC+7)
 * 
 * @param date Objek Date
 * @returns string tanggal dan waktu dalam format "YYYY-MM-DD HH:mm:ss"
 */
export function formatToWIBString(date: Date): string {
  // WIB adalah UTC+7
  const wibTime = new Date(date.getTime() + WIB_OFFSET_HOURS * 60 * 60 * 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  const yyyy = wibTime.getUTCFullYear();
  const mm = pad(wibTime.getUTCMonth() + 1);
  const dd = pad(wibTime.getUTCDate());
  
  const hh = pad(wibTime.getUTCHours());
  const min = pad(wibTime.getUTCMinutes());
  const ss = pad(wibTime.getUTCSeconds());
  
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

