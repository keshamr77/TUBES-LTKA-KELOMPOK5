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

  /// Parsing dari item response API (V0.2 contract)
  factory SessionModel.fromJson(Map<String, dynamic> json) {
    final location = json['location'] as Map<String, dynamic>?;

    DateTime startTime = DateTime.now();
    DateTime endTime = DateTime.now();

    if (json['tanggal'] != null) {
      final dateStr = json['tanggal'].toString();
      if (json['jamMulai'] != null) {
        try {
          startTime = DateTime.parse('$dateStr ${json['jamMulai']}');
        } catch (_) {}
      }
      if (json['jamSelesai'] != null) {
        try {
          endTime = DateTime.parse('$dateStr ${json['jamSelesai']}');
        } catch (_) {}
      }
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
