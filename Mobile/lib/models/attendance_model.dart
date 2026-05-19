import 'package:intl/intl.dart';

/// Model data absensi
/// Disesuaikan dengan response backend Phase 1:
///
/// POST /api/attendances response:
///   { attendanceId, sessionId, distanceMeters, status, timestamp }
///
/// GET /api/attendances/me response:
///   { attendanceId, session: { id, courseName }, timestamp, status, distanceMeters }
class AttendanceModel {
  final String id;
  final String sessionId;
  final String? courseName;
  final double latitude;
  final double longitude;
  final DateTime timestamp;
  final String status; // 'present', 'late', 'invalid'
  final double distanceMeters;

  const AttendanceModel({
    required this.id,
    required this.sessionId,
    this.courseName,
    this.latitude = 0.0,
    this.longitude = 0.0,
    required this.timestamp,
    required this.status,
    this.distanceMeters = 0.0,
  });

  /// Parsing dari POST /api/attendances response (sukses)
  /// { attendanceId, sessionId, distanceMeters, status, timestamp }
  factory AttendanceModel.fromPostResponse(Map<String, dynamic> json) {
    return AttendanceModel(
      id: json['attendanceId']?.toString() ?? '',
      sessionId: json['sessionId']?.toString() ?? '',
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'].toString())
          : DateTime.now(),
      status: json['status']?.toString() ?? 'present',
      distanceMeters: (json['distanceMeters'] as num?)?.toDouble() ?? 0.0,
    );
  }

  /// Parsing dari GET /api/attendances/me response item
  /// { attendanceId, session: { id, courseName }, timestamp, status, distanceMeters }
  factory AttendanceModel.fromJson(Map<String, dynamic> json) {
    final session = json['session'];
    return AttendanceModel(
      id: json['attendanceId']?.toString() ?? json['id']?.toString() ?? '',
      sessionId: session?['id']?.toString() ?? json['sessionId']?.toString() ?? '',
      courseName: session?['courseName']?.toString(),
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'].toString())
          : DateTime.now(),
      status: json['status']?.toString() ?? 'present',
      distanceMeters: (json['distanceMeters'] as num?)?.toDouble() ?? 0.0,
    );
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
  /// Backend: present → Hadir, late → Terlambat, invalid → Tidak Sah
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

  /// Format jarak
  String get distanceLabel {
    if (distanceMeters < 1000) {
      return '${distanceMeters.toStringAsFixed(1)} m';
    }
    return '${(distanceMeters / 1000).toStringAsFixed(2)} km';
  }

  @override
  String toString() =>
      'AttendanceModel(id: $id, status: $status, distance: ${distanceMeters.toStringAsFixed(1)}m)';
}
