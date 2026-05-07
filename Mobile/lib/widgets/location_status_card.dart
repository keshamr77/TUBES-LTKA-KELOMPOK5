import 'package:flutter/material.dart';
import 'package:absensi_lokasi/config/theme.dart';

/// Widget kartu status lokasi yang menampilkan informasi GPS.
/// Digunakan di Home Screen untuk menunjukkan status radius.
class LocationStatusCard extends StatelessWidget {
  final double? latitude;
  final double? longitude;
  final double? distance;
  final bool isWithinRadius;
  final bool isLoading;

  const LocationStatusCard({
    super.key,
    this.latitude,
    this.longitude,
    this.distance,
    required this.isWithinRadius,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.cardDark,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isLoading
              ? AppTheme.dividerColor
              : isWithinRadius
                  ? AppTheme.accentGreen.withOpacity(0.4)
                  : AppTheme.accentRed.withOpacity(0.4),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: (isWithinRadius ? AppTheme.accentGreen : AppTheme.accentRed)
                .withOpacity(isLoading ? 0 : 0.1),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: isLoading ? _buildLoading() : _buildContent(),
    );
  }

  Widget _buildLoading() {
    return const Column(
      children: [
        SizedBox(
          width: 32,
          height: 32,
          child: CircularProgressIndicator(
            strokeWidth: 3,
            valueColor: AlwaysStoppedAnimation<Color>(AppTheme.accentGreen),
          ),
        ),
        SizedBox(height: 12),
        Text(
          'Mendeteksi lokasi...',
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
        ),
      ],
    );
  }

  Widget _buildContent() {
    final statusIcon = isWithinRadius ? Icons.check_circle : Icons.cancel;
    final statusColor =
        isWithinRadius ? AppTheme.accentGreen : AppTheme.accentRed;
    final statusText =
        isWithinRadius ? 'Dalam Radius ✅' : 'Di Luar Radius ❌';

    return Column(
      children: [
        // Status Icon & Text
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: statusColor.withOpacity(0.15),
            borderRadius: BorderRadius.circular(30),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(statusIcon, color: statusColor, size: 22),
              const SizedBox(width: 8),
              Text(
                statusText,
                style: TextStyle(
                  color: statusColor,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Koordinat
        _buildInfoRow(
          Icons.my_location,
          'Koordinat',
          latitude != null && longitude != null
              ? '${latitude!.toStringAsFixed(6)}, ${longitude!.toStringAsFixed(6)}'
              : 'Tidak tersedia',
        ),
        const SizedBox(height: 12),

        // Jarak
        _buildInfoRow(
          Icons.straighten,
          'Jarak ke kampus',
          distance != null
              ? '${distance!.toStringAsFixed(0)} meter'
              : 'Menghitung...',
        ),
        const SizedBox(height: 12),

        // Radius
        _buildInfoRow(
          Icons.radar,
          'Radius',
          '200 meter',
        ),
      ],
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppTheme.cardLighter,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppTheme.textSecondary, size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: AppTheme.textHint,
                  fontSize: 12,
                ),
              ),
              Text(
                value,
                style: const TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
