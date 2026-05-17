import 'package:intl/intl.dart';

/// Model data absensi
/// Menyimpan informasi kehadiran termasuk lokasi dan status.
/// Status dari backend: 'present', 'late', 'invalid'
class AttendanceModel {
  final String id;
  final String sessionId;
  final String studentId;
  final double latitude;
  final double longitude;
  final DateTime timestamp;
  final String status; // 'present', 'late', 'invalid'
  final String? courseName; // Nama mata kuliah (opsional, dari join)

  const AttendanceModel({
    required this.id,
    required this.sessionId,
    required this.studentId,
    required this.latitude,
    required this.longitude,
    required this.timestamp,
    required this.status,
    this.courseName,
  });

  /// Parsing dari JSON response API
  /// Backend mengembalikan: { id, sessionId, userId, latitude, longitude, timestamp, status }
  factory AttendanceModel.fromJson(Map<String, dynamic> json) {
    return AttendanceModel(
      id: json['id']?.toString() ?? '',
      sessionId: json['sessionId']?.toString() ?? json['session_id']?.toString() ?? '',
      studentId: json['userId']?.toString() ?? json['student_id']?.toString() ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'].toString())
          : json['createdAt'] != null
              ? DateTime.parse(json['createdAt'].toString())
              : DateTime.now(),
      status: json['status']?.toString() ?? 'invalid',
      courseName: json['courseName']?.toString(),
    );
  }

  /// Konversi ke JSON untuk POST /api/attendances
  Map<String, dynamic> toJson() {
    return {
      'sessionId': sessionId,
      'latitude': latitude,
      'longitude': longitude,
    };
  }

  /// Format tanggal: "Senin, 7 Mei 2026"
  String get formattedDate {
    return DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(timestamp);
  }

  /// Format waktu: "08:30"
  String get formattedTime {
    return DateFormat('HH:mm').format(timestamp);
  }

  /// Label status dalam Bahasa Indonesia
  /// Backend values → display: present→Hadir, late→Terlambat, invalid→Tidak Sah
  String get statusLabel {
    switch (status) {
      case 'present':
        return 'Hadir';
      case 'late':
        return 'Terlambat';
      case 'invalid':
        return 'Tidak Sah';
      default:
        return status;
    }
  }

  @override
  String toString() =>
      'AttendanceModel(id: $id, status: $status, time: $formattedTime)';
}
