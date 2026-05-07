import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'package:absensi_lokasi/config/constants.dart';
import 'package:absensi_lokasi/config/theme.dart';
import 'package:absensi_lokasi/models/user_model.dart';
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
  bool _hasCheckedInToday = false;

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
    _initLocation();
  }

  /// Muat data user dari SharedPreferences
  Future<void> _loadUser() async {
    final user = await _authService.getCurrentUser();
    if (mounted) {
      setState(() => _user = user);
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
    final distance = _locationService.distanceToCampus(
      position.latitude,
      position.longitude,
    );
    final isWithin = _locationService.isWithinCampusRadius(
      position.latitude,
      position.longitude,
    );

    setState(() {
      _latitude = position.latitude;
      _longitude = position.longitude;
      _distance = distance;
      _isWithinRadius = isWithin;
      _isLocationLoading = false;
      _locationError = null;
    });
  }

  /// Cek apakah tombol absen harus aktif
  bool get _canCheckIn {
    return _isWithinRadius &&
        _locationService.isWithinClassSchedule() &&
        !_isSubmitting &&
        !_hasCheckedInToday;
  }

  /// Submit absensi
  Future<void> _handleCheckIn() async {
    if (_latitude == null || _longitude == null || _user == null) return;

    // Cek lokasi dulu
    if (!_isWithinRadius) {
      _showWarningDialog(
        'Di Luar Area Kampus',
        'Anda berada di luar radius ${AppConstants.geofenceRadiusMeters.toInt()} meter dari ${AppConstants.campusName}. '
            'Silakan mendekat ke area kampus untuk melakukan absensi.',
        Icons.location_off,
        AppTheme.accentRed,
      );
      return;
    }

    // Cek jadwal
    if (!_locationService.isWithinClassSchedule()) {
      _showWarningDialog(
        'Di Luar Jadwal',
        'Saat ini bukan waktu kelas. Absensi hanya dapat dilakukan pada '
            'jam ${AppConstants.classStartHour.toString().padLeft(2, '0')}:${AppConstants.classStartMinute.toString().padLeft(2, '0')} - '
            '${AppConstants.classEndHour.toString().padLeft(2, '0')}:${AppConstants.classEndMinute.toString().padLeft(2, '0')}.',
        Icons.schedule,
        AppTheme.accentAmber,
      );
      return;
    }

    setState(() => _isSubmitting = true);

    final result = await _attendanceService.checkIn(
      studentId: _user!.id,
      latitude: _latitude!,
      longitude: _longitude!,
    );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (result.success) {
      setState(() => _hasCheckedInToday = true);
      _showSuccessDialog();
    } else {
      _showWarningDialog(
        'Gagal Absen',
        result.message,
        Icons.error_outline,
        AppTheme.accentRed,
      );
    }
  }

  /// Dialog berhasil absen
  void _showSuccessDialog() {
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
            const Text(
              'Absensi Berhasil!',
              style: TextStyle(
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

                // Kartu status lokasi
                LocationStatusCard(
                  latitude: _latitude,
                  longitude: _longitude,
                  distance: _distance,
                  isWithinRadius: _isWithinRadius,
                  isLoading: _isLocationLoading,
                ),
                const SizedBox(height: 16),

                // Error lokasi
                if (_locationError != null) _buildLocationError(),

                const SizedBox(height: 24),

                // Tombol Absen
                _buildCheckInButton(),

                // Status sudah absen
                if (_hasCheckedInToday) ...[
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

  /// Kartu waktu saat ini
  Widget _buildTimeCard() {
    final now = DateTime.now();
    final timeStr = DateFormat('HH:mm').format(now);
    final dateStr = DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(now);
    final isInSchedule = _locationService.isWithinClassSchedule();

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
              color: (isInSchedule ? AppTheme.accentGreen : AppTheme.textHint)
                  .withOpacity(0.15),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              isInSchedule ? 'Jam Kuliah' : 'Di Luar Jam',
              style: TextStyle(
                color: isInSchedule ? AppTheme.accentGreen : AppTheme.textHint,
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

  /// Tombol absen utama
  Widget _buildCheckInButton() {
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, _) {
        return Transform.scale(
          scale: _canCheckIn ? _pulseAnimation.value : 1.0,
          child: CustomButton(
            text: _hasCheckedInToday ? 'Sudah Absen Hari Ini' : 'Absen Sekarang',
            icon: _hasCheckedInToday
                ? Icons.check_circle
                : Icons.fingerprint,
            isLoading: _isSubmitting,
            backgroundColor: _hasCheckedInToday
                ? AppTheme.textHint
                : _canCheckIn
                    ? AppTheme.accentGreen
                    : AppTheme.cardLighter,
            onPressed: _canCheckIn ? _handleCheckIn : () {
              // Tampilkan alasan tidak bisa absen
              if (!_isWithinRadius && !_isLocationLoading) {
                _showWarningDialog(
                  'Di Luar Area Kampus',
                  'Anda berada di luar radius ${AppConstants.geofenceRadiusMeters.toInt()} meter dari ${AppConstants.campusName}.',
                  Icons.location_off,
                  AppTheme.accentRed,
                );
              } else if (!_locationService.isWithinClassSchedule()) {
                _showWarningDialog(
                  'Di Luar Jadwal',
                  'Saat ini bukan waktu kelas.',
                  Icons.schedule,
                  AppTheme.accentAmber,
                );
              }
            },
            height: 60,
          ),
        );
      },
    );
  }

  /// Banner sudah absen hari ini
  Widget _buildCheckedInBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.accentGreen.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.accentGreen.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.check_circle, color: AppTheme.accentGreen, size: 22),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Anda sudah melakukan absensi hari ini.',
              style: TextStyle(color: AppTheme.accentGreenLight, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
