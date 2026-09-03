import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../api/motion_api.dart';
import '../models/models.dart';
import 'session_store.dart';

enum AuthStatus { unknown, unauthenticated, authenticated }

class AuthState extends ChangeNotifier {
  final SessionStore store;
  final ApiClient client;
  final MotionApi api;

  AuthStatus _status = AuthStatus.unknown;
  PublicUser? _user;

  AuthState({required this.store, required this.client})
      : api = MotionApi(client);

  AuthStatus get status => _status;
  PublicUser? get user => _user;
  bool get isAuthenticated => _status == AuthStatus.authenticated;

  /// Restore a persisted session on cold start.
  Future<void> bootstrap() async {
    try {
      final token = await store.readToken();
      final userJson = await store.readUserJson();
      if (token == null || token.isEmpty) {
        _status = AuthStatus.unauthenticated;
        notifyListeners();
        return;
      }
      client.token = token;
      _user = userJson == null ? null : PublicUser.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
      _status = AuthStatus.authenticated;
      notifyListeners();
      final fresh = await api.me();
      _user = fresh;
      notifyListeners();
    } catch (e) {
      if (e is ApiException && e.statusCode == 401) {
        await _clearSession();
        _status = AuthStatus.unauthenticated;
        notifyListeners();
        return;
      }
      // Transient network failure: keep the cached session if we have one.
      if (_user == null) {
        _status = AuthStatus.unauthenticated;
        notifyListeners();
      }
    }
  }

  Future<void> login({required String email, required String password}) async {
    final result = await api.login(email: email, password: password);
    await _establish(result.token, result.user);
  }

  Future<void> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? displayName,
  }) async {
    final result = await api.register(
      email: email,
      password: password,
      firstName: firstName,
      lastName: lastName,
      displayName: displayName,
    );
    await _establish(result.token, result.user);
  }

  Future<void> _establish(String token, PublicUser user) async {
    client.token = token;
    _user = user;
    _status = AuthStatus.authenticated;
    await store.save(token, jsonEncode(user.toJson()));
    notifyListeners();
  }

  Future<void> logout() async {
    try {
      await api.logout();
    } catch (_) {
      // Logout is best-effort; always clear locally.
    }
    await _clearSession();
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  Future<void> _clearSession() async {
    client.token = null;
    _user = null;
    await store.clear();
  }
}
