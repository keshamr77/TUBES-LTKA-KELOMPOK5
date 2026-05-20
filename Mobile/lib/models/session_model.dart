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
  factory SessionModel.fromJson(Map<String, dynamic> json) {
    final course = json['course'] as Map<String, dynamic>?;
    final location = json['location'] as Map<String, dynamic>?;

    return SessionModel(
      sessionId: json['sessionId']?.toString() ?? '',
      courseName: course?['name']?.toString() ?? '',
      startTime: json['startTime'] != null
          ? DateTime.parse(json['startTime'].toString()).toLocal()
          : DateTime.now(),
      endTime: json['endTime'] != null
          ? DateTime.parse(json['endTime'].toString()).toLocal()
          : DateTime.now(),
      latitude: (location?['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (location?['longitude'] as num?)?.toDouble() ?? 0.0,
      radiusMeters: (location?['radiusMeters'] as num?)?.toDouble() ?? 0.0,
    );
  }

  @override
  String toString() =>
      'SessionModel(sessionId: $sessionId, courseName: $courseName, radius: ${radiusMeters}m)';
}
