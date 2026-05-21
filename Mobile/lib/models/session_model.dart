/// Model data sesi perkuliahan aktif.
/// Disesuaikan dengan response backend:
/// GET /api/sessions/active
class SessionModel {
  final String sessionId;
  final String courseName;
  final DateTime startTime;
  final DateTime endTime;
  final double latitude;
  final double longitude;
  final double radiusMeters;

  const SessionModel({
    required this.sessionId,
    required this.courseName,
    required this.startTime,
    required this.endTime,
    required this.latitude,
    required this.longitude,
    required this.radiusMeters,
  });

  /// Parsing dari item response API
  /// Backend v0.2 format: namaKelas, tanggal, jamMulai, jamSelesai, location.radius
  factory SessionModel.fromJson(Map<String, dynamic> json) {
    final location = json['location'] as Map<String, dynamic>?;

    // Parse tanggal + jamMulai/jamSelesai → DateTime
    // Format: tanggal="2026-05-21", jamMulai="16:33", jamSelesai="17:33"
    DateTime startTime = DateTime.now();
    DateTime endTime = DateTime.now();

    final tanggal = json['tanggal']?.toString();
    if (tanggal != null) {
      final jamMulai = json['jamMulai']?.toString() ?? '00:00';
      final jamSelesai = json['jamSelesai']?.toString() ?? '23:59';
      // Tambahkan :00 detik agar DateTime.parse pasti berhasil
      startTime = DateTime.parse('$tanggal ${jamMulai.padRight(5, "0")}:00');
      endTime = DateTime.parse('$tanggal ${jamSelesai.padRight(5, "0")}:00');
    }

    return SessionModel(
      sessionId: json['sessionId']?.toString() ?? '',
      courseName: json['namaKelas']?.toString() ?? '',
      startTime: startTime,
      endTime: endTime,
      latitude: (location?['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (location?['longitude'] as num?)?.toDouble() ?? 0.0,
      radiusMeters: (location?['radius'] as num?)?.toDouble() ?? 0.0,
    );
  }

  @override
  String toString() =>
      'SessionModel(sessionId: $sessionId, courseName: $courseName, radius: ${radiusMeters}m)';
}
