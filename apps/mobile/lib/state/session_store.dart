import 'package:shared_preferences/shared_preferences.dart';

class SessionStore {
  static const _kToken = 'motion.auth.token';
  static const _kUser = 'motion.auth.user';

  Future<String?> readToken() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(_kToken);
  }

  Future<void> save(String token, String userJson) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kToken, token);
    await p.setString(_kUser, userJson);
  }

  Future<String?> readUserJson() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(_kUser);
  }

  Future<void> clear() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(_kToken);
    await p.remove(_kUser);
  }
}
