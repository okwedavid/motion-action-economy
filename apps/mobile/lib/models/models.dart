/// Typed models mirroring the MOTION backend API responses.
///
/// All parsing is lenient (unknown/absent fields fall back to safe defaults)
/// so a change in the API never crashes the app.
library;

class PublicUser {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String displayName;
  final String? bmoniUserId;

  const PublicUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.displayName,
    this.bmoniUserId,
  });

  factory PublicUser.fromJson(Map<String, dynamic> j) => PublicUser(
        id: (j['id'] ?? '') as String,
        email: (j['email'] ?? '') as String,
        firstName: (j['firstName'] ?? '') as String,
        lastName: (j['lastName'] ?? '') as String,
        displayName: (j['displayName'] ?? '') as String,
        bmoniUserId: j['bmoniUserId'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'firstName': firstName,
        'lastName': lastName,
        'displayName': displayName,
        if (bmoniUserId != null) 'bmoniUserId': bmoniUserId,
      };
}

class LevelInfo {
  final int level;
  final String name;
  final double progressToNext;
  final int currentMin;
  final int? nextMin;

  const LevelInfo({
    required this.level,
    required this.name,
    required this.progressToNext,
    required this.currentMin,
    this.nextMin,
  });

  factory LevelInfo.fromJson(Map<String, dynamic> j) => LevelInfo(
        level: (j['level'] as num?)?.toInt() ?? 1,
        name: (j['name'] ?? '') as String,
        progressToNext: ((j['progressToNext'] as num?) ?? 0).toDouble(),
        currentMin: (j['currentMin'] as num?)?.toInt() ?? 0,
        nextMin: (j['nextMin'] as num?)?.toInt(),
      );
}

class QuizQuestion {
  final int index;
  final String prompt;
  final List<String> options;

  const QuizQuestion({required this.index, required this.prompt, required this.options});

  factory QuizQuestion.fromJson(Map<String, dynamic> j) => QuizQuestion(
        index: (j['index'] as num?)?.toInt() ?? 0,
        prompt: (j['prompt'] ?? '') as String,
        options: ((j['options'] as List?) ?? []).map((o) => o as String).toList(),
      );
}

class MissionLocation {
  final double lat;
  final double lng;
  final double radiusMeters;

  const MissionLocation({required this.lat, required this.lng, required this.radiusMeters});

  factory MissionLocation.fromJson(Map<String, dynamic> j) => MissionLocation(
        lat: ((j['center']?['lat']) as num?)?.toDouble() ?? 0,
        lng: ((j['center']?['lng']) as num?)?.toDouble() ?? 0,
        radiusMeters: ((j['radiusMeters'] as num?) ?? 100).toDouble(),
      );
}

class Mission {
  final String id;
  final String slug;
  final String title;
  final String description;
  final String type;
  final String verification;
  final int rewardPoints;
  final String status;
  final String? expiresAt;
  final List<QuizQuestion>? quiz;
  final MissionLocation? location;
  final String? qrPayload;

  const Mission({
    required this.id,
    required this.slug,
    required this.title,
    required this.description,
    required this.type,
    required this.verification,
    required this.rewardPoints,
    required this.status,
    this.expiresAt,
    this.quiz,
    this.location,
    this.qrPayload,
  });

  factory Mission.fromJson(Map<String, dynamic> j) => Mission(
        id: (j['id'] ?? '') as String,
        slug: (j['slug'] ?? '') as String,
        title: (j['title'] ?? '') as String,
        description: (j['description'] ?? '') as String,
        type: (j['type'] ?? '') as String,
        verification: (j['verification'] ?? '') as String,
        rewardPoints: ((j['rewardPoints'] as num?) ?? 0).toInt(),
        status: (j['status'] ?? '') as String,
        expiresAt: j['expiresAt'] as String?,
        quiz: j['quiz'] == null
            ? null
            : ((j['quiz']['questions'] as List?) ?? [])
                .map((q) => QuizQuestion.fromJson(q as Map<String, dynamic>))
                .toList(),
        location: j['location'] == null ? null : MissionLocation.fromJson(j['location'] as Map<String, dynamic>),
        qrPayload: j['qrPayload'] as String?,
      );

  bool get isQuiz => verification == 'QUIZ';
  bool get isQr => verification == 'QR';
  bool get isLocation => verification == 'LOCATION';
}

class ActivityItem {
  final String kind;
  final String title;
  final String subtitle;
  final String date;
  final int? amount;
  final bool? positive;

  const ActivityItem({
    required this.kind,
    required this.title,
    required this.subtitle,
    required this.date,
    this.amount,
    this.positive,
  });

  factory ActivityItem.fromJson(Map<String, dynamic> j) => ActivityItem(
        kind: (j['kind'] ?? '') as String,
        title: (j['title'] ?? '') as String,
        subtitle: (j['subtitle'] ?? '') as String,
        date: (j['date'] ?? '') as String,
        amount: (j['amount'] as num?)?.toInt(),
        positive: j['positive'] as bool?,
      );
}

class HomeWallet {
  final bool available;
  final String currency;
  final String status;

  const HomeWallet({required this.available, required this.currency, required this.status});

  factory HomeWallet.fromJson(Map<String, dynamic> j) => HomeWallet(
        available: (j['available'] as bool?) ?? false,
        currency: (j['currency'] ?? '') as String,
        status: (j['status'] ?? '') as String,
      );
}

class HomeSummary {
  final String greeting;
  final int points;
  final LevelInfo level;
  final LevelInfo reputation;
  final Mission? recommendedMission;
  final List<ActivityItem> recentActivity;
  final HomeWallet? wallet;
  final int consistencyDays;

  const HomeSummary({
    required this.greeting,
    required this.points,
    required this.level,
    required this.reputation,
    this.recommendedMission,
    required this.recentActivity,
    this.wallet,
    required this.consistencyDays,
  });

  factory HomeSummary.fromJson(Map<String, dynamic> j) => HomeSummary(
        greeting: (j['greeting'] ?? '') as String,
        points: (j['points'] as num?)?.toInt() ?? 0,
        level: LevelInfo.fromJson(Map<String, dynamic>.from(j['level'] as Map? ?? {})),
        reputation: LevelInfo.fromJson(Map<String, dynamic>.from(j['reputation'] as Map? ?? {})),
        recommendedMission: j['recommendedMission'] == null
            ? null
            : Mission.fromJson(j['recommendedMission'] as Map<String, dynamic>),
        recentActivity: ((j['recentActivity'] as List?) ?? [])
            .map((a) => ActivityItem.fromJson(a as Map<String, dynamic>))
            .toList(),
        wallet: j['wallet'] == null ? null : HomeWallet.fromJson(j['wallet'] as Map<String, dynamic>),
        consistencyDays: (j['consistencyDays'] as num?)?.toInt() ?? 0,
      );
}

class ReputationReason {
  final int delta;
  final String label;
  final String reason;
  final String date;

  const ReputationReason({required this.delta, required this.label, required this.reason, required this.date});

  factory ReputationReason.fromJson(Map<String, dynamic> j) => ReputationReason(
        delta: (j['delta'] as num?)?.toInt() ?? 0,
        label: (j['label'] ?? '') as String,
        reason: (j['reason'] ?? '') as String,
        date: (j['date'] ?? '') as String,
      );
}

class ReputationProfile {
  final int score;
  final LevelInfo level;
  final List<ReputationReason> reasons;

  const ReputationProfile({required this.score, required this.level, required this.reasons});

  factory ReputationProfile.fromJson(Map<String, dynamic> j) => ReputationProfile(
        score: (j['score'] as num?)?.toInt() ?? 0,
        level: LevelInfo.fromJson(Map<String, dynamic>.from(j['level'] as Map? ?? {})),
        reasons: ((j['reasons'] as List?) ?? [])
            .map((r) => ReputationReason.fromJson(r as Map<String, dynamic>))
            .toList(),
      );
}

class WalletDetails {
  final String id;
  final String currency;
  final String status;
  final String? address;
  final String? smartWalletId;
  final bool onboarded;
  final bool hasKyc;
  final bool railActive;

  const WalletDetails({
    required this.id,
    required this.currency,
    required this.status,
    this.address,
    this.smartWalletId,
    required this.onboarded,
    required this.hasKyc,
    required this.railActive,
  });

  factory WalletDetails.fromJson(Map<String, dynamic> j) => WalletDetails(
        id: (j['id'] ?? '') as String,
        currency: (j['currency'] ?? '') as String,
        status: (j['status'] ?? '') as String,
        address: j['address'] as String?,
        smartWalletId: j['smart_wallet_id'] as String?,
        onboarded: (j['onboarded'] as bool?) ?? false,
        hasKyc: (j['has_kyc'] as bool?) ?? false,
        railActive: (j['rail_active'] as bool?) ?? false,
      );
}

class WalletTx {
  final String id;
  final String type;
  final String state;
  final String currency;
  final String amount;
  final String statusMessage;
  final String createdAt;

  const WalletTx({
    required this.id,
    required this.type,
    required this.state,
    required this.currency,
    required this.amount,
    required this.statusMessage,
    required this.createdAt,
  });

  factory WalletTx.fromJson(Map<String, dynamic> j) => WalletTx(
        id: (j['id'] ?? '') as String,
        type: (j['type'] ?? '') as String,
        state: (j['state'] ?? '') as String,
        currency: (j['currency'] ?? '') as String,
        amount: (j['amount'] ?? '0') as String,
        statusMessage: (j['status_message'] ?? '') as String,
        createdAt: (j['created_at'] ?? '') as String,
      );
}

class WalletOnboarding {
  final String status;
  final bool active;
  final bool hasKyc;
  final bool railActive;

  const WalletOnboarding({required this.status, required this.active, required this.hasKyc, required this.railActive});

  factory WalletOnboarding.fromJson(Map<String, dynamic> j) => WalletOnboarding(
        status: (j['status'] ?? '') as String,
        active: (j['active'] as bool?) ?? false,
        hasKyc: (j['hasKyc'] as bool?) ?? false,
        railActive: (j['railActive'] as bool?) ?? false,
      );
}

class WalletOverview {
  final String provider;
  final String mode;
  final bool demo;
  final List<WalletDetails> wallets;
  final WalletDetails? active;
  final WalletOnboarding onboarding;
  final bool balanceAvailable;
  final List<WalletTx> transactions;
  final List<String> supportedCurrencies;

  const WalletOverview({
    required this.provider,
    required this.mode,
    required this.demo,
    required this.wallets,
    this.active,
    required this.onboarding,
    required this.balanceAvailable,
    required this.transactions,
    required this.supportedCurrencies,
  });

  factory WalletOverview.fromJson(Map<String, dynamic> j) => WalletOverview(
        provider: (j['provider'] ?? '') as String,
        mode: (j['mode'] ?? '') as String,
        demo: (j['demo'] as bool?) ?? false,
        wallets: ((j['wallets'] as List?) ?? [])
            .map((w) => WalletDetails.fromJson(w as Map<String, dynamic>))
            .toList(),
        active: j['active'] == null ? null : WalletDetails.fromJson(j['active'] as Map<String, dynamic>),
        onboarding: WalletOnboarding.fromJson(Map<String, dynamic>.from(j['onboarding'] as Map? ?? {})),
        balanceAvailable: (j['balanceAvailable'] as bool?) ?? false,
        transactions: ((j['transactions'] as List?) ?? [])
            .map((t) => WalletTx.fromJson(t as Map<String, dynamic>))
            .toList(),
        supportedCurrencies: ((j['supportedCurrencies'] as List?) ?? []).map((c) => c as String).toList(),
      );
}

class WalletBalance {
  final int motionPoints;
  final String provider;
  final String mode;
  final bool demo;
  final String balanceAvailable;
  final WalletOnboarding onboarding;

  const WalletBalance({
    required this.motionPoints,
    required this.provider,
    required this.mode,
    required this.demo,
    required this.balanceAvailable,
    required this.onboarding,
  });

  factory WalletBalance.fromJson(Map<String, dynamic> j) => WalletBalance(
        motionPoints: (j['motionPoints'] as num?)?.toInt() ?? 0,
        provider: ((j['financial'] as Map?)?['provider'] as String?) ?? '',
        mode: ((j['financial'] as Map?)?['mode'] as String?) ?? '',
        demo: ((j['financial'] as Map?)?['demo'] as bool?) ?? false,
        balanceAvailable: ((j['financial'] as Map?)?['balanceAvailable'] as String?) ?? '',
        onboarding: WalletOnboarding.fromJson(Map<String, dynamic>.from(j['financial']?['onboarding'] as Map? ?? {})),
      );
}
