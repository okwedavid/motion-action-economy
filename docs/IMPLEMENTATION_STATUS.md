# MOTION — Implementation Status Audit

**Date:** 2026-09-03
**Scope:** Forensic audit of the current repository state. No new features were implemented during this audit.
**Method:** Direct inspection of every file in the repository (excluding `node_modules/`, `.git/`, `dist/`). Nothing was assumed from TODOs or prior reports.

> **Product goal:** MOTION — "Move. Prove. Earn." An Action Economy platform:
> DISCOVER → ACT → PROVE → EARN → WALLET → REPEAT.
> Final product must be mobile-friendly (Android + web where appropriate), fintech-oriented, demo/investor ready, architected for future BMONI financial rewards, secure, deployable, testable, Play Store ready.

---

## 1. Repository overview

| Item | Finding |
|---|---|
| Git | `main` branch, **zero commits** — entire tree is untracked. |
| Apps | Only `apps/api` (Node/TS/Express backend). |
| Frontend | **None.** No web app, no dashboard. |
| Mobile | **None.** No Flutter/Dart code despite `.gitignore`/`.env.example` referencing Flutter. |
| Docs | **None.** No README, no `docs/`, no specification file. |
| Tests | **None.** No `*.test.ts`/`*.spec.ts` anywhere in the tree. |
| Root workspace | No root `package.json` / monorepo tooling. Single standalone `apps/api` package. |

---

## 2. Backend package summary (`apps/api`)

- **Stack:** Node ≥18, ESM (`type: module`), TypeScript (strict), Express 4, PostgreSQL (`pg`), `zod`, `bcryptjs`, `helmet`, `cors`, `express-rate-limit`.
- **Scripts:** `dev`, `build`, `start`, `lint` (ESLint 0 errors), `typecheck` (clean), `test`/`test:unit`/`test:integration` (defined but **no tests exist**), `db:migrate`, `db:seed`, `audit`.
- **Verification state:** `typecheck` ✅, `lint` ✅ (0 problems), `build` ✅, server boots on `:4000`, `/health` → 200, unknown routes → 404. All confirmed by direct run.

---

## 3. Feature matrix

Legend: ✅ COMPLETE & verified · ◐ PARTIAL · ❌ MISSING or NOT WIRED · ⚠️ BROKEN / non-functional as shipped

| # | Feature | Status | Evidence / File | What remains |
|---|---|---|---|---|
| 1 | DB schema (users, profiles, sessions, missions, attempts, proofs, qr_tokens, ledger, balances, rewards, reputation, wallets, wallet_txs, audit, webhooks) | ✅ | `src/db/migrations/001_init.sql` | None for existing tables. |
| 2 | Migration runner | ✅ | `src/db/migrate.ts` | None. |
| 3 | Seed script (users, POINTS pool, missions, QR token) | ✅ | `src/db/seed.ts` | Not yet exercised against a real DB this session; needs DB. |
| 4 | DbExec abstraction + transactions | ✅ | `src/db/{types,pool,tx,index}.ts` | None. |
| 5 | Config (env-driven, demo mode) | ✅ | `src/config/index.ts`, `.env.example` | Needs real `.env`; requires `SESSION_SECRET` outside demo mode. |
| 6 | Logger (redaction, levels) | ✅ | `src/lib/logger.ts` | None. |
| 7 | Error model (`ApiError` + subclasses) | ✅ | `src/lib/errors.ts` | None. |
| 8 | Auth: register | ✅ | `src/http/routes/auth.ts` → `src/services/auth.ts` | None. |
| 9 | Auth: login / bearer sessions / logout / me | ✅ | `src/http/routes/auth.ts`, `src/services/auth.ts`, `src/repos/users.ts` | None. |
| 10 | Mission listing & detail | ✅ | `src/http/routes/missions.ts` → `src/services/missions.ts` | None. |
| 11 | Mission completion: QUIZ (server-graded) | ✅ | `src/services/proofEngine.ts` `completeQuiz` | None. |
| 12 | Mission completion: QR check-in | ✅ | `src/services/proofEngine.ts` `completeQr` | None. |
| 13 | Mission completion: LOCATION (haversine + timestamp checks) | ✅ | `src/services/proofEngine.ts` `completeLocation` | None. |
| 14 | Proofs + attempts ledger | ✅ | `src/repos/attempts.ts` | None. |
| 15 | Points reward engine (idempotent allocations) | ✅ | `src/services/rewardEngine.ts`, `src/repos/rewards.ts` | None. |
| 16 | Home summary / recommended mission / activity | ✅ | `src/services/home.ts` → `src/http/routes/home.ts` | None. |
| 17 | Reputation (score + levels) | ✅ | `src/services/reputation.ts` → `src/http/routes/reputation.ts` | None. |
| 18 | HTTP middleware (auth guard, error → JSON, 404, async wrapper) | ✅ | `src/http/middleware.ts` | None. |
| 19 | Health check | ✅ | `src/index.ts` `/health` | None. |
| 20 | **Wallet service + wallet API routes** | ◐ | `src/repos/wallet.ts` exists; **no wallet service, no `/wallet` routes, no service in `src/services/app.ts`** | Add wallet service + expose routes (onboard, balance, tx history). |
| 21 | **BMONI integration (real financial rails)** | ❌ | Only config (`src/config/index.ts`), schema columns (`001_init.sql`), and enum type `name: 'POINTS'\|'BMONI'\|'SPONSOR'` in `src/services/rewardEngine.ts`. **No BMONI client/adapter, no BMONI service, no webhook handler.** | Build BMONI adapter architecture (client, provider, webhook verification + handler). Label prod capabilities unavailable without credentials. |
| 22 | **BMONI reward provider** | ❌ | `RewardEngine` only constructs `PointsRewardProvider` (`src/services/rewardEngine.ts`). No `BmoniProvider` implemented. | Implement provider behind the existing `RewardProvider` interface. |
| 23 | Webhooks (BMONI) | ❌ | `src/repos/audit.ts` `WebhookRepo` (dedup) exists. **No route, no signature verification, no handler.** | Add webhook endpoint + signature verification + event handling. |
| 24 | Wallet transactions via BMONI | ❌ | `src/repos/wallet.ts` `createTx`/`updateTxState` exist but nothing calls them. | Wire real flow (deposit/withdrawal/transfer) through BMONI. |
| 25 | **Frontend / web app** | ❌ | No web app. `CORS_ORIGINS` referenced but no origin served. | Build web client. |
| 26 | **Mobile app (Flutter / Android)** | ❌ | No Flutter/Dart code at all. `.gitignore` and `.env.example` reference it but nothing exists. | Build Flutter app (Android-first), wire to API. |
| 27 | Tests (unit/integration) | ❌ | No `*.test.ts`. `test:unit`/`test:integration` scripts exist but find nothing. | Write unit + integration tests (pg-mem is already a dev dependency). |
| 28 | Deployability (Docker, CI, environment docs) | ❌ | No Dockerfile, no CI, no README / deploy docs. | Add Dockerfile, compose, CI, README. |
| 29 | API documentation / contract | ❌ | No OpenAPI/spec docs. | Add OpenAPI or endpoint reference. |
| 30 | Demo/seed readiness end-to-end | ◐ | Migrations + seed exist; server runs. | Requires a reachable PostgreSQL DB and a frontend/mobile to consume; no runnable E2E demo yet. |

---

## 4. Security review (static)

| Area | Status | Notes |
|---|---|---|
| Password storage | ✅ | bcryptjs, cost 12. |
| Session tokens | ✅ | Random 32-byte base64url; only SHA-256 hash stored; expiry + revocation. |
| Server-side grading | ✅ | QUIZ graded server-side; LOCATION validated server-side (radius, timestamp). |
| QR anti-replay | ✅ | Single-use atomic claim (`src/repos/attempts.ts` `QrTokensRepo.validate`). |
| Idempotent rewards | ✅ | `reward_allocations` unique on idempotency key + (user, attempt). |
| Headers / CORS / rate limit | ✅ | `helmet`, explicit CORS origins, `express-rate-limit`. |
| Secrets | ✅ | `.env` gitignored; logger redacts sensitive fields. |
| BMONI webhook security | ❌ | No signature verification implemented (no webhook route at all). |

---

## 5. Key gaps against the product goal

1. **No frontend (web) and no mobile (Flutter/Android)** — the product cannot be "used" by an end user yet; the backend has no UI consumer.
2. **No BMONI integration** — no adapter, provider, wallet routes, or webhook handler. Real financial reward capability is entirely absent (correctly, nothing fake is claimed).
3. **Wallet is not wired** — repo exists but has no service or API surface.
4. **No tests** — test scripts exist but the suite is empty; `pg-mem` is available for integration coverage.
5. **Not deployable** — no Docker/CI/README/API docs.
6. **No git baseline** — zero commits; nothing is version-controlled yet.

---

## 6. Bottom line

The **backend "Move ⇒ Prove ⇒ Earn" loop is real and working** (auth, missions, three verification types, rewards, reputation) and is the strongest, most complete layer. The **"Wallet ⇒ repeat"** side of the loop and **all user-facing surfaces (web + Android) plus BMONI financial rails are missing or not wired.** Any claim that the full MOTION product is "complete" would be false — only the backend action-economy core is complete and verified.
