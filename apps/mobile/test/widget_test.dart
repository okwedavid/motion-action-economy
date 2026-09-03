import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:motion/api/api_client.dart';
import 'package:motion/api/motion_api.dart';
import 'package:motion/models/models.dart';
import 'package:motion/screens/mission_detail_screen.dart';

Mission _quizMission() => Mission(
      id: 'm1',
      slug: 'compound-interest',
      title: 'Understand compound interest',
      description: 'Master the most powerful idea in personal finance.',
      type: 'LEARN',
      verification: 'QUIZ',
      rewardPoints: 50,
      status: 'active',
      quiz: const [
        QuizQuestion(
          index: 0,
          prompt: 'What does compound interest do to your savings over time?',
          options: ['It grows your money faster as time passes', 'It only applies to loans', 'It taxes your interest'],
        ),
      ],
    );

void main() {
  group('models', () {
    test('PublicUser parses and reserializes', () {
      final user = PublicUser.fromJson({
        'id': 'u1',
        'email': 'a@b.dev',
        'firstName': 'Ada',
        'lastName': 'Lovelace',
        'displayName': 'Ada',
      });
      expect(user.id, 'u1');
      expect(user.displayName, 'Ada');
      expect(user.toJson()['email'], 'a@b.dev');
    });

    test('Mission fromJson maps verification and quiz', () {
      final mission = Mission.fromJson({
        'id': 'm1',
        'slug': 's',
        'title': 'T',
        'description': 'D',
        'type': 'LEARN',
        'verification': 'QUIZ',
        'rewardPoints': 50,
        'status': 'active',
        'quiz': {
          'questions': [
            {'index': 0, 'prompt': 'P', 'options': ['A', 'B']},
          ],
        },
      });
      expect(mission.isQuiz, isTrue);
      expect(mission.quiz!.length, 1);
      expect(mission.rewardPoints, 50);
    });

    test('HomeSummary parses nested level and wallet', () {
      final summary = HomeSummary.fromJson({
        'greeting': 'Good morning',
        'points': 50,
        'level': {'level': 2, 'name': 'Consistent', 'progressToNext': 0.5, 'currentMin': 20, 'nextMin': 50},
        'reputation': {'level': 1, 'name': 'First Steps', 'progressToNext': 0.1, 'currentMin': 0, 'nextMin': 20},
        'recentActivity': [],
        'wallet': {'available': true, 'currency': 'NGN', 'status': 'active'},
        'consistencyDays': 3,
      });
      expect(summary.points, 50);
      expect(summary.level.name, 'Consistent');
      expect(summary.wallet!.currency, 'NGN');
      expect(summary.consistencyDays, 3);
    });
  });

  group('mission detail screen', () {
    testWidgets('shows quiz questions and a submit action', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: MissionDetailScreen(api: MotionApi(ApiClient(baseUrl: 'http://localhost:0')), mission: _quizMission())),
      ));
      expect(find.text('Understand compound interest'), findsWidgets);
      expect(find.textContaining('compound interest'), findsWidgets);
      expect(find.text('Submit answers'), findsOneWidget);
    });
  });
}
