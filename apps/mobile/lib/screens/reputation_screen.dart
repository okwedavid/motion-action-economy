import 'package:flutter/material.dart';

import '../api/motion_api.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/widgets.dart';

class ReputationScreen extends StatefulWidget {
  final MotionApi api;
  const ReputationScreen({super.key, required this.api});

  @override
  State<ReputationScreen> createState() => _ReputationScreenState();
}

class _ReputationScreenState extends State<ReputationScreen> {
  late Future<ReputationProfile> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.api.reputation();
  }

  void _reload() => setState(() => _future = widget.api.reputation());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reputation')),
      body: FutureBuilder<ReputationProfile>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const LoadingView(message: 'Loading reputation…');
          }
          if (snap.hasError) {
            return ErrorView(error: snap.error, onRetry: _reload);
          }
          final rep = snap.data!;
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _ScoreCard(score: rep.score, level: rep.level),
                const SizedBox(height: 12),
                SectionCard(
                  title: 'WHY YOUR SCORE CHANGED',
                  child: rep.reasons.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.all(8),
                          child: Text('No reputation events yet — complete missions to build proof.',
                              style: TextStyle(color: AppColors.muted)),
                        )
                      : Column(
                          children: rep.reasons.map((r) => _ReasonRow(reason: r)).toList(),
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

class _ScoreCard extends StatelessWidget {
  final int score;
  final LevelInfo level;
  const _ScoreCard({required this.score, required this.level});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [AppColors.ink, Color(0xFF1E2A44)]),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('REPUTATION SCORE',
                    style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white12,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(children: [
                  const Icon(Icons.local_fire_department, color: Colors.orangeAccent, size: 16),
                  const SizedBox(width: 4),
                  Text('${level.name} · L${level.level}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                ]),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text('$score', style: const TextStyle(color: Colors.white, fontSize: 44, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: level.progressToNext.clamp(0, 1),
              minHeight: 8,
              backgroundColor: Colors.white24,
              valueColor: const AlwaysStoppedAnimation(Colors.orangeAccent),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            level.nextMin != null
                ? '$score / ${level.nextMin} — ${level.nextMin! - score} more to reach ${level.name}'
                : 'Highest level reached',
            style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class _ReasonRow extends StatelessWidget {
  final ReputationReason reason;
  const _ReasonRow({required this.reason});

  @override
  Widget build(BuildContext context) {
    final positive = reason.delta >= 0;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      leading: Icon(positive ? Icons.add_circle_outline : Icons.remove_circle_outline,
          color: positive ? AppColors.success : AppColors.destructive),
      title: Text(reason.label, style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink)),
      subtitle: Text(reason.reason, maxLines: 2, overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: AppColors.muted, fontSize: 12)),
      trailing: Text('${positive ? '+' : ''}${reason.delta}',
          style: TextStyle(fontWeight: FontWeight.w700, color: positive ? AppColors.success : AppColors.destructive)),
    );
  }
}
