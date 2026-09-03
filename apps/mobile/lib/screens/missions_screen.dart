import 'package:flutter/material.dart';

import '../api/motion_api.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/widgets.dart';
import 'mission_detail_screen.dart';

class MissionsScreen extends StatefulWidget {
  final MotionApi api;
  const MissionsScreen({super.key, required this.api});

  @override
  State<MissionsScreen> createState() => _MissionsScreenState();
}

class _MissionsScreenState extends State<MissionsScreen> {
  late Future<List<Mission>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.api.missions();
  }

  void _reload() => setState(() => _future = widget.api.missions());

  Future<void> _open(Mission mission) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => MissionDetailScreen(api: widget.api, mission: mission)),
    );
    if (mounted) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Missions')),
      body: FutureBuilder<List<Mission>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const LoadingView(message: 'Loading missions…');
          }
          if (snap.hasError) {
            return ErrorView(error: snap.error, onRetry: _reload);
          }
          final missions = snap.data!;
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: missions.length,
              itemBuilder: (context, i) => _MissionCard(mission: missions[i], onTap: () => _open(missions[i])),
            ),
          );
        },
      ),
    );
  }
}

class _MissionCard extends StatelessWidget {
  final Mission mission;
  final VoidCallback onTap;
  const _MissionCard({required this.mission, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(_iconFor(mission.type), color: AppColors.primary, size: 22),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(mission.title,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink)),
                  ),
                  VerificationTag(verification: mission.verification),
                ],
              ),
              const SizedBox(height: 8),
              Text(mission.description, maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted)),
              const SizedBox(height: 12),
              Row(
                children: [
                  PointBadge(points: mission.rewardPoints),
                  const Spacer(),
                  const Text('Start', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)),
                  const Icon(Icons.chevron_right, color: AppColors.primary),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static IconData _iconFor(String type) => switch (type) {
        'LEARN' => Icons.school_outlined,
        'MOVE' => Icons.directions_run,
        'DISCOVER' => Icons.explore_outlined,
        _ => Icons.task_alt,
      };
}
