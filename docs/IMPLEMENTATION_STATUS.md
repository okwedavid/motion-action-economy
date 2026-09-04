# MOTION — Implementation Status

**Date:** 2026-09-04
**Scope:** Full-product sprint state. The previously locked-in, verified backend action-economy core was preserved and extended (wallet + BMONI adapter architecture + webhooks), then wrapped with a Flutter client, tests, CI, containerization, docs, and a security/QA pass. **2026-09-04 updates:** Express 5 upgrade (audit clean), Android release appbundle now builds locally (SDK 36 + real upload keystore), Render deployment verified end-to-end.

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

- Backend: `npm run typecheck` ✅ · `npm run lint` (0 problems) ✅ · `npm run build` ✅ · `npm test` **47/47 pass** ✅ (Express 5).
- Backend runtime: `/health` 200; `/wallet`, `/wallet/balance`, `/webhooks/bmoni`, `/missions` all auth-guarded (401 unauthenticated) ✅.
- Flutter: `flutter analyze` "No issues found!" ✅ · `flutter test` all pass ✅ · `flutter build web` success ✅.
- **Android release:** `flutter build appbundle --release` ✅ — **48.3MB `app-release.aab`** built locally (Android SDK 36 + BuildTools 36.0.0 + NDK r28c + accepted licenses) and signed with a dedicated upload keystore (see §7).
- **Production E2E (2026-09-04):** live API at `motion-action-economy.onrender.com` → register/login/`/auth/me`/`/home`/`/wallet` (mock BMONI, demo:true)/`/reputation` all verified with a throwaway account. Render web app (`motion-web-4je1.onrender.com`) boots in headless Chrome with the production API URL baked in; CORS preflight from the web origin passes.
- **Blocked locally:** Docker build (Docker not installed on this machine — config files still written and reviewable).

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
| Dependency audit | ✅ | `npm audit` → **0 vulnerabilities**. Upgraded to **Express 5** (`express@5.2.1`, `@types/express@5`) — body-parser 2.x + `qs@6.16.0` clear the previously deferred `qs` advisories (incl. CVE-2026-82562). Runtime smoke-tested; `req.params` typing fix in `missions.ts`; BMONI config now reads `BMONI_API_KEY` live so the credentials guard is env-independent. |

---

## 6. Deployability

- **CI:** API (install→lint→typecheck→build→test) and Mobile (pub get→analyze→test→build web) workflows. Tests run in-memory (`pg-mem`) so **no external DB/credentials needed for CI**. API runs on **Express 5** (`express@5.2.1`).
- **Docker:** multi-stage `apps/api/Dockerfile` (runtime runs `node dist/db/migrate.js && node dist/index.js`); `docker-compose.yml` wires Postgres 16 + API with health-gated depends_on, non-default secret sample, and volume. Docker build not run locally (Docker absent).
- **Android release:** now builds locally (SDK 36 + BuildTools 36.0.0 + NDK r28c + accepted licenses). `flutter build appbundle --release` → `apps/mobile/build/app/outputs/bundle/release/app-release.aab` (48.3MB), **signed with a dedicated upload keystore** (`apps/mobile/android/app/upload-keystore.jks` + `key.properties`, both gitignored — **back these up**). Play upload still requires registering the app in the Play Console (hand-off).
- **Render:** blueprint + build script verified — `render.yaml` (static `motion-web`, `rootDir: apps/mobile`, `publishPath: build/web`) matches the deployed service; `scripts/build_render.sh` installs Flutter 3.47.2 and bakes `API_BASE_URL` (default `https://motion-action-economy.onrender.com`) + `DEMO_MODE` at compile time. Live checks all green. `.env.example` CORS list was cleaned of a dead Vercel origin.

---

## 7. Blocked / hand-off items

1. **Play Console upload** — the release AAB is built and upload-signed, but the app must be registered in Google Play Console and the upload key certificate fingerprint (`SHA256: 32:E8:48:05:42:AF:42:F6:F8:A2:D6:92:5D:FF:50:60:01:A7:08:2C:E7:5D:82:78:AE:F1:F6:A7:6A:6A:45:E4`) enrolled there. **Back up `apps/mobile/android/app/upload-keystore.jks` + `key.properties` off-machine before publishing** — losing them blocks future updates.
2. **Docker build** — install Docker, then `docker compose up --build`.
3. **BMONI live** — requires `BMONI_MODE=live` + real `BMONI_API_KEY`/`BMONI_WEBHOOK_SECRET`; sandbox shared key is dev-only; mock mode is the non-blocking default and never fabricates data to the client.
4. **Seed production missions** — the production API currently returns an empty `/missions` list (no seeded missions), so the quiz/QR/location earn flow cannot be exercised against production yet. Run `npm run db:seed` against the production DB.

---

## 8. Bottom line

The **full MOTION loop is now implemented and test-backed**: action-economy core (Express 5, audit-clean), wallet, BMONI adapter + webhook architecture, a Flutter client with web (deployed on Render, production API verified E2E) and Android (release AAB building + upload-signed locally), CI, Docker, and docs. Remaining items are external hand-offs only: Play Console registration, Docker on this machine, BMONI live credentials, and seeding missions into the production DB.
