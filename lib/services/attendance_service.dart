import 'package:absensi_lokasi/config/constants.dart';
import 'package:absensi_lokasi/models/attendance_model.dart';
import 'package:absensi_lokasi/services/api_service.dart';

/// Service untuk operasi absensi.
/// Menangani check-in dan pengambilan riwayat absensi.
class AttendanceService {
  static final AttendanceService _instance = AttendanceService._internal();
  factory AttendanceService() => _instance;
  AttendanceService._internal();

  final ApiService _api = ApiService();

  // ============================================================
  // Check-in
  // ============================================================

  /// Kirim absensi ke server
  /// POST /attendance/check-in
  Future<AttendanceResult> checkIn({
    required String studentId,
    required double latitude,
    required double longitude,
  }) async {
    final response = await _api.post(
      AppConstants.checkInEndpoint,
      body: {
        'student_id': studentId,
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );

    if (response.success) {
      AttendanceModel? attendance;
      if (response.data != null) {
        try {
          final attendanceData = response.data!['attendance'] ?? response.data;
          attendance = AttendanceModel.fromJson(attendanceData);
        } catch (_) {}
      }

      return AttendanceResult(
        success: true,
        message: response.message,
        attendance: attendance,
      );
    }

    return AttendanceResult(
      success: false,
      message: response.message,
    );
  }

  // ============================================================
  // History
  // ============================================================

  /// Ambil riwayat absensi mahasiswa
  /// GET /attendance/history?student_id=xxx
  Future<AttendanceHistoryResult> getHistory(String studentId) async {
    final response = await _api.get(
      AppConstants.historyEndpoint,
      queryParams: {'student_id': studentId},
    );

    if (response.success && response.data != null) {
      try {
        final List<dynamic> records =
            response.data!['data'] ?? response.data!['history'] ?? [];
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
}

/// Model hasil absensi
class AttendanceResult {
  final bool success;
  final String message;
  final AttendanceModel? attendance;

  const AttendanceResult({
    required this.success,
    required this.message,
    this.attendance,
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
