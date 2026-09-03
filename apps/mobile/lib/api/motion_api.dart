import '../models/models.dart';
import 'api_client.dart';

class MotionApi {
  final ApiClient client;

  MotionApi(this.client);

  Future<({PublicUser user, String token, String? expiresAt})> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? displayName,
  }) async {
    final body = await client.post(
      '/auth/register',
      body: {
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
        if (displayName != null && displayName.isNotEmpty) 'displayName': displayName,
      },
    );
    final m = body as Map<String, dynamic>;
    return (
      user: PublicUser.fromJson(m['user'] as Map<String, dynamic>),
      token: (m['token'] ?? '') as String,
      expiresAt: m['expiresAt'] as String?,
    );
  }

  Future<({PublicUser user, String token, String? expiresAt})> login({
    required String email,
    required String password,
  }) async {
    final body = await client.post(
      '/auth/login',
      body: {'email': email, 'password': password},
    );
    final m = body as Map<String, dynamic>;
    return (
      user: PublicUser.fromJson(m['user'] as Map<String, dynamic>),
      token: (m['token'] ?? '') as String,
      expiresAt: m['expiresAt'] as String?,
    );
  }

  Future<void> logout() async {
    await client.post('/auth/logout');
  }

  Future<PublicUser> me() async {
    final body = await client.get('/auth/me');
    final m = body as Map<String, dynamic>;
    return PublicUser.fromJson(m['user'] as Map<String, dynamic>);
  }

  Future<HomeSummary> home() async {
    final body = await client.get('/home');
    final m = body as Map<String, dynamic>;
    return HomeSummary.fromJson(m['summary'] as Map<String, dynamic>);
  }

  Future<List<Mission>> missions() async {
    final body = await client.get('/missions');
    final m = body as Map<String, dynamic>;
    return ((m['missions'] as List?) ?? [])
        .map((x) => Mission.fromJson(x as Map<String, dynamic>))
        .toList();
  }

  Future<Mission> missionDetail(String id) async {
    final body = await client.get('/missions/$id');
    final m = body as Map<String, dynamic>;
    return Mission.fromJson(m['mission'] as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> completeQuiz(String missionId, List<Map<String, int>> answers) async {
    final body = await client.post(
      '/missions/$missionId/complete/quiz',
      body: {'answers': answers},
    );
    return (body as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> completeQr(String missionId, String token) async {
    final body = await client.post(
      '/missions/$missionId/complete/qr',
      body: {'token': token},
    );
    return (body as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> completeLocation(
    String missionId, {
    required double lat,
    required double lng,
    DateTime? clientTimestamp,
  }) async {
    final body = await client.post(
      '/missions/$missionId/complete/location',
      body: {
        'lat': lat,
        'lng': lng,
        if (clientTimestamp != null)
          'clientTimestamp': clientTimestamp.toUtc().toIso8601String(),
      },
    );
    return (body as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
  }

  Future<ReputationProfile> reputation() async {
    final body = await client.get('/reputation');
    final m = body as Map<String, dynamic>;
    return ReputationProfile.fromJson(m['reputation'] as Map<String, dynamic>);
  }

  Future<WalletOverview> wallet() async {
    final body = await client.get('/wallet');
    final m = body as Map<String, dynamic>;
    return WalletOverview.fromJson(m['wallet'] as Map<String, dynamic>);
  }

  Future<WalletBalance> walletBalance() async {
    final body = await client.get('/wallet/balance');
    return WalletBalance.fromJson(body as Map<String, dynamic>);
  }

  Future<List<WalletTx>> walletTransactions({int limit = 50}) async {
    final body = await client.get('/wallet/transactions', query: {'limit': '$limit'});
    final m = body as Map<String, dynamic>;
    return ((m['transactions'] as List?) ?? [])
        .map((t) => WalletTx.fromJson(t as Map<String, dynamic>))
        .toList();
  }

  Future<WalletOverview> onboardWallet({String? currency}) async {
    final body = await client.post('/wallet/onboard', body: {
      if (currency != null && currency.isNotEmpty) 'currency': currency,
    });
    final m = body as Map<String, dynamic>;
    return WalletOverview.fromJson(m['wallet'] as Map<String, dynamic>);
  }
}
