import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/motion_api.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/widgets.dart';

class MissionDetailScreen extends StatefulWidget {
  final MotionApi api;
  final Mission mission;
  const MissionDetailScreen({super.key, required this.api, required this.mission});

  @override
  State<MissionDetailScreen> createState() => _MissionDetailScreenState();
}

class _MissionDetailScreenState extends State<MissionDetailScreen> {
  final Map<int, int> _answers = {};
  final _qrController = TextEditingController();
  bool _busy = false;
  String? _resultMessage;
  bool _completed = false;

  Mission get mission => widget.mission;

  @override
  void dispose() {
    _qrController.dispose();
    super.dispose();
  }

  void _setBusy(bool v) => setState(() => _busy = v);

  Future<void> _submitQuiz() async {
    if (_answers.length != (mission.quiz?.length ?? 0)) {
      setState(() => _resultMessage = 'Answer every question to submit.');
      return;
    }
    await _run(() => widget.api.completeQuiz(
          mission.id,
          _answers.entries.map((e) => {'questionIndex': e.key, 'answerIndex': e.value}).toList(),
        ));
  }

  Future<void> _submitQr() async {
    final token = _qrController.text.trim();
    if (token.isEmpty) {
      setState(() => _resultMessage = 'Enter the QR token to check in.');
      return;
    }
    await _run(() => widget.api.completeQr(mission.id, token));
  }

  Future<void> _submitLocation() async {
    final loc = mission.location!;
    await _run(() => widget.api.completeLocation(
          mission.id,
          lat: loc.lat,
          lng: loc.lng,
          clientTimestamp: DateTime.now(),
        ));
  }

  Future<void> _run(Future<Map<String, dynamic>> Function() fn) async {
    setState(() => _resultMessage = null);
    _setBusy(true);
    try {
      final result = await fn();
      if (!mounted) return;
      final ok = result['ok'] == true;
      setState(() {
        _completed = ok;
        _resultMessage = ok
            ? 'Verified — you earned ${result['points'] ?? 0} points!'
            : (result['message']?.toString() ?? 'Not verified. Please try again.');
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _resultMessage = e.message);
    } catch (e) {
      if (mounted) setState(() => _resultMessage = 'Could not reach the server.');
    } finally {
      if (mounted) _setBusy(false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(mission.title)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _Header(mission: mission),
          const SizedBox(height: 12),
          if (mission.description.isNotEmpty)
            Text(mission.description, style: const TextStyle(color: AppColors.muted, height: 1.4)),
          const SizedBox(height: 20),
          if (_completed)
            _SuccessCard(message: _resultMessage ?? 'Verified!')
          else
            ..._verificationBody(),
          const SizedBox(height: 12),
          if (!_completed && _resultMessage != null)
            _ResultMessage(message: _resultMessage!),
        ],
      ),
    );
  }

  List<Widget> _verificationBody() {
    if (mission.isQuiz) return _quizBody();
    if (mission.isQr) return _qrBody();
    if (mission.isLocation) return _locationBody();
    return const [Text('This mission is not currently available in the app.')];
  }

  List<Widget> _quizBody() {
    final questions = mission.quiz ?? [];
    return [
      SectionCard(
        title: 'QUIZ · ${questions.length} QUESTIONS',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final q in questions) _QuizQuestionTile(q: q, selected: _answers[q.index], onSelect: (i) {
              setState(() => _answers[q.index] = i);
              _resultMessage = null;
            }),
          ],
        ),
      ),
      const SizedBox(height: 12),
      FilledButton(
        onPressed: _busy ? null : _submitQuiz,
        child: _busy ? const _Spinner() : const Text('Submit answers'),
      ),
    ];
  }

  List<Widget> _qrBody() {
    return [
      const SectionCard(
        title: 'SCAN / ENTER TOKEN',
        child: Text(
          'Show this screen at the venue to scan your code, or enter the token printed at the event to verify your presence.',
          style: TextStyle(color: AppColors.muted, height: 1.4),
        ),
      ),
      const SizedBox(height: 12),
      TextField(
        controller: _qrController,
        decoration: const InputDecoration(labelText: 'QR token', prefixIcon: Icon(Icons.qr_code_2)),
      ),
      const SizedBox(height: 12),
      FilledButton(
        onPressed: _busy ? null : _submitQr,
        child: _busy ? const _Spinner() : const Text('Verify presence'),
      ),
    ];
  }

  List<Widget> _locationBody() {
    final loc = mission.location!;
    return [
      SectionCard(
        title: 'CHECK IN AT LOCATION',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Icons.place, color: AppColors.primary),
              const SizedBox(width: 8),
              Text('${loc.lat.toStringAsFixed(4)}, ${loc.lng.toStringAsFixed(4)}',
                  style: const TextStyle(color: AppColors.ink, fontWeight: FontWeight.w600)),
            ]),
            const SizedBox(height: 8),
            Text('Within ${loc.radiusMeters.toStringAsFixed(0)} m radius · verified on arrival.',
                style: const TextStyle(color: AppColors.muted)),
          ],
        ),
      ),
      const SizedBox(height: 12),
      FilledButton(
        onPressed: _busy ? null : _submitLocation,
        child: _busy ? const _Spinner() : const Text('I am here — check in'),
      ),
    ];
  }
}

class _QuizQuestionTile extends StatelessWidget {
  final QuizQuestion q;
  final int? selected;
  final ValueChanged<int> onSelect;
  const _QuizQuestionTile({required this.q, required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${q.index + 1}. ${q.prompt}', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink)),
          const SizedBox(height: 6),
          for (var i = 0; i < q.options.length; i++)
            InkWell(
              onTap: () => onSelect(i),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Icon(
                      selected == i ? Icons.radio_button_checked : Icons.radio_button_off,
                      color: selected == i ? AppColors.primary : AppColors.muted,
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text(q.options[i], style: const TextStyle(color: AppColors.ink))),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final Mission mission;
  const _Header({required this.mission});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(mission.title,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.ink)),
        ),
        const SizedBox(width: 8),
        PointBadge(points: mission.rewardPoints),
      ],
    );
  }
}

class _ResultMessage extends StatelessWidget {
  final String message;
  const _ResultMessage({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFDECEC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF5C2C0)),
      ),
      child: Text(message, style: const TextStyle(color: AppColors.destructive)),
    );
  }
}

class _SuccessCard extends StatelessWidget {
  final String message;
  const _SuccessCard({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFE9F7EF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFBFE6CD)),
      ),
      child: Column(
        children: [
          const Icon(Icons.verified, color: AppColors.success, size: 40),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          const Text('This action has been recorded as verified activity.',
              textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted, fontSize: 13)),
        ],
      ),
    );
  }
}

class _Spinner extends StatelessWidget {
  const _Spinner();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white));
  }
}
