import 'package:flutter/material.dart';

import 'app.dart';
import 'api/api_client.dart';
import 'state/auth_state.dart';
import 'state/session_store.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final auth = AuthState(store: SessionStore(), client: ApiClient());
  runApp(MotionApp(auth: auth));
}
