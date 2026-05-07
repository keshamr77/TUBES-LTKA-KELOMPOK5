import 'package:flutter/material.dart';
import 'package:absensi_lokasi/config/theme.dart';
import 'package:absensi_lokasi/models/attendance_model.dart';
import 'package:absensi_lokasi/services/auth_service.dart';
import 'package:absensi_lokasi/services/attendance_service.dart';
import 'package:absensi_lokasi/widgets/attendance_card.dart';

/// History Screen - Riwayat absensi mahasiswa
class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  final _attendanceService = AttendanceService();
  final _authService = AuthService();

  List<AttendanceModel> _attendances = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final user = await _authService.getCurrentUser();
    if (user == null) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Sesi berakhir. Silakan login kembali.';
      });
      return;
    }

    final result = await _attendanceService.getHistory(user.id);
    if (mounted) {
      setState(() {
        _isLoading = false;
        if (result.success) {
          _attendances = result.attendances;
        } else {
          _errorMessage = result.message;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppTheme.backgroundGradient),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(),
              const SizedBox(height: 16),
              Expanded(child: _buildBody()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final hadirCount =
        _attendances.where((a) => a.status == 'hadir').length;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Row(
        children: [
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Riwayat Absensi',
                    style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textPrimary)),
                SizedBox(height: 4),
                Text('Catatan kehadiran Anda',
                    style: TextStyle(
                        fontSize: 14, color: AppTheme.textSecondary)),
              ],
            ),
          ),
          if (_attendances.isNotEmpty)
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: AppTheme.accentGreen.withOpacity(0.15),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text('$hadirCount Hadir',
                  style: const TextStyle(
                      color: AppTheme.accentGreen,
                      fontSize: 13,
                      fontWeight: FontWeight.w600)),
            ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation(AppTheme.accentGreen),
        ),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.cloud_off,
                  size: 56, color: AppTheme.accentRed.withOpacity(0.6)),
              const SizedBox(height: 16),
              Text(_errorMessage!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: AppTheme.textSecondary, fontSize: 14)),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: _loadHistory,
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Coba Lagi'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.cardDark,
                  foregroundColor: AppTheme.textPrimary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_attendances.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.history, size: 56, color: AppTheme.textHint),
            SizedBox(height: 16),
            Text('Belum Ada Riwayat',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textPrimary)),
            SizedBox(height: 8),
            Text('Riwayat absensi akan muncul\nsetelah Anda melakukan absensi.',
                textAlign: TextAlign.center,
                style:
                    TextStyle(fontSize: 14, color: AppTheme.textSecondary)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadHistory,
      color: AppTheme.accentGreen,
      backgroundColor: AppTheme.cardDark,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: _attendances.length,
        itemBuilder: (context, index) {
          return AttendanceCard(attendance: _attendances[index]);
        },
      ),
    );
  }
}
