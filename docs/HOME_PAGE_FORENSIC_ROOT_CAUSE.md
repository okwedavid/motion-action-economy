# HOME PAGE FORENSIC ROOT CAUSE

**Date:** 2026-09-04
**Scope:** Production Home screen Dart runtime TypeError — root cause, proof, fix, regression coverage, and verification.
**Stack:** Flutter 3.47.2 (web, release build) → MOTION API (`motion-action-economy.onrender.com`).

---

## ROOT CAUSE

`HomeSummary.fromJson` (Flutter) parsed the backend's `reputation` field as a **flat `LevelInfo`**, but the backend `/home` contract returns `reputation` as a **nested object `{ score, level: LevelInfo }`**. Inside `LevelInfo.fromJson`, the nested `level` **object** was cast with `(j['level'] as num?)`, producing:

```
TypeError: Instance of 'minified:Sg': type 'minified:Sg' is not a subtype of type 'num?'
```

(`minified:Sg` is the release-build minified name of the `Map<String, dynamic>` that the `level` object deserializes to.)

The error surfaced inside the Home `FutureBuilder` future (`widget.auth.api.home()` → `MotionApi.home()` → `HomeSummary.fromJson`), so the Home body replaced the whole screen with the `ErrorView` ("Retry"). Missions / Reputation / Wallet / Profile do **not** parse `/home`, which is why only Home crashed.

---

## EXACT FILE / LINE / EXPRESSION

| Item | Value |
|---|---|
| FILE | `apps/mobile/lib/models/models.dart` |
| LINE (pre-fix) | 214 — `reputation: LevelInfo.fromJson(...)` inside `HomeSummary.fromJson` |
| LINE (failing cast) | 59 — `level: (j['level'] as num?)?.toInt() ?? 1,` inside `LevelInfo.fromJson` |
| FIELD | `HomeSummary.reputation` (and its nested `level`) |
| EXPECTED TYPE | `num?` (LevelInfo.level) |
| ACTUAL TYPE | `Map<String, dynamic>` (the nested `level` object) |
| FAILING CAST | `(j['level'] as num?)` where `j` = the `reputation` object |

---

## API RESPONSE (exact, captured live from production /home, 2026-09-04)

```json
{
  "summary": {
    "greeting": "Good evening, QA",
    "points": 0,
    "level": { "level": 1, "name": "First Steps", "progressToNext": 0, "currentMin": 0, "nextMin": 20 },
    "reputation": {
      "score": 0,
      "level": { "level": 1, "name": "First Steps", "progressToNext": 0, "currentMin": 0, "nextMin": 20 }
    },
    "recommendedMission": null,
    "recentActivity": [],
    "wallet": { "available": true, "currency": "NGN", "status": "provisioning" },
    "consistencyDays": 0
  }
}
```

Backend type (proof — `apps/api/src/services/home.ts`):

```ts
export interface HomeSummary {
  greeting: string;
  points: number;
  level: LevelInfo;
  reputation: { score: number; level: LevelInfo };   // <- nested object, NOT LevelInfo
  ...
}
```

---

## DART EXPECTATION (pre-fix, wrong)

```dart
// HomeSummary.fromJson
reputation: LevelInfo.fromJson(
  Map<String, dynamic>.from(j['reputation'] as Map? ?? {}),
),
// -> LevelInfo.fromJson({score: 0, level: {...}})
//    -> (j['level'] as num?)   // j['level'] is a Map -> TypeError
```

---

## WHY THE TYPE ERROR OCCURS

1. Backend returns `reputation = { score: 0, level: {...} }`.
2. Flutter passes that whole object into `LevelInfo.fromJson`.
3. `LevelInfo.fromJson` reads `j['level']` — which is the **nested level object** — and casts it with `as num?`.
4. A `Map` is not a `num?` → runtime `TypeError` (class name minified to `Sg` in the release web build).
5. The `FutureBuilder` future rejects → Home shows the `ErrorView` with Retry instead of crashing the app outright (so no stack trace was visible to users — just the Retry button).

---

## FIX

`apps/mobile/lib/models/models.dart` — represent the real contract with a dedicated model:

```dart
class HomeReputation {
  final int score;
  final LevelInfo level;
  const HomeReputation({required this.score, required this.level});

  factory HomeReputation.fromJson(Map<String, dynamic> j) => HomeReputation(
        score: (j['score'] as num?)?.toInt() ?? 0,
        level: LevelInfo.fromJson(Map<String, dynamic>.from(j['level'] as Map? ?? {})),
      );
}
```

- `HomeSummary.reputation` type changed `LevelInfo` → `HomeReputation`.
- `HomeSummary.fromJson` parses `reputation` via `HomeReputation.fromJson`.
- No other caller uses `HomeSummary.reputation` (HomeScreen renders `level`, not `reputation`; Reputation screen uses the separate `ReputationProfile`). Backend untouched — the contract was already correct.

---

## REGRESSION TEST

`apps/mobile/test/widget_test.dart`:

1. **`HomeSummary parses nested level and wallet (real API shape)`** — nested `reputation.level` object, asserts `reputation.score` / `reputation.level.name`.
2. **`HomeSummary does not throw when reputation.level is an object`** — full populated payload (recommended mission, activity with positive/negative amounts, null wallet).
3. **`HomeSummary parses the exact production /home payload`** — the byte-for-byte production JSON captured live; asserts no throw + parsed values.
4. **`HomeSummary tolerates null/absent optional fields and empty arrays`** — minimal payload.
5. **`home screen renders the production /home payload without crashing`** — widget test pumping `HomeScreen` with a fake `ApiClient` returning the real production shape; asserts rendered texts and `tester.takeException() == null`.
6. **`home screen shows controlled error view when /home fails`** — fake API throws; asserts the `Retry` button (controlled error state, not a crash).

The previous test fixture (`reputation: {'level': 1, ...}`) had encoded the buggy flat shape — it was replaced with the real contract.

---

## TEST RESULTS

```
flutter analyze  -> No issues found!
flutter test     -> 9/9 pass (4 pre-existing + 5 new/updated)
flutter build web --release -> ✓ Built build/web
Backend: typecheck ✅ · lint ✅ · build ✅ · npm test 47/47 ✅
```

---

## PRODUCTION VERIFICATION

- Live production `/home` re-captured and proven to match the model's expectation (nested `reputation.level` object) — see API RESPONSE above.
- The fix is client-side only; the deployed production build still contains the OLD code, so **a redeploy of `apps/mobile` (Render static site `motion-web`, via `scripts/build_render.sh`) is required** for the live Home screen to recover. After redeploy, verify: Login → Home renders the points card + level bar without the Retry error.
- No BMONI, auth, or navigation changes were made.

---

## HOME STATUS

```
HOME STATUS: FIXED (client model corrected; redeploy required)
ROOT CAUSE: HomeSummary.fromJson parsed backend `reputation` ({score, level: LevelInfo})
            as a flat LevelInfo; LevelInfo.fromJson cast the nested level OBJECT
            to num? -> TypeError
FILE: apps/mobile/lib/models/models.dart
LINE: 214 (pre-fix HomeSummary.fromJson) / 59 (failing cast) — new HomeReputation model added
FIX: Dedicated HomeReputation {score, level} mirroring the API contract
TESTS: 9/9 mobile pass incl. exact-production-payload + widget render + error-state tests; backend 47/47
PRODUCTION: Payload re-verified live; redeploy apps/mobile to Render to clear the live error
```