import 'package:flutter/material.dart';

import '../models/models.dart';
import '../state/auth_state.dart';
import '../theme.dart';
import '../widgets/widgets.dart';
import 'mission_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  final AuthState auth;
  const HomeScreen({super.key, required this.auth});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<HomeSummary> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.auth.api.home();
  }

  void _reload() {
    setState(() => _future = widget.auth.api.home());
  }

  Future<void> _openMission(Mission mission) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => MissionDetailScreen(api: widget.auth.api, mission: mission)),
    );
    if (mounted) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('MOTION')),
      body: FutureBuilder<HomeSummary>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const LoadingView(message: 'Loading your home…');
          }
          if (snap.hasError) {
            return ErrorView(error: snap.error, onRetry: _reload);
          }
          final s = snap.data!;
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        s.greeting,
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.ink),
                      ),
                    ),
                    _Avatar(user: widget.auth.user),
                  ],
                ),
                const SizedBox(height: 16),
                _PointsCard(summary: s),
                const SizedBox(height: 12),
                if (s.wallet != null) _WalletStrip(wallet: s.wallet!),
                if (s.recommendedMission != null) ...[
                  const SizedBox(height: 12),
                  SectionCard(
                    title: 'RECOMMENDED',
                    child: _RecommendedMission(
                      mission: s.recommendedMission!,
                      onTap: () => _openMission(s.recommendedMission!),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                SectionCard(
                  title: 'RECENT ACTIVITY',
                  child: s.recentActivity.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.all(8),
                          child: Text('No activity yet — complete your first mission!',
                              style: TextStyle(color: AppColors.muted)),
                        )
                      : Column(
                          children: s.recentActivity.take(6).map((a) => _ActivityRow(item: a)).toList(),
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

class _Avatar extends StatelessWidget {
  final Object? user;
  const _Avatar({this.user});

  @override
  Widget build(BuildContext context) {
    final name = user is PublicUser ? (user as PublicUser).displayName : '?';
    final initial = name.isEmpty ? '?' : name[0].toUpperCase();
    return CircleAvatar(
      radius: 18,
      backgroundColor: AppColors.primary,
      child: Text(initial, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
    );
  }
}

class _PointsCard extends StatelessWidget {
  final HomeSummary summary;
  const _PointsCard({required this.summary});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [AppColors.primary, AppColors.accent]),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('MOTION POINTS', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text('${summary.points}', style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          _LevelBar(level: summary.level),
        ],
      ),
    );
  }
}

class _LevelBar extends StatelessWidget {
  final LevelInfo level;
  const _LevelBar({required this.level});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('L${level.level}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(level.name, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: level.progressToNext.clamp(0, 1),
            minHeight: 8,
            backgroundColor: Colors.white24,
            valueColor: const AlwaysStoppedAnimation(Colors.white),
          ),
        ),
        const SizedBox(height: 4),
        Text(level.nextMin != null ? '${level.nextMin} pts to next level' : 'Highest level',
            style: const TextStyle(color: Colors.white70, fontSize: 12)),
      ],
    );
  }
}

class _WalletStrip extends StatelessWidget {  final HomeWallet wallet;
  const _WalletStrip({required this.wallet});

  @override
  Widget build(BuildContext context) {
    final active = wallet.available;
    return Card(
      child: ListTile(
        leading: Icon(active ? Icons.account_balance_wallet : Icons.account_balance_wallet_outlined,
            color: active ? AppColors.success : AppColors.muted),
        title: Text('Motion Wallet · ${wallet.currency}'),
        subtitle: Text(active ? 'Wallet active (${wallet.status})' : 'Wallet available — activate it'),
        trailing: Icon(active ? Icons.check_circle : Icons.chevron_right,
            color: active ? AppColors.success : AppColors.muted),
      ),
    );
  }
}

class _RecommendedMission extends StatelessWidget {
  final Mission mission;
  final VoidCallback onTap;
  const _RecommendedMission({required this.mission, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(mission.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink)),
            const SizedBox(height: 6),
            Text(mission.description, maxLines: 2, overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.muted)),
            const SizedBox(height: 10),
            Row(
              children: [
                VerificationTag(verification: mission.verification),
                const Spacer(),
                PointBadge(points: mission.rewardPoints),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  final ActivityItem item;
  const _ActivityRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final positive = item.positive ?? true;
    final icon = switch (item.kind) {
      'mission' => Icons.verified,
      'points' => Icons.bolt,
      'wallet' => Icons.account_balance_wallet,
      'reward' => Icons.redeem,
      'reputation' => Icons.local_fire_department,
      _ => Icons.circle,
    };
    return ListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      leading: Icon(icon, color: AppColors.primary, size: 22),
      title: Text(item.title, style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink)),
      subtitle: Text('${item.subtitle} · ${_shortDate(item.date)}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
      trailing: item.amount != null
          ? Text(
              '${positive ? '+' : ''}$item.amount',
              style: TextStyle(fontWeight: FontWeight.w700, color: positive ? AppColors.success : AppColors.destructive),
            )
          : null,
    );
  }
}

String _shortDate(String iso) {
  final dt = DateTime.tryParse(iso);
  if (dt == null) return '';
  final now = DateTime.now();
  if (dt.year == now.year && dt.month == now.month && dt.day == now.day) {
    return 'Today ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
  return '${dt.day}/${dt.month}/${dt.year}';
}
