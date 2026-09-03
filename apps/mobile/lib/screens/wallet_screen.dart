import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/motion_api.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/widgets.dart';

class WalletScreen extends StatefulWidget {
  final MotionApi api;
  const WalletScreen({super.key, required this.api});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  late Future<WalletOverview> _future;
  bool _onboarding = false;

  @override
  void initState() {
    super.initState();
    _future = widget.api.wallet();
  }

  void _reload() => setState(() => _future = widget.api.wallet());

  Future<void> _onboard() async {
    setState(() => _onboarding = true);
    try {
      final updated = await widget.api.onboardWallet(currency: 'NGN');
      if (mounted) {
        setState(() => _future = Future.value(updated));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Wallet activation started.')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not reach the server.')),
        );
      }
    } finally {
      if (mounted) setState(() => _onboarding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Wallet')),
      body: FutureBuilder<WalletOverview>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const LoadingView(message: 'Loading wallet…');
          }
          if (snap.hasError) {
            return ErrorView(error: snap.error, onRetry: _reload);
          }
          final w = snap.data!;
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (w.demo) ...[
                  DemoBanner(),
                  const SizedBox(height: 12),
                ],
                _OverviewCard(w: w),
                const SizedBox(height: 12),
                _OnboardingCard(w: w, busy: _onboarding, onStart: _onboard),
                const SizedBox(height: 12),
                SectionCard(
                  title: 'RECENT TRANSACTIONS',
                  child: w.transactions.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.all(8),
                          child: Text('No transactions yet.', style: TextStyle(color: AppColors.muted)),
                        )
                      : Column(
                          children: w.transactions.take(8).map((t) => _TxRow(tx: t)).toList(),
                        ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _OverviewCard extends StatelessWidget {
  final WalletOverview w;
  const _OverviewCard({required this.w});

  @override
  Widget build(BuildContext context) {
    final active = w.active;
    final currency = active?.currency ?? (w.wallets.isNotEmpty ? w.wallets.first.currency : 'NGN');
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFF075E54), AppColors.success]),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('MOTION WALLET', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(currency, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
              const Spacer(),
              Text(w.balanceAvailable ? 'available' : 'not revealed',
                  style: const TextStyle(color: Colors.white70, fontSize: 14)),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Pill(label: '${w.provider} provider'),
              _Pill(label: '${w.mode} mode'),
              _Pill(label: active?.status ?? 'inactive'),
            ],
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final String label;
  const _Pill({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}

class _OnboardingCard extends StatelessWidget {
  final WalletOverview w;
  final bool busy;
  final VoidCallback onStart;
  const _OnboardingCard({required this.w, required this.busy, required this.onStart});

  @override
  Widget build(BuildContext context) {
    final o = w.onboarding;
    return SectionCard(
      title: 'ONBOARDING',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _statusRow('Wallet', o.status == 'active'),
          _statusRow('KYC', o.hasKyc),
          _statusRow('Payment rail', o.railActive),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: busy ? null : onStart,
              child: busy
                  ? const SizedBox(height: 20, width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(o.active ? 'Refresh onboarding' : 'Activate wallet'),
            ),
          ),
          if (w.demo) ...[
            const SizedBox(height: 8),
            const Text(
              'In demo mode this simulates the activation flow. No real KYC or balance changes are made.',
              style: TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }

  Widget _statusRow(String label, bool ok) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(ok ? Icons.check_circle : Icons.radio_button_unchecked,
              color: ok ? AppColors.success : AppColors.muted, size: 18),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(color: AppColors.ink, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _TxRow extends StatelessWidget {
  final WalletTx tx;
  const _TxRow({required this.tx});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      leading: const Icon(Icons.swap_vert, color: AppColors.primary),
      title: Text('${tx.type} · ${tx.state}', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink)),
      subtitle: Text('${tx.currency} ${tx.amount} — ${tx.statusMessage}',
          maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
      trailing: const Icon(Icons.chevron_right, color: AppColors.muted),
    );
  }
}
