import 'dart:async';
import 'dart:math';
import 'package:geolocator/geolocator.dart';
import 'package:absensi_lokasi/config/constants.dart';

/// Service untuk mengelola lokasi GPS.
/// Menangani permission, mendapatkan posisi, dan menghitung jarak.
class LocationService {
  static final LocationService _instance = LocationService._internal();
  factory LocationService() => _instance;
  LocationService._internal();

  StreamSubscription<Position>? _positionStream;

  // ============================================================
  // Permission Handling
  // ============================================================

  /// Memeriksa dan meminta izin lokasi
  /// Returns true jika izin diberikan, false jika ditolak
  Future<LocationPermissionResult> checkAndRequestPermission() async {
    bool serviceEnabled;
    LocationPermission permission;

    // Cek apakah layanan lokasi aktif
    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return LocationPermissionResult(
        granted: false,
        message: 'Layanan lokasi tidak aktif. Silakan aktifkan GPS Anda.',
      );
    }

    // Cek permission saat ini
    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      // Minta permission
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return LocationPermissionResult(
          granted: false,
          message: 'Izin lokasi ditolak. Aplikasi memerlukan akses lokasi untuk absensi.',
        );
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return LocationPermissionResult(
        granted: false,
        message:
            'Izin lokasi ditolak secara permanen. Silakan aktifkan di Pengaturan aplikasi.',
      );
    }

    return LocationPermissionResult(granted: true, message: 'Izin lokasi diberikan');
  }

  // ============================================================
  // Get Position
  // ============================================================

  /// Mendapatkan posisi saat ini dengan akurasi tinggi
  Future<Position?> getCurrentPosition() async {
    final permResult = await checkAndRequestPermission();
    if (!permResult.granted) return null;

    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 10,
        ),
      );
    } catch (e) {
      return null;
    }
  }

  // ============================================================
  // Stream Position
  // ============================================================

  /// Memulai stream pembaruan posisi secara real-time
  void startPositionStream({
    required Function(Position) onPosition,
    Function(String)? onError,
  }) {
    _positionStream?.cancel();

    _positionStream = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 5, // Update setiap bergerak 5 meter
      ),
    ).listen(
      (Position position) {
        onPosition(position);
      },
      onError: (error) {
        onError?.call('Gagal mendapatkan lokasi: ${error.toString()}');
      },
    );
  }

  /// Menghentikan stream posisi
  void stopPositionStream() {
    _positionStream?.cancel();
    _positionStream = null;
  }

  // ============================================================
  // Distance Calculation
  // ============================================================

  /// Menghitung jarak antara dua koordinat menggunakan formula Haversine
  /// Returns jarak dalam meter
  double calculateDistance(
    double lat1,
    double lon1,
    double lat2,
    double lon2,
  ) {
    const double earthRadius = 6371000; // Radius bumi dalam meter

    final dLat = _toRadians(lat2 - lat1);
    final dLon = _toRadians(lon2 - lon1);

    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRadians(lat1)) *
            cos(_toRadians(lat2)) *
            sin(dLon / 2) *
            sin(dLon / 2);

    final c = 2 * atan2(sqrt(a), sqrt(1 - a));

    return earthRadius * c;
  }

  /// Konversi derajat ke radian
  double _toRadians(double degrees) {
    return degrees * pi / 180;
  }

  /// Menghitung jarak dari posisi saat ini ke kampus
  double distanceToCampus(double latitude, double longitude) {
    return calculateDistance(
      latitude,
      longitude,
      AppConstants.campusLatitude,
      AppConstants.campusLongitude,
    );
  }

  /// Cek apakah posisi berada dalam radius kampus
  bool isWithinCampusRadius(double latitude, double longitude) {
    final distance = distanceToCampus(latitude, longitude);
    return distance <= AppConstants.geofenceRadiusMeters;
  }

  // ============================================================
  // Schedule Check
  // ============================================================

  /// Cek apakah waktu saat ini dalam jadwal kelas
  bool isWithinClassSchedule() {
    final now = DateTime.now();
    final classStart = DateTime(
      now.year,
      now.month,
      now.day,
      AppConstants.classStartHour,
      AppConstants.classStartMinute,
    );
    final classEnd = DateTime(
      now.year,
      now.month,
      now.day,
      AppConstants.classEndHour,
      AppConstants.classEndMinute,
    );

    return now.isAfter(classStart) && now.isBefore(classEnd);
  }

  /// Cek apakah sudah terlambat (melewati toleransi)
  bool isLate() {
    final now = DateTime.now();
    final lateThreshold = DateTime(
      now.year,
      now.month,
      now.day,
      AppConstants.classStartHour,
      AppConstants.classStartMinute + AppConstants.lateToleranceMinutes,
    );

    return now.isAfter(lateThreshold);
  }

  /// Dispose resources
  void dispose() {
    stopPositionStream();
  }
}

/// Model hasil pemeriksaan izin lokasi
class LocationPermissionResult {
  final bool granted;
  final String message;

  const LocationPermissionResult({
    required this.granted,
    required this.message,
  });
}
