import 'package:absensi_lokasi/config/constants.dart';
import 'package:absensi_lokasi/models/attendance_model.dart';
import 'package:absensi_lokasi/services/api_service.dart';

/// Service untuk operasi absensi.
/// Menangani submit absensi dan pengambilan riwayat.
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
  /// Body: { "sessionId": "...", "latitude": ..., "longitude": ... }
  Future<AttendanceResult> submitAttendance({
    required String sessionId,
    required double latitude,
    required double longitude,
  }) async {
    final response = await _api.post(
      AppConstants.attendancesEndpoint,
      body: {
        'sessionId': sessionId,
        'latitude': latitude,
        'longitude': longitude,
      },
    );

    if (response.success) {
      AttendanceModel? attendance;
      if (response.data != null) {
        try {
          final attendanceData = response.data!['data'] ?? response.data;
          attendance = AttendanceModel.fromJson(
            attendanceData is Map<String, dynamic> ? attendanceData : {},
          );
        } catch (_) {}
      }

      return AttendanceResult(
        success: true,
        message: response.data?['message']?.toString() ?? 'Absensi berhasil',
        attendance: attendance,
      );
    }

    // Handle error codes spesifik dari backend
    return AttendanceResult(
      success: false,
      message: _mapErrorMessage(response.errorCode, response.message),
      errorCode: response.errorCode,
      distanceMeters: _extractDistance(response.data),
    );
  }

  // ============================================================
  // Riwayat Absensi
  // ============================================================

  /// Ambil riwayat absensi user yang login
  /// GET /api/attendances/me (backend menggunakan token untuk identifikasi)
  Future<AttendanceHistoryResult> getMyHistory() async {
    final response = await _api.get(AppConstants.myAttendancesEndpoint);

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
      default:
        return fallback;
    }
  }

  /// Ekstrak jarak dari error response OUT_OF_RADIUS
  double? _extractDistance(Map<String, dynamic>? data) {
    if (data == null) return null;
    final error = data['error'];
    if (error is Map<String, dynamic>) {
      return (error['distanceMeters'] as num?)?.toDouble();
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
  final double? distanceMeters; // Jarak dari kampus (untuk OUT_OF_RADIUS)

  const AttendanceResult({
    required this.success,
    required this.message,
    this.errorCode = '',
    this.attendance,
    this.distanceMeters,
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
