/// Konstanta aplikasi Sistem Absensi Berbasis Lokasi
/// File ini berisi semua konfigurasi statis yang digunakan di seluruh aplikasi.
/// Disesuaikan dengan Backend Phase 1 (mock mode).

class AppConstants {
  // ============================================================
  // API Configuration
  // ============================================================

  /// Backend Railway Production URL
  /// Backend Phase 1: mock mode, belum verify Firebase token
  static const String baseUrl =
      'https://tubes-ltka-kelompok5-production.up.railway.app/api';

  /// Untuk development lokal (ganti baseUrl di atas jika perlu)
  static const String localUrl = 'http://localhost:3000/api';

  // --- Endpoints yang SUDAH ada di backend Phase 1 ---
  static const String attendancesEndpoint = '/attendances';     // POST: submit absensi
  static const String myAttendancesEndpoint = '/attendances/me'; // GET: riwayat absensi
  static const String activeSessionsEndpoint = '/sessions/active'; // GET: sesi aktif

  // --- Endpoints yang BELUM ada di backend (akan Phase 2) ---
  // static const String createUserEndpoint = '/users';
  // static const String getUserMeEndpoint = '/users/me';
  // static const String coursesEndpoint = '/courses';

  // ============================================================
  // GPS / Geofencing Configuration
  // Harus COCOK dengan backend MOCK_CAMPUS di attendances.ts
  // ============================================================

  /// Koordinat kampus ITB (sesuai backend MOCK_CAMPUS di attendances.ts)
  static const double campusLatitude = -6.89147;
  static const double campusLongitude = 107.61022;
  static const String campusName = 'ITB Ganesha';

  /// Radius geofencing dalam meter (sesuai backend: 300m)
  static const double geofenceRadiusMeters = 300.0;

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
  // Mock User ID (Phase 1 — backend belum verify Firebase token)
  // ============================================================

  /// Di Phase 1, backend pakai header X-Mock-User-Id untuk identifikasi user.
  /// Ganti ini per user jika testing multiple users.
  static const String mockUserId = 'mock_user_001';

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
  static const String errorInvalidPayload = 'INVALID_PAYLOAD';

  // ============================================================
  // App Info
  // ============================================================

  static const String appName = 'Absensi Lokasi';
  static const String appVersion = '1.0.0';
  static const String appTagline = 'Sistem Absensi Berbasis GPS';
}
