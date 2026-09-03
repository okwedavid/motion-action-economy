-- ============================================================================
-- MOTION — initial schema (PostgreSQL)
-- Move. Prove. Earn.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- users & profiles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'active',          -- active | disabled | deleted
  bmoni_user_id TEXT,                                     -- persisted BMONI user id (never recreated per launch)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (lower(email));

CREATE TABLE IF NOT EXISTS profiles (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name  TEXT DEFAULT '',
  avatar_url    TEXT DEFAULT '',
  phone_number  TEXT DEFAULT '',
  country       TEXT DEFAULT 'NG',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_token_hash ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- ----------------------------------------------------------------------------
-- missions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS missions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  type                TEXT NOT NULL,                      -- LEARN | MOVE | DISCOVER
  verification_method TEXT NOT NULL,                      -- QUIZ | QR | LOCATION
  reward_points       INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'active',     -- draft | active | expired | retired
  requirements        JSONB NOT NULL DEFAULT '{}',        -- e.g. pass threshold, radius, qr token seed
  payload             JSONB NOT NULL DEFAULT '{}'         -- quiz questions, location, etc.
    ,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_missions_slug ON missions (slug);
CREATE INDEX IF NOT EXISTS idx_missions_type_status ON missions (type, status);

-- ----------------------------------------------------------------------------
-- mission attempts & proofs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mission_attempts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id     UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'in_progress',     -- in_progress | passed | failed
  verification   JSONB NOT NULL DEFAULT '{}',
  risk_flag      TEXT DEFAULT 'none',                     -- none | duplicate | invalid_location | replay | suspicious
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attempts_user_mission ON mission_attempts (user_id, mission_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON mission_attempts (status);

CREATE TABLE IF NOT EXISTS proofs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id      UUID NOT NULL UNIQUE REFERENCES mission_attempts(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id      UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  verification    TEXT NOT NULL,                          -- QUIZ | QR | LOCATION
  evidence        JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'submitted',      -- submitted | verified | rejected
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proofs_user ON proofs (user_id);

-- ----------------------------------------------------------------------------
-- QR mission tokens (server-generated, expiring, single-use)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qr_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  used_by     UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qr_tokens_token ON qr_tokens (token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_mission ON qr_tokens (mission_id);

-- ----------------------------------------------------------------------------
-- Motion ledger (immutable-style points ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS motion_ledger (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta        INTEGER NOT NULL,                          -- signed change
  reason       TEXT NOT NULL,                             -- MISSION_COMPLETED | REWARD | ADJUSTMENT | REVERSAL
  reference_id UUID,                                      -- source (attempt/proof), nullable
  balance_after INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_user_created ON motion_ledger (user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- Reward pools & allocations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reward_pools (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_name   TEXT NOT NULL DEFAULT 'MOTION',
  pool_type      TEXT NOT NULL,                           -- POINTS | BMONI | SPONSOR
  status         TEXT NOT NULL DEFAULT 'active',
  total_allocated INTEGER NOT NULL DEFAULT 0,
  remaining      INTEGER NOT NULL DEFAULT 0,
  external_ref   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reward_allocations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id      UUID REFERENCES mission_attempts(id) ON DELETE SET NULL,
  pool_id         UUID REFERENCES reward_pools(id) ON DELETE SET NULL,
  provider        TEXT NOT NULL,                          -- POINTS | BMONI | SPONSOR
  amount          INTEGER NOT NULL,
  currency        TEXT DEFAULT 'POINTS',
  status          TEXT NOT NULL DEFAULT 'pending',        -- pending | issued | failed | reversed
  idempotency_key TEXT NOT NULL,
  external_ref    TEXT,                                   -- e.g. bmoni transfer/proposal id
  issued_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_allocations_idempotency ON reward_allocations (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_allocations_user_attempt ON reward_allocations (user_id, attempt_id)
  WHERE attempt_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Motion points balance (derived/maintained transactionally)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS motion_balances (
  user_id   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance   INTEGER NOT NULL DEFAULT 0,
  version   INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Action reputation
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reputation_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta         INTEGER NOT NULL,
  reason        TEXT NOT NULL,                            -- verified_learning | consistency | event_participation | suspicious_penalty | ...
  label         TEXT NOT NULL,
  reference_id  UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rep_events_user ON reputation_events (user_id);

-- ----------------------------------------------------------------------------
-- Wallet (BMONI-backed) & transactions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency      TEXT NOT NULL DEFAULT 'NGN',              -- NGN / USD / CNGN etc.
  status        TEXT NOT NULL DEFAULT 'not_created',      -- not_created | provisioning | active | inactive
  address       TEXT,
  smart_wallet_id TEXT,
  onboarded     BOOLEAN NOT NULL DEFAULT false,
  has_kyc       BOOLEAN NOT NULL DEFAULT false,
  rail_active   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallets_user_currency ON wallets (user_id, currency);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id         UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              TEXT NOT NULL,                        -- deposit | withdrawal | transfer | reward
  state             TEXT NOT NULL DEFAULT 'initiated',    -- initiated | pending | success | failed | unknown
  currency          TEXT NOT NULL DEFAULT 'NGN',
  amount            TEXT NOT NULL DEFAULT '0',
  status_message    TEXT DEFAULT '',
  internal_ref      TEXT,
  bmoni_ref         TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wtx_user_created ON wallet_transactions (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wtx_internal_ref ON wallet_transactions (internal_ref) WHERE internal_ref IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Audit events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,
  action      TEXT NOT NULL,
  resource    TEXT,
  resource_id UUID,
  ip          TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_events (user_id);

-- ----------------------------------------------------------------------------
-- Webhook events (dedup by provider event id)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT NOT NULL DEFAULT 'bmoni',
  provider_event_id TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'received',          -- received | processing | processed | failed
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_provider_event ON webhook_events (provider, provider_event_id);
