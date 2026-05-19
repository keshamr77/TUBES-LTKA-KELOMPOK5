/**
 * Haversine Formula
 * Hitung jarak antara 2 koordinat GPS di permukaan bumi (memperhitungkan kelengkungan bumi).
 *
 * @param lat1 Latitude titik 1 (derajat)
 * @param lon1 Longitude titik 1 (derajat)
 * @param lat2 Latitude titik 2 (derajat)
 * @param lon2 Longitude titik 2 (derajat)
 * @returns Jarak dalam meter
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Radius bumi dalam meter
  const toRad = (deg: number): number => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Cek apakah lokasi user di dalam radius kampus.
 *
 * @returns Object berisi inRadius (boolean) dan distanceMeters (number, 2 desimal)
 */
export function isInRadius(
  userLat: number,
  userLon: number,
  campusLat: number,
  campusLon: number,
  radiusMeters: number,
): { inRadius: boolean; distanceMeters: number } {
  const distance = haversineDistance(userLat, userLon, campusLat, campusLon);
  return {
    inRadius: distance <= radiusMeters,
    distanceMeters: parseFloat(distance.toFixed(2)),
  };
}
