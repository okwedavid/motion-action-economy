import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:motion/api/api_client.dart';
import 'package:motion/api/motion_api.dart';
import 'package:motion/models/models.dart';
import 'package:motion/screens/home_screen.dart';
import 'package:motion/screens/mission_detail_screen.dart';
import 'package:motion/state/auth_state.dart';
import 'package:motion/state/session_store.dart';

/// An ApiClient that returns the real production /home payload shape without
/// touching the network. Lets widget tests exercise the exact JSON contract
/// (including the nested reputation.level object) end to end.
class _FakeApiClient extends ApiClient {
  final bool failHome;
  _FakeApiClient({this.failHome = false}) : super(baseUrl: 'http://localhost:0');

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (failHome) {
      throw const ApiException(statusCode: 500, code: 'SERVER', message: 'boom');
    }
    if (path == '/home') {
      return jsonDecode(
        '{"summary":{"greeting":"Good evening, QA","points":0,'
        '"level":{"level":1,"name":"First Steps","progressToNext":0,"currentMin":0,"nextMin":20},'
        '"reputation":{"score":0,"level":{"level":1,"name":"First Steps","progressToNext":0,"currentMin":0,"nextMin":20}},'
        '"recommendedMission":null,"recentActivity":[],'
        '"wallet":{"available":true,"currency":"NGN","status":"provisioning"},"consistencyDays":0}}',
      ) as Map<String, dynamic>;
    }
    return <String, dynamic>{};
  }
}

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

    // The backend /home contract is:
    //   level:      { level, name, progressToNext, currentMin, nextMin }
    //   reputation: { score, level: { level, name, ... } }   <- nested object!
    // Regression: reputation used to be parsed as a flat LevelInfo, which cast
    // the nested `level` OBJECT to num? and crashed Home with
    // `TypeError: ... is not a subtype of type 'num?'`.
    test('HomeSummary parses nested level and wallet (real API shape)', () {
      final summary = HomeSummary.fromJson({
        'greeting': 'Good morning',
        'points': 50,
        'level': {'level': 2, 'name': 'Consistent', 'progressToNext': 0.5, 'currentMin': 20, 'nextMin': 50},
        'reputation': {
          'score': 0,
          'level': {'level': 1, 'name': 'First Steps', 'progressToNext': 0.1, 'currentMin': 0, 'nextMin': 20},
        },
        'recentActivity': [],
        'wallet': {'available': true, 'currency': 'NGN', 'status': 'active'},
        'consistencyDays': 3,
      });
      expect(summary.points, 50);
      expect(summary.level.name, 'Consistent');
      expect(summary.reputation.score, 0);
      expect(summary.reputation.level.name, 'First Steps');
      expect(summary.reputation.level.level, 1);
      expect(summary.wallet!.currency, 'NGN');
      expect(summary.consistencyDays, 3);
    });

    // Regression test for the exact production TypeError: the nested
    // reputation.level object must never be interpreted as a number.
    test('HomeSummary does not throw when reputation.level is an object', () {
      final summary = HomeSummary.fromJson({
        'greeting': 'Good evening',
        'points': 120,
        'level': {'level': 3, 'name': 'Rising Star', 'progressToNext': 0.25, 'currentMin': 50, 'nextMin': 120},
        'reputation': {
          'score': 75,
          'level': {'level': 2, 'name': 'Consistent', 'progressToNext': 0.5, 'currentMin': 20, 'nextMin': 50},
        },
        'recommendedMission': {
          'id': 'm1',
          'slug': 'event-check-in',
          'title': 'Event check-in',
          'description': 'Prove you attended',
          'type': 'ATTEND',
          'verification': 'QR',
          'rewardPoints': 30,
          'status': 'active',
        },
        'recentActivity': [
          {'kind': 'mission', 'title': 'Event check-in', 'subtitle': 'Verified action', 'date': '2026-09-04T10:00:00Z', 'amount': 30, 'positive': true},
          {'kind': 'points', 'title': 'Reward', 'subtitle': 'Motion Points', 'date': '2026-09-04T11:00:00Z', 'amount': -5, 'positive': false},
        ],
        'wallet': null,
        'consistencyDays': 2,
      });
      expect(summary.reputation.score, 75);
      expect(summary.reputation.level.level, 2);
      expect(summary.recommendedMission!.verification, 'QR');
      expect(summary.recentActivity.length, 2);
      expect(summary.wallet, isNull);
    });

    // Regression: parse the EXACT payload returned by the production API
    // (captured 2026-09-04 from /home on motion-action-economy.onrender.com).
    // This must not throw — it was the crash fixture for the original TypeError.
    test('HomeSummary parses the exact production /home payload', () {
      final raw = '{"summary":{"greeting":"Good evening, QA","points":0,'
          '"level":{"level":1,"name":"First Steps","progressToNext":0,"currentMin":0,"nextMin":20},'
          '"reputation":{"score":0,"level":{"level":1,"name":"First Steps","progressToNext":0,"currentMin":0,"nextMin":20}},'
          '"recommendedMission":null,"recentActivity":[],'
          '"wallet":{"available":true,"currency":"NGN","status":"provisioning"},"consistencyDays":0}}';
      final body = jsonDecode(raw) as Map<String, dynamic>;
      final summary = HomeSummary.fromJson(body['summary'] as Map<String, dynamic>);
      expect(summary.reputation.score, 0);
      expect(summary.reputation.level.name, 'First Steps');
      expect(summary.wallet!.currency, 'NGN');
      expect(summary.recommendedMission, isNull);
    });

    test('HomeSummary tolerates null/absent optional fields and empty arrays', () {
      final summary = HomeSummary.fromJson({
        'greeting': 'Good morning',
        'points': 0,
        'level': {'level': 1, 'name': 'First Steps', 'progressToNext': 0, 'currentMin': 0, 'nextMin': 20},
        'reputation': {'score': 0, 'level': {'level': 1, 'name': 'First Steps', 'progressToNext': 0, 'currentMin': 0, 'nextMin': 20}},
        'recentActivity': [],
        'consistencyDays': 0,
      });
      expect(summary.reputation.level.level, 1);
      expect(summary.recommendedMission, isNull);
      expect(summary.wallet, isNull);
      expect(summary.recentActivity, isEmpty);
      expect(summary.consistencyDays, 0);
    });
  });

  group('home screen', () {
    // HomeScreen renders whatever MotionApi.home() returns through
    // HomeSummary.fromJson — feed it the real production payload to prove the
    // whole Home data/render path survives the previously-crashing shape.
    testWidgets('renders the production /home payload without crashing', (tester) async {
      SharedPreferences.setMockInitialValues({});

      final store = SessionStore();
      final client = _FakeApiClient();
      final auth = AuthState(store: store, client: client);

      await tester.pumpWidget(MaterialApp(home: HomeScreen(auth: auth)));
      // Let the future complete + rebuild.
      await tester.pumpAndSettle();

      expect(find.text('Good evening, QA'), findsOneWidget);
      expect(find.text('0'), findsOneWidget); // MOTION POINTS
      expect(find.text('MOTION'), findsOneWidget); // app bar
      expect(tester.takeException(), isNull);
    });

    testWidgets('shows controlled error view when /home fails', (tester) async {
      SharedPreferences.setMockInitialValues({});

      final store = SessionStore();
      final client = _FakeApiClient(failHome: true);
      final auth = AuthState(store: store, client: client);

      await tester.pumpWidget(MaterialApp(home: HomeScreen(auth: auth)));
      await tester.pumpAndSettle();

      expect(find.text('Retry'), findsOneWidget);
      expect(tester.takeException(), isNull);
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
