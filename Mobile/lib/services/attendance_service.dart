import 'package:flutter/foundation.dart';
import 'package:absensi_lokasi/config/constants.dart';
import 'package:absensi_lokasi/models/attendance_model.dart';
import 'package:absensi_lokasi/models/session_model.dart';
import 'package:absensi_lokasi/services/api_service.dart';

/// Service untuk operasi absensi.
/// Disesuaikan dengan backend Phase 1:
///   POST /api/attendances  → submit absensi (sessionId, lat, lng, selfieUrl WAJIB)
///   GET  /api/attendances/me → riwayat absensi
class AttendanceService {
  static final AttendanceService _instance = AttendanceService._internal();
  factory AttendanceService() => _instance;
  AttendanceService._internal();

  final ApiService _api = ApiService();

  // ============================================================
  // Get Sesi Aktif
  // ============================================================

  /// Ambil daftar sesi absensi yang sedang aktif
  /// GET /api/sessions/active
  Future<ActiveSessionsResult> getActiveSessions() async {
    final response = await _api.get(AppConstants.activeSessionsEndpoint);

    if (response.success && response.data != null) {
      try {
        final List<dynamic> records = response.data!['data'] ?? [];
        final sessions =
            records.map((json) => SessionModel.fromJson(json)).toList();

        return ActiveSessionsResult(
          success: true,
          message: 'Berhasil memuat sesi aktif',
          sessions: sessions,
        );
      } catch (e) {
        return ActiveSessionsResult(
          success: false,
          message: 'Gagal memproses data sesi aktif: ${e.toString()}',
          sessions: [],
        );
      }
    }

    return ActiveSessionsResult(
      success: false,
      message: response.message,
      sessions: [],
    );
  }

  // ============================================================
  // Submit Absensi
  // ============================================================

  /// Kirim absensi ke server
  /// POST /api/attendances
  ///
  /// Body yang WAJIB (sesuai backend attendances.ts):
  /// {
  ///   "sessionId": "sess_001",
  ///   "latitude": -6.97285,
  ///   "longitude": 107.63042,
  ///   "selfieUrl": "https://..." ← WAJIB di Phase 1
  /// }
  Future<AttendanceResult> submitAttendance({
    required String sessionId,
    required double latitude,
    required double longitude,
    String type = 'check_in',
    String selfieUrl = 'https://placeholder.com/selfie.jpg',
  }) async {
    final response = await _api.post(
      AppConstants.attendancesEndpoint,
      body: {
        'sessionId': sessionId,
        'latitude': latitude,
        'longitude': longitude,
        'type': type,
        'selfieUrl': selfieUrl,
      },
    );

    if (response.success && response.data != null) {
      AttendanceModel? attendance;
      try {
        final data = response.data!['data'] ?? response.data;
        if (data is Map<String, dynamic>) {
          attendance = AttendanceModel.fromPostResponse(data);
        }
      } catch (_) {}

      return AttendanceResult(
        success: true,
        message: type == 'check_in'
            ? 'Absen masuk berhasil dicatat!'
            : 'Absen keluar berhasil dicatat!',
        attendance: attendance,
      );
    }

    // Handle error codes spesifik dari backend
    return AttendanceResult(
      success: false,
      message: _mapErrorMessage(response.errorCode, response.message),
      errorCode: response.errorCode,
      distanceMeters: _extractDistance(response.data),
      allowedRadius: _extractAllowedRadius(response.data),
    );
  }

  /// Kirim absensi keluar (check-out) ke server
  Future<AttendanceResult> checkOut({
    required String sessionId,
    required double latitude,
    required double longitude,
    String selfieUrl = 'https://placeholder.com/selfie.jpg',
  }) {
    return submitAttendance(
      sessionId: sessionId,
      latitude: latitude,
      longitude: longitude,
      type: 'check_out',
      selfieUrl: selfieUrl,
    );
  }

  /// Cek status check-in & check-out user untuk sesi tertentu
  /// GET /api/attendances/me/status?sessionId=xxx
  Future<SessionStatusResult> getSessionStatus(String sessionId) async {
    final response = await _api.get(
      AppConstants.attendanceStatusEndpoint,
      queryParams: {'sessionId': sessionId},
    );

    if (response.success && response.data != null) {
      try {
        final data = response.data!['data'] ?? {};
        final window = data['window'] ?? {};

        DateTime? parseTime(String? timeStr) {
          if (timeStr == null) return null;
          return DateTime.parse(timeStr).toLocal();
        }

        return SessionStatusResult(
          success: true,
          message: 'Berhasil memuat status absensi',
          hasCheckedIn: data['hasCheckedIn'] ?? false,
          hasCheckedOut: data['hasCheckedOut'] ?? false,
          checkInTime: parseTime(data['checkInTime']?.toString()),
          checkOutTime: parseTime(data['checkOutTime']?.toString()),
          allowCheckIn: window['allowCheckIn'] ?? false,
          allowCheckOut: window['allowCheckOut'] ?? false,
          windowReason: window['reason']?.toString() ?? 'unknown',
        );
      } catch (e) {
        return SessionStatusResult(
          success: false,
          message: 'Gagal memproses data status absensi: ${e.toString()}',
        );
      }
    }

    return SessionStatusResult(
      success: false,
      message: response.message,
    );
  }

  // ============================================================
  // Riwayat Absensi
  // ============================================================

  /// Ambil riwayat absensi user yang login
  /// GET /api/attendances/me
  ///
  /// Response: { success: true, data: [ { attendanceId, session, timestamp, status, distanceMeters } ] }
  Future<AttendanceHistoryResult> getMyHistory({int limit = 20}) async {
    final response = await _api.get(
      AppConstants.myAttendancesEndpoint,
      queryParams: {'limit': limit.toString()},
    );

    if (response.success && response.data != null) {
      try {
        debugPrint('[getMyHistory] response.success=true, data keys: ${response.data!.keys.toList()}');
        final rawData = response.data!['data'];
        debugPrint('[getMyHistory] rawData type: ${rawData.runtimeType}, length: ${rawData is List ? rawData.length : 'N/A'}');
        final List<dynamic> records = rawData ?? [];
        final attendances =
            records.map((json) => AttendanceModel.fromJson(json)).toList();
        debugPrint('[getMyHistory] parsed ${attendances.length} attendances');

        return AttendanceHistoryResult(
          success: true,
          message: 'Berhasil memuat riwayat',
          attendances: attendances,
        );
      } catch (e) {
        debugPrint('[getMyHistory] Parse error: $e');
        return AttendanceHistoryResult(
          success: false,
          message: 'Gagal memproses data riwayat: ${e.toString()}',
          attendances: [],
        );
      }
    }

    debugPrint('[getMyHistory] API call failed: success=${response.success}, statusCode=${response.statusCode}, message=${response.message}');
    return AttendanceHistoryResult(
      success: false,
      message: response.message,
      attendances: [],
    );
  }

  // ============================================================
  // Error Handling Helpers
  // ============================================================

  /// Terjemahkan error code backend ke pesan Indonesia
  String _mapErrorMessage(String errorCode, String fallback) {
    switch (errorCode) {
      case AppConstants.errorOutOfRadius:
        return 'Anda berada di luar radius area kampus.';
      case AppConstants.errorAlreadySubmitted:
        return 'Anda sudah melakukan absensi tipe ini untuk sesi ini.';
      case AppConstants.errorSessionClosed:
        return 'Sesi absensi sudah ditutup.';
      case AppConstants.errorSessionNotStarted:
        return 'Sesi absensi belum dibuka.';
      case AppConstants.errorNotEnrolled:
        return 'Anda tidak terdaftar di mata kuliah ini.';
      case AppConstants.errorInvalidPayload:
        return 'Data tidak lengkap atau tidak valid.';
      case AppConstants.errorCheckInRequired:
        return 'Anda harus melakukan absen masuk terlebih dahulu sebelum absen keluar.';
      case AppConstants.errorOutsideCheckInWindow:
        return 'Waktu absen masuk sudah lewat. Check-in hanya tersedia di 15 menit awal sesi.';
      case AppConstants.errorOutsideCheckOutWindow:
        return 'Belum waktunya absen keluar. Check-out hanya tersedia di 15 menit akhir sesi.';
      default:
        return fallback;
    }
  }

  /// Ekstrak jarak dari error response OUT_OF_RADIUS
  /// Backend format: { error: { details: { distanceMeters: 245.7 } } }
  double? _extractDistance(Map<String, dynamic>? data) {
    if (data == null) return null;
    final error = data['error'];
    if (error is Map<String, dynamic>) {
      final details = error['details'];
      if (details is Map<String, dynamic>) {
        return (details['distanceMeters'] as num?)?.toDouble();
      }
    }
    return null;
  }

  /// Ekstrak allowed radius dari error response OUT_OF_RADIUS
  double? _extractAllowedRadius(Map<String, dynamic>? data) {
    if (data == null) return null;
    final error = data['error'];
    if (error is Map<String, dynamic>) {
      final details = error['details'];
      if (details is Map<String, dynamic>) {
        return (details['allowedRadiusMeters'] as num?)?.toDouble();
      }
    }
    return null;
  }
}

/// Model hasil absensi
class AttendanceResult {
  final bool success;
  final String message;
  final String errorCode;
  final AttendanceModel? attendance;
  final double? distanceMeters;
  final double? allowedRadius;

  const AttendanceResult({
    required this.success,
    required this.message,
    this.errorCode = '',
    this.attendance,
    this.distanceMeters,
    this.allowedRadius,
  });
}

/// Model hasil riwayat absensi
class AttendanceHistoryResult {
  final bool success;
  final String message;
  final List<AttendanceModel> attendances;

  const AttendanceHistoryResult({
    required this.success,
    required this.message,
    required this.attendances,
  });
}

/// Model hasil pembacaan sesi aktif
class ActiveSessionsResult {
  final bool success;
  final String message;
  final List<SessionModel> sessions;

  const ActiveSessionsResult({
    required this.success,
    required this.message,
    required this.sessions,
  });
}

/// Model hasil pembacaan status absensi sesi
class SessionStatusResult {
  final bool success;
  final String message;
  final bool hasCheckedIn;
  final bool hasCheckedOut;
  final DateTime? checkInTime;
  final DateTime? checkOutTime;
  final bool allowCheckIn;
  final bool allowCheckOut;
  final String windowReason;

  const SessionStatusResult({
    required this.success,
    required this.message,
    this.hasCheckedIn = false,
    this.hasCheckedOut = false,
    this.checkInTime,
    this.checkOutTime,
    this.allowCheckIn = false,
    this.allowCheckOut = false,
    this.windowReason = 'unknown',
  });
}
