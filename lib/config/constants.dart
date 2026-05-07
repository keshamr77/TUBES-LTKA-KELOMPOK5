/// Konstanta aplikasi Sistem Absensi Berbasis Lokasi
/// File ini berisi semua konfigurasi statis yang digunakan di seluruh aplikasi.

class AppConstants {
  // ============================================================
  // API Configuration
  // ============================================================

  /// TODO: Ganti dengan URL backend production Anda
  static const String baseUrl = 'https://your-api-server.com/api';

  // Auth endpoints
  static const String loginEndpoint = '/auth/login';
  static const String registerEndpoint = '/auth/register';

  // Attendance endpoints
  static const String checkInEndpoint = '/attendance/check-in';
  static const String historyEndpoint = '/attendance/history';

  // ============================================================
  // GPS / Geofencing Configuration
  // ============================================================

  /// Koordinat kampus ITB Ganesha (hardcoded)
  static const double campusLatitude = -6.8915;
  static const double campusLongitude = 107.6107;
  static const String campusName = 'ITB Ganesha';

  /// Radius geofencing dalam meter
  static const double geofenceRadiusMeters = 200.0;

  // ============================================================
  // Schedule Configuration
  // ============================================================

  /// Jam mulai kelas (07:00)
  static const int classStartHour = 7;
  static const int classStartMinute = 0;

  /// Jam akhir kelas (18:00)
  static const int classEndHour = 18;
  static const int classEndMinute = 0;

  /// Toleransi terlambat dalam menit
  static const int lateToleranceMinutes = 15;

  // ============================================================
  // SharedPreferences Keys
  // ============================================================

  static const String prefToken = 'auth_token';
  static const String prefUserId = 'user_id';
  static const String prefUserName = 'user_name';
  static const String prefUserNim = 'user_nim';
  static const String prefUserEmail = 'user_email';
  static const String prefIsLoggedIn = 'is_logged_in';

  // ============================================================
  // App Info
  // ============================================================

  static const String appName = 'Absensi Lokasi';
  static const String appVersion = '1.0.0';
  static const String appTagline = 'Sistem Absensi Berbasis GPS';
}
