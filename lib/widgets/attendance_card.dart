import 'package:flutter/material.dart';
import 'package:absensi_lokasi/config/theme.dart';
import 'package:absensi_lokasi/models/attendance_model.dart';

/// Widget kartu riwayat absensi individual.
/// Menampilkan tanggal, waktu, status, dan lokasi.
class AttendanceCard extends StatelessWidget {
  final AttendanceModel attendance;

  const AttendanceCard({super.key, required this.attendance});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.dividerColor, width: 0.5),
      ),
      child: Row(
        children: [
          // Status Icon
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: _statusColor.withOpacity(0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(_statusIcon, color: _statusColor, size: 24),
          ),
          const SizedBox(width: 14),

          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  attendance.formattedDate,
                  style: const TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.access_time, size: 14, color: AppTheme.textHint),
                    const SizedBox(width: 4),
                    Text(
                      attendance.formattedTime,
                      style: const TextStyle(
                        color: AppTheme.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Icon(Icons.location_on, size: 14, color: AppTheme.textHint),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        '${attendance.latitude.toStringAsFixed(4)}, ${attendance.longitude.toStringAsFixed(4)}',
                        style: const TextStyle(
                          color: AppTheme.textHint,
                          fontSize: 12,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Status Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: _statusColor.withOpacity(0.15),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              attendance.statusLabel,
              style: TextStyle(
                color: _statusColor,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color get _statusColor {
    switch (attendance.status) {
      case 'hadir':
        return AppTheme.accentGreen;
      case 'terlambat':
        return AppTheme.accentAmber;
      case 'tidak_hadir':
        return AppTheme.accentRed;
      default:
        return AppTheme.textHint;
    }
  }

  IconData get _statusIcon {
    switch (attendance.status) {
      case 'hadir':
        return Icons.check_circle_outline;
      case 'terlambat':
        return Icons.schedule;
      case 'tidak_hadir':
        return Icons.cancel_outlined;
      default:
        return Icons.help_outline;
    }
  }
}
