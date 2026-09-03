/// App-wide configuration.
///
/// - `apiBaseUrl` is where the MOTION backend lives.
///   Override at runtime with `--dart-define=API_BASE_URL=...`.
/// - Web builds served behind the same origin as the API can use '' (same
///   origin). Android emulator reaches the host machine via 10.0.2.2.
class AppConfig {
  AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:4000',
  );

  /// Demo mode: when true, the app shows the backend-provided demo labels and
  /// is safe to point at a sandbox/mock environment. It never fabricates data
  /// itself — it just renders whatever the API returns.
  static const bool demoMode = bool.fromEnvironment('DEMO_MODE', defaultValue: true);
}
