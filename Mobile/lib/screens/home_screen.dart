import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'package:absensi_lokasi/config/constants.dart';
import 'package:absensi_lokasi/config/theme.dart';
import 'package:absensi_lokasi/models/user_model.dart';
import 'package:absensi_lokasi/models/session_model.dart';
import 'package:absensi_lokasi/services/auth_service.dart';
import 'package:absensi_lokasi/services/location_service.dart';
import 'package:absensi_lokasi/services/attendance_service.dart';
import 'package:absensi_lokasi/widgets/custom_button.dart';
import 'package:absensi_lokasi/widgets/location_status_card.dart';

/// Home / Absensi Screen
/// Halaman utama untuk melakukan absensi berbasis lokasi GPS.
/// Menampilkan koordinat, jarak ke kampus, dan tombol absen.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with TickerProviderStateMixin {
  final _locationService = LocationService();
  final _attendanceService = AttendanceService();
  final _authService = AuthService();

  // State
  UserModel? _user;
  double? _latitude;
  double? _longitude;
  double? _distance;
  bool _isWithinRadius = false;
  bool _isLocationLoading = true;
  bool _isSubmitting = false;
  String? _locationError;

  // Attendance Status State
  bool _hasCheckedIn = false;
  bool _hasCheckedOut = false;
  String? _checkInTime;
  String? _checkOutTime;
  bool _isLoadingStatus = false;
  bool _allowCheckIn = false;
  bool _allowCheckOut = false;
  String _windowReason = 'unknown';

  // Session State
  bool _isLoadingSessions = true;
  SessionModel? _activeSession;
  String? _sessionsError;

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();

    // Animasi pulse untuk tombol absen
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.05).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _loadUser();
    _fetchActiveSession();
    _initLocation();
  }

  /// Muat data user dari backend / cache
  Future<void> _loadUser() async {
    final user = await _authService.getCurrentUser();
    if (mounted) {
      setState(() => _user = user);
    }
  }

  /// Ambil daftar sesi aktif dari backend
  Future<void> _fetchActiveSession() async {
    if (!mounted) return;
    setState(() {
      _isLoadingSessions = true;
      _sessionsError = null;
    });

    final result = await _attendanceService.getActiveSessions();

    if (!mounted) return;

    setState(() {
      _isLoadingSessions = false;
      if (result.success) {
        if (result.sessions.isNotEmpty) {
          _activeSession = result.sessions.first;
        } else {
          _activeSession = null;
        }
      } else {
        _sessionsError = result.message;
      }
    });

    // Setelah mendapat sesi aktif, update perhitungan lokasi jika GPS sudah didapatkan
    if (_latitude != null && _longitude != null) {
      _recalculateLocationDetails(_latitude!, _longitude!);
    }

    if (_activeSession != null) {
      await _fetchAttendanceStatus();
    }
  }

  /// Inisialisasi lokasi GPS
  Future<void> _initLocation() async {
    setState(() {
      _isLocationLoading = true;
      _locationError = null;
    });

    // Cek permission
    final permResult = await _locationService.checkAndRequestPermission();
    if (!permResult.granted) {
      if (mounted) {
        setState(() {
          _isLocationLoading = false;
          _locationError = permResult.message;
        });
      }
      return;
    }

    // Dapatkan posisi awal
    final position = await _locationService.getCurrentPosition();
    if (position != null && mounted) {
      _updatePosition(position);
    } else if (mounted) {
      setState(() {
        _isLocationLoading = false;
        _locationError = 'Gagal mendapatkan lokasi. Pastikan GPS aktif.';
      });
    }

    // Stream pembaruan lokasi
    _locationService.startPositionStream(
      onPosition: (position) {
        if (mounted) _updatePosition(position);
      },
      onError: (error) {
        if (mounted) {
          setState(() => _locationError = error);
        }
      },
    );
  }

  /// Update posisi dan hitung jarak
  void _updatePosition(Position position) {
    setState(() {
      _latitude = position.latitude;
      _longitude = position.longitude;
      _isLocationLoading = false;
      _locationError = null;
    });
    _recalculateLocationDetails(position.latitude, position.longitude);
  }

  /// Recalculate distance and within radius status based on active session
  void _recalculateLocationDetails(double lat, double lng) {
    double? distance;
    bool isWithin = false;

    if (_activeSession != null) {
      // WFH: skip validasi GPS, langsung anggap dalam radius
      if (!_activeSession!.locationRequired) {
        setState(() {
          _distance = 0;
          _isWithinRadius = true;
        });
        return;
      }

      distance = _locationService.distanceTo(
        lat,
        lng,
        _activeSession!.latitude,
        _activeSession!.longitude,
      );
      isWithin = _locationService.isWithinRadius(
        lat,
        lng,
        _activeSession!.radiusMeters,
        centerLat: _activeSession!.latitude,
        centerLng: _activeSession!.longitude,
      );
    } else {
      // Fallback ke constants jika sesi tidak ada (atau belum dimuat)
      distance = _locationService.distanceTo(
        lat,
        lng,
        AppConstants.campusLatitude,
        AppConstants.campusLongitude,
      );
      isWithin = _locationService.isWithinRadius(
        lat,
        lng,
        AppConstants.geofenceRadiusMeters,
        centerLat: AppConstants.campusLatitude,
        centerLng: AppConstants.campusLongitude,
      );
    }

    setState(() {
      _distance = distance;
      _isWithinRadius = isWithin;
    });
  }

  /// Cek apakah waktu saat ini berada di dalam durasi sesi perkuliahan
  bool _isWithinSessionTime(SessionModel session) {
    final now = DateTime.now();
    return now.isAfter(session.startTime) && now.isBefore(session.endTime);
  }

  /// Cek status absensi untuk sesi aktif
  Future<void> _fetchAttendanceStatus() async {
    if (_activeSession == null || !mounted) return;

    setState(() {
      _isLoadingStatus = true;
    });

    final result = await _attendanceService.getSessionStatus(
      _activeSession!.sessionId,
    );

    if (!mounted) return;

    setState(() {
      _isLoadingStatus = false;
      if (result.success) {
        _hasCheckedIn = result.hasCheckedIn;
        _hasCheckedOut = result.hasCheckedOut;
        _allowCheckIn = result.allowCheckIn;
        _allowCheckOut = result.allowCheckOut;
        _windowReason = result.windowReason;
        debugPrint('[fetchAttendanceStatus] Window reason: $_windowReason');

        if (result.checkInTime != null) {
          _checkInTime = DateFormat('HH:mm').format(result.checkInTime!);
        } else {
          _checkInTime = null;
        }

        if (result.checkOutTime != null) {
          _checkOutTime = DateFormat('HH:mm').format(result.checkOutTime!);
        } else {
          _checkOutTime = null;
        }
      }
    });
  }

  /// Submit absensi (check-in / check-out)
  Future<void> _submitAbsensi(String type) async {
    if (_latitude == null || _longitude == null || _user == null) return;

    if (_activeSession == null) {
      _showWarningDialog(
        'Tidak Ada Sesi',
        'Tidak ada sesi absensi yang aktif saat ini.',
        Icons.event_busy,
        AppTheme.textHint,
      );
      return;
    }

    // Cek lokasi dulu (skip untuk WFH)
    if (_activeSession!.locationRequired && !_isWithinRadius) {
      final radius = _activeSession!.radiusMeters;
      final course = _activeSession!.courseName;
      _showWarningDialog(
        'Di Luar Area Kelas',
        'Anda berada di luar radius ${radius.toInt()} meter dari $course. '
            'Silakan mendekat ke area lokasi kelas untuk melakukan absensi.',
        Icons.location_off,
        AppTheme.accentRed,
      );
      return;
    }

    // Cek status window
    final isTypeCheckIn = type == 'check_in';
    final isAllowed = isTypeCheckIn ? _allowCheckIn : _allowCheckOut;

    if (!isAllowed) {
      if (isTypeCheckIn) {
        _showWarningDialog(
          'Di Luar Window Absen Masuk',
          'Waktu absen masuk sudah lewat. Check-in hanya tersedia di 15 menit awal sesi.',
          Icons.schedule,
          AppTheme.accentRed,
        );
      } else {
        _showWarningDialog(
          'Belum Waktunya Absen Keluar',
          'Belum waktunya absen keluar. Check-out hanya tersedia di 15 menit akhir sesi.',
          Icons.schedule,
          AppTheme.accentRed,
        );
      }
      return;
    }

    setState(() => _isSubmitting = true);

    final sessionId = _activeSession!.sessionId;

    final result = await _attendanceService.submitAttendance(
      sessionId: sessionId,
      latitude: _latitude!,
      longitude: _longitude!,
      type: type,
    );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (result.success) {
      await _fetchAttendanceStatus();
      _showSuccessDialog(type);
    } else {
      // Handle error spesifik dari backend
      String errorTitle = 'Gagal Absen';
      IconData errorIcon = Icons.error_outline;
      Color errorColor = AppTheme.accentRed;

      if (result.errorCode == AppConstants.errorOutOfRadius) {
        errorTitle = 'Di Luar Radius Kelas';
        errorIcon = Icons.location_off;
        String msg = result.message;
        if (result.distanceMeters != null) {
          msg += '\n\nJarak Anda: ${result.distanceMeters!.toStringAsFixed(1)} meter'
              '\nRadius yang diizinkan: ${result.allowedRadius?.toStringAsFixed(0) ?? _activeSession!.radiusMeters.toStringAsFixed(0)} meter';
        }
        _showWarningDialog(errorTitle, msg, errorIcon, errorColor);
        return;
      } else if (result.errorCode == AppConstants.errorAlreadySubmitted) {
        errorTitle = 'Sudah Absen';
        errorIcon = Icons.check_circle;
        errorColor = AppTheme.accentAmber;
        await _fetchAttendanceStatus();
      }

      _showWarningDialog(errorTitle, result.message, errorIcon, errorColor);
    }
  }

  /// Dialog berhasil absen
  void _showSuccessDialog(String type) {
    final label = type == 'check_in' ? 'Absen Masuk Berhasil!' : 'Absen Keluar Berhasil!';
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppTheme.accentGreen.withOpacity(0.15),
              ),
              child: const Icon(
                Icons.check_circle,
                size: 50,
                color: AppTheme.accentGreen,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              label,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Kehadiran Anda telah tercatat pada\n${DateFormat('HH:mm, dd MMMM yyyy', 'id_ID').format(DateTime.now())}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.accentGreen,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: const Text(
                'Tutup',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Dialog peringatan
  void _showWarningDialog(
    String title,
    String message,
    IconData icon,
    Color color,
  ) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 70,
              height: 70,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color.withOpacity(0.15),
              ),
              child: Icon(icon, size: 40, color: color),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 14,
              ),
            ),
          ],
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'Mengerti',
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _locationService.stopPositionStream();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppTheme.backgroundGradient),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 20),

                // Header greeting
                _buildHeader(),
                const SizedBox(height: 24),

                // Waktu saat ini
                _buildTimeCard(),
                const SizedBox(height: 20),

                // Sesi Aktif Info
                _buildSessionCard(),
                const SizedBox(height: 20),

                // Kartu status lokasi (sembunyikan untuk WFH)
                if (_activeSession == null || _activeSession!.locationRequired) ...[
                  LocationStatusCard(
                    latitude: _latitude,
                    longitude: _longitude,
                    distance: _distance,
                    isWithinRadius: _isWithinRadius,
                    isLoading: _isLocationLoading,
                    radiusMeters: _activeSession?.radiusMeters ?? AppConstants.geofenceRadiusMeters,
                  ),
                  const SizedBox(height: 16),
                ] else ...[
                  // WFH banner
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppTheme.cardDark,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: const Color(0xFF2196F3).withOpacity(0.4),
                        width: 1.5,
                      ),
                    ),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF2196F3).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(30),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.home, color: Color(0xFF2196F3), size: 22),
                              SizedBox(width: 8),
                              Text(
                                'Mode WFH 🏠',
                                style: TextStyle(
                                  color: Color(0xFF2196F3),
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Validasi GPS tidak diperlukan.\nAnda bisa absen dari mana saja.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppTheme.textSecondary,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Error lokasi
                if (_locationError != null && (_activeSession == null || _activeSession!.locationRequired)) _buildLocationError(),

                const SizedBox(height: 24),

                // Tombol Absen
                _buildCheckInButton(),

                // Status sudah absen
                if (_activeSession != null) ...[
                  const SizedBox(height: 16),
                  _buildCheckedInBanner(),
                ],

                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Header dengan greeting dan nama user
  Widget _buildHeader() {
    final hour = DateTime.now().hour;
    String greeting;
    IconData greetIcon;

    if (hour < 10) {
      greeting = 'Selamat Pagi';
      greetIcon = Icons.wb_sunny;
    } else if (hour < 15) {
      greeting = 'Selamat Siang';
      greetIcon = Icons.wb_sunny_outlined;
    } else if (hour < 18) {
      greeting = 'Selamat Sore';
      greetIcon = Icons.wb_twilight;
    } else {
      greeting = 'Selamat Malam';
      greetIcon = Icons.nightlight_round;
    }

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(greetIcon, color: AppTheme.accentAmber, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    greeting,
                    style: TextStyle(
                      fontSize: 14,
                      color: AppTheme.textSecondary.withOpacity(0.9),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                _user?.name ?? 'Memuat...',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
            ],
          ),
        ),
        // Avatar
        Container(
          width: 50,
          height: 50,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: AppTheme.primaryGradient,
            boxShadow: [
              BoxShadow(
                color: AppTheme.accentGreen.withOpacity(0.2),
                blurRadius: 12,
              ),
            ],
          ),
          child: Center(
            child: Text(
              _user?.name.isNotEmpty == true
                  ? _user!.name[0].toUpperCase()
                  : '?',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Kartu Sesi Aktif
  Widget _buildSessionCard() {
    if (_isLoadingSessions) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppTheme.cardDark,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Center(
          child: CircularProgressIndicator(color: AppTheme.accentGreen),
        ),
      );
    }

    if (_sessionsError != null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppTheme.accentRed.withOpacity(0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.accentRed.withOpacity(0.3)),
        ),
        child: Column(
          children: [
            const Icon(Icons.error_outline, color: AppTheme.accentRed, size: 30),
            const SizedBox(height: 8),
            Text(
              'Gagal memuat sesi: $_sessionsError',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _fetchActiveSession,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Coba Lagi'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.accentRed,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
      );
    }

    if (_activeSession == null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppTheme.cardDark,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.textHint.withOpacity(0.2)),
        ),
        child: Column(
          children: [
            const Icon(Icons.event_busy, color: AppTheme.textHint, size: 36),
            const SizedBox(height: 10),
            const Text(
              'Tidak ada sesi absensi yang sedang buka',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Hubungi dosen pengampu jika sesi belum dimulai.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppTheme.textHint,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _fetchActiveSession,
              icon: const Icon(Icons.sync, size: 16, color: AppTheme.textSecondary),
              label: const Text('Segarkan', style: TextStyle(color: AppTheme.textSecondary)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppTheme.textHint),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
      );
    }

    final session = _activeSession!;
    final timeRangeStr =
        '${DateFormat('HH:mm').format(session.startTime)} - ${DateFormat('HH:mm').format(session.endTime)}';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppTheme.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.accentGreen.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.accentGreen.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'SESI AKTIF',
                  style: TextStyle(
                    color: AppTheme.accentGreen,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const Spacer(),
              Text(
                timeRangeStr,
                style: const TextStyle(
                  color: AppTheme.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            session.courseName,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.location_on, color: AppTheme.textSecondary, size: 14),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  session.locationRequired
                    ? 'Lokasi Kelas: ${session.lokasiKelas ?? '${session.latitude.toStringAsFixed(5)}, ${session.longitude.toStringAsFixed(5)}'}'
                    : '🏠 WFH - Tanpa Validasi GPS',
                  style: const TextStyle(
                    color: AppTheme.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Kartu waktu saat ini
  Widget _buildTimeCard() {
    final now = DateTime.now();
    final timeStr = DateFormat('HH:mm').format(now);
    final dateStr = DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(now);
    final isInSession = _activeSession != null && _isWithinSessionTime(_activeSession!);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppTheme.cardDark,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.cardLighter,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.access_time_filled,
              color: AppTheme.textSecondary,
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  timeStr,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                Text(
                  dateStr,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: (isInSession ? AppTheme.accentGreen : AppTheme.textHint)
                  .withOpacity(0.15),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              isInSession ? 'Sesi Dibuka' : 'Sesi Ditutup',
              style: TextStyle(
                color: isInSession ? AppTheme.accentGreen : AppTheme.textHint,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Pesan error lokasi
  Widget _buildLocationError() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.accentRed.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.accentRed.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber, color: AppTheme.accentRed, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _locationError!,
              style: const TextStyle(color: AppTheme.accentRedLight, fontSize: 13),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: _initLocation,
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.accentRed.withOpacity(0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.refresh,
                color: AppTheme.accentRedLight,
                size: 18,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Tombol absen masuk & keluar
  Widget _buildCheckInButton() {
    if (_isLoadingStatus) {
      return Container(
        height: 60,
        decoration: BoxDecoration(
          color: AppTheme.cardLighter,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Center(
          child: CircularProgressIndicator(color: AppTheme.accentGreen),
        ),
      );
    }

    final canCheckIn = _isWithinRadius && _allowCheckIn && !_hasCheckedIn && !_isSubmitting;
    final canCheckOut = _isWithinRadius && _allowCheckOut && _hasCheckedIn && !_hasCheckedOut && !_isSubmitting;

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: AnimatedBuilder(
                animation: _pulseAnimation,
                builder: (context, _) {
                  return Transform.scale(
                    scale: (canCheckIn && !_hasCheckedIn) ? _pulseAnimation.value : 1.0,
                    child: CustomButton(
                      text: _hasCheckedIn ? 'Sudah Masuk' : 'Absen Masuk',
                      icon: Icons.login,
                      isLoading: _isSubmitting && !_hasCheckedIn,
                      backgroundColor: _hasCheckedIn
                          ? AppTheme.textHint
                          : canCheckIn
                              ? AppTheme.accentGreen
                              : AppTheme.cardLighter,
                      onPressed: canCheckIn
                          ? () => _submitAbsensi('check_in')
                          : () {
                              if (_activeSession == null) {
                                _showWarningDialog('Tidak Ada Sesi', 'Tidak ada sesi absensi yang aktif saat ini.', Icons.event_busy, AppTheme.textHint);
                              } else if (_hasCheckedIn) {
                                // Gak ngapa-ngapain
                              } else if (!_isWithinRadius && !_isLocationLoading) {
                                _showWarningDialog('Di Luar Radius Kelas', 'Anda berada di luar radius ${_activeSession!.radiusMeters.toInt()} meter dari lokasi kelas.', Icons.location_off, AppTheme.accentRed);
                              } else if (!_allowCheckIn) {
                                _showWarningDialog('Di Luar Window Absen', 'Absen masuk hanya tersedia di 15 menit awal sesi.', Icons.schedule, AppTheme.accentAmber);
                              }
                            },
                      height: 54,
                    ),
                  );
                }
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: AnimatedBuilder(
                animation: _pulseAnimation,
                builder: (context, _) {
                  return Transform.scale(
                    scale: (canCheckOut && !_hasCheckedOut) ? _pulseAnimation.value : 1.0,
                    child: CustomButton(
                      text: _hasCheckedOut ? 'Sudah Keluar' : 'Absen Keluar',
                      icon: Icons.logout,
                      isLoading: _isSubmitting && _hasCheckedIn && !_hasCheckedOut,
                      backgroundColor: _hasCheckedOut
                          ? AppTheme.textHint
                          : canCheckOut
                              ? Colors.blue
                              : AppTheme.cardLighter,
                      onPressed: canCheckOut
                          ? () => _submitAbsensi('check_out')
                          : () {
                              if (_activeSession == null) {
                                _showWarningDialog('Tidak Ada Sesi', 'Tidak ada sesi absensi yang aktif saat ini.', Icons.event_busy, AppTheme.textHint);
                              } else if (!_hasCheckedIn) {
                                _showWarningDialog('Absen Masuk Diperlukan', 'Anda harus melakukan absen masuk terlebih dahulu.', Icons.warning_amber, AppTheme.accentAmber);
                              } else if (_hasCheckedOut) {
                                // Gak ngapa-ngapain
                              } else if (!_isWithinRadius && !_isLocationLoading) {
                                _showWarningDialog('Di Luar Radius Kelas', 'Anda berada di luar radius ${_activeSession!.radiusMeters.toInt()} meter dari lokasi kelas.', Icons.location_off, AppTheme.accentRed);
                              } else if (!_allowCheckOut) {
                                _showWarningDialog('Di Luar Window Absen', 'Absen keluar hanya tersedia di 15 menit akhir sesi.', Icons.schedule, AppTheme.accentAmber);
                              }
                            },
                      height: 54,
                    ),
                  );
                }
              ),
            ),
          ],
        ),
      ],
    );
  }

  /// Banner status absen
  Widget _buildCheckedInBanner() {
    String text = 'Belum melakukan absensi untuk sesi ini.';
    Color color = AppTheme.textHint;
    IconData icon = Icons.info_outline;

    if (_hasCheckedIn && _hasCheckedOut) {
      text = 'Absensi Selesai: Masuk ($_checkInTime) · Keluar ($_checkOutTime)';
      color = AppTheme.accentGreen;
      icon = Icons.verified;
    } else if (_hasCheckedIn) {
      text = 'Sudah Absen Masuk pada $_checkInTime. Jangan lupa absen keluar!';
      color = Colors.blue;
      icon = Icons.check_circle;
    } else if (!_allowCheckIn && !_hasCheckedIn) {
      text = 'Sesi sudah berjalan lebih dari 15 menit. Anda tidak dapat melakukan absen masuk.';
      color = AppTheme.accentRed;
      icon = Icons.error_outline;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: color == AppTheme.textHint ? AppTheme.textSecondary : color,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
