/// Konstanta aplikasi Sistem Absensi Berbasis Lokasi
/// File ini berisi semua konfigurasi statis yang digunakan di seluruh aplikasi.

class AppConstants {
  // ============================================================
  // API Configuration
  // ============================================================

  /// TODO: Ganti dengan URL backend Railway production Anda
  static const String baseUrl = 'http://localhost:3000/api';

  // --- User endpoints ---
  static const String createUserEndpoint = '/users';         // POST: simpan nama, role, nim
  static const String getUserMeEndpoint = '/users/me';       // GET: data user yang login

  // --- Course endpoints ---
  static const String coursesEndpoint = '/courses';           // GET: list mata kuliah

  // --- Session endpoints ---
  static const String activeSessionsEndpoint = '/sessions/active'; // GET: sesi absensi aktif

  // --- Attendance endpoints ---
  static const String attendancesEndpoint = '/attendances';   // POST: submit absensi
  static const String myAttendancesEndpoint = '/attendances/me'; // GET: riwayat absensi

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
  // SharedPreferences Keys (untuk cache profil saja)
  // ============================================================

  static const String prefUserName = 'user_name';
  static const String prefUserNim = 'user_nim';
  static const String prefUserEmail = 'user_email';
  static const String prefUserRole = 'user_role';

  // ============================================================
  // Backend Error Codes
  // ============================================================

  static const String errorOutOfRadius = 'OUT_OF_RADIUS';
  static const String errorAlreadySubmitted = 'ALREADY_SUBMITTED';
  static const String errorSessionClosed = 'SESSION_CLOSED';
  static const String errorSessionNotStarted = 'SESSION_NOT_STARTED';
  static const String errorTokenExpired = 'TOKEN_EXPIRED';
  static const String errorNotEnrolled = 'NOT_ENROLLED';

  // ============================================================
  // App Info
  // ============================================================

  static const String appName = 'Absensi Lokasi';
  static const String appVersion = '1.0.0';
  static const String appTagline = 'Sistem Absensi Berbasis GPS';
}
