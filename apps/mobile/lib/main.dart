import 'package:flutter/material.dart';

import 'app.dart';
import 'api/api_client.dart';
import 'state/auth_state.dart';
import 'state/session_store.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final auth = AuthState(store: SessionStore(), client: ApiClient());
  await auth.bootstrap();
  runApp(MotionApp(auth: auth));
}
