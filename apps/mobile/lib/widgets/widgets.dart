import 'package:flutter/material.dart';

import '../theme.dart';

class LoadingView extends StatelessWidget {
  final String? message;
  const LoadingView({super.key, this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          if (message != null) ...[
            const SizedBox(height: 12),
            Text(message!, style: const TextStyle(color: AppColors.muted)),
          ],
        ],
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  final Object? error;
  final VoidCallback? onRetry;
  const ErrorView({super.key, this.error, this.onRetry});

  @override
  Widget build(BuildContext context) {
    final msg = error?.toString() ?? 'Something went wrong.';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: AppColors.destructive, size: 44),
            const SizedBox(height: 12),
            Text(msg, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.ink)),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Visible only when the backend reports demo/mock mode. Makes clear the app
/// is showing labelled demo data, never fabricating real transfers/balances.
class DemoBanner extends StatelessWidget {
  final String message;
  const DemoBanner({super.key, this.message = 'Demo mode — mock data, no real transfers or balances.'});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7E6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF3D9A4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.science_outlined, color: AppColors.warning, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: AppColors.warning, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

class SectionCard extends StatelessWidget {
  final String title;
  final Widget child;
  const SectionCard({super.key, required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.muted)),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class VerificationTag extends StatelessWidget {
  final String verification;
  const VerificationTag({super.key, required this.verification});

  @override
  Widget build(BuildContext context) {
    final (label, icon) = switch (verification) {
      'QUIZ' => ('Quiz', Icons.quiz_outlined),
      'QR' => ('Scan QR', Icons.qr_code_2),
      'LOCATION' => ('Check in', Icons.place_outlined),
      _ => (verification, Icons.circle),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFE3EBFB),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.primary),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class PointBadge extends StatelessWidget {
  final int points;
  const PointBadge({super.key, required this.points});

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: const Icon(Icons.bolt, color: AppColors.warning, size: 18),
      label: Text('$points pts'),
      backgroundColor: const Color(0xFFFFF7E6),
      side: BorderSide.none,
    );
  }
}
