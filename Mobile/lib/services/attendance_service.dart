import 'package:absensi_lokasi/config/constants.dart';
import 'package:absensi_lokasi/models/attendance_model.dart';
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
    String selfieUrl = 'https://placeholder.com/selfie.jpg',
  }) async {
    final response = await _api.post(
      AppConstants.attendancesEndpoint,
      body: {
        'sessionId': sessionId,
        'latitude': latitude,
        'longitude': longitude,
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
        message: 'Absensi berhasil dicatat!',
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
        final List<dynamic> records = response.data!['data'] ?? [];
        final attendances =
            records.map((json) => AttendanceModel.fromJson(json)).toList();

        return AttendanceHistoryResult(
          success: true,
          message: 'Berhasil memuat riwayat',
          attendances: attendances,
        );
      } catch (e) {
        return AttendanceHistoryResult(
          success: false,
          message: 'Gagal memproses data riwayat: ${e.toString()}',
          attendances: [],
        );
      }
    }

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
        return 'Anda sudah melakukan absensi untuk sesi ini.';
      case AppConstants.errorSessionClosed:
        return 'Sesi absensi sudah ditutup.';
      case AppConstants.errorSessionNotStarted:
        return 'Sesi absensi belum dibuka.';
      case AppConstants.errorNotEnrolled:
        return 'Anda tidak terdaftar di mata kuliah ini.';
      case AppConstants.errorInvalidPayload:
        return 'Data tidak lengkap atau tidak valid.';
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
