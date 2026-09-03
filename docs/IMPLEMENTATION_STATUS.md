# MOTION — Implementation Status

**Date:** 2026-09-03
**Scope:** Full-product sprint state. The previously locked-in, verified backend action-economy core was preserved and extended (wallet + BMONI adapter architecture + webhooks), then wrapped with a Flutter client, tests, CI, containerization, docs, and a security/QA pass.

> **Product goal:** MOTION — "Move. Prove. Earn." An Action Economy platform:
> DISCOVER → ACT → PROVE → EARN → WALLET → REPEAT.
> Mobile-friendly (Android + web), fintech-oriented, demo/investor ready, architected for BMONI financial rewards, secure, deployable, testable, Play Store ready.

---

## 1. Repository overview (current)

| Item | Finding |
|---|---|
| Git | `main`, 4 sprint commits: API baseline → BMONI/wallet/webhook → test suite → Flutter app. |
| Apps | `apps/api` (Node/TS/Express/Postgres) and `apps/mobile` (Flutter, Android + web). |
| Tests | Backend 47 passing (pg-mem). Flutter analyzer clean + 4 passing tests + web build. |
| CI | `.github/workflows/api-ci.yml` + `mobile-ci.yml`. |
| Containers | `apps/api/Dockerfile`, `apps/api/.dockerignore`, root `docker-compose.yml`. |
| Docs | `docs/IMPLEMENTATION_STATUS.md`, `apps/mobile/README.md`, root `README.md`. |

---

## 2. Verification status (all re-run green in this sprint)

- Backend: `npm run typecheck` ✅ · `npm run lint` (0 problems) ✅ · `npm run build` ✅ · `npm test` **47/47 pass** ✅.
- Backend runtime: `/health` 200; `/wallet`, `/wallet/balance`, `/webhooks/bmoni`, `/missions` all auth-guarded (401 unauthenticated) ✅.
- Flutter: `flutter analyze` "No issues found!" ✅ · `flutter test` all pass ✅ · `flutter build web` success ✅.
- **Blocked locally:** Android `appbundle` build (needs Android SDK 36 + BuildTools 28.0.3 + accepted licenses — see §7) · Docker build (Docker not installed on this machine — config files still written and reviewable).

---

## 3. Feature matrix (backend)

Legend: ✅ COMPLETE & verified · ◐ PARTIAL / blocked externally · ❌ MISSING

| # | Feature | Status | Evidence / File |
|---|---|---|---|
| 1 | DB schema (users, profiles, sessions, missions, attempts, proofs, qr_tokens, ledger, balances, rewards, reputation, wallets, wallet_txs, audit, webhooks) | ✅ | `src/db/migrations/001_init.sql` |
| 2 | Migration runner (idempotent, `schema_migrations`) | ✅ | `src/db/migrate.ts`; build now copies `.sql` into `dist` |
| 3 | Seed script | ✅ | `src/db/seed.ts` |
| 4 | DbExec abstraction + transactions | ✅ | `src/db/{types,pool,tx,index}.ts` |
| 5 | Config (env-driven, demo mode, BMONI settings) | ✅ | `src/config/index.ts` |
| 6 | Logger (redaction, levels) | ✅ | `src/lib/logger.ts` |
| 7 | Error model (`ApiError` + subclasses) | ✅ | `src/lib/errors.ts` |
| 8–9 | Auth: register / login / bearer sessions / logout / me | ✅ | `src/http/routes/auth.ts`, `src/services/auth.ts` |
| 10 | Mission listing & detail | ✅ | `src/http/routes/missions.ts`, `src/services/missions.ts` |
| 11–13 | Completion: QUIZ (server-graded) / QR check-in (single-use) / LOCATION (haversine + timestamp) | ✅ | `src/services/proofEngine.ts` |
| 14 | Proofs + attempts ledger | ✅ | `src/repos/attempts.ts` |
| 15 | Points reward engine (idempotent) | ✅ | `src/services/rewardEngine.ts` |
| 16 | Home summary / recommended mission / activity | ✅ | `src/services/home.ts` |
| 17 | Reputation (score + levels) | ✅ | `src/services/reputation.ts` |
| 18 | HTTP middleware (auth guard, error→JSON, 404, async wrapper) | ✅ | `src/http/middleware.ts` |
| 19 | Health check | ✅ | `src/index.ts` |
| 20 | **Wallet service + API routes** (onboard, balance, tx history) | ✅ | `src/services/wallet.ts`, `src/http/routes/wallet.ts`, `src/repos/wallet.ts` |
| 21 | **BMONI adapter architecture** (gateway, client, sandbox provider, reward provider, typed contracts) | ✅ | `src/integrations/bmoni/*` |
| 22 | **BMONI reward provider** behind existing `RewardProvider` interface | ✅ | `src/integrations/bmoni/rewardProvider.ts`, `rewardProvider.ts` |
| 23 | **BMONI webhooks** (raw-body HMAC-SHA256, constant-time compare, dedup, ack semantics) | ✅ | `src/http/routes/bmoniWebhook.ts`, `src/integrations/bmoni/webhookService.ts` |
| 24 | Wallet transactions via BMONI (deposit/withdraw/transfer) | ◐ | Wired through BMONI client; **live calls require real credentials**; mock/sandbox non-blocking by default |
| 30 | Demo/seed readiness end-to-end | ◐ | Requires a reachable Postgres + API running; mobile app consumes `/home`, `/missions`, `/wallet` etc. |

---

## 4. Mobile app (Flutter) — `apps/mobile`

- App name `motion`, org `com.motion`; platforms **web + android**; minSdk **24** (BMONI SDK requirement, noted in `android/app/build.gradle.kts`).
- Screens: auth, home, missions, mission detail (quiz/QR/location), reputation, wallet, profile.
- State: `AuthState` ChangeNotifier + `SessionStore` (shared_preferences token + user JSON).
- API: `MotionApi` typed wrapper over `ApiClient` (Bearer auth) matching every backend route.
- **Demo mode:** `DemoBanner` shown whenever the backend reports `demo: true`; the app never fabricates data itself.
- Config: `API_BASE_URL` (+ demo flag) via `--dart-define`; web can use same-origin `''`; Android emulator reaches host via `10.0.2.2`.
- Deps: `http`, `shared_preferences`, `intl`.

---

## 5. Security review

| Area | Status | Notes |
|---|---|---|
| Password storage | ✅ | bcryptjs, cost 12 |
| Session tokens | ✅ | Random 32-byte base64url; only SHA-256 hash stored; expiry + revocation |
| Server-side grading | ✅ | QUIZ/LOCATION validated server-side |
| QR anti-replay | ✅ | Single-use atomic claim |
| Idempotent rewards | ✅ | unique on idempotency key + (user, attempt) |
| Headers / CORS / rate limit | ✅ | `helmet`, explicit CORS origins, `express-rate-limit` |
| Secrets | ✅ | `.env` gitignored; logger redacts sensitive fields |
| **BMONI webhook security** | ✅ | HMAC-SHA256 over raw request bytes (`express.raw` mounted before global `express.json`), constant-time compare with length check first, `X-Webhook-Id` dedup, correct 2xx/4xx/5xx ack semantics, 10s timeout; secret from `BMONI_WEBHOOK_SECRET` |
| Docker hardening | ✅ | non-root `USER app`, healthcheck, `.dockerignore`, compose `db` health-gated start |

---

## 6. Deployability

- **CI:** API (install→lint→typecheck→build→test) and Mobile (pub get→analyze→test→build web) workflows. Tests run in-memory (`pg-mem`) so **no external DB/credentials needed for CI**.
- **Docker:** multi-stage `apps/api/Dockerfile` (runtime runs `node dist/db/migrate.js && node dist/index.js`); `docker-compose.yml` wires Postgres 16 + API with health-gated depends_on, non-default secret sample, and volume. Docker build not run locally (Docker absent).
- **Android release:** config may need SDK 36 + BuildTools 28.0.3 + accepted licenses locally; see §7 for exact steps. Signing/Play release requires a keystore (documented in README as a hand-off).

---

## 7. Blocked / hand-off items

1. **Android local appbundle build** — `flutter doctor` reports Android toolchain needs SDK **36** + BuildTools **28.0.3** + accepted licenses. Install via Android Studio SDK Manager (or `sdkmanager "platforms;android-36" "build-tools;28.0.3"`), then `flutter doctor --android-licenses`. After that: `cd apps/mobile && flutter build appbundle --release`.
2. **Docker build** — install Docker, then `docker compose up --build`.
3. **BMONI live** — requires `BMONI_MODE=live` + real `BMONI_API_KEY`/`BMONI_WEBHOOK_SECRET`; sandbox shared key is dev-only; mock mode is the non-blocking default and never fabricates data to the client.

---

## 8. Bottom line

The **full MOTION loop is now implemented and test-backed**: action-economy core, wallet, BMONI adapter + webhook architecture, a Flutter client (web build green, Android config wired but not locally built), CI, Docker, and docs. The only local blockers are environment ones (Android SDK 36, Docker not installed) — not code defects, and both are documented with exact resolution steps.
