# MOTION — Move. Prove. Earn.

An **Action Economy** platform: users `DISCOVER → ACT → PROVE → EARN → WALLET → REPEAT`. Built as a mobile-friendly (Android + web) fintech product, architected for real financial rewards via **BMONI**, with a secure, tested, deployable backend.

This is a **single monorepo** with two apps:

| Path | What | Stack |
|---|---|---|
| `apps/api` | Backend API | Node ≥18, TypeScript (strict), Express, PostgreSQL (`pg`), `zod`, `bcryptjs`, `helmet` |
| `apps/mobile` | Client (Flutter) | Flutter, **Android + web**, `http`, `shared_preferences` |

> **Read first:** `docs/IMPLEMENTATION_STATUS.md` — full feature matrix, verification status, security review, and known blockers/hand-offs.

---

## Getting started

### API

```bash
cd apps/api
npm install
cp .env.example .env        # set SESSION_SECRET (required outside demo mode)
npm run db:migrate          # apply SQL migrations
npm run db:seed             # seed missions/rewards/QR demo data
npm run dev                 # starts on :4000
```

Health check: `GET http://localhost:4000/health`.

Without a database, run in mock/demo mode (`DEMO_MODE=true`) — no BMONI credentials needed; the mobile app shows a **DemoBanner** whenever the backend reports `demo: true` and never fabricates data.

### Mobile (Flutter)

```bash
cd apps/mobile
flutter pub get

# Web (same-origin '' or explicit URL)
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:4000

# Android emulator reaches host via 10.0.2.2
flutter run -d emulator --dart-define=API_BASE_URL=http://10.0.2.2:4000

# Release Android app bundle
flutter build appbundle --release
```

**Note:** the Android `appbundle` build requires Android SDK **36** + BuildTools **28.0.3** + accepted licenses on the build machine (minSdk is 24 for the BMONI SDK). See `docs/IMPLEMENTATION_STATUS.md §7`.

---

## Verification

Backend (all green):

```bash
cd apps/api
npm run lint        # ESLint, 0 problems
npm run typecheck   # tsc --noEmit
npm run build       # tsc + copies migration SQL into dist
npm test            # 47 tests, pg-mem (no external DB needed)
```

Mobile:

```bash
cd apps/mobile
flutter analyze     # no issues
flutter test        # 4 tests pass
flutter build web   # builds build/web
```

---

## CI / CD

GitHub Actions in `.github/workflows/`:

- `api-ci.yml` — lint, typecheck, build, test (in-memory `pg-mem`, no DB/credentials needed).
- `mobile-ci.yml` — `pub get`, analyze, test, web build.

---

## Docker

```bash
docker compose up --build
```

Starts Postgres 16 + the API (`apps/api/Dockerfile`, multi-stage, non-root user, healthcheck). The runtime runs `node dist/db/migrate.js` before the app. Set `SESSION_SECRET` in your shell before `up`.

---

## API surface (high level)

Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /me`.
Missions: `GET /missions`, `GET /missions/:id`, `POST /missions/:id/complete` (quiz / QR / location proof types).
Home: `GET /home` (summary + recommended + activity).
Reputation: `GET /reputation`.
Wallet: `GET /wallet`, `GET /wallet/balance`, `GET /wallet/transactions`, `POST /wallet/onboard`.
Webhooks: `POST /webhooks/bmoni` (HMAC-SHA256 verified over raw body, dedup, correct ack semantics).

All endpoints except `/health` and `/webhooks/bmoni` are bearer-auth guarded.

---

## Security

Passwords bcrypt (cost 12); session tokens random + only SHA-256 stored; server-side grading; single-use QR; idempotent rewards; `helmet`, explicit CORS, rate limiting; `.env` gitignored + logger redaction; webhook HMAC-SHA256 over raw bytes with constant-time compare and dedup.

---

## Blockchain / financial rewards (BMONI)

The backend ships a **BMONI adapter architecture** (`apps/api/src/integrations/bmoni/`) behind a clean provider boundary:

- `gateway.ts` / `client.ts` — API gateway + auth (`x-api-key`).
- `sandboxProvider.ts` — sandbox/mock implementation (clearly labelled, non-fabricating).
- `rewardProvider.ts` — reward provider behind the existing `RewardProvider` interface.
- `webhookService.ts` — signed event processing on `employee.*` families.

**Live mode** requires real `BMONI_MODE=live` + `BMONI_API_KEY` / `BMONI_WEBHOOK_SECRET` credentials. None are bundled; mock mode is the non-blocking default.
