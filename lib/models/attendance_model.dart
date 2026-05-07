import 'package:intl/intl.dart';

/// Model data absensi
/// Menyimpan informasi kehadiran termasuk lokasi dan status.
class AttendanceModel {
  final String id;
  final String studentId;
  final double latitude;
  final double longitude;
  final DateTime timestamp;
  final String status; // 'hadir', 'terlambat', 'tidak_hadir'

  const AttendanceModel({
    required this.id,
    required this.studentId,
    required this.latitude,
    required this.longitude,
    required this.timestamp,
    required this.status,
  });

  /// Parsing dari JSON response API
  factory AttendanceModel.fromJson(Map<String, dynamic> json) {
    return AttendanceModel(
      id: json['id']?.toString() ?? '',
      studentId: json['student_id']?.toString() ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'].toString())
          : DateTime.now(),
      status: json['status']?.toString() ?? 'tidak_hadir',
    );
  }

  /// Konversi ke JSON untuk pengiriman ke API
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'student_id': studentId,
      'latitude': latitude,
      'longitude': longitude,
      'timestamp': timestamp.toIso8601String(),
      'status': status,
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
  String get statusLabel {
    switch (status) {
      case 'hadir':
        return 'Hadir';
      case 'terlambat':
        return 'Terlambat';
      case 'tidak_hadir':
        return 'Tidak Hadir';
      default:
        return status;
    }
  }

  @override
  String toString() =>
      'AttendanceModel(id: $id, status: $status, time: $formattedTime)';
}
